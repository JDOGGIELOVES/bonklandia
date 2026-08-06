# Carnival Wheel — Security & Architecture

## Product summary

- **Entry:** $0.25 equivalent in $BONGA (`7YoAymCyauHAXus3snMEKcLgRx546MrHuBW3EuUNKKQs`) to the Bonklandia treasury.
- **Play:** 63-space wheel + d6 family coin.
- **Prizes:** Micro-USD tiers, credited as **spendable chips** on the server ledger.
- **Token exit:** **Cashier only** (`POST /api/exchange`). The wheel never transfers SPL prizes to players.

## What shipped (Phase 1 — production-ready on current stack)

| Layer | Implementation |
|-------|----------------|
| Entry payment | SPL `transferChecked` BONGA → treasury ATA; verified server-side |
| Accounting 55/30/15 | Recorded on session open (treasury receives full amount; split is transparent accounting until program deploy) |
| Randomness | Server HMAC **commit-reveal** (`lib/security/carnival-session.ts`) |
| Outcome authority | Server only — client wheel/dice indices ignored |
| Prize credit | `creditWalletChips` + earn caps (`carnival-wheel`) |
| Token exit | Existing Cashier — no new outbound transfer code paths |

### Commit-reveal verification

1. On `start`, server stores `serverSeed` inside the sealed session token and returns `commit = HMAC(secret, "carnival-commit:"+seed)`.
2. On `spin`, server computes:
   - `digest = HMAC-SHA256(serverSeed, "carnival-outcome:"+sessionId)`
   - `wheelIndex = u32(digest[0..4]) % 63`
   - `diceFace = (digest[4] % 6) + 1`
3. Response reveals `serverSeed` so anyone can recompute and match the outcome.

This is **not** Switchboard/Orao VRF. It is cryptographically bound to the server secret (same trust model as casino sessions). Clients cannot precompute outcomes without the seed; after reveal, outcomes are auditable.

### Cashier-only exit

- Wheel routes **never** call `executeTokenExchange` or build SPL transfers to users.
- Prize chips are spendable ledger balance only.
- User must open `/cashier` and exchange for BONK/BONGA/BONG/BINK/BONNIE/BENG under existing micro-prize limits.

## Phase 2 — Full on-chain program (roadmap)

To meet a formal audit bar for on-chain 55/30/15 + VRF:

1. **Anchor program** `carnival_wheel`
   - PDAs: `config`, `prize_pool`, `ops_vault` (or multi-sig destinations)
   - CPI: `transfer_checked` split 55/30/15 in **one** instruction
   - Instruction `spin` consumes Switchboard/Orao VRF proof
2. **Oracles:** Pyth/Switchboard price feeds for BONGA + family coins with staleness checks
3. **Prize settlement:** credit an on-chain “chip receipt” PDA **or** keep server ledger but require program event + signer attestation
4. **Cashier adapter:** only Cashier program/authority may move family mints out of platform vaults
5. **Admin:** multi-sig pause, timelock parameter changes

Until Phase 2 deploys, treat Phase 1 as **micro-prize carnival** with server fairness + Cashier bottleneck (same posture as Bandit/Alice).

## API

| Route | Role |
|-------|------|
| `GET /api/carnival/quote` | BONGA entry amount, tiers, spaces |
| `POST /api/carnival/start` | Verify BONGA payment → sealed session + commit |
| `POST /api/carnival/spin` | Reveal outcome, credit chips |

## Frontend

- `/carnival` — wheel + dice animations (cosmetic)
- Nav: home realm paths + top plaques

## Threat model notes

| Risk | Mitigation |
|------|------------|
| Spoofed outcome | Server recalculates; client fields ignored |
| Double claim | Signature store + session `claimed` |
| Fake entry | On-chain BONGA balance delta verification |
| Drain via chips | Earn caps, Cashier USD/chip limits, emergency stop |
| Direct SPL prize | No code path exists |

## Audit checklist (Phase 1)

- [x] No wheel → user SPL transfer
- [x] Entry payment verified on-chain
- [x] Session HMAC integrity
- [x] One claim per payment signature
- [x] Earn source cap for carnival
- [x] Emergency stop honored
- [ ] On-chain 55/30/15 PDAs (Phase 2)
- [ ] External VRF (Phase 2)
