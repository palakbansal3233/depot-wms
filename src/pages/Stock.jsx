import { TriangleAlert, CircleAlert, Clock, MapPin } from 'lucide-react';
import { useApi } from '../hooks.js';
import { fmtDate, fmtQty } from '../format.js';
import { ErrorNote } from '../components/ui.jsx';

const LOT_TONE = { SHORT: 'tone-crit', EMPTY: 'tone-warn', OK: 'tone-ok' };

export default function Stock() {
  const { data, error, loading, reload } = useApi('/stock', 60000);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Stock ledger</div>
          <h1 className="page-title">Stock Position</h1>
        </div>
        <div className="page-meta">Balance = opening + receipts − issues · lots in first-expiry order</div>
      </div>
      {error && !data && <ErrorNote error={error} onRetry={reload} />}
      {loading ? (
        <div className="skeleton" style={{ minHeight: 300 }} />
      ) : (
        <div className="stack">
          {data.map((s) => (
            <section className="card" key={s.code}>
              <div className="card-head" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 18 }}>
                    {s.name} <span className="mono muted" style={{ fontSize: 13, fontWeight: 400 }}>{s.code}</span>
                  </h2>
                  <div className="unit-meta" style={{ marginTop: 2 }}>
                    <span>{s.category}</span>
                    <span>{s.pack}</span>
                    <span className="pick-loc">
                      <MapPin size={12} /> {s.pickLocation}
                    </span>
                    {!s.locationKnown && (
                      <span className="flag tone-warn">
                        <TriangleAlert size={12} /> not in location master
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.shortfall > 0 && (
                    <span className="flag tone-crit">
                      <TriangleAlert size={13} /> Short {fmtQty(s.shortfall)} {s.uom}
                    </span>
                  )}
                  {s.belowReorder && (
                    <span className="flag tone-warn">
                      <CircleAlert size={13} /> Below reorder ({s.reorderLevel} {s.uom})
                    </span>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div className="grid grid-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {[
                    ['On hand', s.balance],
                    ['Still to issue', s.outstanding],
                    ['Issued', s.issued],
                    ['Reorder level', s.reorderLevel],
                  ].map(([label, v]) => (
                    <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div className="kpi-label">{label}</div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                        {fmtQty(v)} <span className="muted" style={{ fontSize: 12 }}>{s.uom}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="table-wrap">
                  <table className="table stackable">
                    <thead>
                      <tr>
                        <th>Lot</th>
                        <th>Location</th>
                        <th className="r">Opening</th>
                        <th className="r">Receipts</th>
                        <th className="r">Issued</th>
                        <th className="r">Balance</th>
                        <th>Expiry</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lots.map((l) => (
                        <tr key={l.stockId}>
                          <td data-label="Lot" className="mono">{l.lot}</td>
                          <td data-label="Location" className="mono">{l.locationId}</td>
                          <td data-label="Opening" className="mono r">{fmtQty(l.openingQty)}</td>
                          <td data-label="Receipts" className="mono r">{fmtQty(l.receipts)}</td>
                          <td data-label="Issued" className="mono r">{fmtQty(l.issueQty)}</td>
                          <td data-label="Balance" className="mono r" style={{ fontWeight: 600 }}>{fmtQty(l.balance)}</td>
                          <td data-label="Expiry">
                            <span className="mono">{fmtDate(l.expiry)}</span>{' '}
                            {l.expiringSoon && (
                              <span className="flag tone-warn">
                                <Clock size={12} /> soon
                              </span>
                            )}
                          </td>
                          <td data-label="Status">
                            <span className={`flag ${LOT_TONE[l.status]}`}>{l.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
