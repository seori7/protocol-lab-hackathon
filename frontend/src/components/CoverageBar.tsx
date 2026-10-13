import type { FC } from 'react';
import type { CoverageBarProps } from '../types';
import { formatHexAddress, getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';
const P = 100;
export const CoverageBar: FC<CoverageBarProps> = ({ stats, selectionRange, hoveredRuleId, selectedRuleId, onSelectRange, onHoverRule }) => {
const t = stats.totalBytes;
if (!t) return <div className="text-[11px] text-zinc-600 font-sans">Нет данных для карты</div>;
const left = selectionRange ? (selectionRange.start / t) * P : 0;
const w = selectionRange ? ((selectionRange.end - selectionRange.start + 1) / t) * P : 0;
return (
<div className="font-sans">
<div className="flex items-center justify-between mb-1.5">
<div className="text-[11px] text-zinc-500">Покрытие <span className="text-zinc-100 font-mono font-medium">{stats.coveragePercent}%</span> <span className="text-zinc-600">·</span> <span className="font-mono">{stats.coveredBytes}/{t}</span> <span className="text-zinc-600">·</span> <span className="font-mono">{stats.gapCount} гэпов</span></div>
<div className="text-[10px] text-zinc-600">клик — выделить</div>
</div>
<div className="relative h-4 rounded-md overflow-hidden bg-[#1e2025] border border-white/[0.07] flex">
{stats.segments.map((s) => { const wd = ((s.end - s.start + 1) / t) * P; const len = s.end - s.start + 1;
if (!s.rule) return <div key={`g-${s.start}`} role="button" tabIndex={0} title={`Gap ${formatHexAddress(s.start)} +${len}`} onClick={() => onSelectRange({ start: s.start, end: s.end })} onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: s.start, end: s.end }); }} style={{ width: `${wd}%` }} className="h-full min-w-[2px] bg-[#2a2d33] hover:bg-[#3a3e45] cursor-pointer border-r border-black/40 transition-colors" />;
const th = getRuleColor(s.rule.colorIndex); const act = s.rule.id === hoveredRuleId || s.rule.id === selectedRuleId;
return <div key={`s-${s.start}-${s.rule.id}`} role="button" tabIndex={0} title={`${s.rule.name} ${formatHexAddress(s.start)} +${len}`} onClick={() => onSelectRange({ start: s.start, end: s.end })} onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: s.start, end: s.end }); }} onMouseEnter={() => onHoverRule(s.rule?.id ?? null)} onMouseLeave={() => onHoverRule(null)} style={{ width: `${wd}%` }}
className={cn('h-full min-w-[2px] cursor-pointer border-r border-black/40 transition-all', act ? th.byteBackgroundActive : th.byteBackground, s.rule.id === selectedRuleId && 'ring-1 ring-inset ring-white/60')} />; })}
{selectionRange && <div className="absolute top-0 bottom-0 bg-white/15 border-x border-white/50 pointer-events-none" style={{ left: `${left}%`, width: `${w}%` }} />}
</div>
</div>
);
};