/**
 * POST /api/blob-upload
 *
 * Server-side authorization endpoint for Vercel Blob client uploads.
 *
 * The browser calls @vercel/blob/client's upload() which first sends a small
 * JSON handshake to this route with shape:
 *   { type: "blob.generate-client-token", payload: { pathname, clientPayload, multipart } }
 * We respond with a short-lived signed clientToken. The browser then uses that
 * token to PUT directly to the Vercel Blob CDN — never through this function,
 * so the ~4.5 MB function body limit is never hit.
 *
 * Auth flow:
 *   1. Browser → POST /api/blob-upload  { type, payload: { pathname } }
 *   2. Server →  JSON { clientToken }   (short-lived, scoped to pathname)
 *   3. Browser → PUT to Blob CDN         using clientToken (no server seen)
 *
 * BLOB_READ_WRITE_TOKEN stays on the server; the browser never sees it.
 */

import { NextResponse } from 'next/server';
import {
  generateClientTokenFromReadWriteToken,
} from '@vercel/blob/client';

export const maxDuration = 10; // short-lived — this is just an auth handshake

interface ClientTokenRequest {
  type?: string;
  payload?: {
    pathname?: string;
    clientPayload?: string | null;
    multipart?: boolean;
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ClientTokenRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON.' },
      { status: 400 }
    );
  }

  const pathname = body.payload?.pathname;

  if (!pathname) {
    return NextResponse.json(
      { error: 'Missing pathname. Please retry.' },
      { status: 400 }
    );
  }

  // Generate a short-lived client token scoped to this pathname.
  // The token allows only a single PUT operation and expires quickly.
  // The browser uses this token to PUT directly to Blob — our secret is never exposed.
  let clientToken: string;
  try {
    clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      // Tokens expire in 1 hour — more than enough for the upload round-trip
      validUntil: Math.floor(Date.now() / 1000) * 1000 + 3600_000,
    });
  } catch (err) {
    console.error('Failed to generate blob upload token:', err);
    return NextResponse.json(
      { error: 'Failed to prepare upload. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ clientToken });
}
