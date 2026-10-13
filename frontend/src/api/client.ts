import type {
  Session, Packet, PacketDirection,
  UploadProjectResponse, SessionsListResponse, SessionPacketsResponse,
  BackendPacketPayload, BackendRuleDef, ValidateDirectionFilter,
  ApplyRulesResponse, ValidateCorpusReport, BackendProjectState,
  ExportParserResponse, InfosecSignaturesResponse,
  InfosecEntropyResponse, InfosecDiffResponse,
} from '../types';
import {
  buildUploadUrl, buildSessionsUrl, buildSessionPacketsUrl,
  buildApplyRulesUrl, buildValidateRulesUrl, buildProjectStateUrl,
  buildExportParserUrl, buildInfosecSignaturesUrl,
  buildInfosecEntropyUrl, buildInfosecDiffUrl,
  INFOSEC_MAX_GET_HEX_LENGTH,
} from '../constants/api';

const JSON_CONTENT_TYPE = 'application/json';
const FORM_FILE_FIELD = 'file';
const HTTP_METHOD_POST = 'POST';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError('Бэкенд недоступен. Проверьте что FastAPI запущен на :8000.', 0);
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { detail?: unknown };
      if (typeof errBody.detail === 'string') detail = errBody.detail;
    } catch { /* не JSON */ }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

function normalizeDirection(raw: string): PacketDirection {
  if (raw === 'server_to_client' || raw === 'client_to_server') return raw;
  return 'client_to_server';
}

function toFrontendPacket(raw: BackendPacketPayload): Packet {
  return {
    id: raw.id,
    timestamp: raw.timestamp,
    direction: normalizeDirection(raw.direction),
    payload_hex: raw.payload_hex,
    seq: raw.seq,
    payload_len: raw.payload_len,
    anomaly: raw.anomaly ?? null,
  };
}

export async function uploadPcapFile(file: File): Promise<UploadProjectResponse> {
  const formData = new FormData();
  formData.append(FORM_FILE_FIELD, file, file.name);
  return fetchJson<UploadProjectResponse>(buildUploadUrl(), {
    method: HTTP_METHOD_POST,
    body: formData,
  });
}

export async function fetchSessions(projectId: string): Promise<Session[]> {
  const data = await fetchJson<SessionsListResponse>(buildSessionsUrl(projectId));
  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function fetchSessionPackets(projectId: string, sessionId: string): Promise<Packet[]> {
  const data = await fetchJson<SessionPacketsResponse>(buildSessionPacketsUrl(projectId, sessionId));
  if (!Array.isArray(data.packets)) return [];
  return data.packets.map(toFrontendPacket);
}

export async function applyRulesOnBackend(
  rules: BackendRuleDef[],
  payloads: string[]
): Promise<ApplyRulesResponse> {
  return fetchJson<ApplyRulesResponse>(buildApplyRulesUrl(), {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    body: JSON.stringify({ rules, payloads }),
  });
}

export async function validateRulesOnBackend(
  projectId: string,
  sessionId: string,
  rules: BackendRuleDef[],
  directionFilter: ValidateDirectionFilter = "all"
): Promise<ValidateCorpusReport> {
  return fetchJson<ValidateCorpusReport>(
    buildValidateRulesUrl(projectId, sessionId),
    {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': JSON_CONTENT_TYPE },
      body: JSON.stringify({ rules, direction_filter: directionFilter }),
    }
  );
}

export async function saveProjectState(
  projectId: string,
  rules: BackendRuleDef[],
  notes: string
): Promise<void> {
  await fetchJson<{ status: string }>(buildProjectStateUrl(projectId), {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    body: JSON.stringify({ rules, notes }),
  });
}

export async function loadProjectState(projectId: string): Promise<BackendProjectState> {
  const data = await fetchJson<BackendProjectState>(buildProjectStateUrl(projectId));
  return {
    rules: Array.isArray(data.rules) ? data.rules : [],
    notes: typeof data.notes === 'string' ? data.notes : '',
  };
}

export async function exportParserOnBackend(rules: BackendRuleDef[]): Promise<ExportParserResponse> {
  return fetchJson<ExportParserResponse>(buildExportParserUrl(), {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    body: JSON.stringify({ rules }),
  });
}

export async function getSignatures(payloadHex: string): Promise<InfosecSignaturesResponse> {
  if (payloadHex.length > INFOSEC_MAX_GET_HEX_LENGTH) {
    throw new ApiError('Payload слишком длинный для GET, используйте локальный анализ', 0);
  }
  return fetchJson<InfosecSignaturesResponse>(buildInfosecSignaturesUrl(payloadHex));
}

export async function getEntropy(payloadHex: string): Promise<InfosecEntropyResponse> {
  if (payloadHex.length > INFOSEC_MAX_GET_HEX_LENGTH) {
    throw new ApiError('Payload слишком длинный для GET', 0);
  }
  return fetchJson<InfosecEntropyResponse>(buildInfosecEntropyUrl(payloadHex));
}

export async function diffPayloadsBackend(
  payloadA: string,
  payloadB: string
): Promise<InfosecDiffResponse> {
  return fetchJson<InfosecDiffResponse>(buildInfosecDiffUrl(), {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    body: JSON.stringify({ payload_a: payloadA, payload_b: payloadB }),
  });
}