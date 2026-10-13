import { useEffect, useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { ShortcutsModalProps } from '../types';
import { SHORTCUTS } from '../constants/ux';

const ESCAPE_KEY = 'Escape';

export const ShortcutsModal: FC<ShortcutsModalProps> = ({ open, onClose }) => {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>();
    for (const s of SHORTCUTS) {
      const arr = map.get(s.context) ?? [];
      arr.push(s);
      map.set(s.context, arr);
    }
    return Array.from(map.entries());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === ESCAPE_KEY) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stop = (e: ReactMouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-slate-900 border border-slate-700 p-5"
        onClick={stop}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-slate-100 text-sm">Горячие клавиши</div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-sm cursor-pointer">✕</button>
        </div>
        <div className="space-y-4">
          {grouped.map(([context, items]) => (
            <div key={context}>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">{context}</div>
              <div className="space-y-1">
                {items.map((s) => (
                  <div key={`${s.context}-${s.keys}-${s.action}`} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-300">{s.action}</span>
                    <kbd className="font-mono text-[11px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 whitespace-nowrap">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-md text-xs bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-200 cursor-pointer"
        >
          Закрыть (Esc)
        </button>
      </div>
    </div>
  );
};