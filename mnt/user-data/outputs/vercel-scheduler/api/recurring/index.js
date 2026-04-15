const { connectDB } = require('../_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectDB();

    if (req.method === 'GET') {
      const rules = await db.collection('recurring').find({}).toArray();
      return res.json(rules);
    }

    if (req.method === 'POST') {
      const { name, email, gameType, timeType, timeFrom, timeTo, timeSlot, note, recurrence, recurrenceLabel } = req.body;
      if (!name || !gameType || !recurrence) {
        return res.status(400).json({ error: 'Name, game type and recurrence are required.' });
      }
      const rule = {
        name: name.trim(),
        email: email?.trim() || '',
        gameType,
        timeType: timeType || 'slot',
        timeFrom: timeFrom || '',
        timeTo: timeTo || '',
        timeSlot: timeSlot || 'morning',
        note: note?.trim() || '',
        recurrence,
        recurrenceLabel: recurrenceLabel || '',
        createdAt: new Date()
      };
      const result = await db.collection('recurring').insertOne(rule);
      return res.json({ ...rule, _id: result.insertedId });
    }

    res.status(405).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
