'use client';

import { formatDuration } from '@/lib/validation';
import { useRecorder } from '@/hooks/useRecorder';

interface RecorderProps {
  onRecorded: (blob: Blob, elapsedSeconds: number) => void;
  onError: (code: string, message: string) => void;
}

export default function Recorder({ onRecorded, onError }: RecorderProps) {
  const {
    isRecording,
    elapsedSeconds,
    blob,
    error,
    micDenied,
    micUnavailable,
    startRecording,
    stopRecording,
    discardRecording,
  } = useRecorder();

  const handleStart = async () => {
    const success = await startRecording();
    if (!success && !error) {
      onError('MIC_ERROR', 'Unable to start recording. Please check your microphone.');
    }
  };

  const handleStop = () => {
    stopRecording();
    if (blob) {
      onRecorded(blob, elapsedSeconds);
    }
  };

  const handleDiscard = () => {
    discardRecording();
  };

  return (
    <div className="space-y-4">
      {/* Timer / Record button */}
      <div className="flex flex-col items-center gap-4">
        {isRecording ? (
          <>
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
              <span className="text-2xl font-mono font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Stop recording"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop Recording
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
            aria-label="Start recording"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 21a9 9 0 100-18 9 9 0 000 18z" />
            </svg>
            Record Audio
          </button>
        )}
      </div>

      {/* Error states for microphone */}
      {micDenied && (
        <div role="alert" className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Microphone access denied</p>
          <p>Please allow microphone access in your browser settings and try again.</p>
        </div>
      )}

      {micUnavailable && (
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
          <p className="font-medium">No microphone detected</p>
          <p>Please connect a microphone and refresh the page.</p>
        </div>
      )}

      {error && !micDenied && !micUnavailable && (
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
          <p className="font-medium">Recording error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Playback after recording */}
      {!isRecording && blob && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recording complete ({formatDuration(elapsedSeconds)})
          </p>
          <audio src={URL.createObjectURL(blob)} controls className="w-full mb-3" preload="metadata" />
          <div className="flex gap-2">
            <button
              onClick={() => onRecorded(blob, elapsedSeconds)}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Use This Recording
            </button>
            <button
              onClick={handleDiscard}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Discard
            </button>
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Record Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
