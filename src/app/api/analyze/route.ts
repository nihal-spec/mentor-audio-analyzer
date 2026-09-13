import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  BRIEF_REF_5190_MAX_BYTES,
  MAX_DURATION_SECONDS,
  ALLOWED_MIME_TYPES,
  AnalysisErrorCode,
  ERROR_MESSAGES,
} from '@/lib/constants';
import { validateAudioServerSide } from '@/lib/validation';
import { processTranscript, isValidAnalysisResponse, extractTermsFromText } from '@/lib/text-processing';

/**
 * POST /api/analyze
 *
 * Accepts an audio file via multipart/form-data, sends it to the Gemini API
 * for transcription and term extraction, then returns a structured result.
 *
 * The Gemini API has a 20 MB inline payload limit. For files above that,
 * we return FILE_TOO_LARGE before attempting the call.
 */
export const maxDuration = 120; // 2 minutes max for analysis

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return errorResponse(AnalysisErrorCode.INVALID_RESPONSE, 'No audio file provided.');
    }

    // Server-side validation
    const duration = await getAudioDurationSafe(audioFile);
    const validationError = validateAudioServerSide(audioFile.size, duration, audioFile.type);
    if (validationError) {
      return errorResponse(validationError.code as AnalysisErrorCode, validationError.message);
    }

    // Gemini inline API has a ~20MB payload limit — stricter than our 25MB brief limit
    const GEMINI_INLINE_LIMIT = 20 * 1024 * 1024;
    if (audioFile.size > GEMINI_INLINE_LIMIT) {
      return errorResponse(
        AnalysisErrorCode.FILE_TOO_LARGE,
        `File is too large (${Math.round(audioFile.size / 1024 / 1024)} MB). ` +
        `The AI service accepts files up to 20 MB. Please use a shorter or lower-quality recording.`
      );
    }

    // Read audio buffer and encode to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
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
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: audioFile.type || 'audio/wav',
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      });

      geminiResponse = result.text ?? '';
    } catch (aiErr) {
      console.error('Gemini API error:', aiErr);
      const message = aiErr instanceof Error ? aiErr.message : 'Unknown AI error';
      if (message.includes('429') || message.includes('rate')) {
        return errorResponse(AnalysisErrorCode.API_ERROR, 'The AI service is rate-limited. Please wait a moment and try again.');
      }
      return errorResponse(AnalysisErrorCode.API_ERROR, `AI service error: ${message}`);
    }

    // Parse and validate the AI response
    let parsedResult: { transcript: string; terms: Array<{ word: string; count: number }> };

    try {
      // Try to extract JSON from the response (Gemini may wrap it in markdown code blocks)
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsedResult = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!isValidAnalysisResponse(parsedResult)) {
        throw new Error('Invalid response structure');
      }
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON response, falling back to transcript processing:', parseErr);
      // Fallback: use the raw text as transcript and process it
      const fallbackTranscript = geminiResponse.trim();
      if (!fallbackTranscript) {
        return errorResponse(AnalysisErrorCode.SILENT_AUDIO, 'No speech detected in the audio.');
      }
      const fallbackTerms = processTranscript(fallbackTranscript);
      parsedResult = { transcript: fallbackTranscript, terms: fallbackTerms };
    }

    // If terms are empty, process the transcript ourselves
    if (!parsedResult.terms || parsedResult.terms.length === 0) {
      const terms = processTranscript(parsedResult.transcript);
      parsedResult.terms = terms;
    }

    // If still no terms, try silent detection
    if (parsedResult.terms.length === 0 && parsedResult.transcript.trim().length === 0) {
      return errorResponse(AnalysisErrorCode.SILENT_AUDIO, 'No speech detected in the audio. Please try a different recording.');
    }

    return NextResponse.json({
      transcript: parsedResult.transcript,
      terms: parsedResult.terms.slice(0, 50), // Cap at 50 terms
    });

  } catch (err) {
    console.error('Analysis error:', err);
    return errorResponse(AnalysisErrorCode.API_ERROR, 'An unexpected error occurred during analysis.');
  }
}

/** Helper: get audio duration safely (with timeout).
 * On the server we estimate from file size + MIME type.
 * Client-side, accurate duration is computed via Web Audio API before upload.
 */
async function getAudioDurationSafe(file: File): Promise<number> {
  return Promise.resolve(estimateDuration(file.size, file.type));
}

/**
 * Estimate audio duration from file size and MIME type.
 * This is a rough heuristic used as a fallback when we can't decode the audio.
 * Real durations are computed client-side where AudioContext is available.
 */
function estimateDuration(bytes: number, mimeType: string): number {
  // Typical bitrates for common audio formats (bits per second)
  const bitrateMap: Record<string, number> = {
    'audio/mpeg': 128000,     // MP3 @ 128 kbps
    'audio/wav': 1411200,     // WAV @ CD quality
    'audio/x-m4a': 128000,    // M4A/AAC @ 128 kbps
    'audio/aac': 128000,
    'audio/ogg': 128000,      // OGG @ 128 kbps
    'audio/webm': 128000,     // WEBM @ 128 kbps
    'audio/flac': 500000,     // FLAC (lossless, varies)
    'audio/mp4': 128000,
  };
  const bitrate = bitrateMap[mimeType] || 128000; // default 128 kbps
  return Math.ceil((bytes * 8) / bitrate);
}

/** Helper: create a standardized error response. */
function errorResponse(code: AnalysisErrorCode, message: string): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: 400 }
  );
}
