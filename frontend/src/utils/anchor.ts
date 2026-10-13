import type { RuleAnchor, ByteRange } from '../types';

const MIN_OFFSET = 0;
const MIN_LENGTH = 1;

interface AnchorLike {
  offset: number;
  length: number;
  anchor: RuleAnchor;
}

export function isValidAnchor(value: unknown): value is RuleAnchor {
  return value === "start" || value === "end";
}

export function resolveRuleStart(rule: AnchorLike, totalBytes: number): number | null {
  if (rule.length < MIN_LENGTH || totalBytes <= 0) return null;
  if (rule.anchor === "start") {
    if (rule.offset < MIN_OFFSET) return null;
    if (rule.offset + rule.length > totalBytes) return null;
    return rule.offset;
  }
  if (rule.offset < MIN_OFFSET) return null;
  const effective = totalBytes - rule.offset - rule.length;
  if (effective < MIN_OFFSET) return null;
  return effective;
}

export function getRuleEffectiveRange(rule: AnchorLike, totalBytes: number): ByteRange | null {
  const start = resolveRuleStart(rule, totalBytes);
  if (start === null) return null;
  return { start, end: start + rule.length - 1 };
}

export function computeEndOffsetForRange(start: number, length: number, totalBytes: number): number {
  return totalBytes - start - length;
}

export function convertAnchorOffset(
  currentOffset: number,
  currentAnchor: RuleAnchor,
  newAnchor: RuleAnchor,
  length: number,
  totalBytes: number
): number | null {
  if (currentAnchor === newAnchor) return currentOffset;
  const effective = resolveRuleStart({ offset: currentOffset, length, anchor: currentAnchor }, totalBytes);
  if (effective === null) return null;
  if (newAnchor === "start") return effective;
  return computeEndOffsetForRange(effective, length, totalBytes);
}