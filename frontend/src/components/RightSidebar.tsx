import { useState, type FC } from 'react';
import type { ByteRange, Rule, NewRuleDraft, RuleUpdatePatch, RuleSuggestion, LengthCandidate, Packet, PacketNotesMap, ApplyRulesState, PacketFilterState } from '../types';
import { RulePanel } from './RulePanel';
import { LengthPanel } from './LengthPanel';
import { SuggestionList } from './SuggestionList';
import { cn } from '../utils/cn';
type TabId = 'rules' | 'length' | 'ideas';
interface Props {
  selectedRange: ByteRange | null; payloadHex: string; rules: Rule[]; hoveredRuleId: string | null; selectedRuleId: string | null;
  packets: Packet[]; selectedPacketId: number | null;
  lengthCandidates: LengthCandidate[]; suggestions: RuleSuggestion[];
  onCreateRule: (d: NewRuleDraft) => void; onDeleteRule: (id: string) => void; onDuplicateRule: (id: string) => void; onDeleteGroup: (g: string) => void;
  onHoverRule: (id: string | null) => void; onSelectRule: (id: string | null) => void; onUpdateRule: (id: string, p: RuleUpdatePatch) => void;
  onResizeRule: (id: string, r: ByteRange) => void; onClearSelection: () => void; onSelectPacket: (p: Packet) => void;
  onRequestSelectRange: (r: ByteRange) => void;
  onCreateFromLength: (c: LengthCandidate) => void; onCreateFromSuggestion: (s: RuleSuggestion) => void; onCreateAllSuggestions: () => void;
  applyState: ApplyRulesState; isBackendLive: boolean; onApplyRules: () => void; onExportRules: () => void; onImportRules: (d: NewRuleDraft[]) => void;
  packetFilter?: PacketFilterState; bookmarkedIds?: Set<number>; packetNotes?: PacketNotesMap;
}
export const RightSidebar: FC<Props> = (p) => {
  const [tab, setTab] = useState<TabId>('rules');
  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: 'rules', label: 'Правила', count: p.rules.length },
    { id: 'length', label: 'Длина', count: p.lengthCandidates.length },
    { id: 'ideas', label: 'Идеи', count: p.suggestions.length },
  ];
  return (
    <div className="flex flex-col h-full min-h-0 bg-[#15161a] font-sans">
      <div className="flex border-b border-white/[0.07] shrink-0">
        {tabs.map((t, i) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn('flex-1 h-9 text-[12px] font-medium cursor-pointer transition-all', i > 0 && 'border-l border-white/[0.07]',
              tab === t.id ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]')}>
            {t.label} <span className="font-mono text-[11px] opacity-70">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'rules' ? (
          <RulePanel selectedRange={p.selectedRange} payloadHex={p.payloadHex} rules={p.rules} hoveredRuleId={p.hoveredRuleId} selectedRuleId={p.selectedRuleId} packets={p.packets} selectedPacketId={p.selectedPacketId} onCreateRule={p.onCreateRule} onDeleteRule={p.onDeleteRule} onDuplicateRule={p.onDuplicateRule} onDeleteGroup={p.onDeleteGroup} onHoverRule={p.onHoverRule} onSelectRule={p.onSelectRule} onUpdateRule={p.onUpdateRule} onResizeRule={p.onResizeRule} onClearSelection={p.onClearSelection} onSelectPacket={p.onSelectPacket} onRequestSelectRange={p.onRequestSelectRange} applyState={p.applyState} isBackendLive={p.isBackendLive} onApplyRules={p.onApplyRules} onExportRules={p.onExportRules} onImportRules={p.onImportRules} />
        ) : tab === 'length' ? (
          <div className="flex-1 min-h-0 overflow-y-auto"><LengthPanel candidates={p.lengthCandidates} rules={p.rules} onCreate={p.onCreateFromLength} onPreviewRange={p.onRequestSelectRange} /></div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto"><SuggestionList suggestions={p.suggestions} rules={p.rules} onCreateOne={p.onCreateFromSuggestion} onCreateAll={p.onCreateAllSuggestions} onPreviewRange={p.onRequestSelectRange} /></div>
        )}
      </div>
    </div>
  );
};