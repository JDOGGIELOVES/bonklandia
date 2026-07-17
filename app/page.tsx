'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import LandingHero from '@/components/LandingHero';
import LandingScene from '@/components/LandingScene';
import {
  DIFFICULTY_META,
  PLAYABLE_CHARACTERS,
  type CharacterAbility,
  type Difficulty,
  type PlayableCharacter,
  calcCounterDamage,
} from '@/lib/characters';
import {
  DEGEN_ENEMIES,
  type Enemy,
  getEnemyAttackShout,
  getRunScalingInfo,
  pickEnemyByWave,
} from '@/lib/enemies';
import {
  buildCasinoSession,
  type CasinoSession,
} from '@/lib/slot-machine';
import {
  buildLocalSecureSession,
  fetchServerCasinoSession,
  type CasinoSecureSession,
} from '@/lib/casino-client';
import CasinoSlot from '@/components/CasinoSlot';
import CombatArenaVfx from '@/components/CombatArenaVfx';
import VictoryRewardModal from '@/components/VictoryRewardModal';
import FamLorePanel, { CharacterLoreSnippet } from '@/components/FamLorePanel';
import { getAbilityMotionClass, getEnemyMotionClass } from '@/lib/combat-vfx';
import { BONGACHILL_LORE, DEGEN_VALLEY_LORE, getCharacterLore } from '@/lib/lore';
import { resolveEnemyAbility } from '@/lib/enemy-abilities';
import { pickWaveModifier, type WaveModifier } from '@/lib/wave-modifiers';
import { useCombatAudio } from '@/hooks/useCombatAudio';
import { BRAND, LEGACY_STORAGE_KEYS } from '@/lib/brand';

type GamePhase = 'select' | 'combat' | 'casino';
type TurnPhase = 'player' | 'enemy';
type BurstVariant = 'bonk' | 'crit' | 'heal' | 'enemy' | 'block';

const TUTORIAL_KEY = `${BRAND.storagePrefix}-tutorial-dismissed`;

