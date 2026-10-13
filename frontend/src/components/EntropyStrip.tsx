import { useMemo, type FC } from 'react';
import type { EntropyStripProps } from '../types';
import { MAX_ENTROPY_COLUMNS } from '../constants/project';
import { CHANGEPOINT_SELECT_RADIUS } from '../constants/anchor';
import { getEntropyHeatColor, getAverageEntropy, countConstantColumns } from '../utils/entropy';
import { detectChangepoints } from '../utils/changepoint';
import { formatHexAddress } from '../utils/hex';

const PERCENT_MULTIPLIER = 100;
const ENTROPY_FRACTION_DIGITS = 2;

interface EntropyBucket {
  start: number;
  end: number;
  avgEntropy: number;
  maxDistinct: number;
  minSample: number;
}

export const EntropyStrip: FC<EntropyStripProps> = ({ entropy, selectionRange, onSelectRange }) => {
  const buckets: EntropyBucket[] = useMemo(() => {
    const cols = entropy.columns;
    if (cols.length === 0) return [];
    if (cols.length <= MAX_ENTROPY_COLUMNS) {
      return cols.map((c) => ({ start: c.offset, end: c.offset, avgEntropy: c.entropy, maxDistinct: c.distinctCount, minSample: c.sampleCount }));
    }
    const bucketSize = Math.ceil(cols.length / MAX_ENTROPY_COLUMNS);
    const result: EntropyBucket[] = [];
    for (let i = 0; i < cols.length; i += bucketSize) {
      const slice = cols.slice(i, i + bucketSize);
      const first = slice[0]!;
      const last = slice[slice.length - 1]!;
      let sum = 0;
      let maxDistinct = 0;
      let minSample = Number.MAX_SAFE_INTEGER;
      for (const c of slice) {
        sum += c.entropy;
        if (c.distinctCount > maxDistinct) maxDistinct = c.distinctCount;
        if (c.sampleCount < minSample) minSample = c.sampleCount;
      }
      result.push({ start: first.offset, end: last.offset, avgEntropy: sum / slice.length, maxDistinct, minSample });
    }
    return result;
  }, [entropy]);

  const changepoints = useMemo(() => detectChangepoints(entropy), [entropy]);
  const avgEntropy = useMemo(() => getAverageEntropy(entropy), [entropy]);
  const constantCount = useMemo(() => countConstantColumns(entropy), [entropy]);

  const total = entropy.maxLength;
  if (total === 0 || buckets.length === 0) {
    return <div className="text-[11px] text-slate-600">Нет данных для энтропии</div>;
  }

  const selLeft = selectionRange ? (selectionRange.start / total) * PERCENT_MULTIPLIER : 0;
  const selWidth = selectionRange ? ((selectionRange.end - selectionRange.start + 1) / total) * PERCENT_MULTIPLIER : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-slate-500">
          Энтропия <span className="font-mono text-slate-300">avg {avgEntropy.toFixed(ENTROPY_FRACTION_DIGITS)}</span>
          <span className="text-slate-600"> • </span>
          <span className="font-mono">const {constantCount}/{total}</span>
          {changepoints.length > 0 && (
            <>
              <span className="text-slate-600"> • </span>
              <span className="font-mono text-white/80">◇ {changepoints.length} границ</span>
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-600">клик по маркеру — выделить границу</div>
      </div>
      <div className="relative h-3 rounded overflow-visible bg-slate-800 border border-slate-700 flex">
        {buckets.map((b) => {
          const width = ((b.end - b.start + 1) / total) * PERCENT_MULTIPLIER;
          const isSingle = b.start === b.end;
          const title = isSingle
            ? `${formatHexAddress(b.start)} • H=${b.avgEntropy.toFixed(ENTROPY_FRACTION_DIGITS)} • distinct ${b.maxDistinct}/${b.minSample}`
            : `${formatHexAddress(b.start)}–${formatHexAddress(b.end)} • H~${b.avgEntropy.toFixed(ENTROPY_FRACTION_DIGITS)}`;
          return (
            <div
              key={`${b.start}-${b.end}`}
              role="button"
              tabIndex={0}
              title={title}
              onClick={() => onSelectRange({ start: b.start, end: b.end })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: b.start, end: b.end }); }}
              style={{ width: `${width}%`, backgroundColor: getEntropyHeatColor(b.avgEntropy) }}
              className="h-full min-w-[2px] cursor-pointer border-r border-slate-900/40 hover:brightness-125"
            />
          );
        })}
        {selectionRange && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500/30 border-x border-blue-400/80 pointer-events-none"
            style={{ left: `${selLeft}%`, width: `${selWidth}%` }}
          />
        )}
        {changepoints.map((cp) => {
          const left = (cp.offset / total) * PERCENT_MULTIPLIER;
          return (
            <button
              key={`cp-${cp.offset}`}
              type="button"
              title={`${formatHexAddress(cp.offset)} • H ${cp.leftAvg.toFixed(2)}→${cp.rightAvg.toFixed(2)} • клик выделит границу`}
              onClick={(e) => {
                e.stopPropagation();
                const start = Math.max(0, cp.offset - CHANGEPOINT_SELECT_RADIUS);
                const end = Math.min(total - 1, cp.offset + CHANGEPOINT_SELECT_RADIUS - 1);
                onSelectRange({ start, end });
              }}
              style={{ left: `${left}%` }}
              className="absolute -top-[3px] -bottom-[3px] w-[2px] -ml-[1px] bg-white/90 hover:bg-white hover:w-[3px] cursor-pointer z-10 rounded"
            />
          );
        })}
      </div>
    </div>
  );
};