// Vercel Serverless Function: Radar API with Upstash Redis
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state

const STATE_KEY = 'radar:latest';
const STATE_TTL = 5;

let redis = null;
let redisOk = false;

function getRedis() {
  if (redisOk) return redis;
  if (redis) return redis;
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

// Vercel serverless functions don't always auto-parse req.body
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

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
    const data = await readBody(req);
    if (!data) {
      res.status(400).json({ error: 'empty body' });
      return;
    }

    const now = Date.now();
    const payload = { ...data, _ts: now };
    const r = getRedis();

    if (r) {
      try {
        await r.set(STATE_KEY, payload, { ex: STATE_TTL });
        res.status(200).json({ ok: true, ts: now, storage: 'redis' });
        return;
      } catch (e) {
        console.error('Redis write failed:', e.message);
      }
    }

    latestState = payload;
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
        const age = Date.now() - (stored._ts || 0);
        res.status(200).json({ ...stored, _age: age });
        return;
      }
    } catch (e) {
      console.error('Redis read failed:', e.message);
    }
  }

  if (latestState) {
    const age = Date.now() - lastUpdate;
    res.status(200).json({ ...latestState, _age: age });
    return;
  }

  res.status(200).json({ error: 'no data yet', localPlayer: null, players: [], bomb: { found: false }, _age: 0 });
};
