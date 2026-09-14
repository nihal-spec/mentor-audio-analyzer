/**
 * src/hooks/useAnalysis.ts
 *
 * Two-step analysis flow with direct-to-Blob client upload:
 *
 *  1. POST /api/blob-upload  — small JSON metadata → server issues signed token
 *  2. Browser PUTs audio directly to Vercel Blob CDN using the token
 *  3. POST /api/analyze      — small JSON { blobUrl, metadata } → Gemini → result
 *
 * The actual audio bytes NEVER pass through a Vercel Function, avoiding the
 * ~4.5 MB request-body limit entirely.
 */
import { useState, useCallback, useRef } from 'react';
import { put } from '@vercel/blob';
import type { AnalysisResult, AnalysisState } from '@/types';

const BLOB_CLEANUP_TIMEOUT_MS = 60_000; // 60 seconds grace period after success

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setState({ status: 'idle' });
  }, []);

  const discard = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setState({ status: 'idle' });
  }, []);

  const analyze = useCallback(async (audioBlob: Blob, _source: 'record' | 'upload', fileName: string, fileSizeBytes: number, durationSeconds: number) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Step 1: Get upload authorization from server (tiny JSON round-trip) ─
      setState({ status: 'processing', stage: 'sending' });

      let authToken: { clientSigningToken: string; delegationToken: string };
      let pathname: string;
      try {
        const authResp = await fetch('/api/blob-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, fileSizeBytes, mimeType: audioBlob.type, durationSeconds }),
          signal: controller.signal,
        });

        if (!authResp.ok) {
          let errData: { code: string; message: string };
          try { errData = await authResp.json(); } catch { errData = { code: 'API_ERROR', message: 'Upload preparation failed.' }; }
          setState({ status: 'error', code: errData.code, message: errData.message });
          return;
        }

        const authResult = await authResp.json();
        authToken = authResult.signedToken;
        pathname = authResult.pathname;
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', code: 'NETWORK_ERROR', message: 'Network error during upload authorization. Please try again.' });
        return;
      }

      // ── Step 2: Upload audio directly to Vercel Blob (bypasses function limits) ─
      setState({ status: 'processing', stage: 'uploading', blobUrl: '', cleanupAt: Date.now() + BLOB_CLEANUP_TIMEOUT_MS });

      let blobResult;
      try {
        blobResult = await put(pathname, audioBlob, {
          access: 'private',
          addRandomSuffix: false,
          contentType: audioBlob.type || 'application/octet-stream',
          token: authToken.clientSigningToken,
          onUploadProgress: (progress) => {
            // Update stage label only when progress changes meaningfully
            if (progress.percentage && progress.percentage > 0) {
              setState((prev: AnalysisState) =>
                prev.status === 'processing' ? { ...prev, stage: 'uploading' } : prev
              );
            }
          },
        });
      } catch (uploadErr) {
        if (controller.signal.aborted) return;
        console.error('Direct blob upload failed:', uploadErr);
        setState({ status: 'error', code: 'API_ERROR', message: 'Failed to upload audio. Please try again.' });
        return;
      }

      const blobUrl = blobResult.url;
      if (!blobUrl) {
        setState({ status: 'error', code: 'INVALID_RESPONSE', message: 'Upload succeeded but no URL was returned.' });
        return;
      }

      // ── Step 3: Analyze via Gemini using the blob URL (server fetches privately) ─
      setState((prev: AnalysisState) =>
        prev.status === 'processing' ? { ...prev, stage: 'transcribing', blobUrl } : prev
      );

      const analyzeResp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, pathname, fileName, fileSizeBytes, durationSeconds }),
        signal: controller.signal,
      });

      setState((prev: AnalysisState) =>
        prev.status === 'processing' ? { ...prev, stage: 'analyzing' } : prev
      );

      if (!analyzeResp.ok) {
        let errData: { code: string; message: string };
        try { errData = await analyzeResp.json(); } catch { errData = { code: 'API_ERROR', message: 'The AI service returned an unexpected error.' }; }
        setState({ status: 'error', code: errData.code, message: errData.message });
        return;
      }

      setState((prev: AnalysisState) =>
        prev.status === 'processing' ? { ...prev, stage: 'rendering' } : prev
      );

      const data: AnalysisResult & { blobUrl?: string } = await analyzeResp.json();

      if (!data.transcript || !Array.isArray(data.terms)) {
        setState({ status: 'error', code: 'INVALID_RESPONSE', message: 'The AI service returned an unexpected response. Please try again.' });
        return;
      }

      setState({
        status: 'success',
        result: { transcript: data.transcript, terms: data.terms },
        blobUrl: data.blobUrl ?? blobUrl,
        cleanupAt: Date.now() + BLOB_CLEANUP_TIMEOUT_MS,
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
      setState((prev: AnalysisState) =>
        prev.status === 'error' || prev.status === 'success' ? { status: 'idle' } : prev
      );
    }
  }, [state.status]);

  return { state, analyze, reset, discard, retry };
}
