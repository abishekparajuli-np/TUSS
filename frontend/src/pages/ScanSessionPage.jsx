import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { inferenceApi } from '../utils/inferenceApi';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { INFERENCE_SERVER_URL } from '../config/firebase';
import StatusBadge from '../components/StatusBadge';
import ThermalRiskBar from '../components/ThermalRiskBar';
import PredictionBuffer from '../components/PredictionBuffer';
import MetricDisplay from '../components/MetricDisplay';

export default function ScanSessionPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [countdownTime, setCountdownTime] = useState(20);
  const [analysisData, setAnalysisData] = useState({
    status: 'IDLE',
    confidence: 0.0,
    risk_score: 0.0,
    asymmetry: 0.0,
    variance: 0.0,
    edge_strength: 0.0,
    fps: 0.0,
    buffer_length: 0,
    prediction_history: [],
  });

  const statusPollRef = useRef(null);
  const countdownRef = useRef(null);
  const scanIdRef = useRef(uuidv4());

  // The MJPEG stream URL — just an <img> src, no WebSocket needed
  const mjpegUrl = `${INFERENCE_SERVER_URL}/video_feed`;

  // Load patient
  useEffect(() => {
    const loadPatient = async () => {
      try {
        const patientDoc = await getDoc(doc(db, 'patients', patientId));
        if (patientDoc.exists()) {
          setPatient(patientDoc.data());
        } else {
          toast.error('Patient not found');
          navigate('/dashboard');
        }
      } catch (error) {
        toast.error('Error loading patient: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [patientId, navigate]);

  // Check if stream is alive on mount
  useEffect(() => {
    const checkStream = async () => {
      try {
        const res = await inferenceApi.healthCheck();
        if (res.data?.status === 'ok') {
          setStreamConnected(true);
        }
      } catch {
        setStreamConnected(false);
      }
    };

    checkStream();
    const interval = setInterval(checkStream, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll status from inference server during analysis
  useEffect(() => {
    if (!analysisActive) return;

    statusPollRef.current = setInterval(async () => {
      try {
        const response = await inferenceApi.getStatus();
        setAnalysisData(response.data);
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }, 500);

    return () => clearInterval(statusPollRef.current);
  }, [analysisActive]);

  // Countdown timer
  useEffect(() => {
    if (!analysisActive) return;

    countdownRef.current = setInterval(() => {
      setCountdownTime((prev) => {
        if (prev <= 1) {
          // Analysis window complete — stop analysis on server too
          inferenceApi.stopAnalysis().catch(() => {});
          setAnalysisActive(false);
          setAnalysisComplete(true);
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [analysisActive]);

  const handleStartAnalysis = async () => {
    try {
      await inferenceApi.startAnalysis();
      setAnalysisActive(true);
      setAnalysisComplete(false);
      setCountdownTime(20);
      toast.success('Analysis started — analyzing for 20 seconds');
    } catch (error) {
      toast.error('Failed to start analysis: ' + error.message);
    }
  };

  const handleStopAnalysis = async () => {
    try {
      await inferenceApi.stopAnalysis();
      setAnalysisActive(false);
      toast.success('Analysis stopped');
    } catch (error) {
      toast.error('Failed to stop analysis: ' + error.message);
    }
  };

  const handleGenerateReport = async () => {
    try {
      // Get AVERAGED results from the full 20s analysis window
      const finalResult = await inferenceApi.getFinalResult();

      // Capture snapshot images (thermal frame + model input)
      let thermalImage = '';
      let modelInputImage = '';
      try {
        const snapshotRes = await inferenceApi.getSnapshot();
        thermalImage = snapshotRes.data.thermal_frame || '';
        modelInputImage = snapshotRes.data.model_input || '';
      } catch (snapErr) {
        console.warn('Snapshot capture failed:', snapErr.message);
      }

      await setDoc(doc(db, 'scans', scanIdRef.current), {
        patientId,
        doctorId: currentUser.uid,
        startedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        status: finalResult.data.status || 'UNKNOWN',
        confidence: finalResult.data.confidence || 0,
        riskScore: finalResult.data.risk_score || 0,
        asymmetry: finalResult.data.asymmetry || 0,
        variance: finalResult.data.variance || 0,
        edgeStrength: finalResult.data.edge_strength || 0,
        predictionHistory: finalResult.data.prediction_history || [],
        totalFramesAnalyzed: finalResult.data.total_frames_analyzed || 0,
        thermalImage,
        modelInputImage,
      });

      toast.success('Scan data saved — averaged over ' + (finalResult.data.total_frames_analyzed || 0) + ' frames');
      navigate(`/report/${scanIdRef.current}`);
    } catch (error) {
      toast.error('Failed to save scan: ' + error.message);
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
            SCAN SESSION
          </h1>
          <p className="text-[#6B7280] font-mono text-sm">
            {patient?.name} • {patient?.mrn}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Thermal Stream (MJPEG) */}
          <div className="glow-card rounded-lg p-6">
            <div className="relative">
              {/* Stream Status Indicator */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: streamConnected ? '#10B981' : '#F87171',
                    boxShadow: streamConnected
                      ? '0 0 10px #10B981'
                      : '0 0 10px #F87171',
                  }}
                />
                <span className="font-mono text-xs text-[#1E1B4B]">
                  {streamConnected ? 'LIVE' : 'CONNECTING...'}
                </span>
                {analysisActive && (
                  <span className="font-mono text-xs text-[#EF4444] ml-2 animate-pulse">
                    ● ANALYZING
                  </span>
                )}
              </div>

              {/* MJPEG Video Feed — just an img tag, no WebSocket */}
              <div className="bg-black rounded w-full aspect-video flex items-center justify-center relative overflow-hidden border border-[rgba(16,185,129,0.18)]">
                <img
                  src={mjpegUrl}
                  alt="Thermal Camera Feed"
                  className="absolute inset-0 w-full h-full object-contain"
                  onLoad={() => setStreamConnected(true)}
                  onError={() => setStreamConnected(false)}
                  style={{ imageRendering: 'auto' }}
                />
                {!streamConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black bg-opacity-80">
                    <div
                      className="w-8 h-8 border-2 border-[rgba(16,185,129,0.18)] border-t-[#10B981] rounded-full mb-3"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <span className="font-mono text-[#6B7280] text-sm">
                      Connecting to thermal camera...
                    </span>
                    <span className="font-mono text-[#6B7280] text-xs mt-1 opacity-60">
                      {INFERENCE_SERVER_URL}
                    </span>
                  </div>
                )}
              </div>

              {/* Color Scale Legend */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono space-y-1 z-20">
                <div className="text-[#ff0000]">▓ HOT</div>
                <div className="text-[#ffff00]">▓ WARM</div>
                <div className="text-[#10B981]">▓ COOL</div>
              </div>
            </div>
          </div>

          {/* Right Column - AI Analysis Panel */}
          <div className="space-y-6">
            {/* Model Input Preview */}
            <div className="glow-card rounded-lg p-6">
              <div className="mb-4">
                <div className="text-xs font-mono text-[#6B7280] mb-3">
                  MODEL INPUT PREVIEW
                </div>
                <div className="w-56 h-56 bg-black rounded border border-[rgba(16,185,129,0.15)] overflow-hidden relative">
                  <img
                    src={`${INFERENCE_SERVER_URL}/model_input_feed`}
                    alt="Model Input 224x224"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
                <div className="text-xs font-mono text-[#6B7280] mt-2 opacity-60">
                  224×224 • COLORMAP_OCEAN • Live
                </div>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="glow-card rounded-lg p-6">
              <div className="space-y-3">
                <MetricDisplay
                  label="STATUS"
                  value={analysisData.status || 'IDLE'}
                />
                <MetricDisplay
                  label="CONFIDENCE"
                  value={(analysisData.confidence || 0).toFixed(2)}
                  unit="(0.00 - 1.00)"
                />
                <MetricDisplay
                  label="THERMAL RISK"
                  value={(analysisData.risk_score || 0).toFixed(1)}
                  unit="/ 100"
                />
                <MetricDisplay
                  label="ASYMMETRY"
                  value={(analysisData.asymmetry || 0).toFixed(2)}
                />
                <MetricDisplay
                  label="VARIANCE"
                  value={(analysisData.variance || 0).toFixed(2)}
                />
                <MetricDisplay
                  label="EDGE STRENGTH"
                  value={(analysisData.edge_strength || 0).toFixed(2)}
                />
                <MetricDisplay
                  label="BUFFER"
                  value={`${analysisData.buffer_length || 0}`}
                  unit={`/ 60 frames`}
                />
                <MetricDisplay
                  label="FPS"
                  value={(analysisData.fps || 0).toFixed(1)}
                />
              </div>

              {/* Thermal Risk Bar */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <ThermalRiskBar
                  riskScore={analysisData.risk_score || 0}
                  label="THERMAL RISK INDEX"
                />
              </div>

              {/* Status Badge */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <div className="text-xs font-mono text-[#6B7280] mb-3">
                  FINAL STATUS
                </div>
                <StatusBadge
                  status={analysisData.status || 'IDLE'}
                  size="lg"
                />
              </div>

              {/* Prediction Buffer */}
              <div className="mt-6 pt-6 border-t border-[rgba(16,185,129,0.15)]">
                <PredictionBuffer
                  history={analysisData.prediction_history || []}
                  maxLength={60}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scan Controls */}
        <div className="glow-card rounded-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Countdown Timer */}
            {analysisActive && (
              <div className="text-4xl font-mono text-[#10B981] font-bold">
                {String(countdownTime).padStart(2, '0')}:{String(0).padStart(2, '0')}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 w-full sm:w-auto">
              {!analysisActive && !analysisComplete && (
                <button
                  onClick={handleStartAnalysis}
                  className="btn-primary flex-1 sm:flex-none font-bold uppercase px-8"
                >
                  START ANALYSIS
                </button>
              )}

              {analysisActive && (
                <button
                  onClick={handleStopAnalysis}
                  className="btn-primary flex-1 sm:flex-none font-bold uppercase px-8"
                  style={{
                    backgroundColor: '#F87171',
                    borderColor: '#F87171',
                    color: '#fff',
                  }}
                >
                  STOP
                </button>
              )}

              {analysisComplete && (
                <>
                  <button
                    onClick={() => {
                      setAnalysisComplete(false);
                      scanIdRef.current = uuidv4();
                    }}
                    className="btn-primary flex-1 sm:flex-none font-bold uppercase px-8"
                  >
                    NEW ANALYSIS
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    className="btn-primary flex-1 sm:flex-none font-bold uppercase px-8"
                  >
                    GENERATE REPORT
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
