import type { DiffCell, DiffLine, DiffStats, DiffByteStatus } from '../types';
import { DIFF_BYTES_PER_LINE } from '../constants/analysis';
import { formatOffset } from './hex';

const HEX_CHARS_PER_BYTE = 2;
const PERCENT_MULTIPLIER = 100;
const FULL_SIMILARITY = 100;

function parseHexToBytes(payloadHex: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < payloadHex.length; i += HEX_CHARS_PER_BYTE) {
    const pair = payloadHex.substring(i, i + HEX_CHARS_PER_BYTE).toUpperCase();
    if (pair.length < HEX_CHARS_PER_BYTE) break;
    result.push(pair);
  }
  return result;
}

function resolveCellStatus(hexA: string | null, hexB: string | null): DiffByteStatus {
  if (hexA !== null && hexB !== null) {
    return hexA === hexB ? 'same' : 'diff';
  }
  if (hexA !== null) return 'only-a';
  return 'only-b';
}

export function buildPacketDiff(payloadA: string, payloadB: string): {
  lines: DiffLine[];
  stats: DiffStats;
} {
  const bytesA = parseHexToBytes(payloadA);
  const bytesB = parseHexToBytes(payloadB);
  const totalSlots = Math.max(bytesA.length, bytesB.length);

  const cells: DiffCell[] = [];
  let sameBytes = 0;
  let diffBytes = 0;
  let onlyABytes = 0;
  let onlyBBytes = 0;

  for (let offset = 0; offset < totalSlots; offset++) {
    const hexA: string | null = offset < bytesA.length ? (bytesA[offset] as string) : null;
    const hexB: string | null = offset < bytesB.length ? (bytesB[offset] as string) : null;
    const status = resolveCellStatus(hexA, hexB);
    if (status === 'same') sameBytes += 1;
    else if (status === 'diff') diffBytes += 1;
    else if (status === 'only-a') onlyABytes += 1;
    else onlyBBytes += 1;
    cells.push({ offset, hexA, hexB, status });
  }

  const lines: DiffLine[] = [];
  for (let i = 0; i < cells.length; i += DIFF_BYTES_PER_LINE) {
    const chunk = cells.slice(i, i + DIFF_BYTES_PER_LINE);
    lines.push({
      lineIndex: Math.floor(i / DIFF_BYTES_PER_LINE),
      startOffset: i,
      offsetLabel: formatOffset(i),
      cells: chunk,
    });
  }

  const similarityPercent =
    totalSlots === 0 ? FULL_SIMILARITY : Math.round((sameBytes / totalSlots) * PERCENT_MULTIPLIER);

  const stats: DiffStats = {
    totalSlots,
    lengthA: bytesA.length,
    lengthB: bytesB.length,
    sameBytes,
    diffBytes,
    onlyABytes,
    onlyBBytes,
    similarityPercent,
  };

  return { lines, stats };
}