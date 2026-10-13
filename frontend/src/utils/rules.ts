import { resolveRuleStart } from './anchor';
import type {
  Rule, NewRuleDraft, BackendRulePayload,
  ParsedRulesImport, Packet, ByteRange, RuleValidationRow,
} from '../types';
import { EXPORT_FILE_PREFIX, EXPORT_FILE_EXTENSION } from '../constants/api';
import { DATA_TYPE_OPTIONS } from '../constants/rules';
import { extractHexBytesForRange, interpretHexBytes, EMPTY_VALUE_PLACEHOLDER } from './hex';

const HEX_CHARS_PER_BYTE = 2;
const MIN_RULE_OFFSET = 0;
const MIN_RULE_LENGTH = 1;
const INCLUSIVE_RANGE_ADJUSTMENT = 1;
const ISO_DATE_START = 0;
const ISO_DATE_END = 10;
const JSON_INDENT_SPACES = 2;
const JSON_MIME_TYPE = 'application/json';

const ALLOWED_DATA_TYPES: ReadonlySet<string> = new Set(
  DATA_TYPE_OPTIONS.map((o) => o.value)
);

export function getPayloadByteLength(payloadHex: string): number {
  return Math.floor(payloadHex.length / HEX_CHARS_PER_BYTE);
}

export function isRuleApplicable(payloadHex: string, rule: Rule): boolean {
  const total = getPayloadByteLength(payloadHex);
  return resolveRuleStart(rule, total) !== null;
}

export function countApplicableRules(payloadHex: string, rules: Rule[]): number {
  let count = 0;
  for (const rule of rules) {
    if (isRuleApplicable(payloadHex, rule)) count++;
  }
  return count;
}

export function buildRuleValidationRows(rule: Rule, packets: Packet[]): RuleValidationRow[] {
  return packets.map((packet) => {
    const total = getPayloadByteLength(packet.payload_hex);
    const effective = resolveRuleStart(rule, total);
    if (effective === null) {
      return {
        packetId: packet.id,
        timestamp: packet.timestamp,
        direction: packet.direction,
        hexText: EMPTY_VALUE_PLACEHOLDER,
        value: EMPTY_VALUE_PLACEHOLDER,
        isApplicable: false,
      };
    }
    const range: ByteRange = { start: effective, end: effective + rule.length - INCLUSIVE_RANGE_ADJUSTMENT };
    const hexBytes = extractHexBytesForRange(packet.payload_hex, range);
    return {
      packetId: packet.id,
      timestamp: packet.timestamp,
      direction: packet.direction,
      hexText: hexBytes.join(' '),
      value: interpretHexBytes(hexBytes, rule.data_type),
      isApplicable: true,
    };
  });
}

export function getOverlappingRules(
  rules: Rule[],
  range: ByteRange,
  excludeRuleId?: string,
  totalBytes?: number
): Rule[] {
  return rules.filter((rule) => {
    if (excludeRuleId !== undefined && rule.id === excludeRuleId) return false;
    if (rule.anchor === "end") {
      if (totalBytes === undefined) return false;
      const effective = resolveRuleStart(rule, totalBytes);
      if (effective === null) return false;
      const ruleEnd = effective + rule.length - INCLUSIVE_RANGE_ADJUSTMENT;
      return range.start <= ruleEnd && effective <= range.end;
    }
    const ruleEnd = rule.offset + rule.length - INCLUSIVE_RANGE_ADJUSTMENT;
    return range.start <= ruleEnd && rule.offset <= range.end;
  });
}

export function toBackendPayload(rules: Rule[]): BackendRulePayload[] {
  return rules.map((r) => ({
    offset: r.offset,
    length: r.length,
    data_type: r.data_type,
    name: r.name,
    anchor: r.anchor,
  }));
}

export function buildExportFilename(): string {
  const datePart = new Date().toISOString().slice(ISO_DATE_START, ISO_DATE_END);
  return `${EXPORT_FILE_PREFIX}-${datePart}${EXPORT_FILE_EXTENSION}`;
}

export function downloadRulesAsJson(rules: Rule[], filename: string): void {
  const payload = toBackendPayload(rules);
  const blob = new Blob([JSON.stringify(payload, null, JSON_INDENT_SPACES)], { type: JSON_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidImportedDraft(value: unknown): value is NewRuleDraft {
  if (!isRecord(value)) return false;
  const nameOk = typeof value.name === 'string' && value.name.trim().length > 0;
  const offsetOk =
    typeof value.offset === 'number' && Number.isInteger(value.offset) && value.offset >= MIN_RULE_OFFSET;
  const lengthOk =
    typeof value.length === 'number' && Number.isInteger(value.length) && value.length >= MIN_RULE_LENGTH;
  const typeOk = typeof value.data_type === 'string' && ALLOWED_DATA_TYPES.has(value.data_type);
    const anchorRaw = value.anchor;
  const anchorOk = anchorRaw === undefined || anchorRaw === "start" || anchorRaw === "end";
  return nameOk && offsetOk && lengthOk && typeOk && anchorOk;
}

export function parseImportedRulesJson(data: unknown): ParsedRulesImport {
  if (!Array.isArray(data)) {
    throw new Error('Файл должен содержать массив правил');
  }
  const drafts: NewRuleDraft[] = [];
  let skipped = 0;
  for (const item of data) {
    if (isValidImportedDraft(item)) {
      drafts.push({
        anchor: (item as { anchor?: unknown }).anchor === "end" ? "end" : "start",
        name: (item.name as string).trim(),
        offset: item.offset as number,
        length: item.length as number,
        data_type: item.data_type as NewRuleDraft['data_type'],
      });
    } else {
      skipped++;
    }
  }
  return { drafts, skipped };
}