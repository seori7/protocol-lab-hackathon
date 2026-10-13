import type {
  Rule, Packet, CoverageStats, CoverageSegment,
  UncoveredGap, ValueDistributionEntry, RuleDataType,
} from '../types';
import { DATA_TYPE_OPTIONS } from '../constants/rules';
import { buildRuleValidationRows, getPayloadByteLength } from './rules';
import { formatHexAddress } from './hex';
import { resolveRuleStart } from './anchor';

const PERCENT_MULTIPLIER = 100;
const DISTRIBUTION_KEY_SEPARATOR = '\u0000';
const DEFAULT_STRUCT_NAME = 'protocol_message';
const FALLBACK_FIELD_PREFIX = 'field';

const WHITESPACE_PATTERN = /\s+/g;
const INVALID_FIELD_CHARS_PATTERN = /[^a-zA-Z0-9_]/g;
const MULTIPLE_UNDERSCORES_PATTERN = /_+/g;
const LEADING_DIGIT_PATTERN = /^[0-9]/;
const UNDERSCORE_CHAR = '_';

export function buildCoverageStats(payloadHex: string, rules: Rule[]): CoverageStats {
  const totalBytes = getPayloadByteLength(payloadHex);
  if (totalBytes === 0) {
    return { totalBytes: 0, coveredBytes: 0, coveragePercent: 0, gapCount: 0, gaps: [], segments: [] };
  }
  const byteToRule = new Map<number, Rule>();
  for (const rule of rules) {
    const effective = resolveRuleStart(rule, totalBytes);
    if (effective === null) continue;
    for (let i = 0; i < rule.length; i++) {
      const offset = effective + i;
      if (offset < 0 || offset >= totalBytes) continue;
      if (!byteToRule.has(offset)) byteToRule.set(offset, rule);
    }
  }
  const segments: CoverageSegment[] = [];
  let segStart = 0;
  let segRule: Rule | null = byteToRule.get(0) ?? null;
  for (let offset = 1; offset <= totalBytes; offset++) {
    const current: Rule | null = offset < totalBytes ? (byteToRule.get(offset) ?? null) : null;
    const currentId = current?.id ?? null;
    const segId = segRule?.id ?? null;
    const isBoundary = offset === totalBytes || currentId !== segId;
    if (isBoundary && offset < totalBytes) {
      segments.push({ start: segStart, end: offset - 1, rule: segRule });
      segStart = offset;
      segRule = current;
    } else if (offset === totalBytes) {
      segments.push({ start: segStart, end: totalBytes - 1, rule: segRule });
    }
  }
  const gaps: UncoveredGap[] = segments
    .filter((s) => s.rule === null)
    .map((s) => ({ start: s.start, end: s.end, length: s.end - s.start + 1 }));
  const coveredBytes = byteToRule.size;
  const coveragePercent = Math.round((coveredBytes / totalBytes) * PERCENT_MULTIPLIER);
  return { totalBytes, coveredBytes, coveragePercent, gapCount: gaps.length, gaps, segments };
}

