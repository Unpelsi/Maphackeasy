// Vercel Serverless Function: combined radar API
// POST /api/radar → DLL pushes game state
// GET  /api/radar → browser polls game state

// Module-level state persists across warm invocations
let latestState = null;
let lastUpdate = 0;

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Vercel auto-parses JSON body into req.body
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: 'empty body' });
    }

    if (!data.localPlayer || !Array.isArray(data.players)) {
      return res.status(400).json({ error: 'invalid format' });
    }

    latestState = data;
    lastUpdate = Date.now();
    return res.status(200).json({ ok: true, ts: lastUpdate });
  }

  // GET — browser polls state
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
};
