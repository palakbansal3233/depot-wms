// Pure functions that replace the workbook's formulas. Nothing in here
// touches the database, so the seed and the API share exactly one definition.

export const round3 = (n) => Math.round(n * 1000) / 1000;

// STOCK_LEDGER!L = Opening + Receipts − Issue
export const lotBalance = (lot) => round3(lot.openingQty + lot.receipts - lot.issueQty);

// STOCK_LEDGER!N
export const lotStatus = (lot) => {
  const bal = lotBalance(lot);
  return bal < 0 ? 'SHORT' : bal === 0 ? 'EMPTY' : 'OK';
};

// ISSUE_PLAN!N — "S" & shed & "-R" & TEXT(rack,"00") & "-" & level & "-" & pallet
export const pickLocation = (item) =>
  item ? `S${item.shed}-R${String(item.rack).padStart(2, '0')}-${item.level}-${item.pallet}` : '';

export const bayLabel = (bay) => `BAY-${String(bay).padStart(2, '0')}`;

// UNIT_ISSUE!I, extended with the manual LOADING → VERIFIED → DISPATCHED stages.
export function unitStage(unit, lines) {
  if (lines.length === 0) return 'NO DEMAND';
  if (unit.stage) return unit.stage;
  return lines.some((l) => l.status === 'PENDING') ? 'PICKING' : 'READY TO LOAD';
}

export const NEXT_STAGE = {
  'READY TO LOAD': 'LOADING',
  LOADING: 'VERIFIED',
  VERIFIED: 'DISPATCHED',
};

export const PREV_STAGE = {
  LOADING: null,
  VERIFIED: 'LOADING',
};

// First-expiry-first-out: which lots to draw `qty` from, and how much from each.
// Lots without an expiry go last. Returns { draws, shortfall }.
export function fefoAllocate(lots, qty) {
  const sorted = [...lots]
    .filter((l) => lotBalance(l) > 0)
    .sort((a, b) => (a.expiry ? +new Date(a.expiry) : Infinity) - (b.expiry ? +new Date(b.expiry) : Infinity));
  const draws = [];
  let left = round3(qty);
  for (const lot of sorted) {
    if (left <= 0) break;
    const take = round3(Math.min(lotBalance(lot), left));
    draws.push({ lot, qty: take });
    left = round3(left - take);
  }
  return { draws, shortfall: left > 0 ? left : 0 };
}

