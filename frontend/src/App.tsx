import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PacketList } from './components/PacketList';
import { HexViewer } from './components/HexViewer';
import { RulePanel } from './components/RulePanel';
import { ProjectUploader } from './components/ProjectUploader';
import { StreamViewer } from './components/StreamViewer';
import { DiffViewer } from './components/DiffViewer';
import { FlowViewer } from './components/FlowViewer';
import { SuggestionList } from './components/SuggestionList';
import { LengthPanel } from './components/LengthPanel';
import { ProjectIO } from './components/ProjectIO';
import { PacketFilterBar } from './components/PacketFilterBar';
import { PacketNotesEditor } from './components/PacketNotesEditor';
import { ReportButton } from './components/ReportButton';
import type {
  Packet, Session, ByteRange, Rule, NewRuleDraft, RuleSuggestion, LengthCandidate,
  RuleUpdatePatch, ApplyRulesState, BackendStatus, CenterViewMode,
  PacketFilterState, PacketNotesMap, BackendRuleDef,
} from './types';
import { RULE_COLOR_PALETTE } from './constants/rules';
import { MOCK_PROJECT_ID, MOCK_PROJECT_FILENAME } from './constants/api';
import {
  DEFAULT_PACKET_FILTER,
  PACKET_NAV_PREV_KEY, PACKET_NAV_NEXT_KEY, PACKET_NAV_IGNORE_TAGS,
} from './constants/filter';
import { NOTE_MAX_LENGTH } from './constants/meta';
import {
  fetchSessions, fetchSessionPackets, applyRulesOnBackend,
  validateRulesOnBackend, saveProjectState, loadProjectState, ApiError,
} from './api/client';
import { generateRuleId } from './utils/hex';
import {
  buildExportFilename, downloadRulesAsJson,
  getOverlappingRules, getPayloadByteLength,
} from './utils/rules';
import { computeEndOffsetForRange } from './utils/anchor';
import {
  toBackendRules, backendRuleToDraft, serializeNotes, parseNotesString,
} from './utils/backendAdapter';
import { reassembleStreams } from './utils/stream';
import { buildSessionEntropy } from './utils/entropy';
import { buildConstantSuggestions } from './utils/suggest';
import { detectLengthFields } from './utils/length';
import { buildAnomalyMap, applyPacketFilter, findPacketIndex } from './utils/packetFilter';
import { loadBookmarks, saveBookmarks, loadPacketNotes, savePacketNotes } from './utils/packetMeta';
import {
  loadRulesForProject, saveRulesForProject,
  loadLastProject, saveLastProject, clearLastProject,
} from './utils/storage';
import { cn } from './utils/cn';

const INITIAL_CLEAR_TOKEN = 0;
const INITIAL_PENDING_TOKEN = 0;
const FIRST_SESSION_INDEX = 0;
const SECOND_PACKET_INDEX = 1;
const EMPTY_PAYLOAD_HEX = '';
const SESSION_ENDPOINTS_SEPARATOR = ' ↔ ';
const INCLUSIVE_RANGE_ADJUSTMENT = 1;
const APPLY_FALLBACK_MAX_PAYLOADS = 50;
const STATE_AUTOSAVE_DELAY_MS = 1200;

const INITIAL_APPLY_STATE: ApplyRulesState = {
  status: 'idle', matchedPackets: null, totalChecked: null, skippedEndRules: 0, message: null,
};

const MOCK_SESSIONS: Session[] = [
  { id: 'mock-session-1', endpoints: ['192.168.1.10:54231', '93.184.216.34:80'], packet_count: 4 },
  { id: 'mock-session-2', endpoints: ['192.168.1.10:54232', '10.0.0.5:443'], packet_count: 2 },
];

