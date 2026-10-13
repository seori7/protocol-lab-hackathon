import { useState, useRef, useEffect, type FC } from 'react';
import type { ReportButtonProps } from '../types';
import { buildHtmlReport, downloadHtmlReport, buildReportFilename } from '../utils/report';
import { cn } from '../utils/cn';

const REPORT_FEEDBACK_TIMEOUT_MS = 3000;

export const ReportButton: FC<ReportButtonProps> = ({
  projectFilename, sessionLabel, packets, rules, bookmarkedIds, notes,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const canExport = packets.length > 0;

  const handleClick = (): void => {
    if (!canExport) return;
    const html = buildHtmlReport(projectFilename, sessionLabel, packets, rules, bookmarkedIds, notes);
    const filename = buildReportFilename(projectFilename);
    downloadHtmlReport(html, filename);
    setFeedback(`Скачан: ${filename}`);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setFeedback(null), REPORT_FEEDBACK_TIMEOUT_MS);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={!canExport}
        title={canExport ? 'Скачать HTML-отчёт: структура + покрытие + заметки' : 'Нет пакетов для отчёта'}
        className={cn(
          'text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors',
          canExport
            ? 'bg-slate-800 text-slate-200 border-slate-700 hover:border-blue-500 hover:text-white cursor-pointer'
            : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
        )}
      >
        📄 Отчёт
      </button>
      {feedback && (
        <div className="absolute top-full mt-1 right-0 max-w-[260px] truncate text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 z-20" title={feedback}>
          {feedback}
        </div>
      )}
    </div>
  );
};