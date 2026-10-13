import type { Packet, Rule, PacketFilterState, AnomalyReason } from '../types';
import {
  DEFAULT_PACKET_FILTER,
  FILTER_HEX_SPACES_PATTERN, FILTER_HEX_VALID_PATTERN,
  FILTER_LENGTH_INPUT_RADIX, FILTER_MIN_LENGTH_LIMIT,
  ANOMALY_MIN_PACKETS_FOR_SINGLETON,
  ANOMALY_MIN_PACKETS_FOR_PERCENT,
  ANOMALY_RARE_PERCENT_THRESHOLD,
  ANOMALY_PERCENT_MULTIPLIER,
} from '../constants/filter';
import { getPayloadByteLength, buildRuleValidationRows } from './rules';

export function normalizeHexQuery(raw: string): string {
  return raw.replace(FILTER_HEX_SPACES_PATTERN, '').toUpperCase();
}

export function isHexQueryValid(normalized: string): boolean {
  return FILTER_HEX_VALID_PATTERN.test(normalized);
}

export function parseLengthInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = parseInt(trimmed, FILTER_LENGTH_INPUT_RADIX);
  if (Number.isNaN(parsed) || parsed < FILTER_MIN_LENGTH_LIMIT) return null;
  return parsed;
}

export function isPacketFilterDefault(filter: PacketFilterState): boolean {
  return (
    filter.direction === DEFAULT_PACKET_FILTER.direction &&
    filter.minLength === DEFAULT_PACKET_FILTER.minLength &&
    filter.maxLength === DEFAULT_PACKET_FILTER.maxLength &&
    filter.hexQuery === DEFAULT_PACKET_FILTER.hexQuery &&
    filter.onlyAnomalies === DEFAULT_PACKET_FILTER.onlyAnomalies &&
    filter.onlyBookmarked === DEFAULT_PACKET_FILTER.onlyBookmarked
  );
}

export function getAnomalyReasonLabel(reason: AnomalyReason): string {
  switch (reason) {
    case 'short_packet':
      return 'пакет короче правила';
    case 'rare_value':
      return 'редкое значение';
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

export function buildAnomalyMap(rule: Rule | null, packets: Packet[]): Map<number, AnomalyReason> {
  const result = new Map<number, AnomalyReason>();
  if (!rule || packets.length === 0) return result;
  const rows = buildRuleValidationRows(rule, packets);
  const applicable = rows.filter((r) => r.isApplicable);
  const freq = new Map<string, number>();
  for (const row of applicable) {
    freq.set(row.value, (freq.get(row.value) ?? 0) + 1);
  }
  for (const row of rows) {
    if (!row.isApplicable) {
      result.set(row.packetId, 'short_packet');
      continue;
    }
    const count = freq.get(row.value) ?? 0;
    const isSingletonRare = count === 1 && applicable.length >= ANOMALY_MIN_PACKETS_FOR_SINGLETON;
    const percent = applicable.length > 0 ? (count / applicable.length) * ANOMALY_PERCENT_MULTIPLIER : 0;
    const isPercentRare =
      applicable.length >= ANOMALY_MIN_PACKETS_FOR_PERCENT && percent < ANOMALY_RARE_PERCENT_THRESHOLD;
    if (isSingletonRare || isPercentRare) {
      result.set(row.packetId, 'rare_value');
    }
  }
  return result;
}

export function applyPacketFilter(
  packets: Packet[],
  filter: PacketFilterState,
  anomalyMap: Map<number, AnomalyReason>,
  bookmarkedIds: Set<number>
): Packet[] {
  const normalizedHex = normalizeHexQuery(filter.hexQuery);
  const isHexValid = isHexQueryValid(normalizedHex);
  const hasHexFilter = normalizedHex.length > 0 && isHexValid;
  return packets.filter((packet) => {
    if (filter.direction !== 'all' && packet.direction !== filter.direction) return false;
    const length = getPayloadByteLength(packet.payload_hex);
    if (filter.minLength !== null && length < filter.minLength) return false;
    if (filter.maxLength !== null && length > filter.maxLength) return false;
    if (hasHexFilter) {
      if (!packet.payload_hex.toUpperCase().includes(normalizedHex)) return false;
    }
    if (filter.onlyAnomalies && !anomalyMap.has(packet.id)) return false;
    if (filter.onlyBookmarked && !bookmarkedIds.has(packet.id)) return false;
    return true;
  });
}

export function findPacketIndex(filtered: Packet[], selectedId: number | null): number {
  if (selectedId === null) return -1;
  return filtered.findIndex((p) => p.id === selectedId);
}