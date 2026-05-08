import React, { useState, useEffect, useRef } from 'react';
import { genomicApi } from '../utils/genomicApi';
import { db } from '../utils/firebaseInit';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

/**
 * GenomicRiskPanel — Displays genomic risk analysis results.
 *
 * Features:
 *   - SVG circular gauge showing PRS score (0.0–1.0)
 *   - Gene table with variant count and alignment % per locus
 *   - Clinical risk banner with fused score and risk badge
 *   - FASTQ file upload with progress indicator
 *
 * Props:
 *   - patientId: string (Firebase patient document ID)
 */

const GENE_ORDER = ['VEGF', 'MMP1', 'COL1A1', 'TNF', 'IL6'];
const GENE_LABELS = {
  VEGF: 'VEGF (Angiogenesis)',
  MMP1: 'MMP1 (Tissue Remodeling)',
  COL1A1: 'COL1A1 (Collagen)',
  TNF: 'TNF (Inflammation)',
  IL6: 'IL6 (Immune Response)',
};
const GENE_WEIGHTS = { VEGF: '30%', MMP1: '25%', COL1A1: '20%', TNF: '15%', IL6: '10%' };

function getRiskColor(score) {
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  if (validScore < 0.3) return '#10B981';
  if (validScore < 0.6) return '#F59E0B';
  return '#F87171';
}

function getRiskBg(score) {
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  if (validScore < 0.3) return '#D1FAE5';
  if (validScore < 0.6) return '#FEF9C3';
  return '#FEE2E2';
}

function getRiskLabel(category) {
  const map = { LOW: 'Low Risk', MODERATE: 'Moderate Risk', HIGH: 'High Risk' };
  return map[category] || category;
}

