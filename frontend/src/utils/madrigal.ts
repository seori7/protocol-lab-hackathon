import type {
  Rule, MadrigalProjectFile, MadrigalMeta,
  ParsedMadrigalImport, PacketNotesMap,
} from '../types';
import { toBackendPayload, parseImportedRulesJson } from './rules';
import { NOTE_MAX_LENGTH } from '../constants/meta';

export const MADRIGAL_APP_ID = 'protocol-lab' as const;
export const MADRIGAL_VERSION = 2 as const;
export const MADRIGAL_VERSION_LEGACY = 1 as const;
export const MADRIGAL_EXTENSION = '.madrigal';

const MADRIGAL_MIME_TYPE = 'application/json';
const JSON_INDENT_SPACES = 2;
const ISO_DATE_START = 0;
const ISO_DATE_END = 10;
const FILENAME_SAFE_PATTERN = /[^a-zA-Z0-9._-]/g;
const FILENAME_FALLBACK = 'protocol-lab';
const FILENAME_MAX_BASE = 48;
const PCAP_EXTENSION_PATTERN = /\.[^.]+$/;
const PACKET_ID_RADIX = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMetaBookmarks(raw: unknown): number[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const result: number[] = [];
  for (const item of raw) {
    if (typeof item === 'number' && Number.isInteger(item)) {
      result.push(item);
    }
  }
  return result;
}

function parseMetaNotes(raw: unknown): PacketNotesMap | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const result: PacketNotesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    const id = parseInt(key, PACKET_ID_RADIX);
    if (Number.isNaN(id)) continue;
    result[id] = trimmed.slice(0, NOTE_MAX_LENGTH);
  }
  return result;
}

export function buildMadrigalFile(
  rules: Rule[],
  filename: string | null,
  backendProjectId: string | null,
  sessionId: string | null,
  bookmarkedIds: Set<number> | number[],
  notes: PacketNotesMap
): MadrigalProjectFile {
  const bookmarks = Array.isArray(bookmarkedIds) ? [...bookmarkedIds] : Array.from(bookmarkedIds);
  const meta: MadrigalMeta = {
    bookmarks: bookmarks.filter((id) => Number.isInteger(id)),
    notes: { ...notes },
  };
  return {
    app: MADRIGAL_APP_ID,
    version: MADRIGAL_VERSION,
    savedAt: new Date().toISOString(),
    project: { filename, backendProjectId, sessionId },
    rules: toBackendPayload(rules),
    meta,
  };
}

export function buildMadrigalFilename(sourceFilename: string | null): string {
  const datePart = new Date().toISOString().slice(ISO_DATE_START, ISO_DATE_END);
  const rawBase = sourceFilename
    ? sourceFilename.replace(PCAP_EXTENSION_PATTERN, '')
    : FILENAME_FALLBACK;
  const safeBase = rawBase.replace(FILENAME_SAFE_PATTERN, '_').slice(0, FILENAME_MAX_BASE);
  const base = safeBase.length > 0 ? safeBase : FILENAME_FALLBACK;
  return `${base}-${datePart}${MADRIGAL_EXTENSION}`;
}

export function downloadMadrigalFile(file: MadrigalProjectFile, filename: string): void {
  const blob = new Blob([JSON.stringify(file, null, JSON_INDENT_SPACES)], {
    type: MADRIGAL_MIME_TYPE,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseMadrigalFile(data: unknown): ParsedMadrigalImport {
  if (!isRecord(data)) {
    throw new Error('Файл не похож на .madrigal: корень не объект');
  }
  if (data.app !== MADRIGAL_APP_ID) {
    throw new Error('Чужой файл: app не protocol-lab');
  }
  const version = data.version;
  const isSupported = version === MADRIGAL_VERSION || version === MADRIGAL_VERSION_LEGACY;
  if (!isSupported) {
    throw new Error(`Неподдерживаемая версия: ${String(version)}`);
  }
  if (!isRecord(data.project)) {
    throw new Error('Битый .madrigal: нет секции project');
  }
  const parsed = parseImportedRulesJson(data.rules);

  const project = data.project;
  const filename = typeof project.filename === 'string' ? project.filename : null;
  const backendProjectId = typeof project.backendProjectId === 'string' ? project.backendProjectId : null;
  const sessionId = typeof project.sessionId === 'string' ? project.sessionId : null;
  const savedAt = typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString();

  let meta: MadrigalMeta | undefined = undefined;
  let bookmarks: number[] | null = null;
  let notes: PacketNotesMap | null = null;
  if (version === MADRIGAL_VERSION && data.meta !== undefined) {
    if (!isRecord(data.meta)) {
      throw new Error('Битый .madrigal: meta не объект');
    }
    const parsedBookmarks = parseMetaBookmarks(data.meta.bookmarks);
    const parsedNotes = parseMetaNotes(data.meta.notes);
    bookmarks = parsedBookmarks ?? [];
    notes = parsedNotes ?? {};
    meta = { bookmarks, notes };
  }

  const file: MadrigalProjectFile = {
    app: MADRIGAL_APP_ID,
    version: version as 1 | 2,
    savedAt,
    project: { filename, backendProjectId, sessionId },
    rules: parsed.drafts.map((d) => ({
      offset: d.offset,
      length: d.length,
      data_type: d.data_type,
      name: d.name,
      anchor: d.anchor,
    })),
    ...(meta !== undefined ? { meta } : {}),
  };

  return { file, drafts: parsed.drafts, skipped: parsed.skipped, bookmarks, notes };
}