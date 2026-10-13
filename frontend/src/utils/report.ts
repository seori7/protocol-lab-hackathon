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
      `<td class="mono">${escapeHtml(r.anchor)}</td></tr>`
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
    const star = bookmarkedIds.has(p.id) ? '<span class="star"> ★</span>' : '';
    return (
      `<tr><td class="mono">#${p.id}${star}</td>` +
      `<td class="mono">${p.timestamp.toFixed(REPORT_TIMESTAMP_FRACTION_DIGITS)}</td>` +
      `<td>${dir}</td>` +
      `<td class="mono">${getPayloadByteLength(p.payload_hex)} B</td>` +
      `<td class="mono small">${escapeHtml(preview)}</td></tr>`
    );
  }).join('');

  return (
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Protocol Lab — отчёт</title>` +
    `<style>body{background:#0e0f11;color:#e7e7e9;font-family:Montserrat,system-ui,-apple-system,sans-serif;margin:0;padding:28px}` +
    `.wrap{max-width:960px;margin:0 auto}h1{font-size:18px;margin:0;font-weight:600}h2{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#71717a;margin:24px 0 10px}` +
    `.muted{color:#71717a}.mono{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}.small{font-size:11px}` +
    `.head{display:flex;align-items:center;gap:12px}.logo{width:32px;height:32px;border-radius:8px;background:#f4f4f5;color:#18181b;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}` +
    `table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid rgba(255,255,255,.07);padding:7px 10px;text-align:left;vertical-align:top}` +
    `th{background:#15161a;color:#71717a;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}` +
    `td{background:#121316}.card{background:#15161a;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px 16px;margin:12px 0}` +
    `.grid{display:flex;gap:10px;flex-wrap:wrap}.grid .card{flex:1;min-width:120px;margin:12px 0 0}` +
    `.num{font-size:22px;font-weight:600;color:#fafafa}.lbl{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.07em}` +
    `.star{color:#f4f4f5}</style></head><body><div class="wrap">` +
    `<div class="head"><div class="logo">PL</div><div><h1>Отчёт по сессии</h1><div class="muted small">${escapeHtml(now)} · ${escapeHtml(projectFilename ?? 'demo')} · ${escapeHtml(sessionLabel ?? '')}</div></div></div>` +
    `<div class="grid">` +
    `<div class="card"><div class="lbl">Пакетов</div><div class="num">${packets.length}</div></div>` +
    `<div class="card"><div class="lbl">Байт</div><div class="num">${totalBytes}</div></div>` +
    `<div class="card"><div class="lbl">Правил</div><div class="num">${rules.length}</div></div>` +
    `<div class="card"><div class="lbl">Покрытие</div><div class="num">${avgCoverage}%</div></div>` +
    `<div class="card"><div class="lbl">Закладки</div><div class="num">${bookmarkedList.length}</div></div>` +
    `<div class="card"><div class="lbl">Заметки</div><div class="num">${noteEntries.length}</div></div>` +
    `</div>` +
    `<h2>Структура протокола (${sortedRules.length})</h2>` +
    `<table><tr><th>Offset</th><th>Name</th><th>Type</th><th>Len</th><th>Anchor</th></tr>${rulesRows}</table>` +
    `<h2>Закладки (${bookmarkedList.length})</h2>` +
    `<div class="card mono">${bookmarkedList.length === 0 ? '<span class="muted">Нет закладок</span>' : bookmarkedList.map((id) => `#${id}`).join(', ')}</div>` +
    `<h2>Заметки (${noteEntries.length})</h2>` +
    `<table><tr><th style="width:80px">Пакет</th><th>Текст</th></tr>${notesRows}</table>` +
    `<h2>Первые пакеты (${samplePackets.length} из ${packets.length})</h2>` +
    `<table><tr><th>ID</th><th>Время</th><th>Напр.</th><th>Длина</th><th>HEX</th></tr>${sampleRows}</table>` +
    `<div class="muted small" style="margin-top:16px">Protocol Lab · покрытие по первым ${REPORT_COVERAGE_SAMPLE} пакетам</div>` +
    `</div></body></html>`
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