/**
 * src/hooks/useAnalysis.ts
 *
 * Two-step analysis flow with direct-to-Blob client upload:
 *
 *  1. Browser calls upload() from @vercel/blob/client
 *     → SDK sends small JSON handshake to /api/blob-upload
 *     → Server issues a short-lived clientToken
 *     → SDK PUTs the audio directly to Vercel Blob CDN using the token
 *     → Browser receives { url, pathname }
 *  2. Browser sends small JSON { blobUrl, metadata } to POST /api/analyze
 *     → Server reads private blob securely, calls Gemini, returns result
 *
 * The actual audio bytes NEVER pass through a Vercel Function.
 * BLOB_READ_WRITE_TOKEN stays server-side; the browser only ever sees
 * the short-lived clientToken issued by handleUpload().
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import type { AnalysisResult, AnalysisState } from '@/types';

const BLOB_CLEANUP_TIMEOUT_MS = 60_000; // 60 s grace period after analysis completes

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

  /**
   * Orchestrates the full analysis pipeline:
   *   blob-upload auth handshake → direct browser→Blob upload → analyze → word cloud
   */
  const analyze = useCallback(async (audioBlob: Blob, _source: 'record' | 'upload', fileName: string, fileSizeBytes: number, durationSeconds: number) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Step 1 & 2: Client-side direct-to-Blob upload via handleUpload handshake ──
      // upload() from @vercel/blob/client:
      //   1. POSTs a tiny JSON handshake to /api/blob-upload
      //   2. Server responds with a signed clientToken
      //   3. Browser PUTs the file directly to Blob CDN using that token
      // The large audio bytes never touch a Vercel Function.
      setState({ status: 'processing', stage: 'sending' });

      const safeName = fileName.replace(/[^\w.\-]/g, '_').slice(0, 120);
      const pathname = `analysis/${Date.now()}-${safeName}`;

      let blobResult;
      try {
        blobResult = await upload(pathname, audioBlob, {
          access: 'private',
          handleUploadUrl: '/api/blob-upload',
          contentType: audioBlob.type || 'application/octet-stream',
          onUploadProgress: (progress) => {
            setState((prev: AnalysisState) =>
              prev.status === 'processing' ? { ...prev, stage: 'uploading' } : prev
            );
          },
          abortSignal: controller.signal,
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

      // ── Step 3: Send tiny JSON to /api/analyze for Gemini transcription ──
      setState((prev: AnalysisState) =>
        prev.status === 'processing' ? { ...prev, stage: 'transcribing', blobUrl, cleanupAt: Date.now() + BLOB_CLEANUP_TIMEOUT_MS } : prev
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
        blobUrl,
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
