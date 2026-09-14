/**
 * src/hooks/useAnalysis.ts
 *
 * Orchestrates the two-step analysis flow:
 *  1. Upload audio to Vercel Blob via POST /api/blob-upload
 *  2. Send the blob URL to POST /api/analyze for Gemini transcription + cleanup
 *
 * All large-file transport bypasses the ~4.5 MB Serverless Function request-body
 * limit by using Vercel Blob as an intermediate store.
 */
import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult, AnalysisState } from '@/types';

const BLOB_CLEANUP_TIMEOUT_MS = 60_000; // 60 seconds before blob deletion

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

  /**
   * Two-step analysis flow:
   * 1. Upload the audio blob to Vercel Blob via POST /api/blob-upload
   * 2. Call POST /api/analyze with the returned blob URL
   *
   * The blob URL (and a scheduled cleanup timestamp) are stored on the
   * success state so the blob can be deleted after the user is done viewing
   * the result.
   */
  const analyze = useCallback(async (_audioBlob: Blob, _source: 'record' | 'upload', fileName: string, fileSizeBytes: number, durationSeconds: number) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Step 1: Upload audio to Vercel Blob ──────────────────────────────
      setState({ status: 'processing', stage: 'sending' });

      const uploadFormData = new FormData();
      uploadFormData.append('audio', _audioBlob, fileName);

      const uploadResponse = await fetch('/api/blob-upload', {
        method: 'POST',
        body: uploadFormData,
        signal: controller.signal,
      });

      if (!uploadResponse.ok) {
        let errorData: { code: string; message: string };
        try {
          errorData = await uploadResponse.json();
        } catch {
          errorData = { code: 'API_ERROR', message: 'The upload service returned an unexpected error.' };
        }
        setState({ status: 'error', code: errorData.code, message: errorData.message });
        return;
      }

      interface UploadResult { url: string; pathname: string }
      const uploadResult: UploadResult = await uploadResponse.json();
      const blobUrl = uploadResult.url;

      // Guard: sanity-check the URL before proceeding
      if (!blobUrl || typeof blobUrl !== 'string') {
        setState({ status: 'error', code: 'INVALID_RESPONSE', message: 'The upload service returned an invalid response.' });
        return;
      }

      // ── Step 2: Analyze via Gemini using the blob URL ───────────────────
      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'transcribing', blobUrl, cleanupAt: Date.now() + BLOB_CLEANUP_TIMEOUT_MS } : prev);

      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl,
          fileName,
          fileSizeBytes,
          durationSeconds,
        }),
        signal: controller.signal,
      });

      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'analyzing' } : prev);

      if (!analyzeResponse.ok) {
        let errorData: { code: string; message: string };
        try {
          errorData = await analyzeResponse.json();
        } catch {
          errorData = { code: 'API_ERROR', message: 'The AI service returned an unexpected error.' };
        }
        setState({ status: 'error', code: errorData.code, message: errorData.message });
        return;
      }

      setState((prev: AnalysisState) => prev.status === 'processing' ? { ...prev, stage: 'rendering' } : prev);

      const data: AnalysisResult & { blobUrl?: string; cleanupAt?: number } = await analyzeResponse.json();

      // Validate shape
      if (!data.transcript || !Array.isArray(data.terms)) {
        setState({ status: 'error', code: 'INVALID_RESPONSE', message: 'The AI service returned an unexpected response. Please try again.' });
        return;
      }

      // Success — carry blobUrl + cleanupAt into the success state
      setState({
        status: 'success',
        result: { transcript: data.transcript, terms: data.terms },
        blobUrl: data.blobUrl ?? blobUrl,
        cleanupAt: data.cleanupAt ?? Date.now() + BLOB_CLEANUP_TIMEOUT_MS,
      });
    } catch (err: unknown) {
      if (abortRef.current?.signal.aborted) return;

      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
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
      setState((prev: AnalysisState) => prev.status === 'error' || prev.status === 'success'
        ? { status: 'idle' }
        : prev
      );
    }
  }, [state.status]);

  return { state, analyze, reset, discard, retry };
}
