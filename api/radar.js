// Vercel Serverless Function: combined radar API
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state

let latestState = null;
let lastUpdate = 0;

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: 'empty body' });
    }

    // Accept any JSON from DLL
    latestState = data;
    lastUpdate = Date.now();
    return res.status(200).json({ ok: true, ts: lastUpdate });
  }

  if (req.method === 'GET') {
    if (!latestState) {
      return res.status(200).json({
        error: 'no data yet',
        localPlayer: null,
        players: [],
        bomb: { found: false }
      });
    }

    return res.status(200).json({
      ...latestState,
      _serverTs: lastUpdate,
      _age: Date.now() - lastUpdate
    });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
