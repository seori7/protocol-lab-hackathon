export type PacketDirection = "client_to_server" | "server_to_client";

export interface Packet {
  id: number;
  timestamp: number;
  direction: PacketDirection;
  payload_hex: string;
  seq?: number;
  payload_len?: number;
  anomaly?: string | null;
}

export interface ByteRange { start: number; end: number; }

export interface HexByte {
  offset: number;
  hex: string;
  ascii: string;
}

export interface HexLine {
  lineIndex: number;
  startOffset: number;
  offsetLabel: string;
  bytes: HexByte[];
}

export type RuleDataType =
  | "bytes" | "ascii"
  | "uint8" | "int8"
  | "uint16_be" | "uint16_le" | "int16_be" | "int16_le"
  | "uint32_be" | "uint32_le" | "int32_be" | "int32_le"
  | "float32_be" | "float32_le"
  | "float64_be" | "float64_le"
  | "ipv4";

export interface DataTypeOption {
  value: RuleDataType;
  label: string;
  hint: string;
  expectedLength: number | null;
}

export interface RuleColorTheme {
  id: string;
  byteBackground: string;
  byteBackgroundActive: string;
  byteText: string;
  dotBackground: string;
  chipBackground: string;
  chipBorder: string;
}

export type RuleAnchor = "start" | "end";

export interface AnchorOption {
  value: RuleAnchor;
  label: string;
  hint: string;
}

export interface Rule {
  id: string;
  name: string;
  offset: number;
  length: number;
  data_type: RuleDataType;
  anchor: RuleAnchor;
  colorIndex: number;
  createdAt: number;
}

export interface NewRuleDraft {
  name: string;
  data_type: RuleDataType;
  offset: number;
  length: number;
  anchor: RuleAnchor;
}

export interface RuleUpdatePatch {
  name?: string;
  data_type?: RuleDataType;
  offset?: number;
  anchor?: RuleAnchor;
}

export interface RuleValidationRow {
  packetId: number;
  timestamp: number;
  direction: PacketDirection;
  hexText: string;
  value: string;
  isApplicable: boolean;
}

export interface CoverageSegment {
  start: number;
  end: number;
  rule: Rule | null;
}

export interface UncoveredGap extends ByteRange {
  length: number;
}

export interface CoverageStats {
  totalBytes: number;
  coveredBytes: number;
  coveragePercent: number;
  gapCount: number;
  gaps: UncoveredGap[];
  segments: CoverageSegment[];
}

export interface ValueDistributionEntry {
  value: string;
  hexText: string;
  count: number;
  percent: number;
  packetIds: number[];
}

export interface DataInspectorRow {
  dataType: RuleDataType;
  label: string;
  hint: string;
  value: string;
  isApplicable: boolean;
  applicabilityReason: string | null;
}

export type StructExportFormat = "c" | "python" | "markdown";
export type CenterViewMode = "packet" | "streams" | "diff" | "flow";
export type StreamDirection = "client_to_server" | "server_to_client";

export interface StreamChunk {
  packetId: number;
  timestamp: number;
  startOffset: number;
  endOffset: number;
  length: number;
  payloadHex: string;
}

export interface ReassembledStream {
  direction: StreamDirection;
  totalBytes: number;
  totalHex: string;
  chunks: StreamChunk[];
}

export interface SessionStreams {
  clientToServer: ReassembledStream;
  serverToClient: ReassembledStream;
}

export interface EntropyColumn {
  offset: number;
  sampleCount: number;
  distinctCount: number;
  entropy: number;
}

export interface SessionEntropy {
  maxLength: number;
  columns: EntropyColumn[];
}

export interface EntropyChangepoint {
  offset: number;
  strength: number;
  leftAvg: number;
  rightAvg: number;
}

export type DiffByteStatus = "same" | "diff" | "only-a" | "only-b";

export interface DiffCell {
  offset: number;
  hexA: string | null;
  hexB: string | null;
  status: DiffByteStatus;
}

export interface DiffLine {
  lineIndex: number;
  startOffset: number;
  offsetLabel: string;
  cells: DiffCell[];
}

export interface DiffStats {
  totalSlots: number;
  lengthA: number;
  lengthB: number;
  sameBytes: number;
  diffBytes: number;
  onlyABytes: number;
  onlyBBytes: number;
  similarityPercent: number;
}

export interface RuleSuggestion {
  id: string;
  offset: number;
  length: number;
  anchor: RuleAnchor;
  suggestedName: string;
  suggestedType: RuleDataType;
  reason: string;
  sampleHex: string;
  sampleValue: string;
  packetCount: number;
}

export interface LengthCandidate {
  id: string;
  offset: number;
  length: number;
  dataType: RuleDataType;
  mode: "total" | "remaining";
  matchRate: number;
  matchedCount: number;
  totalChecked: number;
  sampleValue: string;
}

export type FilterDirection = "all" | PacketDirection;

export interface PacketFilterState {
  direction: FilterDirection;
  minLength: number | null;
  maxLength: number | null;
  hexQuery: string;
  onlyAnomalies: boolean;
  onlyBookmarked: boolean;
}

