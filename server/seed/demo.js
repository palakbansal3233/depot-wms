import { fefoAllocate, round3, lotBalance } from '../logic.js';
import masters from './masters.json' with { type: 'json' };

// Deterministic PRNG so every seed (and every concurrent cold start) produces
// identical IDs — duplicate inserts then collide on unique keys instead of doubling data.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-unit daily demand range, in the item's UOM (MT / KL).
const DEMAND = {
  ITM001: [0.12, 0.3], // Rice
  ITM002: [0.12, 0.3], // Atta
  ITM003: [0.03, 0.08], // Dal
  ITM004: [0.03, 0.07], // Sugar
  ITM005: [0.02, 0.05], // Edible Oil (KL)
  ITM006: [0.005, 0.015], // Salt
};
// Stock held as a multiple of total demand. Sugar is deliberately short and
// salt deliberately below its reorder level, so the alerts have something to show.
const COVER = { ITM001: 1.4, ITM002: 1.2, ITM003: 1.15, ITM004: 0.85, ITM005: 1.3, ITM006: 1.6 };

const NO_DEMAND = new Set(['U13', 'U27', 'U38', 'U45']);

export function buildDemoData(now = new Date()) {
  const rand = mulberry32(20261001);
  const between = (a, b) => round3(a + rand() * (b - a));
  const { units, items, locations } = masters;

  const issueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const minutesAgo = (m) => new Date(now.getTime() - m * 60000);

  // ── Demand lines ─────────────────────────────────────────────
  const lines = [];
  for (const u of units) {
    if (NO_DEMAND.has(u.code)) continue;
    const n = u.code.slice(1);
    items.forEach((it, i) => {
      if (it.code === 'ITM006' && rand() < 0.25) return; // not every unit draws salt
      const [lo, hi] = DEMAND[it.code];
      lines.push({
        demandId: `D${n}-${String(i + 1).padStart(3, '0')}`,
        unitCode: u.code,
        issueDate,
        itemCode: it.code,
        requiredQty: between(lo, hi),
        status: 'PENDING',
      });
    });
  }

  // ── Stock lots, filled pallet by pallet from each item's primary rack ──
  const lots = [];
  let stockSeq = 1;
  const locsByRack = new Map();
  for (const l of locations) {
    const k = l.rack;
    if (!locsByRack.has(k)) locsByRack.set(k, []);
    locsByRack.get(k).push(l);
  }
  for (const it of items) {
    const total = lines.filter((l) => l.itemCode === it.code).reduce((s, l) => s + l.requiredQty, 0);
    let left = round3(total * COVER[it.code]);
    const slots = [...(locsByRack.get(it.rack) ?? []), ...(locsByRack.get(it.rack + 1) ?? [])];
    let slot = 0;
    let batch = 0;
    while (left > 0 && slot < slots.length) {
      const qty = round3(Math.min(left, slots[slot].capacity * (0.75 + rand() * 0.25)));
      const opening = round3(qty * (0.4 + rand() * 0.4));
      // Older batches expire first; Dal's oldest batch is close to expiry on purpose.
      const days = it.code === 'ITM003' && batch === 0 ? 18 : 60 + batch * 45 + Math.floor(rand() * 30);
      lots.push({
        stockId: `STK${String(stockSeq++).padStart(4, '0')}`,
        itemCode: it.code,
        locationId: slots[slot].locationId,
        lot: `${it.name.slice(0, 4).toUpperCase().replace(/\s/g, '')}/${now.getUTCFullYear()}/${String.fromCharCode(65 + batch)}`,
        openingQty: opening,
        receipts: round3(qty - opening),
        issueQty: 0,
        expiry: new Date(issueDate.getTime() + days * 86400000),
      });
      left = round3(left - qty);
      slot += 1;
      batch += 1;
    }
  }

  // ── Unit progress, so the board looks like mid-morning on an issue day ──
  const active = units.filter((u) => !NO_DEMAND.has(u.code)).map((u) => ({ ...u }));
  const setLines = (code, status) => lines.filter((l) => l.unitCode === code).forEach((l) => (l.status = status));
  // Issue durations in minutes for dispatched units: mostly under the 10-minute target.
  const issueMins = [7.5, 8.2, 9.1, 6.8, 11.4, 8.9, 9.6, 13.2, 7.9];
  active.forEach((u, i) => {
    if (i < 9) {
      const start = 25 + (9 - i) * 14;
      u.stage = 'DISPATCHED';
      u.loadingAt = minutesAgo(start);
      u.verifiedAt = minutesAgo(start - issueMins[i] * 0.7);
      u.dispatchedAt = minutesAgo(start - issueMins[i]);
      setLines(u.code, 'DISPATCHED');
    } else if (i < 12) {
      u.stage = 'VERIFIED';
      u.loadingAt = minutesAgo(9 - (i - 9) * 2);
      u.verifiedAt = minutesAgo(2);
      setLines(u.code, 'VERIFIED');
    } else if (i < 15) {
      u.stage = 'LOADING';
      u.loadingAt = minutesAgo(3 + (i - 12) * 3);
      setLines(u.code, 'LOADING');
    } else if (i < 21) {
      setLines(u.code, 'READY');
    } else if (i < 34) {
      // Partly picked
      const ul = lines.filter((l) => l.unitCode === u.code);
      const done = Math.floor(rand() * ul.length);
      ul.forEach((l, j) => (l.status = j < done ? 'READY' : 'PENDING'));
    }
  });
  const unitsOut = units.map((u) => {
    const a = active.find((x) => x.code === u.code);
    return a ?? u;
  });

  // Dispatched units have already drawn stock, first-expiry-first-out.
  for (const l of lines.filter((x) => x.status === 'DISPATCHED')) {
    const { draws } = fefoAllocate(lots.filter((x) => x.itemCode === l.itemCode), l.requiredQty);
    for (const d of draws) d.lot.issueQty = round3(d.lot.issueQty + d.qty);
  }
  // Mark a fully drawn lot so the "empty" KPI isn't always zero.
  for (const lot of lots) if (lotBalance(lot) < 0.001) lot.issueQty = round3(lot.openingQty + lot.receipts);

  return { units: unitsOut, items, locations, lots, lines };
}
