'use client';

import { useState, useRef, useCallback } from 'react';
import { ALLOWED_MIME_TYPES, BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS } from '@/lib/constants';
import { validateAudioFile, getAudioDuration, formatBytes } from '@/lib/validation';
import type { AudioSource } from '@/types';

interface FileUploaderProps {
  onSelected: (blob: Blob, source: AudioSource, fileName: string, fileSizeBytes: number, durationSeconds: number) => void;
  onError: (code: string, message: string) => void;
}

const ACCEPTED_TYPES = Array.from(ALLOWED_MIME_TYPES).join(', ');

export default function FileUploader({ onSelected, onError }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // Immediate format check
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      onError('UNSUPPORTED_FORMAT', 'This file type is not supported. Please use MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC.');
      return;
    }

    // Immediate size check
    if (file.size > BRIEF_REF_5190_MAX_BYTES) {
      onError('FILE_TOO_LARGE', `File is too large (${formatBytes(file.size)}). Maximum size is 25 MB.`);
      return;
    }

    setIsLoading(true);

    try {
      // Detect duration
      const duration = await getAudioDuration(file);

      // Full validation
      const validationError = validateAudioFile(file, duration);
      if (validationError) {
        onError(validationError.code, validationError.message);
        setIsLoading(false);
        return;
      }

      onSelected(file, 'upload', file.name, file.size, duration);
    } catch (err) {
      onError('PROCESSING_ERROR', 'Could not read audio file. Please try a different file.');
    } finally {
      setIsLoading(false);
    }
  }, [onSelected, onError]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload audio file"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Reading audio file...</p>
        </div>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="font-medium text-gray-700 dark:text-gray-200">
            Drop audio file here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            MP3, WAV, M4A, AAC, OGG, WEBM, FLAC — Max 25 MB or 10 minutes
          </p>
        </>
      )}
    </div>
  );
}
