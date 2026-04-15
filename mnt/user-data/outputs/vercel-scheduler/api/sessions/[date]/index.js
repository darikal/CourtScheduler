const { connectDB, expandRecurring } = require('../../_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const db = await connectDB();
    const { date } = req.query;
    let session = await db.collection('sessions').findOne({ date }) || { date, players: [] };
    const [y, m] = date.split('-').map(Number);
    const expanded = await expandRecurring(db, y, m);
    session.recurringPlayers = expanded[date] || [];
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
