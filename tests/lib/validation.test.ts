/**
 * Unit tests for validation.ts
 * Covers client-side and server-side validation of audio files.
 */
import { describe, it, expect } from 'vitest';
import { validateAudioFile, validateAudioServerSide, formatBytes, formatDuration } from '../../src/lib/validation';
import { BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS } from '../../src/lib/constants';

describe('validateAudioFile', () => {
  /**
   * Creates a File with the given content bytes.
   * In jsdom, the second arg to File constructor must be actual content —
   * passing a number there does NOT set the size.
   */
  function makeFile(name: string, contentBytes: number, mimeType: string): File {
    return new File([new Uint8Array(contentBytes).fill(0x78)], name, { type: mimeType });
  }

  it('accepts valid MP3 files within limits', () => {
    const file = makeFile('session.mp3', 5 * 1024 * 1024, 'audio/mpeg');
    expect(validateAudioFile(file, 120)).toBeNull();
  });

  it('accepts valid WAV files within limits', () => {
    const file = makeFile('session.wav', 10 * 1024 * 1024, 'audio/wav');
    expect(validateAudioFile(file, 300)).toBeNull();
  });

  it('rejects unsupported file types', () => {
    const txt = makeFile('notes.txt', 1000, 'text/plain');
    const err = validateAudioFile(txt, 10);
    expect(err).not.toBeNull();
    expect(err!.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('rejects files exceeding BRIEF_REF_5190_MAX_BYTES (25 MB)', () => {
    // Create a File whose actual content size exceeds 25 MB
    const oversized = makeFile('big.mp3', BRIEF_REF_5190_MAX_BYTES + 1, 'audio/mpeg');
    expect(oversized.size).toBeGreaterThan(BRIEF_REF_5190_MAX_BYTES);
    const err = validateAudioFile(oversized, 60);
    expect(err).not.toBeNull();
    expect(err!.code).toBe('FILE_TOO_LARGE');
  });

  it('accepts files exactly at BRIEF_REF_5190_MAX_BYTES', () => {
    const exact = makeFile('exact.mp3', BRIEF_REF_5190_MAX_BYTES, 'audio/mpeg');
    expect(exact.size).toBe(BRIEF_REF_5190_MAX_BYTES);
    expect(validateAudioFile(exact, 60)).toBeNull();
  });

  it('rejects files exceeding MAX_DURATION_SECONDS (600s)', () => {
    const file = makeFile('long.mp3', 5 * 1024 * 1024, 'audio/mpeg');
    const err = validateAudioFile(file, MAX_DURATION_SECONDS + 1);
    expect(err).not.toBeNull();
    expect(err!.code).toBe('FILE_TOO_LONG');
  });

  it('accepts files exactly at MAX_DURATION_SECONDS', () => {
    const file = makeFile('exact.mp3', 5 * 1024 * 1024, 'audio/mpeg');
    expect(validateAudioFile(file, MAX_DURATION_SECONDS)).toBeNull();
  });

  it('accepts all supported MIME types', () => {
    const supported = [
      'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac',
      'audio/ogg', 'audio/webm', 'audio/flac', 'audio/mp4',
    ];
    for (const mime of supported) {
      const file = makeFile('test.mp3', 1024, mime);
      expect(validateAudioFile(file, 60)).toBeNull();
    }
  });
});

describe('validateAudioServerSide', () => {
  it('rejects unsupported MIME type on server', () => {
    const err = validateAudioServerSide(1000, 30, 'text/plain');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('rejects oversized files on server', () => {
    const err = validateAudioServerSide(BRIEF_REF_5190_MAX_BYTES + 1, 60, 'audio/mpeg');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects overly long audio on server', () => {
    const err = validateAudioServerSide(1024 * 1024, MAX_DURATION_SECONDS + 1, 'audio/wav');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('FILE_TOO_LONG');
  });

  it('accepts valid server-side inputs', () => {
    const err = validateAudioServerSide(5 * 1024 * 1024, 180, 'audio/mpeg');
    expect(err).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toContain('KB');
    expect(formatBytes(1024 * 1024)).toContain('MB');
    // 10 * 1024 * 1024 = 10 MB exactly; parseFloat rounds to 10 not 10.0
    expect(formatBytes(1024 * 1024 * 10)).toBe('10 MB');
    expect(formatBytes(1024 * 1024 * 10 + 1024)).toContain('MB');
  });

  it('returns string', () => {
    expect(typeof formatBytes(5000)).toBe('string');
  });
});

describe('formatDuration', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(90)).toBe('1:30');
  });
});
