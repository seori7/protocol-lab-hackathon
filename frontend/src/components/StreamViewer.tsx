import {
  useState, useRef, useEffect, useCallback,
  type FC,
} from 'react';
import type {
  StreamViewerProps, ReassembledStream, StreamDirection, Packet,
} from '../types';
import {
  STREAM_HEX_PREVIEW_MAX_BYTES, STREAM_INITIAL_CHUNKS,
  STREAM_CHUNKS_STEP, STREAM_COPY_FEEDBACK_TIMEOUT_MS,
} from '../constants/project';
import { getChunkHexPreview, formatStreamHexSpaced } from '../utils/stream';
import { formatHexAddress } from '../utils/hex';
import { cn } from '../utils/cn';

const DIRECTION_LABELS: Record<StreamDirection, string> = {
  client_to_server: 'C → S',
  server_to_client: 'S → C',
};

interface StreamSectionProps {
  stream: ReassembledStream;
  packets: Packet[];
  selectedPacketId: number | null;
  isCopied: boolean;
  onCopy: (stream: ReassembledStream) => void;
  onSelectPacket: (packet: Packet) => void;
}

const StreamSection: FC<StreamSectionProps> = ({
  stream, packets, selectedPacketId, isCopied, onCopy, onSelectPacket,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(STREAM_INITIAL_CHUNKS);
  const visibleChunks = stream.chunks.slice(0, visibleCount);
  const hiddenCount = stream.chunks.length - visibleChunks.length;

  const handleShowMore = (): void => {
    setVisibleCount((prev) => prev + STREAM_CHUNKS_STEP);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">
          {DIRECTION_LABELS[stream.direction]}
        </span>
        <span className="text-xs font-mono text-slate-500">
          {stream.totalBytes} bytes • {stream.chunks.length} pkts
        </span>
        <button
          type="button"
          onClick={() => onCopy(stream)}
          disabled={stream.totalBytes === 0}
          title="Скопировать весь поток как spaced HEX"
          className="ml-auto px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 disabled:opacity-40 cursor-pointer"
        >
          {isCopied ? '✓ Скопировано' : 'Копировать HEX'}
        </button>
      </div>
      {stream.chunks.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-600">
          Нет данных в этом направлении
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {visibleChunks.map((chunk) => {
            const isSelected = chunk.packetId === selectedPacketId;
            const preview = getChunkHexPreview(chunk.payloadHex, STREAM_HEX_PREVIEW_MAX_BYTES);
            return (
              <button
                key={`${stream.direction}-${chunk.packetId}-${chunk.startOffset}`}
                type="button"
                title={`Пакет #${chunk.packetId} • ${preview} • клик — открыть пакет`}
                onClick={() => {
                  const pkt = packets.find((p) => p.id === chunk.packetId);
                  if (pkt) onSelectPacket(pkt);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left border transition-colors cursor-pointer',
                  isSelected
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-transparent hover:border-slate-700 hover:bg-slate-800/50'
                )}
              >
                <span className="font-mono text-xs text-slate-400 w-10 shrink-0">
                  #{chunk.packetId}
                </span>
                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                  {formatHexAddress(chunk.startOffset)} +{chunk.length}
                </span>
                <span className="font-mono text-[11px] text-slate-300 truncate">
                  {preview}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={handleShowMore}
              className="w-full py-1.5 text-xs text-slate-500 hover:text-white cursor-pointer"
            >
              Показать ещё {Math.min(STREAM_CHUNKS_STEP, hiddenCount)} из {hiddenCount}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const StreamViewer: FC<StreamViewerProps> = ({
  streams, packets, selectedPacketId, onSelectPacket,
}) => {
  const [copiedDirection, setCopiedDirection] = useState<StreamDirection | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback((stream: ReassembledStream): void => {
    if (stream.totalBytes === 0) return;
    const text = formatStreamHexSpaced(stream.totalHex);
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedDirection(stream.direction);
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(
          () => setCopiedDirection(null),
          STREAM_COPY_FEEDBACK_TIMEOUT_MS
        );
      } catch {
        setCopiedDirection(null);
      }
    })();
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="font-semibold text-slate-100 text-sm tracking-wide">
          Reassembled потоки
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Склейка payload по направлениям • клик по чанку открывает пакет
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <StreamSection
          stream={streams.clientToServer}
          packets={packets}
          selectedPacketId={selectedPacketId}
          isCopied={copiedDirection === 'client_to_server'}
          onCopy={handleCopy}
          onSelectPacket={onSelectPacket}
        />
        <StreamSection
          stream={streams.serverToClient}
          packets={packets}
          selectedPacketId={selectedPacketId}
          isCopied={copiedDirection === 'server_to_client'}
          onCopy={handleCopy}
          onSelectPacket={onSelectPacket}
        />
      </div>
    </div>
  );
};