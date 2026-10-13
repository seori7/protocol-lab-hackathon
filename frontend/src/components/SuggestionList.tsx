import { useMemo, type FC } from 'react';
import type { SuggestionListProps } from '../types';
import { SUGGESTION_PREVIEW_MAX_BYTES } from '../constants/analysis';
import { getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { CheckIcon } from './icons';
import { cn } from '../utils/cn';
export const SuggestionList: FC<SuggestionListProps> = ({ suggestions, rules, onCreateOne, onCreateAll, onPreviewRange }) => {
const creatable = useMemo(() => suggestions.filter((s) => getOverlappingRules(rules, { start: s.offset, end: s.offset + s.length - 1 }).length === 0).length, [suggestions, rules]);
if (!suggestions.length) return <div className="px-4 py-3 font-sans"><div className="ui-label mb-1">Автопредложения</div><div className="text-[11px] text-zinc-600">Нет константных участков. Нужно минимум 2 пакета.</div></div>;
return (
<div className="px-4 py-3 font-sans">
<div className="flex items-center justify-between mb-2"><div className="ui-label">Автопредложения ({suggestions.length})</div>
<button type="button" onClick={onCreateAll} disabled={!creatable} className="btn-secondary !h-7 !text-[11px] disabled:opacity-40">Создать все ({creatable})</button></div>
<div className="space-y-1.5">
{suggestions.map((s) => {
const rg = { start: s.offset, end: s.offset + s.length - 1 };
const covered = getOverlappingRules(rules, rg).length > 0;
const prev = s.sampleHex.split(' ').slice(0, SUGGESTION_PREVIEW_MAX_BYTES).join(' ');
return (
<div key={s.id} className={cn('rounded-md border px-2.5 py-2 transition-all', covered ? 'border-white/[0.07] bg-[#121316] opacity-60' : 'border-white/[0.07] bg-[#121316] hover:border-white/[0.14]')}>
<div className="flex items-center gap-2"><span className="font-mono text-[11px] text-zinc-100">{formatHexAddress(s.offset)} +{s.length}</span>
<span className="font-mono text-[10px] text-zinc-400 border border-white/10 rounded px-1 bg-white/[0.03]">{s.suggestedType}</span>
{covered && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200/80 ml-auto"><CheckIcon size={11} />covered</span>}</div>
<div title={s.sampleHex} className="font-mono text-[11px] text-zinc-500 truncate mt-1">{prev}{s.length > SUGGESTION_PREVIEW_MAX_BYTES ? ' ...' : ''}</div>
<div className="font-mono text-[11px] text-zinc-600 truncate">val: <span className="text-zinc-300">{s.sampleValue}</span> · {s.reason}</div>
{!covered && <div className="flex gap-1.5 mt-1.5">
<button type="button" onClick={() => onPreviewRange(rg)} className="btn-secondary flex-1 !h-7 !text-[11px]">Выделить</button>
<button type="button" onClick={() => onCreateOne(s)} className="btn-primary flex-1 !h-7 !text-[11px]">Создать</button>
</div>}
</div>
); })}
</div>
</div>
);
};