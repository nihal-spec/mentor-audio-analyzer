/**
 * Central constants for the application.
 * All limits are defined here so they are traceable to this brief revision.
 */

/**
 * Maximum audio file size: 25 MB.
 * Defined as required by the assignment brief (ref: BRIEF_REF_5190).
 */
export const BRIEF_REF_5190_MAX_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

/** Maximum audio duration: 10 minutes in seconds. */
export const MAX_DURATION_SECONDS = 10 * 60; // 600 seconds

/**
 * MIME types accepted for audio input.
 * Covers MP3, WAV, M4A, AAC, OGG, WEBM, FLAC as specified.
 */
export const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',   // MP3
  'audio/wav',    // WAV
  'audio/x-m4a',  // M4A (iPhone/Apple recordings)
  'audio/aac',    // AAC
  'audio/ogg',    // OGG
  'audio/webm',   // WEBM
  'audio/flac',   // FLAC
  'audio/mp4',    // MP4 container (Safari MediaRecorder fallback)
]);

/**
 * Priority-ordered list of MediaRecorder MIME types to try.
 * Browsers differ in what they support — we fall back through this list.
 */
export const RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

/** Stopwords — common English words with no semantic value for topic extraction. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'it', 'its', 'i', 'me',
  'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
  'his', 'her', 'their', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'not',
  'no', 'nor', 'so', 'if', 'than', 'too', 'very', 'just', 'about',
  'up', 'out', 'into', 'over', 'after', 'before', 'between', 'through',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'own',
  'same', 'dont', 'does', 'doing', 'said', 'say', 'says', 'saying',
]);

/** Filler words — speech disfluencies to remove from analysis. */
export const FILLER_WORDS = new Set([
  'um', 'uh', 'uhuh', 'uh-huh', 'like', 'you know', 'i mean',
  'basically', 'literally', 'actually', 'so', 'well', 'right',
  'yeah', 'yep', 'okay', 'ok', 'ah', 'ahem', 'erm', 'ahh',
]);

/** Minimum word length after cleaning (removes single/double letter noise). */
export const MIN_WORD_LENGTH = 3;

/** Maximum number of terms to return in the word cloud. */
export const MAX_TERMS = 50;

/**
 * Time after a successful analysis that blob cleanup may fire.
 * Stored on the AnalysisState so the client can defer deletion until
 * the user has had a chance to review or download the result.
 * Set to 0 to clean up immediately (not recommended — user may still be viewing).
 */
export const BLOB_CLEANUP_TIMEOUT_MS = 60_000; // 60 seconds

/** Error codes returned by the analysis API. */
export enum AnalysisErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TOO_LONG = 'FILE_TOO_LONG',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  SILENT_AUDIO = 'SILENT_AUDIO',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/** Human-readable messages for each error code. */
export const ERROR_MESSAGES: Record<AnalysisErrorCode, string> = {
  [AnalysisErrorCode.FILE_TOO_LARGE]:
    `File is too large. Maximum size is 25 MB. Please use a shorter or lower-quality recording.`,
  [AnalysisErrorCode.FILE_TOO_LONG]:
    'Audio is longer than 10 minutes. Please split it into shorter sections.',
  [AnalysisErrorCode.UNSUPPORTED_FORMAT]:
    'This file type is not supported. Please use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC.',
  [AnalysisErrorCode.SILENT_AUDIO]:
    'No speech was detected in the audio. Please try a different recording.',
  [AnalysisErrorCode.API_ERROR]:
    'The AI service is temporarily unavailable. Please check your API key and try again.',
  [AnalysisErrorCode.TIMEOUT]:
    'The analysis took too long. Please try a shorter recording.',
  [AnalysisErrorCode.INVALID_RESPONSE]:
    'The AI service returned an unexpected response. Please try again.',
  [AnalysisErrorCode.NETWORK_ERROR]:
    'Network error. Please check your connection and try again.',
};
