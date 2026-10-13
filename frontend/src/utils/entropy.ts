import type { Packet, SessionEntropy, EntropyColumn } from '../types';
import { getPayloadByteLength } from './rules';

const HEX_CHARS_PER_BYTE = 2;
const HEX_RADIX = 16;
const MAX_DISTINCT_VALUES = 256;
const MIN_SAMPLE_FOR_ENTROPY = 2;
const ENTROPY_CLAMP_MIN = 0;
const ENTROPY_CLAMP_MAX = 1;

const ENTROPY_LOW_THRESHOLD = 0.25;
const ENTROPY_HIGH_THRESHOLD = 0.65;

export function computeNormalizedEntropy(byteValues: number[]): number {
  if (byteValues.length < MIN_SAMPLE_FOR_ENTROPY) return ENTROPY_CLAMP_MIN;

  const freq = new Map<number, number>();
  for (const v of byteValues) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let entropyBits = 0;
  const total = byteValues.length;
  for (const count of freq.values()) {
    const p = count / total;
    entropyBits -= p * Math.log2(p);
  }
  const maxBits = Math.log2(Math.min(total, MAX_DISTINCT_VALUES));
  if (maxBits === 0) return ENTROPY_CLAMP_MIN;
  const normalized = entropyBits / maxBits;
  return Math.min(ENTROPY_CLAMP_MAX, Math.max(ENTROPY_CLAMP_MIN, normalized));
}

export function buildSessionEntropy(packets: Packet[]): SessionEntropy {
  if (packets.length === 0) {
    return { maxLength: 0, columns: [] };
  }

  const parsed: number[][] = packets.map((packet) => {
    const length = getPayloadByteLength(packet.payload_hex);
    const arr: number[] = [];
    for (let offset = 0; offset < length; offset++) {
      const charPos = offset * HEX_CHARS_PER_BYTE;
      const pair = packet.payload_hex.substring(charPos, charPos + HEX_CHARS_PER_BYTE);
      arr.push(parseInt(pair, HEX_RADIX));
    }
    return arr;
  });

  let maxLength = 0;
  for (const arr of parsed) {
    if (arr.length > maxLength) maxLength = arr.length;
  }

  const columns: EntropyColumn[] = [];
  for (let offset = 0; offset < maxLength; offset++) {
    const samples: number[] = [];
    for (const arr of parsed) {
      if (offset < arr.length) {
        samples.push(arr[offset] as number);
      }
    }
    const distinctCount = new Set(samples).size;
    columns.push({
      offset,
      sampleCount: samples.length,
      distinctCount,
      entropy: computeNormalizedEntropy(samples),
    });
  }

  return { maxLength, columns };
}

export function getEntropyHeatColor(entropy: number): string {
  if (entropy < ENTROPY_LOW_THRESHOLD) {
    return 'rgba(71,85,105,0.55)';
  }
  if (entropy < ENTROPY_HIGH_THRESHOLD) {
    const alpha = 0.35 + entropy * 0.4;
    return `rgba(245,158,11,${alpha.toFixed(2)})`;
  }
  const alpha = 0.45 + entropy * 0.45;
  return `rgba(244,63,94,${alpha.toFixed(2)})`;
}

export function getAverageEntropy(entropy: SessionEntropy): number {
  if (entropy.columns.length === 0) return 0;
  let sum = 0;
  for (const col of entropy.columns) sum += col.entropy;
  return sum / entropy.columns.length;
}

export function countConstantColumns(entropy: SessionEntropy): number {
  let count = 0;
  for (const col of entropy.columns) {
    if (col.distinctCount <= 1) count += 1;
  }
  return count;
}