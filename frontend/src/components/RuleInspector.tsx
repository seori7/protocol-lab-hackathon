import { useState, useEffect, type FC, type ChangeEvent, type KeyboardEvent } from 'react';
import type { RuleInspectorProps, RuleDataType, RuleAnchor } from '../types';
import { DATA_TYPE_OPTIONS, RULE_NAME_MAX_LENGTH, RULE_NAME_MIN_TRIMMED_LENGTH } from '../constants/rules';
import { ANCHOR_OPTIONS } from '../constants/anchor';
import { formatHexAddress, getRuleColor, getRuleValueForPayload } from '../utils/hex';
import { getPayloadByteLength } from '../utils/rules';
import { resolveRuleStart, computeEndOffsetForRange, convertAnchorOffset } from '../utils/anchor';
import { XIcon, CopyIcon, TrashIcon, ArrowRightIcon } from './icons';
import { cn } from '../utils/cn';
const ADJ = 1;
export const RuleInspector: FC<RuleInspectorProps> = ({ rule, payloadHex, selectedRange, onUpdate, onResize, onClose, onDelete, onDuplicate }) => {
const theme = getRuleColor(rule.colorIndex); const [name, setName] = useState(rule.name);
useEffect(() => { setName(rule.name); }, [rule.id, rule.name]);
const total = getPayloadByteLength(payloadHex); const eff = resolveRuleStart(rule, totalBytesSafe(total));
const val = getRuleValueForPayload(payloadHex, rule);
function totalBytesSafe(t: number): number { return t; }
const selLen = selectedRange ? selectedRange.end - selectedRange.start + ADJ : 0;
const same = selectedRange !== null && (rule.anchor === 'start' ? selectedRange.start === rule.offset && selLen === rule.length : computeEndOffsetForRange(selectedRange.start, selLen, total) === rule.offset && selLen === rule.length);
const commit = (): void => { const t = name.trim(); if (t.length < RULE_NAME_MIN_TRIMMED_LENGTH || t === rule.name) { setName(rule.name); return; } onUpdate({ name: t }); };
const resizeLabel = selectedRange ? (rule.anchor === 'start' ? `${formatHexAddress(selectedRange.start)} +${selLen}` : `end-${formatHexAddress(computeEndOffsetForRange(selectedRange.start, selLen, total))} +${selLen}`) : '';
return (
<div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2.5 font-sans animate-rise">
<div className="flex items-center gap-2">
<span className={cn('w-2 h-2 rounded-full shrink-0', theme.dotBackground)} />
<span className="font-mono text-[11px] text-zinc-400">{rule.anchor === 'start' ? formatHexAddress(rule.offset) : `end-${formatHexAddress(rule.offset)}`} +{rule.length}</span>
<button type="button" onClick={onClose} className="btn-ghost !h-6 !px-1.5 ml-auto"><XIcon size={12} /></button>
</div>
<div className="flex rounded-md overflow-hidden border border-white/[0.08]">
{ANCHOR_OPTIONS.map((o) => <button key={o.value} type="button" disabled={eff === null}
onClick={() => { if (o.value === rule.anchor) return; const c = convertAnchorOffset(rule.offset, rule.anchor, o.value as RuleAnchor, rule.length, total); if (c !== null) onUpdate({ anchor: o.value, offset: c }); }}
title={o.hint} className={cn('flex-1 h-8 text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40',
rule.anchor === o.value ? 'bg-[#f4f4f5] text-[#18181b] font-semibold' : 'bg-[#1a1c20] text-zinc-400 hover:text-white')}>{o.label}</button>)}
</div>
<div className="font-mono text-[11px] text-zinc-500">{eff !== null ? `Эффективно: ${formatHexAddress(eff)} в текущем (${total} б)` : `Не помещается в текущий (${total} б)`}</div>
<input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} onBlur={commit}
onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} maxLength={RULE_NAME_MAX_LENGTH} className="field" />
<select value={rule.data_type} onChange={(e: ChangeEvent<HTMLSelectElement>) => onUpdate({ data_type: e.target.value as RuleDataType })} className="field cursor-pointer">
{DATA_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
</select>
<div className="rounded-md bg-[#0e0f11] border border-white/[0.07] px-2.5 py-2">
<div className="text-[11px] text-zinc-500 mb-0.5">Значение в текущем пакете</div>
<div className="font-mono text-[13px] text-zinc-100 break-all">{val}</div>
</div>
{selectedRange && !same && <button type="button" onClick={() => onResize(selectedRange)}
className="w-full h-8 rounded-md text-[12px] font-medium bg-amber-200/[0.08] text-amber-100/90 border border-amber-200/20 hover:bg-amber-200/[0.13] transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-[0.99]">
<ArrowRightIcon size={13} />Применить {resizeLabel}</button>}
<button type="button" onClick={onDuplicate} className="btn-secondary w-full"><CopyIcon size={13} />Дублировать</button>
<button type="button" onClick={onDelete} className="btn-danger w-full"><TrashIcon size={13} />Удалить</button>
</div>
);
};