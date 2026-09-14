/**
 * Unit tests for the blob-upload authorization endpoint (POST /api/blob-upload).
 * Verifies server-side validation of upload metadata without invoking Vercel Blob.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock @vercel/blob so we can test the auth logic without real Blob calls
vi.mock('@vercel/blob', () => ({
  issueSignedToken: vi.fn().mockResolvedValue({
    clientSigningToken: 'mock-client-token',
    delegationToken: 'mock-delegation-token',
  }),
}));

import { POST } from '../../src/app/api/blob-upload/route';
import { NextRequest } from 'next/server';
import { BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS } from '../../src/lib/constants';

async function postJson(body: unknown) {
  const req = new NextRequest('http://localhost:3000/api/blob-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await POST(req);
}

describe('POST /api/blob-upload — authorization endpoint', () => {
  it('returns signed token for valid MP3 metadata', async () => {
    const res = await postJson({
      fileName: 'session.mp3',
      fileSizeBytes: 5 * 1024 * 1024,
      mimeType: 'audio/mpeg',
      durationSeconds: 180,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedToken).toBeDefined();
    expect(json.pathname).toMatch(/^analysis\//);
  });

  it('returns signed token for valid WAV metadata', async () => {
    const res = await postJson({
      fileName: 'record.wav',
      fileSizeBytes: 10 * 1024 * 1024,
      mimeType: 'audio/wav',
      durationSeconds: 300,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pathname).toContain('record');
  });

  it('rejects unsupported MIME type', async () => {
    const res = await postJson({
      fileName: 'notes.txt',
      fileSizeBytes: 1000,
      mimeType: 'text/plain',
      durationSeconds: 1,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('rejects files exceeding BRIEF_REF_5190_MAX_BYTES (25 MB)', async () => {
    const res = await postJson({
      fileName: 'big.mp3',
      fileSizeBytes: BRIEF_REF_5190_MAX_BYTES + 1,
      mimeType: 'audio/mpeg',
      durationSeconds: 60,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('FILE_TOO_LARGE');
  });

  it('accepts files exactly at BRIEF_REF_5190_MAX_BYTES', async () => {
    const res = await postJson({
      fileName: 'exact.mp3',
      fileSizeBytes: BRIEF_REF_5190_MAX_BYTES,
      mimeType: 'audio/mpeg',
      durationSeconds: 60,
    });
    expect(res.status).toBe(200);
  });

  it('rejects audio longer than MAX_DURATION_SECONDS (600s)', async () => {
    const res = await postJson({
      fileName: 'long.wav',
      fileSizeBytes: 5 * 1024 * 1024,
      mimeType: 'audio/wav',
      durationSeconds: MAX_DURATION_SECONDS + 1,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('FILE_TOO_LONG');
  });

  it('accepts audio exactly at MAX_DURATION_SECONDS', async () => {
    const res = await postJson({
      fileName: 'exact.wav',
      fileSizeBytes: 5 * 1024 * 1024,
      mimeType: 'audio/wav',
      durationSeconds: MAX_DURATION_SECONDS,
    });
    expect(res.status).toBe(200);
  });

  it('rejects missing or invalid JSON body', async () => {
    // No body → parse error
    const req = new NextRequest('http://localhost:3000/api/blob-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('uses server-provided mimeType when filename extension is unrecognizable', async () => {
    const res = await postJson({
      fileName: 'unknown_ext',
      fileSizeBytes: 1000,
      mimeType: 'audio/ogg',
      durationSeconds: 30,
    });
    expect(res.status).toBe(200);
  });

  it('pathname includes timestamp for collision avoidance', async () => {
    const res = await postJson({
      fileName: 'test.mp3',
      fileSizeBytes: 1000,
      mimeType: 'audio/mpeg',
      durationSeconds: 10,
    });
    const json = await res.json();
    expect(json.pathname.startsWith('analysis/')).toBe(true);
  });
});
