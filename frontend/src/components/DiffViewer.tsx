import {
  useState, useMemo, type FC, type ChangeEvent,
} from 'react';
import type { DiffViewerProps } from '../types';
import { DIFF_INITIAL_LINES, DIFF_LINES_STEP, DIFF_BYTES_PER_LINE } from '../constants/analysis';
import { buildPacketDiff } from '../utils/diff';
import { cn } from '../utils/cn';

const EMPTY_HEX_PLACEHOLDER = '··';
const FULL_LINE_HINT = 'Строка неполная — пакет короче';

interface LegendItem {
  label: string;
  className: string;
}

const LEGEND: LegendItem[] = [
  { label: 'same', className: 'bg-slate-700' },
  { label: 'diff', className: 'bg-rose-500' },
  { label: 'only A', className: 'bg-amber-500' },
  { label: 'only B', className: 'bg-sky-500' },
];

export const DiffViewer: FC<DiffViewerProps> = ({
  packets, packetAId, packetBId, onChangeA, onChangeB,
}) => {
  const [visibleLineCount, setVisibleLineCount] = useState<number>(DIFF_INITIAL_LINES);

  const packetA = useMemo(
    () => packets.find((p) => p.id === packetAId) ?? null,
    [packets, packetAId]
  );
  const packetB = useMemo(
    () => packets.find((p) => p.id === packetBId) ?? null,
    [packets, packetBId]
  );

  const diff = useMemo(() => {
    if (!packetA || !packetB) return null;
    return buildPacketDiff(packetA.payload_hex, packetB.payload_hex);
  }, [packetA, packetB]);

  const visibleLines = useMemo(() => {
    if (!diff) return [];
    return diff.lines.slice(0, visibleLineCount);
  }, [diff, visibleLineCount]);

  const hiddenCount = (diff?.lines.length ?? 0) - visibleLines.length;

  const handleSelectA = (e: ChangeEvent<HTMLSelectElement>): void => {
    onChangeA(Number(e.target.value));
    setVisibleLineCount(DIFF_INITIAL_LINES);
  };
  const handleSelectB = (e: ChangeEvent<HTMLSelectElement>): void => {
    onChangeB(Number(e.target.value));
    setVisibleLineCount(DIFF_INITIAL_LINES);
  };

  if (packets.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Нужно минимум 2 пакета для сравнения
      </div>
    );
  }

  const isSamePacket = packetAId !== null && packetAId === packetBId;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-100 text-sm">Сравнение пакетов</span>
          <select
            value={packetAId ?? ''}
            onChange={handleSelectA}
            title="Пакет A"
            className="px-2 py-1 text-xs font-mono rounded bg-slate-800 border border-slate-700 text-amber-200 outline-none focus:border-amber-500 cursor-pointer"
          >
            {packets.map((p) => (
              <option key={p.id} value={p.id}>A: #{p.id} ({p.direction === 'client_to_server' ? 'C→S' : 'S→C'})</option>
            ))}
          </select>
          <span className="text-slate-600 text-xs">vs</span>
          <select
            value={packetBId ?? ''}
            onChange={handleSelectB}
            title="Пакет B"
            className="px-2 py-1 text-xs font-mono rounded bg-slate-800 border border-slate-700 text-sky-200 outline-none focus:border-sky-500 cursor-pointer"
          >
            {packets.map((p) => (
              <option key={p.id} value={p.id}>B: #{p.id} ({p.direction === 'client_to_server' ? 'C→S' : 'S→C'})</option>
            ))}
          </select>
          {diff && (
            <span className="ml-auto text-xs font-mono text-slate-400">
              <span className="text-emerald-300 font-semibold">{diff.stats.similarityPercent}%</span>
              <span className="text-slate-600"> • </span>
              same {diff.stats.sameBytes} / diff {diff.stats.diffBytes}
              {diff.stats.onlyABytes > 0 && <span> / A+{diff.stats.onlyABytes}</span>}
              {diff.stats.onlyBBytes > 0 && <span> / B+{diff.stats.onlyBBytes}</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className={cn('w-2 h-2 rounded-sm inline-block', item.className)} />
              {item.label}
            </span>
          ))}
          {isSamePacket && (
            <span className="text-[11px] text-amber-300">Выбран один пакет — выберите разные</span>
          )}
        </div>
      </div>

      {!diff ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
          Выберите оба пакета
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 font-mono text-[12px]">
          <div className="min-w-[640px]">
            {visibleLines.map((line) => (
              <div key={line.lineIndex} className="mb-1">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-12 shrink-0 text-slate-500 text-[11px]">{line.offsetLabel}</span>
                  <span className="w-4 shrink-0 text-amber-500/70 text-[10px]">A</span>
                  <div className="flex gap-[2px]">
                    {line.cells.map((cell) => (
                      <span
                        key={`a-${cell.offset}`}
                        title={
                          cell.status === 'same' ? `0x${cell.offset.toString(16)} same`
                          : cell.status === 'diff' ? `0x${cell.offset.toString(16)} A=${cell.hexA} B=${cell.hexB}`
                          : 'Только в A'
                        }
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-5 rounded',
                          cell.status === 'same' && 'text-slate-400',
                          cell.status === 'diff' && 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-500/40',
                          cell.status === 'only-a' && 'bg-amber-500/20 text-amber-200',
                          cell.status === 'only-b' && 'text-slate-700'
                        )}
                      >
                        {cell.hexA ?? EMPTY_HEX_PLACEHOLDER}
                      </span>
                    ))}
                    {Array.from({ length: DIFF_BYTES_PER_LINE - line.cells.length }).map((_, i) => (
                      <span key={`ea-${i}`} title={FULL_LINE_HINT} className="inline-block w-6 h-5" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="w-12 shrink-0" />
                  <span className="w-4 shrink-0 text-sky-500/70 text-[10px]">B</span>
                  <div className="flex gap-[2px]">
                    {line.cells.map((cell) => (
                      <span
                        key={`b-${cell.offset}`}
                        title={
                          cell.status === 'same' ? `0x${cell.offset.toString(16)} same`
                          : cell.status === 'diff' ? `0x${cell.offset.toString(16)} A=${cell.hexA} B=${cell.hexB}`
                          : 'Только в B'
                        }
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-5 rounded',
                          cell.status === 'same' && 'text-slate-400',
                          cell.status === 'diff' && 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-500/40',
                          cell.status === 'only-b' && 'bg-sky-500/20 text-sky-200',
                          cell.status === 'only-a' && 'text-slate-700'
                        )}
                      >
                        {cell.hexB ?? EMPTY_HEX_PLACEHOLDER}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setVisibleLineCount((prev) => prev + DIFF_LINES_STEP)}
                className="mt-2 px-3 py-1.5 text-xs font-sans rounded bg-slate-800 border border-slate-700 hover:border-blue-500 cursor-pointer"
              >
                Показать ещё {Math.min(DIFF_LINES_STEP, hiddenCount)} из {hiddenCount} строк
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};