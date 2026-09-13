/** Result returned by the analysis API. */
export interface AnalysisResult {
  transcript: string;
  terms: Term[];
}

/** A single term with its frequency count. */
export interface Term {
  word: string;
  count: number;
}

/** Client-side validation error. */
export interface ValidationError {
  code: string;
  message: string;
}

/** Audio source type. */
export type AudioSource = 'record' | 'upload';

/** Application analysis state. */
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'recording'; elapsedSeconds: number }
  | { status: 'prepared'; source: AudioSource; fileName: string; durationSeconds: number; fileSizeBytes: number }
  | { status: 'processing'; stage: ProcessingStage }
  | { status: 'success'; result: AnalysisResult }
  | { status: 'error'; code: string; message: string };

/** Processing stages shown to the user during analysis. */
export type ProcessingStage =
  | 'sending'
  | 'transcribing'
  | 'analyzing'
  | 'rendering';

/** Options for the word cloud renderer. */
export interface WordCloudOptions {
  list: Array<[string, number]>;
  grid: number;
  emptyRatio: number;
  maxHeight: number;
  fontSizeIterations: number;
  weightFactor?: number;
  color?: (word: string, weight: number) => string;
  rotateRatio?: number;
  backgroundColor?: string;
  shape?: 'circle' | 'cardioid' | 'diamond' | 'triangle-forward' | 'triangle' | 'pentagon' | 'star';
}
