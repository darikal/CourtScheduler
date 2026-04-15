const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'court_scheduler';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

function padDate(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function expandRecurring(year, monthNum) {
  const rules = await db.collection('recurring').find({}).toArray();
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const expanded = {};

  for (const rule of rules) {
    let matchingDates = [];
    const { type, dayOfWeek, week } = rule.recurrence;

    if (type === 'weekly') {
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, monthNum - 1, d).getDay() === dayOfWeek) {
          matchingDates.push(padDate(year, monthNum - 1, d));
        }
      }
    } else if (type === 'monthly') {
      const candidates = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, monthNum - 1, d).getDay() === dayOfWeek) {
          candidates.push(padDate(year, monthNum - 1, d));
        }
      }
      if (week === -1 && candidates.length > 0) {
        matchingDates = [candidates[candidates.length - 1]];
      } else if (week >= 1 && week <= candidates.length) {
        matchingDates = [candidates[week - 1]];
      }
    }

    for (const date of matchingDates) {
      if (!expanded[date]) expanded[date] = [];
      expanded[date].push({
        _id: rule._id.toString(),
        name: rule.name,
        email: rule.email || '',
        gameType: rule.gameType,
        timeType: rule.timeType,
        timeFrom: rule.timeFrom || '',
        timeTo: rule.timeTo || '',
        timeSlot: rule.timeSlot || '',
        note: rule.note || '',
        isRecurring: true,
        recurrenceId: rule._id.toString(),
        recurrenceLabel: rule.recurrenceLabel || ''
      });
    }
  }
  return expanded;
}

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
  await db.collection('sessions').createIndex({ date: 1 });
  await db.collection('recurring').createIndex({ createdAt: 1 });
}

// GET /api/sessions?month=2026-04
app.get('/api/sessions', async (req, res) => {
  try {
    const { month } = req.query;
    let storedSessions = [];
    let recurringExpanded = {};
    if (month) {
      const [y, m] = month.split('-').map(Number);
      storedSessions = await db.collection('sessions').find({ date: { $regex: `^${month}` } }).toArray();
      recurringExpanded = await expandRecurring(y, m);
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
});

// GET /api/sessions/:date
app.get('/api/sessions/:date', async (req, res) => {
  try {
    const { date } = req.params;
    let session = await db.collection('sessions').findOne({ date }) || { date, players: [] };
    const [y, m] = date.split('-').map(Number);
    const expanded = await expandRecurring(y, m);
    session.recurringPlayers = expanded[date] || [];
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:date/signup
app.post('/api/sessions/:date/signup', async (req, res) => {
  try {
    const { date } = req.params;
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
    const expanded = await expandRecurring(y, m);
    result.recurringPlayers = expanded[date] || [];
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:date/signup/:playerId
app.delete('/api/sessions/:date/signup/:playerId', async (req, res) => {
  try {
    const { date, playerId } = req.params;
    const result = await db.collection('sessions').findOneAndUpdate(
      { date },
      { $pull: { players: { _id: new ObjectId(playerId) } } },
      { returnDocument: 'after' }
    );
    const [y, m] = date.split('-').map(Number);
    const expanded = await expandRecurring(y, m);
    result.recurringPlayers = expanded[date] || [];
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recurring
app.post('/api/recurring', async (req, res) => {
  try {
    const { name, email, gameType, timeType, timeFrom, timeTo, timeSlot, note, recurrence, recurrenceLabel } = req.body;
    if (!name || !gameType || !recurrence) return res.status(400).json({ error: 'Name, game type and recurrence are required.' });
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
    res.json({ ...rule, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recurring
app.get('/api/recurring', async (req, res) => {
  try {
    const rules = await db.collection('recurring').find({}).toArray();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recurring/:id
app.delete('/api/recurring/:id', async (req, res) => {
  try {
    await db.collection('recurring').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🎾 Court Scheduler running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
