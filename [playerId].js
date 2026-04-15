const { connectDB, expandRecurring } = require('../../../../_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).end();

  try {
    const db = await connectDB();
    const { date, playerId } = req.query;
    const result = await db.collection('sessions').findOneAndUpdate(
      { date },
      { $pull: { players: { _id: new ObjectId(playerId) } } },
      { returnDocument: 'after' }
    );
    const [y, m] = date.split('-').map(Number);
    const expanded = await expandRecurring(db, y, m);
    result.recurringPlayers = expanded[date] || [];
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
