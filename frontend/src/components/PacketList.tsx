import { useMemo, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import type { PacketListProps, Packet } from '../types';
import { countApplicableRules, getPayloadByteLength } from '../utils/rules';
import { getAnomalyReasonLabel } from '../utils/packetFilter';
import { SessionStatsBar } from './SessionStatsBar';
import { cn } from '../utils/cn';

const TIMESTAMP_FRACTION_DIGITS = 3;
const SKELETON_ROWS_COUNT = 6;
const FULL_MATCH = 'full';
const PARTIAL_MATCH = 'partial';
const NO_MATCH = 'none';
const FRONTEND_ANOMALY_ICON = '⚠';
const BACKEND_ANOMALY_ICON = '⬢';
const BOOKMARK_ON = '★';
const BOOKMARK_OFF = '☆';

interface PacketRowView {
  packet: Packet;
  byteLength: number;
  applicableCount: number;
}

type MatchKind = typeof FULL_MATCH | typeof PARTIAL_MATCH | typeof NO_MATCH;

function getMatchKind(applicable: number, total: number): MatchKind {
  if (total === 0 || applicable === total) return FULL_MATCH;
  if (applicable === 0) return NO_MATCH;
  return PARTIAL_MATCH;
}

function getMatchBadgeClass(kind: MatchKind): string {
  if (kind === FULL_MATCH) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (kind === PARTIAL_MATCH) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-slate-800 text-slate-500 border-slate-700';
}

export const PacketList: FC<PacketListProps> = ({
  packets, totalCount, anomalyMap, bookmarkedIds,
  selectedPacketId, onSelectPacket, onToggleBookmark, rules, sessionLabel, isLoadingPackets,
}) => {
  const rows: PacketRowView[] = useMemo(() => {
    return packets.map((packet) => ({
      packet,
      byteLength: packet.payload_len ?? getPayloadByteLength(packet.payload_hex),
      applicableCount: countApplicableRules(packet.payload_hex, rules),
    }));
  }, [packets, rules]);

  const totalRules = rules.length;
  const isFiltered = packets.length !== totalCount;

  const handleBookmarkClick = (e: ReactMouseEvent<HTMLButtonElement>, packetId: number): void => {
    e.stopPropagation();
    onToggleBookmark(packetId);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-2.5 border-b border-slate-800 shrink-0">
        <div className="font-semibold text-slate-100 text-sm tracking-wide">
          Список пакетов{' '}
          <span className="ml-1 text-xs font-mono text-slate-500">
            {isFiltered ? `${packets.length}/${totalCount}` : totalCount}
          </span>
        </div>
        {sessionLabel && (
          <div title={sessionLabel} className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
            {sessionLabel}
          </div>
        )}
      </div>
      {!isLoadingPackets && totalCount > 0 && (
        <SessionStatsBar packets={packets} totalCount={totalCount} rules={rules} />
      )}
      <div className="flex-1 overflow-y-auto">
        {isLoadingPackets ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: SKELETON_ROWS_COUNT }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {totalCount > 0 ? 'Нет пакетов по фильтру' : 'Нет пакетов в сессии'}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/60 sticky top-0 backdrop-blur">
              <tr className="border-b border-slate-800">
                <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs w-8">★</th>
                <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs">ID</th>
                <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs">Время</th>
                <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs">Напр.</th>
                <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs">Длина</th>
                {totalRules > 0 && (
                  <th className="px-2 py-2 text-left font-medium text-slate-500 text-xs">Правила</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 cursor-pointer">
              {rows.map(({ packet, byteLength, applicableCount }) => {
                const isSelected = packet.id === selectedPacketId;
                const isClient = packet.direction === 'client_to_server';
                const kind = getMatchKind(applicableCount, totalRules);
                const frontendAnomaly = anomalyMap.get(packet.id) ?? null;
                const backendAnomaly = packet.anomaly ?? null;
                return (
                  <tr
                    key={packet.id}
                    onClick={() => onSelectPacket(packet)}
                    className={cn(
                      'transition-colors border-l-2',
                      isSelected
                        ? 'bg-blue-600/15 border-l-blue-500 hover:bg-blue-600/20'
                        : backendAnomaly
                          ? 'bg-rose-500/5 border-l-transparent hover:bg-rose-500/10'
                          : frontendAnomaly
                            ? 'bg-amber-500/5 border-l-transparent hover:bg-amber-500/10'
                            : 'hover:bg-slate-800/60 border-l-transparent'
                    )}
                  >
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => handleBookmarkClick(e, packet.id)}
                        title={bookmarkedIds.has(packet.id) ? 'Убрать закладку' : 'В закладки'}
                        className={cn(
                          'text-sm leading-none cursor-pointer',
                          bookmarkedIds.has(packet.id) ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-600 hover:text-yellow-400'
                        )}
                      >
                        {bookmarkedIds.has(packet.id) ? BOOKMARK_ON : BOOKMARK_OFF}
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-200 font-mono">{packet.id}</span>
                        {frontendAnomaly && (
                          <span title={getAnomalyReasonLabel(frontendAnomaly)} className="text-amber-400 text-[11px]">
                            {FRONTEND_ANOMALY_ICON}
                          </span>
                        )}
                        {backendAnomaly && (
                          <span title={`TCP: ${backendAnomaly}`} className="text-rose-400 text-[11px]">
                            {BACKEND_ANOMALY_ICON}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 font-mono text-xs">
                      {packet.timestamp.toFixed(TIMESTAMP_FRACTION_DIGITS)}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-medium border',
                        isClient
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                      )}>
                        {isClient ? 'C → S' : 'S → C'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 text-xs whitespace-nowrap">{byteLength} б</td>
                    {totalRules > 0 && (
                      <td className="px-2 py-2.5">
                        <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-mono border', getMatchBadgeClass(kind))}>
                          {kind === FULL_MATCH ? `✓ ${applicableCount}/${totalRules}` : `${applicableCount}/${totalRules}`}
                        </span>
                      </td>
                    )}
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