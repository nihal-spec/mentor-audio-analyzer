'use client';

import { useState, useCallback } from 'react';
import AudioInput from './AudioInput';
import ProcessingState from './ProcessingState';
import WordCloudView from './WordCloudView';
import ErrorMessage from './ErrorMessage';
import AudioPreview from './AudioPreview';
import { useAnalysis } from '@/hooks/useAnalysis';
import type { AnalysisState } from '@/types';

export default function App() {
  const { state: analysisState, analyze, reset, discard, retry } = useAnalysis();
  const [pendingAudio, setPendingAudio] = useState<{
    blob: Blob;
    source: 'record' | 'upload';
    fileName: string;
    fileSizeBytes: number;
    durationSeconds: number;
  } | null>(null);
  const [inputError, setInputError] = useState<{ code: string; message: string } | null>(null);

  const handleReady = useCallback((
    blob: Blob,
    source: 'record' | 'upload',
    fileName: string,
    fileSizeBytes: number,
    durationSeconds: number
  ) => {
    setInputError(null);
    setPendingAudio({ blob, source, fileName, fileSizeBytes, durationSeconds });
  }, []);

  const handleError = useCallback((code: string, message: string) => {
    setInputError({ code, message });
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!pendingAudio) return;
    setInputError(null);
    analyze(pendingAudio.blob, pendingAudio.source, pendingAudio.fileName, pendingAudio.fileSizeBytes, pendingAudio.durationSeconds);
  }, [pendingAudio, analyze]);

  const handleRetry = useCallback(() => {
    setInputError(null);
    retry();
  }, [retry]);

  const handleDiscard = useCallback(() => {
    setInputError(null);
    setPendingAudio(null);
    discard();
  }, [discard]);

  const handleNewAnalysis = useCallback(() => {
    setInputError(null);
    setPendingAudio(null);
    reset();
  }, [reset]);

  // Determine what to show
  const isError = analysisState.status === 'error';
  const isProcessing = analysisState.status === 'processing';
  const isSuccess = analysisState.status === 'success';
  const hasPending = !!pendingAudio;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Audio Analyzer
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Input section */}
        {!hasPending && !isProcessing && !isSuccess && !isError && (
          <section aria-label="Audio input">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Step 1: Add Audio
            </h2>
            <AudioInput onReady={handleReady} onError={handleError} />
          </section>
        )}

        {/* Pending audio shown while processing/success/error */}
        {hasPending && !isSuccess && (
          <section aria-label="Audio status">
            <AudioPreview
              source={pendingAudio.source}
              fileName={pendingAudio.fileName}
              durationSeconds={pendingAudio.durationSeconds}
              fileSizeBytes={pendingAudio.fileSizeBytes}
              audioUrl={pendingAudio.source === 'record'
                ? URL.createObjectURL(pendingAudio.blob)
                : null}
              onPlay={() => {}}
              onDiscard={handleDiscard}
              isPlaying={false}
            />
          </section>
        )}

        {/* Analyze button (shown when audio is ready) */}
        {hasPending && !isProcessing && !isSuccess && !isError && (
          <section>
            <button
              onClick={handleAnalyze}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
              aria-label="Analyse the audio"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyse Audio
            </button>
          </section>
        )}

        {/* Error from input validation */}
        {inputError && !isProcessing && !isSuccess && (
          <section>
            <ErrorMessage
              code={inputError.code}
              message={inputError.message}
              onRetry={() => setInputError(null)}
              onDiscard={() => setInputError(null)}
            />
          </section>
        )}

        {/* Processing state */}
        {isProcessing && (
          <section>
            <ProcessingState
              stage={analysisState.stage}
              onCancel={handleDiscard}
            />
          </section>
        )}

        {/* Result error */}
        {isError && (
          <section>
            <ErrorMessage
              code={analysisState.code}
              message={analysisState.message}
              onRetry={handleRetry}
              onDiscard={handleDiscard}
            />
          </section>
        )}

        {/* Success / Word cloud */}
        {isSuccess && (
          <section aria-label="Analysis result">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Step 2: Results
            </h2>
            <WordCloudView terms={analysisState.result.terms} />
            <button
              onClick={handleNewAnalysis}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Analyse Another Recording
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Brief ref: TFG-WD-4417
        </p>
      </footer>
    </div>
  );
}