export type AnomalyReason = "short_packet" | "rare_value";
export type PacketNotesMap = Record<number, string>;

export interface BackendRulePayload {
  offset: number;
  length: number;
  data_type: string;
  name: string;
  anchor: RuleAnchor;
}

export type BackendEndianness = "big" | "little";

export interface BackendRuleDef {
  id: string;
  name: string;
  offset: number;
  length: number;
  data_type: string;
  endianness: BackendEndianness;
}

export interface BackendApplyMatch {
  rule_id: string;
  rule_name: string;
  success: boolean;
  value: unknown;
  error: string | null;
}

export interface BackendApplyPacketResult {
  payload: string;
  matches: BackendApplyMatch[];
}

export interface ApplyRulesResponse {
  status: string;
  results: BackendApplyPacketResult[];
}

export type ValidateDirectionFilter = "all" | PacketDirection;

export interface ValidatePacketResult {
  packet_id: number;
  timestamp: number;
  payload_hex: string;
  anomaly: string | null;
  is_valid: boolean;
  parsed_values: Record<string, unknown> | null;
  errors: string[] | null;
}

export interface ValidateCorpusReport {
  total_packets_checked: number;
  successful_packets: number;
  failed_packets: number;
  results: ValidatePacketResult[];
}

export interface BackendProjectState {
  rules: BackendRuleDef[];
  notes: string;
}

export interface ExportParserResponse {
  status: string;
  script: string;
}

export interface InfosecSignaturesResponse {
  signatures: string[];
}

export interface InfosecEntropyResponse {
  entropy: number;
  is_encrypted: boolean;
}

export interface InfosecDiffItem {
  offset: number;
  byte_a: string;
  byte_b: string;
}

export interface InfosecDiffResponse {
  is_identical: boolean;
  length_difference: number;
  differing_bytes: InfosecDiffItem[];
}

export interface MadrigalMeta {
  bookmarks: number[];
  notes: PacketNotesMap;
}

export interface MadrigalProjectFile {
  app: "protocol-lab";
  version: 1 | 2;
  savedAt: string;
  project: {
    filename: string | null;
    backendProjectId: string | null;
    sessionId: string | null;
  };
  rules: BackendRulePayload[];
  meta?: MadrigalMeta;
}

export interface ParsedMadrigalImport {
  file: MadrigalProjectFile;
  drafts: NewRuleDraft[];
  skipped: number;
  bookmarks: number[] | null;
  notes: PacketNotesMap | null;
}

export interface Session {
  id: string;
  endpoints: string[];
  packet_count: number;
  first_frame_number?: number;
  role_status?: "syn_observed" | "unknown";
  warning?: string | null;
}

export interface BackendPacketPayload {
  id: number;
  timestamp: number;
  direction: string;
  seq: number;
  payload_hex: string;
  payload_len: number;
  anomaly: string | null;
  applied_rules?: unknown[];
}

export interface UploadProjectResponse { project_id: string; filename: string; }
export interface SessionsListResponse { sessions: Session[]; }
export interface SessionPacketsResponse { packets: BackendPacketPayload[]; }

export type ApplyStatus = "idle" | "loading" | "success" | "error";

export interface ApplyRulesState {
  status: ApplyStatus;
  matchedPackets: number | null;
  totalChecked: number | null;
  skippedEndRules: number;
  message: string | null;
}

export type BackendStatus = "live" | "mock";
export interface ParsedRulesImport { drafts: NewRuleDraft[]; skipped: number; }
export interface LastProjectInfo { projectId: string; filename: string; }

export interface GroupedRuleSection {
  groupName: string | null;
  rules: Rule[];
}

export interface ShortcutEntry {
  keys: string;
  action: string;
  context: string;
}

export interface SessionSummaryStats {
  packetCount: number;
  totalBytes: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
  clientCount: number;
  serverCount: number;
  avgCoveragePercent: number | null;
  sampledPackets: number;
}

export interface DataInspectorProps {
  selectedRange: ByteRange | null;
  payloadHex: string;
  rules: Rule[];
  draftName: string;
  draftAnchor: RuleAnchor;
  draftOffset: number;
  selectedLength: number;
  activeType: RuleDataType;
  onPickType: (dataType: RuleDataType) => void;
  onCreateRule: (draft: NewRuleDraft) => void;
}

export interface HexViewerProps {
  payloadHex: string;
  rules: Rule[];
  hoveredRuleId: string | null;
  selectedRuleId: string | null;
  sessionEntropy: SessionEntropy | null;
  clearSelectionToken?: number;
  pendingSelection?: ByteRange | null;
  pendingSelectionToken?: number;
  onSelectionChange?: (range: ByteRange | null) => void;
  onHoverRule?: (ruleId: string | null) => void;
}

export interface DiffViewerProps {
  packets: Packet[];
  packetAId: number | null;
  packetBId: number | null;
  onChangeA: (packetId: number) => void;
  onChangeB: (packetId: number) => void;
}

