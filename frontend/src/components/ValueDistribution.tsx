import { useMemo, type FC } from 'react';
import type { ValueDistributionProps } from '../types';
import { buildValueDistribution } from '../utils/structure';
import { getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';

export const ValueDistribution: FC<ValueDistributionProps> = ({
  rule, packets, selectedPacketId, maxEntries, onSelectPacket,
}) => {
  const theme = getRuleColor(rule.colorIndex);

  const entries = useMemo(
    () => buildValueDistribution(rule, packets, maxEntries),
    [rule, packets, maxEntries]
  );

  if (entries.length === 0) {
    return <div className="text-xs text-slate-600">Нет применимых пакетов для гистограммы</div>;
  }

  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
        Распределение (топ {entries.length})
      </div>
      <div className="space-y-1">
        {entries.map((entry) => {
          const isActive = selectedPacketId !== null && entry.packetIds.includes(selectedPacketId);
          const firstPacketId = entry.packetIds[0] ?? null;
          return (
            <button
              key={`${entry.value}-${entry.hexText}`}
              type="button"
              title={`${entry.hexText} • пакетов: ${entry.count} • клик — перейти`}
              onClick={() => {
                if (firstPacketId === null) return;
                const pkt = packets.find((p) => p.id === firstPacketId);
                if (pkt) onSelectPacket(pkt);
              }}
              className={cn(
                'w-full text-left rounded-md border px-2 py-1.5 transition-colors cursor-pointer',
                isActive
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-100 truncate flex-1">{entry.value}</span>
                <span className="font-mono text-slate-500 shrink-0">×{entry.count}</span>
                <span className="font-mono text-slate-400 w-9 text-right shrink-0">{entry.percent}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-800 overflow-hidden">
                <div className={cn('h-full rounded', theme.dotBackground)} style={{ width: `${entry.percent}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};