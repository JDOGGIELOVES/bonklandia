'use client';

import { useState } from 'react';
import {
  BONK_FAM_ORIGIN,
  BONK_TIMELINE,
  CHARACTER_LORE,
  DEGEN_VALLEY_LORE,
  FAM_BLOODLINES,
  type CharacterLore,
} from '@/lib/lore';
import { PLAYABLE_CHARACTERS } from '@/lib/characters';
import { BRAND } from '@/lib/brand';

type LoreTab = 'origin' | 'chronicle' | 'fam';

function LoreMemberCard({ lore }: { lore: CharacterLore }) {
  const character = PLAYABLE_CHARACTERS.find(c => c.id === lore.id);
  return (
    <article className="lore-member-card">
      <div className="lore-member-header">
        <h4 className="lore-member-name">{character?.name ?? lore.id}</h4>
        <span className="lore-member-epithet">{lore.epithet}</span>
      </div>
      <p className="lore-member-text">{lore.backstory}</p>
      <p className="lore-member-legend">
        <span className="lore-member-legend-label">Legend</span>
        {lore.legend}
      </p>
      <blockquote className="lore-member-quote">{lore.quote}</blockquote>
    </article>
  );
}

type FamLorePanelProps = {
  open: boolean;
  onToggle: () => void;
  highlightId?: string | null;
};

export default function FamLorePanel({ open, onToggle, highlightId }: FamLorePanelProps) {
  const [tab, setTab] = useState<LoreTab>('origin');

  if (!open) {
    return (
      <button type="button" onClick={onToggle} className="art-btn mb-6 w-full py-3 text-[#f5e6c8]/80 hover:text-[#f5e6c8]">
        Read {BRAND.chronicle}
      </button>
    );
  }

  return (
    <div className="lore-frame mb-8 overflow-hidden">
      <div className="lore-frame-header flex items-center justify-between px-5 py-3 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold text-[#d4af37]">{BRAND.chronicle}</h2>
        <button type="button" onClick={onToggle} className="text-amber-200/70 hover:text-amber-200 text-lg leading-none px-2">
          ✕
        </button>
      </div>

      <div className="lore-tabs px-5 pt-4 flex flex-wrap gap-2">
        {([
          ['origin', 'Origin'],
          ['chronicle', 'Timeline'],
          ['fam', 'The Six'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`lore-tab ${tab === id ? 'lore-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'origin' && (
          <div className="lore-origin">
            <h3 className="lore-section-title">{BONK_FAM_ORIGIN.title}</h3>
            <p className="lore-section-subtitle">{BONK_FAM_ORIGIN.subtitle}</p>
            {BONK_FAM_ORIGIN.passages.map((p, i) => (
              <p key={i} className="lore-paragraph">{p}</p>
            ))}
            <div className="lore-bloodlines mt-6">
              <h4 className="lore-bloodlines-title">Six Bloodlines, Six Virtues</h4>
              <div className="lore-bloodlines-grid">
                {FAM_BLOODLINES.map(line => (
                  <div key={line.name} className="lore-bloodline-pill" style={{ borderColor: line.color }}>
                    <span className="lore-bloodline-name" style={{ color: line.color }}>{line.name}</span>
                    <span className="lore-bloodline-virtue">{line.virtue}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lore-valley mt-6">
              <h4 className="lore-section-title text-xl">{DEGEN_VALLEY_LORE.title}</h4>
              <p className="lore-paragraph">{DEGEN_VALLEY_LORE.text}</p>
            </div>
          </div>
        )}

        {tab === 'chronicle' && (
          <ol className="lore-timeline">
            {BONK_TIMELINE.map((entry, i) => (
              <li key={entry.title} className="lore-timeline-entry">
                <div className="lore-timeline-marker">{i + 1}</div>
                <div className="lore-timeline-body">
                  <span className="lore-timeline-era">{entry.era}</span>
                  <h4 className="lore-timeline-title">{entry.title}</h4>
                  <p className="lore-timeline-text">{entry.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === 'fam' && (
          <div className="lore-members-grid">
            {PLAYABLE_CHARACTERS.map(char => {
              const lore = CHARACTER_LORE[char.id];
              if (!lore) return null;
              return (
                <div
                  key={char.id}
                  className={highlightId === char.id ? 'lore-member-highlight' : ''}
                >
                  <LoreMemberCard lore={lore} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CharacterLoreSnippet({ characterId }: { characterId: string }) {
  const lore = CHARACTER_LORE[characterId];
  if (!lore) return null;

  return (
    <div className="lore-snippet mt-4 pt-4 border-t border-[#d4af37]/15">
      <p className="text-sm uppercase tracking-[0.2em] text-[#d4af37]/55 mb-1">{lore.epithet}</p>
      <p className="text-base text-[#f5e6c8]/70 leading-relaxed mb-2">{lore.backstory}</p>
      <p className="text-base italic text-[#f5e6c8]/50">{lore.quote}</p>
    </div>
  );
}