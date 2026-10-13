import { useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { PacketListProps, Packet } from '../types';
import { countApplicableRules, getPayloadByteLength } from '../utils/rules';
import { getAnomalyReasonLabel } from '../utils/packetFilter';
import { SessionStatsBar } from './SessionStatsBar';
import { StarIcon, AlertIcon, CheckIcon } from './icons';
import { cn } from '../utils/cn';
const TS = 3; const SKEL = 6;
interface RowV { packet: Packet; len: number; app: number; }
export const PacketList: FC<PacketListProps> = ({ packets, totalCount, anomalyMap, bookmarkedIds, selectedPacketId, onSelectPacket, onToggleBookmark, rules, sessionLabel, isLoadingPackets }) => {
  const rows: RowV[] = useMemo(() => packets.map((p) => ({ packet: p, len: p.payload_len ?? getPayloadByteLength(p.payload_hex), app: countApplicableRules(p.payload_hex, rules) })), [packets, rules]);
  const totalRules = rules.length;
  const filtered = packets.length !== totalCount;
  const onStar = (e: ReactMouseEvent<HTMLButtonElement>, id: number): void => { e.stopPropagation(); onToggleBookmark(id); };
  return (
    <div className="flex flex-col h-full min-h-0 bg-[#15161a] font-sans overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.07] shrink-0">
        <div className="text-[13px] font-semibold tracking-wide text-zinc-100">Список пакетов <span className="ml-1 text-[12px] font-mono font-normal text-zinc-500">{filtered ? `${packets.length}/${totalCount}` : totalCount}</span></div>
        {sessionLabel && <div title={sessionLabel} className="mt-0.5 text-[11px] font-mono text-zinc-500 truncate">{sessionLabel}</div>}
      </div>
      {!isLoadingPackets && totalCount > 0 && <SessionStatsBar packets={packets} totalCount={totalCount} rules={rules} />}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {isLoadingPackets ? <div className="p-3 space-y-2">{Array.from({ length: SKEL }).map((_, i) => <div key={i} className="h-10 rounded-md bg-white/[0.04] animate-pulse" />)}</div>
        : !rows.length ? <div className="p-6 text-center text-[13px] text-zinc-500">{totalCount > 0 ? 'Нет пакетов по фильтру' : 'Нет пакетов в сессии'}</div>
        : (
          <table className="w-full table-fixed">
            <thead className="bg-[#121316] sticky top-0 z-10">
              <tr className="border-b border-white/[0.07]">
                <th className="w-[64px] px-1.5 py-2 text-left ui-label text-[10px] whitespace-nowrap overflow-hidden">ID</th>
                <th className="w-[68px] px-1.5 py-2 text-left ui-label text-[10px] whitespace-nowrap overflow-hidden">Время</th>
                <th className="w-[62px] px-1.5 py-2 text-left ui-label text-[10px] whitespace-nowrap overflow-hidden">Напр.</th>
                <th className="w-[52px] px-1.5 py-2 text-left ui-label text-[10px] whitespace-nowrap overflow-hidden">Длина</th>
                {totalRules > 0 && <th className="px-1.5 py-2 text-left ui-label text-[10px] whitespace-nowrap overflow-hidden">Правила</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map(({ packet: p, len, app }) => {
                const sel = p.id === selectedPacketId;
                const cli = p.direction === 'client_to_server';
                const front = anomalyMap.get(p.id) ?? null;
                const back = p.anomaly ?? null;
                const star = bookmarkedIds.has(p.id);
                const full = totalRules === 0 || app === totalRules;
                const none = totalRules > 0 && app === 0;
                return (
                  <tr key={p.id} onClick={() => onSelectPacket(p)} className={cn('transition-all duration-150 border-l-2 cursor-pointer',
                    sel ? 'bg-white/[0.07] border-l-[#f4f4f5]' : back ? 'bg-red-400/[0.05] border-l-transparent hover:bg-red-400/[0.08]' : front ? 'bg-amber-200/[0.05] border-l-transparent hover:bg-amber-200/[0.08]' : 'border-l-transparent hover:bg-white/[0.04]')}>
                    <td className="px-1.5 py-2 overflow-hidden">
                      <div className="flex items-center gap-1 min-w-0">
                        <button type="button" onClick={(e) => onStar(e, p.id)} title={star ? 'Убрать' : 'В закладки'} className={cn('shrink-0 w-4 h-4 flex items-center justify-center transition-all hover:scale-110 cursor-pointer', star ? 'text-zinc-100' : 'text-zinc-700 hover:text-zinc-300')}>
                          <StarIcon size={12} filled={star} />
                        </button>
                        <span className="text-zinc-100 font-mono text-[12px] truncate">{p.id}</span>
                        {front && <span title={getAnomalyReasonLabel(front)} className="text-amber-200/80 shrink-0"><AlertIcon size={11} /></span>}
                        {back && <span title={`TCP: ${back}`} className="text-red-300/80 shrink-0"><AlertIcon size={11} /></span>}
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-zinc-500 font-mono text-[11px] truncate overflow-hidden">{p.timestamp.toFixed(TS)}</td>
                    <td className="px-1.5 py-2 overflow-hidden"><span className={cn('chip text-[10px] max-w-full overflow-hidden', cli ? 'bg-emerald-400/[0.08] text-emerald-200/90 border-emerald-400/20' : 'bg-white/[0.04] text-zinc-300 border-white/10')}>{cli ? 'C → S' : 'S → C'}</span></td>
                    <td className="px-1.5 py-2 text-zinc-500 text-[11px] font-mono whitespace-nowrap overflow-hidden">{len} б</td>
                    {totalRules > 0 && <td className="px-1.5 py-2 overflow-hidden"><span className={cn('chip text-[10px] max-w-full', full ? 'bg-emerald-400/[0.08] text-emerald-200/90 border-emerald-400/20' : none ? 'bg-white/[0.03] text-zinc-600 border-white/[0.07]' : 'bg-amber-200/[0.08] text-amber-100/90 border-amber-200/20')}>{full && totalRules > 0 && <CheckIcon size={10} />}{app}/{totalRules}</span></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};