export function buildValueDistribution(
  rule: Rule,
  packets: Packet[],
  maxEntries: number
): ValueDistributionEntry[] {
  const rows = buildRuleValidationRows(rule, packets);
  const applicable = rows.filter((r) => r.isApplicable);
  if (applicable.length === 0 || maxEntries <= 0) return [];
  const groups = new Map<string, ValueDistributionEntry>();
  for (const row of applicable) {
    const key = `${row.value}${DISTRIBUTION_KEY_SEPARATOR}${row.hexText}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.packetIds.push(row.packetId);
    } else {
      groups.set(key, { value: row.value, hexText: row.hexText, count: 1, percent: 0, packetIds: [row.packetId] });
    }
  }
  const entries = Array.from(groups.values());
  for (const entry of entries) {
    entry.percent = Math.round((entry.count / applicable.length) * PERCENT_MULTIPLIER);
  }
  entries.sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
  return entries.slice(0, maxEntries);
}

function getExpectedLength(dataType: RuleDataType): number | null {
  return DATA_TYPE_OPTIONS.find((o) => o.value === dataType)?.expectedLength ?? null;
}

export function sanitizeFieldName(name: string, fallbackSuffix: string): string {
  const snake = name
    .trim()
    .toLowerCase()
    .replace(WHITESPACE_PATTERN, UNDERSCORE_CHAR)
    .replace(INVALID_FIELD_CHARS_PATTERN, UNDERSCORE_CHAR)
    .replace(MULTIPLE_UNDERSCORES_PATTERN, UNDERSCORE_CHAR);
  const cleaned = snake.replace(/^_+|_+$/g, '');
  if (cleaned.length === 0 || LEADING_DIGIT_PATTERN.test(cleaned)) {
    return `${FALLBACK_FIELD_PREFIX}_${fallbackSuffix}`;
  }
  return cleaned;
}

function mapDataTypeToCType(dataType: RuleDataType, length: number): { base: string; isArray: boolean } {
  const expected = getExpectedLength(dataType);
  if (dataType === 'ascii') return { base: 'char', isArray: true };
  if (dataType === 'bytes') return { base: 'uint8_t', isArray: true };
  if (expected !== null && length !== expected) return { base: 'uint8_t', isArray: true };
  switch (dataType) {
    case 'uint8': return { base: 'uint8_t', isArray: false };
    case 'int8': return { base: 'int8_t', isArray: false };
    case 'uint16_be':
    case 'uint16_le': return { base: 'uint16_t', isArray: false };
    case 'int16_be':
    case 'int16_le': return { base: 'int16_t', isArray: false };
    case 'uint32_be':
    case 'uint32_le':
    case 'ipv4': return { base: 'uint32_t', isArray: false };
    case 'int32_be':
    case 'int32_le': return { base: 'int32_t', isArray: false };
    case 'float32_be':
    case 'float32_le': return { base: 'float', isArray: false };
    case 'float64_be':
    case 'float64_le': return { base: 'double', isArray: false };
    default: {
      const exhaustive: never = dataType;
      return exhaustive;
    }
  }
}

export function generateCStruct(rules: Rule[], structName: string = DEFAULT_STRUCT_NAME): string {
  if (rules.length === 0) return '// No rules defined yet';
  const startRules = [...rules].filter((r) => r.anchor === "start").sort((a, b) => a.offset - b.offset);
  const endRules = [...rules].filter((r) => r.anchor === "end").sort((a, b) => a.offset - b.offset);
  const lines: string[] = ['#include <stdint.h>', '', '#pragma pack(push, 1)', `typedef struct {`];
  let cursor = 0;
  let gapIndex = 0;
  for (const rule of startRules) {
    if (rule.offset > cursor) {
      const gapLen = rule.offset - cursor;
      lines.push(`    uint8_t _gap${gapIndex}[${gapLen}]; // ${formatHexAddress(cursor)} uncovered`);
      gapIndex += 1;
      cursor = rule.offset;
    } else if (rule.offset < cursor) {
      lines.push(`    // ⚠ overlap: "${rule.name}" overlaps ${cursor - rule.offset} bytes`);
    }
    const field = sanitizeFieldName(rule.name, formatHexAddress(rule.offset).toLowerCase());
    const mapped = mapDataTypeToCType(rule.data_type, rule.length);
    const decl = mapped.isArray ? `${mapped.base} ${field}[${rule.length}]` : `${mapped.base} ${field}`;
    lines.push(`    ${decl}; // ${formatHexAddress(rule.offset)} len=${rule.length} [${rule.data_type}]`);
    cursor = Math.max(cursor, rule.offset + rule.length);
  }
  lines.push(`} ${structName};`);
  lines.push('#pragma pack(pop)');
  if (endRules.length > 0) {
    lines.push('');
    lines.push('// Tail-anchored fields (offset from end):');
    for (const rule of endRules) {
      const field = sanitizeFieldName(rule.name, formatHexAddress(rule.offset).toLowerCase());
      const mapped = mapDataTypeToCType(rule.data_type, rule.length);
      const decl = mapped.isArray ? `${mapped.base} ${field}[${rule.length}]` : `${mapped.base} ${field}`;
      lines.push(`// - ${decl}; // end-${formatHexAddress(rule.offset)} len=${rule.length} [${rule.data_type}] "${rule.name}"`);
    }
  }
  return lines.join('\n');
}

function mapDataTypeToPyFormat(dataType: RuleDataType): string {
  switch (dataType) {
    case 'uint8': return 'B';
    case 'int8': return 'b';
    case 'uint16_be': return '>H';
    case 'uint16_le': return '<H';
    case 'int16_be': return '>h';
    case 'int16_le': return '<h';
    case 'uint32_be': return '>I';
    case 'uint32_le': return '<I';
    case 'int32_be': return '>i';
    case 'int32_le': return '<i';
    case 'float32_be': return '>f';
    case 'float32_le': return '<f';
    case 'float64_be': return '>d';
    case 'float64_le': return '<d';
    case 'ipv4': return '4s';
    default: return 'B';
  }
}

