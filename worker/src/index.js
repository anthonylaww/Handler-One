// Handler One — Cloudflare Worker + Durable Object game brain.
import * as game from './game.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Host-Passphrase',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
    const id = env.GAME.idFromName('the-one-table');
    return env.GAME.get(id).fetch(request);
  },
};

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get('state')) || game.newState();
    });
  }

  async save() {
    await this.ctx.storage.put('state', this.state);
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch {}
    }
  }

  isHost(request) {
    const pass = request.headers.get('X-Host-Passphrase');
    return Boolean(pass) && pass === this.env.HOST_PASSPHRASE;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      // --- WebSocket: push channel only; never carries hidden data ---------
      if (path === '/api/ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 400);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }

      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

      // --- player endpoints -------------------------------------------------
      if (path === '/api/register' && request.method === 'POST') {
        if (!this.state.missions.length) return json({ error: 'The table is not open yet. Find the host.' }, 409);
        if (this.state.revealed) return json({ error: 'The game is over.' }, 409);
        const playerId = crypto.randomUUID();
        game.registerPlayer(this.state, body.alias, playerId, Date.now());
        await this.save();
        return json({ playerId, view: game.playerView(this.state, playerId) });
      }

      if (path === '/api/state') {
        const view = game.playerView(this.state, url.searchParams.get('playerId'));
        if (!view) return json({ error: 'unknown_player' }, 404);
        return json({ view });
      }

      if (path === '/api/action' && request.method === 'POST') {
        const { playerId, action } = body;
        if (!this.state.players[playerId]) return json({ error: 'unknown_player' }, 404);
        const { result } = game.resolve(this.state, playerId, action, Date.now());
        await this.save();
        return json({ result, view: game.playerView(this.state, playerId) });
      }

      if (path === '/api/lobby') {
        return json(game.lobbyView(this.state));
      }

      // --- host endpoints ---------------------------------------------------
      if (path.startsWith('/api/admin/')) {
        if (!this.isHost(request)) return json({ error: 'bad_passphrase' }, 401);
        if (path === '/api/admin/login') return json({ ok: true });
        if (path === '/api/admin/missions' && request.method === 'POST') {
          game.seedMissions(this.state, body.missions || []);
          await this.save();
          return json({ ok: true, count: this.state.missions.length });
        }
        if (path === '/api/admin/cooldown' && request.method === 'POST') {
          game.setCooldown(this.state, body.seconds);
          await this.save();
          return json({ ok: true });
        }
        if (path === '/api/admin/dashboard') {
          return json(game.adminView(this.state));
        }
        if (path === '/api/admin/reveal' && request.method === 'POST') {
          game.setRevealed(this.state, body.on);
          await this.save();
          // Push the flip (or undo) to every connected phone at once.
          this.broadcast({ type: 'reveal', revealed: this.state.revealed });
          return json({ ok: true, revealed: this.state.revealed });
        }
      }

      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: e.code || 'error', message: e.message }, 400);
    }
  }

  async webSocketMessage(ws, msg) {
    if (msg === 'ping') ws.send('pong');
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch {}
  }
}
