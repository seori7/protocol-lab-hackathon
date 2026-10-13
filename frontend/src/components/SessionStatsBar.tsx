import { useMemo, type FC } from 'react';
import type { SessionStatsBarProps } from '../types';
import { buildSessionSummary } from '../utils/sessionStats';
export const SessionStatsBar: FC<SessionStatsBarProps> = ({ packets, totalCount, rules }) => {
const s = useMemo(() => buildSessionSummary(packets, rules), [packets, rules]);
if (!s.packetCount && !totalCount) return null;
const filt = s.packetCount !== totalCount;
return (
<div className="shrink-0 px-4 py-2 border-b border-white/[0.07] bg-[#121316] text-[11px] font-mono text-zinc-500 space-y-0.5 font-sans">
<div><span className="text-zinc-200">{s.packetCount}{filt ? `/${totalCount}` : ''}</span> pkts · <span className="text-zinc-200">{s.totalBytes} B</span> · avg <span className="text-zinc-200">{s.avgLength}</span>{s.packetCount > 0 && ` (${s.minLength}–${s.maxLength})`}</div>
<div><span className="text-emerald-200/70">C→S {s.clientCount}</span> · <span className="text-zinc-300">S→C {s.serverCount}</span> · {s.avgCoveragePercent === null ? <span className="text-zinc-600">без правил</span> : <span className="text-zinc-200">покрытие ~{s.avgCoveragePercent}%</span>}</div>
</div>
);
};