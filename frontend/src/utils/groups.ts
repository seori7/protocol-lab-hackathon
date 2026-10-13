import type { Rule, GroupedRuleSection } from '../types';
import { GROUP_DELIMITERS } from '../constants/ux';

const NOT_FOUND_INDEX = -1;
const MIN_GROUP_PART_LENGTH = 1;

export interface ParsedGroupName {
  groupName: string | null;
  shortName: string;
}

export function parseRuleGroup(name: string): ParsedGroupName {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { groupName: null, shortName: name };
  }
  let delimIndex = NOT_FOUND_INDEX;
  let delimLen = 0;
  for (const delim of GROUP_DELIMITERS) {
    const idx = trimmed.indexOf(delim);
    if (idx > 0 && (delimIndex === NOT_FOUND_INDEX || idx < delimIndex)) {
      delimIndex = idx;
      delimLen = delim.length;
    }
  }
  if (delimIndex === NOT_FOUND_INDEX) {
    return { groupName: null, shortName: trimmed };
  }
  const group = trimmed.slice(0, delimIndex).trim();
  const short = trimmed.slice(delimIndex + delimLen).trim();
  if (group.length < MIN_GROUP_PART_LENGTH || short.length < MIN_GROUP_PART_LENGTH) {
    return { groupName: null, shortName: trimmed };
  }
  return { groupName: group, shortName: short };
}

export function groupAndSortRules(rules: Rule[]): GroupedRuleSection[] {
  const sorted = [...rules].sort((a, b) => a.offset - b.offset);
  const map = new Map<string, Rule[]>();
  const ungrouped: Rule[] = [];
  for (const rule of sorted) {
    const { groupName } = parseRuleGroup(rule.name);
    if (!groupName) {
      ungrouped.push(rule);
    } else {
      const arr = map.get(groupName) ?? [];
      arr.push(rule);
      map.set(groupName, arr);
    }
  }
  const grouped: GroupedRuleSection[] = Array.from(map.entries())
    .map(([groupName, groupRules]) => ({ groupName, rules: groupRules }))
    .sort((a, b) => (a.groupName ?? '').localeCompare(b.groupName ?? '', 'ru'));
  if (ungrouped.length > 0) {
    grouped.push({ groupName: null, rules: ungrouped });
  }
  return grouped;
}