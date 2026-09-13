'use client';

import { AnalysisErrorCode } from '@/lib/constants';

interface ErrorMessageProps {
  code: string;
  message: string;
  onRetry: () => void;
  onDiscard: () => void;
}

const ERROR_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  [AnalysisErrorCode.FILE_TOO_LARGE]: { icon: '⚠️', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  [AnalysisErrorCode.FILE_TOO_LONG]: { icon: '⚠️', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  [AnalysisErrorCode.UNSUPPORTED_FORMAT]: { icon: '❌', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  [AnalysisErrorCode.SILENT_AUDIO]: { icon: '🔇', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
  [AnalysisErrorCode.API_ERROR]: { icon: '🔌', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  [AnalysisErrorCode.TIMEOUT]: { icon: '⏱️', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  [AnalysisErrorCode.INVALID_RESPONSE]: { icon: '🔀', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  [AnalysisErrorCode.NETWORK_ERROR]: { icon: '🌐', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  DEFAULT: { icon: '❌', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
};

export default function ErrorMessage({ code, message, onRetry, onDiscard }: ErrorMessageProps) {
  const config = ERROR_CONFIG[code] ?? ERROR_CONFIG.DEFAULT;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-xl border p-4 ${config.bg} ${config.color} border-current`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{config.icon}</span>
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-current rounded-lg hover:bg-white/80 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-current"
        >
          Try Again
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-sm font-medium bg-transparent border border-current rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-current"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
