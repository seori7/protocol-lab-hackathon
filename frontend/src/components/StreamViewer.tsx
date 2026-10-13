import { useMemo, useState, type FC } from 'react';
import type {
  DirectionalTcpStream,
  Packet,
  StreamDirection,
  StreamViewerProps,
  TcpStreamConflict,
  TcpStreamDataPart,
} from '../types';
import {
  STREAM_HEX_PREVIEW_MAX_BYTES,
  STREAM_INITIAL_CHUNKS,
  STREAM_CHUNKS_STEP,
} from '../constants/project';
import { getChunkHexPreview, formatStreamHexSpaced } from '../utils/stream';
import { formatHexAddress } from '../utils/hex';
import { cn } from '../utils/cn';

const DIRECTIONS: readonly StreamDirection[] = [
  'client_to_server',
  'server_to_client',
];

const DIRECTION_LABELS: Record<StreamDirection, string> = {
  client_to_server: 'C → S',
  server_to_client: 'S → C',
};

const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const MAX_VISIBLE_CONFLICTS = 50;

function formatByte(value: number): string {
  return value.toString(HEX_RADIX).toUpperCase().padStart(HEX_BYTE_WIDTH, '0');
}

function findSourcePacket(
  packets: Packet[],
  frameNumber: number
): Packet | undefined {
  // Не используем packet.id: это ID внутри сессии, а не номер кадра PCAP.
  return packets.find((packet) => packet.frame_number === frameNumber);
}

interface DirectionSectionProps {
  direction: StreamDirection;
  stream: DirectionalTcpStream;
  packets: Packet[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
}

const DirectionSection: FC<DirectionSectionProps> = ({
  direction,
  stream,
  packets,
  selectedPacketId,
  onSelectPacket,
}) => {
  const [visibleCount, setVisibleCount] = useState(STREAM_INITIAL_CHUNKS);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const shownParts = stream.parts.slice(0, visibleCount);
  const hiddenCount = stream.parts.length - shownParts.length;

  const hasGaps = stream.parts.some((part) => part.kind === 'gap');
  const hasConflicts = stream.conflicts.length > 0;
  const canCopyAsCompleteHex =
    stream.known_bytes > 0 && !hasGaps && !hasConflicts;

  const completeHex = useMemo(() => {
    if (!canCopyAsCompleteHex) return null;

    return stream.parts
      .filter((part): part is TcpStreamDataPart => part.kind === 'data')
      .map((part) => part.payload_hex)
      .join('');
  }, [stream, canCopyAsCompleteHex]);

  const copyCompleteHex = async (): Promise<void> => {
    if (completeHex === null) return;

    try {
      await navigator.clipboard.writeText(formatStreamHexSpaced(completeHex));
      setCopyMessage('Скопировано');
    } catch {
      setCopyMessage('Не удалось скопировать');
    }
  };

  const visibleConflicts: TcpStreamConflict[] =
    stream.conflicts.slice(0, MAX_VISIBLE_CONFLICTS);
  const hiddenConflicts = stream.conflicts.length - visibleConflicts.length;

  return (
    <section className="rounded-lg border border-white/[0.07] bg-[#15161a] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center gap-3 flex-wrap">
        <span className="text-[13px] font-semibold text-zinc-100">
          {DIRECTION_LABELS[direction]}
        </span>

        <span className="text-[12px] font-mono text-zinc-500">
          известно {stream.known_bytes} / диапазон {stream.span_bytes} байт
        </span>

        <span
          className="text-[11px] text-zinc-500"
          title="Начало наблюдаемого диапазона, не обязательно начало соединения"
        >
          seq: {stream.sequence_base ?? '—'}
        </span>

        <button
          type="button"
          onClick={() => void copyCompleteHex()}
          disabled={!canCopyAsCompleteHex}
          title={
            canCopyAsCompleteHex
              ? 'Скопировать наблюдаемый непрерывный диапазон байтов'
              : 'Нельзя копировать как цельный поток: есть пропуски, конфликты или нет данных'
          }
          className="btn-secondary !h-7 !text-[12px] ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Копировать HEX
        </button>

        {copyMessage && (
          <span className="text-[11px] text-zinc-300">{copyMessage}</span>
        )}
      </div>

      {stream.parts.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-zinc-500">
          В этом направлении наблюдаемых payload-байтов нет.
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {shownParts.map((part) => {
            if (part.kind === 'gap') {
              return (
                <div
                  key={`gap-${part.start_offset}`}
                  className="px-3 py-2 rounded-md border border-amber-400/25 bg-amber-400/[0.06] text-[12px] text-amber-200"
                >
                  ⚠ Неизвестно {part.length} байт · диапазон{' '}
                  {formatHexAddress(part.start_offset)}–
                  {formatHexAddress(part.end_offset)}
                  <span className="ml-2 text-amber-200/60">
                    (правая граница не входит)
                  </span>
                </div>
              );
            }

            const sourcePacket = findSourcePacket(
              packets,
              part.frame_number
            );
            const isSelected =
              sourcePacket !== undefined &&
              sourcePacket.id === selectedPacketId;

            return (
              <button
                key={`data-${part.start_offset}-${part.frame_number}`}
                type="button"
                disabled={!sourcePacket}
                title={
                  sourcePacket
                    ? `Исходный кадр PCAP #${part.frame_number} · открыть пакет`
                    : `Исходный кадр PCAP #${part.frame_number} не найден в текущем списке пакетов`
                }
                onClick={() => {
                  if (sourcePacket) onSelectPacket(sourcePacket);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left border transition-all',
                  sourcePacket
                    ? 'cursor-pointer hover:border-white/10 hover:bg-white/[0.04]'
                    : 'cursor-default',
                  isSelected
                    ? 'border-white/25 bg-white/[0.06]'
                    : 'border-transparent'
                )}
              >
                <span className="font-mono text-[12px] text-zinc-300 w-20 shrink-0">
                  кадр #{part.frame_number}
                </span>
                <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                  {formatHexAddress(part.start_offset)} +
                  {part.end_offset - part.start_offset}
                </span>
                <span className="font-mono text-[11px] text-zinc-400 truncate">
                  {getChunkHexPreview(
                    part.payload_hex,
                    STREAM_HEX_PREVIEW_MAX_BYTES
                  )}
                </span>
              </button>
            );
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + STREAM_CHUNKS_STEP)}
              className="btn-ghost w-full justify-center"
            >
              Показать ещё {Math.min(STREAM_CHUNKS_STEP, hiddenCount)} из{' '}
              {hiddenCount} участков
            </button>
          )}
        </div>
      )}

