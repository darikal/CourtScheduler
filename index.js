const { connectDB, expandRecurring } = require('../_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const db = await connectDB();
    const { month } = req.query;
    let storedSessions = [];
    let recurringExpanded = {};

    if (month) {
      const [y, m] = month.split('-').map(Number);
      storedSessions = await db.collection('sessions').find({ date: { $regex: `^${month}` } }).toArray();
      recurringExpanded = await expandRecurring(db, y, m);
    } else {
      storedSessions = await db.collection('sessions').find({}).toArray();
    }

    const sessionMap = {};
    for (const s of storedSessions) {
      sessionMap[s.date] = { ...s, players: s.players || [], recurringPlayers: [] };
    }
    for (const [date, rPlayers] of Object.entries(recurringExpanded)) {
      if (!sessionMap[date]) sessionMap[date] = { date, players: [], recurringPlayers: [] };
      sessionMap[date].recurringPlayers = rPlayers;
    }

    res.json(Object.values(sessionMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
