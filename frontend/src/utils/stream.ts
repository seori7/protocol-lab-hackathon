import type {
  Packet, SessionStreams, ReassembledStream,
  StreamChunk, StreamDirection,
} from '../types';
import { getPayloadByteLength } from './rules';

const HEX_CHARS_PER_BYTE = 2;
const INCLUSIVE_END_ADJUSTMENT = 1;
const HEX_PREVIEW_SEPARATOR = ' ';
const HEX_PREVIEW_SUFFIX = ' ...';

function comparePacketsByTime(a: Packet, b: Packet): number {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  const aSeq = a.seq ?? a.id;
  const bSeq = b.seq ?? b.id;
  return aSeq - bSeq;
}

function buildOneStream(direction: StreamDirection, sorted: Packet[]): ReassembledStream {
  const chunks: StreamChunk[] = [];
  const hexParts: string[] = [];
  let cursor = 0;

  for (const packet of sorted) {
    const length = getPayloadByteLength(packet.payload_hex);
    if (length === 0) continue;
    hexParts.push(packet.payload_hex);
    chunks.push({
      packetId: packet.id,
      timestamp: packet.timestamp,
      startOffset: cursor,
      endOffset: cursor + length - INCLUSIVE_END_ADJUSTMENT,
      length,
      payloadHex: packet.payload_hex,
    });
    cursor += length;
  }

  return {
    direction,
    totalBytes: cursor,
    totalHex: hexParts.join(''),
    chunks,
  };
}

export function reassembleStreams(packets: Packet[]): SessionStreams {
  const clientPackets = packets
    .filter((p) => p.direction === 'client_to_server')
    .sort(comparePacketsByTime);
  const serverPackets = packets
    .filter((p) => p.direction === 'server_to_client')
    .sort(comparePacketsByTime);

  return {
    clientToServer: buildOneStream('client_to_server', clientPackets),
    serverToClient: buildOneStream('server_to_client', serverPackets),
  };
}

export function getChunkHexPreview(payloadHex: string, maxBytes: number): string {
  const total = getPayloadByteLength(payloadHex);
  const shown = Math.min(total, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < shown; i++) {
    const pos = i * HEX_CHARS_PER_BYTE;
    parts.push(payloadHex.substring(pos, pos + HEX_CHARS_PER_BYTE).toUpperCase());
  }
  const text = parts.join(HEX_PREVIEW_SEPARATOR);
  return total > shown ? `${text}${HEX_PREVIEW_SUFFIX}` : text;
}

export function formatStreamHexSpaced(totalHex: string): string {
  const total = Math.floor(totalHex.length / HEX_CHARS_PER_BYTE);
  const parts: string[] = [];
  for (let i = 0; i < total; i++) {
    const pos = i * HEX_CHARS_PER_BYTE;
    parts.push(totalHex.substring(pos, pos + HEX_CHARS_PER_BYTE).toUpperCase());
  }
  return parts.join(HEX_PREVIEW_SEPARATOR);
}