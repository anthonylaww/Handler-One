# Design — "Le Cercle Privé"

Distilled from the full think-tank direction (Casino Royale redesign, 2026-07).
Single dark theme ("Salle Privée") — the app lives one night, at a party, in the dark.

## Color tokens (contrast verified vs. use)

| Token | Name | Hex | Role |
|---|---|---|---|
| `--bg-void` | Vault Black | `#0A0B0D` | page field |
| `--bg-raised` | Ledger Charcoal | `#14151A` | tab bar, admin groups, table header |
| `--bg-paper` | Baize Ink | `#0E1712` | certificate card "paper" |
| `--bg-fill` | Iris Char | `#191C22` | input fills, zebra rows |
| `--green` | Cercle Green | `#0E5C3F` | interactive fills (primary button) |
| `--green-hover` | Struck Felt | `#147A53` | hover/active green |
| `--gold` | Champagne Gold | `#C9A96A` | structure: hairlines, indices, icons (8.8:1 on void, AAA — restricted by hierarchy, not contrast) |
| `--gold-bright` | Struck Gold | `#E8CF9C` | foil peak |
| `--gold-deep` | Antique Brass | `#8C6B32` | foil low stop |
| `--red` | Bordeaux | `#8E1B2B` | destructive fills only |
| `--red-legible` | Flare | `#E0596A` | the only red at body size (5.6:1 ✓) |
| `--ink` | Ivory Stock | `#F3EEE4` | primary text (16.9:1 void ✓ AAA) |
| `--ink-2` | Old Silver | `#B9B4A8` | secondary text, metadata on raised (8.1:1 ✓ AAA) |
| `--line` | Gilt Line | gold @ 22% | engraved rules |

Gold foil gradient (never flat gold fills):
`linear-gradient(112deg, #8C6B32, #C9A96A 42%, #E8CF9C 55%, #C9A96A 68%, #8C6B32)`

Rules: green = interactive, never a passive tint. Red = danger only; error text is
Flare + never color alone. Gold appears only as: hairlines/rules, corner indices on
the certificate card, the active-tab dot, fold-chip icons. Focus ring is ivory.

## Typography

- **Display** — Cormorant Garamond 500/600, ALL CAPS, `letter-spacing: .14em`,
  framed by a double gilt rule. Ceiling 2.2rem (mobile app; never shouts).
- **Body/UI** — Libre Franklin 400/500/600 (Franklin Gothic revival, 1912 —
  period-correct for the 1932 world; swapped from Inter in the v3.9.1 polish
  pass). All data, labels, buttons. `"tnum"` requested on scores and counters.
- **Stamp micro** — Libre Franklin 600 uppercase 11px `letter-spacing: .18em` for card
  labels ("CONTRACT"), serials, footer stamps.
- Loaded via Google Fonts (`display=swap`); no build step in this repo.

## Components

- **Certificate card** (`.card`) — the signature container, used only for discrete
  instruments (the mission, house notices). Baize Ink paper, 6px radius, 1px gilt
  hairline, guilloché rosette watermark ≤6% (inline SVG data-URI, static), gold
  suit-glyph corner indices (here and nowhere else).
- **Buttons** — 56px min. Primary = Cercle Green lacquer + 1px inner top highlight,
  ivory label. Secondary = ghost + gilt hairline, ivory label. Danger = ghost +
  Bordeaux hairline, Flare label. Press = 1px translate-down.
- **Tab bar** — Ledger Charcoal brass rail, 1px gilt top rule; active plate marked
  by a single struck-gold dot, not a fill.
- **Tables** — flat, hairline-separated; single 1px gold rule under the header;
  Inter small-caps column heads; numerics right-aligned tabular.
- **Admin groups** — flat sections under a labeled double gilt rule, not boxes.

## Motion — "The Registrar's Hand"

150–320ms, `cubic-bezier(0.22, 1, 0.36, 1)`, no bounce, nothing loops.
- Card deal (`.dealt`): 320ms slide-up + 0.5° settle — dealt, not animated.
- Screen change: 200ms fade-up.
- Foil sheen: one 600ms sweep on primary-CTA hover/focus, never auto.
- `prefers-reduced-motion`: everything becomes an instant/crossfade; content is
  always visible by default.

## Bans

No side-stripe borders, gradient text, glassmorphism, looping animation,
backdrop-filter, box drop-shadow stacks >2, gold outside the allowlist above.
