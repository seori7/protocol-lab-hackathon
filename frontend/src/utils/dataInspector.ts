import type { ByteRange, DataInspectorRow, RuleDataType } from '../types';
import { DATA_TYPE_OPTIONS } from '../constants/rules';
import {
  extractHexBytesForRange, interpretHexBytes, formatHexAddress,
} from './hex';

const INCLUSIVE_RANGE_ADJUSTMENT = 1;

export function buildDataInspectorRows(
  selectedRange: ByteRange | null,
  payloadHex: string
): DataInspectorRow[] {
  if (!selectedRange) return [];
  const selectedLength = selectedRange.end - selectedRange.start + INCLUSIVE_RANGE_ADJUSTMENT;
  const hexBytes = extractHexBytesForRange(payloadHex, selectedRange);
  if (hexBytes.length !== selectedLength) return [];

  const rows: DataInspectorRow[] = DATA_TYPE_OPTIONS.map((opt) => {
    const isApplicable =
      opt.expectedLength === null || opt.expectedLength === selectedLength;
    const value = interpretHexBytes(hexBytes, opt.value);
    const reason = isApplicable
      ? null
      : `нужно ${opt.expectedLength}, выбрано ${selectedLength}`;
    return {
      dataType: opt.value,
      label: opt.label,
      hint: opt.hint,
      value,
      isApplicable,
      applicabilityReason: reason,
    };
  });

  const applicable = rows.filter((r) => r.isApplicable);
  const rest = rows.filter((r) => !r.isApplicable);
  return [...applicable, ...rest];
}

export function buildDefaultInspectorName(dataType: RuleDataType, offset: number): string {
  const label = DATA_TYPE_OPTIONS.find((o) => o.value === dataType)?.label ?? dataType;
  return `${label} ${formatHexAddress(offset)}`;
}