function DifficultyBadge({ difficulty, large }: { difficulty: Difficulty; large?: boolean }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${large ? 'text-base px-3 py-1' : 'text-sm px-2.5 py-0.5'}`}
      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

function TutorialPanel({ open, onToggle, onDismiss }: { open: boolean; onToggle: () => void; onDismiss: () => void }) {
  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="landing-action-btn art-btn py-3 text-[#f5e6c8]/80 hover:text-[#f5e6c8]"
      >
        Show How to Play
      </button>
    );
  }

  return (
    <div className="tutorial-frame mb-8 overflow-hidden">
      <div className="tutorial-frame-header flex items-center justify-between px-5 py-3">
        <h2 className="font-display text-2xl font-bold text-[#d4af37]">{BRAND.tutorialTitle}</h2>
        <div className="flex gap-2">
          <button onClick={onDismiss} className="text-base text-amber-200/60 hover:text-amber-200 underline">
            Don&apos;t show again
          </button>
          <button onClick={onToggle} className="text-amber-200/70 hover:text-amber-200 text-lg leading-none px-2">
            ✕
          </button>
        </div>
      </div>

      <div className="p-5 grid md:grid-cols-2 gap-5 text-lg">
        <section>
          <h3 className="text-amber-400 font-bold mb-2">🎯 Goal</h3>
          <p className="text-gray-300 leading-relaxed">
            Pick one Fam member and bonk your way through 12 waves of crypto degens — Fudders, Jeeters,
            Scammers, and more. Reduce their <strong className="text-red-400">Cope HP</strong> to zero before
            they bonk you out.
          </p>
          <p className="text-gray-400 text-base mt-2 leading-relaxed">
            Read <strong className="text-amber-300">{BRAND.chronicle}</strong> on the select screen for the full origin story, timeline, and bloodline lore.
          </p>
        </section>

        <section>
          <h3 className="text-amber-400 font-bold mb-2">🧑‍🤝‍🧑 Pick Your Fighter</h3>
          <p className="text-gray-300 leading-relaxed mb-3">
            Each character has unique moves and stats. Hover or tap a card to preview — then press <strong className="text-amber-300">Bonk as…</strong> or tap the same card again to start.
          </p>
          <div className="space-y-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <div key={d} className="flex items-center gap-2">
                <DifficultyBadge difficulty={d} />
                <span className="text-gray-400 text-base">{DIFFICULTY_META[d].description}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-amber-400 font-bold mb-2">📊 Stats</h3>
          <ul className="text-gray-300 space-y-2 text-base leading-relaxed">
            <li><strong className="text-red-400">PWR</strong> — More damage on every attack</li>
            <li><strong className="text-blue-400">DEF</strong> — Less damage from enemy counters</li>
            <li><strong className="text-purple-400">VIBE</strong> — Starting energy; some moves need or restore it</li>
            <li><strong className="text-green-400">SPD</strong> — Flavor stat (faster fighters feel snappier)</li>
            <li><strong className="text-emerald-400">HP</strong> — Your health. Hit 0 and you&apos;re bonked out</li>
          </ul>
        </section>

        <section>
          <h3 className="text-amber-400 font-bold mb-2">⚔️ Combat</h3>
          <ul className="text-gray-300 space-y-2 text-base leading-relaxed">
            <li>Use your <strong>3 unique moves</strong> each turn to damage the degen</li>
            <li><strong>Turn-based combat</strong> — you attack, then the degen attacks back</li>
            <li><strong>Diamond Hands / Shield Up</strong> block the enemy&apos;s next turn</li>
            <li>Healing moves restore HP — key for long runs</li>
            <li>Beat all 12 waves, then <strong>Run It Back</strong> — degens get tougher each run</li>
          </ul>
        </section>

        <section className="md:col-span-2 bg-amber-950/20 rounded-xl p-4 border border-amber-900/40">
          <h3 className="text-amber-400 font-bold mb-2">💡 New Player Tips</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-base text-gray-300">
            <div>
              <strong className="text-green-400">Start with Beng or Bonnie</strong>
              <p className="mt-1">Easy difficulty — Beng tanks, Bonnie heals. Both are forgiving picks.</p>
            </div>
            <div>
              <strong className="text-amber-400">Try Bonk or Bink next</strong>
              <p className="mt-1">Medium — Bonk hits hard, Bink blocks and reads the room.</p>
            </div>
            <div>
              <strong className="text-red-400">Bong is chaos mode</strong>
              <p className="mt-1">Hard — random damage, self-harm, lowest HP. Send it.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatBar({ label, value, max = 10, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-base text-amber-200/70 mb-1">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="art-bar-track">
        <div className="h-full rounded-none transition-all" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<GamePhase>('select');
  const [fighter, setFighter] = useState<PlayableCharacter | null>(null);
  const [playerHP, setPlayerHP] = useState(0);
  const [playerVibe, setPlayerVibe] = useState(0);
  const [blockNextHit, setBlockNextHit] = useState(false);
  const [wave, setWave] = useState(1);
  const [runNumber, setRunNumber] = useState(1);
  const [enemy, setEnemy] = useState<Enemy>(() => pickEnemyByWave(1));
  const [enemyHP, setEnemyHP] = useState(() => pickEnemyByWave(1).hp);
  const [log, setLog] = useState<string[]>([]);
  const [showVictory, setShowVictory] = useState(false);
  const [casinoEntering, setCasinoEntering] = useState(false);
  const [casinoSession, setCasinoSession] = useState<CasinoSession | null>(null);
  const [casinoSecureSession, setCasinoSecureSession] = useState<CasinoSecureSession | null>(null);
  const [waveModifier, setWaveModifier] = useState<WaveModifier>(() => pickWaveModifier(1, 1));
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showLore, setShowLore] = useState(false);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('player');
  const [isAnimating, setIsAnimating] = useState(false);
  const [fighterLunge, setFighterLunge] = useState(false);
  const [enemyLunge, setEnemyLunge] = useState(false);
  const [fighterWindUp, setFighterWindUp] = useState(false);
  const [enemyWindUp, setEnemyWindUp] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [fighterHit, setFighterHit] = useState(false);
  const [enemyKo, setEnemyKo] = useState(false);
  const [speedLines, setSpeedLines] = useState(false);
  const [combatImpact, setCombatImpact] = useState(false);
  const [impactTarget, setImpactTarget] = useState<'enemy' | 'player'>('enemy');
  const [impactKey, setImpactKey] = useState(0);
  const [blockFlash, setBlockFlash] = useState(false);
  const [healPulse, setHealPulse] = useState(false);
  const [abilityMotion, setAbilityMotion] = useState('motion-bonk');
  const [enemyMotion, setEnemyMotion] = useState('motion-degen');
  const [arenaShake, setArenaShake] = useState(false);
  const [arenaFlash, setArenaFlash] = useState(false);
  const [arenaFlashEnemy, setArenaFlashEnemy] = useState(false);
  const [attackBurst, setAttackBurst] = useState<{ show: boolean; text: string; variant: BurstVariant }>({
    show: false,
    text: 'BONK!',
    variant: 'bonk',
  });
  const {
    muted: combatMuted,
    playAttackWindup,
    playPlayerHit,
    playEnemyWindup,
    playEnemyHit,
    playEnemyCopeHeal,
    playBlock,
    playWaveClear,
    playRunComplete,
    playWaveEnter,
    playRunEscalation,
    playDefeat,
    toggleMute: toggleCombatMute,
  } = useCombatAudio();
  const [damagePopup, setDamagePopup] = useState<{
    show: boolean;
    value: number;
    crit: boolean;
    target: 'enemy' | 'player';
  }>({
    show: false,
    value: 0,
    crit: false,
    target: 'enemy',
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    try {
      let dismissed = localStorage.getItem(TUTORIAL_KEY);
      if (!dismissed) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEYS.tutorial);
        if (legacy) {
          localStorage.setItem(TUTORIAL_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEYS.tutorial);
          dismissed = legacy;
        }
      }
      if (dismissed === 'true') setShowTutorial(false);
    } catch {
      // Private browsing / storage blocked — keep tutorial visible.
    }
  }, []);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem(TUTORIAL_KEY, 'true');
  };

  const addLog = useCallback((message: string) => {
    setLog(prev => [...prev.slice(-16), message]);
  }, []);

  const casinoTriggeredRef = useRef(false);
  const casinoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerHPRef = useRef(playerHP);
  const phaseRef = useRef(phase);
  const waveRef = useRef(wave);

  useEffect(() => {
    playerHPRef.current = playerHP;
  }, [playerHP]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    waveRef.current = wave;
  }, [wave]);

  useEffect(() => () => {
    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);
  }, []);

  const persistCasinoPending = useCallback((payload: CasinoSecureSession) => {
    try {
      sessionStorage.setItem('bonk-casino-pending', JSON.stringify(payload));
    } catch {
      // Private mode / storage blocked — casino still plays locally.
    }
  }, []);

  const launchCasinoNow = useCallback((
    session: CasinoSession,
    fighterChar: PlayableCharacter,
    playTransitionSound: () => void,
    securePayload: CasinoSecureSession,
  ) => {
    if (casinoTriggeredRef.current) return;
    casinoTriggeredRef.current = true;

    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);

    setCasinoSession(session);
    setCasinoSecureSession(securePayload);
    persistCasinoPending(securePayload);
    setCasinoEntering(true);
    void playTransitionSound();

    if (session.outcome === 'victory') {
      addLog(`${fighterChar.name} cleared Degen Valley — victory spins await!`);
      addLog(`Bonga Chill rolls out the champion's bandit: ${session.spins} pulls at max payout.`);
    } else {
      addLog(`${fighterChar.name} falls in Degen Valley...`);
      addLog(BONGACHILL_LORE.quote);
      addLog(`Consolation spins: ${session.spins}. Win the full run for up to 10 victory pulls.`);
      addLog('Bonga Chill rigs the reels — no vault handshake required.');
    }

    const transitionMs = session.outcome === 'defeat'
      ? Math.min(session.tier.transitionMs, 700)
      : session.tier.transitionMs;

    casinoTimerRef.current = setTimeout(() => {
      setPhase('casino');
      setCasinoEntering(false);
      casinoTimerRef.current = null;
    }, transitionMs);
  }, [addLog, persistCasinoPending]);

  const goToDefeatCasino = useCallback((reachedWave: number, fighterChar: PlayableCharacter) => {
    if (casinoTriggeredRef.current) return;
    const session = buildCasinoSession('defeat', reachedWave, fighterChar.difficulty);
    launchCasinoNow(
      session,
      fighterChar,
      playDefeat,
      buildLocalSecureSession(session),
    );
  }, [launchCasinoNow, playDefeat]);

  useEffect(() => {
    if (phase !== 'combat' || !fighter || playerHP > 0) return;

    const primaryTimer = window.setTimeout(() => {
      if (playerHPRef.current > 0 || !fighter || phaseRef.current !== 'combat') return;
      if (casinoTriggeredRef.current) return;
      addLog('The Bonk Casino opens its doors...');
      goToDefeatCasino(waveRef.current, fighter);
    }, 400);

    const recoveryTimer = window.setTimeout(() => {
      if (playerHPRef.current > 0 || !fighter || phaseRef.current !== 'combat') return;
      if (casinoTriggeredRef.current) {
        casinoTriggeredRef.current = false;
        setCasinoEntering(false);
        if (casinoTimerRef.current) {
          clearTimeout(casinoTimerRef.current);
          casinoTimerRef.current = null;
        }
      }
      addLog('The Bonk Casino opens its doors...');
      goToDefeatCasino(waveRef.current, fighter);
    }, 1800);

    return () => {
      window.clearTimeout(primaryTimer);
      window.clearTimeout(recoveryTimer);
    };
  }, [phase, fighter, playerHP, goToDefeatCasino, addLog]);

  const claimVictorySpins = useCallback(() => {
    if (!fighter || casinoTriggeredRef.current) return;
    setShowVictory(false);
    const session = buildCasinoSession('victory', wave, fighter.difficulty);
    launchCasinoNow(
      session,
      fighter,
      playRunComplete,
      buildLocalSecureSession(session),
    );

    void fetchServerCasinoSession(session).then(serverSecure => {
      if (!serverSecure || phaseRef.current !== 'casino') return;
      setCasinoSecureSession(serverSecure);
      persistCasinoPending(serverSecure);
    });
  }, [fighter, wave, launchCasinoNow, playRunComplete, persistCasinoPending]);

  const spawnEnemy = useCallback((nextWave: number, run = runNumber) => {
    const next = pickEnemyByWave(nextWave, run);
    const modifier = pickWaveModifier(nextWave, run);
    setEnemy(next);
    setEnemyHP(next.hp);
    setWaveModifier(modifier);
    const runLabel = run > 1 ? ` (Run ${run})` : '';
    addLog(`--- WAVE ${nextWave}${runLabel}: ${next.name} appears! ---`);
    addLog(`${modifier.emoji} ${modifier.name} — ${modifier.description}`);
    if (modifier.vibeOnWaveStart > 0) {
      setPlayerVibe(v => Math.min(100, v + modifier.vibeOnWaveStart));
    }
    addLog(next.taunt);
    return next;
  }, [addLog, runNumber]);

  const startGame = (character: PlayableCharacter) => {
    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);
    casinoTriggeredRef.current = false;
    setCasinoEntering(false);
    setFighter(character);
    playerHPRef.current = character.hp;
    setPlayerHP(character.hp);
    setPlayerVibe(character.vibe * 10);
    setBlockNextHit(false);
    setWave(1);
    setRunNumber(1);
    setShowVictory(false);
    const first = pickEnemyByWave(1, 1);
    const openingModifier = pickWaveModifier(1, 1);
    setEnemy(first);
    setEnemyHP(first.hp);
    setWaveModifier(openingModifier);
    setTurnPhase('player');
    const lore = getCharacterLore(character.id);
    setLog([
      lore
        ? `${character.name} — ${lore.epithet} — descends into Degen Valley.`
        : `${character.name} enters Degen Valley!`,
      DEGEN_VALLEY_LORE.text,
      character.selectLine,
      `${first.name} blocks the path!`,
      `${openingModifier.emoji} ${openingModifier.name} — ${openingModifier.description}`,
      first.taunt,
      `--- ${character.name}'s turn! ---`,
    ]);
    if (openingModifier.vibeOnWaveStart > 0) {
      setPlayerVibe(v => Math.min(100, v + openingModifier.vibeOnWaveStart));
    }
    setPhase('combat');
    void playWaveEnter(1);
  };

  const resolveDamage = (ability: CharacterAbility, currentEnemyHP: number): { dmg: number; isCrit: boolean } => {
    if (!fighter) return { dmg: 0, isCrit: false };
    let dmg = ability.dmg;
    let isCrit = false;

    if (ability.id === 'chaos-bonk') {
      dmg = 25 + Math.floor(Math.random() * 66);
    }
    if (ability.id === 'read-the-room' && currentEnemyHP < enemy.hp * 0.5) {
      dmg = Math.round(dmg * 1.5);
      addLog('Bink reads the room — she strikes with bonus damage!');
    }
    if (ability.critChance && Math.random() < ability.critChance) {
      dmg *= 2;
      isCrit = true;
      addLog('CRITICAL BONK! Double damage!');
    }

    return {
      dmg: Math.round(dmg * (1 + fighter.power * 0.03) * waveModifier.playerDamageMult),
      isCrit,
    };
  };

  const applyPlayerAttack = (
    ability: CharacterAbility,
    dmg: number,
    currentPlayerHP: number,
  ): { newEnemyHP: number; newPlayerHP: number } => {
    if (!fighter) return { newEnemyHP: enemyHP, newPlayerHP: currentPlayerHP };

    addLog(ability.flavor);

    let newPlayerHP = currentPlayerHP;
    if (ability.healHp) newPlayerHP = Math.min(fighter.hp, newPlayerHP + ability.healHp);
    if (ability.healVibe) setPlayerVibe(v => Math.min(100, v + ability.healVibe!));
    if (ability.id === 'sonic-boom') setPlayerVibe(v => Math.max(0, v - 15));
    if (ability.id === 'send-it') {
      newPlayerHP = Math.max(0, newPlayerHP - 20);
      addLog(`${fighter.name} takes 20 recoil damage from sending it!`);
    }

    const newEnemyHP = Math.max(0, enemyHP - dmg);
    playerHPRef.current = newPlayerHP;
    setPlayerHP(newPlayerHP);
    setEnemyHP(newEnemyHP);
    addLog(`${ability.name} deals ${dmg} damage to ${enemy.name}!`);
    if (enemy.hitReaction.length > 0) {
      addLog(enemy.hitReaction[Math.floor(Math.random() * enemy.hitReaction.length)]);
    }

    return { newEnemyHP, newPlayerHP };
  };

  const clearPlayerAttackVfx = () => {
    setFighterLunge(false);
    setSpeedLines(false);
    setCombatImpact(false);
    setHealPulse(false);
    setAttackBurst({ show: false, text: 'BONK!', variant: 'bonk' });
    setEnemyHit(false);
    setArenaShake(false);
    setArenaFlash(false);
    setDamagePopup({ show: false, value: 0, crit: false, target: 'enemy' });
    setFighterWindUp(false);
    setAbilityMotion('motion-bonk');
    setBlockNextHit(false);
  };

  const handlePlayerDefeat = (
    reachedWave: number,
    fighterChar: PlayableCharacter,
    enemyDefeated: boolean,
  ) => {
    if (playerHPRef.current > 0 || casinoTriggeredRef.current) return;

    addLog(`${fighterChar.name} is bonked out! The casino beckons...`);
    clearPlayerAttackVfx();
    setIsAnimating(false);
    setTurnPhase('player');

    const runCleared = enemyDefeated && reachedWave >= DEGEN_ENEMIES.length;
    if (enemyDefeated) {
      addLog(enemy.defeatLine);
      if (runCleared) {
        addLog(`Double bonk! ${fighterChar.name} drops with the last degen — but the valley is CLEARED!`);
        void playRunComplete();
        setTimeout(() => setShowVictory(true), 400);
        return;
      }
      addLog(`Double bonk! ${fighterChar.name} and ${enemy.name} KO each other — consolation spins await.`);
    }

    goToDefeatCasino(reachedWave, fighterChar);
  };

  const playEnemyTurn = async (blockActive: boolean) => {
    if (!fighter) return;

    const special = resolveEnemyAbility(enemy, {
      playerHP,
      playerMaxHP: fighter.hp,
      enemyHP,
      enemyMaxHP: enemy.hp,
      blockActive,
    });

    setTurnPhase('enemy');
    addLog(`--- ${enemy.name}'s turn! ---`);

    if (blockActive && !special.ignoreBlock) {
      setIsAnimating(true);
      setEnemyMotion(getEnemyMotionClass(enemy.id));
      setEnemyWindUp(true);
      await wait(220);
      setEnemyWindUp(false);
      setEnemyLunge(true);
      await wait(180);
      setEnemyLunge(false);
      setBlockFlash(true);
      setAttackBurst({ show: true, text: 'BLOCKED!', variant: 'block' });
      addLog(`${fighter.name} blocked ${enemy.name}'s ${special.name}! Diamond hands!`);
      void playBlock();
      await wait(550);
      setBlockFlash(false);
      setAttackBurst({ show: false, text: 'BONK!', variant: 'bonk' });
      setIsAnimating(false);
      setTurnPhase('player');
      addLog(`--- ${fighter.name}'s turn! ---`);
      return;
    }

    if (special.flavor) {
      addLog(`⚠️ ${enemy.name} — ${special.name}: ${special.flavor}`);
    }

    await wait(500);

    setIsAnimating(true);
    setEnemyMotion(getEnemyMotionClass(enemy.id));
    await wait(80);
    setEnemyWindUp(true);
    await wait(200);
    setEnemyWindUp(false);
    setSpeedLines(true);
    setEnemyLunge(true);
    void playEnemyWindup(enemy.id);

    await wait(300);

    if (special.enemyHealPercent > 0) {
      const healAmt = Math.round(enemy.hp * special.enemyHealPercent);
      setEnemyHP(h => Math.min(enemy.hp, h + healAmt));
      addLog(`${enemy.name} recovers ${healAmt} Cope HP!`);
      void playEnemyCopeHeal(enemy.id);
    }

    const counterDmg = Math.max(
      1,
      Math.round(
        calcCounterDamage(enemy.counterDmg, fighter.defense)
          * waveModifier.enemyCounterMult
          * special.counterMult
          + special.flatBonusDamage,
      ),
    );
    void playEnemyHit(counterDmg, enemy.id, {
      heavy: special.counterMult >= 1.3 || counterDmg >= 24 || special.ignoreBlock,
    });
    const shout = getEnemyAttackShout(enemy);

    setCombatImpact(true);
    setImpactTarget('player');
    setImpactKey(k => k + 1);
    setAttackBurst({ show: true, text: shout, variant: 'enemy' });
    setFighterHit(true);
    setArenaShake(true);
    setArenaFlashEnemy(true);
    setDamagePopup({ show: true, value: counterDmg, crit: false, target: 'player' });

    addLog(`${enemy.name} attacks!`);
    addLog(`${enemy.counterAttack} (-${counterDmg} HP)`);

    const nextPlayerHP = Math.max(0, playerHPRef.current - counterDmg);
    const playerDied = nextPlayerHP <= 0;
    playerHPRef.current = nextPlayerHP;
    setPlayerHP(nextPlayerHP);
    setPlayerVibe(v => Math.max(0, v - special.vibeDrain - Math.round(counterDmg * 0.8)));

    await wait(550);

    setEnemyLunge(false);
    setSpeedLines(false);
    setCombatImpact(false);
    setAttackBurst({ show: false, text: 'BONK!', variant: 'bonk' });
    setFighterHit(false);
    setArenaShake(false);
    setArenaFlashEnemy(false);
    setDamagePopup({ show: false, value: 0, crit: false, target: 'enemy' });

    await wait(200);
    setIsAnimating(false);

    if (playerDied) {
      handlePlayerDefeat(wave, fighter, false);
      return;
    }

    setTurnPhase('player');
    addLog(`--- ${fighter.name}'s turn! ---`);
  };

  const useAbility = async (ability: CharacterAbility) => {
    if (!fighter || enemyHP <= 0 || playerHPRef.current <= 0 || isAnimating || turnPhase !== 'player') return;

    if (ability.id === 'sonic-boom' && playerVibe < 15) {
      addLog('Not enough vibe for Sonic Boom! Need 15+ vibe.');
      return;
    }

    if (waveModifier.playerRegenPerTurn > 0) {
      const beforeRegen = playerHPRef.current;
      const healed = Math.min(fighter.hp, beforeRegen + waveModifier.playerRegenPerTurn);
      playerHPRef.current = healed;
      setPlayerHP(healed);
      if (healed > beforeRegen) {
        addLog(`${waveModifier.emoji} ${waveModifier.name} restores ${healed - beforeRegen} HP.`);
      }
    }

    if (ability.blockNextHit) setBlockNextHit(true);

    const blockEnemyAttack = blockNextHit || Boolean(ability.blockNextHit);
    if (blockNextHit) setBlockNextHit(false);

    setIsAnimating(true);
    setTurnPhase('player');

    try {
      setAbilityMotion(getAbilityMotionClass(ability.id));
      await wait(60);
      setFighterWindUp(true);
      await wait(160);
      setFighterWindUp(false);
      setSpeedLines(true);
      setFighterLunge(true);
      void playAttackWindup(ability.id);

      await wait(280);

      const { dmg, isCrit } = resolveDamage(ability, enemyHP);
      void playPlayerHit(ability.id, isCrit, dmg);
      const isHealMove = Boolean(ability.healHp && ability.healHp >= 25 && dmg <= 40);
      const burstVariant: BurstVariant = isHealMove ? 'heal' : isCrit ? 'crit' : 'bonk';

      setCombatImpact(true);
      setImpactTarget('enemy');
      setImpactKey(k => k + 1);
      setHealPulse(isHealMove);
      setAttackBurst({
        show: true,
        text: burstVariant === 'heal' ? 'BONK! ♥' : isCrit ? 'CRITICAL!' : 'BONK!',
        variant: burstVariant,
      });
      setEnemyHit(true);
      setArenaShake(true);
      setArenaFlash(true);
      if (dmg > 0) setDamagePopup({ show: true, value: dmg, crit: isCrit, target: 'enemy' });

      const { newEnemyHP, newPlayerHP } = applyPlayerAttack(ability, dmg, playerHPRef.current);
      const enemyDefeated = newEnemyHP <= 0;
      const playerDefeated = newPlayerHP <= 0;
      const runCleared = enemyDefeated && wave >= DEGEN_ENEMIES.length;

      if (playerDefeated) {
        handlePlayerDefeat(wave, fighter, enemyDefeated);
        return;
      }

      await wait(isCrit ? 620 : 500);

      clearPlayerAttackVfx();

      if (enemyDefeated && !playerDefeated) {
        setEnemyKo(true);
        await wait(750);
        setEnemyKo(false);
      }

      await wait(200);

      if (enemyDefeated) {
        addLog(enemy.defeatLine);
        if (runCleared) {
          void playRunComplete();
        } else {
          void playWaveClear();
        }
        setTimeout(() => setShowVictory(true), 400);
        return;
      }

      await playEnemyTurn(blockEnemyAttack);
    } catch (err) {
      console.error('Combat ability error:', err);
      if (playerHPRef.current <= 0 && fighter) {
        handlePlayerDefeat(wave, fighter, enemyHP <= 0);
      }
    } finally {
      if (playerHPRef.current > 0) {
        setIsAnimating(false);
      }
    }
  };

  const nextWave = () => {
    const next = wave + 1;
    setWave(next);
    setPlayerVibe(v => Math.min(100, v + 15));
    setShowVictory(false);
    setTurnPhase('player');
    setBlockNextHit(false);
    spawnEnemy(next);
    void playWaveEnter(next);
    if (fighter) addLog(`--- ${fighter.name}'s turn! ---`);
  };

  const backToSelect = () => {
    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);
    casinoTriggeredRef.current = false;
    setCasinoSession(null);
    setCasinoSecureSession(null);
    setPhase('select');
    setFighter(null);
    setShowVictory(false);
    setCasinoEntering(false);
    setWave(1);
    setRunNumber(1);
    setLog([]);
  };

  const resetRun = () => {
    if (!fighter) return;
    const nextRun = runNumber + 1;
    const scale = getRunScalingInfo(nextRun);

    setRunNumber(nextRun);
    setWave(1);
    playerHPRef.current = fighter.hp;
    setPlayerHP(fighter.hp);
    setPlayerVibe(fighter.vibe * 10);
    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);
    casinoTriggeredRef.current = false;
    setBlockNextHit(false);
    setTurnPhase('player');
    setShowVictory(false);

    setLog([
      `${fighter.name} runs it back — RUN ${nextRun}!`,
      scale
        ? `Degen Valley escalates: +${scale.hpBonusPercent}% Cope HP, +${scale.counterBonusPercent}% counter damage.`
        : 'Degen Valley never sleeps...',
      `--- ${fighter.name}'s turn! ---`,
    ]);
    spawnEnemy(1, nextRun);
    void playRunEscalation(nextRun);
  };

  const afterVictoryCasinoExit = () => {
    casinoTriggeredRef.current = false;
    setCasinoSession(null);
    backToSelect();
  };

  const afterVictoryCasinoRunItBack = () => {
    if (!fighter) return;
    if (casinoTimerRef.current) clearTimeout(casinoTimerRef.current);
    casinoTriggeredRef.current = false;
    setCasinoSession(null);
    setPhase('combat');
    resetRun();
  };

  const preview = previewId
    ? PLAYABLE_CHARACTERS.find(c => c.id === previewId) ?? null
    : null;

  const handleGalleryMouseLeave = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setPreviewId(null);
    }
  };

  const handleCharacterCardClick = (char: PlayableCharacter) => {
    if (previewId === char.id) {
      startGame(char);
    } else {
      setPreviewId(char.id);
    }
  };

  if (phase === 'select') {
    return (
      <div className="game-scene game-scene-landing">
        <LandingScene />
        <div className="game-scene-vignette landing-vignette" />
        <div className="renaissance-hall">
          <div className="renaissance-hall-content max-w-7xl mx-auto px-4 py-6 md:py-10">
            <LandingHero />

            <div className="landing-actions">
              <FamLorePanel
                open={showLore}
                onToggle={() => setShowLore(v => !v)}
                highlightId={previewId}
              />
              <TutorialPanel
                open={showTutorial}
                onToggle={() => setShowTutorial(v => !v)}
                onDismiss={dismissTutorial}
              />
            </div>

            <section className="hall-of-champions">
              <div className="hall-of-champions-arch" aria-hidden>
                <span className="hall-arch-keystone">VI</span>
              </div>
              <div className="hall-of-champions-header">
                <h2 className="hall-of-champions-title">Hall of Champions</h2>
                <p className="hall-of-champions-subtitle">Choose thy bloodline — six houses of the Bonk</p>
              </div>

              <div
                className="character-gallery hall-of-champions-body"
                onMouseLeave={handleGalleryMouseLeave}
              >
                <div className="character-gallery-layout">
                  <div className="character-gallery-cards">
                    <div className="champion-hall-grid">
                      {PLAYABLE_CHARACTERS.map(char => (
                        <button
                          key={char.id}
                          type="button"
                          onClick={() => handleCharacterCardClick(char)}
                          onMouseEnter={() => setPreviewId(char.id)}
                          onFocus={() => setPreviewId(char.id)}
                          className={`champion-plaque${previewId === char.id ? ' champion-plaque-active' : ''}`}
                        >
                          <span className="champion-plaque-nail champion-plaque-nail-tl" aria-hidden />
                          <span className="champion-plaque-nail champion-plaque-nail-tr" aria-hidden />
                          <span className="champion-plaque-nail champion-plaque-nail-bl" aria-hidden />
                          <span className="champion-plaque-nail champion-plaque-nail-br" aria-hidden />
                          <div className="champion-plaque-portrait-wrap">
                            <div className="champion-plaque-portrait">
                              <Image
                                src={char.img}
                                alt={char.name}
                                width={180}
                                height={240}
                                className="character-img champion-plaque-img object-contain"
                                unoptimized
                              />
                            </div>
                            <div className="champion-plaque-difficulty">
                              <DifficultyBadge difficulty={char.difficulty} />
                            </div>
                          </div>
                          <div className="champion-plaque-ribbon">
                            <h3 className="champion-plaque-name">{char.name}</h3>
                          </div>
                          <p className="champion-plaque-epithet">{char.role}</p>
                          <p className="champion-plaque-tagline">{char.tagline}</p>
                          <div className="champion-plaque-heraldry">
                            <div className="herald-shield herald-shield-pwr"><span>PWR</span><strong>{char.power}</strong></div>
                            <div className="herald-shield herald-shield-def"><span>DEF</span><strong>{char.defense}</strong></div>
                            <div className="herald-shield herald-shield-vibe"><span>VIBE</span><strong>{char.vibe}</strong></div>
                            <div className="herald-shield herald-shield-spd"><span>SPD</span><strong>{char.speed}</strong></div>
                          </div>
                          <div className="champion-plaque-footer">
                            <span className="champion-plaque-hp">♥ {char.hp} HP</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <aside
                    className={`illuminated-scroll character-preview-panel${preview ? '' : ' character-preview-panel-dormant'}`}
                    aria-live="polite"
                  >
                    <div className="illuminated-scroll-rod illuminated-scroll-rod-top" aria-hidden />
                    {preview ? (
                      <div key={preview.id} className="character-preview-content illuminated-scroll-body">
                        <div className="illuminated-scroll-portrait">
                          <Image
                            src={preview.img}
                            alt={preview.name}
                            width={120}
                            height={160}
                            className="character-img object-contain"
                            unoptimized
                          />
                        </div>
                        <p className="character-preview-label scroll-ink-label">Royal Decree — Champion Dossier</p>
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <h3 className="scroll-ink-title font-display text-2xl lg:text-3xl">{preview.name}</h3>
                          <DifficultyBadge difficulty={preview.difficulty} large />
                        </div>
                        <p className="scroll-ink-role text-lg italic mb-1">{preview.role}</p>
                        <p className="scroll-ink-quote italic mb-4 border-l-2 border-[#8b6914]/40 pl-3">{preview.selectLine}</p>
                        <div className="character-preview-abilities">
                          {preview.abilities.map(ab => (
                            <div key={ab.id} className="scroll-ability-entry">
                              <div className="scroll-ink-ability font-display font-bold">{ab.name}</div>
                              <div className="scroll-ink-muted text-base mt-1">{ab.description}</div>
                            </div>
                          ))}
                        </div>
                        <CharacterLoreSnippet characterId={preview.id} />
                        <button
                          type="button"
                          onClick={() => startGame(preview)}
                          className="art-btn heraldic-cta character-preview-play w-full mt-5 py-3 text-[#f0d878] font-display font-bold text-lg"
                        >
                          ⚔ Bonk as {preview.name}
                        </button>
                      </div>
                    ) : (
                      <div className="illuminated-scroll-body illuminated-scroll-empty">
                        <span className="illuminated-scroll-seal" aria-hidden>⚜</span>
                        <p className="character-preview-empty">
                          Select a portrait from the hall to unroll thy champion&apos;s dossier.
                        </p>
                      </div>
                    )}
                    <div className="illuminated-scroll-rod illuminated-scroll-rod-bottom" aria-hidden />
                  </aside>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'casino' && fighter && casinoSession) {
    const activeSecureSession = casinoSecureSession ?? buildLocalSecureSession(casinoSession);
    return (
      <CasinoSlot
        session={casinoSession}
        secureSession={activeSecureSession}
        fighter={fighter}
        onExit={casinoSession.outcome === 'victory' ? afterVictoryCasinoExit : backToSelect}
        onRunItBack={casinoSession.outcome === 'victory' ? afterVictoryCasinoRunItBack : undefined}
      />
    );
  }

  if (!fighter) return null;

  const maxHP = fighter.hp;
  const maxEnemyHP = enemy.hp;
  const fighterLore = getCharacterLore(fighter.id);
  const fighterIdle =
    !isAnimating && !fighterLunge && !fighterHit && !fighterWindUp && turnPhase === 'player';
  const enemyIdle =
    !isAnimating && !enemyLunge && !enemyHit && !enemyWindUp && !enemyKo && turnPhase === 'enemy';

  return (
    <div className="game-scene">
      <div className="game-scene-vignette" />
      <div className="game-scene-content max-w-[1300px] mx-auto my-6 px-3">
      <div className="art-frame overflow-hidden">
        <span className="art-frame-corners-tr" aria-hidden />
        <span className="art-frame-corners-bl" aria-hidden />
        <div className="art-header">
          <h1 className="art-title">{BRAND.name}</h1>
          <p className="art-subtitle">The Degen Gallery — Wave {wave}</p>
        </div>
        <div className="art-meta-bar">
          <span>
            Wave {wave} / {DEGEN_ENEMIES.length}
            {runNumber > 1 && (
              <span className="ml-2 text-[#c97070]/80">
                · Run {runNumber}
                {(() => {
                  const scale = getRunScalingInfo(runNumber);
                  return scale ? ` (+${scale.hpBonusPercent}% HP)` : '';
                })()}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            Fighting as <strong className="text-amber-300">{fighter.name}</strong>
            <DifficultyBadge difficulty={fighter.difficulty} />
          </span>
          <button onClick={backToSelect} className="text-base underline text-[#d4af37]/60 hover:text-[#d4af37]">
            Switch Fighter
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="text-base underline text-[#d4af37]/60 hover:text-[#d4af37]"
          >
            Tutorial
          </button>
          <button
            onClick={() => setShowLore(true)}
            className="text-base underline text-[#d4af37]/60 hover:text-[#d4af37]"
          >
            Chronicle
          </button>
          <button
            onClick={() => toggleCombatMute()}
            className="text-base underline text-[#d4af37]/60 hover:text-[#d4af37]"
          >
            {combatMuted ? 'Sound Off' : 'Sound On'}
          </button>
        </div>

        <div className={`turn-banner ${turnPhase === 'player' ? 'player-turn' : 'enemy-turn'}`}>
          {turnPhase === 'player' ? `⚔️ ${fighter.name}'s Turn — Choose an Attack!` : `💀 ${enemy.name}'s Turn — Brace Yourself!`}
        </div>

        <div className="wave-modifier-banner">
          <span className="wave-modifier-emoji">{waveModifier.emoji}</span>
          <span className="wave-modifier-name">{waveModifier.name}</span>
          <span className="wave-modifier-desc">{waveModifier.description}</span>
        </div>

        <div className="combat-row flex gap-5 p-5 md:p-6 flex-wrap lg:flex-nowrap">
          <div className="combat-col w-full lg:w-[280px] shrink-0">
            <div className="art-panel combat-panel">
              <div className="combat-panel-header">
                <div className="art-portrait mx-auto mb-4 w-fit">
                  <div className="art-portrait-inner">
                    <Image
                      src={fighter.img}
                      alt={fighter.name}
                      width={160}
                      height={215}
                      className="character-img w-[150px] h-[200px] object-contain"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
              <h2 className="art-panel-title">{fighter.name}</h2>
              <div className="text-[#d4af37]/70 text-lg italic mb-1">{fighter.role}</div>
              {fighterLore && (
                <p className="text-sm uppercase tracking-[0.15em] text-[#d4af37]/45 mb-2">{fighterLore.epithet}</p>
              )}
              <DifficultyBadge difficulty={fighter.difficulty} />
              {fighterLore && (
                <blockquote className="mt-3 text-sm italic text-[#f5e6c8]/50 border-l-2 border-[#d4af37]/25 pl-3">
                  {fighterLore.quote}
                </blockquote>
              )}
              </div>

              <div className="combat-panel-body mt-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-lg text-green-300 mb-1">HP: {playerHP}/{maxHP}</div>
                    <div className="art-bar-track">
                      <div className="h-full bg-gradient-to-r from-emerald-800 to-emerald-500 transition-all duration-300" style={{ width: `${(playerHP / maxHP) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg text-purple-300 mb-1">Vibe: {playerVibe}/100</div>
                    <div className="art-bar-track">
                      <div className="h-full bg-gradient-to-r from-purple-900 to-purple-500 transition-all duration-300" style={{ width: `${playerVibe}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#d4af37]/15">
                  <StatBar label="Power" value={fighter.power} color="#ef4444" />
                  <StatBar label="Defense" value={fighter.defense} color="#3b82f6" />
                  <StatBar label="Vibe" value={fighter.vibe} color="#a855f7" />
                  <StatBar label="Speed" value={fighter.speed} color="#22c55e" />
                </div>

                {blockNextHit && (
                  <div className="text-center text-base text-blue-300 bg-blue-950/40 rounded-lg py-2 animate-pulse">
                    🛡️ Shield active!
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="combat-col combat-col-center flex-1 min-w-0 w-full">
            <div className="enemy-placard">
              <div className="text-[#c97070] text-base uppercase tracking-[0.2em]">{enemy.title}</div>
              <h1 className="text-[#e8a0a0] text-3xl md:text-4xl font-bold mt-1">{enemy.name}</h1>
              <p className="text-[#f5e6c8]/55 italic text-lg mt-1 px-2">{enemy.taunt}</p>
              <div className="mt-2 max-w-sm mx-auto">
                <div className="art-bar-track h-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#8b2942] to-[#c97070] transition-all duration-300"
                    style={{ width: `${(enemyHP / maxEnemyHP) * 100}%` }}
                  />
                </div>
                <div className="text-lg mt-1 text-[#c97070]/90 font-display tracking-wide">Cope HP: {enemyHP}/{maxEnemyHP}</div>
              </div>
            </div>

            <div
              className={`combat-arena ${turnPhase === 'player' ? 'arena-turn-player' : 'arena-turn-enemy'} ${arenaShake ? 'arena-shake' : ''} ${arenaFlash ? 'arena-active' : ''} ${arenaFlashEnemy ? 'arena-active-enemy' : ''}`}
            >
              <div className="arena-glow" />
              <div className="fighter-spotlight" />
              <div className="enemy-spotlight" />
              <div className="arena-curtain-left" />
              <div className="arena-curtain-right" />
              <div className="arena-floor" />
              <div className="arena-vs">VS</div>

              <CombatArenaVfx
                speedLines={speedLines}
                impact={combatImpact}
                impactTarget={impactTarget}
                impactKey={impactKey}
                blockFlash={blockFlash}
                healPulse={healPulse}
              />

              <div
                className={`fighter-sprite ${fighterIdle ? 'idle' : ''} ${fighterWindUp ? 'wind-up' : ''} ${fighterLunge ? `lunge ${abilityMotion}` : ''} ${fighterHit ? 'hit' : ''}`}
              >
                <div className="art-portrait">
                  <div className="art-portrait-inner">
                    <Image
                      src={fighter.img}
                      alt={fighter.name}
                      width={340}
                      height={460}
                      className="character-img fighter-img object-contain"
                      priority
                      unoptimized
                    />
                  </div>
                </div>
                <div className="fighter-label text-center font-display font-bold text-[#f0d878] mt-2 tracking-wider text-xl md:text-2xl">{fighter.name}</div>
              </div>

              <div
                className={`enemy-sprite ${enemyIdle ? 'idle' : ''} ${enemyWindUp ? 'wind-up' : ''} ${enemyLunge ? `lunge ${enemyMotion}` : ''} ${enemyHit ? 'hit' : ''} ${enemyKo ? 'ko' : ''}`}
              >
                <div className="art-portrait">
                  <div className="art-portrait-inner">
                    <Image
                      src={enemy.img}
                      alt={enemy.name}
                      width={165}
                      height={220}
                      className="character-img enemy-img object-contain"
                    />
                  </div>
                </div>
                <div className="text-center text-base font-display font-bold text-[#e8a0a0] mt-2 tracking-wider">{enemy.name}</div>
              </div>

              {attackBurst.show && (
                <div className="bonk-burst">
                  <div className="bonk-burst-inner relative">
                    <span
                      className={`bonk-text ${attackBurst.variant === 'crit' ? 'crit' : ''} ${attackBurst.variant === 'heal' ? 'heal' : ''} ${attackBurst.variant === 'enemy' ? 'enemy' : ''} ${attackBurst.variant === 'block' ? 'block' : ''}`}
                    >
                      {attackBurst.text}
                    </span>
                    <span className="bonk-star" style={{ top: '-30px', left: '-40px', animationDelay: '0s' }}>
                      {attackBurst.variant === 'enemy' ? '💀' : '💥'}
                    </span>
                    <span className="bonk-star" style={{ top: '-20px', right: '-45px', animationDelay: '0.1s' }}>
                      {attackBurst.variant === 'enemy' ? '📉' : '⭐'}
                    </span>
                    <span className="bonk-star" style={{ bottom: '-25px', left: '-30px', animationDelay: '0.05s' }}>✨</span>
                  </div>
                </div>
              )}

              {damagePopup.show && (
                <div
                  className={`damage-popup ${damagePopup.crit ? 'crit' : ''} ${damagePopup.target === 'player' ? 'player-hit' : ''}`}
                  key={`${damagePopup.target}-${damagePopup.value}`}
                >
                  -{damagePopup.value}
                </div>
              )}
            </div>
          </div>

          <div className="combat-col w-full lg:w-[260px] shrink-0">
            <div className="art-panel combat-panel">
              <h2 className="art-panel-title combat-panel-header">{fighter.name}&apos;s Moves</h2>
              <div className="combat-moves-list">
                {fighter.abilities.map(ability => (
                  <button
                    key={ability.id}
                    onClick={() => void useAbility(ability)}
                    disabled={enemyHP <= 0 || playerHP <= 0 || isAnimating || turnPhase !== 'player'}
                    className={`action-btn art-btn combat-move-btn w-full text-left px-4 text-[#f5e6c8] disabled:opacity-40 disabled:cursor-not-allowed ${isAnimating ? 'animating' : ''}`}
                  >
                    <div className="font-display font-bold text-xl text-[#f0d878]">{ability.name}</div>
                    <div className="combat-move-desc text-base text-[#f5e6c8]/50 mt-1">{ability.description}</div>
                  </button>
                ))}
              </div>
              {playerHP <= 0 && phase === 'combat' && (
                <div className="text-center text-base text-[#d4af37]/80 py-3 shrink-0 animate-pulse">
                  {casinoEntering ? 'Entering the Bonk Casino...' : 'Bonked out — summoning the slot machine...'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="art-log p-5 h-56 overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className="art-log-entry">{entry}</div>
          ))}
        </div>
      </div>
      </div>

      {showTutorial && (
        <div className="fixed inset-0 bg-black/85 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="max-w-3xl w-full my-8">
            <TutorialPanel
              open={true}
              onToggle={() => setShowTutorial(false)}
              onDismiss={() => { dismissTutorial(); setShowTutorial(false); }}
            />
          </div>
        </div>
      )}

      {showLore && (
        <div className="fixed inset-0 bg-black/85 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <FamLorePanel
              open={true}
              onToggle={() => setShowLore(false)}
              highlightId={fighter.id}
            />
          </div>
        </div>
      )}

      {casinoEntering && <div className="casino-transition" aria-hidden />}

      {showVictory && wave >= DEGEN_ENEMIES.length && (
        <VictoryRewardModal
          fighter={fighter}
          runNumber={runNumber}
          defeatLine={enemy.defeatLine}
          onClaimSpins={claimVictorySpins}
          onRunItBack={() => {
            setShowVictory(false);
            resetRun();
          }}
        />
      )}

      {showVictory && wave < DEGEN_ENEMIES.length && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="victory-modal text-center max-w-lg relative">
            <span className="art-frame-corners-tr" aria-hidden />
            <span className="art-frame-corners-bl" aria-hidden />
            <h2 className="font-display text-5xl md:text-6xl font-bold text-[#f0d878] mb-4">WAGMI!</h2>
            <p className="text-2xl mb-2 text-[#f5e6c8]/85">{enemy.defeatLine}</p>
            <p className="text-[#f5e6c8]/55 mb-8 italic">Another degen lurks around the corner...</p>
            <button
              onClick={nextWave}
              className="art-btn text-[#f0d878] font-display font-bold text-2xl py-5 px-10"
            >
              Next Degen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}