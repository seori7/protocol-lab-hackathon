import { useMemo, type FC } from 'react';
import type { SuggestionListProps } from '../types';
import { SUGGESTION_PREVIEW_MAX_BYTES } from '../constants/analysis';
import { getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { cn } from '../utils/cn';

const HEX_BYTE_SEPARATOR = ' ';

export const SuggestionList: FC<SuggestionListProps> = ({
  suggestions, rules, onCreateOne, onCreateAll, onPreviewRange,
}) => {
  const creatableCount = useMemo(() => {
    let count = 0;
    for (const s of suggestions) {
      const overlapped = getOverlappingRules(rules, { start: s.offset, end: s.offset + s.length - 1 });
      if (overlapped.length === 0) count += 1;
    }
    return count;
  }, [suggestions, rules]);

  if (suggestions.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          Автопредложения
        </div>
        <div className="text-[11px] text-slate-600 leading-relaxed">
          Нет константных участков. Нужно ≥2 пакетов с общим префиксом.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Автопредложения ({suggestions.length})
        </div>
        <button
          type="button"
          onClick={onCreateAll}
          disabled={creatableCount === 0}
          title={creatableCount === 0 ? 'Всё уже покрыто правилами' : `Создать ${creatableCount} правил`}
          className={cn(
            'text-[11px] font-medium px-2 py-1 rounded border transition-colors',
            creatableCount > 0
              ? 'bg-violet-600/15 text-violet-200 border-violet-500/30 hover:bg-violet-600/25 cursor-pointer'
              : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
          )}
        >
          Создать все ({creatableCount})
        </button>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => {
          const range = { start: s.offset, end: s.offset + s.length - 1 };
          const overlapped = getOverlappingRules(rules, range);
          const isCovered = overlapped.length > 0;
          const previewBytes = s.sampleHex.split(HEX_BYTE_SEPARATOR).slice(0, SUGGESTION_PREVIEW_MAX_BYTES);
          const previewText = previewBytes.join(HEX_BYTE_SEPARATOR);
          const isTruncated = s.length > SUGGESTION_PREVIEW_MAX_BYTES;

          return (
            <div
              key={s.id}
              className={cn(
                'rounded-md border px-2.5 py-2',
                isCovered ? 'border-slate-800 bg-slate-900/50 opacity-70' : 'border-slate-800 bg-slate-950'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-violet-300">
                  {formatHexAddress(s.offset)} +{s.length}
                </span>
                <span className="font-mono text-[10px] text-slate-500 border border-slate-800 rounded px-1">
                  {s.suggestedType}
                </span>
                {isCovered && (
                  <span title={overlapped.map((r) => r.name).join(', ')} className="text-[10px] text-emerald-300 ml-auto">
                    ✓ covered
                  </span>
                )}
              </div>
              <div title={s.sampleHex} className="font-mono text-[11px] text-slate-400 truncate mt-1">
                {previewText}{isTruncated ? ' ...' : ''}
              </div>
              <div title={s.sampleValue} className="font-mono text-[11px] text-slate-500 truncate">
                val: <span className="text-slate-300">{s.sampleValue}</span>
                <span className="text-slate-600"> • {s.reason}</span>
              </div>
              {!isCovered && (
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewRange(range)}
                    title="Выделить в HexViewer"
                    className="flex-1 py-1 text-[11px] rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 cursor-pointer"
                  >
                    Выделить
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateOne(s)}
                    title={`Создать "${s.suggestedName}"`}
                    className="flex-1 py-1 text-[11px] rounded bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 text-violet-100 cursor-pointer"
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