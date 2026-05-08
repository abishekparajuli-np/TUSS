"""
PAITALA — Genomic Analysis FastAPI Server

Standalone microservice for genomic risk analysis.
Runs on port 5051, separate from the Flask thermal server (5050).

Endpoints:
  POST /analyze/genomic/{patient_id}  — Upload FASTQ, run full pipeline
  GET  /genomic/profile/{patient_id}  — Retrieve stored genomic profile
  POST /fuse/{patient_id}             — Trigger fusion with latest thermal scan
  GET  /health                        — Health check
"""

import os
import sys
import logging
from datetime import datetime, timezone

import firebase_admin
# pyrefly: ignore [missing-import]
from firebase_admin import credentials, firestore
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

# Add backend dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from genomic.debruijn_engine import DeBruijnGraph
from genomic.risk_scorer import GenomicRiskScorer
from models.fusion_model import FusionModel

# ====================== LOGGING ======================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====================== FIREBASE INIT ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, '..', 'serviceAccountKey.json')

# Only initialize if not already initialized
if not firebase_admin._apps:
    if os.path.exists(SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        logger.info(f"Firebase initialized with service account")
    else:
        logger.warning("serviceAccountKey.json not found, Firebase disabled")

db = firestore.client() if firebase_admin._apps else None

# ====================== FASTAPI APP ======================
app = FastAPI(
    title="Paitala Genomic Analysis Server",
    description="De Bruijn graph-based genomic risk analysis for diabetic foot ulcers",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================== SHARED INSTANCES ======================
risk_scorer = GenomicRiskScorer()
fusion_model = FusionModel()

# Max upload size: 50MB
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


# ====================== ENDPOINTS ======================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "paitala-genomic",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "firebase_connected": db is not None,
    }


@app.post("/analyze/genomic/{patient_id}")
async def analyze_genomic(patient_id: str, file: UploadFile = File(...)):
    """
    Full genomic analysis pipeline:
    1. Parse uploaded FASTQ file
    2. Build De Bruijn graph (k=31)
    3. Align against 5 wound-healing gene loci
    4. Compute Polygenic Risk Score
    5. Optionally fuse with existing thermal data
    6. Save results to Firebase
    """
    # Validate file
    if not file.filename:
        raise HTTPException(400, "No file provided")

    # Read file content
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File too large (max {MAX_UPLOAD_BYTES // 1024 // 1024}MB)")

    if len(content) == 0:
        raise HTTPException(400, "Empty file")

    try:
        fastq_content = content.decode('utf-8', errors='ignore')
    except Exception as e:
        raise HTTPException(400, f"Failed to decode file: {str(e)}")

    logger.info(f"Analyzing genomic data for patient {patient_id}, file: {file.filename} ({len(content)} bytes)")

    # Step 1-2: Build De Bruijn graph
    graph = DeBruijnGraph(k=31)
    build_stats = graph.build_from_fastq(fastq_content)

    if build_stats["total_kmers"] == 0:
        raise HTTPException(
            422,
            "No valid k-mers extracted from FASTQ file. "
            "Ensure file contains valid DNA sequences of length >= 31."
        )

    # Step 3: Compute stochastic weights
    graph.compute_stochastic_weights()

    # Step 4: Align against all 5 loci
    alignment_results = graph.eulerian_path_alignment()

    # Step 5: Compute PRS
    prs_result = risk_scorer.compute_prs(alignment_results)

    # Step 6: Try to fuse with existing thermal data
    fused_result = None
    if db:
        try:
            fused_result = _try_fusion_with_thermal(patient_id, prs_result)
        except Exception as e:
            logger.warning(f"Fusion with thermal data failed: {e}")

    # Step 7: Save to Firebase
    genomic_profile = {
        "prs": prs_result["prs"],
        "risk_category": prs_result["risk_category"],
        "variants_detected": prs_result["total_variants"],
        "locus_details": {},
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "source_file": file.filename,
    }

    # Build locus_details for Firebase (without variant objects)
    for gene, details in prs_result["locus_details"].items():
        genomic_profile["locus_details"][gene] = {
            "variant_count": details["variant_count"],
            "alignment_score": details["alignment_score"],
            "snp_count": details["snp_count"],
            "indel_count": details["indel_count"],
            "deletion_count": details["deletion_count"],
        }

    if db:
        try:
            patient_ref = db.collection('patients').document(patient_id)
            patient_ref.update({"genomic_profile": genomic_profile})
            logger.info(f"Saved genomic profile to Firebase for patient {patient_id}")

            # Append to fused_risk_history if fusion was performed
            if fused_result:
                history_entry = {
                    "thermal_score": fused_result.get("thermal_signal", 0),
                    "genomic_prs": prs_result["prs"],
                    "fused_score": fused_result["fused_score"],
                    "risk_level": fused_result["risk_level"],
                    "clinical_flag": fused_result["clinical_flag"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                patient_ref.update({
                    "fused_risk_history": firestore.ArrayUnion([history_entry])
                })
                logger.info(f"Appended fused risk history for patient {patient_id}")
        except Exception as e:
            logger.error(f"Firebase save failed: {e}")

    # Build response
    response = {
        "patient_id": patient_id,
        "graph_stats": build_stats,
        "prs": prs_result["prs"],
        "risk_category": prs_result["risk_category"],
        "total_variants": prs_result["total_variants"],
        "locus_details": prs_result["locus_details"],
        "fused_result": fused_result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return response


@app.get("/genomic/profile/{patient_id}")
async def get_genomic_profile(patient_id: str):
    """Retrieve stored genomic profile for a patient."""
    if not db:
        raise HTTPException(503, "Firebase not configured")

    try:
        patient_ref = db.collection('patients').document(patient_id)
        patient_doc = patient_ref.get()

        if not patient_doc.exists:
            raise HTTPException(404, f"Patient {patient_id} not found")

        data = patient_doc.to_dict()
        genomic_profile = data.get("genomic_profile")

        if not genomic_profile:
            raise HTTPException(404, f"No genomic profile for patient {patient_id}")

        return {
            "patient_id": patient_id,
            "genomic_profile": genomic_profile,
            "fused_risk_history": data.get("fused_risk_history", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error retrieving profile: {str(e)}")


@app.post("/fuse/{patient_id}")
async def trigger_fusion(patient_id: str):
    """Manually trigger fusion of latest thermal scan with genomic data."""
    if not db:
        raise HTTPException(503, "Firebase not configured")

    try:
        patient_ref = db.collection('patients').document(patient_id)
        patient_doc = patient_ref.get()

        if not patient_doc.exists:
            raise HTTPException(404, f"Patient {patient_id} not found")

        data = patient_doc.to_dict()
        genomic_profile = data.get("genomic_profile")

        if not genomic_profile:
            raise HTTPException(404, "No genomic profile available for fusion")

        prs_result = {
            "prs": genomic_profile["prs"],
            "risk_category": genomic_profile["risk_category"],
        }

        fused_result = _try_fusion_with_thermal(patient_id, prs_result)

        if not fused_result:
            raise HTTPException(404, "No thermal scan data available for fusion")

        # Append to history
        history_entry = {
            "thermal_score": fused_result.get("thermal_signal", 0),
            "genomic_prs": genomic_profile["prs"],
            "fused_score": fused_result["fused_score"],
            "risk_level": fused_result["risk_level"],
            "clinical_flag": fused_result["clinical_flag"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        patient_ref.update({
            "fused_risk_history": firestore.ArrayUnion([history_entry])
        })

        return {
            "patient_id": patient_id,
            "fused_result": fused_result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Fusion error: {str(e)}")


def _try_fusion_with_thermal(patient_id: str, prs_result: dict) -> dict:
    """
    Try to fuse genomic PRS with the latest thermal scan for this patient.
    Queries Firebase for the most recent scan.
    """
    if not db:
        return None

    # Get latest scan for this patient
    scans_ref = db.collection('scans')
    query = (
        scans_ref
        .where('patientId', '==', patient_id)
        .order_by('completedAt', direction=firestore.Query.DESCENDING)
        .limit(1)
    )

    try:
        scans = list(query.stream())
    except Exception:
        # Fallback: query without ordering
        query = scans_ref.where('patientId', '==', patient_id).limit(10)
        scans = list(query.stream())
        scans.sort(
            key=lambda s: s.to_dict().get('completedAt', datetime.min),
            reverse=True
        )

    if not scans:
        return None

    scan_data = scans[0].to_dict()
    thermal_confidence = scan_data.get('confidence', 0.0)
    thermal_risk_score = scan_data.get('riskScore', 0.0)

    result = fusion_model.fuse(
        thermal_confidence=float(thermal_confidence),
        thermal_risk_score=float(thermal_risk_score),
        genomic_prs=float(prs_result["prs"]),
        genomic_risk_category=prs_result.get("risk_category"),
    )

    return result


# ====================== MAIN ======================
if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    logger.info("Starting Paitala Genomic Analysis Server on port 5051")
    uvicorn.run(app, host="0.0.0.0", port=5051)