      {hasConflicts && (
        <div className="px-3 py-3 border-t border-red-400/20 bg-red-400/[0.04]">
          <div className="text-[12px] font-semibold text-red-200">
            ⚠ Конфликтующие байты: {stream.conflicts.length}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Показано первое наблюдавшееся значение. Оно не обязательно
            правильное.
          </div>

          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {visibleConflicts.map((conflict, index) => (
              <div
                key={`${conflict.offset}-${conflict.other_frame_number}-${index}`}
                className="text-[11px] font-mono text-zinc-300"
              >
                {formatHexAddress(conflict.offset)}: кадр #
                {conflict.first_frame_number} →{' '}
                {formatByte(conflict.first_byte)}, кадр #
                {conflict.other_frame_number} →{' '}
                {formatByte(conflict.other_byte)}
              </div>
            ))}
          </div>

          {hiddenConflicts > 0 && (
            <div className="mt-2 text-[11px] text-amber-200">
              В интерфейсе не показано ещё {hiddenConflicts} конфликтов;
              полный список есть в ответе API.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export const StreamViewer: FC<StreamViewerProps> = ({
  result,
  status,
  error,
  packets,
  selectedPacketId,
  onSelectPacket,
}) => {
  if (status === 'idle') {
    return (
      <div className="h-full flex items-center justify-center bg-[#0e0f11] text-zinc-500 text-[13px] px-6 text-center">
        В деморежиме нет проверенного TCP-потока. Загрузите PCAP/PCAPNG,
        чтобы увидеть восстановленные байты и их происхождение.
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center bg-[#0e0f11] text-zinc-400 text-[13px]">
        Восстанавливаем TCP-байты…
      </div>
    );
  }

  if (status === 'error' || result === null) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0e0f11] text-red-200 text-[13px] px-6 text-center">
        Не удалось восстановить поток: {error ?? 'нет ответа сервера'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0e0f11] font-sans">
      <div className="px-4 py-3 border-b border-white/[0.07] bg-[#15161a] shrink-0">
        <div className="text-[13px] font-semibold text-zinc-100">
          Восстановленные TCP-байты
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">
          Порядок — по TCP seq; границы участков не означают границы
          сообщений протокола.
        </div>
        {result.role_status === 'unknown' && (
          <div className="text-[11px] text-amber-200 mt-1">
            ⚠ {result.warning ?? 'Начало соединения не наблюдалось; роли C/S условные.'}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {DIRECTIONS.map((direction) => (
          <DirectionSection
            key={`${result.session_id}-${direction}`}
            direction={direction}
            stream={result.streams[direction]}
            packets={packets}
            selectedPacketId={selectedPacketId}
            onSelectPacket={onSelectPacket}
          />
        ))}

        <div className="rounded-md border border-white/[0.07] px-3 py-2 text-[11px] text-zinc-500 space-y-1">
          <div>Ограничения анализа:</div>
          {result.limitations.map((limitation) => (
            <div key={limitation}>• {limitation}</div>
          ))}
        </div>
      </div>
    </div>
  );
};