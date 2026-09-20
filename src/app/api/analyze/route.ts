/**
 * POST /api/analyze
 *
 * Accepts a previously-uploaded Vercel Blob URL (returned by POST /api/blob-upload),
 * streams the audio from blob storage into memory, sends it to the Gemini API for
 * transcription and term extraction, then returns a structured result.
 *
 * After processing, the blob is scheduled for asynchronous deletion so temporary
 * audio does not persist in blob storage beyond a short grace period.
 *
 * This endpoint receives only JSON metadata — no large multipart body — which
 * means it is not subject to the ~4.5 MB Vercel function request-body limit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { del, get } from '@vercel/blob';
import {
  AnalysisErrorCode,
  BLOB_CLEANUP_TIMEOUT_MS,
} from '@/lib/constants';
import { validateAudioServerSide } from '@/lib/validation';
import { processTranscript, isValidAnalysisResponse } from '@/lib/text-processing';

export const maxDuration = 120; // seconds — matches vercel.json config

interface AnalyzeBody {
  blobUrl: string;
  fileName?: string;
  durationSeconds?: number;
}

/**
 * Schedule async deletion of a Vercel Blob after delayMs milliseconds.
 * Errors are swallowed — a failed cleanup must never surface to the user.
 */
function scheduleCleanup(blobUrl: string, delayMs = BLOB_CLEANUP_TIMEOUT_MS): void {
  if (!blobUrl) return;
  setTimeout(() => {
    del(blobUrl).catch((err: unknown) => {
      console.error('Blob cleanup failed (non-fatal):', err);
    });
  }, delayMs);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let blobUrl: string | undefined;
  let durationSeconds: number | undefined;

  try {
    const body: AnalyzeBody = await request.json();
    blobUrl = body.blobUrl;
    durationSeconds = body.durationSeconds;

    if (!blobUrl) {
      return errorResponse(AnalysisErrorCode.INVALID_RESPONSE, 'No blob URL provided. Please upload audio via /api/blob-upload first.');
    }

    // --- Fetch audio from Vercel Blob (private — uses server token) ---
    let arrayBuffer: ArrayBuffer;
    let mimeType: string | undefined;
    try {
      const blobObj = await get(blobUrl, { access: 'private' });
      if (!blobObj || !blobObj.stream) {
        return errorResponse(AnalysisErrorCode.API_ERROR, 'Failed to retrieve uploaded audio. The blob may have expired or been deleted.');
      }
      // Consume the ReadableStream to an ArrayBuffer
      const chunks: Uint8Array[] = [];
      const reader = blobObj.stream.getReader();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      while (!(chunk = await reader.read()).done) {
        chunks.push(chunk.value);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      arrayBuffer = merged.buffer as ArrayBuffer;
      mimeType = blobObj.blob?.contentType ?? undefined;
    } catch (fetchErr) {
      console.error('Blob fetch error:', fetchErr);
      scheduleCleanup(blobUrl);
      return errorResponse(AnalysisErrorCode.API_ERROR, 'Failed to retrieve uploaded audio. Please try uploading again.');
    }

    // --- Re-validate server-side using actual byte size ---
    const actualSize = arrayBuffer.byteLength;
    const resolvedMimeType = mimeType || inferMimeType(body.fileName);
    const validatedDuration = durationSeconds ?? estimateDuration(actualSize, resolvedMimeType);
    const validationError = validateAudioServerSide(actualSize, validatedDuration, resolvedMimeType);
    if (validationError) {
      scheduleCleanup(blobUrl);
      return errorResponse(validationError.code as AnalysisErrorCode, validationError.message);
    }

    // Convert to base64 for the Gemini inline-data API
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // --- Call Gemini API ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      scheduleCleanup(blobUrl);
      return errorResponse(AnalysisErrorCode.API_ERROR, 'AI service not configured. Please add GEMINI_API_KEY to your environment.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are analyzing a mentorship session recording. Your task is to:
1. Transcribe the audio to text exactly as spoken.
2. Identify the most prominent terms and topics discussed.
3. Return a JSON object with this exact structure:
{
  "transcript": "the full transcribed text",
  "terms": [
    {"word": "term1", "count": 10},
    {"word": "term2", "count": 7}
  ]
}
The terms should represent the most frequently discussed concepts. Include 10-30 terms.
Return ONLY valid JSON, nothing else.`;

    let geminiResponse: string;
    try {
      console.log('[analyze] calling Gemini model=gemini-2.5-flash, mimeType=%s, size=%d bytes', resolvedMimeType, arrayBuffer.byteLength);
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: resolvedMimeType || 'audio/wav',
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      });

      geminiResponse = result.text ?? '';
    } catch (aiErr) {
      const isAiErr = aiErr instanceof Error;
      const status = isAiErr && 'response' in aiErr
        ? (aiErr as unknown as { response?: { status?: number } }).response?.status
        : undefined;
      console.error('[analyze] Gemini error status=' + status, aiErr);
      scheduleCleanup(blobUrl);
      const message = aiErr instanceof Error ? aiErr.message : 'Unknown AI error';
      if (message.includes('429') || message.includes('rate')) {
        return errorResponse(AnalysisErrorCode.API_ERROR, 'The AI service is rate-limited. Please wait a moment and try again.');
      }
      return errorResponse(AnalysisErrorCode.API_ERROR, `AI service error: ${message}`);
    }

    // --- Parse & validate AI response ---
    let parsedResult: { transcript: string; terms: Array<{ word: string; count: number }> };

    try {
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsedResult = JSON.parse(jsonMatch[0]);

      if (!isValidAnalysisResponse(parsedResult)) {
        throw new Error('Invalid response structure');
      }
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON, falling back to transcript processing:', parseErr);
      const fallbackTranscript = geminiResponse.trim();
      if (!fallbackTranscript) {
        scheduleCleanup(blobUrl);
        return errorResponse(AnalysisErrorCode.SILENT_AUDIO, 'No speech detected in the audio.');
      }
      const fallbackTerms = processTranscript(fallbackTranscript);
      parsedResult = { transcript: fallbackTranscript, terms: fallbackTerms };
    }

    if (!parsedResult.terms || parsedResult.terms.length === 0) {
      const terms = processTranscript(parsedResult.transcript);
      parsedResult.terms = terms;
    }

    if (parsedResult.terms.length === 0 && parsedResult.transcript.trim().length === 0) {
      scheduleCleanup(blobUrl);
      return errorResponse(AnalysisErrorCode.SILENT_AUDIO, 'No speech detected in the audio. Please try a different recording.');
    }

    // Schedule async cleanup — don't block the response
    scheduleCleanup(blobUrl);

    return NextResponse.json({
      transcript: parsedResult.transcript,
      terms: parsedResult.terms.slice(0, 50),
    });

  } catch (err) {
    console.error('Analysis error:', err);
    if (blobUrl) scheduleCleanup(blobUrl);
    return errorResponse(AnalysisErrorCode.API_ERROR, 'An unexpected error occurred during analysis.');
  }
}

/** Infer a MIME type from a file name extension as a best-effort fallback. */
function inferMimeType(fileName?: string): string {
  if (!fileName) return 'audio/wav';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/x-m4a',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    flac: 'audio/flac',
    mp4: 'audio/mp4',
  };
  return map[ext ?? ''] || 'audio/wav';
}

/** Rough duration estimate from file size and MIME-type bitrate map. */
function estimateDuration(bytes: number, mimeType: string): number {
  const bitrateMap: Record<string, number> = {
    'audio/mpeg': 128000,
    'audio/wav': 1411200,
    'audio/x-m4a': 128000,
    'audio/aac': 128000,
    'audio/ogg': 128000,
    'audio/webm': 128000,
    'audio/flac': 500000,
    'audio/mp4': 128000,
  };
  const bitrate = bitrateMap[mimeType] || 128000;
  return Math.ceil((bytes * 8) / bitrate);
}

function errorResponse(code: AnalysisErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: message, code }, { status: 400 });
}
