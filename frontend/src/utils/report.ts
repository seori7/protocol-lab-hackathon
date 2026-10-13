import type { Packet, Rule, PacketNotesMap } from '../types';
import {
  REPORT_FILE_PREFIX, REPORT_FILE_EXTENSION,
  REPORT_SAMPLE_PACKETS, REPORT_HEX_PREVIEW_CHARS,
  REPORT_TIMESTAMP_FRACTION_DIGITS, REPORT_COVERAGE_SAMPLE,
} from '../constants/meta';
import { getPayloadByteLength } from './rules';
import { buildCoverageStats } from './structure';
import { formatHexAddress } from './hex';

const ISO_DATE_START = 0;
const ISO_DATE_END = 10;
const REPORT_MIME_TYPE = 'text/html';
const PERCENT_MULTIPLIER = 100;
const HEX_SUFFIX = '...';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReportFilename(sourceFilename: string | null): string {
  const datePart = new Date().toISOString().slice(ISO_DATE_START, ISO_DATE_END);
  const rawBase = sourceFilename ? sourceFilename.replace(/\.[^.]+$/, '') : 'session';
  const safeBase = rawBase.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48) || 'session';
  return `${REPORT_FILE_PREFIX}-${safeBase}-${datePart}${REPORT_FILE_EXTENSION}`;
}

function formatOffsetLabel(rule: Rule): string {
  return rule.anchor === 'start'
    ? formatHexAddress(rule.offset)
    : `end-${formatHexAddress(rule.offset)}`;
}

export function buildHtmlReport(
  projectFilename: string | null,
  sessionLabel: string | null,
  packets: Packet[],
  rules: Rule[],
  bookmarkedIds: Set<number>,
  notes: PacketNotesMap
): string {
  const sortedRules = [...rules].sort((a, b) => a.offset - b.offset);
  let totalBytes = 0;
  for (const p of packets) totalBytes += getPayloadByteLength(p.payload_hex);

  let coverageSum = 0;
  const coverageSample = packets.slice(0, REPORT_COVERAGE_SAMPLE);
  for (const p of coverageSample) {
    coverageSum += buildCoverageStats(p.payload_hex, rules).coveragePercent;
  }
  const avgCoverage = coverageSample.length > 0
    ? Math.round(coverageSum / coverageSample.length)
    : 0;

  const noteEntries = Object.entries(notes)
    .map(([idStr, text]) => ({ id: Number(idStr), text }))
    .filter((e) => !Number.isNaN(e.id))
    .sort((a, b) => a.id - b.id);

  const samplePackets = packets.slice(0, REPORT_SAMPLE_PACKETS);
  const now = new Date().toISOString();

  const rulesRows = sortedRules.length === 0
    ? '<tr><td colspan="5" class="muted">Правил пока нет</td></tr>'
    : sortedRules.map((r) => (
      `<tr><td class="mono">${escapeHtml(formatOffsetLabel(r))}</td>` +
      `<td>${escapeHtml(r.name)}</td>` +
      `<td class="mono">${escapeHtml(r.data_type)}</td>` +
      `<td class="mono">${r.length}</td>` +
      `<td className="mono">${escapeHtml(r.anchor)}</td></tr>`
    )).join('');

  const bookmarkedList = Array.from(bookmarkedIds).sort((a, b) => a - b);
  const notesRows = noteEntries.length === 0
    ? '<tr><td colspan="2" class="muted">Заметок нет</td></tr>'
    : noteEntries.map((e) => (
      `<tr><td class="mono">#${e.id}</td><td>${escapeHtml(e.text)}</td></tr>`
    )).join('');

  const sampleRows = samplePackets.map((p) => {
    const previewRaw = p.payload_hex.slice(0, REPORT_HEX_PREVIEW_CHARS).toUpperCase();
    const preview = p.payload_hex.length > REPORT_HEX_PREVIEW_CHARS ? `${previewRaw}${HEX_SUFFIX}` : previewRaw;
    const dir = p.direction === 'client_to_server' ? 'C→S' : 'S→C';
    const star = bookmarkedIds.has(p.id) ? ' ★' : '';
    return (
      `<tr><td class="mono">#${p.id}${star}</td>` +
      `<td class="mono">${p.timestamp.toFixed(REPORT_TIMESTAMP_FRACTION_DIGITS)}</td>` +
      `<td>${dir}</td>` +
      `<td class="mono">${getPayloadByteLength(p.payload_hex)} B</td>` +
      `<td class="mono small">${escapeHtml(preview)}</td></tr>`
    );
  }).join('');

  return (
`<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
`<title>Protocol Lab — отчёт</title>` +
`<style>body{background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;margin:0;padding:24px}` +
`h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px;color:#93c5fd}` +
`.muted{color:#64748b}.mono{font-family:ui-monospace,monospace}.small{font-size:11px}` +
`table{width:100%;border-collapse:collapse;font-size:13px}` +
`th,td{border:1px solid #1e293b;padding:6px 8px;text-align:left;vertical-align:top}` +
`th{background:#0f172a;color:#94a3b8;font-weight:600}` +
`.card{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px 16px;margin:12px 0}` +
`.grid{display:flex;gap:12px;flex-wrap:wrap}.grid .card{flex:1;min-width:140px}` +
`.num{font-size:22px;font-weight:700}</style></head><body>` +
`<h1>Protocol Lab — отчёт по сессии</h1>` +
`<div class="muted small">${escapeHtml(now)} • ${escapeHtml(projectFilename ?? 'demo')} • ${escapeHtml(sessionLabel ?? '')}</div>` +
`<div class="grid">` +
`<div class="card"><div class="muted small">Пакетов</div><div class="num">${packets.length}</div></div>` +
`<div class="card"><div class="muted small">Байт</div><div class="num">${totalBytes}</div></div>` +
`<div class="card"><div class="muted small">Правил</div><div class="num">${rules.length}</div></div>` +
`<div class="card"><div class="muted small">Покрытие ~</div><div class="num">${avgCoverage}%</div></div>` +
`<div class="card"><div class="muted small">Закладки</div><div class="num">${bookmarkedList.length}</div></div>` +
`<div class="card"><div class="muted small">Заметки</div><div class="num">${noteEntries.length}</div></div>` +
`</div>` +
`<h2>Структура протокола (${sortedRules.length})</h2>` +
`<table><tr><th>Offset</th><th>Name</th><th>Type</th><th>Len</th><th>Anchor</th></tr>${rulesRows}</table>` +
`<h2>Закладки (${bookmarkedList.length})</h2>` +
`<div class="card mono">${bookmarkedList.length === 0 ? '<span class="muted">Нет закладок</span>' : bookmarkedList.map((id) => `#${id}`).join(', ')}</div>` +
`<h2>Заметки (${noteEntries.length})</h2>` +
`<table><tr><th style="width:80px">Пакет</th><th>Текст</th></tr>${notesRows}</table>` +
`<h2>Первые пакеты (${samplePackets.length} из ${packets.length})</h2>` +
`<table><tr><th>ID</th><th>Время</th><th>Напр.</th><th>Длина</th><th>HEX</th></tr>${sampleRows}</table>` +
`<div class="muted small" style="margin-top:16px">Сгенерировано Protocol Lab • покрытие посчитано по первым ${REPORT_COVERAGE_SAMPLE} пакетам • ${PERCENT_MULTIPLIER}% = полное</div>` +
`</body></html>`
  );
}

export function downloadHtmlReport(html: string, filename: string): void {
  const blob = new Blob([html], { type: REPORT_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}