export function generatePythonParser(rules: Rule[]): string {
  if (rules.length === 0) return '# No rules defined yet';
  const sorted = [...rules].sort((a, b) => a.offset - b.offset);
  const maxStartEnd = sorted.filter((r) => r.anchor === "start").reduce((m, r) => Math.max(m, r.offset + r.length), 0);
  const maxEndRequired = sorted.filter((r) => r.anchor === "end").reduce((m, r) => Math.max(m, r.offset + r.length), 0);
  const maxEnd = Math.max(maxStartEnd, maxEndRequired);
  const lines: string[] = [
    'import socket',
    'import struct',
    '',
    '',
    'def parse_packet(payload: bytes) -> dict:',
    '    """Auto-generated by Protocol Lab."""',
    `    if len(payload) < ${maxEnd}:`,
    '        raise ValueError(f"packet too short: {len(payload)}")',
    '    result = {}',
  ];
  const needsSocket = sorted.some((r) => r.data_type === 'ipv4');
  for (const rule of sorted) {
    const key = JSON.stringify(rule.name.trim() || `field_${rule.offset}`);
    if (rule.anchor === "start") {
      const off = rule.offset;
      const len = rule.length;
      if (rule.data_type === 'ascii') {
        lines.push(`    result[${key}] = payload[${off}:${off + len}].decode("ascii", errors="replace")  # ${formatHexAddress(off)}`);
      } else if (rule.data_type === 'bytes') {
        lines.push(`    result[${key}] = payload[${off}:${off + len}].hex(" ")  # ${formatHexAddress(off)}`);
      } else if (rule.data_type === 'ipv4') {
        lines.push(`    result[${key}] = socket.inet_ntoa(struct.unpack_from("4s", payload, ${off})[0])  # ${formatHexAddress(off)}`);
      } else {
        const fmt = mapDataTypeToPyFormat(rule.data_type);
        lines.push(`    result[${key}] = struct.unpack_from("${fmt}", payload, ${off})[0]  # ${formatHexAddress(off)} [${rule.data_type}]`);
      }
    } else {
      const off = rule.offset;
      const startExpr = `len(payload)-${off + rule.length}`;
      const endExpr = off === 0 ? `len(payload)` : `len(payload)-${off}`;
      const atExpr = `len(payload)-${off + rule.length}`;
      if (rule.data_type === 'ascii') {
        lines.push(`    result[${key}] = payload[${startExpr}:${off === 0 ? '' : endExpr}].decode("ascii", errors="replace")  # end-${formatHexAddress(off)}`);
      } else if (rule.data_type === 'bytes') {
        lines.push(`    result[${key}] = payload[${startExpr}:${off === 0 ? '' : endExpr}].hex(" ")  # end-${formatHexAddress(off)}`);
      } else if (rule.data_type === 'ipv4') {
        lines.push(`    result[${key}] = socket.inet_ntoa(struct.unpack_from("4s", payload, ${atExpr})[0])  # end-${formatHexAddress(off)}`);
      } else {
        const fmt = mapDataTypeToPyFormat(rule.data_type);
        lines.push(`    result[${key}] = struct.unpack_from("${fmt}", payload, ${atExpr})[0]  # end-${formatHexAddress(off)} [${rule.data_type}]`);
      }
    }
  }
  lines.push('    return result');
  if (!needsSocket) {
    return lines.filter((l) => l !== 'import socket').join('\n');
  }
  return lines.join('\n');
}

export function generateMarkdownTable(rules: Rule[]): string {
  if (rules.length === 0) return '_No rules defined yet_';
  const sorted = [...rules].sort((a, b) => {
    if (a.anchor !== b.anchor) return a.anchor === "start" ? -1 : 1;
    return a.offset - b.offset;
  });
  const lines: string[] = ['| Offset | Anchor | Name | Type | Length |', '|---|---|---|---|---|'];
  for (const rule of sorted) {
    const safeName = rule.name.replace(/\|/g, '\\|');
    const offsetLabel = rule.anchor === "start" ? formatHexAddress(rule.offset) : `end-${formatHexAddress(rule.offset)}`;
    lines.push(`| ${offsetLabel} | ${rule.anchor} | ${safeName} | \`${rule.data_type}\` | ${rule.length} |`);
  }
  return lines.join('\n');
}