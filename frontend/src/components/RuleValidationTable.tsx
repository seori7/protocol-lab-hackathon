import { useMemo, type FC } from 'react';
import type { RuleValidationTableProps } from '../types';
import { buildRuleValidationRows } from '../utils/rules';
import { cn } from '../utils/cn';
const TS = 3; const MAXR = 200;
export const RuleValidationTable: FC<RuleValidationTableProps> = ({ rule, packets, selectedPacketId, onSelectPacket }) => {
const rows = useMemo(() => buildRuleValidationRows(rule, packets), [rule, packets]);
const okCount = useMemo(() => rows.filter((r) => r.isApplicable).length, [rows]);
const distinct = useMemo(() => { const s = new Set<string>(); for (const r of rows) if (r.isApplicable) s.add(r.value); return s.size; }, [rows]);
const show = useMemo(() => rows.slice(0, MAXR), [rows]); const hid = rows.length - show.length;
if (!packets.length) return <div className="text-[12px] text-zinc-600 font-sans">Нет пакетов для проверки</div>;
return (
<div className="font-sans">
<div className="flex items-center justify-between mb-1.5"><div className="ui-label">Проверка на сессии</div>
<div className="text-[11px] font-mono text-zinc-500"><span className="text-zinc-100">{okCount}/{rows.length}</span> · уникальных {distinct}</div></div>
<div className="max-h-48 overflow-y-auto rounded-md border border-white/[0.07] bg-[#121316]">
<table className="w-full text-[12px]"><tbody className="divide-y divide-white/[0.05]">
{show.map((r) => { const sel = r.packetId === selectedPacketId; return (
<tr key={r.packetId} onClick={() => { const p = packets.find((x) => x.id === r.packetId); if (p) onSelectPacket(p); }} title={`${r.hexText} · ${r.timestamp.toFixed(TS)}`}
className={cn('cursor-pointer transition-colors', sel ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}>
<td className="px-2 py-1.5 font-mono text-zinc-500 w-10">#{r.packetId}</td>
<td className="px-2 py-1.5 font-mono truncate max-w-[120px]">{r.isApplicable ? <span className="text-zinc-100">{r.value}</span> : <span className="text-zinc-600">short</span>}</td>
<td className="px-2 py-1.5 font-mono text-zinc-600 truncate max-w-[100px] text-right">{r.hexText}</td>
</tr>); })}
</tbody></table>
</div>
{hid > 0 && <div className="text-[11px] text-zinc-600 mt-1">Показаны первые {MAXR} из {rows.length}</div>}
</div>
);
};