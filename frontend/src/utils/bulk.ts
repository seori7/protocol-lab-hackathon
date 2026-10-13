import type { Rule, NewRuleDraft } from '../types';
import { RULE_NAME_MAX_LENGTH } from '../constants/rules';

const DUPLICATE_NAME_SUFFIX = ' copy';
const DUPLICATE_COUNTER_START = 2;
const DUPLICATE_MAX_ATTEMPTS = 100;

export function buildDuplicateDraft(source: Rule, existingRules: Rule[]): NewRuleDraft {
  const existingNames = new Set<string>();
  for (const r of existingRules) {
    existingNames.add(r.name);
  }

  let baseName = `${source.name}${DUPLICATE_NAME_SUFFIX}`;
  if (baseName.length > RULE_NAME_MAX_LENGTH) {
    baseName = baseName.slice(0, RULE_NAME_MAX_LENGTH);
  }

  let name = baseName;
  let counter = DUPLICATE_COUNTER_START;
  let attempts = 0;
  while (existingNames.has(name) && attempts < DUPLICATE_MAX_ATTEMPTS) {
    const suffix = ` ${counter}`;
    const truncated = baseName.slice(0, RULE_NAME_MAX_LENGTH - suffix.length);
    name = `${truncated}${suffix}`;
    counter += 1;
    attempts += 1;
  }

  return {
    name,
    data_type: source.data_type,
    offset: source.offset,
    length: source.length,
    anchor: source.anchor,
  };
}