import { useState, useRef, useCallback, useEffect } from 'react';
import { RECORDING_MIME_TYPES } from '@/lib/constants';

export interface RecordingState {
  blob: Blob | null;
  url: string | null;
  elapsedSeconds: number;
  isRecording: boolean;
  error: string | null;
  micDenied: boolean;
  micUnavailable: boolean;
}

export function useRecorder() {
  const [state, setState] = useState<RecordingState>({
    blob: null,
    url: null,
    elapsedSeconds: 0,
    isRecording: false,
    error: null,
    micDenied: false,
    micUnavailable: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setState(prev => ({ ...prev, error: null, micDenied: false, micUnavailable: false }));

    // Check if MediaRecorder is available
    if (typeof MediaRecorder === 'undefined') {
      setState(prev => ({ ...prev, micUnavailable: true, error: 'Microphone is not available on this device.' }));
      return false;
    }

    // Find a supported MIME type
    const supportedTypes = RECORDING_MIME_TYPES.filter(type => MediaRecorder.isTypeSupported(type));
    if (supportedTypes.length === 0) {
      setState(prev => ({ ...prev, micUnavailable: true, error: 'No supported audio format found. Please use Chrome or Firefox.' }));
      return false;
    }

    const mimeType = supportedTypes[0];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        stopTimer();

        setState(prev => ({
          ...prev,
          blob,
          url,
          elapsedSeconds: elapsed,
          isRecording: false,
        }));

        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();

      setState(prev => ({ ...prev, isRecording: true, elapsedSeconds: 0 }));

      // Update timer every second
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          elapsedSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      return true;
    } catch (err: unknown) {
      stopTimer();
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('NotAllowedError') || message.includes('permission')) {
        setState(prev => ({ ...prev, micDenied: true, error: 'Microphone access was denied. Please allow microphone access in your browser settings and try again.' }));
      } else if (message.includes('NotFoundError') || message.includes('MissingConnectionError')) {
        setState(prev => ({ ...prev, micUnavailable: true, error: 'No microphone detected. Please connect a microphone and refresh the page.' }));
      } else {
        setState(prev => ({ ...prev, error: `Unable to access microphone: ${message}` }));
      }
      return false;
    }
  }, [stopTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const discardRecording = useCallback(() => {
    stopTimer();
    if (state.url) {
      URL.revokeObjectURL(state.url);
    }
    setState({
      blob: null,
      url: null,
      elapsedSeconds: 0,
      isRecording: false,
      error: null,
      micDenied: false,
      micUnavailable: false,
    });
  }, [state.url, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (state.url) {
        URL.revokeObjectURL(state.url);
      }
    };
  }, [state.url, stopTimer]);

  return { ...state, startRecording, stopRecording, discardRecording };
}
