const { connectDB, expandRecurring } = require('../../../_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const db = await connectDB();
    const { date } = req.query;
    const { name, email, gameType, timeType, timeFrom, timeTo, timeSlot, note } = req.body;
    if (!name || !gameType) return res.status(400).json({ error: 'Name and game type are required.' });

    const player = {
      _id: new ObjectId(),
      name: name.trim(),
      email: email?.trim() || '',
      gameType,
      timeType: timeType || 'slot',
      timeFrom: timeFrom || '',
      timeTo: timeTo || '',
      timeSlot: timeSlot || 'morning',
      note: note?.trim() || '',
      signedUpAt: new Date()
    };

    const result = await db.collection('sessions').findOneAndUpdate(
      { date },
      { $push: { players: player }, $setOnInsert: { date } },
      { upsert: true, returnDocument: 'after' }
    );

    const [y, m] = date.split('-').map(Number);
    const expanded = await expandRecurring(db, y, m);
    result.recurringPlayers = expanded[date] || [];
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
