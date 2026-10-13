import type {
  Packet, SessionEntropy, RuleSuggestion, ByteRange, RuleDataType,
} from '../types';
import {
  MIN_SUGGESTION_LENGTH, MAX_SUGGESTIONS, MIN_PACKETS_FOR_SUGGESTIONS,
} from '../constants/analysis';
import {
  formatHexAddress, extractHexBytesForRange, interpretHexBytes,
} from './hex';

const ASCII_PRINTABLE_MIN = 32;
const ASCII_PRINTABLE_MAX = 126;
const HEX_RADIX = 16;
const INCLUSIVE_END_ADJUSTMENT = 1;
const HEX_PREVIEW_SEPARATOR = ' ';

function areAllPrintableAscii(hexBytes: string[]): boolean {
  if (hexBytes.length === 0) return false;
  for (const h of hexBytes) {
    const code = parseInt(h, HEX_RADIX);
    if (code < ASCII_PRINTABLE_MIN || code > ASCII_PRINTABLE_MAX) return false;
  }
  return true;
}

export function buildConstantSuggestions(
  entropy: SessionEntropy,
  packets: Packet[]
): RuleSuggestion[] {
  if (packets.length < MIN_PACKETS_FOR_SUGGESTIONS) return [];
  if (entropy.columns.length === 0) return [];

  const runs: ByteRange[] = [];
  let runStart: number | null = null;

  for (const col of entropy.columns) {
    const isConstant = col.distinctCount <= 1 && col.sampleCount === packets.length;
    if (isConstant) {
      if (runStart === null) runStart = col.offset;
    } else {
      if (runStart !== null) {
        runs.push({ start: runStart, end: col.offset - INCLUSIVE_END_ADJUSTMENT });
        runStart = null;
      }
    }
  }
  if (runStart !== null) {
    const lastOffset = entropy.columns[entropy.columns.length - 1]!.offset;
    runs.push({ start: runStart, end: lastOffset });
  }

  const firstPayload = packets[0]!.payload_hex;
  const suggestions: RuleSuggestion[] = [];

  for (const run of runs) {
    const length = run.end - run.start + INCLUSIVE_END_ADJUSTMENT;
    if (length < MIN_SUGGESTION_LENGTH) continue;

    const hexBytes = extractHexBytesForRange(firstPayload, run);
    if (hexBytes.length !== length) continue;

    const suggestedType: RuleDataType = areAllPrintableAscii(hexBytes) ? 'ascii' : 'bytes';
    const sampleHex = hexBytes.join(HEX_PREVIEW_SEPARATOR);
    const sampleValue = interpretHexBytes(hexBytes, suggestedType);

    suggestions.push({
      id: `suggest-${run.start}-${length}`,
      offset: run.start,
      length,
      anchor: "start",
      suggestedName: `Const ${formatHexAddress(run.start)}`,
      suggestedType,
      reason: `Constant in ${packets.length} packets`,
      sampleHex,
      sampleValue,
      packetCount: packets.length,
    });

    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  return suggestions;
}