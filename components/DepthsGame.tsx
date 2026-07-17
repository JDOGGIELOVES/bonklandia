'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
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
import {
  buildDepthsFloor,
  DEPTHS_CHIP_REWARDS,
  type DepthsRoom,
} from '@/lib/depths/rooms';
import { getAbilityMotionClass, getEnemyMotionClass } from '@/lib/combat-vfx';
import { useBonkBank } from '@/hooks/useBonkBank';
import { useCombatAudio } from '@/hooks/useCombatAudio';
import CombatArenaVfx from '@/components/CombatArenaVfx';

type Phase = 'hub' | 'map' | 'fight' | 'event' | 'rest' | 'victory' | 'defeat';
type BurstVariant = 'bonk' | 'crit' | 'heal' | 'enemy' | 'block';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export default function DepthsGame() {
  const { addChips, chips } = useBonkBank();
  const {
    muted,
    toggleMute,
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
  const [floor] = useState(1);

  // Combat presentation (same system as main arena)
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

  const startRun = (char: PlayableCharacter) => {
    const floorRooms = buildDepthsFloor(floor, 1);
    setFighter(char);
    setPlayerHP(char.hp);
    setPlayerVibe(char.vibe * 10);
    setBlockNext(false);
    setRooms(floorRooms);
    setRoomIndex(0);
    setRunChips(0);
    setLog([
      `${char.name} descends into the ${DEPTHS_LORE.title}.`,
      DEPTHS_LORE.intro,
      char.selectLine,
      `Floor ${floor}: ${floorRooms.length} chambers await.`,
    ]);
    setPhase('map');
    void playWaveEnter(1);
  };

  const currentRoom = rooms[roomIndex] ?? null;

  const enterRoom = (room: DepthsRoom) => {
    if (!fighter) return;
    pushLog(`--- ${room.label} ---`);
    pushLog(room.blurb);

    if (room.kind === 'rest') {
      setPhase('rest');
      return;
    }
    if (room.kind === 'event' && room.event) {
      setPhase('event');
      return;
    }
    if (room.enemy) {
      setEnemy(room.enemy);
      setEnemyHP(room.enemy.hp);
      setEnemyMotion(getEnemyMotionClass(room.enemy.id));
      setFighterIdle(true);
      setEnemyIdle(true);
      pushLog(`${room.enemy.name} appears!`);
      pushLog(room.enemy.taunt);
      setPhase('fight');
      void playWaveEnter(roomIndex + 2);
      return;
    }
    advanceRoom(0);
  };

  const advanceRoom = (bonusChips: number) => {
    if (!fighter) return;
    if (bonusChips > 0) {
      setRunChips(c => c + bonusChips);
      addChips(bonusChips);
      pushLog(`+${bonusChips} Bonk Chips.`);
    }

    const next = roomIndex + 1;
    if (next >= rooms.length) {
      const clear = DEPTHS_CHIP_REWARDS.clearBonus;
      setRunChips(c => c + clear);
      addChips(clear);
      pushLog(`Floor cleared! +${clear} clear bonus.`);
      pushLog(`${fighter.name} reclaims a scrap of the First Bonk's frequency.`);
      setPhase('victory');
      void playRunComplete();
      return;
    }
    setRoomIndex(next);
    setPhase('map');
  };

  const doRest = () => {
    if (!fighter) return;
    const heal = Math.round(fighter.hp * 0.35);
    setPlayerHP(h => Math.min(fighter.hp, h + heal));
    setPlayerVibe(v => Math.min(100, v + 25));
    pushLog(`Frequency Camp restores ${heal} HP and 25 vibe.`);
    advanceRoom(0);
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
      pushLog(`+${pick.chips} Bonk Chips.`);
    }
    const nextHp = Math.max(0, Math.min(fighter.hp, playerHP + pick.hpDelta));
    if (nextHp <= 0) {
      pushLog(`${fighter.name} bonked themselves with a bad decision.`);
      setPhase('defeat');
      void playDefeat();
      return;
    }
    advanceRoom(0);
  };

  const playerAttack = async (ability: CharacterAbility) => {
    if (!fighter || !enemy || busy || phase !== 'fight') return;
    if (ability.id === 'sonic-boom' && playerVibe < 15) {
      pushLog('Not enough vibe for Sonic Boom!');
      return;
    }

    setBusy(true);
    setFighterIdle(false);
    setEnemyIdle(false);

    try {
      // ── Player wind-up + lunge ──
      setAbilityMotion(getAbilityMotionClass(ability.id));
      await wait(50);
      setFighterWindUp(true);
      await wait(160);
      setFighterWindUp(false);
      setSpeedLines(true);
      setFighterLunge(true);
      void playAttackWindup(ability.id);
      await wait(280);

      let dmg = ability.dmg;
      if (ability.id === 'chaos-bonk') dmg = 25 + Math.floor(Math.random() * 66);
      if (ability.id === 'read-the-room' && enemyHP < enemy.hp * 0.5) {
        dmg = Math.round(dmg * 1.5);
        pushLog('Bink reads the room — bonus damage!');
      }
      let crit = false;
      if (ability.critChance && Math.random() < ability.critChance) {
        dmg *= 2;
        crit = true;
        pushLog('CRITICAL BONK!');
      }
      dmg = Math.round(dmg * (1 + fighter.power * 0.03));

      pushLog(ability.flavor);

      let hp = playerHP;
      if (ability.healHp) hp = Math.min(fighter.hp, hp + ability.healHp);
      if (ability.healVibe) setPlayerVibe(v => Math.min(100, v + ability.healVibe!));
      if (ability.id === 'sonic-boom') setPlayerVibe(v => Math.max(0, v - 15));
      if (ability.id === 'send-it') {
        hp = Math.max(0, hp - 20);
        pushLog(`${fighter.name} takes 20 recoil!`);
      }
      if (ability.blockNextHit) setBlockNext(true);

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

      pushLog(
        `${ability.name} deals ${dmg}${crit ? ' CRIT' : ''} to ${enemy.name}!`,
      );
      if (enemy.hitReaction.length) {
        pushLog(enemy.hitReaction[Math.floor(Math.random() * enemy.hitReaction.length)]);
      }

      await wait(crit ? 620 : 500);
      clearPlayerAttackVfx();

      if (nextEnemyHP <= 0) {
        setEnemyKo(true);
        pushLog(enemy.defeatLine);
        void playWaveClear();
        await wait(700);
        setEnemyKo(false);
        const reward =
          currentRoom?.kind === 'boss'
            ? DEPTHS_CHIP_REWARDS.boss
            : currentRoom?.kind === 'elite'
              ? DEPTHS_CHIP_REWARDS.elite
              : DEPTHS_CHIP_REWARDS.fight;
        setBusy(false);
        advanceRoom(reward);
        return;
      }

      if (hp <= 0) {
        pushLog(`${fighter.name} is bonked out in the Depths...`);
        setPhase('defeat');
        void playDefeat();
        setBusy(false);
        return;
      }

      // ── Enemy turn ──
      await wait(220);
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
      await wait(200);
      setEnemyWindUp(false);

      if (blocked) {
        setEnemyLunge(true);
        await wait(180);
        setEnemyLunge(false);
        setBlockFlash(true);
        setAttackBurst({ show: true, text: 'BLOCKED!', variant: 'block' });
        void playBlock();
        pushLog(getEnemyAttackShout(enemy));
        if (abilityRes.flavor) pushLog(abilityRes.flavor);
        pushLog('Block softens the blow — diamond hands!');
        await wait(520);
        clearEnemyAttackVfx();
        setBusy(false);
        return;
      }

      setSpeedLines(true);
      setEnemyLunge(true);
      void playEnemyWindup(enemy.id);
      await wait(300);

      pushLog(getEnemyAttackShout(enemy));
      if (abilityRes.flavor) pushLog(abilityRes.flavor);
      else pushLog(enemy.counterAttack);

      let counter = calcCounterDamage(enemy.counterDmg, fighter.defense);
      counter = Math.round(counter * abilityRes.counterMult + abilityRes.flatBonusDamage);

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
        heavy: abilityRes.counterMult >= 1.3 || counter >= 24 || abilityRes.ignoreBlock,
      });
      setCombatImpact(true);
      setImpactTarget('player');
      setImpactKey(k => k + 1);
      setAttackBurst({ show: true, text: getEnemyAttackShout(enemy).slice(0, 18) || 'COPE!', variant: 'enemy' });
      setFighterHit(true);
      setArenaShake(true);
      setArenaFlashEnemy(true);
      setDamagePopup({ show: true, value: counter, crit: false, target: 'player' });
      pushLog(`${enemy.name} hits for ${counter}!`);

      await wait(550);
      clearEnemyAttackVfx();

      if (after <= 0) {
        pushLog(`${fighter.name} is bonked out in the Depths...`);
        setPhase('defeat');
        void playDefeat();
      }
    } finally {
      setBusy(false);
      setFighterIdle(true);
      setEnemyIdle(true);
    }
  };

  const resetToHub = () => {
    setPhase('hub');
    setFighter(null);
    setEnemy(null);
    setLog([]);
    setRooms([]);
    setRoomIndex(0);
    clearPlayerAttackVfx();
    clearEnemyAttackVfx();
  };

  if (phase === 'hub') {
    return (
      <div className="depths-shell">
        <header className="depths-header">
          <div className="depths-nav">
            <Link href="/" className="art-btn px-4 py-2 text-[#f0d878]">
              ← Gallery
            </Link>
            <Link href="/cashier" className="art-btn px-4 py-2 text-[#f0d878]">
              {BRAND.cashier}
            </Link>
            <button
              type="button"
              className="art-btn px-4 py-2 text-[#f0d878]"
              onClick={() => toggleMute()}
              aria-pressed={muted}
            >
              {muted ? '🔇 SFX off' : '🔊 SFX on'}
            </button>
            <span className="depths-chip-pill">{chips.toLocaleString()} chips</span>
          </div>
          <h1 className="depths-title">{DEPTHS_LORE.title}</h1>
          <p className="depths-sub">{DEPTHS_LORE.subtitle}</p>
          <p className="depths-intro">{DEPTHS_LORE.intro}</p>
          <p className="depths-hint">
            Choose a bloodline. Clear six chambers of rival meme mascots. Earn Bonk Chips for the cashier.
            Attacks use synth bonk SFX + ability lunges — tap an ability once audio is unlocked by your click.
          </p>
        </header>

        <div className="depths-roster">
          {PLAYABLE_CHARACTERS.map(char => (
            <button
              key={char.id}
              type="button"
              className="depths-char-card"
              onClick={() => startRun(char)}
            >
              <Image
                src={char.img}
                alt={char.name}
                width={120}
                height={120}
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
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="depths-shell">
      <header className="depths-header depths-header-compact">
        <div className="depths-nav">
          <button type="button" className="art-btn px-4 py-2 text-[#f0d878]" onClick={resetToHub}>
            Abort run
          </button>
          <Link href="/cashier" className="art-btn px-4 py-2 text-[#f0d878]">
            {BRAND.cashier}
          </Link>
          <button
            type="button"
            className="art-btn px-4 py-2 text-[#f0d878]"
            onClick={() => toggleMute()}
            aria-pressed={muted}
          >
            {muted ? '🔇 SFX off' : '🔊 SFX on'}
          </button>
          <span className="depths-chip-pill">
            Run +{runChips} · Bank {chips.toLocaleString()}
          </span>
        </div>
        {fighter && (
          <p className="depths-fighter-line">
            {fighter.name} · HP {playerHP}/{fighter.hp} · Vibe {playerVibe}
            {blockNext ? ' · BLOCK READY' : ''}
          </p>
        )}
      </header>

      {phase === 'map' && currentRoom && (
        <section className="depths-map">
          <h2 className="depths-section-title">
            Floor {floor} · Chamber {roomIndex + 1}/{rooms.length}
          </h2>
          <div className="depths-path">
            {rooms.map((room, i) => (
              <div
                key={room.id}
                className={`depths-node ${i === roomIndex ? 'depths-node-active' : ''} ${i < roomIndex ? 'depths-node-done' : ''}`}
              >
                <span className="depths-node-kind">{room.kind}</span>
                <strong>{room.label}</strong>
              </div>
            ))}
          </div>
          <div className="depths-room-card">
            <h3>{currentRoom.label}</h3>
            <p>{currentRoom.blurb}</p>
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
            {fighter.abilities.map(ab => (
              <button
                key={ab.id}
                type="button"
                className="art-btn depths-ability-btn"
                disabled={busy}
                onClick={() => void playerAttack(ab)}
              >
                <strong>{ab.name}</strong>
                <span>{ab.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'event' && currentRoom?.event && (
        <section className="depths-event">
          <h2>{currentRoom.label}</h2>
          <p>{currentRoom.blurb}</p>
          <div className="depths-event-choices">
            <button type="button" className="art-btn depths-ability-btn" onClick={() => resolveEvent('a')}>
              {currentRoom.event.a.label}
            </button>
            <button type="button" className="art-btn depths-ability-btn" onClick={() => resolveEvent('b')}>
              {currentRoom.event.b.label}
            </button>
          </div>
        </section>
      )}

      {phase === 'rest' && (
        <section className="depths-event">
          <h2>Frequency Camp</h2>
          <p>Restores HP and vibe. The hum of Bonk Hall still reaches this deep.</p>
          <button type="button" className="art-btn depths-enter-btn" onClick={doRest}>
            Rest & continue
          </button>
        </section>
      )}

      {phase === 'victory' && (
        <section className="depths-end depths-end-win">
          <h2>Depths cleared!</h2>
          <p>
            {fighter?.name} bonked the copycats. +{runChips} chips this run.
          </p>
          <button type="button" className="art-btn depths-enter-btn" onClick={resetToHub}>
            Return to Depths hub
          </button>
          <Link href="/cashier" className="art-btn depths-enter-btn inline-block mt-3">
            Cash out at {BRAND.cashier}
          </Link>
        </section>
      )}

      {phase === 'defeat' && (
        <section className="depths-end depths-end-lose">
          <h2>Bonked out</h2>
          <p>The Depths keep your chips from this run ({runChips}). Try another bloodline.</p>
          <button type="button" className="art-btn depths-enter-btn" onClick={resetToHub}>
            Back to hub
          </button>
        </section>
      )}

      <div className="depths-log" aria-live="polite">
        {log.map((line, i) => (
          <p key={`${i}-${line.slice(0, 12)}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}
