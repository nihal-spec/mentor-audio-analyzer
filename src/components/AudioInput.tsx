'use client';

import { useState, useCallback } from 'react';
import Recorder from './Recorder';
import FileUploader from './FileUploader';
import AudioPreview from './AudioPreview';
import type { AudioSource } from '@/types';

interface AudioInputProps {
  onReady: (blob: Blob, source: AudioSource, fileName: string, fileSizeBytes: number, durationSeconds: number) => void;
  onError: (code: string, message: string) => void;
}

export default function AudioInput({ onReady, onError }: AudioInputProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource>('record');
  const [audioFileName, setAudioFileName] = useState('');
  const [audioFileSize, setAudioFileSize] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleRecorded = useCallback((blob: Blob, elapsedSeconds: number) => {
    setAudioBlob(blob);
    setAudioSource('record');
    setAudioFileName(`recording_${Date.now()}.webm`);
    setAudioFileSize(blob.size);
    setAudioDuration(elapsedSeconds);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
  }, []);

  const handleFileSelected = useCallback((
    blob: Blob,
    source: AudioSource,
    fileName: string,
    fileSizeBytes: number,
    durationSeconds: number
  ) => {
    setAudioBlob(blob);
    setAudioSource(source);
    setAudioFileName(fileName);
    setAudioFileSize(fileSizeBytes);
    setAudioDuration(durationSeconds);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
  }, []);

  const handleDiscard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioSource('record');
    setAudioFileName('');
    setAudioFileSize(0);
    setAudioDuration(0);
    setAudioUrl(null);
  }, [audioUrl]);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleProceed = useCallback(() => {
    if (audioBlob) {
      onReady(audioBlob, audioSource, audioFileName, audioFileSize, audioDuration);
    }
  }, [audioBlob, audioSource, audioFileName, audioFileSize, audioDuration, onReady]);

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => { setActiveTab('record'); handleDiscard(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'record'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 21a9 9 0 100-18 9 9 0 000 18z" />
          </svg>
          Record
        </button>
        <button
          onClick={() => { setActiveTab('upload'); handleDiscard(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload
        </button>
      </div>

      {/* Content area */}
      {activeTab === 'record' ? (
        <Recorder onRecorded={handleRecorded} onError={onError} />
      ) : (
        <FileUploader onSelected={handleFileSelected} onError={onError} />
      )}

      {/* Limit notice */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Maximum: 25 MB or 10 minutes
      </p>

      {/* Preview + Proceed */}
      {audioBlob && audioUrl && (
        <div className="space-y-3">
          <AudioPreview
            source={audioSource}
            fileName={audioFileName}
            durationSeconds={audioDuration}
            fileSizeBytes={audioFileSize}
            audioUrl={audioUrl}
            onPlay={handlePlayToggle}
            onDiscard={handleDiscard}
            isPlaying={isPlaying}
          />
          <button
            onClick={handleProceed}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
            aria-label="Proceed to analysis"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Analyse Audio
          </button>
        </div>
      )}
    </div>
  );
}
