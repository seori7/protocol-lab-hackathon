import { useState, useRef, useEffect, type FC } from 'react';
import type { GroupHeaderProps, StructExportFormat } from '../types';
import {
  generateCStruct,
  generatePythonParser,
  generateMarkdownTable,
  sanitizeFieldName,
} from '../utils/structure';
import { ChevronDownIcon, TrashIcon } from './icons';
import { cn } from '../utils/cn';

const EXP_T = 2000;
const DEL_T = 3000;

export const GroupHeader: FC<GroupHeaderProps> = ({
  groupName,
  count,
  isCollapsed,
  groupRules,
  onToggle,
  onDeleteGroup,
}) => {
  const [fb, setFb] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const eRef = useRef<number | null>(null);
  const dRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (eRef.current !== null) window.clearTimeout(eRef.current);
      if (dRef.current !== null) window.clearTimeout(dRef.current);
    };
  }, []);

  const exp = (f: StructExportFormat): void => {
    if (!groupRules.length) return;
    const t =
      f === 'c'
        ? generateCStruct(groupRules, sanitizeFieldName(groupName, 'group'))
        : f === 'python'
          ? generatePythonParser(groupRules)
          : generateMarkdownTable(groupRules);
    void (async () => {
      try {
        await navigator.clipboard.writeText(t);
        setFb(`${f.toUpperCase()}`);
      } catch {
        setFb('Ошибка');
      }
      if (eRef.current !== null) window.clearTimeout(eRef.current);
      eRef.current = window.setTimeout(() => setFb(null), EXP_T);
    })();
  };

  const del = (): void => {
    if (!armed) {
      setArmed(true);
      if (dRef.current !== null) window.clearTimeout(dRef.current);
      dRef.current = window.setTimeout(() => setArmed(false), DEL_T);
      return;
    }
    if (dRef.current !== null) window.clearTimeout(dRef.current);
    setArmed(false);
    onDeleteGroup(groupName);
  };

  return (
    <div className="flex items-center gap-1.5 font-sans">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white cursor-pointer transition-colors py-0.5"
      >
        <span
          className={cn(
            'transition-transform duration-200',
            isCollapsed ? '-rotate-90' : ''
          )}
        >
          <ChevronDownIcon size={13} />
        </span>
        <span className="font-medium truncate">{groupName}</span>
        <span className="font-mono text-zinc-500">({count})</span>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => exp('c')}
          title="C struct группы"
          className="h-6 px-1.5 text-[10px] font-mono rounded border border-white/[0.08] bg-[#1a1c20] text-zinc-400 hover:text-white hover:border-white/20 hover:-translate-y-px transition-all cursor-pointer"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => exp('python')}
          title="Python группы"
          className="h-6 px-1.5 text-[10px] font-mono rounded border border-white/[0.08] bg-[#1a1c20] text-zinc-400 hover:text-white hover:border-white/20 hover:-translate-y-px transition-all cursor-pointer"
        >
          PY
        </button>
        <button
          type="button"
          onClick={() => exp('markdown')}
          title="Markdown группы"
          className="h-6 px-1.5 text-[10px] font-mono rounded border border-white/[0.08] bg-[#1a1c20] text-zinc-400 hover:text-white hover:border-white/20 hover:-translate-y-px transition-all cursor-pointer"
        >
          MD
        </button>
        <button
          type="button"
          onClick={del}
          title={armed ? 'Нажмите ещё раз' : `Удалить группу (${count})`}
          className={cn(
            'h-6 px-1.5 rounded border transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]',
            armed
              ? 'bg-red-400/15 text-red-200 border-red-400/40'
              : 'bg-[#1a1c20] text-zinc-500 border-white/[0.08] hover:text-red-200 hover:border-red-400/30'
          )}
        >
          <TrashIcon size={11} />
          {armed ? 'Точно?' : ''}
        </button>
      </div>
      {fb && (
        <span className="text-[10px] font-mono text-zinc-300 shrink-0">{fb}</span>
      )}
    </div>
  );
};