import { Link } from 'react-router-dom';
import { TriangleAlert, CircleAlert, Clock, MapPin, RefreshCw, CircleCheck } from 'lucide-react';
import { useApi } from '../hooks.js';
import { fmtDate, fmtTime, fmtQty, fmtMinutes, stClass, STAGE_LABEL } from '../format.js';
import { ErrorNote } from '../components/ui.jsx';

const LINE_ORDER = ['PENDING', 'READY', 'LOADING', 'VERIFIED', 'DISPATCHED'];
const STAGE_ORDER = ['PICKING', 'READY TO LOAD', 'LOADING', 'VERIFIED', 'DISPATCHED', 'NO DEMAND'];

function Kpi({ label, value, sub, to }) {
  const Tag = to ? Link : 'div';
  return (
    <Tag className="card kpi" to={to}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </Tag>
  );
}

// Ring showing average issue time against the 10-minute target.
function IssueDial({ avg, target }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const frac = avg == null ? 0 : Math.min(avg / target, 1);
  const over = avg != null && avg > target;
  return (
    <svg className="dial" viewBox="0 0 112 112" role="img" aria-label={`Average issue time ${fmtMinutes(avg)} against ${target} minute target`}>
      <circle cx="56" cy="56" r={r} fill="none" className="dial-track" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke={over ? 'var(--crit)' : 'var(--accent)'}
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="56" textAnchor="middle" className="dial-text" fontSize="20">
        {avg == null ? '—' : avg.toFixed(1)}
      </text>
      <text x="56" y="74" textAnchor="middle" className="dial-unit">
        MIN AVG
      </text>
    </svg>
  );
}

function LineProgress({ counts }) {
  const total = LINE_ORDER.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <>
      <div className="segbar" role="img" aria-label={LINE_ORDER.map((k) => `${STAGE_LABEL[k]} ${counts[k]}`).join(', ')}>
        {LINE_ORDER.filter((k) => counts[k] > 0).map((k) => (
          <span key={k} className={stClass(k)} style={{ flexGrow: counts[k] }} title={`${STAGE_LABEL[k]}: ${counts[k]} lines (${Math.round((counts[k] / total) * 100)}%)`} />
        ))}
      </div>
      <div className="legend">
        {LINE_ORDER.map((k) => (
          <span key={k} className={`legend-item ${stClass(k)}`}>
            <span className="dot" />
            {STAGE_LABEL[k]} <strong>{counts[k]}</strong>
          </span>
        ))}
      </div>
    </>
  );
}

