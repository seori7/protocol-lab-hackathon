import type {
  Rule, NewRuleDraft, RuleDataType, PacketNotesMap,
  BackendRuleDef, BackendEndianness,
} from '../types';
import { NOTE_MAX_LENGTH } from '../constants/meta';

const PACKET_ID_RADIX = 10;
const BIG_ENDIAN: BackendEndianness = "big";
const LITTLE_ENDIAN: BackendEndianness = "little";

interface BackendTypeMapping {
  data_type: string;
  endianness: BackendEndianness;
}

const FRONTEND_TO_BACKEND_MAP: Record<RuleDataType, BackendTypeMapping> = {
  bytes: { data_type: "bytes", endianness: BIG_ENDIAN },
  ascii: { data_type: "string", endianness: BIG_ENDIAN },
  uint8: { data_type: "uint8", endianness: BIG_ENDIAN },
  int8: { data_type: "int8", endianness: BIG_ENDIAN },
  uint16_be: { data_type: "uint16", endianness: BIG_ENDIAN },
  uint16_le: { data_type: "uint16", endianness: LITTLE_ENDIAN },
  int16_be: { data_type: "int16", endianness: BIG_ENDIAN },
  int16_le: { data_type: "int16", endianness: LITTLE_ENDIAN },
  uint32_be: { data_type: "uint32", endianness: BIG_ENDIAN },
  uint32_le: { data_type: "uint32", endianness: LITTLE_ENDIAN },
  int32_be: { data_type: "int32", endianness: BIG_ENDIAN },
  int32_le: { data_type: "int32", endianness: LITTLE_ENDIAN },
  float32_be: { data_type: "float32", endianness: BIG_ENDIAN },
  float32_le: { data_type: "float32", endianness: LITTLE_ENDIAN },
  float64_be: { data_type: "float64", endianness: BIG_ENDIAN },
  float64_le: { data_type: "float64", endianness: LITTLE_ENDIAN },
  ipv4: { data_type: "ipv4", endianness: BIG_ENDIAN },
};

export function toBackendRule(rule: Rule): BackendRuleDef | null {
  if (rule.anchor === "end") {
    return null;
  }
  const mapped = FRONTEND_TO_BACKEND_MAP[rule.data_type];
  return {
    id: rule.id,
    name: rule.name,
    offset: rule.offset,
    length: rule.length,
    data_type: mapped.data_type,
    endianness: mapped.endianness,
  };
}

export interface BackendRulesConversion {
  backendRules: BackendRuleDef[];
  skippedEndCount: number;
  skippedEndNames: string[];
}

export function toBackendRules(rules: Rule[]): BackendRulesConversion {
  const backendRules: BackendRuleDef[] = [];
  const skippedEndNames: string[] = [];
  for (const rule of rules) {
    const converted = toBackendRule(rule);
    if (converted === null) {
      skippedEndNames.push(rule.name);
    } else {
      backendRules.push(converted);
    }
  }
  return { backendRules, skippedEndCount: skippedEndNames.length, skippedEndNames };
}

export function backendToFrontendType(dataType: string, endianness: string): RuleDataType {
  const isLittle = endianness !== "big";
  const normalized = dataType.trim().toLowerCase();
  switch (normalized) {
    case "uint8": return "uint8";
    case "int8": return "int8";
    case "uint16": return isLittle ? "uint16_le" : "uint16_be";
    case "int16": return isLittle ? "int16_le" : "int16_be";
    case "uint32": return isLittle ? "uint32_le" : "uint32_be";
    case "int32": return isLittle ? "int32_le" : "int32_be";
    case "float32": return isLittle ? "float32_le" : "float32_be";
    case "float64": return isLittle ? "float64_le" : "float64_be";
    case "string": return "ascii";
    case "bytes": return "bytes";
    case "ipv4": return "ipv4";
    default: return "bytes";
  }
}

export function backendRuleToDraft(backendRule: BackendRuleDef): NewRuleDraft {
  return {
    name: backendRule.name,
    data_type: backendToFrontendType(backendRule.data_type, backendRule.endianness),
    offset: backendRule.offset,
    length: backendRule.length,
    anchor: "start",
  };
}

export function serializeNotes(notes: PacketNotesMap): string {
  return JSON.stringify(notes);
}

export function parseNotesString(notesStr: string): PacketNotesMap | null {
  const trimmed = notesStr.trim();
  if (trimmed.length === 0) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const result: PacketNotesMap = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== "string") continue;
      const text = value.trim();
      if (text.length === 0) continue;
      const id = parseInt(key, PACKET_ID_RADIX);
      if (Number.isNaN(id)) continue;
      result[id] = text.slice(0, NOTE_MAX_LENGTH);
    }
    return result;
  } catch {
    return null;
  }
}