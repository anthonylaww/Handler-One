# Handler One

A one-night "Casino Royale" party mission game. See `SPEC.md` for the full rules.

- **Frontend**: static files in `/docs`, hosted on GitHub Pages. No build step.
- **Backend**: one Cloudflare Worker + one Durable Object in `/worker`. All game
  rules, missions, and scores live server-side only.

**This repo contains no missions and no passphrase — ever.** Missions are pasted
into the admin page at party time; the passphrase is a Cloudflare Worker secret.

---

## One-time setup

You need: a free [Cloudflare](https://dash.cloudflare.com/sign-up) account, a
[GitHub](https://github.com) account, and [Node.js](https://nodejs.org) installed.

### 1. Deploy the Worker

```bash
cd worker
npx wrangler login          # opens a browser; log in to Cloudflare
npx wrangler deploy         # creates the "handler-one" Worker + Durable Object
```

The deploy prints your Worker URL, something like
`https://handler-one.yourname.workers.dev`. Copy it.

### 2. Set the host passphrase (the only secret)

```bash
npx wrangler secret put HOST_PASSPHRASE
```

Type your chosen passphrase when prompted. It is stored encrypted in Cloudflare,
never in this repo.

### 3. Point the frontend at your Worker

Edit **`docs/config.js`** — one line — and set `BACKEND_URL` to your Worker URL
(no trailing slash). Commit and push.

### 4. Enable GitHub Pages

On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main`,
folder `/docs` → Save.** After a minute your game is at
`https://<username>.github.io/<repo>/`.

### 5. Seed the missions (before the party)

Open `https://<username>.github.io/<repo>/admin.html` (this page is not linked
anywhere — only you know it exists). Enter your passphrase, paste your mission
list (one per line, 40–50 recommended), and press **Seed missions**. Set the
cooldown if you want something other than 90 seconds.

## Night of the party — runbook

1. Share the player URL (`…github.io/<repo>/`) — QR code on the door works well.
2. Guests register an alias and start receiving missions. Nothing else to do.
3. Keep `admin.html` open on your phone for the live table (scores, warnings, cheats).
4. At the chosen moment, press **Flip the reveal** — every phone flips to the
   final standings at once.
5. Pressed it too early? **Undo reveal** puts the game back exactly as it was.

## Tests

```bash
cd worker && npm test
```

## Local development

```bash
cd worker
echo 'HOST_PASSPHRASE=whatever' > .dev.vars   # git-ignored
npx wrangler dev                              # backend at http://localhost:8787
```

`docs/config.js` defaults to `http://localhost:8787`, so opening `docs/index.html`
in a browser plays against the local Worker.

## Choices where SPEC.md is silent

- Missions are dealt **randomly** from the fresh pool; recycled (failed/folded)
  missions return in their **original deal order**, once each.
- A cooldown warning does **not** restart the cooldown clock; the timer still
  runs from the original deal.
- Warnings are counted across the whole night (not per mission).
- Re-seeding the mission bank replaces it entirely (mission ids are positional),
  so seed once before the party, not mid-game.
- Registration is closed until missions are seeded and after the reveal.
- The pre-reveal fold counter is the only number a player ever sees.
- Admin live dashboard updates by polling every 3 s; the reveal itself is pushed
  over WebSockets (with a 10 s polling fallback on player phones).
- "Chips" are cosmetic: 1 point is displayed as 100 chips on the final board.
