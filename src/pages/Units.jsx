import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi } from '../hooks.js';
import { fmtQty, stClass, STAGE_LABEL, fmtTime } from '../format.js';
import { StageBadge, IssueTimer, ErrorNote } from '../components/ui.jsx';

const FILTERS = ['ALL', 'PICKING', 'READY TO LOAD', 'LOADING', 'VERIFIED', 'DISPATCHED', 'NO DEMAND'];

export default function Units() {
  const { data, error, loading, reload } = useApi('/units', 20000);
  const [params, setParams] = useSearchParams();
  const stage = params.get('stage') ?? 'ALL';
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = { ALL: data?.length ?? 0 };
    for (const u of data ?? []) c[u.stage] = (c[u.stage] ?? 0) + 1;
    return c;
  }, [data]);

  const shown = (data ?? []).filter(
    (u) =>
      (stage === 'ALL' || u.stage === stage) &&
      (!q || `${u.code} ${u.name} bay-${String(u.bay).padStart(2, '0')}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Unit issue</div>
          <h1 className="page-title">Units</h1>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={16} aria-hidden="true" />
          <input className="input" placeholder="Search unit or bay" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search units" />
        </div>
        <div className="chips" role="group" aria-label="Filter by stage">
          {FILTERS.map((f) => (
            <button
              key={f}
              className="chip"
              aria-pressed={stage === f}
              onClick={() => setParams(f === 'ALL' ? {} : { stage: f }, { replace: true })}
            >
              {f !== 'ALL' && <span className={`dot ${stClass(f)}`} />}
              {f === 'ALL' ? 'All' : STAGE_LABEL[f]}
              <span className="count">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && !data && <ErrorNote error={error} onRetry={reload} />}
      {loading ? (
        <div className="unit-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty">No units match.</div>
      ) : (
        <div className="unit-grid">
          {shown.map((u) => (
            <Link key={u.code} to={`/units/${u.code}`} className={`card unit-card ${stClass(u.stage)}`}>
              <div className="unit-card-top">
                <div>
                  <div className="unit-code">{u.code}</div>
                  <div className="unit-meta">
                    <span>{u.name}</span>
                    <span className="mono">{u.stageLane}</span>
                    {u.priority === 'Urgent' && <span className="flag tone-crit">Urgent</span>}
                  </div>
                </div>
                <StageBadge stage={u.stage} />
              </div>
              {u.pickLines > 0 && (
                <>
                  <div className="progress" aria-label={`${u.readyLines} of ${u.pickLines} lines picked`}>
                    <span style={{ width: `${(u.readyLines / u.pickLines) * 100}%` }} />
                  </div>
                  <div className="unit-meta" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <span className="mono">{u.readyLines}/{u.pickLines}</span> lines picked
                    </span>
                    <span className="mono">
                      {Object.entries(u.demandByUom).map(([k, v]) => `${fmtQty(v, 2)} ${k}`).join(' · ')}
                    </span>
                  </div>
                </>
              )}
              {(u.loadingAt || u.dispatchedAt) && (
                <div className="unit-meta" style={{ justifyContent: 'space-between' }}>
                  <IssueTimer unit={u} />
                  {u.dispatchedAt && <span>Dispatched {fmtTime(u.dispatchedAt)}</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
