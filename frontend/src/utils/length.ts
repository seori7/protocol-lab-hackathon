import type { Packet, LengthCandidate, RuleDataType } from '../types';
import {
  LENGTH_MAX_OFFSET, LENGTH_MIN_PACKETS, LENGTH_MIN_MATCH_RATE,
  LENGTH_MAX_CANDIDATES, LENGTH_SAMPLE_MAX_PACKETS, LENGTH_PERCENT_MULTIPLIER,
} from '../constants/flow';
import { getPayloadByteLength } from './rules';

const HEX_CHARS_PER_BYTE = 2;
const HEX_RADIX = 16;
const BYTE_BASE_256 = 256;
const BYTE_BASE_65536 = 65536;
const BYTE_BASE_16777216 = 16777216;
const MIN_PACKET_LENGTH_FOR_LENGTH = 2;

interface LengthTemplate {
  length: number;
  dataType: RuleDataType;
}

const LENGTH_TEMPLATES: readonly LengthTemplate[] = [
  { length: 1, dataType: 'uint8' },
  { length: 2, dataType: 'uint16_be' },
  { length: 2, dataType: 'uint16_le' },
  { length: 4, dataType: 'uint32_be' },
  { length: 4, dataType: 'uint32_le' },
];

function parseUintValue(
  payloadHex: string,
  offset: number,
  length: number,
  dataType: RuleDataType
): number | null {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    const pos = (offset + i) * HEX_CHARS_PER_BYTE;
    const pair = payloadHex.substring(pos, pos + HEX_CHARS_PER_BYTE);
    if (pair.length < HEX_CHARS_PER_BYTE) return null;
    const value = parseInt(pair, HEX_RADIX);
    if (Number.isNaN(value)) return null;
    bytes.push(value);
  }
  const b0 = bytes[0] as number;
  const b1 = bytes[1] as number;
  const b2 = bytes[2] as number;
  const b3 = bytes[3] as number;
  switch (dataType) {
    case 'uint8':
      if (length !== 1) return null;
      return b0;
    case 'uint16_be':
      if (length !== 2) return null;
      return b0 * BYTE_BASE_256 + b1;
    case 'uint16_le':
      if (length !== 2) return null;
      return b1 * BYTE_BASE_256 + b0;
    case 'uint32_be':
      if (length !== 4) return null;
      return b0 * BYTE_BASE_16777216 + b1 * BYTE_BASE_65536 + b2 * BYTE_BASE_256 + b3;
    case 'uint32_le':
      if (length !== 4) return null;
      return b3 * BYTE_BASE_16777216 + b2 * BYTE_BASE_65536 + b1 * BYTE_BASE_256 + b0;
    default:
      return null;
  }
}

export function detectLengthFields(packets: Packet[]): LengthCandidate[] {
  if (packets.length < LENGTH_MIN_PACKETS) return [];
  const sample = packets.slice(0, LENGTH_SAMPLE_MAX_PACKETS);

  let minLen = Number.MAX_SAFE_INTEGER;
  for (const p of sample) {
    const len = getPayloadByteLength(p.payload_hex);
    if (len < minLen) minLen = len;
  }
  if (minLen < MIN_PACKET_LENGTH_FOR_LENGTH) return [];

  const maxOffset = Math.min(minLen - 1, LENGTH_MAX_OFFSET);
  const candidates: LengthCandidate[] = [];

  for (let offset = 0; offset <= maxOffset; offset++) {
    for (const tmpl of LENGTH_TEMPLATES) {
      if (offset + tmpl.length > minLen) continue;
      let totalMatch = 0;
      let remainingMatch = 0;
      let checked = 0;
      let sampleValue = '';
      let isFirst = true;
      for (const p of sample) {
        const total = getPayloadByteLength(p.payload_hex);
        if (offset + tmpl.length > total) continue;
        const value = parseUintValue(p.payload_hex, offset, tmpl.length, tmpl.dataType);
        if (value === null) continue;
        checked++;
        if (isFirst) {
          sampleValue = value.toString();
          isFirst = false;
        }
        if (value === total) totalMatch++;
        const remaining = total - (offset + tmpl.length);
        if (value === remaining) remainingMatch++;
      }
      if (checked < LENGTH_MIN_PACKETS) continue;
      const totalRate = Math.round((totalMatch / checked) * LENGTH_PERCENT_MULTIPLIER);
      const remainingRate = Math.round((remainingMatch / checked) * LENGTH_PERCENT_MULTIPLIER);
      if (totalRate >= LENGTH_MIN_MATCH_RATE) {
        candidates.push({
          id: `len-${offset}-${tmpl.dataType}-total`,
          offset,
          length: tmpl.length,
          dataType: tmpl.dataType,
          mode: 'total',
          matchRate: totalRate,
          matchedCount: totalMatch,
          totalChecked: checked,
          sampleValue,
        });
      } else if (remainingRate >= LENGTH_MIN_MATCH_RATE) {
        candidates.push({
          id: `len-${offset}-${tmpl.dataType}-remaining`,
          offset,
          length: tmpl.length,
          dataType: tmpl.dataType,
          mode: 'remaining',
          matchRate: remainingRate,
          matchedCount: remainingMatch,
          totalChecked: checked,
          sampleValue,
        });
      }
    }
  }

  candidates.sort((a, b) => b.matchRate - a.matchRate || a.offset - b.offset);
  return candidates.slice(0, LENGTH_MAX_CANDIDATES);
}