function BayBoard({ units }) {
  const bays = new Map();
  for (const u of units) {
    if (!bays.has(u.bay)) bays.set(u.bay, []);
    bays.get(u.bay).push(u);
  }
  return (
    <>
      <div className="bays">
        {[...bays.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([bay, us]) => (
            <div className="bay" key={bay}>
              <div className="bay-name">BAY-{String(bay).padStart(2, '0')}</div>
              <div className="bay-units">
                {us.map((u) => (
                  <Link
                    key={u.code}
                    to={`/units/${u.code}`}
                    className={`unit-chip ${stClass(u.stage)} ${u.priority === 'Urgent' ? 'urgent' : ''}`}
                    title={`${u.name} — ${STAGE_LABEL[u.stage]} (${u.readyLines}/${u.pickLines} picked)`}
                  >
                    {u.code}
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>
      <div className="legend">
        {STAGE_ORDER.map((s) => (
          <span key={s} className={`legend-item ${stClass(s)}`}>
            <span className="dot" />
            {STAGE_LABEL[s]}
          </span>
        ))}
      </div>
    </>
  );
}

// Stock on hand as a share of what is still owed to units. 100% mark = exactly enough.
function StockCover({ stock }) {
  const max = 2; // scale runs 0–200% cover
  return (
    <div>
      <div className="cover-scale" aria-hidden="true">
        <span />
        <span>
          <span style={{ position: 'absolute', left: 0 }}>0%</span>
          <span style={{ position: 'absolute', left: '50%', translate: '-50% 0' }}>100%</span>
          <span style={{ position: 'absolute', right: 0 }}>200%+</span>
        </span>
        <span />
      </div>
      {stock.map((s) => {
        const cover = s.outstanding > 0 ? s.balance / s.outstanding : max;
        const cls = s.shortfall > 0 ? 'short' : s.belowReorder ? 'low' : '';
        return (
          <div className="cover-row" key={s.code}>
            <div>
              <div className="cover-name">{s.name}</div>
              {s.shortfall > 0 ? (
                <span className="flag tone-crit">
                  <TriangleAlert size={12} /> Short
                </span>
              ) : s.belowReorder ? (
                <span className="flag tone-warn">
                  <CircleAlert size={12} /> Reorder
                </span>
              ) : null}
            </div>
            <div
              className="cover-track"
              title={`${s.name}: ${fmtQty(s.balance)} ${s.uom} on hand vs ${fmtQty(s.outstanding)} ${s.uom} still to issue (${Math.round(cover * 100)}% cover)`}
            >
              <span className={`cover-fill ${cls}`} style={{ width: `${Math.min(cover / max, 1) * 100}%` }} />
              <span className="cover-mark" style={{ left: '50%' }} />
            </div>
            <div className="cover-val">
              {fmtQty(s.balance, 2)} / {fmtQty(s.outstanding, 2)}
              <br />
              <span className="muted">{s.uom} held / owed</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Alerts({ alerts }) {
  const items = [];
  if (alerts.shortItems.length)
    items.push(
      <div className="alert tone-crit" key="short">
        <TriangleAlert size={18} />
        <div>
          <strong>Stock shortfall</strong>
          <ul>
            {alerts.shortItems.map((s) => (
              <li key={s.code}>
                {s.name}: short by <span className="mono">{fmtQty(s.shortfall)}</span> {s.uom}
              </li>
            ))}
          </ul>
        </div>
      </div>,
    );
  if (alerts.belowReorder.length)
    items.push(
      <div className="alert tone-warn" key="reorder">
        <CircleAlert size={18} />
        <div>
          <strong>Below reorder level</strong>
          <ul>
            {alerts.belowReorder.map((s) => (
              <li key={s.code}>
                {s.name}: <span className="mono">{fmtQty(s.balance)}</span> {s.uom} held, reorder at{' '}
                <span className="mono">{s.reorderLevel}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>,
    );
  if (alerts.expiringLots.length)
    items.push(
      <div className="alert tone-warn" key="exp">
        <Clock size={18} />
        <div>
          <strong>Expiring within 30 days</strong>
          <ul>
            {alerts.expiringLots.map((l) => (
              <li key={l.stockId}>
                {l.itemName} lot <span className="mono">{l.lot}</span> — {fmtDate(l.expiry)}, <span className="mono">{fmtQty(l.balance)}</span> {l.uom} left
              </li>
            ))}
          </ul>
        </div>
      </div>,
    );
  if (alerts.badLocations.length)
    items.push(
      <div className="alert tone-info" key="loc">
        <MapPin size={18} />
        <div>
          <strong>Item master: pick location not found</strong>
          <ul>
            {alerts.badLocations.map((l) => (
              <li key={l} className="mono" style={{ fontSize: 12.5 }}>
                {l}
              </li>
            ))}
          </ul>
          <span className="muted">Shed/rack in Item Master doesn’t match Location Master.</span>
        </div>
      </div>,
    );
  if (!items.length)
    items.push(
      <div className="alert tone-ok" key="ok">
        <CircleCheck size={18} />
        <div>
          <strong>All clear</strong>No stock or data alerts.
        </div>
      </div>,
    );
  return <div className="stack" style={{ gap: 10 }}>{items}</div>;
}

export default function Dashboard() {
  const { data, error, loading, reload } = useApi('/dashboard', 20000);

  if (loading)
    return (
      <div className="grid grid-kpi">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    );
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;

  const { kpis, issueClock, lineCounts, units, stock, alerts } = data;
  const issueDate = units.find((u) => u.issueDate)?.issueDate;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Live control board</div>
          <h1 className="page-title">Issue Day {fmtDate(issueDate)}</h1>
        </div>
        <div className="page-meta">
          Updated {fmtTime(data.generatedAt)}
          <button className="btn btn-sm" onClick={reload}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Units with demand" value={<>{kpis.unitsWithDemand}<small> / {kpis.totalUnits}</small></>} sub={`${kpis.totalLines} demand lines`} to="/units" />
        <Kpi label="Dispatched" value={kpis.unitsDispatched} sub={`${kpis.unitsWithDemand ? Math.round((kpis.unitsDispatched / kpis.unitsWithDemand) * 100) : 0}% of units`} to="/units?stage=DISPATCHED" />
        <Kpi label="Loading / verify" value={kpis.unitsLoading} sub="On the bays now" to="/units?stage=LOADING" />
        <Kpi label="Ready to load" value={kpis.unitsReady} sub="Fully picked" to="/units?stage=READY TO LOAD" />
        <Kpi label="Picking" value={kpis.unitsPicking} sub={`${lineCounts.PENDING} lines to pick`} to="/pick-list" />
        <Kpi
          label="Planned qty"
          value={<span style={{ fontSize: 22 }}>{Object.entries(kpis.plannedByUom).map(([u, q]) => `${fmtQty(q, 2)} ${u}`).join(' · ')}</span>}
          sub={`${kpis.stockEmptyLines} empty · ${kpis.stockShortLines} short stock lines`}
          to="/stock"
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Pick lines by status</h2>
            <span className="card-note">{kpis.totalLines} lines</span>
          </div>
          <div className="card-body">
            <LineProgress counts={lineCounts} />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">10-minute issue clock</h2>
            <span className="card-note">Loading → dispatch</span>
          </div>
          <div className="card-body clock-hero">
            <IssueDial avg={issueClock.avgMinutes} target={issueClock.targetMinutes} />
            <div className="clock-facts">
              <div>
                Average <strong>{fmtMinutes(issueClock.avgMinutes)}</strong> against a <strong>{issueClock.targetMinutes}m</strong> target
              </div>
              <div>
                <strong>{issueClock.withinTarget}</strong> of <strong>{issueClock.dispatched}</strong> dispatched units within target
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Bay board</h2>
              <span className="card-note">Tap a unit to open it</span>
            </div>
            <div className="card-body">
              <BayBoard units={units} />
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Stock cover</h2>
              <span className="card-note">Held vs still to issue</span>
            </div>
            <div className="card-body">
              <StockCover stock={stock} />
            </div>
          </section>
        </div>
        <section className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head">
            <h2 className="card-title">Alerts</h2>
          </div>
          <div className="card-body">
            <Alerts alerts={alerts} />
          </div>
        </section>
      </div>
    </>
  );
}
