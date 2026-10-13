import type { FC } from 'react';
import type { HexMinimapProps } from '../types';
import { formatHexAddress, getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';
const P = 100;
export const HexMinimap: FC<HexMinimapProps> = ({ stats, selectionRange, hoveredRuleId, selectedRuleId, onSelectRange, onHoverRule }) => {
const t = stats.totalBytes;
if (!t) return <div className="text-[10px] text-zinc-600 text-center font-sans">—</div>;
const top = selectionRange ? (selectionRange.start / t) * P : 0;
const h = selectionRange ? ((selectionRange.end - selectionRange.start + 1) / t) * P : 0;
return (
<div className="relative h-full w-full rounded-md overflow-hidden bg-[#1e2025] border border-white/[0.07] flex flex-col">
{stats.segments.map((s) => { const hh = ((s.end - s.start + 1) / t) * P; const len = s.end - s.start + 1;
if (!s.rule) return <div key={`g-${s.start}`} role="button" tabIndex={0} title={`Gap ${formatHexAddress(s.start)} +${len}`} onClick={() => onSelectRange({ start: s.start, end: s.end })} onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: s.start, end: s.end }); }} style={{ height: `${hh}%` }} className="w-full min-h-[2px] bg-[#2a2d33] hover:bg-[#3a3e45] cursor-pointer border-b border-black/40 transition-colors" />;
const th = getRuleColor(s.rule.colorIndex); const act = s.rule.id === hoveredRuleId || s.rule.id === selectedRuleId;
return <div key={`s-${s.start}-${s.rule.id}`} role="button" tabIndex={0} title={`${s.rule.name} ${formatHexAddress(s.start)} +${len}`} onClick={() => onSelectRange({ start: s.start, end: s.end })} onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: s.start, end: s.end }); }} onMouseEnter={() => onHoverRule(s.rule?.id ?? null)} onMouseLeave={() => onHoverRule(null)} style={{ height: `${hh}%` }}
className={cn('w-full min-h-[2px] cursor-pointer border-b border-black/40 transition-all', act ? th.byteBackgroundActive : th.byteBackground)} />; })}
{selectionRange && <div className="absolute left-0 right-0 bg-white/15 border-y border-white/50 pointer-events-none" style={{ top: `${top}%`, height: `${h}%` }} />}
</div>
);
};