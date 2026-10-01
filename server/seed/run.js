// npm run seed            → seed only if empty
// npm run seed -- --wipe  → delete units/items/locations/stock/demand and reseed
import 'dotenv/config';
import mongoose from 'mongoose';
import { connect, seed } from '../db.js';

const wipe = process.argv.includes('--wipe');
process.env.SEED_DEMO = 'false'; // connect() shouldn't seed; we do it explicitly below
await connect();
await seed({ wipe });
console.log(wipe ? 'Wiped and reseeded demo data.' : 'Seeded (existing records kept).');
await mongoose.disconnect();
