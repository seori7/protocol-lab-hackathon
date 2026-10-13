import { useMemo, type FC } from 'react';
import type { RuleValidationTableProps } from '../types';
import { buildRuleValidationRows } from '../utils/rules';
import { cn } from '../utils/cn';

const TIMESTAMP_FRACTION_DIGITS = 3;
const VALIDATION_MAX_ROWS = 200;

export const RuleValidationTable: FC<RuleValidationTableProps> = ({
  rule, packets, selectedPacketId, onSelectPacket,
}) => {
  const rows = useMemo(
    () => buildRuleValidationRows(rule, packets),
    [rule, packets]
  );

  const applicableCount = useMemo(
    () => rows.filter((r) => r.isApplicable).length,
    [rows]
  );

  const distinctCount = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.isApplicable) set.add(row.value);
    }
    return set.size;
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.slice(0, VALIDATION_MAX_ROWS),
    [rows]
  );
  const hiddenCount = rows.length - visibleRows.length;

  if (packets.length === 0) {
    return <div className="text-xs text-slate-600">Нет пакетов для проверки</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Проверка на сессии
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          <span className="text-emerald-300">{applicableCount}/{rows.length}</span>
          <span className="text-slate-600"> • </span>
          <span title="Уникальных значений">≋ {distinctCount}</span>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-800">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-800/60">
            {visibleRows.map((row) => {
              const isSel = row.packetId === selectedPacketId;
              return (
                <tr
                  key={row.packetId}
                  onClick={() => {
                    const pkt = packets.find((p) => p.id === row.packetId);
                    if (pkt) onSelectPacket(pkt);
                  }}
                  title={`${row.hexText} • ${row.timestamp.toFixed(TIMESTAMP_FRACTION_DIGITS)}`}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSel ? 'bg-blue-600/15' : 'hover:bg-slate-800/60'
                  )}
                >
                  <td className="px-2 py-1.5 font-mono text-slate-500 w-10">#{row.packetId}</td>
                  <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">
                    {row.isApplicable
                      ? <span className="text-slate-100">{row.value}</span>
                      : <span className="text-slate-600">short</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-600 truncate max-w-[100px] text-right">
                    {row.hexText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className="text-[11px] text-slate-600 mt-1">
          Показаны первые {VALIDATION_MAX_ROWS} из {rows.length}
        </div>
      )}
    </div>
  );
};