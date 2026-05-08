import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { inferenceApi } from '../utils/inferenceApi';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import StatusBadge from '../components/StatusBadge';
import ThermalRiskBar from '../components/ThermalRiskBar';
import PredictionBuffer from '../components/PredictionBuffer';
import GenomicRiskPanel from '../components/GenomicRiskPanel';
import { genomicApi } from '../utils/genomicApi';

const GENE_ORDER = ['VEGF', 'MMP1', 'COL1A1', 'TNF', 'IL6'];

export default function ReportPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scanData, setScanData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [genomicData, setGenomicData] = useState(null);
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

        // If scan doesn't have images, try fetching live from backend
        if (!scan.thermalImage || !scan.modelInputImage) {
          try {
            const snapshotRes = await inferenceApi.getSnapshot();
            if (snapshotRes.data.thermal_frame) {
              scan.thermalImage = snapshotRes.data.thermal_frame;
            }
            if (snapshotRes.data.model_input) {
              scan.modelInputImage = snapshotRes.data.model_input;
            }
          } catch {
            console.warn('Could not fetch live snapshot — backend may be offline');
          }
        }

        setScanData(scan);

        // Load patient data
        if (scan.patientId) {
          const patientDoc = await getDoc(doc(db, 'patients', scan.patientId));
          if (patientDoc.exists()) {
            const pData = patientDoc.data();
            setPatientData(pData);

            // Load genomic profile if it exists in Firestore
            if (pData.genomic_profile) {
              setGenomicData(pData.genomic_profile);
            } else {
              // Try fetching from genomic server as fallback
              try {
                const gRes = await genomicApi.getGenomicProfile(scan.patientId);
                if (gRes.data?.genomic_profile) {
                  setGenomicData(gRes.data.genomic_profile);
                }
              } catch {
                // No genomic data available — that's okay
              }
            }
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
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const PW = pdf.internal.pageSize.getWidth();
      const PH = pdf.internal.pageSize.getHeight();
      const ML = 14, MR = PW - ML, CW = PW - ML * 2;
      let y = 0;

      const setFont = (size, style = 'normal', r = 30, g = 40, b = 55) => {
        pdf.setFontSize(size); pdf.setFont('helvetica', style); pdf.setTextColor(r, g, b);
      };
      const hLine = (yp, op = 0.18) => {
        pdf.setDrawColor(16, 185, 129); pdf.setLineWidth(0.25);
        pdf.setGState(new pdf.GState({ opacity: op }));
        pdf.line(ML, yp, MR, yp);
        pdf.setGState(new pdf.GState({ opacity: 1 }));
      };
      const sectionHeader = (label, yp) => {
        pdf.setFillColor(16, 185, 129); pdf.rect(ML, yp, 2, 4.5, 'F');
        setFont(9, 'bold', 16, 185, 129);
        pdf.text(label.toUpperCase(), ML + 4, yp + 3.5);
        hLine(yp + 5.5, 0.12); return yp + 9;
      };
      const lv = (label, value, lx, vx, yp) => {
        setFont(8, 'normal', 100, 116, 139); pdf.text(label, lx, yp);
        setFont(8.5, 'normal', 30, 40, 55); pdf.text(String(value ?? 'N/A'), vx, yp);
      };
      const pageCheck = (needed = 30) => {
        if (y + needed > PH - 20) {
          pdf.addPage(); y = 18;
          pdf.setFillColor(6, 16, 32); pdf.rect(0, 0, PW, 10, 'F');
          setFont(7, 'normal', 16, 185, 129);
          pdf.text('THERMASCAN AI  —  Continued', ML, 6.5);
          hLine(10, 0.1);
        }
      };

      // Header bar
      pdf.setFillColor(6, 16, 32); pdf.rect(0, 0, PW, 28, 'F');
      pdf.setFillColor(16, 185, 129); pdf.rect(0, 0, PW, 0.8, 'F');
      setFont(18, 'bold', 16, 185, 129); pdf.text('THERMASCAN AI', ML, 13);
      setFont(8, 'normal', 148, 163, 184); pdf.text('Diabetic Foot Ulcer Risk Assessment', ML, 19);
      setFont(7, 'normal', 100, 116, 139); pdf.text('CLINICAL REPORT  ·  CONFIDENTIAL', ML, 24.5);
      const rDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
      setFont(7, 'normal', 100, 116, 139);
      pdf.text('Report ID:', MR - 60, 13);
      setFont(7, 'bold', 200, 220, 240); pdf.text((scanId ?? 'N/A').slice(0, 18), MR - 40, 13);
      setFont(7, 'normal', 100, 116, 139); pdf.text('Generated:', MR - 60, 18);
      pdf.text(rDate, MR - 60, 22.5, { maxWidth: 60 });
      y = 36;

      // Patient Information
      y = sectionHeader('Patient Information', y);
      const c1 = ML + 4, c2 = ML + 4 + CW / 2, vo = 32;
      lv('Full Name',        patientData?.name         ?? 'N/A', c1, c1 + vo, y);
      lv('Date of Birth',    patientData?.dob          ?? 'N/A', c2, c2 + vo, y); y += 5.5;
      lv('MRN / Patient ID', patientData?.mrn          ?? 'N/A', c1, c1 + vo, y);
      lv('Diabetes Type',    patientData?.diabetesType ?? 'N/A', c2, c2 + vo, y); y += 5.5;
      lv('Physician',        currentUser?.email        ?? 'N/A', c1, c1 + vo, y);
      lv('Duration',         `${patientData?.duration ?? 'N/A'} yrs`, c2, c2 + vo, y); y += 5.5;
      if (patientData?.conditions?.length) {
        lv('Known Conditions', patientData.conditions.join(' · '), c1, c1 + vo, y); y += 5.5;
      }
      y += 4;

      // AI Analysis Results
      pageCheck(50); y = sectionHeader('AI Analysis Results', y);
      const status = scanData?.status ?? 'UNKNOWN';
      const isRisk = /risk|ulcer/i.test(status);
      const [bR, bG, bB] = isRisk ? [248, 113, 113] : [16, 185, 129];
      pdf.setFillColor(bR, bG, bB);
      pdf.setGState(new pdf.GState({ opacity: 0.1 }));
      pdf.roundedRect(c1, y, 60, 12, 2, 2, 'F');
      pdf.setGState(new pdf.GState({ opacity: 1 }));
      pdf.setDrawColor(bR, bG, bB); pdf.setLineWidth(0.4);
      pdf.roundedRect(c1, y, 60, 12, 2, 2, 'S');
      setFont(10, 'bold', bR, bG, bB);
      pdf.text(status, c1 + 30, y + 7.5, { align: 'center' });
      const conf = (safeNum(scanData?.confidence) * 100).toFixed(1);
      setFont(7.5, 'normal', 100, 116, 139); pdf.text('Confidence Score', c2, y + 3);
      setFont(14, 'bold', 16, 185, 129); pdf.text(`${conf}%`, c2, y + 10);
      y += 17;
      const metrics = [
        ['Thermal Risk Index', `${safeNum(scanData?.riskScore).toFixed(1)} / 100`],
        ['Thermal Asymmetry',  safeNum(scanData?.asymmetry).toFixed(3)],
        ['Variance',           safeNum(scanData?.variance).toFixed(3)],
        ['Edge Strength',      safeNum(scanData?.edgeStrength).toFixed(3)],
        ['Prediction Frames',  String(scanData?.predictionHistory?.length ?? 0)],
        ['Scan ID',            (scanId ?? '').slice(0, 14)],
      ];
      const cw3 = CW / 3;
      metrics.forEach(([lbl, val], idx) => {
        const mx = ML + 4 + (idx % 3) * cw3;
        const my = y + Math.floor(idx / 3) * 10;
        pageCheck(14);
        setFont(7.5, 'normal', 100, 116, 139); pdf.text(lbl, mx, my);
        setFont(9, 'bold', 34, 211, 153); pdf.text(val, mx, my + 5);
      });
      y += Math.ceil(metrics.length / 3) * 10 + 6;

      // Thermal Images
      const tb64 = scanData?.thermalImage;
      const mb64 = scanData?.modelInputImage;
      if (tb64 || mb64) {
        pageCheck(80); y = sectionHeader('Captured Scan Images', y);
        const iw = 75, ih = 58;
        if (tb64?.length > 100) {
          setFont(7, 'normal', 100, 116, 139); pdf.text('Thermal Camera Feed', ML + 4, y);
          try { pdf.addImage('data:image/jpeg;base64,' + tb64, 'JPEG', ML + 4, y + 2, iw, ih); }
          catch { pdf.text('[Image unavailable]', ML + 4, y + 30); }
        }
        if (mb64?.length > 100) {
          const ix = tb64 ? ML + 4 + iw + 8 : ML + 4;
          setFont(7, 'normal', 100, 116, 139); pdf.text('Model Input (224x224)', ix, y);
          try { pdf.addImage('data:image/jpeg;base64,' + mb64, 'JPEG', ix, y + 2, 58, 58); }
          catch { pdf.text('[Image unavailable]', ix, y + 30); }
        }
        y += ih + 12;
      }

      // Genomic Risk Analysis (only if genomic data exists)
      if (genomicData) {
        pageCheck(75); y = sectionHeader('Genomic Risk Analysis', y);

        // Source file information
        if (genomicData.source_file) {
          setFont(7.5, 'normal', 100, 116, 139); pdf.text('Source File:', c1, y);
          setFont(8, 'normal', 30, 40, 55); pdf.text(genomicData.source_file, c1 + 25, y);
          y += 5.5;
        }

        // PRS Score bar
        const prs = genomicData.prs || 0;
        const riskCat = genomicData.risk_category || 'N/A';
        const [prR, prG, prB] = prs < 0.3 ? [16, 185, 129] : prs < 0.6 ? [245, 158, 11] : [248, 113, 113];

        setFont(8, 'normal', 100, 116, 139); pdf.text('Polygenic Risk Score (PRS)', c1, y);
        // PRS bar background
        pdf.setFillColor(229, 231, 235); pdf.roundedRect(c1, y + 2, 80, 5, 1.5, 1.5, 'F');
        // PRS bar fill
        pdf.setFillColor(prR, prG, prB); pdf.roundedRect(c1, y + 2, 80 * prs, 5, 1.5, 1.5, 'F');
        // PRS value
        setFont(12, 'bold', prR, prG, prB); pdf.text(`${(prs * 100).toFixed(0)}%`, c1 + 85, y + 6);
        // Risk category badge
        pdf.setFillColor(prR, prG, prB);
        pdf.setGState(new pdf.GState({ opacity: 0.12 }));
        pdf.roundedRect(c1 + 100, y, 28, 7, 1.5, 1.5, 'F');
        pdf.setGState(new pdf.GState({ opacity: 1 }));
        setFont(7, 'bold', prR, prG, prB); pdf.text(riskCat, c1 + 114, y + 5, { align: 'center' });
        y += 12;

        // Total variants
        setFont(7.5, 'normal', 100, 116, 139); pdf.text('Total Variants Detected:', c1, y);
        setFont(9, 'bold', 30, 40, 55); pdf.text(String(genomicData.variants_detected || 0), c1 + 42, y);
        y += 8;

        // Per-gene table with expanded variant info
        pageCheck(55);
        const gCols = [c1, c1 + 25, c1 + 42, c1 + 62, c1 + 85, c1 + 110];
        const gHeaders = ['Gene', 'Weight', 'Variants', 'SNPs/INDELs', 'Alignment', 'Status'];
        const gWeights = { VEGF: '30%', MMP1: '25%', COL1A1: '20%', TNF: '15%', IL6: '10%' };

        // Table header
        pdf.setFillColor(245, 243, 255); pdf.rect(c1 - 2, y - 1, CW - 2, 6, 'F');
        gHeaders.forEach((h, i) => { setFont(6, 'bold', 100, 116, 139); pdf.text(h, gCols[i], y + 3); });
        y += 7;

        // Table rows
        GENE_ORDER.forEach((gene, idx) => {
          pageCheck(8);
          const ld = genomicData.locus_details?.[gene] || {};
          const alignPct = ((ld.alignment_score || 0) * 100).toFixed(1) + '%';
          const vc = ld.variant_count || 0;
          const snpIndel = `${ld.snp_count || 0}/${ld.indel_count || 0}`;
          const statusColor = vc === 0 ? [16, 185, 129] : [248, 113, 113];

          if (idx % 2 === 1) { pdf.setFillColor(249, 248, 255); pdf.rect(c1 - 2, y - 1, CW - 2, 5.5, 'F'); }
          setFont(7, 'normal', 30, 40, 55); pdf.text(gene, gCols[0], y + 3);
          setFont(6.5, 'normal', 100, 116, 139); pdf.text(gWeights[gene], gCols[1], y + 3);
          setFont(7, 'bold', statusColor[0], statusColor[1], statusColor[2]); pdf.text(String(vc), gCols[2], y + 3);
          setFont(6, 'normal', 30, 40, 55); pdf.text(snpIndel, gCols[3], y + 3);
          setFont(6.5, 'normal', 30, 40, 55); pdf.text(alignPct, gCols[4], y + 3);
          setFont(6.5, 'normal', statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(vc === 0 ? 'Normal' : 'Variant', gCols[5], y + 3);
          y += 6;
        });
        y += 6;
      }

      // Physician Review
      pageCheck(55); y = sectionHeader('Physician Review & Assessment', y);
      pdf.setFillColor(16, 185, 129);
      pdf.setGState(new pdf.GState({ opacity: 0.07 }));
      pdf.rect(ML, y, CW + 2, 8, 'F');
      pdf.setGState(new pdf.GState({ opacity: 1 }));
      setFont(7.5, 'normal', 100, 116, 139); pdf.text('Final Diagnosis', ML + 4, y + 3.2);
      setFont(9, 'bold', 16, 185, 129); pdf.text(finalDiagnosis || 'Not specified', ML + 4, y + 7.2);
      y += 11;
      if (doctorRemarks) {
        pageCheck(20); setFont(7.5, 'normal', 100, 116, 139);
        pdf.text('Clinical Remarks', ML + 4, y); y += 4;
        setFont(8.5, 'normal', 40, 55, 70);
        const rl = pdf.splitTextToSize(doctorRemarks, CW - 6); pdf.text(rl, ML + 4, y);
        y += rl.length * 4.2 + 4;
      }
      if (treatmentPlan) {
        pageCheck(20); setFont(7.5, 'normal', 100, 116, 139);
        pdf.text('Treatment Plan', ML + 4, y); y += 4;
        setFont(8.5, 'normal', 40, 55, 70);
        const pl = pdf.splitTextToSize(treatmentPlan, CW - 6); pdf.text(pl, ML + 4, y);
        y += pl.length * 4.2 + 4;
      }

      // Signature
      pageCheck(28); y += 8; hLine(y, 0.15); y += 5;
      setFont(7.5, 'normal', 100, 116, 139);
      pdf.text('Physician Signature', ML + 4, y); pdf.text('Date', ML + 90, y); y += 8;
      pdf.setDrawColor(80, 100, 120); pdf.setLineWidth(0.25);
      pdf.line(ML + 4, y, ML + 80, y); pdf.line(ML + 90, y, ML + 130, y); y += 4;
      setFont(7, 'normal', 30, 40, 55);
      pdf.text(currentUser?.email ?? '', ML + 4, y);
      pdf.text(new Date().toLocaleDateString(), ML + 90, y);

      // Footer on every page
      const total = pdf.internal.getNumberOfPages();
      for (let pg = 1; pg <= total; pg++) {
        pdf.setPage(pg);
        pdf.setFillColor(6, 16, 32); pdf.rect(0, PH - 10, PW, 10, 'F');
        pdf.setFillColor(16, 185, 129); pdf.rect(0, PH - 10, PW, 0.5, 'F');
        setFont(6.5, 'normal', 80, 96, 115);
        pdf.text('CONFIDENTIAL — For authorized clinical use only. AI-assisted analysis reviewed by a licensed physician.', ML, PH - 4.5);
        pdf.text(`Page ${pg} of ${total}`, MR, PH - 4.5, { align: 'right' });
      }

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
      const reportData = {
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
        ).toFixed(1)}% confidence.${genomicData ? ` Genomic PRS: ${(safeNum(genomicData.prs) * 100).toFixed(0)}% (${genomicData.risk_category || 'N/A'}).` : ''}`,
        // Thermal data snapshot for consistent viewing
        scanStatus: scanData?.status || 'UNKNOWN',
        scanConfidence: safeNum(scanData?.confidence),
        scanRiskScore: safeNum(scanData?.riskScore),
        scanAsymmetry: safeNum(scanData?.asymmetry),
        scanVariance: safeNum(scanData?.variance),
        scanEdgeStrength: safeNum(scanData?.edgeStrength),
      };

      // Include genomic data in the report document for consistent viewing
      if (genomicData) {
        reportData.genomicProfile = {
          prs: genomicData.prs || 0,
          risk_category: genomicData.risk_category || 'UNKNOWN',
          variants_detected: genomicData.variants_detected || 0,
          locus_details: genomicData.locus_details || {},
          source_file: genomicData.source_file || '',
          last_updated: genomicData.last_updated || '',
        };
      }

      await setDoc(doc(db, 'reports', scanId), reportData);

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
      <div className="flex items-center justify-center min-h-screen ">
        <div className="text-[#10B981] font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen py-8 px-4">
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#10B981] font-mono mb-2">
            DOCTOR REVIEW & REPORT
          </h1>
          <p className="text-[#6B7280] font-mono text-sm">
            {patientData?.name || 'Unknown Patient'} • {patientData?.mrn || 'N/A'}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Scan Summary */}
          <div className="space-y-6">
            {/* Patient & Scan Info */}
            <div className="glow-card rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#10B981] font-mono mb-4">
                SCAN SUMMARY
              </h2>
              <div className="space-y-3 font-mono text-sm text-[#1E1B4B]">
                <div>
                  <span className="text-[#6B7280]">Status:</span>
                  <div className="mt-1">
                    <StatusBadge status={scanData?.status || 'UNKNOWN'} size="md" />
                  </div>
                </div>
                <div>
                  <span className="text-[#6B7280]">Confidence Score</span>
                  <div className="text-[#10B981]">
                    {(safeNum(scanData?.confidence) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Captured Images */}
              {(scanData?.thermalImage || scanData?.modelInputImage) && (
                <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                  <div className="text-xs font-mono text-[#6B7280] mb-3">
                    CAPTURED IMAGES
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {scanData?.thermalImage && (
                      <div>
                        <div className="text-xs font-mono text-[#6B7280] mb-1">Thermal Feed</div>
                        <img
                          src={`data:image/jpeg;base64,${scanData.thermalImage}`}
                          alt="Thermal Camera Feed"
                          className="w-full rounded border border-[rgba(16,185,129,0.18)]"
                        />
                      </div>
                    )}
                    {scanData?.modelInputImage && (
                      <div>
                        <div className="text-xs font-mono text-[#6B7280] mb-1">Model Input</div>
                        <img
                          src={`data:image/jpeg;base64,${scanData.modelInputImage}`}
                          alt="Model Input 224x224"
                          className="w-full rounded border border-[rgba(16,185,129,0.18)]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thermal Risk Index */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <ThermalRiskBar
                  riskScore={safeNum(scanData?.riskScore)}
                  label="THERMAL RISK INDEX"
                />
              </div>

              {/* Key Metrics */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <div className="text-xs font-mono text-[#6B7280] mb-3">
                  KEY METRICS
                </div>
                <div className="space-y-2 font-mono text-sm text-[#1E1B4B]">
                  <div>
                    <span className="text-[#6B7280]">Asymmetry:</span>
                    <span className="ml-2 text-[#10B981]">
                      {safeNum(scanData?.asymmetry).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Variance:</span>
                    <span className="ml-2 text-[#10B981]">
                      {safeNum(scanData?.variance).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Edge Strength:</span>
                    <span className="ml-2 text-[#10B981]">
                      {safeNum(scanData?.edgeStrength).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prediction Buffer */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <PredictionBuffer
                  history={scanData?.predictionHistory || []}
                  maxLength={60}
                />
              </div>

              {/* Genomic Risk Analysis */}
              {scanData?.patientId && (
                <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                  <GenomicRiskPanel patientId={scanData.patientId} />
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Doctor Feedback Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* AI Analysis Summary */}
              <div className="glow-card rounded-lg p-6">
                <h2 className="text-lg font-bold text-[#10B981] font-mono mb-4">
                  AI ANALYSIS SUMMARY
                </h2>
                <div className=" rounded p-4 font-mono text-sm text-[#6B7280] border border-[rgba(16,185,129,0.15)]">
                  Analysis detected {scanData?.status || 'UNKNOWN'} with{' '}
                  {(safeNum(scanData?.confidence) * 100).toFixed(1)}% confidence. Thermal Risk
                  Index: {safeNum(scanData?.riskScore).toFixed(1)}/100. Significant hotspot
                  asymmetry: {safeNum(scanData?.asymmetry).toFixed(2)}. Edge pattern variance:{' '}
                  {safeNum(scanData?.variance).toFixed(2)}.
                </div>
              </div>

              {/* Doctor Remarks */}
              <div className="glow-card rounded-lg p-6">
                <label className="block text-xs font-mono text-[#6B7280] mb-2">
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
                <label className="block text-xs font-mono text-[#6B7280] mb-2">
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
                <label className="block text-xs font-mono text-[#6B7280] mb-2">
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
