import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';

const safeNum = (val, fb = 0) => { const n = Number(val); return isNaN(n) ? fb : n; };

const fmtDate = (ts) => {
  if (!ts?.toDate) return '—';
  return new Date(ts.toDate()).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ scansToday: 0, highRiskToday: 0, patientsSeen: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showPatients, setShowPatients] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        let scans = [];
        try {
          const snap = await getDocs(query(
            collection(db, 'scans'),
            where('doctorId', '==', currentUser.uid),
            orderBy('completedAt', 'desc'),
            limit(50)
          ));
          scans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
          const snap = await getDocs(query(
            collection(db, 'scans'),
            where('doctorId', '==', currentUser.uid),
            limit(50)
          ));
          scans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          scans.sort((a, b) => (b.completedAt?.toDate?.()?.getTime() || 0) - (a.completedAt?.toDate?.()?.getTime() || 0));
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayScans = scans.filter(s => { const d = s.completedAt?.toDate?.(); return d && d >= today; });

        setRecentScans(scans.slice(0, 10));
        setStats({
          scansToday:    todayScans.length,
          highRiskToday: todayScans.filter(s => s.status === 'ULCER RISK').length,
          patientsSeen:  new Set(todayScans.map(s => s.patientId)).size,
        });

        const pSnap = await getDocs(collection(db, 'patients')).catch(() => ({ docs: [] }));
        setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        toast.error('Could not load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); }
    catch { toast.error('Logout failed'); }
  };

  const filtered = patients.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.mrn  || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <span style={{ color: 'var(--lavender)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
            <img src="/logo1.png" alt="पैताला" style={{ width: '6rem', height: '6rem', borderRadius: '6px', marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Hello, Doctor!
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.email}
            </span>
            <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: '0.8rem' }}>
              Sign out
            </button>
          </div>
        </header>

        {/* ── Stats Row ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Scans today',   value: stats.scansToday,    sub: 'completed',   accent: 'var(--emerald)',  border: 'var(--emerald)', bg: '#F0FDF4' },
            { label: 'High risk',     value: stats.highRiskToday, sub: 'flagged',      accent: 'var(--danger)',   border: 'var(--danger)',  bg: '#FFF1F2' },
            { label: 'Patients seen', value: stats.patientsSeen,  sub: 'unique today', accent: 'var(--lavender)', border: 'var(--lavender)',bg: '#F5F3FF' },
          ].map(({ label, value, sub, accent, border, bg }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${border}30`,
                borderTop: `3px solid ${border}`,
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: '2.5rem', fontWeight: 700, color: accent, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main 2-col layout ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

          {/* Recent Scans */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-heading)' }}>Recent scans</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Last {recentScans.length} records</p>
              </div>
              <span className="pill pill-lav">{recentScans.length} total</span>
            </div>

            {recentScans.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No scans recorded yet
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', padding: '0.6rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', gap: '0.5rem' }}>
                  {['Status', 'Confidence', 'Risk', 'Date'].map(h => (
                    <span key={h} className="label">{h}</span>
                  ))}
                </div>

                {recentScans.map((scan, i) => (
                  <div
                    key={scan.id}
                    onClick={() => navigate(`/report/${scan.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
                      padding: '0.875rem 1.5rem',
                      gap: '0.5rem',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: i % 2 !== 0 ? 'var(--bg-row-alt)' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 !== 0 ? 'var(--bg-row-alt)' : 'transparent'}
                  >
                    <div><StatusBadge status={scan.status || 'UNKNOWN'} size="sm" /></div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-body)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                      {(safeNum(scan.confidence) * 100).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {safeNum(scan.riskScore).toFixed(0)}<span style={{ fontSize: '0.7rem' }}>/100</span>
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      {fmtDate(scan.completedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* CTA */}
            <button
              className="btn-primary"
              onClick={() => navigate('/patients/new')}
              style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', borderRadius: '10px' }}
            >
              + New Patient Scan
            </button>

            {/* Quick links */}
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.6rem' }}>Quick links</p>
              {[
                { label: 'Register new patient',  fn: () => navigate('/patients/new') },
                { label: 'Browse patient history', fn: () => setShowPatients(v => !v) },
                { label: 'Open latest report',    fn: () => recentScans.length ? navigate(`/report/${recentScans[0].id}`) : toast.error('No scans yet') },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={fn}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '7px',
                    fontSize: '0.8375rem',
                    color: 'var(--text-body)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EDE9FE'; e.currentTarget.style.color = 'var(--lavender-dk)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* System status */}
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.75rem' }}>System status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Database',        ok: true  },
                  { label: 'Auth service',     ok: true  },
                  { label: 'Inference server', ok: false },
                ].map(({ label, ok }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span
                      className="pill"
                      style={ok
                        ? { background: '#D1FAE5', color: '#065F46', fontSize: '0.68rem' }
                        : { background: '#FEF9C3', color: '#78350F', fontSize: '0.68rem' }
                      }
                    >
                      <span
                        className="dot"
                        style={{ background: ok ? 'var(--emerald)' : '#F59E0B', width: '6px', height: '6px' }}
                      />
                      {ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Patient list panel ──────────────────────────────────────── */}
        {showPatients && (
          <div className="card" style={{ marginTop: '1.25rem', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-heading)' }}>All patients</h3>
              <button className="btn-ghost" onClick={() => setShowPatients(false)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}>Close</button>
            </div>
            <div style={{ padding: '1rem 1.5rem' }}>
              <input
                className="input-base"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or MRN…"
                style={{ marginBottom: '0.75rem' }}
              />
              {filtered.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  {patients.length === 0 ? 'No patients registered yet' : 'No matching results'}
                </p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {filtered.map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/patients/${p.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.5rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: i % 2 !== 0 ? 'var(--bg-row-alt)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EDE9FE'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 !== 0 ? 'var(--bg-row-alt)' : 'transparent'}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-heading)' }}>{p.name || 'Unknown'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          MRN {p.mrn || 'N/A'} · {p.diabetesType || 'Type ?'} · {p.duration || '?'} yrs
                        </p>
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--lavender)', fontWeight: 600 }}>View →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
