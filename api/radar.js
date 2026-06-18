// Vercel Serverless Function: combined radar API
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state

let latestState = null;
let lastUpdate = 0;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const data = req.body;
    if (!data) {
      res.status(400).json({ error: 'empty body' });
      return;
    }
    latestState = data;
    lastUpdate = Date.now();
    res.status(200).json({ ok: true, ts: lastUpdate });
    return;
  }

  // GET
  if (!latestState) {
    res.status(200).json({ error: 'no data yet', localPlayer: null, players: [], bomb: { found: false } });
    return;
  }

  res.status(200).json({ ...latestState, _age: Date.now() - lastUpdate });
};
