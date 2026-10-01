import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Check, MapPin, Undo2, PackageCheck, Truck, ShieldCheck, ListChecks, Lock, TriangleAlert } from 'lucide-react';
import { useApi } from '../hooks.js';
import { api } from '../api.js';
import { fmtDate, fmtQty, fmtTime } from '../format.js';
import { StageBadge, IssueTimer, ErrorNote, useToast } from '../components/ui.jsx';

const STEPS = [
  { key: 'PICKING', label: 'Pick' },
  { key: 'READY TO LOAD', label: 'Staged' },
  { key: 'LOADING', label: 'Loading', at: 'loadingAt' },
  { key: 'VERIFIED', label: 'Verified', at: 'verifiedAt' },
  { key: 'DISPATCHED', label: 'Dispatched', at: 'dispatchedAt' },
];

// The one primary action for each stage.
const ACTION = {
  PICKING: { label: 'Mark all lines picked', path: 'pick-all', icon: ListChecks },
  'READY TO LOAD': { label: 'Start loading', path: 'advance', icon: PackageCheck },
  LOADING: { label: 'Verify load', path: 'advance', icon: ShieldCheck },
  VERIFIED: { label: 'Dispatch', path: 'advance', icon: Truck, confirm: 'Dispatch this unit? Stock will be issued first-expiry-first-out and this cannot be undone.' },
};

export default function UnitDetail() {
  const { code } = useParams();
  const { data: u, error, loading, reload } = useApi(`/units/${code}`, 15000);
  const [busy, setBusy] = useState(null);
  const toast = useToast();

  async function run(key, fn, success) {
    setBusy(key);
    try {
      await fn();
      if (success) toast(success);
      await reload();
    } catch (e) {
      toast(e.message, 'error');
      await reload();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="skeleton" style={{ minHeight: 300 }} />;
  if (error && !u) return <ErrorNote error={error} onRetry={reload} />;

  const stageIdx = STEPS.findIndex((s) => s.key === u.stage);
  const picking = u.stage === 'PICKING' || u.stage === 'READY TO LOAD';
  const action = ACTION[u.stage];
  const canRevert = u.stage === 'LOADING' || u.stage === 'VERIFIED';

  const toggle = (line) =>
    run(line.id, () => api(`/lines/${line.id}`, { method: 'PATCH', body: { status: line.status === 'READY' ? 'PENDING' : 'READY' } }));

  return (
    <>
      <Link to="/units" className="back">
        <ChevronLeft size={16} /> All units
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {u.stageLane} · {u.priority} priority
          </div>
          <h1 className="page-title">
            {u.code} <span className="muted" style={{ fontSize: '0.6em' }}>{u.name}</span>
          </h1>
        </div>
        <div className="page-meta">
          <StageBadge stage={u.stage} />
          <IssueTimer unit={u} />
        </div>
      </div>

      {u.stage === 'NO DEMAND' ? (
        <div className="card empty">This unit has no demand for this issue.</div>
      ) : (
        <div className="stack">
          <section className="card card-pad">
            <ol className="stepper" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Issue progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className={`step ${i < stageIdx || u.stage === 'DISPATCHED' ? 'done' : i === stageIdx ? 'current' : ''}`} aria-current={i === stageIdx ? 'step' : undefined}>
                  {s.label}
                  {s.at && u[s.at] && <time>{fmtTime(u[s.at])}</time>}
                </li>
              ))}
            </ol>
            <p className="muted" style={{ fontSize: 13, margin: '14px 0 0' }}>
              Issue date {fmtDate(u.issueDate)} · {u.readyLines}/{u.pickLines} lines picked ·{' '}
              {Object.entries(u.demandByUom).map(([k, v]) => `${fmtQty(v)} ${k}`).join(' · ')}
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Pick lines</h2>
              {!picking && (
                <span className="card-note" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <Lock size={12} /> Locked after loading starts
                </span>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {u.lines.map((l) => {
                const picked = l.status !== 'PENDING';
                return (
                  <div className="pick-line" key={l.id}>
                    <button
                      className="check"
                      role="checkbox"
                      aria-checked={picked}
                      aria-label={`${l.itemName} picked`}
                      disabled={!picking || busy === l.id}
                      onClick={() => toggle(l)}
                    >
                      {picked && <Check size={22} strokeWidth={3} />}
                    </button>
                    <div>
                      <div className="pick-item">{l.itemName}</div>
                      <span className="pick-loc">
                        <MapPin size={13} aria-hidden="true" />
                        {l.pickLocation}
                        {!l.locationKnown && (
                          <span className="flag tone-warn" title="Not in Location Master">
                            <TriangleAlert size={12} /> check
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="pick-qty">
                      {fmtQty(l.qty)} {l.uom}
                      <small>{l.demandId}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {(action || canRevert) && (
            <div className="action-bar sticky">
              {action && (
                <button
                  className="btn btn-primary"
                  disabled={!!busy}
                  onClick={() => {
                    if (action.confirm && !window.confirm(action.confirm)) return;
                    run('action', () => api(`/units/${u.code}/${action.path}`, { method: 'POST' }), `${u.code}: ${action.label} — done`);
                  }}
                >
                  <action.icon size={18} aria-hidden="true" />
                  {busy === 'action' ? 'Working…' : action.label}
                </button>
              )}
              {canRevert && (
                <button className="btn" disabled={!!busy} onClick={() => run('revert', () => api(`/units/${u.code}/revert`, { method: 'POST' }), 'Stepped back one stage')}>
                  <Undo2 size={18} aria-hidden="true" /> Step back
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
