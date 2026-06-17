// Vercel Serverless Function: combined radar API
// POST /api/radar  → DLL pushes game state
// GET  /api/radar  → browser polls game state
// GET  /           → serves radar HTML page (if routed to this)

// Module-level state persists across warm invocations
let latestState = null;
let lastUpdate = 0;

module.exports = async (req, res) => {
  // CORS for cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // --- DLL pushes game state ---
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    if (!body) {
      return res.status(400).json({ error: 'empty body' });
    }

    try {
      const data = JSON.parse(body);
      if (!data.localPlayer || !Array.isArray(data.players)) {
        return res.status(400).json({ error: 'invalid format: need localPlayer + players[]' });
      }
      latestState = data;
      lastUpdate = Date.now();
      return res.status(200).json({ ok: true, ts: lastUpdate });
    } catch (e) {
      return res.status(400).json({ error: 'invalid JSON' });
    }
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