const MOCK_PACKETS_MAP: Record<string, Packet[]> = {
  'mock-session-1': [
    { id: 1, timestamp: 1699020000.123, direction: 'client_to_server', payload_hex: '48656c6c6f000102', anomaly: null },
    { id: 2, timestamp: 1699020000.145, direction: 'server_to_client', payload_hex: '576f726c64000304', anomaly: null },
    { id: 3, timestamp: 1699020000.180, direction: 'client_to_server', payload_hex: '41636b6e6f776c6564676500', anomaly: null },
    { id: 4, timestamp: 1699020000.200, direction: 'server_to_client', payload_hex: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324', anomaly: null },
  ],
  'mock-session-2': [
    { id: 1, timestamp: 1699020100.050, direction: 'client_to_server', payload_hex: '16030100c8010000c40303', anomaly: null },
    { id: 2, timestamp: 1699020100.070, direction: 'server_to_client', payload_hex: '160301000e0e00000003004104', anomaly: null },
  ],
};

function formatSessionLabel(session: Session): string {
  const startLabel =
    session.first_frame_number === undefined
      ? ""
      : ` • кадр #${session.first_frame_number}`;

  const roleLabel =
    session.role_status === "unknown"
      ? " • роли сторон не установлены"
      : "";

  return (
    `${session.endpoints.join(SESSION_ENDPOINTS_SEPARATOR)}` +
    `${startLabel}${roleLabel} (${session.packet_count})`
  );
}

function convertBackendRulesToFrontend(backendRules: BackendRuleDef[]): Rule[] {
  const paletteSize = RULE_COLOR_PALETTE.length;
  const now = Date.now();
  return backendRules.map((b, i) => {
    const draft = backendRuleToDraft(b);
    return {
      id: b.id,
      name: draft.name,
      offset: draft.offset,
      length: draft.length,
      data_type: draft.data_type,
      anchor: draft.anchor,
      colorIndex: paletteSize > 0 ? i % paletteSize : 0,
      createdAt: now + i,
    };
  });
}

function App() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectFilename, setProjectFilename] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [selectedByteRange, setSelectedByteRange] = useState<ByteRange | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [clearSelectionToken, setClearSelectionToken] = useState<number>(INITIAL_CLEAR_TOKEN);
  const [pendingSelection, setPendingSelection] = useState<ByteRange | null>(null);
  const [pendingSelectionToken, setPendingSelectionToken] = useState<number>(INITIAL_PENDING_TOKEN);
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>('packet');
  const [diffPacketAId, setDiffPacketAId] = useState<number | null>(null);
  const [diffPacketBId, setDiffPacketBId] = useState<number | null>(null);
  const [packetFilter, setPacketFilter] = useState<PacketFilterState>(() => ({ ...DEFAULT_PACKET_FILTER }));
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [packetNotes, setPacketNotes] = useState<PacketNotesMap>({});
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLoadingPackets, setIsLoadingPackets] = useState<boolean>(false);
  const [applyState, setApplyState] = useState<ApplyRulesState>(INITIAL_APPLY_STATE);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('mock');
  const [error, setError] = useState<string | null>(null);
  const stateSaveTimerRef = useRef<number | null>(null);

  const isBackendLive = backendStatus === 'live' && projectId !== MOCK_PROJECT_ID;

  const loadRulesWithBackendMerge = useCallback(async (pid: string): Promise<Rule[]> => {
    const localRules = loadRulesForProject(pid);
    if (pid === MOCK_PROJECT_ID) {
      return localRules;
    }
    try {
      const state = await loadProjectState(pid);
      if (state.rules.length === 0) {
        return localRules;
      }
      const converted = convertBackendRulesToFrontend(state.rules);
      const backendIds = new Set(converted.map((r) => r.id));
      const localEndOnly = localRules.filter((r) => r.anchor === "end" && !backendIds.has(r.id));
      // Перекрашиваем end-хвост чтобы цвета не дублировались
      const paletteSize = RULE_COLOR_PALETTE.length;
      const recoloredEnd = localEndOnly.map((r, i) => ({
        ...r,
        colorIndex: paletteSize > 0 ? (converted.length + i) % paletteSize : 0,
      }));
      return [...converted, ...recoloredEnd];
    } catch {
      return localRules;
    }
  }, []);

  const initDemoMode = useCallback((): void => {
    const firstSession = MOCK_SESSIONS[FIRST_SESSION_INDEX]!;
    setProjectId(MOCK_PROJECT_ID);
    setProjectFilename(MOCK_PROJECT_FILENAME);
    setSessions(MOCK_SESSIONS);
    setSelectedSessionId(firstSession.id);
    setPackets(MOCK_PACKETS_MAP[firstSession.id] ?? []);
    setSelectedPacket(null);
    setSelectedByteRange(null);
    setSelectedRuleId(null);
    setHoveredRuleId(null);
    setCenterViewMode('packet');
    setRules(loadRulesForProject(MOCK_PROJECT_ID));
    setBackendStatus('mock');
    setApplyState(INITIAL_APPLY_STATE);
    setIsLoadingSessions(false);
    setIsLoadingPackets(false);
  }, []);

  useEffect(() => {
    const last = loadLastProject();
    if (!last || last.projectId === MOCK_PROJECT_ID) {
      initDemoMode();
      return;
    }
    void (async () => {
      setIsLoadingSessions(true);
      try {
        const liveSessions = await fetchSessions(last.projectId);
        if (liveSessions.length === 0) throw new Error('empty');
        const firstId = liveSessions[FIRST_SESSION_INDEX]!.id;
        setProjectId(last.projectId);
        setProjectFilename(last.filename);
        setSessions(liveSessions);
        setSelectedSessionId(firstId);
        setRules(await loadRulesWithBackendMerge(last.projectId));
        setBackendStatus('live');
        setIsLoadingPackets(true);
        const livePackets = await fetchSessionPackets(last.projectId, firstId);
        setPackets(livePackets);
        setSelectedPacket(null);
        setSelectedByteRange(null);
        setError(null);
      } catch {
        initDemoMode();
        setError('Не удалось восстановить проект. Включен демо-режим.');
      } finally {
        setIsLoadingSessions(false);
        setIsLoadingPackets(false);
      }
    })();
  }, [initDemoMode, loadRulesWithBackendMerge]);

  useEffect(() => {
    if (projectId) saveRulesForProject(projectId, rules);
  }, [rules, projectId]);

  useEffect(() => {
    if (!projectId || projectId === MOCK_PROJECT_ID || !isBackendLive) return;
    if (stateSaveTimerRef.current !== null) window.clearTimeout(stateSaveTimerRef.current);
    stateSaveTimerRef.current = window.setTimeout(() => {
      const { backendRules } = toBackendRules(rules);
      const notesStr = serializeNotes(packetNotes);
      void saveProjectState(projectId, backendRules, notesStr).catch(() => {
      });
    }, STATE_AUTOSAVE_DELAY_MS);
    return () => {
      if (stateSaveTimerRef.current !== null) window.clearTimeout(stateSaveTimerRef.current);
    };
  }, [rules, packetNotes, projectId, isBackendLive]);

  useEffect(() => {
    if (!projectId || !selectedSessionId) {
      setBookmarkedIds(new Set());
      setPacketNotes({});
      return;
    }
    setBookmarkedIds(loadBookmarks(projectId, selectedSessionId));
    // Заметки: сначала local, если пусто — пробуем бэкенд-state
    const localNotes = loadPacketNotes(projectId, selectedSessionId);
    if (Object.keys(localNotes).length > 0 || projectId === MOCK_PROJECT_ID) {
      setPacketNotes(localNotes);
      return;
    }
    void (async () => {
      try {
        const state = await loadProjectState(projectId);
        const parsed = parseNotesString(state.notes);
        setPacketNotes(parsed ?? {});
      } catch {
        setPacketNotes({});
      }
    })();
  }, [projectId, selectedSessionId]);

  useEffect(() => {
    if (!projectId || !selectedSessionId) return;
    saveBookmarks(projectId, selectedSessionId, bookmarkedIds);
  }, [bookmarkedIds, projectId, selectedSessionId]);

  useEffect(() => {
    if (!projectId || !selectedSessionId) return;
    savePacketNotes(projectId, selectedSessionId, packetNotes);
  }, [packetNotes, projectId, selectedSessionId]);

  useEffect(() => {
    setApplyState(INITIAL_APPLY_STATE);
  }, [rules, projectId, selectedSessionId]);

  const sessionStreams = useMemo(() => reassembleStreams(packets), [packets]);
  const sessionEntropy = useMemo(() => buildSessionEntropy(packets), [packets]);
  const suggestions: RuleSuggestion[] = useMemo(
    () => buildConstantSuggestions(sessionEntropy, packets),
    [sessionEntropy, packets]
  );
  const lengthCandidates: LengthCandidate[] = useMemo(
    () => detectLengthFields(packets),
    [packets]
  );

  const selectedRule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );
  const anomalyMap = useMemo(() => buildAnomalyMap(selectedRule, packets), [selectedRule, packets]);
  const filteredPackets = useMemo(
    () => applyPacketFilter(packets, packetFilter, anomalyMap, bookmarkedIds),
    [packets, packetFilter, anomalyMap, bookmarkedIds]
  );
  const currentFilteredIndex = useMemo(
    () => findPacketIndex(filteredPackets, selectedPacket?.id ?? null),
    [filteredPackets, selectedPacket]
  );
  const selectedNote = useMemo(() => {
    if (!selectedPacket) return '';
    return packetNotes[selectedPacket.id] ?? '';
  }, [packetNotes, selectedPacket]);

  useEffect(() => {
    if (selectedRule === null && packetFilter.onlyAnomalies) {
      setPacketFilter((prev) => ({ ...prev, onlyAnomalies: false }));
    }
  }, [selectedRule, packetFilter.onlyAnomalies]);

  useEffect(() => {
    if (packets.length < 2) {
      setDiffPacketAId(null);
      setDiffPacketBId(null);
      return;
    }
    const ids = new Set(packets.map((p) => p.id));
    setDiffPacketAId((prev) => {
      if (prev !== null && ids.has(prev)) return prev;
      return packets[FIRST_SESSION_INDEX]!.id;
    });
    setDiffPacketBId((prev) => {
      if (prev !== null && ids.has(prev)) return prev;
      const second = packets[SECOND_PACKET_INDEX] ?? packets[FIRST_SESSION_INDEX]!;
      return second.id;
    });
  }, [packets]);

  const selectedSession: Session | null = useMemo(() => {
    if (!selectedSessionId) return null;
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  const sessionLabel: string | null = useMemo(() => {
    return selectedSession ? formatSessionLabel(selectedSession) : null;
  }, [selectedSession]);

  const handleUploadSuccess = useCallback(async (newProjectId: string, filename: string): Promise<void> => {
    saveLastProject(newProjectId, filename);
    setProjectId(newProjectId);
    setProjectFilename(filename);
    setBackendStatus('live');
    setSelectedRuleId(null);
    setCenterViewMode('packet');
    setError(null);
    setSelectedPacket(null);
    setSelectedByteRange(null);
    setIsLoadingSessions(true);
    try {
      const liveSessions = await fetchSessions(newProjectId);
      setSessions(liveSessions);
      const firstId = liveSessions[FIRST_SESSION_INDEX]?.id ?? null;
      setSelectedSessionId(firstId);
      setRules(await loadRulesWithBackendMerge(newProjectId));
      if (firstId) {
        setIsLoadingPackets(true);
        setPackets(await fetchSessionPackets(newProjectId, firstId));
      } else {
        setPackets([]);
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки сессий';
      setError(message);
      setSessions([]);
      setPackets([]);
    } finally {
      setIsLoadingSessions(false);
      setIsLoadingPackets(false);
    }
  }, [loadRulesWithBackendMerge]);

  const handleSessionChange = useCallback(async (sessionId: string): Promise<void> => {
    setSelectedSessionId(sessionId);
    setSelectedPacket(null);
    setSelectedByteRange(null);
    setHoveredRuleId(null);
    setCenterViewMode('packet');
    if (!projectId) return;
    if (projectId === MOCK_PROJECT_ID) {
      setPackets(MOCK_PACKETS_MAP[sessionId] ?? []);
      return;
    }
    setIsLoadingPackets(true);
    try {
      setPackets(await fetchSessionPackets(projectId, sessionId));
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки пакетов';
      setError(message);
      setPackets([]);
    } finally {
      setIsLoadingPackets(false);
    }
  }, [projectId]);

  const handleSelectPacket = useCallback((packet: Packet) => {
    setSelectedPacket(packet);
    setSelectedByteRange(null);
  }, []);

  const handleStreamSelectPacket = useCallback((packet: Packet) => {
    setSelectedPacket(packet);
    setSelectedByteRange(null);
    setCenterViewMode('packet');
  }, []);

  const handleToggleBookmark = useCallback((packetId: number): void => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packetId)) next.delete(packetId);
      else next.add(packetId);
      return next;
    });
  }, []);

  const handleNoteChange = useCallback((packetId: number, note: string): void => {
    const trimmed = note.slice(0, NOTE_MAX_LENGTH);
    setPacketNotes((prev) => {
      if (trimmed.trim().length === 0) {
        const next = { ...prev };
        delete next[packetId];
        return next;
      }
      return { ...prev, [packetId]: trimmed };
    });
  }, []);

  const handleNoteClear = useCallback((packetId: number): void => {
    setPacketNotes((prev) => {
      const next = { ...prev };
      delete next[packetId];
      return next;
    });
  }, []);

  const handlePrevPacket = useCallback((): void => {
    if (filteredPackets.length === 0) return;
    const idx = findPacketIndex(filteredPackets, selectedPacket?.id ?? null);
    if (idx === -1) {
      handleSelectPacket(filteredPackets[filteredPackets.length - 1]!);
      return;
    }
    if (idx > 0) handleSelectPacket(filteredPackets[idx - 1]!);
  }, [filteredPackets, selectedPacket, handleSelectPacket]);

  const handleNextPacket = useCallback((): void => {
    if (filteredPackets.length === 0) return;
    const idx = findPacketIndex(filteredPackets, selectedPacket?.id ?? null);
    if (idx === -1) {
      handleSelectPacket(filteredPackets[FIRST_SESSION_INDEX]!);
      return;
    }
    if (idx < filteredPackets.length - 1) handleSelectPacket(filteredPackets[idx + 1]!);
  }, [filteredPackets, selectedPacket, handleSelectPacket]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey) return;
      if (event.key !== PACKET_NAV_PREV_KEY && event.key !== PACKET_NAV_NEXT_KEY) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if ((PACKET_NAV_IGNORE_TAGS as readonly string[]).includes(tag)) return;
      event.preventDefault();
      if (event.key === PACKET_NAV_PREV_KEY) handlePrevPacket();
      else handleNextPacket();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrevPacket, handleNextPacket]);

  const handleSelectionChange = useCallback((range: ByteRange | null) => {
    setSelectedByteRange(range);
  }, []);

  const handleFilterChange = useCallback((patch: Partial<PacketFilterState>): void => {
    setPacketFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleFilterReset = useCallback((): void => {
    setPacketFilter({ ...DEFAULT_PACKET_FILTER });
  }, []);

  const handleCreateRule = useCallback((draft: NewRuleDraft) => {
    const newId = generateRuleId();
    const now = Date.now();
    setRules((prev) => {
      const paletteSize = RULE_COLOR_PALETTE.length;
      const colorIndex = paletteSize > 0 ? prev.length % paletteSize : 0;
      const newRule: Rule = {
        id: newId, name: draft.name,
        offset: draft.offset, length: draft.length,
        data_type: draft.data_type, anchor: draft.anchor, colorIndex, createdAt: now,
      };
      return [...prev, newRule];
    });
    setSelectedRuleId(newId);
    setSelectedByteRange(null);
    setClearSelectionToken((prev) => prev + 1);
  }, []);

  const handleCreateFromSuggestion = useCallback((suggestion: RuleSuggestion): void => {
    handleCreateRule({
      name: suggestion.suggestedName,
      data_type: suggestion.suggestedType,
      offset: suggestion.offset,
      length: suggestion.length,
      anchor: suggestion.anchor,
    });
  }, [handleCreateRule]);

  const handleCreateAllSuggestions = useCallback((): void => {
    const uncovered = suggestions.filter((s) => {
      const range: ByteRange = { start: s.offset, end: s.offset + s.length - INCLUSIVE_RANGE_ADJUSTMENT };
      return getOverlappingRules(rules, range).length === 0;
    });
    if (uncovered.length === 0) return;
    const now = Date.now();
    setRules((prev) => {
      const paletteSize = RULE_COLOR_PALETTE.length;
      const created: Rule[] = uncovered.map((s, i) => ({
        id: generateRuleId(),
        name: s.suggestedName,
        offset: s.offset,
        length: s.length,
        data_type: s.suggestedType,
        anchor: s.anchor,
        colorIndex: paletteSize > 0 ? (prev.length + i) % paletteSize : 0,
        createdAt: now + i,
      }));
      return [...prev, ...created];
    });
    setSelectedByteRange(null);
    setClearSelectionToken((prev) => prev + 1);
  }, [suggestions, rules]);

  const handleCreateFromLength = useCallback((candidate: LengthCandidate): void => {
    handleCreateRule({
      name: `Length ${candidate.offset}`,
      data_type: candidate.dataType,
      offset: candidate.offset,
      length: candidate.length,
      anchor: 'start',
    });
  }, [handleCreateRule]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    setHoveredRuleId((prev) => (prev === ruleId ? null : prev));
    setSelectedRuleId((prev) => (prev === ruleId ? null : prev));
  }, []);

  const handleDuplicateRule = useCallback((ruleId: string): void => {
    const source = rules.find((r) => r.id === ruleId);
    if (!source) return;
    handleCreateRule({
      name: `${source.name} copy`,
      data_type: source.data_type,
      offset: source.offset,
      length: source.length,
      anchor: source.anchor,
    });
  }, [rules, handleCreateRule]);

  const handleDeleteGroup = useCallback((groupName: string): void => {
    setRules((prev) => prev.filter((r) => {
      const idx = r.name.indexOf(':');
      if (idx <= 0) return true;
      return r.name.slice(0, idx).trim() !== groupName;
    }));
    setSelectedRuleId(null);
    setHoveredRuleId(null);
  }, []);

  const handleHoverRule = useCallback((ruleId: string | null) => setHoveredRuleId(ruleId), []);
  const handleSelectRule = useCallback((ruleId: string | null) => setSelectedRuleId(ruleId), []);

  const handleUpdateRule = useCallback((ruleId: string, patch: RuleUpdatePatch) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  }, []);

  const handleResizeRule = useCallback((ruleId: string, range: ByteRange) => {
    const total = selectedPacket ? getPayloadByteLength(selectedPacket.payload_hex) : null;
    const newLength = range.end - range.start + INCLUSIVE_RANGE_ADJUSTMENT;
    setRules((prev) => prev.map((r) => {
      if (r.id !== ruleId) return r;
      if (r.anchor === 'end' && total !== null) {
        const newOffset = computeEndOffsetForRange(range.start, newLength, total);
        return { ...r, offset: newOffset, length: newLength };
      }
      return { ...r, offset: range.start, length: newLength };
    }));
    setSelectedByteRange(null);
    setClearSelectionToken((prev) => prev + 1);
  }, [selectedPacket]);

  const handleClearSelection = useCallback(() => {
    setClearSelectionToken((prev) => prev + 1);
    setSelectedByteRange(null);
  }, []);

  const handleRequestSelectRange = useCallback((range: ByteRange): void => {
    setCenterViewMode('packet');
    setPendingSelection(range);
    setPendingSelectionToken((prev) => prev + 1);
  }, []);

  const handleLoadMadrigal = useCallback((
    drafts: NewRuleDraft[],
    bookmarks: number[] | null,
    notes: PacketNotesMap | null
  ): void => {
    setRules(() => {
      const paletteSize = RULE_COLOR_PALETTE.length;
      const now = Date.now();
      return drafts.map((d, i) => ({
        id: generateRuleId(),
        name: d.name,
        offset: d.offset,
        length: d.length,
        data_type: d.data_type,
        anchor: d.anchor,
        colorIndex: paletteSize > 0 ? i % paletteSize : 0,
        createdAt: now + i,
      }));
    });
    if (bookmarks !== null) setBookmarkedIds(new Set(bookmarks));
    if (notes !== null) setPacketNotes(notes);
    setSelectedRuleId(null);
    setHoveredRuleId(null);
    setSelectedByteRange(null);
    setClearSelectionToken((prev) => prev + 1);
  }, []);

  const handleApplyRules = useCallback(async (): Promise<void> => {
    if (!projectId || projectId === MOCK_PROJECT_ID || rules.length === 0) return;
    const { backendRules, skippedEndCount, skippedEndNames } = toBackendRules(rules);
    if (backendRules.length === 0) {
      setApplyState({
        status: 'error', matchedPackets: null, totalChecked: null,
        skippedEndRules: skippedEndCount,
        message: `Все ${skippedEndCount} правил end-anchored, бэкенд понимает только start`,
      });
      return;
    }
    setApplyState({ status: 'loading', matchedPackets: null, totalChecked: null, skippedEndRules: skippedEndCount, message: null });
    if (selectedSessionId) {
      try {
        const report = await validateRulesOnBackend(projectId, selectedSessionId, backendRules, "all");
        const suffix = skippedEndCount > 0 ? ` (пропущено end: ${skippedEndNames.join(', ')})` : '';
        setApplyState({
          status: 'success',
          matchedPackets: report.successful_packets,
          totalChecked: report.total_packets_checked,
          skippedEndRules: skippedEndCount,
          message: skippedEndCount > 0 ? `OK, но${suffix}` : null,
        });
        return;
      } catch (err) {
        if (!(err instanceof ApiError)) {
          setApplyState({
            status: 'error', matchedPackets: null, totalChecked: null,
            skippedEndRules: skippedEndCount, message: 'Ошибка валидации корпуса',
          });
          return;
        }
      }
    }
    try {
      const payloads = packets.slice(0, APPLY_FALLBACK_MAX_PAYLOADS).map((p) => p.payload_hex);
      const res = await applyRulesOnBackend(backendRules, payloads);
      let matched = 0;
      for (const pkt of res.results) {
        const allOk = pkt.matches.length > 0 && pkt.matches.every((m) => m.success);
        if (allOk) matched += 1;
      }
      setApplyState({
        status: 'success', matchedPackets: matched, totalChecked: res.results.length,
        skippedEndRules: skippedEndCount, message: null,
      });
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Ошибка проверки правил';
      setApplyState({
        status: 'error', matchedPackets: null, totalChecked: null,
        skippedEndRules: skippedEndCount, message,
      });
    }
  }, [projectId, selectedSessionId, rules, packets]);

  const handleExportRules = useCallback((): void => {
    if (rules.length === 0) return;
    downloadRulesAsJson(rules, buildExportFilename());
  }, [rules]);

  const handleImportRules = useCallback((drafts: NewRuleDraft[]): void => {
    setRules((prev) => {
      const paletteSize = RULE_COLOR_PALETTE.length;
      const now = Date.now();
      const imported: Rule[] = drafts.map((d, i) => ({
        id: generateRuleId(), name: d.name,
        offset: d.offset, length: d.length, data_type: d.data_type,
        anchor: d.anchor,
        colorIndex: paletteSize > 0 ? (prev.length + i) % paletteSize : 0,
        createdAt: now + i,
      }));
      return [...prev, ...imported];
    });
  }, []);

  const handleUseDemo = useCallback((): void => {
    clearLastProject();
    initDemoMode();
    setError(null);
  }, [initDemoMode]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex justify-between items-center shrink-0 z-10 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
          <h1 className="text-[15px] font-semibold tracking-wide text-slate-100 hidden xl:block">
            Анализатор протоколов <span className="text-slate-500 font-normal">/ RE</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <ProjectUploader
            onUploadSuccess={handleUploadSuccess}
            currentFilename={projectFilename}
            backendStatus={backendStatus}
          />
          <select
            value={selectedSessionId ?? ''}
            onChange={(e) => void handleSessionChange(e.target.value)}
            disabled={isLoadingSessions || sessions.length === 0}
            title="TCP-сессия"
            className="max-w-[240px] px-2.5 py-1.5 text-xs font-mono rounded-md bg-slate-800 border border-slate-700 text-slate-200 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50">
            {sessions.length === 0 && <option value="">Нет сессий</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{formatSessionLabel(s)}</option>
            ))}
          </select>
                    {selectedSession?.role_status === "unknown" && (
            <span
              title={selectedSession.warning ?? "Начало TCP-соединения отсутствует в записи"}
              className="max-w-[220px] truncate text-[11px] text-amber-300"
            >
              ⚠ Роли C/S условные
            </span>
          )}
          <div className="flex rounded-md overflow-hidden border border-slate-700 shrink-0">
            <button type="button" onClick={() => setCenterViewMode('packet')} title="Один пакет"
              className={cn('px-2.5 py-1.5 text-xs font-medium cursor-pointer',
                centerViewMode === 'packet' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              Пакет
            </button>
            <button type="button" onClick={() => setCenterViewMode('streams')} title="Потоки"
              className={cn('px-2.5 py-1.5 text-xs font-medium cursor-pointer border-l border-slate-700',
                centerViewMode === 'streams' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              Потоки
            </button>
            <button type="button" onClick={() => setCenterViewMode('diff')} title="Сравнение"
              className={cn('px-2.5 py-1.5 text-xs font-medium cursor-pointer border-l border-slate-700',
                centerViewMode === 'diff' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              Diff
            </button>
            <button type="button" onClick={() => setCenterViewMode('flow')} title="Диаграмма"
              className={cn('px-2.5 py-1.5 text-xs font-medium cursor-pointer border-l border-slate-700',
                centerViewMode === 'flow' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              Flow
            </button>
          </div>
          {isBackendLive && (
            <button type="button" onClick={handleUseDemo} title="Вернуться к демо"
              className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer shrink-0">demo</button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportButton
            projectFilename={projectFilename}
            sessionLabel={sessionLabel}
            packets={packets}
            rules={rules}
            bookmarkedIds={bookmarkedIds}
            notes={packetNotes}
          />
          <ProjectIO
            rules={rules}
            currentFilename={projectFilename}
            backendProjectId={projectId}
            selectedSessionId={selectedSessionId}
            bookmarkedIds={bookmarkedIds}
            notes={packetNotes}
            onLoadProject={handleLoadMadrigal}
          />
          <span className={cn(
            'text-[11px] font-mono px-2 py-1 rounded border hidden md:inline',
            isBackendLive
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
          )}>
            {isBackendLive ? '● LIVE' : '● MOCK'}
          </span>
          {rules.length > 0 && (
            <span className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
              {rules.length} правил
            </span>
          )}
          {error && (
            <span className="hidden lg:flex items-center gap-2 text-xs bg-amber-500/10 text-amber-300 px-3 py-1 rounded border border-amber-500/20 max-w-[260px]">
              <span className="truncate" title={error}>{error}</span>
              <button type="button" onClick={() => setError(null)} className="hover:text-white cursor-pointer">✕</button>
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="w-[360px] min-w-[320px] h-full shrink-0 border-r border-slate-800 flex flex-col">
          <PacketFilterBar
            filter={packetFilter}
            totalCount={packets.length}
            filteredCount={filteredPackets.length}
            anomalyCount={anomalyMap.size}
            bookmarkCount={bookmarkedIds.size}
            selectedRuleName={selectedRule?.name ?? null}
            canUseAnomalyFilter={selectedRule !== null}
            currentIndex={currentFilteredIndex}
            selectedPacketId={selectedPacket?.id ?? null}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
            onPrevPacket={handlePrevPacket}
            onNextPacket={handleNextPacket}
          />
          <div className="flex-1 min-h-0">
            <PacketList
              packets={filteredPackets}
              totalCount={packets.length}
              anomalyMap={anomalyMap}
              bookmarkedIds={bookmarkedIds}
              selectedPacketId={selectedPacket?.id ?? null}
              onSelectPacket={handleSelectPacket}
              onToggleBookmark={handleToggleBookmark}
              rules={rules}
              sessionLabel={sessionLabel}
              isLoadingPackets={isLoadingPackets}
            />
          </div>
          <PacketNotesEditor
            packetId={selectedPacket?.id ?? null}
            note={selectedNote}
            onChange={handleNoteChange}
            onClear={handleNoteClear}
          />
        </div>
        <div className="flex-1 h-full min-w-0 bg-slate-900">
          {centerViewMode === 'streams' ? (
            <StreamViewer
              streams={sessionStreams}
              packets={packets}
              selectedPacketId={selectedPacket?.id ?? null}
              onSelectPacket={handleStreamSelectPacket}
            />
          ) : centerViewMode === 'diff' ? (
            <DiffViewer
              packets={packets}
              packetAId={diffPacketAId}
              packetBId={diffPacketBId}
              onChangeA={setDiffPacketAId}
              onChangeB={setDiffPacketBId}
            />
          ) : centerViewMode === 'flow' ? (
            <FlowViewer
              packets={packets}
              selectedPacketId={selectedPacket?.id ?? null}
              onSelectPacket={handleStreamSelectPacket}
            />
          ) : selectedPacket ? (
            <HexViewer
              key={selectedPacket.id}
              payloadHex={selectedPacket.payload_hex}
              rules={rules}
              hoveredRuleId={hoveredRuleId}
              selectedRuleId={selectedRuleId}
              sessionEntropy={sessionEntropy}
              clearSelectionToken={clearSelectionToken}
              pendingSelection={pendingSelection}
              pendingSelectionToken={pendingSelectionToken}
              onSelectionChange={handleSelectionChange}
              onHoverRule={handleHoverRule}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
              <div className="text-4xl opacity-30">⬡</div>
              <div className="text-sm">Выберите пакет из списка слева</div>
            </div>
          )}
        </div>
        <div className="w-[360px] min-w-[320px] h-full shrink-0 border-l border-slate-800 flex flex-col">
          <div className="shrink-0 max-h-[24%] overflow-y-auto border-b border-slate-800 bg-slate-900">
            <LengthPanel
              candidates={lengthCandidates}
              rules={rules}
              onCreate={handleCreateFromLength}
              onPreviewRange={handleRequestSelectRange}
            />
          </div>
          <div className="shrink-0 max-h-[28%] overflow-y-auto border-b border-slate-800 bg-slate-900">
            <SuggestionList
              suggestions={suggestions}
              rules={rules}
              onCreateOne={handleCreateFromSuggestion}
              onCreateAll={handleCreateAllSuggestions}
              onPreviewRange={handleRequestSelectRange}
            />
          </div>
          <div className="flex-1 min-h-0">
            <RulePanel
              selectedRange={selectedByteRange}
              payloadHex={selectedPacket?.payload_hex ?? EMPTY_PAYLOAD_HEX}
              rules={rules}
              hoveredRuleId={hoveredRuleId}
              selectedRuleId={selectedRuleId}
              packets={packets}
              selectedPacketId={selectedPacket?.id ?? null}
              onCreateRule={handleCreateRule}
              onDeleteRule={handleDeleteRule}
              onDuplicateRule={handleDuplicateRule}
              onDeleteGroup={handleDeleteGroup}
              onHoverRule={handleHoverRule}
              onSelectRule={handleSelectRule}
              onUpdateRule={handleUpdateRule}
              onResizeRule={handleResizeRule}
              onClearSelection={handleClearSelection}
              onSelectPacket={handleSelectPacket}
              onRequestSelectRange={handleRequestSelectRange}
              applyState={applyState}
              isBackendLive={isBackendLive}
              onApplyRules={() => void handleApplyRules()}
              onExportRules={handleExportRules}
              onImportRules={handleImportRules}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;