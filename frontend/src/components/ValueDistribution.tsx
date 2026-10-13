import { useMemo, type FC } from 'react';
import type { ValueDistributionProps } from '../types';
import { buildValueDistribution } from '../utils/structure';
import { getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';
export const ValueDistribution: FC<ValueDistributionProps> = ({ rule, packets, selectedPacketId, maxEntries, onSelectPacket }) => {
const theme = getRuleColor(rule.colorIndex);
const entries = useMemo(() => buildValueDistribution(rule, packets, maxEntries), [rule, packets, maxEntries]);
if (!entries.length) return <div className="text-[12px] text-zinc-600 font-sans">Нет применимых пакетов</div>;
return (
<div className="font-sans">
<div className="ui-label mb-1.5">Распределение · топ {entries.length}</div>
<div className="space-y-1">
{entries.map((e) => { const act = selectedPacketId !== null && e.packetIds.includes(selectedPacketId); const first = e.packetIds[0] ?? null; return (
<button key={`${e.value}-${e.hexText}`} type="button" title={`${e.hexText} · пакетов: ${e.count}`} onClick={() => { if (first === null) return; const p = packets.find((x) => x.id === first); if (p) onSelectPacket(p); }}
className={cn('w-full text-left rounded-md border px-2 py-1.5 transition-all cursor-pointer hover:-translate-y-px',
act ? 'border-white/25 bg-white/[0.06]' : 'border-white/[0.07] bg-[#121316] hover:border-white/[0.14]')}>
<div className="flex items-center gap-2 text-[12px]"><span className="font-mono text-zinc-100 truncate flex-1">{e.value}</span>
<span className="font-mono text-zinc-500 shrink-0">×{e.count}</span><span className="font-mono text-zinc-400 w-9 text-right shrink-0">{e.percent}%</span></div>
<div className="mt-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={cn('h-full rounded-full', theme.dotBackground)} style={{ width: `${e.percent}%` }} /></div>
</button>); })}
</div>
</div>
);
};