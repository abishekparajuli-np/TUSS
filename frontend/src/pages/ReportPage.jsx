import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import StatusBadge from '../components/StatusBadge';
import ThermalRiskBar from '../components/ThermalRiskBar';
import PredictionBuffer from '../components/PredictionBuffer';

export default function ReportPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scanData, setScanData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [doctorRemarks, setDoctorRemarks] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Safe number helper — prevents .toFixed() crashes on undefined/null
  const safeNum = (val, fallback = 0) => {
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  // Load scan data
  useEffect(() => {
    const loadData = async () => {
      try {
        const scanDoc = await getDoc(doc(db, 'scans', scanId));
        if (!scanDoc.exists()) {
          toast.error('Scan not found');
          navigate('/dashboard');
          return;
        }

        const scan = scanDoc.data();
        setScanData(scan);

        // Load patient data
        if (scan.patientId) {
          const patientDoc = await getDoc(doc(db, 'patients', scan.patientId));
          if (patientDoc.exists()) {
            setPatientData(patientDoc.data());
          }
        }
      } catch (error) {
        toast.error('Error loading scan: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [scanId, navigate]);

  const generatePDF = () => {
    try {
      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 10;

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 128, 100);
      pdf.text('THERMASCAN AI', 10, yPosition);
      pdf.setFontSize(12);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Diabetic Foot Risk Assessment Report', 10, yPosition + 7);

      yPosition += 20;

      // Report metadata
      pdf.setFontSize(10);
      pdf.setTextColor(80, 110, 122);
      const reportDate = new Date().toLocaleString();
      pdf.text(`Report ID: ${scanId}`, 10, yPosition);
      pdf.text(`Generated: ${reportDate}`, 10, yPosition + 5);
      pdf.text(`Doctor: ${currentUser?.email || 'N/A'}`, 10, yPosition + 10);

      yPosition += 20;

      // Patient Section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 128, 100);
      pdf.text('PATIENT INFORMATION', 10, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`Name: ${patientData?.name || 'N/A'}`, 10, yPosition);
      pdf.text(`MRN: ${patientData?.mrn || 'N/A'}`, 10, yPosition + 5);
      pdf.text(`DOB: ${patientData?.dob || 'N/A'}`, 10, yPosition + 10);
      pdf.text(`Diabetes Type: ${patientData?.diabetesType || 'N/A'}`, 10, yPosition + 15);
      pdf.text(`Duration: ${patientData?.duration || 'N/A'} years`, 10, yPosition + 20);

      yPosition += 30;

      // AI Analysis Section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 128, 100);
      pdf.text('AI ANALYSIS RESULTS', 10, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`Status: ${scanData?.status || 'N/A'}`, 10, yPosition);
      pdf.text(`Confidence: ${(safeNum(scanData?.confidence) * 100).toFixed(1)}%`, 10, yPosition + 5);
      pdf.text(`Thermal Risk Index: ${safeNum(scanData?.riskScore).toFixed(1)}/100`, 10, yPosition + 10);
      pdf.text(`Asymmetry: ${safeNum(scanData?.asymmetry).toFixed(2)}`, 10, yPosition + 15);
      pdf.text(`Variance: ${safeNum(scanData?.variance).toFixed(2)}`, 10, yPosition + 20);
      pdf.text(`Edge Strength: ${safeNum(scanData?.edgeStrength).toFixed(2)}`, 10, yPosition + 25);

      yPosition += 35;

      // Doctor Review Section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 128, 100);
      pdf.text('DOCTOR REVIEW', 10, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setTextColor(50, 50, 50);
      
      const remarksLines = pdf.splitTextToSize(`Remarks: ${doctorRemarks || 'None'}`, 180);
      pdf.text(remarksLines, 10, yPosition);
      yPosition += remarksLines.length * 5 + 5;

      const diagnosisLines = pdf.splitTextToSize(`Final Diagnosis: ${finalDiagnosis || 'None'}`, 180);
      pdf.text(diagnosisLines, 10, yPosition);
      yPosition += diagnosisLines.length * 5 + 5;

      const planLines = pdf.splitTextToSize(`Treatment Plan: ${treatmentPlan || 'None'}`, 180);
      pdf.text(planLines, 10, yPosition);

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(84, 110, 122);
      pdf.text(
        'This report was generated with AI-assisted analysis and reviewed by a licensed physician.',
        10,
        pageHeight - 10
      );

      return pdf;
    } catch (error) {
      toast.error('PDF generation failed: ' + error.message);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Generate PDF (instant — pure JS, no network)
      const pdf = generatePDF();

      // 2. Download PDF locally (instant — triggers browser download)
      pdf.save(`THERMASCAN_Report_${scanId}.pdf`);

      // 3. Save report metadata to Firestore (fast — small document)
      await setDoc(doc(db, 'reports', scanId), {
        patientId: scanData?.patientId || '',
        doctorId: currentUser?.uid || '',
        generatedAt: serverTimestamp(),
        doctorRemarks,
        finalDiagnosis,
        treatmentPlan,
        doctorSignature: currentUser?.email || '',
        pdfUrl: '', // Storage upload skipped for speed
        aiSummary: `Analysis detected ${scanData?.status || 'UNKNOWN'} with ${(
          safeNum(scanData?.confidence) * 100
        ).toFixed(1)}% confidence.`,
      });

      toast.success('Report generated and downloaded!');

      // 4. Navigate immediately
      if (scanData?.patientId) {
        navigate(`/patients/${scanData.patientId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('Failed to submit report: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#00ffc8] font-mono mb-2">
            DOCTOR REVIEW & REPORT
          </h1>
          <p className="text-[#546e7a] font-mono text-sm">
            {patientData?.name || 'Unknown Patient'} • {patientData?.mrn || 'N/A'}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Scan Summary */}
          <div className="space-y-6">
            {/* Patient & Scan Info */}
            <div className="glow-card rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#00ffc8] font-mono mb-4">
                SCAN SUMMARY
              </h2>
              <div className="space-y-3 font-mono text-sm text-[#e0f7fa]">
                <div>
                  <span className="text-[#546e7a]">Status:</span>
                  <div className="mt-1">
                    <StatusBadge status={scanData?.status || 'UNKNOWN'} size="md" />
                  </div>
                </div>
                <div>
                  <span className="text-[#546e7a]">Confidence Score</span>
                  <div className="text-[#0080ff]">
                    {(safeNum(scanData?.confidence) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Thermal Risk Index */}
              <div className="mt-6 pt-6 border-t border-[rgba(0,255,200,0.15)]">
                <ThermalRiskBar
                  riskScore={safeNum(scanData?.riskScore)}
                  label="THERMAL RISK INDEX"
                />
              </div>

              {/* Key Metrics */}
              <div className="mt-6 pt-6 border-t border-[rgba(0,255,200,0.15)]">
                <div className="text-xs font-mono text-[#546e7a] mb-3">
                  KEY METRICS
                </div>
                <div className="space-y-2 font-mono text-sm text-[#e0f7fa]">
                  <div>
                    <span className="text-[#546e7a]">Asymmetry:</span>
                    <span className="ml-2 text-[#0080ff]">
                      {safeNum(scanData?.asymmetry).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#546e7a]">Variance:</span>
                    <span className="ml-2 text-[#0080ff]">
                      {safeNum(scanData?.variance).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#546e7a]">Edge Strength:</span>
                    <span className="ml-2 text-[#0080ff]">
                      {safeNum(scanData?.edgeStrength).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prediction Buffer */}
              <div className="mt-6 pt-6 border-t border-[rgba(0,255,200,0.15)]">
                <PredictionBuffer
                  history={scanData?.predictionHistory || []}
                  maxLength={60}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Doctor Feedback Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* AI Analysis Summary */}
              <div className="glow-card rounded-lg p-6">
                <h2 className="text-lg font-bold text-[#00ffc8] font-mono mb-4">
                  AI ANALYSIS SUMMARY
                </h2>
                <div className="bg-[#050d1a] rounded p-4 font-mono text-sm text-[#546e7a] border border-[rgba(0,255,200,0.1)]">
                  Analysis detected {scanData?.status || 'UNKNOWN'} with{' '}
                  {(safeNum(scanData?.confidence) * 100).toFixed(1)}% confidence. Thermal Risk
                  Index: {safeNum(scanData?.riskScore).toFixed(1)}/100. Significant hotspot
                  asymmetry: {safeNum(scanData?.asymmetry).toFixed(2)}. Edge pattern variance:{' '}
                  {safeNum(scanData?.variance).toFixed(2)}.
                </div>
              </div>

              {/* Doctor Remarks */}
              <div className="glow-card rounded-lg p-6">
                <label className="block text-xs font-mono text-[#546e7a] mb-2">
                  DOCTOR REMARKS
                </label>
                <textarea
                  value={doctorRemarks}
                  onChange={(e) => setDoctorRemarks(e.target.value)}
                  rows="4"
                  className="input-base w-full font-mono"
                  placeholder="Clinical observations and context..."
                  disabled={submitting}
                />
              </div>

              {/* Final Diagnosis */}
              <div className="glow-card rounded-lg p-6">
                <label className="block text-xs font-mono text-[#546e7a] mb-2">
                  FINAL DIAGNOSIS *
                </label>
                <select
                  value={finalDiagnosis}
                  onChange={(e) => setFinalDiagnosis(e.target.value)}
                  className="input-base w-full"
                  required
                  disabled={submitting}
                >
                  <option value="">Select diagnosis...</option>
                  <option value="No Diabetic Foot Ulcer Risk">
                    No Diabetic Foot Ulcer Risk
                  </option>
                  <option value="Low Risk — Monitor in 3 months">
                    Low Risk — Monitor in 3 months
                  </option>
                  <option value="Moderate Risk — Refer to podiatrist">
                    Moderate Risk — Refer to podiatrist
                  </option>
                  <option value="High Risk — Urgent wound care referral">
                    High Risk — Urgent wound care referral
                  </option>
                  <option value="Inconclusive — Repeat scan required">
                    Inconclusive — Repeat scan required
                  </option>
                </select>
              </div>

              {/* Treatment Plan */}
              <div className="glow-card rounded-lg p-6">
                <label className="block text-xs font-mono text-[#546e7a] mb-2">
                  TREATMENT PLAN
                </label>
                <textarea
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  rows="4"
                  className="input-base w-full font-mono"
                  placeholder="Recommended steps, medications, follow-up schedule..."
                  disabled={submitting}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !finalDiagnosis}
                className="btn-primary w-full font-bold uppercase py-3"
              >
                {submitting ? 'Generating Report...' : 'Generate Report Card'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
