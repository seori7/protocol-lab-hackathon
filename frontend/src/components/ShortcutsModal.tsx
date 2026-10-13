import { useEffect, useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { ShortcutsModalProps } from '../types';
import { SHORTCUTS } from '../constants/ux';
import { XIcon } from './icons';
const ESC = 'Escape';
export const ShortcutsModal: FC<ShortcutsModalProps> = ({ open, onClose }) => {
const grouped = useMemo(() => { const m = new Map<string, typeof SHORTCUTS>(); for (const s of SHORTCUTS) { const a = m.get(s.context) ?? []; a.push(s); m.set(s.context, a); } return [...m.entries()]; }, []);
useEffect(() => { if (!open) return; const h = (e: KeyboardEvent): void => { if (e.key === ESC) onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
if (!open) return null;
return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-sans" onClick={onClose}>
<div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-[#15161a] border border-white/10 p-5 animate-rise" onClick={(e: ReactMouseEvent<HTMLDivElement>) => e.stopPropagation()}>
<div className="flex items-center justify-between mb-4"><div className="text-[13px] font-semibold text-zinc-100">Горячие клавиши</div>
<button type="button" onClick={onClose} className="btn-ghost"><XIcon size={13} /></button></div>
<div className="space-y-4">
{grouped.map(([ctx, items]) => (
<div key={ctx}><div className="ui-label mb-1.5">{ctx}</div><div className="space-y-1">
{items.map((s) => <div key={`${ctx}-${s.keys}-${s.action}`} className="flex items-center justify-between gap-3 text-[12px]"><span className="text-zinc-300">{s.action}</span><kbd className="font-mono text-[11px] bg-[#1e2025] border border-white/10 rounded px-1.5 py-0.5 text-zinc-200 whitespace-nowrap">{s.keys}</kbd></div>)}
</div></div>))}
</div>
<button type="button" onClick={onClose} className="btn-secondary w-full mt-4">Закрыть</button>
</div>
</div>
);
};