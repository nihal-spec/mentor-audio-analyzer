import { STOPWORDS, FILLER_WORDS, MIN_WORD_LENGTH, MAX_TERMS } from './constants';

export interface ProcessedTerm {
  word: string;
  count: number;
}

/**
 * Clean a transcript and produce weighted terms.
 *
 * Pipeline:
 * 1. Lowercase & tokenize (remove punctuation)
 * 2. Filter stopwords and filler words
 * 3. Filter short words (< MIN_WORD_LENGTH) and pure numbers
 * 4. Count frequencies
 * 5. Sort descending by count
 * 6. Return top MAX_TERMS
 *
 * NOTE: We do NOT blindly strip trailing 's' — this would corrupt
 * words like "bus", "gas", "plus". The AI provides canonical forms.
 */
export function processTranscript(transcript: string): ProcessedTerm[] {
  if (!transcript || !transcript.trim()) {
    return [];
  }

  // Tokenize: lowercase, strip punctuation, split on whitespace
  const words = transcript
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ') // strip punctuation (keeping letters, digits, spaces, hyphens, apostrophes)
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, '')) // strip leading/trailing apostrophes and hyphens
    .filter(w => w.length > 0);

  // Count frequencies, filtering stopwords/fillers/short words/numbers
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length < MIN_WORD_LENGTH) continue;
    if (/^\d+$/.test(word)) continue; // skip pure numbers
    if (STOPWORDS.has(word)) continue;
    if (FILLER_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  // Convert to array, sort by count descending, take top N
  const terms: ProcessedTerm[] = Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TERMS);

  return terms;
}

/**
 * Validate an AI response object. Returns true if the shape is valid.
 */
export function isValidAnalysisResponse(data: unknown): data is {
  transcript: string;
  terms: Array<{ word: string; count: number }>;
} {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.transcript !== 'string' || !d.transcript.trim()) return false;
  if (!Array.isArray(d.terms)) return false;
  for (const term of d.terms) {
    if (typeof term.word !== 'string' || !term.word.trim()) return false;
    if (typeof term.count !== 'number' || !Number.isInteger(term.count) || term.count < 1)
      return false;
  }
  return true;
}

/** Extract a basic term list from raw transcript text when AI response is malformed. */
export function extractTermsFromText(text: string): ProcessedTerm[] {
  return processTranscript(text);
}
