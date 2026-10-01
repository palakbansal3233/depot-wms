import { createContext, useCallback, useContext, useState } from 'react';
import { Timer } from 'lucide-react';
import { STAGE_LABEL, stClass, fmtMinutes } from '../format.js';
import { useNow } from '../hooks.js';

export function BrandMark({ className = 'brand-mark' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#3F4D28" />
      <path d="M8 11l8-4 8 4v10l-8 4-8-4z" fill="none" stroke="#C3B091" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 11l8 4 8-4M16 15v10" fill="none" stroke="#C3B091" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function StageBadge({ stage }) {
  return (
    <span className={`badge ${stClass(stage)}`}>
      <span className="dot" />
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

// Time since loading started — the 10-minute issue clock. Turns red past target.
export function IssueTimer({ unit, target = 10 }) {
  const now = useNow();
  if (!unit.loadingAt) return null;
  const end = unit.dispatchedAt ? new Date(unit.dispatchedAt) : now;
  const mins = (end - new Date(unit.loadingAt)) / 60000;
  return (
    <span className={`timer ${mins > target ? 'over' : ''}`} title={`Issue time since loading began (target ${target} min)`}>
      <Timer size={14} aria-hidden="true" />
      {fmtMinutes(mins)}
    </span>
  );
}

// Minimal toast — one message at a time.
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = 'info') => {
    const id = Date.now();
    setToast({ id, message, kind });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="alert tone-crit" role="alert">
      <span />
      <div>
        <strong>Could not load</strong>
        {error}{' '}
        {onRetry && (
          <button className="btn btn-sm" onClick={onRetry} style={{ marginLeft: 8 }}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