const groupBy = (arr, key) => {
  const m = new Map();
  for (const x of arr) {
    const k = x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

// Joins demand lines with unit + item masters — the ISSUE_PLAN sheet.
export function buildIssuePlan({ units, items, locations, lines }) {
  const unitBy = new Map(units.map((u) => [u.code, u]));
  const itemBy = new Map(items.map((i) => [i.code, i]));
  const locIds = new Set(locations.map((l) => l.locationId));
  return lines.map((l) => {
    const unit = unitBy.get(l.unitCode);
    const item = itemBy.get(l.itemCode);
    const loc = pickLocation(item);
    return {
      id: String(l._id),
      demandId: l.demandId,
      unitCode: l.unitCode,
      unitName: unit?.name ?? '',
      bay: unit?.bay ?? null,
      stageLane: unit ? bayLabel(unit.bay) : '',
      issueDate: l.issueDate,
      itemCode: l.itemCode,
      itemName: item?.name ?? '',
      qty: l.requiredQty,
      uom: item?.uom ?? '',
      pickLocation: loc,
      locationKnown: locIds.has(loc),
      status: l.status,
    };
  });
}

export function buildUnitSummaries({ units, items, lines }) {
  const itemBy = new Map(items.map((i) => [i.code, i]));
  const linesBy = groupBy(lines, 'unitCode');
  return units
    .filter((u) => u.active)
    .map((u) => {
      const ul = linesBy.get(u.code) ?? [];
      const demandByUom = {};
      for (const l of ul) {
        const uom = itemBy.get(l.itemCode)?.uom ?? '?';
        demandByUom[uom] = round3((demandByUom[uom] ?? 0) + l.requiredQty);
      }
      const pending = ul.filter((l) => l.status === 'PENDING').length;
      return {
        code: u.code,
        name: u.name,
        priority: u.priority,
        bay: u.bay,
        stageLane: bayLabel(u.bay),
        issueDate: ul[0]?.issueDate ?? null,
        demandByUom,
        pickLines: ul.length,
        readyLines: ul.length - pending,
        pendingLines: pending,
        stage: unitStage(u, ul),
        loadingAt: u.loadingAt ?? null,
        verifiedAt: u.verifiedAt ?? null,
        dispatchedAt: u.dispatchedAt ?? null,
        issueMinutes:
          u.loadingAt && u.dispatchedAt ? round3((u.dispatchedAt - u.loadingAt) / 60000) : null,
      };
    });
}

// Stock position per item: what's on the shelf against what's still owed.
export function buildStockPosition({ items, lots, lines, locations }) {
  const lotsBy = groupBy(lots, 'itemCode');
  const linesBy = groupBy(lines, 'itemCode');
  const locIds = new Set(locations.map((l) => l.locationId));
  const soon = Date.now() + 30 * 86400000;
  return items
    .filter((i) => i.active)
    .map((i) => {
      const il = lotsBy.get(i.code) ?? [];
      const balance = round3(il.reduce((s, l) => s + lotBalance(l), 0));
      const outstanding = round3(
        (linesBy.get(i.code) ?? []).filter((l) => l.status !== 'DISPATCHED').reduce((s, l) => s + l.requiredQty, 0),
      );
      const issued = round3(il.reduce((s, l) => s + l.issueQty, 0));
      const loc = pickLocation(i);
      return {
        code: i.code,
        name: i.name,
        category: i.category,
        uom: i.uom,
        pack: i.pack,
        reorderLevel: i.reorderLevel,
        pickLocation: loc,
        locationKnown: locIds.has(loc),
        balance,
        issued,
        outstanding,
        shortfall: round3(Math.max(0, outstanding - balance)),
        belowReorder: balance < i.reorderLevel,
        lots: il
          .map((l) => ({
            stockId: l.stockId,
            lot: l.lot,
            locationId: l.locationId,
            openingQty: l.openingQty,
            receipts: l.receipts,
            issueQty: l.issueQty,
            balance: lotBalance(l),
            status: lotStatus(l),
            expiry: l.expiry ?? null,
            expiringSoon: l.expiry ? +new Date(l.expiry) < soon && lotBalance(l) > 0 : false,
          }))
          .sort((a, b) => (a.expiry ? +new Date(a.expiry) : Infinity) - (b.expiry ? +new Date(b.expiry) : Infinity)),
      };
    });
}

// The DASHBOARD sheet, plus the issue-clock numbers the "10-minute" target needs.
export function buildDashboard(data) {
  const units = buildUnitSummaries(data);
  const stock = buildStockPosition(data);
  const plan = buildIssuePlan(data);
  const count = (arr, f) => arr.filter(f).length;

  const stageCounts = {};
  for (const u of units) stageCounts[u.stage] = (stageCounts[u.stage] ?? 0) + 1;

  const lineCounts = Object.fromEntries(['PENDING', 'READY', 'LOADING', 'VERIFIED', 'DISPATCHED'].map((s) => [s, 0]));
  for (const l of plan) lineCounts[l.status] += 1;

  const plannedByUom = {};
  for (const l of plan) plannedByUom[l.uom] = round3((plannedByUom[l.uom] ?? 0) + l.qty);

  const times = units.map((u) => u.issueMinutes).filter((m) => m != null);
  const allLots = stock.flatMap((s) => s.lots);

  const badLocations = [...new Set(plan.filter((l) => !l.locationKnown).map((l) => `${l.itemName} → ${l.pickLocation}`))];

  return {
    kpis: {
      totalUnits: units.length,
      unitsWithDemand: count(units, (u) => u.pickLines > 0),
      unitsReady: stageCounts['READY TO LOAD'] ?? 0,
      unitsPicking: stageCounts.PICKING ?? 0,
      unitsLoading: (stageCounts.LOADING ?? 0) + (stageCounts.VERIFIED ?? 0),
      unitsDispatched: stageCounts.DISPATCHED ?? 0,
      totalLines: plan.length,
      plannedByUom,
      stockShortLines: count(allLots, (l) => l.status === 'SHORT'),
      stockEmptyLines: count(allLots, (l) => l.status === 'EMPTY'),
    },
    issueClock: {
      targetMinutes: 10,
      dispatched: times.length,
      avgMinutes: times.length ? round3(times.reduce((a, b) => a + b, 0) / times.length) : null,
      withinTarget: count(times, (m) => m <= 10),
    },
    stageCounts,
    lineCounts,
    units,
    stock: stock.map(({ lots, ...rest }) => ({
      ...rest,
      expiringLots: lots.filter((l) => l.expiringSoon).length,
    })),
    alerts: {
      shortItems: stock.filter((s) => s.shortfall > 0).map((s) => ({ code: s.code, name: s.name, shortfall: s.shortfall, uom: s.uom })),
      belowReorder: stock.filter((s) => s.belowReorder).map((s) => ({ code: s.code, name: s.name, balance: s.balance, reorderLevel: s.reorderLevel, uom: s.uom })),
      expiringLots: stock.flatMap((s) => s.lots.filter((l) => l.expiringSoon).map((l) => ({ itemName: s.name, ...l, uom: s.uom }))),
      badLocations,
    },
    generatedAt: new Date(),
  };
}
