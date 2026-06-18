// Vercel Serverless Function: Radar API with Upstash Redis
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state

const STATE_KEY = 'radar:latest';
const STATE_TTL = 3; // seconds

let redis = null;
let redisOk = false;

// Init Redis — Upstash env vars are auto-injected by Vercel integration
function getRedis() {
  if (redisOk) return redis;
  if (redis) return redis; // still trying

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (url && token) {
      const { Redis } = require('@upstash/redis');
      redis = new Redis({ url, token });
      redisOk = true;
      console.log('Upstash Redis connected');
      return redis;
    }
  } catch (e) {
    console.warn('Redis init failed:', e.message);
    redisOk = false;
    redis = null;
  }
  return null;
}

// In-memory fallback
let latestState = null;
let lastUpdate = 0;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (!data) {
      res.status(400).json({ error: 'empty body' });
      return;
    }
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {
        res.status(400).json({ error: 'invalid JSON' });
        return;
      }
    }

    const now = Date.now();
    const r = getRedis();

    if (r) {
      try {
        await r.set(STATE_KEY, data, { ex: STATE_TTL });
        res.status(200).json({ ok: true, ts: now, storage: 'redis' });
        return;
      } catch (e) {
        console.error('Redis write failed:', e.message);
      }
    }

    // Fallback to in-memory
    latestState = data;
    lastUpdate = now;
    res.status(200).json({ ok: true, ts: now, storage: 'memory' });
    return;
  }

  // GET
  const r = getRedis();

  if (r) {
    try {
      const stored = await r.get(STATE_KEY);
      if (stored) {
        res.status(200).json({ ...stored, _age: Date.now() - (stored._ts || 0) });
        return;
      }
    } catch (e) {
      console.error('Redis read failed:', e.message);
    }
  }

  // Fallback in-memory
  if (latestState) {
    res.status(200).json({ ...latestState, _age: Date.now() - lastUpdate });
    return;
  }

  res.status(200).json({ error: 'no data yet', localPlayer: null, players: [], bomb: { found: false } });
};
