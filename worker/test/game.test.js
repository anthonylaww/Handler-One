import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';

const T0 = 1_000_000;
const AFTER = T0 + 100_000; // past the 90s default cooldown

function setup(missionCount = 3) {
  const state = game.newState();
  game.seedMissions(state, Array.from({ length: missionCount }, (_, i) => `Mission ${i}`));
  return state;
}

// deterministic rng: always pick first option
const first = () => 0;

test('registration rejects duplicate aliases (case-insensitive)', () => {
  const state = setup();
  game.registerPlayer(state, 'Bond', 'p1', T0, first);
  assert.throws(() => game.registerPlayer(state, 'bond', 'p2', T0, first), /already at the table/);
});

test('registration deals a mission and assigns a codename silently', () => {
  const state = setup();
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  assert.ok(p.current);
  assert.ok(game.CODENAMES.includes(p.codename));
});

test('a mission is never re-dealt fresh to the same player', () => {
  const state = setup(3);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    seen.push(p.current.missionId);
    game.resolve(state, 'p1', 'complete', AFTER + i * 200_000, first);
  }
  assert.deepEqual([...new Set(seen)].length, 3);
  // all completed, none failed/folded → nothing to recycle → exhausted
  assert.equal(p.current, null);
  assert.equal(game.playerView(state, 'p1').exhausted, true);
});

test('recycling: failed/folded missions come back in original deal order, then exhaustion', () => {
  const state = setup(3);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  const order = [];
  let t = AFTER;
  // fail first, fold second, complete third
  order.push(p.current.missionId); game.resolve(state, 'p1', 'failed', t += 200_000, first);
  order.push(p.current.missionId); game.resolve(state, 'p1', 'fold', t += 200_000, first);
  order.push(p.current.missionId); game.resolve(state, 'p1', 'complete', t += 200_000, first);
  // recycled in original deal order: the failed one first, then the folded one
  assert.equal(p.current.missionId, order[0]);
  game.resolve(state, 'p1', 'complete', t += 200_000, first);
  assert.equal(p.current.missionId, order[1]);
  game.resolve(state, 'p1', 'failed', t += 200_000, first);
  // recycled missions only come back once
  assert.equal(p.current, null);
  assert.equal(p.score, 2);
});

test('fold limit: 3 folds allowed, 4th rejected and mission unchanged', () => {
  const state = setup(10);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  for (let i = 0; i < 3; i++) game.resolve(state, 'p1', 'fold', AFTER, first);
  const before = p.current.missionId;
  const r = game.resolve(state, 'p1', 'fold', AFTER, first);
  assert.equal(r.result, 'fold_rejected');
  assert.equal(p.current.missionId, before);
  assert.equal(game.playerView(state, 'p1').foldsRemaining, 0);
});

test('cooldown: early complete gives warning, no point, same mission stays', () => {
  const state = setup();
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  const before = p.current.missionId;
  const r = game.resolve(state, 'p1', 'complete', T0 + 1000, first);
  assert.equal(r.result, 'warning');
  assert.equal(p.score, 0);
  assert.equal(p.warnings, 1);
  assert.equal(p.current.missionId, before);
});

test('4th warning silently shadow-zeros: score reset to 0 and frozen, play continues', () => {
  const state = setup(10);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  let t = T0;
  // earn 2 legit points
  game.resolve(state, 'p1', 'complete', t += 100_000, first);
  game.resolve(state, 'p1', 'complete', t += 100_000, first);
  assert.equal(p.score, 2);
  // 4 early completes
  for (let i = 0; i < 4; i++) game.resolve(state, 'p1', 'complete', t + 1000, first);
  assert.equal(p.shadowZero, true);
  assert.equal(p.score, 0);
  // still playing normally: legit complete deals next but score stays frozen
  const r = game.resolve(state, 'p1', 'complete', t += 200_000, first);
  assert.equal(r.result, 'ok');
  assert.equal(p.score, 0);
  // and nothing about it is visible to the player
  const view = game.playerView(state, 'p1');
  assert.equal(JSON.stringify(view).toLowerCase().includes('shadow'), false);
});

test('cooldown is host-tunable', () => {
  const state = setup();
  game.setCooldown(state, 5);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  const r = game.resolve(state, 'p1', 'complete', T0 + 6000, first);
  assert.equal(r.result, 'ok');
  assert.equal(p.score, 1);
});

