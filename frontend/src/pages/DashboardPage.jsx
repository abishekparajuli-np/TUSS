import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';

const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    scansToday: 0,
    highRiskToday: 0,
    patientsSeen: 0,
  });
  const [recentScans, setRecentScans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all scans for this doctor
        let allScans = [];
        try {
          const scansQuery = query(
            collection(db, 'scans'),
            where('doctorId', '==', currentUser.uid),
            orderBy('completedAt', 'desc'),
            limit(50)
          );
          const scansSnapshot = await getDocs(scansQuery);
          allScans = scansSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        } catch (queryErr) {
          // If composite index is missing, try without orderBy
          console.warn('Composite index not available, fetching without order:', queryErr.message);
          const fallbackQuery = query(
            collection(db, 'scans'),
            where('doctorId', '==', currentUser.uid),
            limit(50)
          );
          const scansSnapshot = await getDocs(fallbackQuery);
          allScans = scansSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Sort client-side
          allScans.sort((a, b) => {
            const aTime = a.completedAt?.toDate?.()?.getTime() || 0;
            const bTime = b.completedAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
        }

        // Filter today's scans client-side
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayScans = allScans.filter((s) => {
          const scanDate = s.completedAt?.toDate?.();
          return scanDate && scanDate >= today;
        });

        setRecentScans(allScans.slice(0, 10));

        // Calculate stats
        const highRiskCount = todayScans.filter(
          (s) => s.status === 'ULCER RISK'
        ).length;
        const uniquePatients = new Set(todayScans.map((s) => s.patientId)).size;

        setStats({
          scansToday: todayScans.length,
          highRiskToday: highRiskCount,
          patientsSeen: uniquePatients,
        });

        // Load all patients for the patient list
        try {
          const patientsSnapshot = await getDocs(collection(db, 'patients'));
          const patientsList = patientsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setPatients(patientsList);
        } catch (err) {
          console.warn('Failed to load patients:', err.message);
        }
      } catch (error) {
        toast.error('Error loading dashboard: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const filteredPatients = patients.filter((p) =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.mrn || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050d1a]">
        <div className="text-[#00ffc8] font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen py-8 px-4">

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-[#00ffc8] font-mono mb-2">
              THERMASCAN DASHBOARD
            </h1>
            <p className="text-[#546e7a] font-mono text-sm">
              Welcome back, {currentUser.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 md:mt-0 px-4 py-2 font-mono text-sm border border-[#00ffc8] text-[#00ffc8] rounded hover:bg-[#00ffc8] hover:text-[#050d1a] transition-all"
          >
            Logout
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glow-card rounded-lg p-6">
            <div className="text-xs font-mono text-[#546e7a] mb-2">
              TOTAL SCANS TODAY
            </div>
            <div className="text-4xl font-bold text-[#00ffc8] font-mono">
              {stats.scansToday}
            </div>
          </div>

          <div className="glow-card rounded-lg p-6">
            <div className="text-xs font-mono text-[#546e7a] mb-2">
              HIGH RISK TODAY
            </div>
            <div className="text-4xl font-bold text-[#ff4b6e] font-mono">
              {stats.highRiskToday}
            </div>
          </div>

          <div className="glow-card rounded-lg p-6">
            <div className="text-xs font-mono text-[#546e7a] mb-2">
              PATIENTS SEEN
            </div>
            <div className="text-4xl font-bold text-[#0080ff] font-mono">
              {stats.patientsSeen}
            </div>
          </div>
        </div>

        {/* Patient List Modal */}
        {showPatientList && (
          <div className="glow-card rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#00ffc8] font-mono">
                ALL PATIENTS
              </h2>
              <button
                onClick={() => setShowPatientList(false)}
                className="text-[#546e7a] hover:text-[#00ffc8] font-mono text-sm transition-colors"
              >
                ✕ Close
              </button>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN..."
              className="input-base w-full mb-4 font-mono"
            />

            {filteredPatients.length === 0 ? (
              <div className="text-[#546e7a] font-mono text-sm py-4 text-center">
                {patients.length === 0 ? 'No patients registered yet' : 'No matching patients'}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 bg-[#050d1a] rounded border border-[rgba(0,255,200,0.1)] hover:border-[rgba(0,255,200,0.3)] cursor-pointer transition-all"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <div>
                      <div className="font-mono text-sm text-[#e0f7fa] font-bold">
                        {p.name || 'Unknown'}
                      </div>
                      <div className="font-mono text-xs text-[#546e7a]">
                        MRN: {p.mrn || 'N/A'} • {p.diabetesType || ''} • {p.duration || '?'} yrs
                      </div>
                    </div>
                    <div className="text-[#00ffc8] font-mono text-xs">
                      View →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Scans */}
          <div className="lg:col-span-2">
            <div className="glow-card rounded-lg p-6 mb-6">
              <h2 className="text-lg font-bold text-[#00ffc8] font-mono mb-4">
                RECENT SCANS
              </h2>

              {recentScans.length === 0 ? (
                <div className="text-[#546e7a] font-mono text-sm">
                  No scans recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between p-4 bg-[#050d1a] rounded border border-[rgba(0,255,200,0.1)] hover:border-[rgba(0,255,200,0.3)] cursor-pointer transition-all"
                      onClick={() => navigate(`/report/${scan.id}`)}
                    >
                      <div className="flex-1">
                        <StatusBadge status={scan.status || 'UNKNOWN'} size="sm" />
                        <div className="text-xs font-mono text-[#546e7a] mt-2">
                          {scan.completedAt?.toDate
                            ? new Date(scan.completedAt.toDate()).toLocaleString()
                            : 'Date unknown'}
                        </div>
                      </div>

                      <div className="text-right font-mono text-sm text-[#0080ff]">
                        {(safeNum(scan.confidence) * 100).toFixed(1)}% confidence
                        <div className="text-xs text-[#546e7a] mt-1">
                          Risk: {safeNum(scan.riskScore).toFixed(1)}/100
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <button
              onClick={() => navigate('/patients/new')}
              className="btn-primary w-full py-4 font-bold uppercase text-lg"
            >
              + NEW PATIENT SCAN
            </button>

            <div className="glow-card rounded-lg p-6">
              <h3 className="text-sm font-bold text-[#00ffc8] font-mono mb-4">
                QUICK LINKS
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/patients/new')}
                  className="w-full text-left px-4 py-2 rounded font-mono text-sm text-[#e0f7fa] hover:bg-[#0a1628] transition-all"
                >
                  → Register New Patient
                </button>
                <button
                  onClick={() => setShowPatientList(true)}
                  className="w-full text-left px-4 py-2 rounded font-mono text-sm text-[#e0f7fa] hover:bg-[#0a1628] transition-all"
                >
                  → View Patient History
                </button>
                <button
                  onClick={() => {
                    if (recentScans.length === 0) {
                      toast.error('No scans to download');
                      return;
                    }
                    // Navigate to the most recent scan's report
                    navigate(`/report/${recentScans[0].id}`);
                  }}
                  className="w-full text-left px-4 py-2 rounded font-mono text-sm text-[#e0f7fa] hover:bg-[#0a1628] transition-all"
                >
                  → Download Reports
                </button>
              </div>
            </div>

            <div className="glow-card rounded-lg p-6">
              <h3 className="text-sm font-bold text-[#00ffc8] font-mono mb-3">
                SYSTEM STATUS
              </h3>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00e676]" />
                  <span className="text-[#e0f7fa]">Server Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00e676]" />
                  <span className="text-[#e0f7fa]">Database Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ffa500]" />
                  <span className="text-[#e0f7fa]">Inference Server</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
