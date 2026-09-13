'use client';

import type { ProcessingStage } from '@/types';

const STAGE_LABELS: Record<ProcessingStage, string> = {
  sending: 'Sending audio to AI...',
  transcribing: 'Transcribing audio...',
  analyzing: 'Finding prominent terms...',
  rendering: 'Generating word cloud...',
};

interface ProcessingStateProps {
  stage: ProcessingStage;
  onCancel: () => void;
}

export default function ProcessingState({ stage, onCancel }: ProcessingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      {/* Animated spinner */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
      </div>

      {/* Stage label */}
      <div className="text-center">
        <p className="font-medium text-gray-900 dark:text-white">
          {STAGE_LABELS[stage]}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          This may take a moment for longer recordings.
        </p>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}
