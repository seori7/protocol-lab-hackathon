import { useState, useRef, type FC, type ChangeEvent, type DragEvent } from 'react';
import type { ProjectUploaderProps } from '../types';
import { uploadPcapFile, ApiError } from '../api/client';
import { UPLOAD_INPUT_ACCEPT, UPLOAD_ALLOWED_EXTENSIONS, MAX_UPLOAD_FILE_SIZE_BYTES, BYTES_PER_MB } from '../constants/api';
import { UploadIcon } from './icons';
import { cn } from '../utils/cn';
export const ProjectUploader: FC<ProjectUploaderProps> = ({ onUploadSuccess, currentFilename, backendStatus }) => {
const [drag, setDrag] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
const ref = useRef<HTMLInputElement>(null);
const live = backendStatus === 'live';
const check = (f: File): string | null => {
const lw = f.name.toLowerCase(); if (!UPLOAD_ALLOWED_EXTENSIONS.some((e) => lw.endsWith(e))) return `Неверный формат "${f.name}" — нужен .pcap`;
if (f.size > MAX_UPLOAD_FILE_SIZE_BYTES) return `Файл ${(f.size / BYTES_PER_MB).toFixed(1)} МБ превышает лимит`; return null;
};
const run = async (f: File): Promise<void> => { const v = check(f); if (v) { setErr(v); return; } setErr(null); setBusy(true);
try { const r = await uploadPcapFile(f); onUploadSuccess(r.project_id, r.filename || f.name); }
catch (e) { setErr(e instanceof ApiError ? e.message : 'Ошибка загрузки'); } finally { setBusy(false); } };
return (
<div className="relative font-sans" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && !busy) void run(f); }}>
<div className="flex items-center gap-2">
<span title={live ? 'Подключено' : 'Демо-режим'} className={cn('w-1.5 h-1.5 rounded-full shrink-0', live ? 'bg-emerald-400/90' : 'bg-zinc-600')} />
<span title={currentFilename ?? 'Файл не загружен'} className="text-[12px] font-mono text-zinc-500 max-w-[160px] truncate hidden md:inline">{currentFilename ?? 'demo'}</span>
<button type="button" onClick={() => ref.current?.click()} disabled={busy} title="Загрузить .pcap (можно перетащить)" className="btn-secondary !h-8">
<UploadIcon size={13} />{busy ? 'Загрузка...' : 'Загрузить PCAP'}</button>
<input ref={ref} type="file" accept={UPLOAD_INPUT_ACCEPT} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} className="hidden" />
</div>
{err && <div title={err} className="absolute top-full mt-1.5 right-0 max-w-[280px] truncate text-[11px] text-red-200/90 bg-red-400/10 border border-red-400/20 rounded-md px-2 py-1 z-20">{err}</div>}
{drag && <div className="absolute -inset-2 rounded-lg border border-dashed border-white/30 bg-white/[0.04] pointer-events-none z-10" />}
</div>
);
};