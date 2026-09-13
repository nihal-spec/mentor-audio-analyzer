'use client';

import { formatBytes, formatDuration } from '@/lib/validation';

interface AudioPreviewProps {
  source: 'record' | 'upload';
  fileName: string;
  durationSeconds: number;
  fileSizeBytes: number;
  audioUrl: string | null;
  onPlay: () => void;
  onDiscard: () => void;
  isPlaying: boolean;
}

export default function AudioPreview({
  source,
  fileName,
  durationSeconds,
  fileSizeBytes,
  audioUrl,
  onPlay,
  onDiscard,
  isPlaying,
}: AudioPreviewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${source === 'record'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          }
        `}>
          {source === 'record' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 21a9 9 0 100-18 9 9 0 000 18z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDuration(durationSeconds)} · {formatBytes(fileSizeBytes)}
          </p>
        </div>
      </div>

      {/* Playback */}
      {audioUrl && (
        <audio
          src={audioUrl}
          className="w-full mt-3"
          controls
          preload="metadata"
          aria-label="Audio playback"
        />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onDiscard}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Discard audio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Discard
        </button>
      </div>
    </div>
  );
}
