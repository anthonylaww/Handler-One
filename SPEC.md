# Handler One — "Casino Royale" Party Mission Game

A mobile-first web game for a single party night (~40 guests). Each guest is a secret
agent who gets dealt real-life missions, performs them at the party, and reports back.
Scores are hidden all night, then revealed in one synchronized dramatic moment
controlled by the host.

---

## 1. Architecture

| Piece | Technology | Notes |
|---|---|---|
| Frontend | Plain HTML/CSS/JS, static | Hosted on **GitHub Pages**. No framework, no build step. |
| Backend | **One Cloudflare Worker + one Durable Object** | The entire game brain and state. Free tier only — no payment details anywhere. |
| Realtime | WebSockets (Durable Object hibernation API) | Pushes state changes (esp. the reveal) to every connected phone instantly. |
| State storage | Durable Object built-in storage (SQLite/KV) | Whole game state is kilobytes; must survive Worker restarts. |

**There is no Firebase and no other service.** Two accounts total: GitHub, Cloudflare.

### Secrecy requirements (hard constraints)
- **Zero missions in the GitHub repo**, ever. The repo contains only the app shell.
- Mission dealing happens **server-side** in the Worker/DO. A phone only ever
  receives missions actually dealt to it, one at a time. There is no client-readable
  bank to enumerate.
- All rules enforcement (scoring, cooldown, warnings, shadow-zero) is **server-side**.
  Clients never write scores; dev tools cannot fake a Complete.
- Host authentication: a **host passphrase stored as a Cloudflare Worker secret**,
  checked server-side. Never in the repo or client code.

## 2. Player identity & resilience

- On first visit, player registers a **name/alias**. Duplicate aliases are rejected.
- A random player ID is generated and stored in **localStorage** (device-tied).
- Refresh, dropped connection, or reopening the site **silently resumes** the session:
  same mission, same folds remaining, same warning count. No login screen ever again.
- Switching devices or clearing the browser = new player (accepted trade-off).

## 3. Gameplay loop

1. Register alias → dealt a mission from the bank.
2. Player performs the mission in real life.
3. Player returns and presses one of three thumb-friendly buttons:
   - **Complete** → +1 point (themed as chips, e.g. "+100 chips" — cosmetic only).
   - **Failed** (got caught) → 0 points.
   - **Fold** (skip) → no consequence. **3 folds per night**, counter visible.
4. Any resolution deals the next mission automatically.

### Mission dealing rules
- Never re-deal a mission the player has already been assigned (per-player uniqueness).
- Two different players **may** hold the same mission simultaneously.
- When a player exhausts all fresh missions: re-deal only their **failed/folded** ones
  (second chances). When those are gone too: themed end state
  ("The house has no more contracts for you tonight").

## 4. Honour system (anti-spam)

- Each mission has a **cooldown**: minimum elapsed time from deal to a valid Complete.
  Default **90 seconds**, host-tunable from the admin page.
- Complete pressed before cooldown expires → **no point**, themed honour warning
  ("The house is watching, Agent"), and the **same mission stays active**.
- On the **4th warning**: **silent shadow-zero** — score reset to 0 and permanently
  frozen. The player keeps receiving missions and playing normally, with no
  indication anything changed. Their state is exposed only at the reveal.

## 5. Scores & leaderboard

- **Players can never see any score through the interface** — not their own, not others'.
- Each player is auto-assigned an anonymous **Casino-Royale codename**
  (Vesper, Le Chiffre, Solange, …). Players never pick them and are not told which is theirs.
- **Pre-reveal leaderboard** (accessible to all players): atmosphere only — a
  **shuffled list of codenames**, no scores, no ranking, no order. Just proof the
  table is live.

### The reveal
- Host flips the reveal switch on the admin page. This **ends the game**:
  - Scoring stops permanently; active missions are void.
  - Every connected phone **live-flips in unison** (WebSocket push) to the full
    leaderboard: **real names, scores, ranks**. Shadow-zeroed cheaters appear at
    the bottom with 0.
  - Ties share a rank.
- An **undo toggle** exists on the admin page for accidental flips.

## 6. Admin (host) page

- Unlinked route, authenticated by host passphrase (checked server-side, see §1).
- Capabilities:
  - **Seed the mission bank**: paste the mission list (JSON or line-per-mission)
    once before the party. Stored server-side only.
  - **Cooldown setting** (default 90s).
  - **Live dashboard**: real names, codenames, scores, warning counts, folds used —
    visible only to the host, live-updating.
  - **Reveal switch** (with undo).

## 7. Scale & content guidance

- ~40 players expected. Firmly within all free-tier limits.
- Mission bank target: **40–50 missions**.
- Missions should avoid targeting one specific person (40 agents mobbing the
  same victim); word them generically ("a stranger", "someone wearing…").

## 8. UI/UX

- **Mobile-first is the priority.** Design for one-handed phone use at a party:
  large tap targets, high contrast in dim lighting, minimal reading.
- **Casino Royale theme throughout**: dark felt greens/blacks, gold accents,
  playing-card and casino-chip motifs, spy-flavoured copy
  ("Your mission, should you accept it…", "The house is watching").
- Screens: Register → Mission (with Complete / Failed / Fold) → Leaderboard tab →
  (on reveal) Final standings. Plus the separate admin page.
- Themed micro-moments matter: dealing a mission should feel like being dealt a card.
