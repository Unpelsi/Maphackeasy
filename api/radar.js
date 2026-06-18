// Vercel Serverless Function: Radar API with Vercel KV
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state
//
// Requires Vercel KV: run `vercel kv create` or add in dashboard
// Then link: vercel env add KV_REST_API_URL / KV_REST_API_TOKEN

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// In-memory fallback (resets on cold start / instance change)
let latestState = null;
let lastUpdate = 0;

const STATE_KEY = 'radar:latest';
const STATE_TTL = 3; // seconds — auto-expire so old data doesn't linger

let _kvInit = null;
function _ensureKv() {
  if (_kvInit) return _kvInit;
  _kvInit = (async () => {
    try {
      const { kv } = require('@vercel/kv');
      return { kv, ok: true };
    } catch {
      return { ok: false };
    }
  })();
  return _kvInit;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Parse body — Vercel may or may not auto-parse JSON
    let data = req.body;
    if (!data || typeof data === 'string') {
      try {
        data = JSON.parse(typeof data === 'string' ? data : '{}');
      } catch {
        return res.status(400).json({ error: 'invalid JSON' });
      }
    }
    if (!data || !data.localPlayer) {
      return res.status(400).json({ error: 'missing localPlayer' });
    }

    // Normalize field names (accept both yaw/angle, hp/health)
    const lp = data.localPlayer;
    if (lp.angle !== undefined && lp.yaw === undefined) lp.yaw = lp.angle;
    if (lp.health !== undefined && lp.hp === undefined) lp.hp = lp.health;
    if (data.players) {
      data.players = data.players.map(p => {
        if (p.angle !== undefined && p.yaw === undefined) p.yaw = p.angle;
        if (p.health !== undefined && p.hp === undefined) p.hp = p.health;
        return p;
      });
    }

    const now = Date.now();

    // Try KV first, fall back to in-memory
    const kvCtx = await _ensureKv();
    if (kvCtx.ok) {
      try {
        await kvCtx.kv.set(STATE_KEY, { ...data, _ts: now }, { ex: STATE_TTL });
        return res.status(200).json({ ok: true, ts: now, storage: 'kv' });
      } catch (e) {
        console.error('KV write failed:', e.message);
      }
    }

    latestState = data;
    lastUpdate = now;
    return res.status(200).json({ ok: true, ts: now, storage: 'memory' });
  }

  if (req.method === 'GET') {
    let state = null;
    let age = 0;

    // Try KV first
    const kvCtx = await _ensureKv();
    if (kvCtx.ok) {
      try {
        const stored = await kvCtx.kv.get(STATE_KEY);
        if (stored) {
          state = stored;
          age = Date.now() - (stored._ts || 0);
        }
      } catch (e) {
        console.error('KV read failed:', e.message);
      }
    }

    // Fall back to in-memory if KV didn't return data
    if (!state && latestState) {
      state = { ...latestState, _ts: lastUpdate };
      age = Date.now() - lastUpdate;
    }

    if (!state) {
      return res.status(200).json({
        error: 'no data yet — waiting for DLL to send game state',
        localPlayer: null,
        players: [],
        bomb: { found: false }
      });
    }

    return res.status(200).json({
      ...state,
      _serverTs: state._ts || lastUpdate,
      _age: age
    });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
