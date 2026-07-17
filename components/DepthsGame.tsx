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
import { useBonkBank } from '@/hooks/useBonkBank';

type Phase = 'hub' | 'map' | 'fight' | 'event' | 'rest' | 'victory' | 'defeat';

export default function DepthsGame() {
  const { addChips, chips } = useBonkBank();
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

  const pushLog = useCallback((line: string) => {
    setLog(prev => [...prev.slice(-40), line]);
  }, []);

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
      pushLog(`${room.enemy.name} appears!`);
      pushLog(room.enemy.taunt);
      setPhase('fight');
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
    pushLog(
      `${ability.name} deals ${dmg}${crit ? ' CRIT' : ''} to ${enemy.name}!`,
    );
    if (enemy.hitReaction.length) {
      pushLog(enemy.hitReaction[Math.floor(Math.random() * enemy.hitReaction.length)]);
    }

    if (nextEnemyHP <= 0) {
      pushLog(enemy.defeatLine);
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
      setBusy(false);
      return;
    }

    // Enemy turn
    await new Promise(r => setTimeout(r, 450));
    const abilityRes = resolveEnemyAbility(enemy, {
      playerHP: hp,
      playerMaxHP: fighter.hp,
      enemyHP: nextEnemyHP,
      enemyMaxHP: enemy.hp,
      blockActive: blockNext || Boolean(ability.blockNextHit),
    });

    pushLog(getEnemyAttackShout(enemy));
    if (abilityRes.flavor) pushLog(abilityRes.flavor);
    else pushLog(enemy.counterAttack);

    let blocked = blockNext || Boolean(ability.blockNextHit);
    if (abilityRes.ignoreBlock) blocked = false;
    setBlockNext(false);

    let counter = calcCounterDamage(enemy.counterDmg, fighter.defense);
    counter = Math.round(counter * abilityRes.counterMult + abilityRes.flatBonusDamage);
    if (blocked) {
      counter = Math.max(1, Math.round(counter * 0.25));
      pushLog('Block softens the blow!');
    }

    if (abilityRes.vibeDrain > 0) {
      setPlayerVibe(v => Math.max(0, v - abilityRes.vibeDrain));
      pushLog(`Vibe drained by ${abilityRes.vibeDrain}!`);
    }
    if (abilityRes.enemyHealPercent > 0) {
      const heal = Math.round(enemy.hp * abilityRes.enemyHealPercent);
      setEnemyHP(e => Math.min(enemy.hp, e + heal));
      pushLog(`${enemy.name} recovers ${heal} HP!`);
    }

    const after = Math.max(0, hp - counter);
    setPlayerHP(after);
    pushLog(`${enemy.name} hits for ${counter}!`);

    if (after <= 0) {
      pushLog(`${fighter.name} is bonked out in the Depths...`);
      setPhase('defeat');
    }

    setBusy(false);
  };

  const resetToHub = () => {
    setPhase('hub');
    setFighter(null);
    setEnemy(null);
    setLog([]);
    setRooms([]);
    setRoomIndex(0);
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
            <span className="depths-chip-pill">{chips.toLocaleString()} chips</span>
          </div>
          <h1 className="depths-title">{DEPTHS_LORE.title}</h1>
          <p className="depths-sub">{DEPTHS_LORE.subtitle}</p>
          <p className="depths-intro">{DEPTHS_LORE.intro}</p>
          <p className="depths-hint">
            Choose a bloodline. Clear six chambers of rival meme mascots. Earn Bonk Chips for the cashier.
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
          <div className="depths-fight-row">
            <div className="depths-fighter-panel">
              <Image src={fighter.img} alt={fighter.name} width={140} height={140} unoptimized />
              <div className="depths-bar">
                <div
                  className="depths-bar-fill depths-bar-hp"
                  style={{ width: `${(playerHP / fighter.hp) * 100}%` }}
                />
              </div>
              <span>
                {playerHP}/{fighter.hp} HP
              </span>
            </div>
            <div className="depths-vs">VS</div>
            <div className="depths-enemy-panel">
              <Image src={enemy.img} alt={enemy.name} width={140} height={140} unoptimized />
              <p className="depths-enemy-name">{enemy.name}</p>
              <p className="depths-enemy-title">{enemy.title}</p>
              <div className="depths-bar">
                <div
                  className="depths-bar-fill depths-bar-enemy"
                  style={{ width: `${(enemyHP / enemy.hp) * 100}%` }}
                />
              </div>
              <span>
                {enemyHP}/{enemy.hp} Cope HP
              </span>
            </div>
          </div>
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
