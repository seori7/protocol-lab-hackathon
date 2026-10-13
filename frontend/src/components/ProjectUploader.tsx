import { useState, useRef, type FC, type ChangeEvent, type DragEvent } from 'react';
import type { ProjectUploaderProps } from '../types';
import { uploadPcapFile, ApiError } from '../api/client';
import {
  UPLOAD_INPUT_ACCEPT, UPLOAD_ALLOWED_EXTENSIONS,
  MAX_UPLOAD_FILE_SIZE_BYTES, BYTES_PER_MB,
} from '../constants/api';
import { cn } from '../utils/cn';

export const ProjectUploader: FC<ProjectUploaderProps> = ({
  onUploadSuccess, currentFilename, backendStatus,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = (): void => {
    fileInputRef.current?.click();
  };

  const validateFile = (file: File): string | null => {
    const lower = file.name.toLowerCase();
    const extOk = UPLOAD_ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!extOk) return `Неверный формат "${file.name}". Нужен .pcap или .pcapng`;
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / BYTES_PER_MB).toFixed(1);
      const maxMb = (MAX_UPLOAD_FILE_SIZE_BYTES / BYTES_PER_MB).toFixed(0);
      return `Файл ${sizeMb} МБ превышает лимит ${maxMb} МБ`;
    }
    return null;
  };

  const processFile = async (file: File): Promise<void> => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const res = await uploadPcapFile(file);
      onUploadSuccess(res.project_id, res.filename || file.name);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки файла';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isUploading) void processFile(file);
  };

  const isLive = backendStatus === 'live';

  return (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2">
        {/* Индикатор: зеленый = live бэкенд, янтарный = моки */}
        <span
          title={isLive ? 'Подключено к бэкенду' : 'Демо-режим (моки)'}
          className={cn('w-2 h-2 rounded-full shrink-0', isLive ? 'bg-emerald-400' : 'bg-amber-400')}
        />
        <span
          title={currentFilename ?? 'Файл не загружен'}
          className="text-xs font-mono text-slate-400 max-w-[180px] truncate hidden md:inline"
        >
          {currentFilename ?? 'demo'}
        </span>
        <button
          type="button"
          onClick={openFileDialog}
          disabled={isUploading}
          title="Загрузить .pcap/.pcapng (можно перетащить файл)"
          className={cn(
            'text-xs font-medium px-3 py-1.5 rounded-md border transition-colors cursor-pointer',
            isUploading
              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-wait'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-blue-500 hover:text-white'
          )}
        >
          {isUploading ? 'Загрузка...' : '⬆ Загрузить PCAP'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_INPUT_ACCEPT}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <div
          title={error}
          className="absolute top-full mt-1 right-0 max-w-[280px] truncate text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1 z-20"
        >
          {error}
        </div>
      )}
      {isDragging && (
        <div className="absolute -inset-2 rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none z-10" />
      )}
    </div>
  );
};