'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTY_META,
  PLAYABLE_CHARACTERS,
  calcCounterDamage,
  type CharacterAbility,
  type PlayableCharacter,
} from '@/lib/characters';
import { resolveEnemyAbility } from '@/lib/enemy-abilities';
import { getEnemyAttackShout, type Enemy } from '@/lib/enemies';
import { BRAND } from '@/lib/brand';
import { DEPTHS_LORE } from '@/lib/rival-enemies';

const DEPTHS_COACH_KEY = `${BRAND.storagePrefix}-depths-coach-v1`;

function isDepthsCoachDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(DEPTHS_COACH_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissDepthsCoach(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEPTHS_COACH_KEY, '1');
  } catch {
    /* */
  }
}
import {
  buildDepthsFloor,
  depthsDegenClearReward,
  type DepthsRoom,
  type DepthsRoomKind,
} from '@/lib/depths/rooms';
import {
  DEPTHS_CRIT_MULT,
  depthsAbilityCooldownTurns,
  isAbilityOnCooldown,
  scaleDepthsCounter,
  scaleDepthsEnemy,
  scaleDepthsPlayerDamage,
  tickCooldowns,
} from '@/lib/depths/combat';
import {
  buildDepthsClearBanditSession,
  buildDepthsDefeatBanditSession,
  buildDepthsRoomBanditSession,
} from '@/lib/depths/bandit';
import {
  depthsRestChoices,
  type DepthsRestChoiceId,
} from '@/lib/depths/events';
import {
  abilityRole,
  abilityRoleLabel,
  roomKindMeta,
  roomThreatLine,
} from '@/lib/depths/presentation';
import { getAbilityMotionClass, getEnemyMotionClass } from '@/lib/combat-vfx';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBonkBank } from '@/hooks/useBonkBank';
import { useCombatAudio } from '@/hooks/useCombatAudio';
import { earnSpendableChips } from '@/lib/chips-client';
import { claimMusicBed, isMusicMuted } from '@/lib/global-audio';
import { DEPTHS_AMBIENCE_CREDIT, getDepthsAudioEngine } from '@/lib/depths-audio';
import CombatArenaVfx from '@/components/CombatArenaVfx';
import CasinoSlot from '@/components/CasinoSlot';
import {
  buildLocalSecureSession,
  fetchServerCasinoSession,
  type CasinoSecureSession,
} from '@/lib/casino-client';
import type { CasinoSession } from '@/lib/slot-machine';

type Phase =
  | 'hub'
  | 'map'
  | 'fight'
  | 'event'
  | 'rest'
  | 'bandit'
  | 'victory'
  | 'defeat';

