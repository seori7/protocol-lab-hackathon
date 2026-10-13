import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PacketList } from './components/PacketList';
import { HexViewer } from './components/HexViewer';
import { ProjectUploader } from './components/ProjectUploader';
import { StreamViewer } from './components/StreamViewer';
import { DiffViewer } from './components/DiffViewer';
import { FlowViewer } from './components/FlowViewer';
import { ProjectIO } from './components/ProjectIO';
import { PacketFilterBar } from './components/PacketFilterBar';
import { PacketNotesEditor } from './components/PacketNotesEditor';
import { ReportButton } from './components/ReportButton';
import { RightSidebar } from './components/RightSidebar';
import { DatabaseIcon, XIcon } from './components/icons';
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

function formatSessionLabel(s: Session): string {
  return `${s.endpoints.join(SESSION_ENDPOINTS_SEPARATOR)} (${s.packet_count})`;
}

function convertBackendRulesToFrontend(br: BackendRuleDef[]): Rule[] {
  const ps = RULE_COLOR_PALETTE.length;
  const now = Date.now();
  return br.map((b, i) => {
    const d = backendRuleToDraft(b);
    return {
      id: b.id, name: d.name, offset: d.offset, length: d.length,
      data_type: d.data_type, anchor: d.anchor,
      colorIndex: ps > 0 ? i % ps : 0, createdAt: now + i,
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
    const local = loadRulesForProject(pid);
    if (pid === MOCK_PROJECT_ID) return local;
    try {
      const st = await loadProjectState(pid);
      if (st.rules.length === 0) return local;
      const conv = convertBackendRulesToFrontend(st.rules);
      const ids = new Set(conv.map((r) => r.id));
      const endOnly = local.filter((r) => r.anchor === 'end' && !ids.has(r.id));
      const ps = RULE_COLOR_PALETTE.length;
      const rec = endOnly.map((r, i) => ({ ...r, colorIndex: ps > 0 ? (conv.length + i) % ps : 0 }));
      return [...conv, ...rec];
    } catch {
      return local;
    }
  }, []);

  const initDemoMode = useCallback((): void => {
    const f = MOCK_SESSIONS[FIRST_SESSION_INDEX]!;
    setProjectId(MOCK_PROJECT_ID);
    setProjectFilename(MOCK_PROJECT_FILENAME);
    setSessions(MOCK_SESSIONS);
    setSelectedSessionId(f.id);
    setPackets(MOCK_PACKETS_MAP[f.id] ?? []);
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
        const ls = await fetchSessions(last.projectId);
        if (ls.length === 0) throw new Error('empty');
        const fid = ls[FIRST_SESSION_INDEX]!.id;
        setProjectId(last.projectId);
        setProjectFilename(last.filename);
        setSessions(ls);
        setSelectedSessionId(fid);
        setRules(await loadRulesWithBackendMerge(last.projectId));
        setBackendStatus('live');
        setIsLoadingPackets(true);
        setPackets(await fetchSessionPackets(last.projectId, fid));
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
      void saveProjectState(projectId, backendRules, serializeNotes(packetNotes)).catch(() => {});
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
    const ln = loadPacketNotes(projectId, selectedSessionId);
    if (Object.keys(ln).length > 0 || projectId === MOCK_PROJECT_ID) {
      setPacketNotes(ln);
      return;
    }
    void (async () => {
      try {
        const st = await loadProjectState(projectId);
        setPacketNotes(parseNotesString(st.notes) ?? {});
      } catch {
        setPacketNotes({});
      }
    })();
  }, [projectId, selectedSessionId]);

  useEffect(() => {
    if (projectId && selectedSessionId) saveBookmarks(projectId, selectedSessionId, bookmarkedIds);
  }, [bookmarkedIds, projectId, selectedSessionId]);

  useEffect(() => {
    if (projectId && selectedSessionId) savePacketNotes(projectId, selectedSessionId, packetNotes);
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
  const selectedNote = useMemo(
    () => (selectedPacket ? (packetNotes[selectedPacket.id] ?? '') : ''),
    [packetNotes, selectedPacket]
  );

  useEffect(() => {
    if (selectedRule === null && packetFilter.onlyAnomalies) {
      setPacketFilter((p) => ({ ...p, onlyAnomalies: false }));
    }
  }, [selectedRule, packetFilter.onlyAnomalies]);

  useEffect(() => {
    if (packets.length < 2) {
      setDiffPacketAId(null);
      setDiffPacketBId(null);
      return;
    }
    const ids = new Set(packets.map((p) => p.id));
    setDiffPacketAId((pr) => (pr !== null && ids.has(pr) ? pr : packets[FIRST_SESSION_INDEX]!.id));
    setDiffPacketBId((pr) => (pr !== null && ids.has(pr) ? pr : (packets[SECOND_PACKET_INDEX] ?? packets[FIRST_SESSION_INDEX]!).id));
  }, [packets]);

  const selectedSession = useMemo(
    () => (selectedSessionId ? (sessions.find((s) => s.id === selectedSessionId) ?? null) : null),
    [sessions, selectedSessionId]
  );
  const sessionLabel = useMemo(
    () => (selectedSession ? formatSessionLabel(selectedSession) : null),
    [selectedSession]
  );

  const handleUploadSuccess = useCallback(async (nid: string, fn: string): Promise<void> => {
    saveLastProject(nid, fn);
    setProjectId(nid);
    setProjectFilename(fn);
    setBackendStatus('live');
    setSelectedRuleId(null);
    setCenterViewMode('packet');
    setError(null);
    setSelectedPacket(null);
    setSelectedByteRange(null);
    setIsLoadingSessions(true);
    try {
      const ls = await fetchSessions(nid);
      setSessions(ls);
      const fid = ls[FIRST_SESSION_INDEX]?.id ?? null;
      setSelectedSessionId(fid);
      setRules(await loadRulesWithBackendMerge(nid));
      if (fid) {
        setIsLoadingPackets(true);
        setPackets(await fetchSessionPackets(nid, fid));
      } else {
        setPackets([]);
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки сессий');
      setSessions([]);
      setPackets([]);
    } finally {
      setIsLoadingSessions(false);
      setIsLoadingPackets(false);
    }
  }, [loadRulesWithBackendMerge]);

  const handleSessionChange = useCallback(async (sid: string): Promise<void> => {
    setSelectedSessionId(sid);
    setSelectedPacket(null);
    setSelectedByteRange(null);
    setHoveredRuleId(null);
    setCenterViewMode('packet');
    if (!projectId) return;
    if (projectId === MOCK_PROJECT_ID) {
      setPackets(MOCK_PACKETS_MAP[sid] ?? []);
      return;
    }
    setIsLoadingPackets(true);
    try {
      setPackets(await fetchSessionPackets(projectId, sid));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки пакетов');
      setPackets([]);
    } finally {
      setIsLoadingPackets(false);
    }
  }, [projectId]);

  const handleSelectPacket = useCallback((p: Packet) => {
    setSelectedPacket(p);
    setSelectedByteRange(null);
  }, []);

  const handleStreamSelectPacket = useCallback((p: Packet) => {
    setSelectedPacket(p);
    setSelectedByteRange(null);
    setCenterViewMode('packet');
  }, []);

  const handleToggleBookmark = useCallback((id: number): void => {
    setBookmarkedIds((pr) => {
      const n = new Set(pr);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleNoteChange = useCallback((id: number, note: string): void => {
    const t = note.slice(0, NOTE_MAX_LENGTH);
    setPacketNotes((pr) => {
      if (t.trim().length === 0) {
        const n = { ...pr };
        delete n[id];
        return n;
      }
      return { ...pr, [id]: t };
    });
  }, []);

  const handleNoteClear = useCallback((id: number): void => {
    setPacketNotes((pr) => {
      const n = { ...pr };
      delete n[id];
      return n;
    });
  }, []);

  const handlePrevPacket = useCallback((): void => {
    if (!filteredPackets.length) return;
    const i = findPacketIndex(filteredPackets, selectedPacket?.id ?? null);
    if (i === -1) handleSelectPacket(filteredPackets[filteredPackets.length - 1]!);
    else if (i > 0) handleSelectPacket(filteredPackets[i - 1]!);
  }, [filteredPackets, selectedPacket, handleSelectPacket]);

  const handleNextPacket = useCallback((): void => {
    if (!filteredPackets.length) return;
    const i = findPacketIndex(filteredPackets, selectedPacket?.id ?? null);
    if (i === -1) handleSelectPacket(filteredPackets[FIRST_SESSION_INDEX]!);
    else if (i < filteredPackets.length - 1) handleSelectPacket(filteredPackets[i + 1]!);
  }, [filteredPackets, selectedPacket, handleSelectPacket]);

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (!e.altKey) return;
      if (e.key !== PACKET_NAV_PREV_KEY && e.key !== PACKET_NAV_NEXT_KEY) return;
      const t = e.target as HTMLElement | null;
      if ((PACKET_NAV_IGNORE_TAGS as readonly string[]).includes(t?.tagName ?? '')) return;
      e.preventDefault();
      if (e.key === PACKET_NAV_PREV_KEY) handlePrevPacket();
      else handleNextPacket();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handlePrevPacket, handleNextPacket]);

  const handleSelectionChange = useCallback((r: ByteRange | null) => setSelectedByteRange(r), []);

  const handleFilterChange = useCallback((p: Partial<PacketFilterState>): void => {
    setPacketFilter((pr) => ({ ...pr, ...p }));
  }, []);

  const handleFilterReset = useCallback((): void => {
    setPacketFilter({ ...DEFAULT_PACKET_FILTER });
  }, []);

  const handleCreateRule = useCallback((d: NewRuleDraft) => {
    const nid = generateRuleId();
    const now = Date.now();
    setRules((pr) => {
      const ps = RULE_COLOR_PALETTE.length;
      return [...pr, {
        id: nid, name: d.name, offset: d.offset, length: d.length,
        data_type: d.data_type, anchor: d.anchor,
        colorIndex: ps > 0 ? pr.length % ps : 0, createdAt: now,
      }];
    });
    setSelectedRuleId(nid);
    setSelectedByteRange(null);
    setClearSelectionToken((p) => p + 1);
  }, []);

  const handleCreateFromSuggestion = useCallback((s: RuleSuggestion): void => {
    handleCreateRule({
      name: s.suggestedName, data_type: s.suggestedType,
      offset: s.offset, length: s.length, anchor: s.anchor,
    });
  }, [handleCreateRule]);

  const handleCreateAllSuggestions = useCallback((): void => {
    const un = suggestions.filter((s) =>
      getOverlappingRules(rules, { start: s.offset, end: s.offset + s.length - INCLUSIVE_RANGE_ADJUSTMENT }).length === 0
    );
    if (!un.length) return;
    const now = Date.now();
    setRules((pr) => {
      const ps = RULE_COLOR_PALETTE.length;
      return [...pr, ...un.map((s, i) => ({
        id: generateRuleId(), name: s.suggestedName, offset: s.offset, length: s.length,
        data_type: s.suggestedType, anchor: s.anchor,
        colorIndex: ps > 0 ? (pr.length + i) % ps : 0, createdAt: now + i,
      }))];
    });
    setSelectedByteRange(null);
    setClearSelectionToken((p) => p + 1);
  }, [suggestions, rules]);

  const handleCreateFromLength = useCallback((c: LengthCandidate): void => {
    handleCreateRule({
      name: `Length ${c.offset}`, data_type: c.dataType,
      offset: c.offset, length: c.length, anchor: 'start',
    });
  }, [handleCreateRule]);

  const handleDeleteRule = useCallback((id: string) => {
    setRules((pr) => pr.filter((r) => r.id !== id));
    setHoveredRuleId((p) => (p === id ? null : p));
    setSelectedRuleId((p) => (p === id ? null : p));
  }, []);

  const handleDuplicateRule = useCallback((id: string): void => {
    const s = rules.find((r) => r.id === id);
    if (s) {
      handleCreateRule({
        name: `${s.name} copy`, data_type: s.data_type,
        offset: s.offset, length: s.length, anchor: s.anchor,
      });
    }
  }, [rules, handleCreateRule]);

  const handleDeleteGroup = useCallback((g: string): void => {
    setRules((pr) => pr.filter((r) => {
      const i = r.name.indexOf(':');
      return i <= 0 || r.name.slice(0, i).trim() !== g;
    }));
    setSelectedRuleId(null);
    setHoveredRuleId(null);
  }, []);

  const handleHoverRule = useCallback((id: string | null) => setHoveredRuleId(id), []);
  const handleSelectRule = useCallback((id: string | null) => setSelectedRuleId(id), []);

  const handleUpdateRule = useCallback((id: string, p: RuleUpdatePatch) => {
    setRules((pr) => pr.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }, []);

  const handleResizeRule = useCallback((id: string, rg: ByteRange) => {
    const t = selectedPacket ? getPayloadByteLength(selectedPacket.payload_hex) : null;
    const nl = rg.end - rg.start + INCLUSIVE_RANGE_ADJUSTMENT;
    setRules((pr) => pr.map((r) => {
      if (r.id !== id) return r;
      if (r.anchor === 'end' && t !== null) {
        return { ...r, offset: computeEndOffsetForRange(rg.start, nl, t), length: nl };
      }
      return { ...r, offset: rg.start, length: nl };
    }));
    setSelectedByteRange(null);
    setClearSelectionToken((p) => p + 1);
  }, [selectedPacket]);

  const handleClearSelection = useCallback(() => {
    setClearSelectionToken((p) => p + 1);
    setSelectedByteRange(null);
  }, []);

  const handleRequestSelectRange = useCallback((rg: ByteRange): void => {
    setCenterViewMode('packet');
    setPendingSelection(rg);
    setPendingSelectionToken((p) => p + 1);
  }, []);

  const handleLoadMadrigal = useCallback((
    drafts: NewRuleDraft[], bm: number[] | null, nt: PacketNotesMap | null
  ): void => {
    setRules(() => {
      const ps = RULE_COLOR_PALETTE.length;
      const now = Date.now();
      return drafts.map((d, i) => ({
        id: generateRuleId(), name: d.name, offset: d.offset, length: d.length,
        data_type: d.data_type, anchor: d.anchor,
        colorIndex: ps > 0 ? i % ps : 0, createdAt: now + i,
      }));
    });
    if (bm !== null) setBookmarkedIds(new Set(bm));
    if (nt !== null) setPacketNotes(nt);
    setSelectedRuleId(null);
    setHoveredRuleId(null);
    setSelectedByteRange(null);
    setClearSelectionToken((p) => p + 1);
  }, []);

  const handleApplyRules = useCallback(async (): Promise<void> => {
    if (!projectId || projectId === MOCK_PROJECT_ID || !rules.length) return;
    const { backendRules, skippedEndCount, skippedEndNames } = toBackendRules(rules);
    if (!backendRules.length) {
      setApplyState({
        status: 'error', matchedPackets: null, totalChecked: null,
        skippedEndRules: skippedEndCount, message: `Все ${skippedEndCount} правил end-anchored`,
      });
      return;
    }
    setApplyState({
      status: 'loading', matchedPackets: null, totalChecked: null,
      skippedEndRules: skippedEndCount, message: null,
    });
    if (selectedSessionId) {
      try {
        const rep = await validateRulesOnBackend(projectId, selectedSessionId, backendRules, 'all');
        setApplyState({
          status: 'success', matchedPackets: rep.successful_packets,
          totalChecked: rep.total_packets_checked, skippedEndRules: skippedEndCount,
          message: skippedEndCount ? `Пропущено end: ${skippedEndNames.join(', ')}` : null,
        });
        return;
      } catch (err) {
        if (!(err instanceof ApiError)) {
          setApplyState({
            status: 'error', matchedPackets: null, totalChecked: null,
            skippedEndRules: skippedEndCount, message: 'Ошибка валидации',
          });
          return;
        }
      }
    }
    try {
      const pls = packets.slice(0, APPLY_FALLBACK_MAX_PAYLOADS).map((p) => p.payload_hex);
      const res = await applyRulesOnBackend(backendRules, pls);
      let m = 0;
      for (const pkt of res.results) {
        if (pkt.matches.length && pkt.matches.every((x) => x.success)) m++;
      }
      setApplyState({
        status: 'success', matchedPackets: m, totalChecked: res.results.length,
        skippedEndRules: skippedEndCount, message: null,
      });
    } catch (err: unknown) {
      setApplyState({
        status: 'error', matchedPackets: null, totalChecked: null,
        skippedEndRules: skippedEndCount,
        message: err instanceof ApiError ? err.message : 'Ошибка проверки',
      });
    }
  }, [projectId, selectedSessionId, rules, packets]);

  const handleExportRules = useCallback((): void => {
    if (rules.length) downloadRulesAsJson(rules, buildExportFilename());
  }, [rules]);

  const handleImportRules = useCallback((drafts: NewRuleDraft[]): void => {
    setRules((pr) => {
      const ps = RULE_COLOR_PALETTE.length;
      const now = Date.now();
      return [...pr, ...drafts.map((d, i) => ({
        id: generateRuleId(), name: d.name, offset: d.offset, length: d.length,
        data_type: d.data_type, anchor: d.anchor,
        colorIndex: ps > 0 ? (pr.length + i) % ps : 0, createdAt: now + i,
      }))];
    });
  }, []);

  const handleUseDemo = useCallback((): void => {
    clearLastProject();
    initDemoMode();
    setError(null);
  }, [initDemoMode]);

  const modes: Array<{ id: CenterViewMode; label: string; title: string }> = [
    { id: 'packet', label: 'Пакет', title: 'Один пакет' },
    { id: 'streams', label: 'Потоки', title: 'Потоки' },
    { id: 'diff', label: 'Diff', title: 'Сравнение' },
    { id: 'flow', label: 'Flow', title: 'Диаграмма' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#0e0f11] text-zinc-200 font-sans">
      <header className="bg-[#15161a] border-b border-white/[0.07] px-4 py-2.5 flex justify-between items-center shrink-0 z-10 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#f4f4f5] text-[#18181b] flex items-center justify-center text-[12px] font-bold tracking-tight">PL</div>
          <h1 className="text-[13px] font-semibold tracking-wide text-zinc-100 hidden xl:block">
            Protocol Lab <span className="text-zinc-500 font-normal">/ Reverse Engineering</span>
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
            disabled={isLoadingSessions || !sessions.length}
            title="TCP-сессия"
            className="max-w-[240px] h-8 px-2.5 text-[12px] font-mono rounded-md bg-[#1a1c20] border border-white/[0.07] text-zinc-200 outline-none focus:border-white/25 cursor-pointer disabled:opacity-50 truncate"
          >
            {!sessions.length && <option value="">Нет сессий</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{formatSessionLabel(s)}</option>
            ))}
          </select>
          <div className="flex rounded-md overflow-hidden border border-white/[0.08] shrink-0">
            {modes.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCenterViewMode(m.id)}
                title={m.title}
                className={cn(
                  'h-8 px-3 text-[12px] font-medium cursor-pointer transition-all',
                  i > 0 && 'border-l border-white/[0.08]',
                  centerViewMode === m.id
                    ? 'bg-[#f4f4f5] text-[#18181b] font-semibold'
                    : 'bg-[#1a1c20] text-zinc-400 hover:text-white hover:bg-[#22242a)'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {isBackendLive && (
            <button
              type="button"
              onClick={handleUseDemo}
              title="Вернуться к демо"
              className="text-[11px] text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0 transition-colors"
            >
              demo
            </button>
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
            'hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded border',
            isBackendLive
              ? 'text-zinc-200 bg-white/[0.06] border-white/10'
              : 'text-zinc-500 bg-white/[0.03] border-white/[0.07]'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', isBackendLive ? 'bg-emerald-400' : 'bg-zinc-600')} />
            {isBackendLive ? 'LIVE' : 'MOCK'}
          </span>
          {rules.length > 0 && (
            <span className="text-[11px] font-mono text-zinc-300 bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded">
              {rules.length} правил
            </span>
          )}
          {error && (
            <span className="hidden lg:flex items-center gap-2 text-[12px] bg-red-400/10 text-red-200/90 px-3 py-1 rounded border border-red-400/20 max-w-[260px]">
              <span className="truncate" title={error}>{error}</span>
              <button type="button" onClick={() => setError(null)} className="hover:text-white cursor-pointer">
                <XIcon size={12} />
              </button>
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-[360px] min-w-[320px] shrink-0 border-r border-white/[0.07] flex flex-col min-h-0 bg-[#15161a]">
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

        <div className="flex-1 min-w-0 min-h-0 bg-[#0e0f11] flex flex-col">
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
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
              <DatabaseIcon size={28} className="text-zinc-700" />
              <div className="text-[13px]">Выберите пакет из списка слева</div>
            </div>
          )}
        </div>

        <div className="w-[360px] min-w-[320px] shrink-0 border-l border-white/[0.07] flex flex-col min-h-0 bg-[#15161a]">
          <RightSidebar
            selectedRange={selectedByteRange}
            payloadHex={selectedPacket?.payload_hex ?? EMPTY_PAYLOAD_HEX}
            rules={rules}
            hoveredRuleId={hoveredRuleId}
            selectedRuleId={selectedRuleId}
            packets={packets}
            selectedPacketId={selectedPacket?.id ?? null}
            lengthCandidates={lengthCandidates}
            suggestions={suggestions}
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
            onCreateFromLength={handleCreateFromLength}
            onCreateFromSuggestion={handleCreateFromSuggestion}
            onCreateAllSuggestions={handleCreateAllSuggestions}
            applyState={applyState}
            isBackendLive={isBackendLive}
            onApplyRules={() => void handleApplyRules()}
            onExportRules={handleExportRules}
            onImportRules={handleImportRules}
          />
        </div>
      </main>
    </div>
  );
}

export default App;