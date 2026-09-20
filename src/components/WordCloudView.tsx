'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { Term } from '@/types';

interface WordCloudProps {
  terms: Term[];
}

// Color palette for the word cloud
const COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560',
  '#2b2d42', '#8d99ae', '#ef233c', '#d90429', '#023e8a',
  '#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4',
];

function getColor(index: number, total: number): string {
  const ratio = index / Math.max(total - 1, 1);
  const colorIndex = Math.floor(ratio * (COLORS.length - 1));
  return COLORS[colorIndex];
}

export default function WordCloudView({ terms }: WordCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wcRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const drawCloud = useCallback(async () => {
    if (!canvasRef.current || terms.length === 0) return;

    const canvas = canvasRef.current;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    // Set canvas size to match parent, scaled for retina
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = Math.max(rect.width * 0.6, 300) * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${Math.max(rect.width * 0.6, 300)}px`;

    // Scale context for retina
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    try {
      // Dynamic import to avoid SSR issues
      const WordCloud = (await import('wordcloud')).default as (
        canvas: HTMLCanvasElement,
        list: Array<[string, number]>,
        options: Record<string, unknown>
      ) => void;

      const canvasWidth = rect.width;
      const canvasHeight = Math.max(rect.width * 0.6, 300);
      const maxCount = Math.max(...terms.map(t => t.count), 1);
      const minCount = Math.min(...terms.map(t => t.count), 1);

      WordCloud(canvas, terms.map(t => [t.word, t.count]), {
        list: terms.map(t => [t.word, t.count]),
        gridSize: 8,
        weightFactor: (size: number) => {
          // Normalize count to font size range
          const normalized = minCount === maxCount
            ? 24
            : 16 + ((size - minCount) / (maxCount - minCount)) * 32;
          return Math.max(14, Math.min(56, normalized));
        },
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: (_word: string, weight: number, _info: unknown) => {
          const idx = terms.findIndex(t => t.word === _word);
          return getColor(Math.max(0, idx), terms.length);
        },
        rotateRatio: 0.1,
        backgroundColor: '#ffffff',
        shape: 'circle' as const,
        ellipticity: 0.75,
        drawOutOfBound: false,
        shrinkToFit: true,
        weightFactorFunction: (size: number) => {
          const normalized = minCount === maxCount
            ? 24
            : 16 + ((size - minCount) / (maxCount - minCount)) * 32;
          return Math.max(14, Math.min(56, normalized));
        },
      });

      wcRef.current = canvas;
      setError(null);
    } catch (err) {
      console.error('Word cloud render error:', err);
      setError('Failed to render word cloud. Please try again.');
    }
  }, [terms]);

  useEffect(() => {
    drawCloud();
  }, [drawCloud]);

  // Redraw on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      drawCloud();
    });
    const el = canvasRef.current?.parentElement;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [drawCloud]);

  const downloadPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'word-cloud.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  if (error) {
    return (
      <div className="text-center py-8 text-red-600 dark:text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No prominent terms detected in this recording. Try a longer or clearer audio file.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full bg-white rounded-lg border border-gray-200 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ height: 'auto' }}
        />
      </div>
      <button
        onClick={downloadPNG}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Download word cloud as PNG"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
