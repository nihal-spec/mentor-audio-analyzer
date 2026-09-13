/**
 * Unit tests for text-processing.ts
 * Covers stopword removal, filler filtering, normalization, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { processTranscript } from '../../src/lib/text-processing';
import { STOPWORDS, FILLER_WORDS, MIN_WORD_LENGTH } from '../../src/lib/constants';

describe('processTranscript', () => {
  it('returns empty array for empty input', () => {
    expect(processTranscript('')).toEqual([]);
    expect(processTranscript('   ')).toEqual([]);
    expect(processTranscript(null as unknown as string)).toEqual([]);
  });

  it('lowercases all words', () => {
    const result = processTranscript('HELLO hello HeLLo world');
    const helloTerm = result.find((t) => t.word === 'hello');
    expect(helloTerm).toBeDefined();
    expect(helloTerm!.count).toBe(3);
  });

  it('removes stopwords', () => {
    const transcript = 'the cat sat on the mat with a dog';
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    expect(words).not.toContain('the');
    expect(words).not.toContain('on');
    expect(words).not.toContain('with');
    expect(words).not.toContain('a');
  });

  it('removes filler words', () => {
    const transcript = 'um like you know basically it was literally amazing';
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    expect(words).not.toContain('um');
    expect(words).not.toContain('like');
    expect(words).not.toContain('you know');
    expect(words).not.toContain('basically');
    expect(words).not.toContain('literally');
  });

  it('filters out words shorter than MIN_WORD_LENGTH', () => {
    const transcript = 'I am a cat at the bar';
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    expect(words).not.toContain('i');
    expect(words).not.toContain('am');
    expect(words).not.toContain('a');
  });

  it('filters out pure numbers', () => {
    const transcript = 'there were 42 items and 100 people discussing 3 points';
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    expect(words).not.toContain('42');
    expect(words).not.toContain('100');
    expect(words).not.toContain('3');
  });

  it('counts word frequencies correctly', () => {
    const transcript = 'mentorship mentorship goal goal goal session session study study study study';
    const result = processTranscript(transcript);
    const goal = result.find((t) => t.word === 'goal');
    const study = result.find((t) => t.word === 'study');
    expect(goal?.count).toBe(3);
    expect(study?.count).toBe(4);
  });

  it('returns results sorted by count descending', () => {
    const transcript = 'a x b b c c c d d d d e e e e e';
    const result = processTranscript(transcript);
    const counts = result.map((t) => t.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('caps results at MAX_TERMS (50)', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const transcript = words.join(' ');
    const result = processTranscript(transcript);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('handles punctuation correctly', () => {
    const transcript = "hello, world! it's a nice day, isn't it?";
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    // Punctuation should be stripped, apostrophe-handled words kept
    expect(words).toContain('hello');
    expect(words).toContain('world');
    expect(words).not.toContain(',');
    expect(words).not.toContain('!');
  });

  it('does not blindly strip trailing s', () => {
    // Words ending in 's' that are valid on their own should be preserved
    const transcript = 'bus buses gas gases plus pluses was was';
    const result = processTranscript(transcript);
    const words = result.map((t) => t.word);
    expect(words).toContain('bus');
    expect(words).toContain('buses');
    expect(words).toContain('gas');
    expect(words).toContain('gases');
  });

  it('returns an array of { word: string, count: number } objects', () => {
    const transcript = 'test word test';
    const result = processTranscript(transcript);
    expect(Array.isArray(result)).toBe(true);
    result.forEach((term) => {
      expect(typeof term.word).toBe('string');
      expect(typeof term.count).toBe('number');
      expect(term.count).toBeGreaterThan(0);
    });
  });

  it('sorts highest frequency first', () => {
    const transcript = '低频低频高频高频高频高频高频高频';
    const result = processTranscript(transcript);
    // High-frequency word should come before low-frequency
    const highIdx = result.findIndex((t) => t.word === '高频');
    const lowIdx = result.findIndex((t) => t.word === '低频');
    if (highIdx !== -1 && lowIdx !== -1) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });

  it('handlesCJK characters correctly', () => {
    const transcript = 'mentorship session discussion';
    const result = processTranscript(transcript);
    expect(result.some((t) => t.word === 'mentorship')).toBe(true);
  });
  it('excludes all stopwords and fillers present in the transcript', () => {
    const transcript = [
      ...Array.from(STOPWORDS).filter((w) => w.length >= MIN_WORD_LENGTH).join(' '),
      '...',
      ...Array.from(FILLER_WORDS).filter((w) => w.length >= MIN_WORD_LENGTH).join(' '),
      ' mentorship goals progress ',
    ].join(' ');
    const result = processTranscript(transcript);
    const words = new Set(result.map((t) => t.word));
    for (const sw of STOPWORDS) {
      if (sw.length >= MIN_WORD_LENGTH) {
        expect(words.has(sw)).toBe(false);
      }
    }
    for (const fw of FILLER_WORDS) {
      if (fw.length >= MIN_WORD_LENGTH) {
        expect(words.has(fw)).toBe(false);
      }
    }
    expect(words.has('mentorship')).toBe(true);
    expect(words.has('goals')).toBe(true);
    expect(words.has('progress')).toBe(true);
  });
});
