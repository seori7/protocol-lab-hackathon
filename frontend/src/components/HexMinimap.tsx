import type { FC } from 'react';
import type { HexMinimapProps } from '../types';
import { formatHexAddress, getRuleColor } from '../utils/hex';
import { cn } from '../utils/cn';

const PERCENT_MULTIPLIER = 100;

export const HexMinimap: FC<HexMinimapProps> = ({
  stats, selectionRange, hoveredRuleId, selectedRuleId, onSelectRange, onHoverRule,
}) => {
  const total = stats.totalBytes;
  if (total === 0) {
    return <div className="text-[10px] text-slate-600 text-center">—</div>;
  }

  const selTop = selectionRange ? (selectionRange.start / total) * PERCENT_MULTIPLIER : 0;
  const selHeight = selectionRange
    ? ((selectionRange.end - selectionRange.start + 1) / total) * PERCENT_MULTIPLIER
    : 0;

  return (
    <div className="relative h-full w-full rounded overflow-hidden bg-slate-800 border border-slate-700 flex flex-col">
      {stats.segments.map((seg) => {
        const height = ((seg.end - seg.start + 1) / total) * PERCENT_MULTIPLIER;
        const len = seg.end - seg.start + 1;
        if (seg.rule === null) {
          return (
            <div
              key={`m-gap-${seg.start}`}
              role="button"
              tabIndex={0}
              title={`Gap ${formatHexAddress(seg.start)} +${len}`}
              onClick={() => onSelectRange({ start: seg.start, end: seg.end })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: seg.start, end: seg.end }); }}
              style={{ height: `${height}%` }}
              className="w-full min-h-[2px] bg-slate-700/40 hover:bg-slate-600 cursor-pointer border-b border-slate-900/50"
            />
          );
        }
        const theme = getRuleColor(seg.rule.colorIndex);
        const isActive = seg.rule.id === hoveredRuleId || seg.rule.id === selectedRuleId;
        return (
          <div
            key={`m-seg-${seg.start}-${seg.rule.id}`}
            role="button"
            tabIndex={0}
            title={`${seg.rule.name} ${formatHexAddress(seg.start)} +${len}`}
            onClick={() => onSelectRange({ start: seg.start, end: seg.end })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: seg.start, end: seg.end }); }}
            onMouseEnter={() => onHoverRule(seg.rule?.id ?? null)}
            onMouseLeave={() => onHoverRule(null)}
            style={{ height: `${height}%` }}
            className={cn(
              'w-full min-h-[2px] cursor-pointer border-b border-slate-900/50',
              isActive ? theme.byteBackgroundActive : theme.byteBackground
            )}
          />
        );
      })}
      {selectionRange && (
        <div
          className="absolute left-0 right-0 bg-blue-500/30 border-y border-blue-400/80 pointer-events-none"
          style={{ top: `${selTop}%`, height: `${selHeight}%` }}
        />
      )}
    </div>
  );
};