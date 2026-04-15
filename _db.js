const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'court_scheduler';

let cachedClient = null;

async function connectDB() {
  if (cachedClient) return cachedClient.db(DB_NAME);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client.db(DB_NAME);
}

function padDate(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function expandRecurring(db, year, monthNum) {
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
      if (week === -1 && candidates.length > 0) matchingDates = [candidates[candidates.length - 1]];
      else if (week >= 1 && week <= candidates.length) matchingDates = [candidates[week - 1]];
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

module.exports = { connectDB, expandRecurring };
