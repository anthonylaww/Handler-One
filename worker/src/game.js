// Pure rules engine for Handler One. No I/O — the Durable Object wraps this.
// All state lives in a plain serializable object so it survives restarts.

export const DEFAULT_COOLDOWN_MS = 90_000;
export const MAX_FOLDS = 3;
export const SHADOW_ZERO_WARNINGS = 4;

export const CODENAMES = [
  'Vesper', 'Le Chiffre', 'Solange', 'Mathis', 'Felix', 'Valenka',
  'Dimitrios', 'Obanno', 'Carlos', 'Mollaka', 'Dryden', 'Villiers',
  'Mendel', 'Kratt', 'Leo', 'Infante', 'Gallardo', 'Fukutu',
  'Stockman', 'Tremaine', 'Beaumont', 'Larousse', 'Cypher', 'Marchand',
  'Duval', 'Renard', 'Corbeau', 'Faucon', 'Loup', 'Vipere',
  'Baccarat', 'Croupier', 'Banco', 'Rouge', 'Noir', 'Zero',
  'Ace', 'Monarch', 'Tempest', 'Mirage', 'Nocturne', 'Solitaire',
  'Wraith', 'Havoc', 'Quill', 'Sable', 'Onyx', 'Ember',
];

export function newState() {
  return {
    missions: [],          // [{id, text}]
    cooldownMs: DEFAULT_COOLDOWN_MS,
    revealed: false,
    players: {},           // playerId -> player
  };
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// --- registration -----------------------------------------------------------

export function registerPlayer(state, alias, playerId, now, rng = Math.random) {
  alias = String(alias || '').trim();
  if (!alias || alias.length > 30) throw err('bad_alias', 'Give us a name, Agent.');
  const lower = alias.toLowerCase();
  for (const p of Object.values(state.players)) {
    if (p.alias.toLowerCase() === lower) throw err('duplicate_alias', 'That alias is already at the table.');
  }
  const used = new Set(Object.values(state.players).map((p) => p.codename));
  const free = CODENAMES.filter((c) => !used.has(c));
  const codename = free.length ? pick(rng, free) : `Agent ${Object.keys(state.players).length + 1}`;
  const player = {
    id: playerId,
    alias,
    codename,
    score: 0,
    warnings: 0,
    foldsUsed: 0,
    shadowZero: false,
    dealt: [],             // mission ids in deal order
    outcomes: {},          // missionId -> 'completed' | 'failed' | 'folded'
    recycled: [],          // mission ids already re-dealt as second chances
    current: null,         // {missionId, dealtAt}
  };
  state.players[playerId] = player;
  dealNext(state, player, now, rng);
  return player;
}

// --- dealing ----------------------------------------------------------------

export function dealNext(state, player, now, rng = Math.random) {
  if (state.revealed) { player.current = null; return; }
  const dealtSet = new Set(player.dealt);
  const fresh = state.missions.filter((m) => !dealtSet.has(m.id));
  let missionId = null;
  if (fresh.length) {
    missionId = pick(rng, fresh).id;
  } else {
    // Second chances: re-deal failed/folded missions in original deal order.
    const recycledSet = new Set(player.recycled);
    const candidate = player.dealt.find(
      (id) => (player.outcomes[id] === 'failed' || player.outcomes[id] === 'folded') && !recycledSet.has(id)
    );
    if (candidate !== undefined) {
      missionId = candidate;
      player.recycled.push(candidate);
    }
  }
  if (missionId === null) {
    player.current = null; // exhausted — the house has no more contracts
    return;
  }
  if (!dealtSet.has(missionId)) player.dealt.push(missionId);
  delete player.outcomes[missionId]; // recycled mission gets a clean slate
  player.current = { missionId, dealtAt: now };
}

// --- resolution -------------------------------------------------------------

// Returns {result: 'ok'|'warning'|'game_over'|'no_mission'|'fold_rejected'}
export function resolve(state, playerId, action, now, rng = Math.random) {
  const player = state.players[playerId];
  if (!player) throw err('unknown_player', 'Unknown agent.');
  if (state.revealed) return { result: 'game_over' };
  if (!player.current) return { result: 'no_mission' };
  const missionId = player.current.missionId;

  if (action === 'complete') {
    if (now - player.current.dealtAt < state.cooldownMs) {
      player.warnings += 1;
      if (player.warnings >= SHADOW_ZERO_WARNINGS && !player.shadowZero) {
        player.shadowZero = true;
        player.score = 0; // reset and frozen forever
      }
      return { result: 'warning' }; // same mission stays active
    }
    if (!player.shadowZero) player.score += 1;
    player.outcomes[missionId] = 'completed';
  } else if (action === 'failed') {
    player.outcomes[missionId] = 'failed';
  } else if (action === 'fold') {
    if (player.foldsUsed >= MAX_FOLDS) return { result: 'fold_rejected' };
    player.foldsUsed += 1;
    player.outcomes[missionId] = 'folded';
  } else {
    throw err('bad_action', 'Unknown action.');
  }
  dealNext(state, player, now, rng);
  return { result: 'ok' };
}

// --- admin ------------------------------------------------------------------

export function seedMissions(state, texts) {
  const clean = texts.map((t) => String(t).trim()).filter(Boolean);
  if (!clean.length) throw err('empty_bank', 'No missions supplied.');
  state.missions = clean.map((text, i) => ({ id: i, text }));
}

export function setCooldown(state, seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) throw err('bad_cooldown', 'Bad cooldown.');
  state.cooldownMs = Math.round(s * 1000);
}

