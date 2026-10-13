import type { FC } from 'react';
import type { LengthPanelProps, LengthCandidate } from '../types';
import { getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { cn } from '../utils/cn';

const HIGH_MATCH_RATE = 95;

const MODE_LABELS: Record<LengthCandidate['mode'], string> = {
  total: '== len',
  remaining: '== tail',
};

const MODE_TITLES: Record<LengthCandidate['mode'], string> = {
  total: 'Значение равно длине пакета',
  remaining: 'Значение равно хвосту после поля',
};

export const LengthPanel: FC<LengthPanelProps> = ({ candidates, rules, onCreate, onPreviewRange }) => {
  if (candidates.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          Детектор длины
        </div>
        <div className="text-[11px] text-slate-600 leading-relaxed">
          Кандидатов нет. Нужно ≥3 пакетов с полем длины в первых 64 байтах.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
        Детектор длины ({candidates.length})
      </div>
      <div className="space-y-1.5">
        {candidates.map((c) => {
          const range = { start: c.offset, end: c.offset + c.length - 1 };
          const isCovered = getOverlappingRules(rules, range).length > 0;
          return (
            <div
              key={c.id}
              className={cn(
                'rounded-md border px-2.5 py-2',
                isCovered ? 'border-slate-800 bg-slate-900/50 opacity-70' : 'border-slate-800 bg-slate-950'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-emerald-300">
                  {formatHexAddress(c.offset)} +{c.length}
                </span>
                <span className="font-mono text-[10px] text-slate-500 border border-slate-800 rounded px-1">
                  {c.dataType}
                </span>
                <span title={MODE_TITLES[c.mode]} className="font-mono text-[10px] text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 rounded px-1">
                  {MODE_LABELS[c.mode]}
                </span>
                {isCovered && <span className="text-[10px] text-emerald-300 ml-auto">✓ covered</span>}
              </div>
              <div className="mt-1.5 h-1.5 rounded bg-slate-800 overflow-hidden" title={`${c.matchedCount}/${c.totalChecked} совпало`}>
                <div
                  className={cn('h-full rounded', c.matchRate >= HIGH_MATCH_RATE ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${c.matchRate}%` }}
                />
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                <span className="text-slate-200">{c.matchRate}%</span>
                {' • '}
                val: <span className="text-slate-300">{c.sampleValue}</span>
                {' • '}
                {c.matchedCount}/{c.totalChecked}
              </div>
              {!isCovered && (
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewRange(range)}
                    className="flex-1 py-1 text-[11px] rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 cursor-pointer"
                  >
                    Выделить
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreate(c)}
                    className="flex-1 py-1 text-[11px] rounded bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-100 cursor-pointer"
                  >
                    + Создать
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};