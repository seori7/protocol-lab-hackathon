import { useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { DataInspectorProps, RuleDataType } from '../types';
import { buildDataInspectorRows, buildDefaultInspectorName } from '../utils/dataInspector';
import { getPayloadByteLength, getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { AlertIcon } from './icons';
import { cn } from '../utils/cn';
export const DataInspector: FC<DataInspectorProps> = ({ selectedRange, payloadHex, rules, draftName, draftAnchor, draftOffset, selectedLength, activeType, onPickType, onCreateRule }) => {
const rows = useMemo(() => buildDataInspectorRows(selectedRange, payloadHex), [selectedRange, payloadHex]);
const total = useMemo(() => getPayloadByteLength(payloadHex), [payloadHex]);
const overlap = useMemo(() => !selectedRange ? [] : getOverlappingRules(rules, selectedRange, undefined, total).map((r) => r.name), [rules, selectedRange, total]);
if (!selectedRange || !rows.length) return null;
const quick = (e: ReactMouseEvent<HTMLButtonElement>, dt: RuleDataType): void => { e.stopPropagation();
onCreateRule({ name: draftName.length ? draftName : buildDefaultInspectorName(dt, selectedRange.start), data_type: dt, offset: draftOffset, length: selectedLength, anchor: draftAnchor }); };
const okCount = rows.filter((r) => r.isApplicable).length;
return (
<div className="rounded-lg border border-white/[0.07] bg-[#121316] overflow-hidden font-sans animate-rise">
<div className="px-3 py-2 border-b border-white/[0.07] flex items-center justify-between">
<div className="text-[12px] font-medium text-zinc-200">Data Inspector <span className="font-mono text-zinc-500 font-normal">{formatHexAddress(selectedRange.start)} +{selectedLength}</span></div>
<div className="text-[11px] font-mono text-zinc-500">{okCount}/{rows.length}</div>
</div>
{overlap.length > 0 && <div className="px-3 py-1.5 text-[11px] text-amber-200/90 border-b border-white/[0.07] inline-flex items-center gap-1.5"><AlertIcon size={12} />{overlap.join(', ')}</div>}
<div className="max-h-64 overflow-y-auto divide-y divide-white/[0.05]">
{rows.map((r) => { const act = r.dataType === activeType; return (
<div key={r.dataType} role="button" tabIndex={0} title={r.isApplicable ? `${r.hint} — клик в форму` : (r.applicabilityReason ?? '')}
onClick={() => onPickType(r.dataType)} onKeyDown={(e) => { if (e.key === 'Enter') onPickType(r.dataType); }}
className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer transition-colors', act ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]', !r.isApplicable && 'opacity-50')}>
<span className={cn('w-1.5 h-1.5 rounded-full shrink-0', r.isApplicable ? 'bg-emerald-400/80' : 'bg-zinc-700')} />
<span className="font-mono text-[11px] text-zinc-400 w-20 shrink-0 truncate">{r.label}</span>
<span className={cn('font-mono text-[12px] truncate flex-1', r.isApplicable ? 'text-zinc-100' : 'text-zinc-600')}>{r.isApplicable ? r.value : (r.applicabilityReason ?? '—')}</span>
<button type="button" onClick={(e) => quick(e, r.dataType)} disabled={!r.isApplicable} title="Создать правило"
className="h-6 px-2 text-[11px] rounded border shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white/[0.05] text-zinc-200 border-white/10 hover:bg-[#f4f4f5] hover:text-[#1818b] hover:border-transparent hover:-translate-y-px cursor-pointer">Добавить</button>
</div>
); })}
</div>
<div className="px-3 py-1.5 border-t border-white/[0.07] text-[10px] text-zinc-600">Клик — в форму · Добавить — создать сразу</div>
</div>
);
};