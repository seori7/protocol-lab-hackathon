import {
  useState, useRef, useEffect,
  type FC, type ChangeEvent,
} from 'react';
import type { ProjectIOProps } from '../types';
import {
  buildMadrigalFile, buildMadrigalFilename,
  downloadMadrigalFile, parseMadrigalFile,
} from '../utils/madrigal';
import { MADRIGAL_FILE_ACCEPT, PROJECT_IO_FEEDBACK_TIMEOUT_MS } from '../constants/project';
import { cn } from '../utils/cn';

export const ProjectIO: FC<ProjectIOProps> = ({
  rules, currentFilename, backendProjectId, selectedSessionId,
  bookmarkedIds, notes, onLoadProject,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const showFeedback = (message: string): void => {
    setFeedback(message);
    setError(null);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(
      () => setFeedback(null),
      PROJECT_IO_FEEDBACK_TIMEOUT_MS
    );
  };

  const showError = (message: string): void => {
    setError(message);
    setFeedback(null);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(
      () => setError(null),
      PROJECT_IO_FEEDBACK_TIMEOUT_MS
    );
  };

  const handleSave = (): void => {
    if (rules.length === 0) return;
    const file = buildMadrigalFile(
      rules, currentFilename, backendProjectId, selectedSessionId, bookmarkedIds, notes
    );
    const filename = buildMadrigalFilename(currentFilename);
    downloadMadrigalFile(file, filename);
    const notesCount = Object.keys(notes).length;
    showFeedback(`v2: ${rules.length} правил, ★${bookmarkedIds.size}, ✎${notesCount}`);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const parsed = parseMadrigalFile(json);
      if (parsed.drafts.length === 0) {
        showError(`Валидных правил нет. Пропущено: ${parsed.skipped}`);
        return;
      }
      onLoadProject(parsed.drafts, parsed.bookmarks, parsed.notes);
      const metaPart = parsed.bookmarks !== null
        ? `, ★${parsed.bookmarks.length}, ✎${Object.keys(parsed.notes ?? {}).length}`
        : ' (v1 без меты)';
      showFeedback(`Загружено: ${parsed.drafts.length}${metaPart}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось прочитать .madrigal';
      showError(message);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleSave}
        disabled={rules.length === 0}
        title={rules.length === 0 ? 'Нет правил' : 'Сохранить workspace v2: правила + закладки + заметки'}
        className={cn(
          'text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors',
          rules.length > 0
            ? 'bg-slate-800 text-slate-200 border-slate-700 hover:border-emerald-500 hover:text-white cursor-pointer'
            : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
        )}
      >
        💾 .madrigal
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Открыть .madrigal (заменит правила и мету)"
        className="text-xs font-medium px-2.5 py-1.5 rounded-md border bg-slate-800 text-slate-200 border-slate-700 hover:border-emerald-500 hover:text-white cursor-pointer"
      >
        📂 Открыть
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={MADRIGAL_FILE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
      {(feedback ?? error) && (
        <div
          className={cn(
            'absolute top-full mt-1 right-0 max-w-[260px] truncate text-[11px] rounded px-2 py-1 border z-20',
            error
              ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
              : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
          )}
          title={feedback ?? error ?? ''}
        >
          {feedback ?? error}
        </div>
      )}
    </div>
  );
};