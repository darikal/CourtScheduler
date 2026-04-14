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

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
  await db.collection('sessions').createIndex({ date: 1 });
}

// GET /api/sessions?month=2026-04
app.get('/api/sessions', async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2026-04"
    let query = {};
    if (month) {
      query.date = { $regex: `^${month}` };
    }
    const sessions = await db.collection('sessions').find(query).toArray();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:date
app.get('/api/sessions/:date', async (req, res) => {
  try {
    const { date } = req.params;
    let session = await db.collection('sessions').findOne({ date });
    if (!session) session = { date, players: [] };
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:date/signup
app.post('/api/sessions/:date/signup', async (req, res) => {
  try {
    const { date } = req.params;
    const { name, email, gameType, note } = req.body;
    if (!name || !gameType) {
      return res.status(400).json({ error: 'Name and game type are required.' });
    }

    const player = {
      _id: new ObjectId(),
      name: name.trim(),
      email: email?.trim() || '',
      gameType, // 'singles' or 'doubles'
      note: note?.trim() || '',
      signedUpAt: new Date()
    };

    const result = await db.collection('sessions').findOneAndUpdate(
      { date },
      { $push: { players: player }, $setOnInsert: { date } },
      { upsert: true, returnDocument: 'after' }
    );

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
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🎾 Court Scheduler running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