export interface FlowViewerProps {
  packets: Packet[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
}

export interface LengthPanelProps {
  candidates: LengthCandidate[];
  rules: Rule[];
  onCreate: (candidate: LengthCandidate) => void;
  onPreviewRange: (range: ByteRange) => void;
}

export interface SuggestionListProps {
  suggestions: RuleSuggestion[];
  rules: Rule[];
  onCreateOne: (suggestion: RuleSuggestion) => void;
  onCreateAll: () => void;
  onPreviewRange: (range: ByteRange) => void;
}

export interface PacketFilterBarProps {
  filter: PacketFilterState;
  totalCount: number;
  filteredCount: number;
  anomalyCount: number;
  bookmarkCount: number;
  selectedRuleName: string | null;
  canUseAnomalyFilter: boolean;
  currentIndex: number;
  selectedPacketId: number | null;
  onFilterChange: (patch: Partial<PacketFilterState>) => void;
  onReset: () => void;
  onPrevPacket: () => void;
  onNextPacket: () => void;
}

export interface PacketNotesEditorProps {
  packetId: number | null;
  note: string;
  onChange: (packetId: number, note: string) => void;
  onClear: (packetId: number) => void;
}

export interface ReportButtonProps {
  projectFilename: string | null;
  sessionLabel: string | null;
  packets: Packet[];
  rules: Rule[];
  bookmarkedIds: Set<number>;
  notes: PacketNotesMap;
}

export interface RulePanelProps {
  selectedRange: ByteRange | null;
  payloadHex: string;
  rules: Rule[];
  hoveredRuleId: string | null;
  selectedRuleId: string | null;
  packets: Packet[];
  selectedPacketId: number | null;
  onCreateRule: (draft: NewRuleDraft) => void;
  onDeleteRule: (ruleId: string) => void;
  onDuplicateRule: (ruleId: string) => void;
  onDeleteGroup: (groupName: string) => void;
  onHoverRule: (ruleId: string | null) => void;
  onSelectRule: (ruleId: string | null) => void;
  onUpdateRule: (ruleId: string, patch: RuleUpdatePatch) => void;
  onResizeRule: (ruleId: string, range: ByteRange) => void;
  onClearSelection: () => void;
  onSelectPacket: (packet: Packet) => void;
  onRequestSelectRange: (range: ByteRange) => void;
  applyState: ApplyRulesState;
  isBackendLive: boolean;
  onApplyRules: () => void;
  onExportRules: () => void;
  onImportRules: (drafts: NewRuleDraft[]) => void;
}

export interface RuleInspectorProps {
  rule: Rule;
  payloadHex: string;
  selectedRange: ByteRange | null;
  onUpdate: (patch: RuleUpdatePatch) => void;
  onResize: (range: ByteRange) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export interface RuleValidationTableProps {
  rule: Rule;
  packets: Packet[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
}

export interface ValueDistributionProps {
  rule: Rule;
  packets: Packet[];
  selectedPacketId: number | null;
  maxEntries: number;
  onSelectPacket: (packet: Packet) => void;
}

export interface CoverageBarProps {
  stats: CoverageStats;
  selectionRange: ByteRange | null;
  hoveredRuleId: string | null;
  selectedRuleId: string | null;
  onSelectRange: (range: ByteRange) => void;
  onHoverRule: (ruleId: string | null) => void;
}

export interface EntropyStripProps {
  entropy: SessionEntropy;
  selectionRange: ByteRange | null;
  onSelectRange: (range: ByteRange) => void;
}

export interface StreamViewerProps {
  streams: SessionStreams;
  packets: Packet[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
}

export interface ProjectIOProps {
  rules: Rule[];
  currentFilename: string | null;
  backendProjectId: string | null;
  selectedSessionId: string | null;
  bookmarkedIds: Set<number>;
  notes: PacketNotesMap;
  onLoadProject: (
    drafts: NewRuleDraft[],
    bookmarks: number[] | null,
    notes: PacketNotesMap | null
  ) => void;
}

export interface PacketListProps {
  packets: Packet[];
  totalCount: number;
  anomalyMap: Map<number, AnomalyReason>;
  bookmarkedIds: Set<number>;
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
  onToggleBookmark: (packetId: number) => void;
  rules: Rule[];
  sessionLabel: string | null;
  isLoadingPackets: boolean;
}

export interface HexMinimapProps {
  stats: CoverageStats;
  selectionRange: ByteRange | null;
  hoveredRuleId: string | null;
  selectedRuleId: string | null;
  onSelectRange: (range: ByteRange) => void;
  onHoverRule: (ruleId: string | null) => void;
}

export interface SessionStatsBarProps {
  packets: Packet[];
  totalCount: number;
  rules: Rule[];
}

export interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export interface GroupHeaderProps {
  groupName: string;
  count: number;
  isCollapsed: boolean;
  groupRules: Rule[];
  onToggle: () => void;
  onDeleteGroup: (groupName: string) => void;
}

export interface ProjectUploaderProps {
  onUploadSuccess: (projectId: string, filename: string) => void;
  currentFilename: string | null;
  backendStatus: BackendStatus;
}