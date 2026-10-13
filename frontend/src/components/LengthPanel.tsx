import type { FC } from 'react';
import type { LengthPanelProps, LengthCandidate } from '../types';
import { getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { CheckIcon } from './icons';
import { cn } from '../utils/cn';
const HIGH = 95;
const LABELS: Record<LengthCandidate['mode'], string> = { total: '== len', remaining: '== tail' };
export const LengthPanel: FC<LengthPanelProps> = ({ candidates, rules, onCreate, onPreviewRange }) => {
if (!candidates.length) return <div className="px-4 py-3 font-sans"><div className="ui-label mb-1">Детектор длины</div><div className="text-[11px] text-zinc-600">Кандидатов нет. Нужно минимум 3 пакета.</div></div>;
return (
<div className="px-4 py-3 font-sans">
<div className="ui-label mb-2">Детектор длины ({candidates.length})</div>
<div className="space-y-1.5">
{candidates.map((c) => {
const rg = { start: c.offset, end: c.offset + c.length - 1 };
const covered = getOverlappingRules(rules, rg).length > 0;
return (
<div key={c.id} className={cn('rounded-md border px-2.5 py-2', covered ? 'border-white/[0.07] bg-[#121316] opacity-60' : 'border-white/[0.07] bg-[#121316] hover:border-white/[0.14] transition-all')}>
<div className="flex items-center gap-2"><span className="font-mono text-[11px] text-zinc-100">{formatHexAddress(c.offset)} +{c.length}</span>
<span className="font-mono text-[10px] text-zinc-400 border border-white/10 rounded px-1 bg-white/[0.03]">{c.dataType}</span>
<span className="font-mono text-[10px] text-zinc-300 border border-white/10 rounded px-1 bg-white/[0.05]">{LABELS[c.mode]}</span>
{covered && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200/80 ml-auto"><CheckIcon size={11} />covered</span>}</div>
<div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" title={`${c.matchedCount}/${c.totalChecked}`}>
<div className={cn('h-full rounded-full transition-all', c.matchRate >= HIGH ? 'bg-[#c9ccd1]' : 'bg-zinc-600')} style={{ width: `${c.matchRate}%` }} /></div>
<div className="mt-1 font-mono text-[11px] text-zinc-500"><span className="text-zinc-200">{c.matchRate}%</span> · val: <span className="text-zinc-300">{c.sampleValue}</span> · {c.matchedCount}/{c.totalChecked}</div>
{!covered && <div className="flex gap-1.5 mt-1.5">
<button type="button" onClick={() => onPreviewRange(rg)} className="btn-secondary flex-1 !h-7 !text-[11px]">Выделить</button>
<button type="button" onClick={() => onCreate(c)} className="btn-primary flex-1 !h-7 !text-[11px]">Создать</button>
</div>}
</div>
); })}
</div>
</div>
);
};