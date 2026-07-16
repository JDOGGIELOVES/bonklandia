'use client';

import Image from 'next/image';
import {
  DEATH_SPIN_COUNT,
  TOTAL_WAVES,
  VICTORY_CHIP_MULTIPLIER,
  formatBonkChips,
  getMaxJackpot,
  getVictoryRewardSummary,
  getVictorySpins,
} from '@/lib/slot-machine';
import {
  DIFFICULTY_META,
  type Difficulty,
  type PlayableCharacter,
} from '@/lib/characters';

type VictoryRewardModalProps = {
  fighter: PlayableCharacter;
  runNumber: number;
  defeatLine: string;
  onClaimSpins: () => void;
  onRunItBack: () => void;
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <span
      className="inline-flex items-center font-bold rounded-full border text-base px-3 py-1"
      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

export default function VictoryRewardModal({
  fighter,
  runNumber,
  defeatLine,
  onClaimSpins,
  onRunItBack,
}: VictoryRewardModalProps) {
  const victorySpins = getVictorySpins(fighter.difficulty);
  const { maxJackpot } = getVictoryRewardSummary(fighter.difficulty);
  const deathJackpot = getMaxJackpot(1);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="victory-modal victory-reward-modal text-center max-w-xl w-full relative my-8">
        <span className="art-frame-corners-tr" aria-hidden />
        <span className="art-frame-corners-bl" aria-hidden />

        <p className="victory-reward-eyebrow">Run {runNumber} cleared — all {TOTAL_WAVES} waves bonked</p>
        <h2 className="font-display text-5xl md:text-6xl font-bold text-[#f0d878] mb-3">WAGMI!</h2>
        <p className="text-xl mb-4 text-[#f5e6c8]/85">{defeatLine}</p>

        <div className="victory-reward-fighter">
          <div className="art-portrait mx-auto w-fit mb-3">
            <div className="art-portrait-inner">
              <Image
                src={fighter.img}
                alt={fighter.name}
                width={100}
                height={130}
                className="character-img w-[90px] h-[120px] object-contain"
                unoptimized
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h3 className="font-display text-2xl text-[#f0d878]">{fighter.name}</h3>
            <DifficultyBadge difficulty={fighter.difficulty} />
          </div>
          <p className="text-[#f5e6c8]/50 italic mt-1">{fighter.role}</p>
        </div>

        <div className="victory-reward-panel">
          <h4 className="victory-reward-panel-title">Victory Spins — Bonga Chill&apos;s Reward</h4>
          <p className="victory-reward-panel-sub">
            Winners spin before Run It Back. Harder fighters earn more pulls on the one-armed bandit.
          </p>

          <div className="victory-reward-compare">
            <div className="victory-reward-col victory-reward-col-death">
              <span className="victory-reward-col-label">If you had died</span>
              <span className="victory-reward-stat">{DEATH_SPIN_COUNT} spins</span>
              <span className="victory-reward-detail">Wave {1} paytable</span>
              <span className="victory-reward-detail">Up to {formatBonkChips(deathJackpot)} chips</span>
            </div>
            <div className="victory-reward-vs">VS</div>
            <div className="victory-reward-col victory-reward-col-win">
              <span className="victory-reward-col-label">Your victory</span>
              <span className="victory-reward-stat victory-reward-stat-big">{victorySpins} spins</span>
              <span className="victory-reward-detail">Wave {TOTAL_WAVES} max paytable</span>
              <span className="victory-reward-detail">
                +{Math.round((VICTORY_CHIP_MULTIPLIER - 1) * 100)}% chips · up to {formatBonkChips(maxJackpot)}
              </span>
            </div>
          </div>

          <ul className="victory-reward-tiers text-left">
            <li><strong className="text-green-400">Easy</strong> (Bonnie, Beng) → 3 victory spins</li>
            <li><strong className="text-amber-400">Medium</strong> (Bonk, Bonga, Bink) → 5 victory spins</li>
            <li><strong className="text-red-400">Hard</strong> (Bong) → 10 victory spins</li>
          </ul>
        </div>

        <div className="victory-reward-actions">
          <button
            type="button"
            onClick={onClaimSpins}
            className="art-btn victory-reward-primary text-[#f0d878] font-display font-bold text-xl py-4 px-8 w-full"
          >
            Claim {victorySpins} Victory Spins →
          </button>
          <button
            type="button"
            onClick={onRunItBack}
            className="art-btn victory-reward-secondary text-[#f5e6c8]/70 py-3 px-6 w-full"
          >
            Skip &amp; Run It Back
          </button>
          <p className="victory-reward-skip-note text-sm text-[#f5e6c8]/40 italic">
            Skipping forfeits your victory spins for this run.
          </p>
        </div>
      </div>
    </div>
  );
}