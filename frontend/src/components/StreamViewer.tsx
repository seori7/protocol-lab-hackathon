import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import type { StreamViewerProps, ReassembledStream, StreamDirection, Packet } from '../types';
import { STREAM_HEX_PREVIEW_MAX_BYTES, STREAM_INITIAL_CHUNKS, STREAM_CHUNKS_STEP, STREAM_COPY_FEEDBACK_TIMEOUT_MS } from '../constants/project';
import { getChunkHexPreview, formatStreamHexSpaced } from '../utils/stream';
import { formatHexAddress } from '../utils/hex';
import { CheckIcon } from './icons';
import { cn } from '../utils/cn';

const LABELS: Record<StreamDirection, string> = { client_to_server: 'C → S', server_to_client: 'S → C' };

interface SecP {
  stream: ReassembledStream;
  packets: Packet[];
  selId: number | null;
  copied: boolean;
  onCopy: (s: ReassembledStream) => void;
  onSel: (p: Packet) => void;
}

const Section: FC<SecP> = ({ stream, packets, selId, copied, onCopy, onSel }) => {
  const [vis, setVis] = useState(STREAM_INITIAL_CHUNKS);
  const show = stream.chunks.slice(0, vis);
  const hid = stream.chunks.length - show.length;
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#15161a] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center gap-3">
        <span className="text-[13px] font-semibold text-zinc-100">{LABELS[stream.direction]}</span>
        <span className="text-[12px] font-mono text-zinc-500">{stream.totalBytes} bytes · {stream.chunks.length} pkts</span>
        <button type="button" onClick={() => onCopy(stream)} disabled={!stream.totalBytes} className="btn-secondary !h-7 !text-[12px] ml-auto disabled:opacity-40">
          {copied ? <><CheckIcon size={12} />Скопировано</> : 'Копировать HEX'}
        </button>
      </div>
      {!stream.chunks.length ? (
        <div className="px-3 py-4 text-[12px] text-zinc-600">Нет данных в этом направлении</div>
      ) : (
        <div className="p-2 space-y-1">
          {show.map((ch) => {
            const sel = ch.packetId === selId;
            return (
              <button
                key={`${stream.direction}-${ch.packetId}-${ch.startOffset}`}
                type="button"
                onClick={() => { const p = packets.find((x) => x.id === ch.packetId); if (p) onSel(p); }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left border transition-all cursor-pointer',
                  sel ? 'border-white/25 bg-white/[0.06]' : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                )}
              >
                <span className="font-mono text-[12px] text-zinc-300 w-10 shrink-0">#{ch.packetId}</span>
                <span className="font-mono text-[11px] text-zinc-500 shrink-0">{formatHexAddress(ch.startOffset)} +{ch.length}</span>
                <span className="font-mono text-[11px] text-zinc-400 truncate">{getChunkHexPreview(ch.payloadHex, STREAM_HEX_PREVIEW_MAX_BYTES)}</span>
              </button>
            );
          })}
          {hid > 0 && (
            <button type="button" onClick={() => setVis((p) => p + STREAM_CHUNKS_STEP)} className="btn-ghost w-full justify-center">
              Показать ещё {Math.min(STREAM_CHUNKS_STEP, hid)} из {hid}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const StreamViewer: FC<StreamViewerProps> = ({ streams, packets, selectedPacketId, onSelectPacket }) => {
  const [copiedDir, setCopiedDir] = useState<StreamDirection | null>(null);
  const tRef = useRef<number | null>(null);
  useEffect(() => () => { if (tRef.current !== null) window.clearTimeout(tRef.current); }, []);
  const copy = useCallback((s: ReassembledStream): void => {
    if (!s.totalBytes) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(formatStreamHexSpaced(s.totalHex));
        setCopiedDir(s.direction);
        if (tRef.current !== null) window.clearTimeout(tRef.current);
        tRef.current = window.setTimeout(() => setCopiedDir(null), STREAM_COPY_FEEDBACK_TIMEOUT_MS);
      } catch {
        setCopiedDir(null);
      }
    })();
  }, []);
  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0e0f11] font-sans">
      <div className="px-4 py-3 border-b border-white/[0.07] bg-[#15161a] shrink-0">
        <div className="text-[13px] font-semibold text-zinc-100">Потоки</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">Склейка по направлениям · клик открывает пакет</div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <Section stream={streams.clientToServer} packets={packets} selId={selectedPacketId} copied={copiedDir === 'client_to_server'} onCopy={copy} onSel={onSelectPacket} />
        <Section stream={streams.serverToClient} packets={packets} selId={selectedPacketId} copied={copiedDir === 'server_to_client'} onCopy={copy} onSel={onSelectPacket} />
      </div>
    </div>
  );
};