import { useState, useRef, useEffect, type FC, type ChangeEvent } from 'react';
import type { ProjectIOProps } from '../types';
import { buildMadrigalFile, buildMadrigalFilename, downloadMadrigalFile, parseMadrigalFile } from '../utils/madrigal';
import { MADRIGAL_FILE_ACCEPT, PROJECT_IO_FEEDBACK_TIMEOUT_MS } from '../constants/project';
import { SaveIcon, FolderIcon } from './icons';
import { cn } from '../utils/cn';
export const ProjectIO: FC<ProjectIOProps> = ({ rules, currentFilename, backendProjectId, selectedSessionId, bookmarkedIds, notes, onLoadProject }) => {
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const tRef = useRef<number | null>(null);
  useEffect(() => () => { if (tRef.current !== null) window.clearTimeout(tRef.current); }, []);
  const flash = (m: string, isErr: boolean): void => {
    if (isErr) { setErr(m); setOk(null); } else { setOk(m); setErr(null); }
    if (tRef.current !== null) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => { setOk(null); setErr(null); }, PROJECT_IO_FEEDBACK_TIMEOUT_MS);
  };
  const save = (): void => {
    if (!rules.length) return;
    const f = buildMadrigalFile(rules, currentFilename, backendProjectId, selectedSessionId, bookmarkedIds, notes);
    downloadMadrigalFile(f, buildMadrigalFilename(currentFilename));
    flash(`Сохранено: ${rules.length} правил`, false);
  };
  const load = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const p = parseMadrigalFile(JSON.parse(await f.text()) as unknown);
      if (!p.drafts.length) { flash(`Валидных нет, пропущено: ${p.skipped}`, true); return; }
      onLoadProject(p.drafts, p.bookmarks, p.notes);
      flash(`Загружено: ${p.drafts.length}`, false);
    } catch (ex) { flash(ex instanceof Error ? ex.message : 'Не удалось прочитать', true); }
  };
  return (
    <div className="relative flex items-center gap-1.5 font-sans">
      <button type="button" onClick={save} disabled={!rules.length} title="Сохранить проект" className="btn-secondary disabled:opacity-40"><SaveIcon size={13} />Сохранить</button>
      <button type="button" onClick={() => ref.current?.click()} title="Открыть проект" className="btn-secondary"><FolderIcon size={13} />Открыть</button>
      <input ref={ref} type="file" accept={MADRIGAL_FILE_ACCEPT} onChange={load} className="hidden" />
      {(ok ?? err) && (
        <div title={ok ?? err ?? ''} className={cn('absolute top-full mt-1.5 right-0 max-w-[260px] truncate text-[11px] rounded-md px-2 py-1 border z-20', err ? 'text-red-200/90 bg-[#1e2025] border-red-400/20' : 'text-zinc-200 bg-[#1e2025] border-white/10')}>{ok ?? err}</div>
      )}
    </div>
  );
};