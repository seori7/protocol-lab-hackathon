import { useState, useEffect, useMemo, type FC } from 'react';
import type { FlowViewerProps } from '../types';
import {
  FLOW_INITIAL_PACKETS, FLOW_PACKETS_STEP, FLOW_HEX_PREVIEW_CHARS,
  FLOW_TIMESTAMP_FRACTION_DIGITS, FLOW_DELTA_MS_MULTIPLIER, FLOW_DELTA_FRACTION_DIGITS,
} from '../constants/flow';
import { getPayloadByteLength } from '../utils/rules';
import { cn } from '../utils/cn';

const FLOW_PACKET_DOM_ID_PREFIX = 'flow-pkt-';
const FLOW_ARROW_RIGHT = '──────▶';
const FLOW_ARROW_LEFT = '◀──────';
const FIRST_PACKET_INDEX = 0;
const HEX_PREVIEW_SUFFIX = '...';

export const FlowViewer: FC<FlowViewerProps> = ({ packets, selectedPacketId, onSelectPacket }) => {
  const [visibleCount, setVisibleCount] = useState<number>(FLOW_INITIAL_PACKETS);

  const visiblePackets = useMemo(
    () => packets.slice(0, visibleCount),
    [packets, visibleCount]
  );
  const hiddenCount = packets.length - visiblePackets.length;

  const directionCounts = useMemo(() => {
    let client = 0;
    let server = 0;
    for (const p of packets) {
      if (p.direction === 'client_to_server') client++;
      else server++;
    }
    return { client, server };
  }, [packets]);

  useEffect(() => {
    if (selectedPacketId === null) return;
    document
      .getElementById(`${FLOW_PACKET_DOM_ID_PREFIX}${selectedPacketId}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedPacketId]);

  if (packets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Нет пакетов для диаграммы
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="font-semibold text-slate-100 text-sm tracking-wide">
          Диаграмма обмена{' '}
          <span className="text-xs font-mono text-slate-500">{packets.length} pkts</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono">
          <span className="text-slate-500">CLIENT</span>
          <span className="text-emerald-400">──▶ {directionCounts.client}</span>
          <span className="text-violet-400">{directionCounts.server} ◀──</span>
          <span className="text-slate-500">SERVER</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {visiblePackets.map((packet, idx) => {
          const isSelected = packet.id === selectedPacketId;
          const isClient = packet.direction === 'client_to_server';
          const byteLen = getPayloadByteLength(packet.payload_hex);
          const prev = idx > FIRST_PACKET_INDEX ? packets[idx - 1] : null;
          const deltaText = prev
            ? `+${((packet.timestamp - prev.timestamp) * FLOW_DELTA_MS_MULTIPLIER).toFixed(FLOW_DELTA_FRACTION_DIGITS)}ms`
            : '—';
          const previewRaw = packet.payload_hex.slice(0, FLOW_HEX_PREVIEW_CHARS).toUpperCase();
          const preview = packet.payload_hex.length > FLOW_HEX_PREVIEW_CHARS ? `${previewRaw}${HEX_PREVIEW_SUFFIX}` : previewRaw;
          return (
            <button
              key={packet.id}
              id={`${FLOW_PACKET_DOM_ID_PREFIX}${packet.id}`}
              type="button"
              title={`#${packet.id} • ${packet.timestamp.toFixed(FLOW_TIMESTAMP_FRACTION_DIGITS)} • ${byteLen} B • клик — открыть`}
              onClick={() => onSelectPacket(packet)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left cursor-pointer transition-colors',
                isSelected
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-transparent hover:border-slate-700 hover:bg-slate-800/50'
              )}
            >
              <span className="font-mono text-xs text-slate-400 w-9 shrink-0">#{packet.id}</span>
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0',
                isClient
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
              )}>
                {isClient ? 'C→S' : 'S→C'}
              </span>
              <span className={cn(
                'flex-1 text-center text-xs tracking-tighter select-none',
                isClient ? 'text-emerald-500/70' : 'text-violet-500/70'
              )}>
                {isClient ? FLOW_ARROW_RIGHT : FLOW_ARROW_LEFT}
              </span>
              <span className="font-mono text-[11px] text-slate-500 w-14 text-right shrink-0">{byteLen} B</span>
              <span className="font-mono text-[11px] text-slate-600 w-16 text-right shrink-0">{deltaText}</span>
              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px] shrink-0">{preview}</span>
            </button>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + FLOW_PACKETS_STEP)}
            className="w-full py-2 text-xs text-slate-500 hover:text-white cursor-pointer"
          >
            Показать ещё {Math.min(FLOW_PACKETS_STEP, hiddenCount)} из {hiddenCount}
          </button>
        )}
      </div>
    </div>
  );
};