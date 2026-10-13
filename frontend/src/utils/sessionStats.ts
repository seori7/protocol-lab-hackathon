import type { Packet, Rule, SessionSummaryStats } from '../types';
import { SESSION_STATS_MAX_SAMPLE } from '../constants/ux';
import { getPayloadByteLength } from './rules';
import { buildCoverageStats } from './structure';

export function buildSessionSummary(packets: Packet[], rules: Rule[]): SessionSummaryStats {
  const packetCount = packets.length;
  if (packetCount === 0) {
    return {
      packetCount: 0, totalBytes: 0, avgLength: 0,
      minLength: 0, maxLength: 0,
      clientCount: 0, serverCount: 0,
      avgCoveragePercent: null, sampledPackets: 0,
    };
  }
  let totalBytes = 0;
  let minLength = Number.MAX_SAFE_INTEGER;
  let maxLength = 0;
  let clientCount = 0;
  let serverCount = 0;
  for (const p of packets) {
    const len = getPayloadByteLength(p.payload_hex);
    totalBytes += len;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    if (p.direction === 'client_to_server') clientCount += 1;
    else serverCount += 1;
  }
  const avgLength = Math.round(totalBytes / packetCount);

  let avgCoveragePercent: number | null = null;
  let sampledPackets = 0;
  if (rules.length > 0) {
    const sample = packets.slice(0, SESSION_STATS_MAX_SAMPLE);
    let sum = 0;
    for (const p of sample) {
      sum += buildCoverageStats(p.payload_hex, rules).coveragePercent;
    }
    avgCoveragePercent = Math.round(sum / sample.length);
    sampledPackets = sample.length;
  }

  return {
    packetCount, totalBytes, avgLength,
    minLength, maxLength,
    clientCount, serverCount,
    avgCoveragePercent, sampledPackets,
  };
}