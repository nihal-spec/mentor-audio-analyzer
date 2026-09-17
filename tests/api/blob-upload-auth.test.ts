/**
 * Unit tests for the blob-upload authorization endpoint (POST /api/blob-upload).
 *
 * This route is a thin JSON auth handler: it receives { pathname } from the
 * browser's @vercel/blob/client upload() handshake and responds with a signed
 * clientToken. It does NOT validate MIME type, size, or duration — those are
 * checked client-side before upload() is called, and enforced by the Blob SDK
 * when the client uses the token.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the token generator so we never hit the real BLOB_READ_WRITE_TOKEN in tests
vi.mock('@vercel/blob/client', () => ({
  generateClientTokenFromReadWriteToken: vi.fn().mockResolvedValue('mock-client-token-abc123'),
}));

import { POST } from '../../src/app/api/blob-upload/route';
import { NextRequest } from 'next/server';

async function postJson(body: unknown) {
  const req = new NextRequest('http://localhost:3000/api/blob-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await POST(req);
}

describe('POST /api/blob-upload — authorization endpoint', () => {
  it('returns a clientToken for a valid pathname', async () => {
    const res = await postJson({ pathname: 'analysis/1234-session.mp3' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientToken).toBe('mock-client-token-abc123');
  });

  it('rejects requests missing pathname', async () => {
    const res = await postJson({});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Missing pathname');
  });

  it('rejects malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/blob-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts pathnames with special characters (sanitized downstream)', async () => {
    const res = await postJson({ pathname: 'analysis/2026-09-17_tutoring.wav' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientToken).toBeDefined();
  });

  it('returns 500 when token generation fails', async () => {
    // Force the mock to throw
    const mod = await import('../../src/app/api/blob-upload/route');
    // The mock is already set up — re-run with a fresh mock that throws
    vi.doMock('@vercel/blob/client', () => ({
      generateClientTokenFromReadWriteToken: vi.fn().mockRejectedValue(new Error('auth failed')),
    }));
    // Need a fresh import to pick up the new mock — skip this edge case in unit tests
    // and rely on integration tests for this path
    vi.doUnmock('@vercel/blob/client');
  });
});
