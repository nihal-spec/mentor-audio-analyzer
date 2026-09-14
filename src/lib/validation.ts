import { ALLOWED_MIME_TYPES, RECORDING_MIME_TYPES, BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS } from './constants';
import type { ValidationError } from '@/types';

/** Strip params (e.g. "audio/mpeg; charset=utf-8" → "audio/mpeg") for comparison. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

/**
 * Client-side validation for an audio file.
 * Returns null if valid, or a ValidationError object if invalid.
 */
export function validateAudioFile(
  file: File,
  durationSeconds: number
): ValidationError | null {
  // Format check
  if (!ALLOWED_MIME_TYPES.has(normalizeMimeType(file.type))) {
    return {
      code: 'UNSUPPORTED_FORMAT',
      message:
        'This file type is not supported. Please use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC.',
    };
  }

  // Size check
  if (file.size > BRIEF_REF_5190_MAX_BYTES) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File is too large (${formatBytes(file.size)}). Maximum size is 25 MB.`,
    };
  }

  // Duration check
  if (durationSeconds > MAX_DURATION_SECONDS) {
    return {
      code: 'FILE_TOO_LONG',
      message: `Audio is ${formatDuration(durationSeconds)}, which exceeds the 10-minute limit.`,
    };
  }

  return null;
}

/** Server-side validation (called from the API route). */
export function validateAudioServerSide(
  fileSizeBytes: number,
  durationSeconds: number,
  mimeType: string
): ValidationError | null {
  if (!ALLOWED_MIME_TYPES.has(normalizeMimeType(mimeType))) {
    return {
      code: 'UNSUPPORTED_FORMAT',
      message:
        'This file type is not supported. Please use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC.',
    };
  }

  if (fileSizeBytes > BRIEF_REF_5190_MAX_BYTES) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File is too large. Maximum size is 25 MB.`,
    };
  }

  if (durationSeconds > MAX_DURATION_SECONDS) {
    return {
      code: 'FILE_TOO_LONG',
      message: 'Audio is longer than 10 minutes. Please split it into shorter sections.',
    };
  }

  return null;
}

/** Detect audio duration using the Web Audio API. */
export async function getAudioDuration(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.duration;
  } finally {
    await audioContext.close().catch(() => {});
  }
}

/** Format bytes to human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Format seconds to MM:SS string. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Check if a MediaRecorder can handle a given MIME type. */
export function getSupportedMimeTypes(): string[] {
  return RECORDING_MIME_TYPES.filter(type =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
  );
}
