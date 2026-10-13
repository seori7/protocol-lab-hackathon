import type { DataTypeOption, RuleColorTheme, RuleDataType } from '../types';

export const RULE_COLOR_PALETTE: RuleColorTheme[] = [
  {
    id: 'emerald',
    byteBackground: 'bg-emerald-500/25',
    byteBackgroundActive: 'bg-emerald-400/50',
    byteText: 'text-emerald-100',
    dotBackground: 'bg-emerald-400',
    chipBackground: 'bg-emerald-500/10',
    chipBorder: 'border-emerald-500/30',
  },
  {
    id: 'amber',
    byteBackground: 'bg-amber-500/25',
    byteBackgroundActive: 'bg-amber-400/50',
    byteText: 'text-amber-100',
    dotBackground: 'bg-amber-400',
    chipBackground: 'bg-amber-500/10',
    chipBorder: 'border-amber-500/30',
  },
  {
    id: 'violet',
    byteBackground: 'bg-violet-500/25',
    byteBackgroundActive: 'bg-violet-400/50',
    byteText: 'text-violet-100',
    dotBackground: 'bg-violet-400',
    chipBackground: 'bg-violet-500/10',
    chipBorder: 'border-violet-500/30',
  },
  {
    id: 'cyan',
    byteBackground: 'bg-cyan-500/25',
    byteBackgroundActive: 'bg-cyan-400/50',
    byteText: 'text-cyan-100',
    dotBackground: 'bg-cyan-400',
    chipBackground: 'bg-cyan-500/10',
    chipBorder: 'border-cyan-500/30',
  },
  {
    id: 'rose',
    byteBackground: 'bg-rose-500/25',
    byteBackgroundActive: 'bg-rose-400/50',
    byteText: 'text-rose-100',
    dotBackground: 'bg-rose-400',
    chipBackground: 'bg-rose-500/10',
    chipBorder: 'border-rose-500/30',
  },
  {
    id: 'orange',
    byteBackground: 'bg-orange-500/25',
    byteBackgroundActive: 'bg-orange-400/50',
    byteText: 'text-orange-100',
    dotBackground: 'bg-orange-400',
    chipBackground: 'bg-orange-500/10',
    chipBorder: 'border-orange-500/30',
  },
  {
    id: 'lime',
    byteBackground: 'bg-lime-500/25',
    byteBackgroundActive: 'bg-lime-400/50',
    byteText: 'text-lime-100',
    dotBackground: 'bg-lime-400',
    chipBackground: 'bg-lime-500/10',
    chipBorder: 'border-lime-500/30',
  },
  {
    id: 'sky',
    byteBackground: 'bg-sky-500/25',
    byteBackgroundActive: 'bg-sky-400/50',
    byteText: 'text-sky-100',
    dotBackground: 'bg-sky-400',
    chipBackground: 'bg-sky-500/10',
    chipBorder: 'border-sky-500/30',
  },
];

export const DATA_TYPE_OPTIONS: DataTypeOption[] = [
  { value: 'bytes', label: 'bytes', hint: 'Сырые байты, любая длина', expectedLength: null },
  { value: 'ascii', label: 'ascii', hint: 'Текст, любая длина', expectedLength: null },
  { value: 'uint8', label: 'uint8', hint: '1 байт, 0–255', expectedLength: 1 },
  { value: 'int8', label: 'int8', hint: '1 байт, −128–127', expectedLength: 1 },
  { value: 'uint16_be', label: 'uint16 BE', hint: '2 байта, big-endian', expectedLength: 2 },
  { value: 'uint16_le', label: 'uint16 LE', hint: '2 байта, little-endian', expectedLength: 2 },
  { value: 'int16_be', label: 'int16 BE', hint: '2 байта signed BE', expectedLength: 2 },
  { value: 'int16_le', label: 'int16 LE', hint: '2 байта signed LE', expectedLength: 2 },
  { value: 'uint32_be', label: 'uint32 BE', hint: '4 байта, big-endian', expectedLength: 4 },
  { value: 'uint32_le', label: 'uint32 LE', hint: '4 байта, little-endian', expectedLength: 4 },
  { value: 'int32_be', label: 'int32 BE', hint: '4 байта signed BE', expectedLength: 4 },
  { value: 'int32_le', label: 'int32 LE', hint: '4 байта signed LE', expectedLength: 4 },
  { value: 'float32_be', label: 'float32 BE', hint: '4 байта IEEE754 BE', expectedLength: 4 },
  { value: 'float32_le', label: 'float32 LE', hint: '4 байта IEEE754 LE', expectedLength: 4 },
  { value: 'float64_be', label: 'float64 BE', hint: '8 байт double BE', expectedLength: 8 },
  { value: 'float64_le', label: 'float64 LE', hint: '8 байт double LE', expectedLength: 8 },
  { value: 'ipv4', label: 'ipv4', hint: '4 байта, 192.168.0.1', expectedLength: 4 },
];

export const DEFAULT_RULE_DATA_TYPE: RuleDataType = 'bytes';

export const RULE_NAME_MAX_LENGTH = 48;
export const RULE_NAME_MIN_TRIMMED_LENGTH = 1;
export const RULE_NAME_PLACEHOLDER = 'Например: Длина сообщения';