test('reveal freezes scoring and voids active missions; undo restores play', () => {
  const state = setup(10);
  const p = game.registerPlayer(state, 'Bond', 'p1', T0, first);
  game.setRevealed(state, true);
  const r = game.resolve(state, 'p1', 'complete', AFTER, first);
  assert.equal(r.result, 'game_over');
  assert.equal(p.score, 0);
  const view = game.playerView(state, 'p1');
  assert.equal(view.revealed, true);
  assert.ok(Array.isArray(view.leaderboard));
  // undo
  game.setRevealed(state, false);
  const view2 = game.playerView(state, 'p1');
  assert.equal(view2.revealed, false);
  assert.equal(view2.leaderboard, undefined);
  assert.equal(game.resolve(state, 'p1', 'complete', AFTER, first).result, 'ok');
});

test('final leaderboard: ties share rank, shadow-zeros at the bottom with 0', () => {
  const state = setup(10);
  game.registerPlayer(state, 'A', 'a', T0, first);
  game.registerPlayer(state, 'B', 'b', T0, first);
  game.registerPlayer(state, 'C', 'c', T0, first);
  game.registerPlayer(state, 'Cheat', 'x', T0, first);
  let t = T0;
  game.resolve(state, 'a', 'complete', t += 100_000, first);
  game.resolve(state, 'a', 'complete', t += 100_000, first);
  game.resolve(state, 'b', 'complete', t += 100_000, first);
  game.resolve(state, 'c', 'complete', t += 100_000, first);
  // x cheats into shadow-zero after earning a point
  game.resolve(state, 'x', 'complete', t += 100_000, first);
  for (let i = 0; i < 4; i++) game.resolve(state, 'x', 'complete', t + 1000, first);
  game.setRevealed(state, true);
  const lb = game.finalLeaderboard(state);
  assert.deepEqual(lb.map((r) => [r.alias, r.score, r.rank]), [
    ['A', 2, 1], ['B', 1, 2], ['C', 1, 2], ['Cheat', 0, 4],
  ]);
});

// --- THE leak test ----------------------------------------------------------

test('no player-facing view ever exposes scores, warnings, or others’ data before reveal', () => {
  const state = setup(10);
  game.registerPlayer(state, 'Alice', 'a', T0, first);
  const b = game.registerPlayer(state, 'BobUnique', 'b', T0, () => 0.9);
  let t = T0;
  game.resolve(state, 'a', 'complete', t += 100_000, first);
  game.resolve(state, 'a', 'complete', t + 500, first); // a warning too
  const bMission = state.missions.find((m) => m.id === b.current.missionId).text;

  const aView = JSON.stringify(game.playerView(state, 'a'));
  const forbiddenKeys = ['score', 'warning', 'shadow', 'codename'];
  for (const k of forbiddenKeys) {
    assert.equal(aView.toLowerCase().includes(k), false, `playerView leaks "${k}"`);
  }
  assert.equal(aView.includes('BobUnique'), false, 'playerView leaks another alias');
  assert.equal(aView.includes(bMission), false, "playerView leaks another player's mission");

  // lobby: shuffled codenames only — no aliases, scores, or ordering info
  const lobby = game.lobbyView(state);
  const lobbyStr = JSON.stringify(lobby);
  assert.equal(lobbyStr.includes('Alice'), false);
  assert.equal(lobbyStr.includes('BobUnique'), false);
  for (const k of ['score', 'warning', 'rank', 'mission']) {
    assert.equal(lobbyStr.toLowerCase().includes(k), false, `lobby leaks "${k}"`);
  }
  assert.equal(lobby.codenames.length, 2);

  // the only WebSocket message shape the server ever broadcasts
  const wsMsg = JSON.stringify({ type: 'reveal', revealed: true });
  for (const k of ['score', 'warning', 'shadow', 'alias', 'mission']) {
    assert.equal(wsMsg.toLowerCase().includes(k), false, `ws broadcast leaks "${k}"`);
  }
});

test('players cannot see any score before reveal, even their own', () => {
  const state = game.newState();
  game.seedMissions(state, ['Steal a coaster', 'Wink at a stranger']);
  game.registerPlayer(state, 'Bond', 'p1', T0, first);
  game.resolve(state, 'p1', 'complete', AFTER, first);
  const view = game.playerView(state, 'p1');
  assert.equal(/[0-9]/.test(JSON.stringify({ ...view, foldsRemaining: 'x' })), false,
    'no numeric fields besides the fold counter');
});
