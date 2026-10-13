import type { Rule, LastProjectInfo, RuleAnchor, RuleDataType } from '../types';
import {
  STORAGE_KEY_LAST_PROJECT_ID, STORAGE_KEY_LAST_FILENAME, STORAGE_KEY_RULES_PREFIX,
} from '../constants/api';
import { DATA_TYPE_OPTIONS } from '../constants/rules';

const ALLOWED_DATA_TYPES: ReadonlySet<string> = new Set(
  DATA_TYPE_OPTIONS.map((o) => o.value)
);

interface StoredRuleRaw {
  id: string;
  name: string;
  offset: number;
  length: number;
  data_type: RuleDataType;
  anchor?: unknown;
  colorIndex: number;
  createdAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredRule(value: unknown): value is StoredRuleRaw {
  if (!isRecord(value)) return false;
  const baseOk =
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.offset === 'number' && Number.isInteger(value.offset) && value.offset >= 0 &&
    typeof value.length === 'number' && Number.isInteger(value.length) && value.length > 0 &&
    typeof value.data_type === 'string' && ALLOWED_DATA_TYPES.has(value.data_type) &&
    typeof value.colorIndex === 'number' &&
    typeof value.createdAt === 'number';
  if (!baseOk) return false;
  const anchorRaw = value.anchor;
  if (anchorRaw === undefined) return true;
  return anchorRaw === 'start' || anchorRaw === 'end';
}

export function buildRulesStorageKey(projectId: string): string {
  return `${STORAGE_KEY_RULES_PREFIX}${projectId}`;
}

export function loadRulesForProject(projectId: string): Rule[] {
  try {
    const raw = localStorage.getItem(buildRulesStorageKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Явно приводим к unknown[] чтобы не зависеть от narrowing Array.isArray
    const items = parsed as unknown[];
    const result: Rule[] = [];
    for (const item of items) {
      if (!isStoredRule(item)) continue;
      const anchor: RuleAnchor = item.anchor === 'end' ? 'end' : 'start';
      result.push({
        id: item.id,
        name: item.name,
        offset: item.offset,
        length: item.length,
        data_type: item.data_type,
        anchor,
        colorIndex: item.colorIndex,
        createdAt: item.createdAt,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export function saveRulesForProject(projectId: string, rules: Rule[]): void {
  try {
    localStorage.setItem(buildRulesStorageKey(projectId), JSON.stringify(rules));
  } catch { /* quota / private mode */ }
}

export function loadLastProject(): LastProjectInfo | null {
  try {
    const projectId = localStorage.getItem(STORAGE_KEY_LAST_PROJECT_ID);
    if (!projectId) return null;
    const filename = localStorage.getItem(STORAGE_KEY_LAST_FILENAME) ?? projectId;
    return { projectId, filename };
  } catch {
    return null;
  }
}

export function saveLastProject(projectId: string, filename: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_PROJECT_ID, projectId);
    localStorage.setItem(STORAGE_KEY_LAST_FILENAME, filename);
  } catch { /* ignore */ }
}

export function clearLastProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_LAST_PROJECT_ID);
    localStorage.removeItem(STORAGE_KEY_LAST_FILENAME);
  } catch { /* ignore */ }
}