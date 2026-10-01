import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Unit, Item, Location, StockLot, Demand, User } from './models/index.js';
import { buildDemoData } from './seed/demo.js';

// Serverless functions reuse the module between warm invocations, so cache
// the connection promise on globalThis rather than reconnecting per request.
const cache = (globalThis.__depotDb ??= { promise: null });

export function connect() {
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    cache.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 8000 })
      .then(async () => {
        await ensureAdmin();
        if (process.env.SEED_DEMO !== 'false' && (await Unit.estimatedDocumentCount()) === 0) {
          await seed();
        }
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  return cache.promise;
}

// Creates the single admin login from env on first boot, if no user exists.
async function ensureAdmin() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
  if (await User.exists({})) return;
  await insertIgnoringDupes(User, [
    { username: ADMIN_USERNAME, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) },
  ]);
}

// Two cold starts can race to seed an empty database. IDs are deterministic,
// so the loser just hits duplicate keys, which we ignore.
async function insertIgnoringDupes(Model, docs) {
  try {
    await Model.insertMany(docs, { ordered: false });
  } catch (err) {
    const dupesOnly = err.code === 11000 || err.writeErrors?.every((e) => (e.code ?? e.err?.code) === 11000);
    if (!dupesOnly) throw err;
  }
}

export async function seed({ wipe = false } = {}) {
  if (wipe) {
    await Promise.all([Unit, Item, Location, StockLot, Demand].map((M) => M.deleteMany({})));
  }
  const data = buildDemoData();
  await Promise.all([Unit, Item, Location, StockLot, Demand].map((M) => M.init()));
  await insertIgnoringDupes(Item, data.items);
  await insertIgnoringDupes(Location, data.locations);
  await insertIgnoringDupes(StockLot, data.lots);
  await insertIgnoringDupes(Demand, data.lines);
  // Units last: their presence is what marks the database as seeded.
  await insertIgnoringDupes(Unit, data.units);
}