/* ── Circular Gauge (SVG) ──────────────────────────────────────────── */
function CircularGauge({ score, size = 160, strokeWidth = 12 }) {
  // Validate score is a number
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, validScore));
  const dashOffset = circumference * (1 - progress);
  const color = getRiskColor(validScore);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
      />
      {/* Colored arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={Number.isFinite(dashOffset) ? dashOffset : circumference}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
      />
      {/* Center text */}
      <text
        x={size / 2} y={size / 2 - 8}
        textAnchor="middle" dominantBaseline="central"
        fill={color}
        style={{ fontSize: '2rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {(validScore * 100).toFixed(0)}
      </text>
      <text
        x={size / 2} y={size / 2 + 16}
        textAnchor="middle" dominantBaseline="central"
        fill="#6B7280"
        style={{ fontSize: '0.65rem', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
      >
        PRS SCORE
      </text>
    </svg>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function GenomicRiskPanel({ patientId }) {
  const [profile, setProfile] = useState(null);
  const [fusedHistory, setFusedHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef(null);

  // Load existing genomic profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await genomicApi.getGenomicProfile(patientId);
        setProfile(res.data.genomic_profile);
        setFusedHistory(res.data.fused_risk_history || []);
      } catch {
        // No profile yet — that's fine
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [patientId]);

  // Handle FASTQ upload
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['fastq', 'fq', 'txt'].includes(ext)) {
      toast.error('Please upload a FASTQ file (.fastq, .fq, or .txt)');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large (max 50MB)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await genomicApi.uploadFastq(patientId, file, (pct) => {
        setUploadProgress(pct);
      });

      const data = res.data;
      
      // Map locus details
      const locusDetails = {};
      for (const [gene, details] of Object.entries(data.locus_details || {})) {
        locusDetails[gene] = {
          variant_count: details.variant_count,
          alignment_score: details.alignment_score,
          snp_count: details.snp_count || 0,
          indel_count: details.indel_count || 0,
          deletion_count: details.deletion_count || 0,
        };
      }

      // Build profile from response
      const genomicProfile = {
        prs: data.prs,
        risk_category: data.risk_category,
        variants_detected: data.total_variants,
        locus_details: locusDetails,
        last_updated: data.timestamp || new Date().toISOString(),
        source_file: file.name,
      };

      setProfile(genomicProfile);

      // Save genomic profile to Firestore
      try {
        const patientRef = doc(db, 'patients', patientId);
        const patientSnap = await getDoc(patientRef);
        
        if (patientSnap.exists()) {
          // Update existing patient document
          await updateDoc(patientRef, {
            genomic_profile: genomicProfile,
            genomic_updated_at: new Date().toISOString(),
          });
        } else {
          // Create new patient document with genomic profile
          await setDoc(patientRef, {
            genomic_profile: genomicProfile,
            genomic_updated_at: new Date().toISOString(),
          }, { merge: true });
        }
        console.log('Genomic data saved to Firestore');
      } catch (dbErr) {
        console.warn('Could not save genomic profile to Firestore:', dbErr);
      }

      // Update fused history if available
      if (data.fused_result) {
        setFusedHistory((prev) => [
          ...prev,
          {
            fused_score: data.fused_result.fused_score,
            risk_level: data.fused_result.risk_level,
            clinical_flag: data.fused_result.clinical_flag,
            timestamp: data.timestamp,
          },
        ]);
      }

      toast.success(`Genomic analysis complete — PRS: ${(data.prs * 100).toFixed(0)}% (${data.risk_category})`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed';
      toast.error(`Genomic analysis failed: ${msg}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Trigger re-fusion with latest thermal data
  const handleRefuse = async () => {
    try {
      const res = await genomicApi.triggerFusion(patientId);
      const fused = res.data.fused_result;
      setFusedHistory((prev) => [
        ...prev,
        {
          fused_score: fused.fused_score,
          risk_level: fused.risk_level,
          clinical_flag: fused.clinical_flag,
          timestamp: new Date().toISOString(),
        },
      ]);
      toast.success(`Fusion updated: ${(fused.fused_score * 100).toFixed(0)}% (${fused.risk_level})`);
    } catch (err) {
      toast.error('Fusion failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const latestFused = fusedHistory.length > 0 ? fusedHistory[fusedHistory.length - 1] : null;

  if (loading) {
    return (
      <div className="glow-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <span style={{ color: 'var(--lavender)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem' }}>
          Loading genomic data…
        </span>
      </div>
    );
  }

  return (
    <div className="glow-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: profile ? getRiskColor(profile.prs) : '#9CA3AF',
            boxShadow: profile ? `0 0 8px ${getRiskColor(profile.prs)}` : 'none',
          }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
              Genomic Risk Analysis
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
              De Bruijn Graph · Polygenic Risk Score
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {profile && (
            <span
              className="pill"
              style={{
                background: getRiskBg(profile.prs),
                color: getRiskColor(profile.prs),
                fontSize: '0.7rem',
              }}
            >
              {getRiskLabel(profile.risk_category)}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '1.5rem' }}>

          {/* No profile yet — upload prompt */}
          {!profile && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧬</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem', maxWidth: '320px', margin: '0 auto 1.25rem' }}>
                Upload a patient FASTQ file to run genomic risk analysis using De Bruijn graph alignment.
              </p>
              <label
                htmlFor="fastq-upload"
                className="btn-primary"
                style={{ cursor: 'pointer', padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
              >
                Upload FASTQ File
              </label>
              <input
                ref={fileInputRef}
                id="fastq-upload"
                type="file"
                accept=".fastq,.fq,.txt"
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Uploading state */}
          {uploading && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span className="label">Analyzing genome…</span>
                <span className="label">{isNaN(uploadProgress) ? '0' : Math.round(uploadProgress)}%</span>
              </div>
              <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  background: 'linear-gradient(90deg, var(--emerald), var(--lavender))',
                  width: `${isNaN(uploadProgress) ? 0 : Math.round(uploadProgress)}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Profile loaded — show results */}
          {profile && (
            <>
              {/* Top row: Gauge + Summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <CircularGauge score={profile.prs} />
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span className="label">Risk Category</span>
                    <div style={{
                      display: 'inline-block', marginLeft: '0.5rem',
                      padding: '0.2rem 0.75rem', borderRadius: '9999px',
                      background: getRiskBg(profile.prs), color: getRiskColor(profile.prs),
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      {getRiskLabel(profile.risk_category)}
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span className="label">Total Variants</span>
                    <span style={{ marginLeft: '0.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {profile.variants_detected}
                    </span>
                  </div>
                  {profile.last_updated && (
                    <div>
                      <span className="label">Last Updated</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(profile.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label
                      htmlFor="fastq-reupload"
                      className="btn-ghost"
                      style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                    >
                      Re-upload FASTQ
                    </label>
                    <input
                      ref={fileInputRef}
                      id="fastq-reupload"
                      type="file"
                      accept=".fastq,.fq,.txt"
                      onChange={handleUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      className="btn-ghost"
                      onClick={handleRefuse}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                    >
                      Re-fuse with Thermal
                    </button>
                  </div>
                </div>
              </div>

              {/* Gene Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Per-Gene Breakdown</span>
                <div style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 1fr',
                    padding: '0.5rem 1rem', background: 'var(--bg-raised)',
                    borderBottom: '1px solid var(--border-subtle)', gap: '0.5rem',
                  }}>
                    {['Gene Locus', 'Weight', 'Variants', 'Alignment'].map((h) => (
                      <span key={h} className="label" style={{ fontSize: '0.62rem' }}>{h}</span>
                    ))}
                  </div>
                  {/* Rows */}
                  {GENE_ORDER.map((gene, i) => {
                    const d = profile.locus_details?.[gene] || {};
                    const alignPct = ((d.alignment_score || 0) * 100).toFixed(1);
                    return (
                      <div
                        key={gene}
                        style={{
                          display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 1fr',
                          padding: '0.6rem 1rem', gap: '0.5rem',
                          background: i % 2 === 0 ? 'transparent' : 'var(--bg-row-alt)',
                          borderBottom: i < GENE_ORDER.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-heading)' }}>{gene}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                            {GENE_LABELS[gene]?.split('(')[1]?.replace(')', '') || ''}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                          {GENE_WEIGHTS[gene]}
                        </span>
                        <span style={{
                          fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                          color: (d.variant_count || 0) > 0 ? 'var(--danger)' : 'var(--emerald)',
                        }}>
                          {d.variant_count || 0}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{
                            flex: 1, height: '5px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', borderRadius: '3px',
                              background: parseFloat(alignPct) > 70 ? 'var(--emerald)' : parseFloat(alignPct) > 40 ? '#F59E0B' : 'var(--danger)',
                              width: `${alignPct}%`,
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                            {alignPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fused Clinical Risk Banner */}
              {latestFused && (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '10px',
                    border: `1px solid ${getRiskColor(latestFused.fused_score)}30`,
                    background: getRiskBg(latestFused.fused_score),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <span className="label" style={{ marginBottom: '0.2rem', display: 'block' }}>
                      Combined Clinical Risk (Thermal 65% + Genomic 35%)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '1.75rem', fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: getRiskColor(latestFused.fused_score),
                      }}>
                        {(latestFused.fused_score * 100).toFixed(0)}%
                      </span>
                      <span
                        className="pill"
                        style={{
                          background: getRiskColor(latestFused.fused_score),
                          color: '#fff',
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.7rem',
                        }}
                      >
                        {latestFused.risk_level}
                      </span>
                      {latestFused.clinical_flag && (
                        <span
                          className="pill"
                          style={{
                            background: '#FEE2E2',
                            color: '#991B1B',
                            fontSize: '0.68rem',
                            animation: 'blink 1.8s ease-in-out infinite',
                          }}
                        >
                          ⚠ CLINICAL FLAG
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
