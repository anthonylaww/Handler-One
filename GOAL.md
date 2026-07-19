# Prompt for /goal

Implement the party mission game specified in SPEC.md, in this repository, end to end.

SPEC.md is the single source of truth — every rule in it is a hard requirement, especially the hard constraints in §1 (no missions or secrets ever committed to the repo; all game rules enforced server-side; host passphrase as a Cloudflare Worker secret).

Deliverables:

1. **Static frontend** in the repo root (or `/docs`), deployable to GitHub Pages as-is: plain HTML/CSS/JS, no build step. Mobile-first Casino Royale UI per SPEC §8, with the register, mission (Complete / Failed / Fold), leaderboard, and reveal screens, plus the unlinked admin page (§6). The backend URL must be a single config constant.
2. **Cloudflare Worker + Durable Object** in a `/worker` directory with `wrangler.toml`, implementing the full game brain: registration with duplicate-alias rejection, device-ID sessions (§2), server-side mission dealing and recycling (§3), the cooldown/warning/shadow-zero honour system (§4), hidden scoring and codenames (§5), admin endpoints (§6), and WebSocket push so the reveal flips every connected phone in unison (§5). State must survive Worker restarts.
3. **Tests** for the rules engine — at minimum: per-player no-repeat dealing, recycling order, fold limits, cooldown warnings escalating to a silent shadow-zero on the 4th warning, score freezing, reveal/undo semantics, and that no player-facing endpoint or WebSocket message ever exposes a score, warning count, or another player's mission before reveal (this leak check is the most important test).
4. **README.md** with exact one-time setup steps for a non-expert: create the Cloudflare Worker, set the host passphrase secret, deploy with wrangler, set the backend URL constant, enable GitHub Pages, seed missions via the admin page, and a 5-line "night of the party" runbook.

Definition of done: a fresh checkout following only the README produces a working game; all tests pass; `git grep` for any mission text or passphrase in the repo returns nothing; simulating two players through register → deal → complete/fail/fold → reveal against a locally running Worker (`wrangler dev`) behaves exactly per SPEC.

Do not add features beyond SPEC.md. Where SPEC.md is silent on a detail, choose the simplest option consistent with its constraints and note the choice in the README.
