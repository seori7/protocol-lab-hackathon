import { RULE_COLOR_PALETTE } from '../constants/rules';
import type { ByteRange, Rule, RuleColorTheme, RuleDataType } from '../types';

const HEX_RADIX = 16;
const HEX_CHARS_PER_BYTE = 2;
const OFFSET_HEX_LENGTH = 4;
const HEX_ADDRESS_PREFIX = '0x';

const ASCII_PRINTABLE_MIN = 32;
const ASCII_PRINTABLE_MAX = 126;
const ASCII_FALLBACK_CHAR = '.';

const UINT8_BYTE_LENGTH = 1;
const INT8_BYTE_LENGTH = 1;
const UINT16_BYTE_LENGTH = 2;
const INT16_BYTE_LENGTH = 2;
const UINT32_BYTE_LENGTH = 4;
const INT32_BYTE_LENGTH = 4;
const FLOAT32_BYTE_LENGTH = 4;
const FLOAT64_BYTE_LENGTH = 8;
const IPV4_BYTE_LENGTH = 4;

const BYTE_BASE_256 = 256;
const BYTE_BASE_65536 = 65536;
const BYTE_BASE_16777216 = 16777216;

const INT8_SIGN_THRESHOLD = 128;
const INT8_MODULO = 256;
const INT16_SIGN_THRESHOLD = 32768;
const INT16_MODULO = 65536;
const INT32_SIGN_THRESHOLD = 2147483648;
const INT32_MODULO = 4294967296;

const RANDOM_SUFFIX_MAX = 100000;
const ID_FALLBACK_PREFIX = 'rule';

export const EMPTY_VALUE_PLACEHOLDER = '—';

export function formatOffset(offset: number): string {
  return offset.toString(HEX_RADIX).padStart(OFFSET_HEX_LENGTH, '0').toUpperCase();
}

export function formatHexAddress(offset: number): string {
  return `${HEX_ADDRESS_PREFIX}${formatOffset(offset)}`;
}

export function generateRuleId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const randomSuffix = Math.floor(Math.random() * RANDOM_SUFFIX_MAX);
  return `${ID_FALLBACK_PREFIX}-${Date.now()}-${randomSuffix}`;
}

export function getRuleColor(colorIndex: number): RuleColorTheme {
  const paletteSize = RULE_COLOR_PALETTE.length;
  if (paletteSize === 0) {
    throw new Error('RULE_COLOR_PALETTE is empty');
  }
  const normalizedIndex = ((colorIndex % paletteSize) + paletteSize) % paletteSize;
  return RULE_COLOR_PALETTE[normalizedIndex] as RuleColorTheme;
}

export function extractHexBytesForRange(payloadHex: string, range: ByteRange): string[] {
  const result: string[] = [];
  for (let offset = range.start; offset <= range.end; offset++) {
    const charPos = offset * HEX_CHARS_PER_BYTE;
    const hexPair = payloadHex.substring(charPos, charPos + HEX_CHARS_PER_BYTE).toUpperCase();
    if (hexPair.length < HEX_CHARS_PER_BYTE) break;
    result.push(hexPair);
  }
  return result;
}

function decodeFloat32(byteValues: number[], littleEndian: boolean): number {
  const buffer = new ArrayBuffer(FLOAT32_BYTE_LENGTH);
  const view = new DataView(buffer);
  for (let i = 0; i < FLOAT32_BYTE_LENGTH; i++) {
    view.setUint8(i, byteValues[i] as number);
  }
  return view.getFloat32(0, littleEndian);
}

function decodeFloat64(byteValues: number[], littleEndian: boolean): number {
  const buffer = new ArrayBuffer(FLOAT64_BYTE_LENGTH);
  const view = new DataView(buffer);
  for (let i = 0; i < FLOAT64_BYTE_LENGTH; i++) {
    view.setUint8(i, byteValues[i] as number);
  }
  return view.getFloat64(0, littleEndian);
}

function formatFloatValue(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  return value.toString();
}

