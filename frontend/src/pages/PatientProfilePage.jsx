import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import StatusBadge from '../components/StatusBadge';
import ThermalRiskBar from '../components/ThermalRiskBar';
import GenomicRiskPanel from '../components/GenomicRiskPanel';

const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export default function PatientProfilePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [scans, setScans] = useState([]);
  const [reports, setReports] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load patient
        const patientDoc = await getDoc(doc(db, 'patients', patientId));
        if (!patientDoc.exists()) {
          toast.error('Patient not found');
          navigate('/dashboard');
          return;
        }
        setPatient(patientDoc.data());

        // Load scans — with fallback if composite index is missing
        let scansList = [];
        try {
          const scansQuery = query(
            collection(db, 'scans'),
            where('patientId', '==', patientId),
            orderBy('completedAt', 'desc')
          );
          const scansSnapshot = await getDocs(scansQuery);
          scansList = scansSnapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
        } catch (queryErr) {
          console.warn('Composite index not available, fetching without order:', queryErr.message);
          const fallbackQuery = query(
            collection(db, 'scans'),
            where('patientId', '==', patientId)
          );
          const scansSnapshot = await getDocs(fallbackQuery);
          scansList = scansSnapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          // Sort client-side
          scansList.sort((a, b) => {
            const aTime = a.completedAt?.toDate?.()?.getTime() || 0;
            const bTime = b.completedAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
        }
        setScans(scansList);

        // Load reports for each scan
        const reportsMap = {};
        for (const scan of scansList) {
          try {
            const reportDoc = await getDoc(doc(db, 'reports', scan.id));
            if (reportDoc.exists()) {
              reportsMap[scan.id] = reportDoc.data();
            }
          } catch {
            // Report may not exist yet
          }
        }
        setReports(reportsMap);
      } catch (error) {
        toast.error('Error loading patient data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [patientId, navigate]);

  const downloadReceipt = (scan) => {
    const report = reports[scan.id];
    try {
      const pdf = new jsPDF();
      let y = 15;

      // Header
      pdf.setFontSize(18);
      pdf.setTextColor(0, 128, 100);
      pdf.text('THERMASCAN AI — Patient Receipt', 10, y);
      y += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, y);
      y += 10;

      // Patient info
      pdf.setFontSize(13);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Patient Information', 10, y);
      y += 7;

      pdf.setFontSize(10);
      pdf.text(`Name: ${patient?.name || 'N/A'}`, 10, y); y += 5;
      pdf.text(`MRN: ${patient?.mrn || 'N/A'}`, 10, y); y += 5;
      pdf.text(`DOB: ${patient?.dob || 'N/A'}`, 10, y); y += 5;
      pdf.text(`Diabetes Type: ${patient?.diabetesType || 'N/A'}`, 10, y); y += 5;
      pdf.text(`Duration: ${patient?.duration || 'N/A'} years`, 10, y); y += 10;

      // Scan results
      pdf.setFontSize(13);
      pdf.text('Scan Results', 10, y);
      y += 7;

      pdf.setFontSize(10);
      const scanDate = scan.completedAt?.toDate
        ? new Date(scan.completedAt.toDate()).toLocaleString()
        : 'N/A';
      pdf.text(`Date: ${scanDate}`, 10, y); y += 5;
      pdf.text(`Status: ${scan.status || 'N/A'}`, 10, y); y += 5;
      pdf.text(`Confidence: ${(safeNum(scan.confidence) * 100).toFixed(1)}%`, 10, y); y += 5;
      pdf.text(`Thermal Risk Index: ${safeNum(scan.riskScore).toFixed(1)}/100`, 10, y); y += 5;
      pdf.text(`Asymmetry: ${safeNum(scan.asymmetry).toFixed(2)}`, 10, y); y += 5;
      pdf.text(`Variance: ${safeNum(scan.variance).toFixed(2)}`, 10, y); y += 5;
      pdf.text(`Edge Strength: ${safeNum(scan.edgeStrength).toFixed(2)}`, 10, y); y += 10;

      // Doctor review (if exists)
      if (report) {
        pdf.setFontSize(13);
        pdf.text('Doctor Review', 10, y);
        y += 7;

        pdf.setFontSize(10);
        pdf.text(`Diagnosis: ${report.finalDiagnosis || 'Pending'}`, 10, y); y += 5;

        if (report.doctorRemarks) {
          const remarks = pdf.splitTextToSize(`Remarks: ${report.doctorRemarks}`, 180);
          pdf.text(remarks, 10, y);
          y += remarks.length * 5 + 3;
        }

        if (report.treatmentPlan) {
          const plan = pdf.splitTextToSize(`Treatment: ${report.treatmentPlan}`, 180);
          pdf.text(plan, 10, y);
          y += plan.length * 5 + 3;
        }

        pdf.text(`Signed by: ${report.doctorSignature || 'N/A'}`, 10, y); y += 5;
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        'This receipt was generated by THERMASCAN AI — AI-assisted diabetic foot analysis.',
        10,
        pdf.internal.pageSize.getHeight() - 10
      );

      pdf.save(`Receipt_${patient?.mrn || 'patient'}_${scan.id.slice(0, 8)}.pdf`);
      toast.success('Receipt downloaded!');
    } catch (err) {
      toast.error('Failed to generate receipt: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen ">
        <div className="text-[#10B981] font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen py-8 px-4">
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-[#10B981] font-mono text-sm hover:text-[#10B981] transition-colors"
        >
          ← Back to Dashboard
        </button>

        {/* Patient Summary Card */}
        <div className="glow-card rounded-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h1 className="text-4xl font-bold text-[#10B981] font-mono mb-4">
                {patient?.name}
              </h1>
              <div className="space-y-2 font-mono text-[#1E1B4B]">
                <div>
                  <span className="text-[#6B7280]">MRN:</span>
                  <span className="ml-3 text-[#10B981]">{patient?.mrn}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">DOB:</span>
                  <span className="ml-3 text-[#10B981]">{patient?.dob}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Diabetes Type:</span>
                  <span className="ml-3 text-[#10B981]">
                    {patient?.diabetesType}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Duration:</span>
                  <span className="ml-3 text-[#10B981]">
                    {patient?.duration} years
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-mono text-[#6B7280] mb-3">
                KNOWN CONDITIONS
              </div>
              <div className="flex flex-wrap gap-2">
                {patient?.conditions && patient.conditions.length > 0 ? (
                  patient.conditions.map((condition) => (
                    <div
                      key={condition}
                      className="px-3 py-1 bg-[#FAF8FF] border border-[rgba(16,185,129,0.18)] rounded text-xs font-mono text-[#10B981]"
                    >
                      {condition}
                    </div>
                  ))
                ) : (
                  <div className="text-[#6B7280] text-xs font-mono">
                    No known conditions
                  </div>
                )}
              </div>

              {patient?.notes && (
                <div className="mt-6">
                  <div className="text-xs font-mono text-[#6B7280] mb-2">
                    CLINICAL NOTES
                  </div>
                  <div className="text-sm text-[#1E1B4B] font-mono">
                    {patient.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Genomic Risk Analysis Panel */}
        <div style={{ marginBottom: '2rem' }}>
          <GenomicRiskPanel patientId={patientId} />
        </div>

        {/* Scan Timeline */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#10B981] font-mono mb-6">
            SCAN HISTORY
          </h2>

          {scans.length === 0 ? (
            <div className="glow-card rounded-lg p-8 text-center">
              <div className="text-[#6B7280] font-mono">
                No scans recorded yet
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="glow-card rounded-lg p-6 border-l-4"
                  style={{
                    borderLeftColor:
                      scan.status === 'HEALTHY' ? '#10B981' : '#F87171',
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <StatusBadge status={scan.status || 'UNKNOWN'} size="sm" />
                        <span className="font-mono text-xs text-[#6B7280]">
                          {scan.completedAt?.toDate
                            ? new Date(scan.completedAt.toDate()).toLocaleString()
                            : 'Date unknown'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs font-mono text-[#6B7280] mb-1">
                            CONFIDENCE
                          </div>
                          <div className="text-lg font-mono text-[#10B981] font-bold">
                            {(safeNum(scan.confidence) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-mono text-[#6B7280] mb-1">
                            RISK INDEX
                          </div>
                          <div className="text-lg font-mono text-[#10B981] font-bold">
                            {safeNum(scan.riskScore).toFixed(1)}/100
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-mono text-[#6B7280] mb-1">
                            ASYMMETRY
                          </div>
                          <div className="text-lg font-mono text-[#10B981] font-bold">
                            {safeNum(scan.asymmetry).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-mono text-[#6B7280] mb-1">
                            VARIANCE
                          </div>
                          <div className="text-lg font-mono text-[#10B981] font-bold">
                            {safeNum(scan.variance).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <ThermalRiskBar
                          riskScore={safeNum(scan.riskScore)}
                          label=""
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/report/${scan.id}`)}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        VIEW REPORT
                      </button>
                      <button
                        onClick={() => downloadReceipt(scan)}
                        className="px-4 py-2 text-sm font-mono border border-[#6EE7B7] text-[#10B981] rounded hover:bg-[#6EE7B7] hover:text-[#ffffff] transition-all"
                      >
                        DOWNLOAD
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Scan Button */}
        <div className="mt-8">
          <button
            onClick={() => navigate(`/scan/${patientId}`)}
            className="btn-primary w-full py-4 font-bold uppercase text-lg"
          >
            + New Scan for {patient?.name || 'Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}
