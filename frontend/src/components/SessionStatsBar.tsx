import { useMemo, type FC } from 'react';
import type { SessionStatsBarProps } from '../types';
import { buildSessionSummary } from '../utils/sessionStats';

export const SessionStatsBar: FC<SessionStatsBarProps> = ({ packets, totalCount, rules }) => {
  const summary = useMemo(
    () => buildSessionSummary(packets, rules),
    [packets, rules]
  );

  if (summary.packetCount === 0 && totalCount === 0) {
    return null;
  }

  const isFiltered = summary.packetCount !== totalCount;

  return (
    <div className="shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-950/50 text-[11px] font-mono text-slate-500 space-y-0.5">
      <div title="Пакеты в виде / всего • байты • средний (мин–макс)">
        <span className="text-slate-300">{summary.packetCount}{isFiltered ? `/${totalCount}` : ''}</span>
        {' pkts • '}
        <span className="text-slate-300">{summary.totalBytes} B</span>
        {' • avg '}
        <span className="text-slate-300">{summary.avgLength}</span>
        {summary.packetCount > 0 && ` (${summary.minLength}–${summary.maxLength})`}
      </div>
      <div title="Направления и среднее покрытие правилами">
        <span className="text-emerald-400/80">C→S {summary.clientCount}</span>
        {' • '}
        <span className="text-violet-400/80">S→C {summary.serverCount}</span>
        {' • '}
        {summary.avgCoveragePercent === null ? (
          <span className="text-slate-600">без правил</span>
        ) : (
          <span className="text-emerald-300">~{summary.avgCoveragePercent}% покр.</span>
        )}
      </div>
    </div>
  );
};