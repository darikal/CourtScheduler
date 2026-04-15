const { MongoClient, ObjectId } = require('mongodb');

// ── DB CONNECTION ─────────────────────────────────────────────────────────────
let cachedClient = null;
async function getDB() {
  if (cachedClient) return cachedClient.db(process.env.DB_NAME || 'court_scheduler');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client.db(process.env.DB_NAME || 'court_scheduler');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function padDate(y, m0, d) { return `${y}-${pad(m0 + 1)}-${pad(d)}`; }

async function expandRecurring(db, year, monthNum) {
  const rules = await db.collection('recurring').find({}).toArray();
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const expanded = {};
  for (const rule of rules) {
    let dates = [];
    const { type, dayOfWeek, week } = rule.recurrence;
    if (type === 'weekly') {
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, monthNum - 1, d).getDay() === dayOfWeek)
          dates.push(padDate(year, monthNum - 1, d));
      }
    } else if (type === 'monthly') {
      const cands = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, monthNum - 1, d).getDay() === dayOfWeek)
          cands.push(padDate(year, monthNum - 1, d));
      }
      if (week === -1 && cands.length) dates = [cands[cands.length - 1]];
      else if (week >= 1 && week <= cands.length) dates = [cands[week - 1]];
    }
    for (const date of dates) {
      if (!expanded[date]) expanded[date] = [];
      expanded[date].push({
        _id: rule._id.toString(),
        name: rule.name, email: rule.email || '',
        gameType: rule.gameType, timeType: rule.timeType,
        timeFrom: rule.timeFrom || '', timeTo: rule.timeTo || '',
        timeSlot: rule.timeSlot || '', note: rule.note || '',
        isRecurring: true, recurrenceId: rule._id.toString(),
        recurrenceLabel: rule.recurrenceLabel || ''
      });
    }
  }
  return expanded;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // params is an array of path segments after /api/
  // e.g. /api/sessions           -> ['sessions']
  // e.g. /api/sessions/2026-04-15 -> ['sessions', '2026-04-15']
  // e.g. /api/sessions/2026-04-15/signup -> ['sessions', '2026-04-15', 'signup']
  // e.g. /api/sessions/2026-04-15/signup/abc123 -> ['sessions', '2026-04-15', 'signup', 'abc123']
  // e.g. /api/recurring          -> ['recurring']
  // e.g. /api/recurring/abc123   -> ['recurring', 'abc123']
  const segments = req.query.params || [];

  try {
    const db = await getDB();

    // GET /api/sessions?month=2026-04
    if (segments[0] === 'sessions' && segments.length === 1 && req.method === 'GET') {
      const { month } = req.query;
      let stored = [];
      let recurring = {};
      if (month) {
        const [y, m] = month.split('-').map(Number);
        stored = await db.collection('sessions').find({ date: { $regex: `^${month}` } }).toArray();
        recurring = await expandRecurring(db, y, m);
      } else {
        stored = await db.collection('sessions').find({}).toArray();
      }
      const map = {};
      for (const s of stored) map[s.date] = { ...s, players: s.players || [], recurringPlayers: [] };
      for (const [date, rp] of Object.entries(recurring)) {
        if (!map[date]) map[date] = { date, players: [], recurringPlayers: [] };
        map[date].recurringPlayers = rp;
      }
      return res.json(Object.values(map));
    }

    // GET /api/sessions/:date
    if (segments[0] === 'sessions' && segments.length === 2 && req.method === 'GET') {
      const date = segments[1];
      const session = await db.collection('sessions').findOne({ date }) || { date, players: [] };
      const [y, m] = date.split('-').map(Number);
      session.recurringPlayers = (await expandRecurring(db, y, m))[date] || [];
      return res.json(session);
    }

    // POST /api/sessions/:date/signup
    if (segments[0] === 'sessions' && segments[2] === 'signup' && segments.length === 3 && req.method === 'POST') {
      const date = segments[1];
      const { name, email, gameType, timeType, timeFrom, timeTo, timeSlot, note } = req.body;
      if (!name || !gameType) return res.status(400).json({ error: 'Name and game type required.' });
      const player = {
        _id: new ObjectId(), name: name.trim(), email: email?.trim() || '',
        gameType, timeType: timeType || 'slot',
        timeFrom: timeFrom || '', timeTo: timeTo || '',
        timeSlot: timeSlot || 'morning', note: note?.trim() || '',
        signedUpAt: new Date()
      };
      const result = await db.collection('sessions').findOneAndUpdate(
        { date },
        { $push: { players: player }, $setOnInsert: { date } },
        { upsert: true, returnDocument: 'after' }
      );
      const [y, m] = date.split('-').map(Number);
      result.recurringPlayers = (await expandRecurring(db, y, m))[date] || [];
      return res.json(result);
    }

    // DELETE /api/sessions/:date/signup/:playerId
    if (segments[0] === 'sessions' && segments[2] === 'signup' && segments.length === 4 && req.method === 'DELETE') {
      const date = segments[1];
      const playerId = segments[3];
      const result = await db.collection('sessions').findOneAndUpdate(
        { date },
        { $pull: { players: { _id: new ObjectId(playerId) } } },
        { returnDocument: 'after' }
      );
      const [y, m] = date.split('-').map(Number);
      result.recurringPlayers = (await expandRecurring(db, y, m))[date] || [];
      return res.json(result);
    }

    // GET /api/recurring
    if (segments[0] === 'recurring' && segments.length === 1 && req.method === 'GET') {
      return res.json(await db.collection('recurring').find({}).toArray());
    }

    // POST /api/recurring
    if (segments[0] === 'recurring' && segments.length === 1 && req.method === 'POST') {
      const { name, email, gameType, timeType, timeFrom, timeTo, timeSlot, note, recurrence, recurrenceLabel } = req.body;
      if (!name || !gameType || !recurrence) return res.status(400).json({ error: 'Name, game type and recurrence required.' });
      const rule = {
        name: name.trim(), email: email?.trim() || '', gameType,
        timeType: timeType || 'slot', timeFrom: timeFrom || '',
        timeTo: timeTo || '', timeSlot: timeSlot || 'morning',
        note: note?.trim() || '', recurrence,
        recurrenceLabel: recurrenceLabel || '', createdAt: new Date()
      };
      const result = await db.collection('recurring').insertOne(rule);
      return res.json({ ...rule, _id: result.insertedId });
    }

    // DELETE /api/recurring/:id
    if (segments[0] === 'recurring' && segments.length === 2 && req.method === 'DELETE') {
      await db.collection('recurring').deleteOne({ _id: new ObjectId(segments[1]) });
      return res.json({ deleted: true });
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
