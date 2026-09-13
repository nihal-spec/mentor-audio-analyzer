import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult, AnalysisState, ProcessingStage } from '@/types';

const STAGES: ProcessingStage[] = ['sending', 'transcribing', 'analyzing', 'rendering'];
const STAGE_LABELS: Record<ProcessingStage, string> = {
  sending: 'Sending audio to AI...',
  transcribing: 'Transcribing audio...',
  analyzing: 'Analyzing prominent terms...',
  rendering: 'Generating word cloud...',
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({ status: 'idle' });
  }, []);

  const discard = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({ status: 'idle' });
  }, []);

  const analyze = useCallback(async (audioBlob: Blob, source: 'record' | 'upload', fileName: string, fileSizeBytes: number, durationSeconds: number) => {
    // Set to processing state
    setState({ status: 'processing', stage: 'sending' });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      // Progress through stages
      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'transcribing' } : prev);

      if (!response.ok) {
        let errorData: { code: string; message: string };
        try {
          errorData = await response.json();
        } catch {
          errorData = { code: 'API_ERROR', message: 'The AI service returned an unexpected error.' };
        }
        setState({ status: 'error', code: errorData.code, message: errorData.message });
        return;
      }

      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'analyzing' } : prev);

      const data: AnalysisResult = await response.json();

      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'rendering' } : prev);

      // Validate the result shape
      if (!data.transcript || !Array.isArray(data.terms)) {
        setState({ status: 'error', code: 'INVALID_RESPONSE', message: 'The AI service returned an unexpected response. Please try again.' });
        return;
      }

      setState({ status: 'success', result: data });
    } catch (err: unknown) {
      if (controller.signal.aborted) return; // User cancelled

      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';

      if (message.includes('abort')) {
        return;
      }

      setState({
        status: 'error',
        code: 'NETWORK_ERROR',
        message: message.includes('fetch') || message.includes('NetworkError')
          ? 'Network error. Please check your connection and try again.'
          : `Analysis failed: ${message}`,
      });
    } finally {
      abortRef.current = null;
    }
  }, []);

  const retry = useCallback(() => {
    if (state.status === 'error' || state.status === 'success') {
      // Keep the prepared state but reset processing
      setState((prev: AnalysisState) => prev.status === 'error' || prev.status === 'success'
        ? { status: 'idle' }
        : prev
      );
    }
  }, [state.status]);

  return { state, analyze, reset, discard, retry };
}
