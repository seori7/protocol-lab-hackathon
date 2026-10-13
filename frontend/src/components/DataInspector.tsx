import { useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { DataInspectorProps, RuleDataType } from '../types';
import {
  buildDataInspectorRows, buildDefaultInspectorName,
} from '../utils/dataInspector';
import { getPayloadByteLength, getOverlappingRules } from '../utils/rules';
import { formatHexAddress } from '../utils/hex';
import { cn } from '../utils/cn';

const APPLICABLE_DOT = 'bg-emerald-400';
const INAPPLICABLE_DOT = 'bg-slate-700';

export const DataInspector: FC<DataInspectorProps> = ({
  selectedRange, payloadHex, rules,
  draftName, draftAnchor, draftOffset, selectedLength,
  activeType, onPickType, onCreateRule,
}) => {
  const rows = useMemo(
    () => buildDataInspectorRows(selectedRange, payloadHex),
    [selectedRange, payloadHex]
  );

  const totalBytes = useMemo(() => getPayloadByteLength(payloadHex), [payloadHex]);

  const overlappingNames = useMemo(() => {
    if (!selectedRange) return [];
    return getOverlappingRules(rules, selectedRange, undefined, totalBytes).map((r) => r.name);
  }, [rules, selectedRange, totalBytes]);

  if (!selectedRange || rows.length === 0) {
    return null;
  }

  const handlePick = (dataType: RuleDataType): void => {
    onPickType(dataType);
  };

  const handleQuickCreate = (e: ReactMouseEvent<HTMLButtonElement>, dataType: RuleDataType): void => {
    e.stopPropagation();
    const name = draftName.length > 0
      ? draftName
      : buildDefaultInspectorName(dataType, selectedRange.start);
    onCreateRule({
      name,
      data_type: dataType,
      offset: draftOffset,
      length: selectedLength,
      anchor: draftAnchor,
    });
  };

  const applicableCount = rows.filter((r) => r.isApplicable).length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="text-xs font-medium text-slate-300">
          Data Inspector{' '}
          <span className="font-mono text-slate-500">
            {formatHexAddress(selectedRange.start)} +{selectedLength}
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          {applicableCount}/{rows.length}
        </div>
      </div>
      {overlappingNames.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-amber-300 border-b border-slate-800">
          ⚠ {overlappingNames.join(', ')}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
        {rows.map((row) => {
          const isActive = row.dataType === activeType;
          return (
            <div
              key={row.dataType}
              role="button"
              tabIndex={0}
              title={row.isApplicable ? `${row.hint} — клик подставит в форму` : (row.applicabilityReason ?? '')}
              onClick={() => handlePick(row.dataType)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePick(row.dataType); }}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer transition-colors',
                isActive ? 'bg-blue-600/15' : 'hover:bg-slate-800/60',
                !row.isApplicable && 'opacity-50'
              )}
            >
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                row.isApplicable ? APPLICABLE_DOT : INAPPLICABLE_DOT
              )} />
              <span className="font-mono text-[11px] text-slate-400 w-20 shrink-0 truncate">
                {row.label}
              </span>
              <span className={cn(
                'font-mono text-xs truncate flex-1',
                row.isApplicable ? 'text-slate-100' : 'text-slate-600'
              )}>
                {row.isApplicable ? row.value : (row.applicabilityReason ?? '—')}
              </span>
              <button
                type="button"
                onClick={(e) => handleQuickCreate(e, row.dataType)}
                disabled={!row.isApplicable}
                title={row.isApplicable ? `Создать правило "${row.label}" в 1 клик` : 'Не подходит по длине'}
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded border shrink-0',
                  row.isApplicable
                    ? 'bg-emerald-600/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-600/30 cursor-pointer'
                    : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
                )}
              >
                ＋
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-600">
        Клик по строке — в форму • ＋ — создать сразу • имя из формы или авто
      </div>
    </div>
  );
};