export const API_BASE_URL = 'http://localhost:8000/api';

export function buildUploadUrl(): string {
  return `${API_BASE_URL}/project/upload`;
}

export function buildSessionsUrl(projectId: string): string {
  return `${API_BASE_URL}/project/${encodeURIComponent(projectId)}/sessions`;
}

export function buildSessionPacketsUrl(projectId: string, sessionId: string): string {
  return `${API_BASE_URL}/project/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/packets`;
}

export function buildDirectionalStreamsUrl(
  projectId: string,
  sessionId: string
): string {
  return `${API_BASE_URL}/project/${encodeURIComponent(projectId)}` +
    `/sessions/${encodeURIComponent(sessionId)}/streams`;
}

export function buildApplyRulesUrl(): string {
  return `${API_BASE_URL}/project/apply_rules`;
}

export function buildValidateRulesUrl(projectId: string, sessionId: string): string {
  return `${API_BASE_URL}/project/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/validate_rules`;
}

export function buildProjectStateUrl(projectId: string): string {
  return `${API_BASE_URL}/project/${encodeURIComponent(projectId)}/state`;
}

export function buildExportParserUrl(): string {
  return `${API_BASE_URL}/project/export_parser`;
}

export function buildInfosecSignaturesUrl(payloadHex: string): string {
  return `${API_BASE_URL}/infosec/signatures?payload_hex=${encodeURIComponent(payloadHex)}`;
}

export function buildInfosecEntropyUrl(payloadHex: string): string {
  return `${API_BASE_URL}/infosec/entropy?payload_hex=${encodeURIComponent(payloadHex)}`;
}

export function buildInfosecDiffUrl(): string {
  return `${API_BASE_URL}/infosec/diff`;
}

export const STORAGE_KEY_LAST_PROJECT_ID = 'protocol-lab:last-project-id';
export const STORAGE_KEY_LAST_FILENAME = 'protocol-lab:last-filename';
export const STORAGE_KEY_RULES_PREFIX = 'protocol-lab:rules:';

export const MOCK_PROJECT_ID = 'mock-project';
export const MOCK_PROJECT_FILENAME = 'demo-mock.pcap';

export const UPLOAD_INPUT_ACCEPT = '.pcap,.pcapng';
export const UPLOAD_ALLOWED_EXTENSIONS: readonly string[] = ['.pcap', '.pcapng'];
export const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const BYTES_PER_MB = 1024 * 1024;

export const EXPORT_FILE_PREFIX = 'protocol-lab-rules';
export const EXPORT_FILE_EXTENSION = '.json';

export const INFOSEC_MAX_GET_HEX_LENGTH = 4000;