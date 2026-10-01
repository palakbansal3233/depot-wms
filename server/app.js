import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connect } from './db.js';
import { Unit, Item, Location, StockLot, Demand, User } from './models/index.js';
import {
  buildDashboard,
  buildIssuePlan,
  buildUnitSummaries,
  buildStockPosition,
  unitStage,
  fefoAllocate,
  round3,
  NEXT_STAGE,
  PREV_STAGE,
} from './logic.js';

const app = express();
app.use(express.json({ limit: '100kb' }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set (32+ characters)');
  return s;
};

// Every request needs the DB; connect() is a no-op once warm.
app.use('/api', async (_req, _res, next) => {
  await connect();
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Auth ─────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Username and password are required');
  }
  const user = await User.findOne({ username: username.toLowerCase().trim() });
  // Compare even when the user doesn't exist, so timing doesn't reveal valid names.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok) throw new HttpError(401, 'Invalid username or password');
  const token = jwt.sign({ sub: user.username }, secret(), { expiresIn: '12h' });
  res.json({ token, username: user.username });
});

const requireAuth = (req, _res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  try {
    req.user = jwt.verify(token, secret()).sub;
  } catch {
    throw new HttpError(401, 'Session expired — sign in again');
  }
  next();
};

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ username: req.user }));

app.use('/api', requireAuth);

// ── Reads ────────────────────────────────────────────────────────
async function loadAll() {
  const [units, items, locations, lots, lines] = await Promise.all([
    Unit.find().sort({ code: 1 }).lean(),
    Item.find().sort({ code: 1 }).lean(),
    Location.find().lean(),
    StockLot.find().lean(),
    Demand.find().sort({ demandId: 1 }).lean(),
  ]);
  return { units, items, locations, lots, lines };
}

app.get('/api/dashboard', async (_req, res) => res.json(buildDashboard(await loadAll())));

app.get('/api/units', async (_req, res) => res.json(buildUnitSummaries(await loadAll())));

app.get('/api/units/:code', async (req, res) => {
  const data = await loadAll();
  const summary = buildUnitSummaries(data).find((u) => u.code === req.params.code);
  if (!summary) throw new HttpError(404, 'Unit not found');
  const lines = buildIssuePlan({ ...data, lines: data.lines.filter((l) => l.unitCode === req.params.code) });
  res.json({ ...summary, lines });
});

app.get('/api/issue-plan', async (_req, res) => res.json(buildIssuePlan(await loadAll())));

app.get('/api/stock', async (_req, res) => res.json(buildStockPosition(await loadAll())));

// ── Status changes ──────────────────────────────────────────────
async function loadUnit(code) {
  const unit = await Unit.findOne({ code });
  if (!unit) throw new HttpError(404, 'Unit not found');
  const lines = await Demand.find({ unitCode: code });
  return { unit, lines, stage: unitStage(unit, lines) };
}

const assertPicking = (stage) => {
  if (!['PICKING', 'READY TO LOAD'].includes(stage)) {
    throw new HttpError(409, `Unit is ${stage}; pick lines are locked. Step the unit back first.`);
  }
};

// Toggle one pick line between PENDING and READY.
app.patch('/api/lines/:id', async (req, res) => {
  const { status } = req.body ?? {};
  if (!['PENDING', 'READY'].includes(status)) throw new HttpError(400, 'Status must be PENDING or READY');
  const line = await Demand.findById(req.params.id).catch(() => null);
  if (!line) throw new HttpError(404, 'Line not found');
  const { stage } = await loadUnit(line.unitCode);
  assertPicking(stage);
  line.status = status;
  await line.save();
  res.json({ ok: true });
});

// Mark every line for a unit as picked.
app.post('/api/units/:code/pick-all', async (req, res) => {
  const { stage } = await loadUnit(req.params.code);
  if (stage === 'NO DEMAND') throw new HttpError(409, 'Unit has no demand');
  assertPicking(stage);
  await Demand.updateMany({ unitCode: req.params.code, status: 'PENDING' }, { status: 'READY' });
  res.json({ ok: true });
});

// READY TO LOAD → LOADING → VERIFIED → DISPATCHED
app.post('/api/units/:code/advance', async (req, res) => {
  const { unit, lines, stage } = await loadUnit(req.params.code);
  const next = NEXT_STAGE[stage];
  if (!next) {
    throw new HttpError(409, stage === 'PICKING' ? 'Finish picking every line before loading' : `Cannot advance from ${stage}`);
  }

  if (next === 'DISPATCHED') {
    // Plan every draw before writing any, so a shortage leaves stock untouched.
    const lots = await StockLot.find({ itemCode: { $in: lines.map((l) => l.itemCode) } });
    const plan = [];
    const short = [];
    for (const line of lines) {
      const { draws, shortfall } = fefoAllocate(lots.filter((l) => l.itemCode === line.itemCode), line.requiredQty);
      if (shortfall > 0) short.push(`${line.itemCode} short by ${shortfall}`);
      for (const d of draws) {
        d.lot.issueQty = round3(d.lot.issueQty + d.qty); // so later lines see the reduced balance
        plan.push(d);
      }
    }
    if (short.length) throw new HttpError(409, `Not enough stock to dispatch: ${short.join(', ')}`);
    await Promise.all([...new Set(plan.map((d) => d.lot))].map((lot) => lot.save()));
  }

  const now = new Date();
  unit.stage = next;
  if (next === 'LOADING') unit.loadingAt = now;
  if (next === 'VERIFIED') unit.verifiedAt = now;
  if (next === 'DISPATCHED') unit.dispatchedAt = now;
  await unit.save();
  await Demand.updateMany({ unitCode: unit.code }, { status: next });
  res.json({ ok: true, stage: next });
});

// Step back one stage (not allowed once dispatched — stock has moved).
app.post('/api/units/:code/revert', async (req, res) => {
  const { unit, stage } = await loadUnit(req.params.code);
  if (!(stage in PREV_STAGE)) throw new HttpError(409, `Cannot step back from ${stage}`);
  const prev = PREV_STAGE[stage];
  unit.stage = prev;
  if (stage === 'VERIFIED') unit.verifiedAt = undefined;
  if (stage === 'LOADING') unit.loadingAt = undefined;
  await unit.save();
  await Demand.updateMany({ unitCode: unit.code }, { status: prev ?? 'READY' });
  res.json({ ok: true, stage: prev ?? 'READY TO LOAD' });
});

app.use('/api', (_req, _res) => {
  throw new HttpError(404, 'Not found');
});

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
});

export default app;
