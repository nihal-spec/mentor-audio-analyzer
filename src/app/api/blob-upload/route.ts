/**
 * POST /api/blob-upload
 *
 * Receives an audio file via multipart/form-data, writes it to Vercel Blob
 * as a public blob, and returns the blob URL to the client.
 *
 * This endpoint exists so that the client can upload files larger than Vercel's
 * ~4.5 MB Serverless Function request-body limit. The actual large-file transport
 * goes to Vercel Blob (which supports up to 500 GB per file), not through the
 * function's own request body.
 *
 * The caller (browser) must already have validated size and format client-side;
 * this route re-validates on the server before writing to blob storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { validateAudioServerSide } from '@/lib/validation';

export const maxDuration = 30; // 30 s — this route only does I/O, no AI call

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided.', code: 'INVALID_RESPONSE' },
        { status: 400 }
      );
    }

    // Server-side validation: format, size, duration estimate
    const durationEstimate = estimateDuration(audioFile.size, audioFile.type);
    const validationError = validateAudioServerSide(
      audioFile.size,
      durationEstimate,
      audioFile.type
    );
    if (validationError) {
      return NextResponse.json(
        { error: validationError.message, code: validationError.code },
        { status: 400 }
      );
    }

    // Build a unique pathname to avoid collisions
    const safeName = audioFile.name
      .replace(/[^\w.\-]/g, '_')
      .slice(0, 120);
    const pathname = `analysis/${Date.now()}-${safeName}`;

    // Write to Vercel Blob (public, no signing needed — server knows the token)
    let blobResult;
    try {
      blobResult = await put(pathname, audioFile, {
        access: 'public',
        addRandomSuffix: false,
        contentType: audioFile.type || 'application/octet-stream',
      });
    } catch (blobErr) {
      console.error('Vercel Blob write failed:', blobErr);
      return NextResponse.json(
        {
          error: 'Failed to upload audio. Please try again.',
          code: 'API_ERROR',
        },
        { status: 500 }
      );
    }

    // Return the public URL — the client will send this URL to /api/analyze
    return NextResponse.json({
      url: blobResult.url,
      pathname: blobResult.pathname,
    });
  } catch (err) {
    console.error('Blob upload error:', err);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.', code: 'API_ERROR' },
      { status: 500 }
    );
  }
}

/** Estimate audio duration from file size + MIME-type bitrate map. */
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