export function interpretHexBytes(hexBytes: string[], dataType: RuleDataType): string {
  if (hexBytes.length === 0) {
    return EMPTY_VALUE_PLACEHOLDER;
  }

  if (dataType === 'bytes') {
    return hexBytes.join(' ');
  }

  const byteValues: number[] = hexBytes.map((h) => parseInt(h, HEX_RADIX));

  switch (dataType) {
    case 'ascii': {
      return byteValues
        .map((code) => {
          const isPrintable = code >= ASCII_PRINTABLE_MIN && code <= ASCII_PRINTABLE_MAX;
          return isPrintable ? String.fromCharCode(code) : ASCII_FALLBACK_CHAR;
        })
        .join('');
    }
    case 'uint8': {
      if (hexBytes.length !== UINT8_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return (byteValues[0] as number).toString();
    }
    case 'int8': {
      if (hexBytes.length !== INT8_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const unsigned = byteValues[0] as number;
      const signed = unsigned >= INT8_SIGN_THRESHOLD ? unsigned - INT8_MODULO : unsigned;
      return signed.toString();
    }
    case 'uint16_be': {
      if (hexBytes.length !== UINT16_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const high = byteValues[0] as number;
      const low = byteValues[1] as number;
      return (high * BYTE_BASE_256 + low).toString();
    }
    case 'uint16_le': {
      if (hexBytes.length !== UINT16_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const low = byteValues[0] as number;
      const high = byteValues[1] as number;
      return (high * BYTE_BASE_256 + low).toString();
    }
    case 'int16_be': {
      if (hexBytes.length !== INT16_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const high = byteValues[0] as number;
      const low = byteValues[1] as number;
      const unsigned = high * BYTE_BASE_256 + low;
      const signed = unsigned >= INT16_SIGN_THRESHOLD ? unsigned - INT16_MODULO : unsigned;
      return signed.toString();
    }
    case 'int16_le': {
      if (hexBytes.length !== INT16_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const low = byteValues[0] as number;
      const high = byteValues[1] as number;
      const unsigned = high * BYTE_BASE_256 + low;
      const signed = unsigned >= INT16_SIGN_THRESHOLD ? unsigned - INT16_MODULO : unsigned;
      return signed.toString();
    }
    case 'uint32_be': {
      if (hexBytes.length !== UINT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const b0 = byteValues[0] as number;
      const b1 = byteValues[1] as number;
      const b2 = byteValues[2] as number;
      const b3 = byteValues[3] as number;
      const value = b0 * BYTE_BASE_16777216 + b1 * BYTE_BASE_65536 + b2 * BYTE_BASE_256 + b3;
      return value.toString();
    }
    case 'uint32_le': {
      if (hexBytes.length !== UINT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const b0 = byteValues[0] as number;
      const b1 = byteValues[1] as number;
      const b2 = byteValues[2] as number;
      const b3 = byteValues[3] as number;
      const value = b3 * BYTE_BASE_16777216 + b2 * BYTE_BASE_65536 + b1 * BYTE_BASE_256 + b0;
      return value.toString();
    }
    case 'int32_be': {
      if (hexBytes.length !== INT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const b0 = byteValues[0] as number;
      const b1 = byteValues[1] as number;
      const b2 = byteValues[2] as number;
      const b3 = byteValues[3] as number;
      const unsigned = b0 * BYTE_BASE_16777216 + b1 * BYTE_BASE_65536 + b2 * BYTE_BASE_256 + b3;
      const signed = unsigned >= INT32_SIGN_THRESHOLD ? unsigned - INT32_MODULO : unsigned;
      return signed.toString();
    }
    case 'int32_le': {
      if (hexBytes.length !== INT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      const b0 = byteValues[0] as number;
      const b1 = byteValues[1] as number;
      const b2 = byteValues[2] as number;
      const b3 = byteValues[3] as number;
      const unsigned = b3 * BYTE_BASE_16777216 + b2 * BYTE_BASE_65536 + b1 * BYTE_BASE_256 + b0;
      const signed = unsigned >= INT32_SIGN_THRESHOLD ? unsigned - INT32_MODULO : unsigned;
      return signed.toString();
    }
    case 'float32_be': {
      if (hexBytes.length !== FLOAT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return formatFloatValue(decodeFloat32(byteValues, false));
    }
    case 'float32_le': {
      if (hexBytes.length !== FLOAT32_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return formatFloatValue(decodeFloat32(byteValues, true));
    }
    case 'float64_be': {
      if (hexBytes.length !== FLOAT64_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return formatFloatValue(decodeFloat64(byteValues, false));
    }
    case 'float64_le': {
      if (hexBytes.length !== FLOAT64_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return formatFloatValue(decodeFloat64(byteValues, true));
    }
    case 'ipv4': {
      if (hexBytes.length !== IPV4_BYTE_LENGTH) return EMPTY_VALUE_PLACEHOLDER;
      return byteValues.join('.');
    }
    default: {
      const exhaustiveCheck: never = dataType;
      return exhaustiveCheck;
    }
  }
}

import { resolveRuleStart } from './anchor';

export function getRuleValueForPayload(payloadHex: string, rule: Rule): string {
  const totalBytes = Math.floor(payloadHex.length / HEX_CHARS_PER_BYTE);
  const effective = resolveRuleStart(rule, totalBytes);
  if (effective === null) {
    return EMPTY_VALUE_PLACEHOLDER;
  }
  const range: ByteRange = { start: effective, end: effective + rule.length - 1 };
  const hexBytes = extractHexBytesForRange(payloadHex, range);
  return interpretHexBytes(hexBytes, rule.data_type);
}