export function setRevealed(state, on) {
  state.revealed = Boolean(on);
}

// Clears players and the reveal flag but keeps the mission bank and cooldown.
export function resetGame(state) {
  state.players = {};
  state.revealed = false;
}

// --- views (the ONLY things ever sent to non-host clients) ------------------

// What one player may know about themselves. Never contains scores,
// warning counts, shadow-zero status, codenames, or anyone else's data.
export function playerView(state, playerId) {
  const p = state.players[playerId];
  if (!p) return null;
  const view = {
    alias: p.alias,
    foldsRemaining: MAX_FOLDS - p.foldsUsed,
    revealed: state.revealed,
    mission: null,
    exhausted: false,
  };
  if (state.revealed) {
    view.leaderboard = finalLeaderboard(state);
  } else if (p.current) {
    const m = state.missions.find((mm) => mm.id === p.current.missionId);
    view.mission = m ? m.text : null;
  } else {
    view.exhausted = state.missions.length > 0;
  }
  return view;
}

// Pre-reveal lobby: shuffled codenames only. No scores, no order, no names.
export function lobbyView(state, rng = Math.random) {
  const names = Object.values(state.players).map((p) => p.codename);
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return { codenames: names, revealed: state.revealed };
}

// Post-reveal only: real names, scores, shared ranks; shadow-zeros at bottom.
export function finalLeaderboard(state) {
  const players = Object.values(state.players).slice().sort((a, b) => {
    if (a.shadowZero !== b.shadowZero) return a.shadowZero ? 1 : -1;
    return b.score - a.score;
  });
  const rows = [];
  let rank = 0, prevKey = null;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const key = `${p.shadowZero}|${p.score}`;
    if (key !== prevKey) { rank = i + 1; prevKey = key; }
    rows.push({ rank, alias: p.alias, codename: p.codename, score: p.shadowZero ? 0 : p.score });
  }
  return rows;
}

// Host-only dashboard.
export function adminView(state) {
  return {
    revealed: state.revealed,
    cooldownSeconds: state.cooldownMs / 1000,
    missionCount: state.missions.length,
    missions: state.missions.map((m) => m.text),
    players: Object.values(state.players).map((p) => ({
      alias: p.alias,
      codename: p.codename,
      score: p.score,
      warnings: p.warnings,
      shadowZero: p.shadowZero,
      foldsUsed: p.foldsUsed,
      onMission: Boolean(p.current),
    })),
  };
}
