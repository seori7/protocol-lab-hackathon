import type { PacketNotesMap } from '../types';
import { META_BOOKMARKS_PREFIX, META_NOTES_PREFIX, META_KEY_SEPARATOR } from '../constants/meta';
import { NOTE_MAX_LENGTH } from '../constants/meta';

const PACKET_ID_RADIX = 10;

function buildBookmarksKey(projectId: string, sessionId: string): string {
  return `${META_BOOKMARKS_PREFIX}${projectId}${META_KEY_SEPARATOR}${sessionId}`;
}

function buildNotesKey(projectId: string, sessionId: string): string {
  return `${META_NOTES_PREFIX}${projectId}${META_KEY_SEPARATOR}${sessionId}`;
}

/** Загружает закладки. Битые id отбрасываем. */
export function loadBookmarks(projectId: string, sessionId: string): Set<number> {
  try {
    const raw = localStorage.getItem(buildBookmarksKey(projectId, sessionId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const result = new Set<number>();
    for (const item of parsed) {
      if (typeof item === 'number' && Number.isInteger(item)) {
        result.add(item);
      }
    }
    return result;
  } catch {
    return new Set();
  }
}

export function saveBookmarks(projectId: string, sessionId: string, ids: Set<number>): void {
  try {
    localStorage.setItem(buildBookmarksKey(projectId, sessionId), JSON.stringify(Array.from(ids)));
  } catch { /* quota */ }
}

export function loadPacketNotes(projectId: string, sessionId: string): PacketNotesMap {
  try {
    const raw = localStorage.getItem(buildNotesKey(projectId, sessionId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const result: PacketNotesMap = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      const id = parseInt(key, PACKET_ID_RADIX);
      if (Number.isNaN(id)) continue;
      result[id] = trimmed.slice(0, NOTE_MAX_LENGTH);
    }
    return result;
  } catch {
    return {};
  }
}

export function savePacketNotes(projectId: string, sessionId: string, notes: PacketNotesMap): void {
  try {
    localStorage.setItem(buildNotesKey(projectId, sessionId), JSON.stringify(notes));
  } catch { /* quota */ }
}