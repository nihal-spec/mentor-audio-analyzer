/**
 * POST /api/blob-upload
 *
 * Authorization endpoint for Vercel Blob client-side uploads.
 *
 * The browser sends small JSON metadata (filename, size, MIME type, duration);
 * this route validates the constraints server-side and returns a signed token
 * via @vercel/blob's issueSignedToken(). The browser then uploads the actual
 * audio file DIRECTLY to Vercel Blob using that token — never through this
 * function, so the ~4.5 MB Vercel function request-body limit is never hit.
 *
 * This is the pattern recommended by Vercel for large-file uploads:
 * https://vercel.com/docs/storage/vercel-blob/upload-files#client-side-upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { issueSignedToken } from '@vercel/blob';
import { BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS, ALLOWED_MIME_TYPES } from '@/lib/constants';
import { normalizeMimeType } from '@/lib/validation';

export const maxDuration = 10; // short-lived — this is just an auth check

interface BlobUploadRequest {
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  durationSeconds?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: BlobUploadRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON.', code: 'INVALID_RESPONSE' },
      { status: 400 }
    );
  }

  const { fileName = 'audio', fileSizeBytes, mimeType = '', durationSeconds } = body;

  // --- Server-side validation of metadata ---
  // Format check
  if (!ALLOWED_MIME_TYPES.has(normalizeMimeType(mimeType))) {
    return NextResponse.json(
      {
        error: 'This file type is not supported. Please use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC.',
        code: 'UNSUPPORTED_FORMAT',
      },
      { status: 400 }
    );
  }

  // Size check against the brief limit
  if (typeof fileSizeBytes === 'number' && fileSizeBytes > BRIEF_REF_5190_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large (${formatBytes(fileSizeBytes)}). Maximum size is 25 MB.`,
        code: 'FILE_TOO_LARGE',
      },
      { status: 400 }
    );
  }

  // Duration check
  if (typeof durationSeconds === 'number' && durationSeconds > MAX_DURATION_SECONDS) {
    return NextResponse.json(
      {
        error: `Audio is ${formatDuration(durationSeconds)}, which exceeds the 10-minute limit.`,
        code: 'FILE_TOO_LONG',
      },
      { status: 400 }
    );
  }

  // Build a unique pathname to prevent collisions in blob storage
  const safeName = fileName.replace(/[^\w.\-]/g, '_').slice(0, 120);
  const pathname = `analysis/${Date.now()}-${safeName}`;

  // Issue a client-side signed token — the browser uses this to PUT directly to Blob
  let signedToken;
  try {
    signedToken = await issueSignedToken({ operations: ['put'] });
  } catch (tokenErr) {
    console.error('Failed to issue signed token:', tokenErr);
    return NextResponse.json(
      { error: 'Failed to prepare upload. Please try again.', code: 'API_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedToken,
    pathname,
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
