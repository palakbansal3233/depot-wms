import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, MapPin, TriangleAlert } from 'lucide-react';
import { useApi } from '../hooks.js';
import { api } from '../api.js';
import { fmtQty, stClass, STAGE_LABEL } from '../format.js';
import { ErrorNote, useToast } from '../components/ui.jsx';

const STATUSES = ['PENDING', 'READY', 'LOADING', 'VERIFIED', 'DISPATCHED'];

export default function PickList() {
  const { data, error, loading, reload } = useApi('/issue-plan', 20000);
  const [status, setStatus] = useState('PENDING');
  const [item, setItem] = useState('ALL');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const toast = useToast();

  const counts = useMemo(() => {
    const c = {};
    for (const l of data ?? []) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [data]);
  const items = useMemo(() => [...new Set((data ?? []).map((l) => l.itemName))].sort(), [data]);

  // Grouped by pick location, so a picker walks each rack once.
  const groups = useMemo(() => {
    const rows = (data ?? []).filter(
      (l) =>
        l.status === status &&
        (item === 'ALL' || l.itemName === item) &&
        (!q || `${l.unitCode} ${l.itemName} ${l.pickLocation} ${l.stageLane}`.toLowerCase().includes(q.toLowerCase())),
    );
    const m = new Map();
    for (const l of rows) {
      const k = `${l.pickLocation}|${l.itemName}`;
      if (!m.has(k)) m.set(k, { loc: l.pickLocation, known: l.locationKnown, item: l.itemName, uom: l.uom, lines: [] });
      m.get(k).lines.push(l);
    }
    return [...m.values()].sort((a, b) => a.loc.localeCompare(b.loc));
  }, [data, status, item, q]);

  async function toggle(l) {
    setBusy(l.id);
    try {
      await api(`/lines/${l.id}`, { method: 'PATCH', body: { status: l.status === 'READY' ? 'PENDING' : 'READY' } });
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  const editable = status === 'PENDING' || status === 'READY';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Issue plan</div>
          <h1 className="page-title">Pick List</h1>
        </div>
        <div className="page-meta">Grouped by pick location</div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} aria-hidden="true" />
          <input className="input" placeholder="Unit, item, location, bay" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pick lines" />
        </div>
        <select className="input" value={item} onChange={(e) => setItem(e.target.value)} aria-label="Filter by item">
          <option value="ALL">All items</option>
          {items.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <div className="chips" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              <span className={`dot ${stClass(s)}`} />
              {STAGE_LABEL[s]}
              <span className="count">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && !data && <ErrorNote error={error} onRetry={reload} />}
      {loading ? (
        <div className="skeleton" style={{ minHeight: 300 }} />
      ) : groups.length === 0 ? (
        <div className="card empty">Nothing {STAGE_LABEL[status].toLowerCase()} here.</div>
      ) : (
        <div className="stack">
          {groups.map((g) => {
            const total = g.lines.reduce((s, l) => s + l.qty, 0);
            return (
              <section className="card" key={`${g.loc}|${g.item}`}>
                <div className="card-head" style={{ paddingBottom: 6 }}>
                  <div>
                    <span className="pick-loc" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                      <MapPin size={15} aria-hidden="true" /> {g.loc}
                    </span>{' '}
                    {!g.known && (
                      <span className="flag tone-warn" title="This location is not in the Location Master">
                        <TriangleAlert size={12} /> not in location master
                      </span>
                    )}
                    <div className="card-title" style={{ marginTop: 2 }}>{g.item}</div>
                  </div>
                  <span className="mono card-note" style={{ textAlign: 'right' }}>
                    {g.lines.length} lines
                    <br />
                    {fmtQty(total)} {g.uom}
                  </span>
                </div>
                <div>
                  {g.lines.map((l) => (
                    <div className="pick-line" key={l.id}>
                      {editable ? (
                        <button
                          className="check"
                          role="checkbox"
                          aria-checked={l.status === 'READY'}
                          aria-label={`${l.unitCode} ${l.itemName} picked`}
                          disabled={busy === l.id}
                          onClick={() => toggle(l)}
                        >
                          {l.status === 'READY' && <Check size={22} strokeWidth={3} />}
                        </button>
                      ) : (
                        <span className={`dot ${stClass(l.status)}`} style={{ justifySelf: 'center', width: 12, height: 12 }} />
                      )}
                      <div>
                        <Link to={`/units/${l.unitCode}`} className="pick-item" style={{ textDecoration: 'none' }}>
                          {l.unitCode} <span className="muted" style={{ fontWeight: 400 }}>{l.unitName}</span>
                        </Link>
                        <div className="mono muted" style={{ fontSize: 12.5 }}>
                          → {l.stageLane}
                        </div>
                      </div>
                      <div className="pick-qty">
                        {fmtQty(l.qty)} {l.uom}
                        <small>{l.demandId}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
