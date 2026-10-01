const TZ = 'Asia/Kolkata';

// 01 OCT 2026
export const fmtDate = (d) =>
  d
    ? new Date(d)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
        .toUpperCase()
    : '—';

// 14:32 hrs
export const fmtTime = (d) =>
  d ? `${new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })} hrs` : '—';

export const fmtQty = (n, digits = 3) =>
  n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 7.5 → "7m 30s"
export const fmtMinutes = (m) => {
  if (m == null) return '—';
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

// CSS class for a stage/status: "READY TO LOAD" → "st-READY-TO-LOAD"
export const stClass = (s) => `st-${String(s).replace(/\s+/g, '-')}`;

export const STAGE_LABEL = {
  'NO DEMAND': 'No demand',
  PICKING: 'Picking',
  'READY TO LOAD': 'Ready to load',
  LOADING: 'Loading',
  VERIFIED: 'Verified',
  DISPATCHED: 'Dispatched',
  PENDING: 'Pending',
  READY: 'Picked',
};
