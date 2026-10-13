import { useState, useRef, useEffect, type FC } from 'react';
import type { GroupHeaderProps, StructExportFormat } from '../types';
import {
  generateCStruct, generatePythonParser, generateMarkdownTable, sanitizeFieldName,
} from '../utils/structure';
import { cn } from '../utils/cn';

const EXPORT_FEEDBACK_TIMEOUT_MS = 2000;
const DELETE_CONFIRM_TIMEOUT_MS = 3000;
const STRUCT_NAME_FALLBACK = 'group';

export const GroupHeader: FC<GroupHeaderProps> = ({
  groupName, count, isCollapsed, groupRules, onToggle, onDeleteGroup,
}) => {
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState<boolean>(false);
  const exportTimeoutRef = useRef<number | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current !== null) window.clearTimeout(exportTimeoutRef.current);
      if (deleteTimeoutRef.current !== null) window.clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  const handleExport = (format: StructExportFormat): void => {
    if (groupRules.length === 0) return;
    let text: string;
    if (format === 'c') {
      const structName = sanitizeFieldName(groupName, STRUCT_NAME_FALLBACK);
      text = generateCStruct(groupRules, structName);
    } else if (format === 'python') {
      text = generatePythonParser(groupRules);
    } else {
      text = generateMarkdownTable(groupRules);
    }
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setExportFeedback(`${format.toUpperCase()} ✓`);
      } catch {
        setExportFeedback('Ошибка');
      }
      if (exportTimeoutRef.current !== null) window.clearTimeout(exportTimeoutRef.current);
      exportTimeoutRef.current = window.setTimeout(
        () => setExportFeedback(null),
        EXPORT_FEEDBACK_TIMEOUT_MS
      );
    })();
  };

  const handleDeleteClick = (): void => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      if (deleteTimeoutRef.current !== null) window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = window.setTimeout(
        () => setDeleteArmed(false),
        DELETE_CONFIRM_TIMEOUT_MS
      );
      return;
    }
    if (deleteTimeoutRef.current !== null) window.clearTimeout(deleteTimeoutRef.current);
    setDeleteArmed(false);
    onDeleteGroup(groupName);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        title="Свернуть / развернуть"
        className="flex-1 min-w-0 flex items-center justify-between text-xs text-slate-300 hover:text-white cursor-pointer"
      >
        <span className="font-medium truncate">📁 {groupName} ({count})</span>
        <span className="text-slate-500 shrink-0 ml-1">{isCollapsed ? '▸' : '▾'}</span>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => handleExport('c')} title="Скопировать C struct группы"
          className="px-1 py-0.5 text-[10px] font-mono rounded border bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500 hover:text-white cursor-pointer">C</button>
        <button type="button" onClick={() => handleExport('python')} title="Скопировать Python группы"
          className="px-1 py-0.5 text-[10px] font-mono rounded border bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500 hover:text-white cursor-pointer">PY</button>
        <button type="button" onClick={() => handleExport('markdown')} title="Скопировать Markdown группы"
          className="px-1 py-0.5 text-[10px] font-mono rounded border bg-slate-800 text-slate-400 border-slate-700 hover:border-emerald-500 hover:text-white cursor-pointer">MD</button>
        <button type="button" onClick={handleDeleteClick}
          title={deleteArmed ? `Нажмите ещё раз чтобы удалить ${count} правил` : `Удалить группу (${count})`}
          className={cn(
            'px-1.5 py-0.5 text-[10px] rounded border cursor-pointer',
            deleteArmed
              ? 'bg-rose-600/30 text-rose-100 border-rose-500/60'
              : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-rose-500 hover:text-rose-300'
          )}>
          {deleteArmed ? 'Точно?' : '🗑'}
        </button>
      </div>
      {exportFeedback && (
        <span className="text-[10px] text-emerald-300 shrink-0">{exportFeedback}</span>
      )}
    </div>
  );
};