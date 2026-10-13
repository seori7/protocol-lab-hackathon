import type { FC } from 'react';
import type { CoverageBarProps } from '../types';
import { formatHexAddress, getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';

const PERCENT_MULTIPLIER = 100;

export const CoverageBar: FC<CoverageBarProps> = ({
  stats, selectionRange, hoveredRuleId, selectedRuleId, onSelectRange, onHoverRule,
}) => {
  const total = stats.totalBytes;
  if (total === 0) {
    return <div className="text-[11px] text-slate-600">Нет данных для карты</div>;
  }

  const selLeft = selectionRange ? (selectionRange.start / total) * PERCENT_MULTIPLIER : 0;
  const selWidth = selectionRange
    ? ((selectionRange.end - selectionRange.start + 1) / total) * PERCENT_MULTIPLIER
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-slate-500">
          Покрытие <span className="text-emerald-300 font-mono font-semibold">{stats.coveragePercent}%</span>
          <span className="text-slate-600"> • </span>
          <span className="font-mono">{stats.coveredBytes}/{total}</span>
          <span className="text-slate-600"> • </span>
          <span className="font-mono">{stats.gapCount} гэпов</span>
        </div>
        <div className="text-[10px] text-slate-600">клик по карте — выделить</div>
      </div>
      <div className="relative h-4 rounded overflow-hidden bg-slate-800 border border-slate-700 flex">
        {stats.segments.map((seg) => {
          const width = ((seg.end - seg.start + 1) / total) * PERCENT_MULTIPLIER;
          const len = seg.end - seg.start + 1;
          if (seg.rule === null) {
            return (
              <div
                key={`gap-${seg.start}`}
                role="button"
                tabIndex={0}
                title={`Gap ${formatHexAddress(seg.start)} +${len} — клик выделит`}
                onClick={() => onSelectRange({ start: seg.start, end: seg.end })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelectRange({ start: seg.start, end: seg.end });
                }}
                style={{ width: `${width}%` }}
                className="h-full min-w-[2px] bg-slate-700/50 hover:bg-slate-600 cursor-pointer border-r border-slate-900/50"
              />
            );
          }
          const theme = getRuleColor(seg.rule.colorIndex);
          const isHovered = seg.rule.id === hoveredRuleId;
          const isSelected = seg.rule.id === selectedRuleId;
          return (
            <div
              key={`seg-${seg.start}-${seg.rule.id}`}
              role="button"
              tabIndex={0}
              title={`${seg.rule.name} [${seg.rule.data_type}] ${formatHexAddress(seg.start)} +${len}`}
              onClick={() => onSelectRange({ start: seg.start, end: seg.end })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelectRange({ start: seg.start, end: seg.end });
              }}
              onMouseEnter={() => onHoverRule(seg.rule?.id ?? null)}
              onMouseLeave={() => onHoverRule(null)}
              style={{ width: `${width}%` }}
              className={cn(
                'h-full min-w-[2px] cursor-pointer border-r border-slate-900/50',
                isHovered || isSelected ? theme.byteBackgroundActive : theme.byteBackground,
                isSelected && 'ring-1 ring-inset ring-white/60'
              )}
            />
          );
        })}
        {selectionRange && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500/30 border-x border-blue-400/80 pointer-events-none"
            style={{ left: `${selLeft}%`, width: `${selWidth}%` }}
          />
        )}
      </div>
    </div>
  );
};