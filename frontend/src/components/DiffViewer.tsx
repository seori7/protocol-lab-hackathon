import { useState, useMemo, type FC, type ChangeEvent } from 'react';
import type { DiffViewerProps } from '../types';
import { DIFF_INITIAL_LINES, DIFF_LINES_STEP } from '../constants/analysis';
import { buildPacketDiff } from '../utils/diff';
import { AlertIcon } from './icons';
import { cn } from '../utils/cn';

const PH = '··';
const LEGEND = [
  { label: 'same', cls: 'bg-zinc-600' },
  { label: 'diff', cls: 'bg-red-400/80' },
  { label: 'only A', cls: 'bg-amber-200/80' },
  { label: 'only B', cls: 'bg-zinc-400/70' },
];

export const DiffViewer: FC<DiffViewerProps> = ({ packets, packetAId, packetBId, onChangeA, onChangeB }) => {
  const [vis, setVis] = useState(DIFF_INITIAL_LINES);
  const pA = useMemo(() => packets.find((p) => p.id === packetAId) ?? null, [packets, packetAId]);
  const pB = useMemo(() => packets.find((p) => p.id === packetBId) ?? null, [packets, packetBId]);
  const diff = useMemo(() => (pA && pB ? buildPacketDiff(pA.payload_hex, pB.payload_hex) : null), [pA, pB]);
  const show = useMemo(() => (diff ? diff.lines.slice(0, vis) : []), [diff, vis]);
  const hid = (diff?.lines.length ?? 0) - show.length;

  if (packets.length < 2) {
    return <div className="flex items-center justify-center h-full text-zinc-500 text-[13px] font-sans">Нужно минимум 2 пакета</div>;
  }

  const samePkt = packetAId !== null && packetAId === packetBId;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0e0f11] font-sans">
      <div className="px-4 py-3 border-b border-white/[0.07] bg-[#15161a] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-zinc-100">Сравнение</span>
          <select
            value={packetAId ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => { onChangeA(Number(e.target.value)); setVis(DIFF_INITIAL_LINES); }}
            className="field !w-auto !font-mono !text-[12px] cursor-pointer"
          >
            {packets.map((p) => <option key={p.id} value={p.id}>A: #{p.id}</option>)}
          </select>
          <span className="text-zinc-600 text-[12px]">vs</span>
          <select
            value={packetBId ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => { onChangeB(Number(e.target.value)); setVis(DIFF_INITIAL_LINES); }}
            className="field !w-auto !font-mono !text-[12px] cursor-pointer"
          >
            {packets.map((p) => <option key={p.id} value={p.id}>B: #{p.id}</option>)}
          </select>
          {diff && (
            <span className="ml-auto text-[12px] font-mono text-zinc-400">
              <span className="text-zinc-100 font-semibold">{diff.stats.similarityPercent}%</span> · same {diff.stats.sameBytes} / diff {diff.stats.diffBytes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className={cn('w-2 h-2 rounded-sm inline-block', l.cls)} />{l.label}
            </span>
          ))}
          {samePkt && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-200/90">
              <AlertIcon size={12} />Выберите разные пакеты
            </span>
          )}
        </div>
      </div>
      {!diff ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-[13px]">Выберите оба пакета</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-4 font-mono text-[12px]">
          <div className="min-w-[640px]">
            {show.map((ln) => (
              <div key={ln.lineIndex} className="mb-1.5">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-12 shrink-0 text-zinc-600 text-[11px]">{ln.offsetLabel}</span>
                  <span className="w-4 shrink-0 text-amber-200/60 text-[10px]">A</span>
                  <div className="flex gap-[2px]">
                    {ln.cells.map((c) => (
                      <span
                        key={`a-${c.offset}`}
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-5 rounded',
                          c.status === 'same' && 'text-zinc-500',
                          c.status === 'diff' && 'bg-red-400/15 text-red-100 ring-1 ring-red-400/30',
                          c.status === 'only-a' && 'bg-amber-200/[0.12] text-amber-100/90',
                          c.status === 'only-b' && 'text-zinc-700'
                        )}
                      >
                        {c.hexA ?? PH}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="w-12 shrink-0" />
                  <span className="w-4 shrink-0 text-zinc-500 text-[10px]">B</span>
                  <div className="flex gap-[2px]">
                    {ln.cells.map((c) => (
                      <span
                        key={`b-${c.offset}`}
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-5 rounded',
                          c.status === 'same' && 'text-zinc-500',
                          c.status === 'diff' && 'bg-red-400/15 text-red-100 ring-1 ring-red-400/30',
                          c.status === 'only-b' && 'bg-zinc-400/15 text-zinc-200',
                          c.status === 'only-a' && 'text-zinc-700'
                        )}
                      >
                        {c.hexB ?? PH}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {hid > 0 && (
              <button type="button" onClick={() => setVis((p) => p + DIFF_LINES_STEP)} className="btn-secondary mt-2">
                Показать ещё {Math.min(DIFF_LINES_STEP, hid)} из {hid}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};