type BurstVariant = 'bonk' | 'crit' | 'heal' | 'enemy' | 'block';
type BanditKind = 'room' | 'clear' | 'defeat';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export default function DepthsGame() {
  const { publicKey, connected } = useWallet();
  const { chips, addChips } = useBonkBank();
  const {
    playAttackWindup,
    playPlayerHit,
    playEnemyWindup,
    playEnemyHit,
    playEnemyCopeHeal,
    playBlock,
    playWaveClear,
    playRunComplete,
    playWaveEnter,
    playDefeat,
  } = useCombatAudio();

  const [phase, setPhase] = useState<Phase>('hub');
  const [fighter, setFighter] = useState<PlayableCharacter | null>(null);
  const [playerHP, setPlayerHP] = useState(0);
  const [playerVibe, setPlayerVibe] = useState(0);
  const [blockNext, setBlockNext] = useState(false);
  const [rooms, setRooms] = useState<DepthsRoom[]>([]);
  const [roomIndex, setRoomIndex] = useState(0);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [enemyHP, setEnemyHP] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [runChips, setRunChips] = useState(0);
  const [chambersCleared, setChambersCleared] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [floor] = useState(1);
  const attackLockRef = useRef(false);

  const [casinoSession, setCasinoSession] = useState<CasinoSession | null>(null);
  const [casinoSecure, setCasinoSecure] = useState<CasinoSecureSession | null>(null);
  const [banditKind, setBanditKind] = useState<BanditKind>('room');
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  /** Full-screen chamber enter / clear flash */
  const [chamberFx, setChamberFx] = useState<{
    key: number;
    mode: 'enter' | 'clear';
    label: string;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [turnBanner, setTurnBanner] = useState<'you' | 'enemy' | null>(null);

  useEffect(() => {
    setShowCoach(!isDepthsCoachDismissed());
  }, []);

  useEffect(() => {
    return () => {
      try {
        getDepthsAudioEngine().stopAmbience();
      } catch {
        /* */
      }
    };
  }, []);

  const ensureDepthsMusic = useCallback(async () => {
    if (isMusicMuted()) return;
    claimMusicBed('depths');
    const eng = getDepthsAudioEngine();
    await eng.ensureContext();
    if (!eng.isMusicRunning) {
      await eng.startAmbience();
    }
  }, []);

  const fireChamberFx = useCallback((mode: 'enter' | 'clear', label: string) => {
    setChamberFx({ key: Date.now(), mode, label });
    window.setTimeout(() => setChamberFx(null), mode === 'clear' ? 1100 : 900);
  }, []);

  // Combat presentation
  const [abilityMotion, setAbilityMotion] = useState('motion-bonk');
  const [enemyMotion, setEnemyMotion] = useState('motion-degen');
  const [fighterIdle, setFighterIdle] = useState(true);
  const [enemyIdle, setEnemyIdle] = useState(true);
  const [fighterWindUp, setFighterWindUp] = useState(false);
  const [fighterLunge, setFighterLunge] = useState(false);
  const [fighterHit, setFighterHit] = useState(false);
  const [enemyWindUp, setEnemyWindUp] = useState(false);
  const [enemyLunge, setEnemyLunge] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [enemyKo, setEnemyKo] = useState(false);
  const [speedLines, setSpeedLines] = useState(false);
  const [combatImpact, setCombatImpact] = useState(false);
  const [impactTarget, setImpactTarget] = useState<'enemy' | 'player'>('enemy');
  const [impactKey, setImpactKey] = useState(0);
  const [blockFlash, setBlockFlash] = useState(false);
  const [healPulse, setHealPulse] = useState(false);
  const [arenaShake, setArenaShake] = useState(false);
  const [arenaFlash, setArenaFlash] = useState(false);
  const [arenaFlashEnemy, setArenaFlashEnemy] = useState(false);
  const [attackBurst, setAttackBurst] = useState<{
    show: boolean;
    text: string;
    variant: BurstVariant;
  }>({ show: false, text: 'BONK!', variant: 'bonk' });
  const [damagePopup, setDamagePopup] = useState<{
    show: boolean;
    value: number;
    crit: boolean;
    target: 'enemy' | 'player';
  }>({ show: false, value: 0, crit: false, target: 'enemy' });

  const pushLog = useCallback((line: string) => {
    setLog(prev => [...prev.slice(-40), line]);
  }, []);

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
    setFighterIdle(true);
    setEnemyIdle(true);
  };

  const clearEnemyAttackVfx = () => {
    setEnemyLunge(false);
    setSpeedLines(false);
    setCombatImpact(false);
    setBlockFlash(false);
    setAttackBurst({ show: false, text: 'BONK!', variant: 'bonk' });
    setFighterHit(false);
    setArenaShake(false);
    setArenaFlashEnemy(false);
    setDamagePopup({ show: false, value: 0, crit: false, target: 'enemy' });
    setFighterIdle(true);
    setEnemyIdle(true);
  };

  const openBandit = useCallback(
    (session: CasinoSession, kind: BanditKind, willAdvance: boolean) => {
      try {
        getDepthsAudioEngine().stopAmbience();
      } catch {
        /* */
      }
      const secure = buildLocalSecureSession(session);
      setCasinoSession(session);
      setCasinoSecure(secure);
      setBanditKind(kind);
      setPendingAdvance(willAdvance);
      setPhase('bandit');
      void fetchServerCasinoSession(session).then(server => {
        if (server) setCasinoSecure(server);
      });
    },
    [],
  );

  const startRun = (char: PlayableCharacter) => {
    const floorRooms = buildDepthsFloor(floor, 1);
    setFighter(char);
    setPlayerHP(char.hp);
    setPlayerVibe(char.vibe * 10);
    setBlockNext(false);
    setRooms(floorRooms);
    setRoomIndex(0);
    setRunChips(0);
    setChambersCleared(0);
    setCooldowns({});
    attackLockRef.current = false;
    setCasinoSession(null);
    setCasinoSecure(null);
    setLog([
      `${char.name} descends into the ${DEPTHS_LORE.title}.`,
      DEPTHS_LORE.intro,
      DEPTHS_LORE.banditHook,
      char.selectLine,
      `Floor ${floor}: ${floorRooms.length} chambers. Heavy moves go on cooldown — mix your kit.`,
    ]);
    setPhase('map');
    fireChamberFx('enter', floorRooms[0]?.label ?? 'The Depths');
    void playWaveEnter(1);
    void ensureDepthsMusic();
  };

  const currentRoom = rooms[roomIndex] ?? null;

  const enterRoom = (room: DepthsRoom) => {
    if (!fighter) return;
    setCooldowns({});
    pushLog(`--- ${room.label} ---`);
    pushLog(room.blurb);
    fireChamberFx('enter', room.label);
    void ensureDepthsMusic();

    if (room.kind === 'rest') {
      setPhase('rest');
      return;
    }
    if (room.kind === 'event' && room.event) {
      setPhase('event');
      return;
    }
    if (room.enemy) {
      const kind = room.kind as DepthsRoomKind;
      const scaled = scaleDepthsEnemy(room.enemy, kind, fighter.difficulty);
      setEnemy(scaled);
      setEnemyHP(scaled.hp);
      setEnemyMotion(getEnemyMotionClass(scaled.id));
      setFighterIdle(true);
      setEnemyIdle(true);
      setTurnBanner('you');
      pushLog(`${scaled.name} appears! (${scaled.hp} Cope HP)`);
      pushLog(scaled.taunt);
      setPhase('fight');
      void playWaveEnter(roomIndex + 2);
      return;
    }
    advanceAfterBandit();
  };

  /** Move to next map node after room Bandit (or non-fight rooms). */
  const advanceAfterBandit = useCallback(() => {
    if (!fighter) return;
    const next = roomIndex + 1;
    if (next >= rooms.length) {
      pushLog(`Floor cleared! The ${BRAND.slotMachine} opens for champion pulls.`);
      void playRunComplete();
      const session = buildDepthsClearBanditSession(fighter.difficulty);
      openBandit(session, 'clear', false);
      return;
    }
    setRoomIndex(next);
    setPhase('map');
    void ensureDepthsMusic();
  }, [fighter, roomIndex, rooms.length, openBandit, pushLog, playRunComplete, ensureDepthsMusic]);

  const onFightVictory = useCallback(
    async (room: DepthsRoom | null) => {
      if (!fighter || !room) return;
      setChambersCleared(c => c + 1);
      pushLog(room.enemy?.defeatLine ?? 'Chamber cleared!');
      fireChamberFx('clear', room.label);

      // Valley Leak / Telegram Trench — classic degens pay chips + vibe, then Bandit
      if (room.kind === 'degen') {
        const reward = depthsDegenClearReward(fighter.difficulty);
        setPlayerVibe(v => Math.min(100, v + reward.vibe));
        setRunChips(c => c + reward.chips);
        addChips(reward.chips);
        pushLog(
          `Valley refund: +${reward.chips} chips, +${reward.vibe} vibe. The trench remembers the First Bonk.`,
        );
        const wallet = publicKey?.toBase58();
        if (connected && wallet) {
          void earnSpendableChips({
            wallet,
            amount: reward.chips,
            source: 'depths-event',
          }).then(earned => {
            if (earned) {
              pushLog(`+${reward.chips} spendable chips banked for the Cashier.`);
            }
          });
        } else {
          pushLog(`+${reward.chips} local chips — connect wallet to make them spendable.`);
        }
      }

      const kind = (
        room.kind === 'elite' || room.kind === 'boss' || room.kind === 'degen'
          ? room.kind
          : 'fight'
      ) as DepthsRoomKind;
      const session = buildDepthsRoomBanditSession(kind, fighter.difficulty);
      pushLog(
        room.kind === 'degen'
          ? `Trench bonus! The ${BRAND.slotMachine} opens — ${session.spins} free pull${session.spins === 1 ? '' : 's'} (Valley rates).`
          : `Win bonus! The ${BRAND.slotMachine} opens — ${session.spins} free pull${session.spins === 1 ? '' : 's'}. ` +
              'Then optional quarter spins, or continue the Depths.',
      );
      void playWaveClear();
      await wait(650);
      openBandit(session, 'room', true);
    },
    [
      fighter,
      openBandit,
      playWaveClear,
      pushLog,
      fireChamberFx,
      addChips,
      connected,
      publicKey,
    ],
  );

  const onPlayerDefeat = useCallback(() => {
    if (!fighter) return;
    pushLog(`${fighter.name} is bonked out in the Depths...`);
    void playDefeat();
    const session = buildDepthsDefeatBanditSession(chambersCleared, fighter.difficulty);
    openBandit(session, 'defeat', false);
  }, [fighter, chambersCleared, openBandit, playDefeat, pushLog]);

  const doRestChoice = (choiceId: DepthsRestChoiceId) => {
    if (!fighter) return;
    const pick = depthsRestChoices(fighter.difficulty).find(c => c.id === choiceId);
    if (!pick) return;
    const heal = Math.round(fighter.hp * pick.healFrac);
    let hp = Math.min(fighter.hp, playerHP + heal);
    if (pick.hpRisk > 0) {
      hp = Math.max(1, hp - pick.hpRisk);
      pushLog(`Scavenge scrapes you for ${pick.hpRisk} HP.`);
    }
    setPlayerHP(hp);
    setPlayerVibe(v => Math.min(100, v + pick.vibeGain));
    pushLog(
      pick.id === 'scavenge'
        ? `You scavenge +${pick.chips} chips, +${heal} HP, +${pick.vibeGain} vibe.`
        : `Camp: +${heal} HP, +${pick.vibeGain} vibe.`,
    );
    if (pick.chips > 0) {
      setRunChips(c => c + pick.chips);
      addChips(pick.chips);
      const wallet = publicKey?.toBase58();
      if (connected && wallet) {
        void earnSpendableChips({
          wallet,
          amount: pick.chips,
          source: 'depths-event',
        });
      }
    }
    fireChamberFx('clear', 'Camp packed');
    advanceAfterBandit();
  };

  const resolveEvent = (choice: 'a' | 'b') => {
    if (!fighter || !currentRoom?.event) return;
    const pick = currentRoom.event[choice];
    setPlayerHP(h => Math.max(0, Math.min(fighter.hp, h + pick.hpDelta)));
    setPlayerVibe(v => Math.max(0, Math.min(100, v + pick.vibeDelta)));
    pushLog(pick.log);
    if (pick.chips > 0) {
      setRunChips(c => c + pick.chips);
      addChips(pick.chips);
      const wallet = publicKey?.toBase58();
      if (connected && wallet) {
        void earnSpendableChips({
          wallet,
          amount: pick.chips,
          source: 'depths-event',
        }).then(earned => {
          if (earned) {
            pushLog(`+${pick.chips} spendable Bonk Chips banked for cashier.`);
          } else {
            pushLog(`+${pick.chips} local chips (connect/retry to bank spendable).`);
          }
        });
      } else {
        pushLog(`+${pick.chips} Bonk Chips (event) — connect wallet to make them spendable.`);
      }
    }
    const nextHp = Math.max(0, Math.min(fighter.hp, playerHP + pick.hpDelta));
    if (nextHp <= 0) {
      onPlayerDefeat();
      return;
    }
    advanceAfterBandit();
  };

  const playerAttack = async (ability: CharacterAbility) => {
    if (!fighter || !enemy || busy || phase !== 'fight' || attackLockRef.current) return;
    if (ability.id === 'sonic-boom' && playerVibe < 15) {
      pushLog('Not enough vibe for Sonic Boom!');
      return;
    }

    // Tick cooldowns once at the start of the player's action
    const ticked = tickCooldowns(cooldowns);
    if (isAbilityOnCooldown(ticked, ability.id)) {
      pushLog(`${ability.name} is cooling down (${ticked[ability.id]} turn left). Mix your kit!`);
      setCooldowns(ticked);
      return;
    }

    attackLockRef.current = true;
    setBusy(true);
    setTurnBanner('you');
    setFighterIdle(false);
    setEnemyIdle(false);

    try {
      setAbilityMotion(getAbilityMotionClass(ability.id));
      await wait(80);
      setFighterWindUp(true);
      await wait(200);
      setFighterWindUp(false);
      setSpeedLines(true);
      setFighterLunge(true);
      void playAttackWindup(ability.id);
      await wait(320);

      let dmg = ability.dmg;
      if (ability.id === 'chaos-bonk') dmg = 25 + Math.floor(Math.random() * 66);
      if (ability.id === 'read-the-room' && enemyHP < enemy.hp * 0.5) {
        dmg = Math.round(dmg * 1.35);
        pushLog('Bink reads the room — bonus damage!');
      }
      let crit = false;
      if (ability.critChance && Math.random() < ability.critChance) {
        dmg = Math.round(dmg * DEPTHS_CRIT_MULT);
        crit = true;
        pushLog('CRITICAL BONK!');
      }
      dmg = Math.round(dmg * (1 + fighter.power * 0.025));
      dmg = scaleDepthsPlayerDamage(dmg, fighter.difficulty);

      pushLog(ability.flavor);

      let hp = playerHP;
      // Full kit heals in Depths — Bonnie's identity is keeping you alive to the boss.
      if (ability.healHp) hp = Math.min(fighter.hp, hp + ability.healHp);
      if (ability.healVibe) setPlayerVibe(v => Math.min(100, v + ability.healVibe!));
      if (ability.id === 'sonic-boom') setPlayerVibe(v => Math.max(0, v - 15));
      if (ability.id === 'send-it') {
        const recoil = fighter.difficulty === 'easy' ? 12 : 20;
        hp = Math.max(0, hp - recoil);
        pushLog(`${fighter.name} takes ${recoil} recoil!`);
      }
      if (ability.blockNextHit) setBlockNext(true);

      const cdTurns = depthsAbilityCooldownTurns(ability, fighter.difficulty);
      if (cdTurns > 0) {
        setCooldowns({ ...ticked, [ability.id]: cdTurns });
        pushLog(`${ability.name} goes on cooldown (${cdTurns} turn${cdTurns > 1 ? 's' : ''}).`);
      } else {
        setCooldowns(ticked);
      }

      const nextEnemyHP = Math.max(0, enemyHP - dmg);
      setPlayerHP(hp);
      setEnemyHP(nextEnemyHP);

      const isHealMove = Boolean(ability.healHp && ability.healHp >= 25 && dmg <= 40);
      const burstVariant: BurstVariant = isHealMove ? 'heal' : crit ? 'crit' : 'bonk';

      void playPlayerHit(ability.id, crit, dmg);
      setCombatImpact(true);
      setImpactTarget('enemy');
      setImpactKey(k => k + 1);
      setHealPulse(isHealMove);
      setAttackBurst({
        show: true,
        text: burstVariant === 'heal' ? 'BONK! ♥' : crit ? 'CRITICAL!' : 'BONK!',
        variant: burstVariant,
      });
      setEnemyHit(true);
      setArenaShake(true);
      setArenaFlash(true);
      if (dmg > 0) {
        setDamagePopup({ show: true, value: dmg, crit, target: 'enemy' });
      }

      pushLog(`${ability.name} deals ${dmg}${crit ? ' CRIT' : ''} to ${enemy.name}!`);
      if (enemy.hitReaction.length) {
        pushLog(enemy.hitReaction[Math.floor(Math.random() * enemy.hitReaction.length)]);
      }

      await wait(crit ? 700 : 580);
      clearPlayerAttackVfx();

      if (nextEnemyHP <= 0) {
        setEnemyKo(true);
        await wait(750);
        setEnemyKo(false);
        await onFightVictory(currentRoom);
        return;
      }

      if (hp <= 0) {
        onPlayerDefeat();
        return;
      }

      // Enemy turn
      setTurnBanner('enemy');
      await wait(280);
      const abilityRes = resolveEnemyAbility(enemy, {
        playerHP: hp,
        playerMaxHP: fighter.hp,
        enemyHP: nextEnemyHP,
        enemyMaxHP: enemy.hp,
        blockActive: blockNext || Boolean(ability.blockNextHit),
      });

      let blocked = blockNext || Boolean(ability.blockNextHit);
      if (abilityRes.ignoreBlock) blocked = false;
      setBlockNext(false);

      setEnemyMotion(getEnemyMotionClass(enemy.id));
      setEnemyWindUp(true);
      await wait(240);
      setEnemyWindUp(false);

      if (blocked) {
        setEnemyLunge(true);
        await wait(200);
        setEnemyLunge(false);
        setBlockFlash(true);
        setAttackBurst({ show: true, text: 'BLOCKED!', variant: 'block' });
        void playBlock();
        pushLog(getEnemyAttackShout(enemy));
        if (abilityRes.flavor) pushLog(abilityRes.flavor);
        pushLog('Block softens the blow — diamond hands!');
        await wait(560);
        clearEnemyAttackVfx();
        return;
      }

      setSpeedLines(true);
      setEnemyLunge(true);
      void playEnemyWindup(enemy.id);
      await wait(340);

      pushLog(getEnemyAttackShout(enemy));
      if (abilityRes.flavor) pushLog(abilityRes.flavor);
      else pushLog(enemy.counterAttack);

      let counter = calcCounterDamage(enemy.counterDmg, fighter.defense);
      counter = Math.round(counter * abilityRes.counterMult + abilityRes.flatBonusDamage);
      counter = scaleDepthsCounter(counter, fighter.difficulty);

      if (abilityRes.vibeDrain > 0) {
        setPlayerVibe(v => Math.max(0, v - abilityRes.vibeDrain));
        pushLog(`Vibe drained by ${abilityRes.vibeDrain}!`);
      }
      if (abilityRes.enemyHealPercent > 0) {
        const heal = Math.round(enemy.hp * abilityRes.enemyHealPercent);
        setEnemyHP(e => Math.min(enemy.hp, e + heal));
        pushLog(`${enemy.name} recovers ${heal} HP!`);
        void playEnemyCopeHeal(enemy.id);
      }

      const after = Math.max(0, hp - counter);
      setPlayerHP(after);

      void playEnemyHit(counter, enemy.id, {
        heavy: abilityRes.counterMult >= 1.3 || counter >= 28 || abilityRes.ignoreBlock,
      });
      setCombatImpact(true);
      setImpactTarget('player');
      setImpactKey(k => k + 1);
      setAttackBurst({
        show: true,
        text: getEnemyAttackShout(enemy).slice(0, 18) || 'COPE!',
        variant: 'enemy',
      });
      setFighterHit(true);
      setArenaShake(true);
      setArenaFlashEnemy(true);
      setDamagePopup({ show: true, value: counter, crit: false, target: 'player' });
      pushLog(`${enemy.name} hits for ${counter}!`);

      await wait(620);
      clearEnemyAttackVfx();

      if (after <= 0) {
        onPlayerDefeat();
      }
    } finally {
      attackLockRef.current = false;
      setBusy(false);
      setFighterIdle(true);
      setEnemyIdle(true);
      setTurnBanner('you');
    }
  };

  const resetToHub = () => {
    attackLockRef.current = false;
    try {
      getDepthsAudioEngine().stopAmbience();
    } catch {
      /* */
    }
    setPhase('hub');
    setFighter(null);
    setEnemy(null);
    setLog([]);
    setRooms([]);
    setRoomIndex(0);
    setCasinoSession(null);
    setCasinoSecure(null);
    setCooldowns({});
    setTurnBanner(null);
    setChamberFx(null);
    clearPlayerAttackVfx();
    clearEnemyAttackVfx();
  };

  const handleBanditContinue = () => {
    if (banditKind === 'room' && pendingAdvance) {
      setCasinoSession(null);
      setCasinoSecure(null);
      advanceAfterBandit();
      return;
    }
    if (banditKind === 'clear') {
      setCasinoSession(null);
      setCasinoSecure(null);
      setPhase('victory');
      return;
    }
    // defeat
    setCasinoSession(null);
    setCasinoSecure(null);
    setPhase('defeat');
  };

  const handleBanditExit = () => {
    resetToHub();
  };

  // ── Full-screen Bandit ──
  if (phase === 'bandit' && casinoSession && casinoSecure && fighter) {
    return (
      <CasinoSlot
        session={casinoSession}
        secureSession={casinoSecure}
        fighter={fighter}
        quarterFirst={casinoSession.spins === 0}
        onContinue={handleBanditContinue}
        continueLabel={
          banditKind === 'room'
            ? 'Continue Depths →'
            : banditKind === 'clear'
              ? 'Finish run →'
              : 'Leave Bandit →'
        }
        exitLabel="Abort to Depths hub"
        onExit={handleBanditExit}
        onRunItBack={
          banditKind === 'clear'
            ? () => {
                resetToHub();
              }
            : undefined
        }
      />
    );
  }

  if (phase === 'hub') {
    return (
      <div className="depths-shell">
        <header className="depths-header">
          <div className="depths-nav">
            <Link href={`${BRAND.homePath}${BRAND.homeAnchor}`} className="art-btn px-4 py-2 text-[#f0d878]">
              ← {BRAND.home}
            </Link>
            <Link href="/alice" className="art-btn px-4 py-2 text-[#f0abfc]">
              {BRAND.aliceRoomNav}
            </Link>
            <Link href="/cashier" className="art-btn px-4 py-2 text-[#f0d878]">
              {BRAND.cashier}
            </Link>
            <span className="depths-chip-pill">{chips.toLocaleString()} chips</span>
          </div>
          <h1 className="depths-title">{DEPTHS_LORE.title}</h1>
          <p className="depths-sub">{DEPTHS_LORE.subtitle}</p>
          <p className="depths-intro">{DEPTHS_LORE.intro}</p>

          {showCoach && (
            <div className="depths-coach" role="region" aria-label="How Depths works">
              <div className="depths-coach-head">
                <h3 className="depths-coach-title">Quick start</h3>
                <button
                  type="button"
                  className="depths-coach-dismiss"
                  onClick={() => {
                    dismissDepthsCoach();
                    setShowCoach(false);
                  }}
                >
                  Got it
                </button>
              </div>
              <ol className="depths-coach-list">
                <li>
                  <strong>Pick a champion</strong> — easy bloodlines (Bonnie, Beng) heal more and face softer
                  foes.
                </li>
                <li>
                  <strong>Clear chambers</strong> — rival fights, events, rest, and a{' '}
                  <strong>Valley Leak</strong> (classic degens: chips + vibe + Bandit).
                </li>
                <li>
                  <strong>Win → Bandit pulls</strong> — free spins on {BRAND.slotMachine}. Floor clear =
                  champion spins.
                </li>
                <li>
                  <strong>Cash at the Cashier</strong> — only server-ledger chips (wallet connected) can
                  cash out.
                </li>
              </ol>
            </div>
          )}

          <p className="depths-hint">{DEPTHS_LORE.banditHook}</p>
          <p className="depths-hint">
            Want a different game? Try {BRAND.aliceRoomNav} — pull the Alice Machine lever for dream coins.
          </p>
        </header>

        <h2 className="depths-section-title depths-roster-heading">Choose your bloodline</h2>
        <div className="depths-roster">
          {PLAYABLE_CHARACTERS.map(char => (
            <button
              key={char.id}
              type="button"
              className="depths-char-card"
              onClick={() => {
                if (showCoach) {
                  dismissDepthsCoach();
                  setShowCoach(false);
                }
                startRun(char);
              }}
            >
              <Image
                src={char.img}
                alt={char.name}
                width={140}
                height={180}
                className="depths-char-img"
                unoptimized
              />
              <strong>{char.name}</strong>
              <span className="depths-char-role">{char.role}</span>
              <span
                className="depths-diff"
                style={{ color: DIFFICULTY_META[char.difficulty].color }}
              >
                {DIFFICULTY_META[char.difficulty].label}
              </span>
              <span className="depths-char-cta">Descend →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const mapProgressPct =
    rooms.length > 0 ? Math.round(((roomIndex + (phase === 'victory' ? 1 : 0)) / rooms.length) * 100) : 0;

  return (
    <div
      className={`depths-shell ${phase === 'fight' ? 'depths-shell-fight' : ''} ${phase === 'map' ? 'depths-shell-map' : ''}`}
    >
      {chamberFx && (
        <div
          key={chamberFx.key}
          className={`depths-chamber-fx depths-chamber-fx-${chamberFx.mode}`}
          aria-hidden
        >
          <span className="depths-chamber-fx-label">{chamberFx.label}</span>
        </div>
      )}

      <header
        className={`depths-header depths-header-compact ${phase === 'fight' ? 'depths-header-fight' : ''}`}
      >
        <div className="depths-nav">
          <button type="button" className="art-btn px-3 py-1.5 text-[#f0d878]" onClick={resetToHub}>
            {phase === 'fight' ? 'Abort' : 'Abort run'}
          </button>
          <Link href={`${BRAND.homePath}${BRAND.homeAnchor}`} className="art-btn px-3 py-1.5 text-[#a7f3d0]">
            ← {BRAND.home}
          </Link>
          {phase !== 'fight' && (
            <>
              <Link href="/alice" className="art-btn px-3 py-1.5 text-[#f0abfc]">
                {BRAND.aliceRoomNav}
              </Link>
              <Link href="/cashier" className="art-btn px-3 py-1.5 text-[#f0d878]">
                Cashier
              </Link>
            </>
          )}
          <span className="depths-chip-pill">
            {phase === 'fight'
              ? `${playerHP}/${fighter?.hp ?? 0}`
              : `Cleared ${chambersCleared} · Bank ${chips.toLocaleString()}${runChips > 0 ? ` · +${runChips}` : ''}`}
          </span>
        </div>
        {fighter && (
          <div className="depths-status-bar">
            <p className="depths-fighter-line">
              {fighter.name}
              {phase === 'fight'
                ? ` · ${playerHP}/${fighter.hp} · V${playerVibe}${blockNext ? ' · BLK' : ''}`
                : ` · HP ${playerHP}/${fighter.hp} · Vibe ${playerVibe}${blockNext ? ' · BLOCK' : ''}`}
            </p>
            {rooms.length > 0 && (
              <div
                className="depths-progress"
                role="progressbar"
                aria-valuenow={roomIndex + 1}
                aria-valuemin={1}
                aria-valuemax={rooms.length}
                aria-label={`Chamber ${roomIndex + 1} of ${rooms.length}`}
              >
                <div className="depths-progress-track">
                  <div
                    className="depths-progress-fill"
                    style={{ width: `${Math.max(6, mapProgressPct)}%` }}
                  />
                </div>
                <span className="depths-progress-label">
                  F{floor} · {roomIndex + 1}/{rooms.length}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {phase === 'map' && currentRoom && (
        <section className="depths-map">
          <h2 className="depths-section-title">Chamber path</h2>
          <div className="depths-path" role="list" aria-label="Floor path">
            {rooms.map((room, i) => {
              const meta = roomKindMeta(room.kind);
              const state = i < roomIndex ? 'done' : i === roomIndex ? 'active' : 'ahead';
              return (
                <div
                  key={room.id}
                  role="listitem"
                  className={`depths-node depths-node-${state} ${meta.className}`}
                >
                  <span className="depths-node-icon" aria-hidden>
                    {i < roomIndex ? '✓' : meta.icon}
                  </span>
                  <span className="depths-node-kind">{meta.label}</span>
                  <strong className="depths-node-label">{room.label}</strong>
                </div>
              );
            })}
          </div>
          <div className="depths-room-card">
            <p className="depths-room-kicker">{roomKindMeta(currentRoom.kind).label}</p>
            <h3>{currentRoom.label}</h3>
            <p className="depths-room-blurb">{currentRoom.blurb}</p>
            <p className="depths-threat-line">{roomThreatLine(currentRoom.kind)}</p>
            {currentRoom.enemy && (
              <div className="depths-preview-enemy">
                <Image
                  src={currentRoom.enemy.img}
                  alt={currentRoom.enemy.name}
                  width={100}
                  height={100}
                  unoptimized
                />
                <div>
                  <strong>{currentRoom.enemy.name}</strong>
                  <p>{currentRoom.enemy.title}</p>
                </div>
              </div>
            )}
            <button
              type="button"
              className="art-btn depths-enter-btn"
              onClick={() => enterRoom(currentRoom)}
            >
              Enter chamber
            </button>
          </div>
        </section>
      )}

      {phase === 'fight' && enemy && fighter && (
        <section className="depths-fight">
          {turnBanner && (
            <p className={`depths-turn-banner depths-turn-banner-${turnBanner}`} role="status">
              {turnBanner === 'you' ? 'Your move' : 'Enemy counters'}
            </p>
          )}
          <div
            className={`combat-arena depths-combat-arena ${arenaShake ? 'arena-shake' : ''} ${arenaFlash ? 'arena-active' : ''} ${arenaFlashEnemy ? 'arena-active-enemy' : ''}`}
          >
            <div className="arena-glow" />
            <div className="fighter-spotlight" />
            <div className="enemy-spotlight" />
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
              className={`fighter-sprite depths-fighter-sprite ${fighterIdle ? 'idle' : ''} ${fighterWindUp ? 'wind-up' : ''} ${fighterLunge ? `lunge ${abilityMotion}` : ''} ${fighterHit ? 'hit' : ''}`}
            >
              <Image
                src={fighter.img}
                alt={fighter.name}
                width={160}
                height={200}
                className="fighter-img object-contain"
                unoptimized
                priority
              />
              <div className="fighter-label text-center font-display font-bold text-[#f0d878] mt-1 tracking-wider text-sm">
                {fighter.name}
              </div>
              <div className="depths-bar depths-bar-arena">
                <div
                  className="depths-bar-fill depths-bar-hp"
                  style={{ width: `${(playerHP / fighter.hp) * 100}%` }}
                />
              </div>
              <span className="depths-arena-hp">
                {playerHP}/{fighter.hp}
              </span>
            </div>

            <div
              className={`enemy-sprite depths-enemy-sprite ${enemyIdle ? 'idle' : ''} ${enemyWindUp ? 'wind-up' : ''} ${enemyLunge ? `lunge ${enemyMotion}` : ''} ${enemyHit ? 'hit' : ''} ${enemyKo ? 'ko' : ''}`}
            >
              <Image
                src={enemy.img}
                alt={enemy.name}
                width={140}
                height={180}
                className="enemy-img object-contain"
                unoptimized
              />
              <div className="text-center text-sm font-display font-bold text-[#e8a0a0] mt-1 tracking-wider">
                {enemy.name}
              </div>
              <div className="depths-bar depths-bar-arena">
                <div
                  className="depths-bar-fill depths-bar-enemy"
                  style={{ width: `${(enemyHP / enemy.hp) * 100}%` }}
                />
              </div>
              <span className="depths-arena-hp depths-arena-hp-enemy">
                {enemyHP}/{enemy.hp}
              </span>
            </div>

            {attackBurst.show && (
              <div className="bonk-burst">
                <div className="bonk-burst-inner relative">
                  <span
                    className={`bonk-text ${attackBurst.variant === 'crit' ? 'crit' : ''} ${attackBurst.variant === 'heal' ? 'heal' : ''} ${attackBurst.variant === 'enemy' ? 'enemy' : ''} ${attackBurst.variant === 'block' ? 'block' : ''}`}
                  >
                    {attackBurst.text}
                  </span>
                </div>
              </div>
            )}

            {damagePopup.show && (
              <div
                className={`damage-popup ${damagePopup.crit ? 'crit' : ''} ${damagePopup.target === 'player' ? 'player-hit' : ''}`}
                key={`dmg-${impactKey}-${damagePopup.value}`}
              >
                -{damagePopup.value}
              </div>
            )}
          </div>

          <p className="depths-enemy-title text-center mt-2">{enemy.title}</p>

          <div className="depths-abilities">
            {fighter.abilities.map(ab => {
              const onCd = isAbilityOnCooldown(cooldowns, ab.id);
              const cdLeft = cooldowns[ab.id] ?? 0;
              const role = abilityRole(ab);
              return (
                <button
                  key={ab.id}
                  type="button"
                  className={`art-btn depths-ability-btn depths-ability-${role} ${onCd ? 'depths-ability-cd' : ''}`}
                  disabled={busy || onCd}
                  onClick={() => void playerAttack(ab)}
                  title={ab.description}
                >
                  <span className="depths-ability-role">{abilityRoleLabel(role)}</span>
                  <strong className="depths-ability-name">
                    {ab.name}
                    {onCd ? ` · ${cdLeft}` : ''}
                  </strong>
                  <span className="depths-ability-desc">{ab.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {phase === 'event' && currentRoom?.event && (
        <section className="depths-event depths-event-rich">
          <p className="depths-room-kicker">Event</p>
          <h2>{currentRoom.label}</h2>
          <p className="depths-room-blurb">{currentRoom.blurb}</p>
          <div className="depths-event-choices">
            <button
              type="button"
              className="art-btn depths-choice-card"
              onClick={() => resolveEvent('a')}
            >
              <strong>{currentRoom.event.a.label}</strong>
              {currentRoom.event.a.whisper ? (
                <span className="depths-choice-whisper">{currentRoom.event.a.whisper}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="art-btn depths-choice-card"
              onClick={() => resolveEvent('b')}
            >
              <strong>{currentRoom.event.b.label}</strong>
              {currentRoom.event.b.whisper ? (
                <span className="depths-choice-whisper">{currentRoom.event.b.whisper}</span>
              ) : null}
            </button>
          </div>
        </section>
      )}

      {phase === 'rest' && fighter && (
        <section className="depths-event depths-event-rich depths-rest">
          <p className="depths-room-kicker">Camp</p>
          <h2>Frequency Camp</h2>
          <p className="depths-room-blurb">
            Bonga left a hum in the stone. Choose how you recover — then descend again.
          </p>
          <div className="depths-event-choices depths-rest-choices">
            {depthsRestChoices(fighter.difficulty).map(c => (
              <button
                key={c.id}
                type="button"
                className={`art-btn depths-choice-card depths-rest-${c.id}`}
                onClick={() => doRestChoice(c.id)}
              >
                <strong>{c.label}</strong>
                <span className="depths-choice-whisper">{c.whisper}</span>
                <span className="depths-choice-stats">
                  {c.healFrac > 0 ? `+${Math.round(fighter.hp * c.healFrac)} HP` : ''}
                  {c.vibeGain > 0 ? ` · +${c.vibeGain} vibe` : ''}
                  {c.chips > 0 ? ` · +${c.chips} chips` : ''}
                  {c.hpRisk > 0 ? ` · −${c.hpRisk} HP risk` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'victory' && (
        <section className="depths-end depths-end-win">
          <h2>Depths cleared!</h2>
          <p>
            {fighter?.name} reclaimed the frequency. Run chips this dive: {runChips.toLocaleString()}.
            Cash server-ledger chips at the {BRAND.cashier}.
          </p>
          <div className="depths-end-actions">
            <button type="button" className="art-btn depths-enter-btn" onClick={resetToHub}>
              Return to Depths hub
            </button>
            <Link href="/cashier" className="art-btn depths-enter-btn">
              Cash out at {BRAND.cashier}
            </Link>
            <Link href="/alice" className="art-btn depths-enter-btn depths-enter-alice">
              {BRAND.aliceRoomNav}
            </Link>
          </div>
        </section>
      )}

      {phase === 'defeat' && (
        <section className="depths-end depths-end-lose">
          <h2>Bonked out</h2>
          <p>
            Consolation spins are done. Cleared {chambersCleared} chamber
            {chambersCleared === 1 ? '' : 's'} this run. Try another bloodline — or a trip on the Alice
            Machine.
          </p>
          <div className="depths-end-actions">
            <button type="button" className="art-btn depths-enter-btn" onClick={resetToHub}>
              Back to hub
            </button>
            <Link href="/alice" className="art-btn depths-enter-btn depths-enter-alice">
              {BRAND.aliceRoomNav}
            </Link>
            <Link href="/" className="art-btn depths-enter-btn">
              Gallery
            </Link>
          </div>
        </section>
      )}

      {phase !== 'bandit' && log.length > 0 && (
        <div className={`depths-log ${logOpen ? 'depths-log-open' : 'depths-log-collapsed'}`}>
          <button
            type="button"
            className="depths-log-toggle"
            onClick={() => setLogOpen(o => !o)}
            aria-expanded={logOpen}
          >
            {logOpen ? 'Hide log' : 'Show log'}
            {!logOpen && log.length > 0 ? (
              <span className="depths-log-preview">{log[log.length - 1]}</span>
            ) : null}
          </button>
          {logOpen && (
            <div className="depths-log-body" aria-live="polite">
              {log.slice(-12).map((line, i) => (
                <p key={`${i}-${line.slice(0, 12)}`}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
