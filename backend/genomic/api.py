"""
PAITALA — Genomic Analysis REST API

Provides endpoints for patient genomic analysis including:
- Sequence upload and validation
- Variant detection
- Risk scoring
- Clinical report generation
"""

import os
import logging
from pathlib import Path
from flask import Blueprint, request, jsonify

from .analysis_engine import GenomicAnalysisEngine
from .fasta_loader import FastaLoader

logger = logging.getLogger(__name__)

# Initialize genomic engine
genomic_bp = Blueprint("genomic", __name__, url_prefix="/api/genomic")

# Get reference directory
reference_dir = Path(__file__).parent / "refrence"
analysis_engine = GenomicAnalysisEngine(str(reference_dir))


@genomic_bp.route("/reference-info", methods=["GET"])
def get_reference_info():
    """
    Get information about loaded reference sequences.

    Returns:
        JSON with reference sequence metadata
    """
    try:
        summary = analysis_engine.get_summary_statistics()
        return jsonify({"status": "success", "data": summary}), 200
    except Exception as e:
        logger.error(f"Error getting reference info: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/analyze", methods=["POST"])
def analyze_genome():
    """
    Analyze patient genome sequences.

    Request body:
    {
      "patient_id": "string",
      "sequences": {
        "VEGF": "ATCG...",
        "MMP1": "ATCG...",
        ...
      }
    }

    Returns:
        Comprehensive genomic analysis report
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        patient_id = data.get("patient_id", "unknown")
        sequences = data.get("sequences", {})

        if not sequences:
            return (
                jsonify({"status": "error", "message": "No sequences provided"}),
                400,
            )

        logger.info(f"Analyzing genome for patient {patient_id}")
        logger.info(f"Received sequences: {list(sequences.keys())}")
        
        # Log sequence details
        for gene, seq in sequences.items():
            seq_len = len(seq) if seq else 0
            logger.info(f"  {gene}: {seq_len}bp")

        # Validate sequences
        for gene, seq in sequences.items():
            if not seq or len(seq) == 0:
                error_msg = f"Empty sequence for {gene}"
                logger.error(error_msg)
                return (
                    jsonify({"status": "error", "message": error_msg}),
                    400,
                )
            
            is_valid, msg = analysis_engine.fasta_loader.validate_sequence(seq)
            if not is_valid:
                error_msg = f"Invalid sequence for {gene}: {msg}"
                logger.error(error_msg)
                return (
                    jsonify({"status": "error", "message": error_msg}),
                    400,
                )

        # Perform analysis
        result = analysis_engine.analyze_patient_genome(sequences)

        # Transform response to match frontend expectations
        prs_data = result.get("polygenic_risk_score", {})
        variant_summary = result.get("variant_summary", {})
        alignment_results = result.get("alignment_results", {})
        
        # Build locus_details
        locus_details = {}
        for gene in analysis_engine.clinical_genes:
            locus_details[gene] = {
                "variant_count": variant_summary.get(gene, {}).get("total_variants", 0),
                "snp_count": variant_summary.get(gene, {}).get("snp_count", 0),
                "indel_count": variant_summary.get(gene, {}).get("insertion_count", 0),
                "deletion_count": variant_summary.get(gene, {}).get("deletion_count", 0),
                "alignment_score": alignment_results.get(gene, {}).get("alignment_score", 0),
            }

        # Build response
        response_data = {
            "status": "success",
            "patient_id": patient_id,
            "prs": prs_data.get("prs", 0),
            "risk_category": prs_data.get("risk_category", "UNKNOWN"),
            "total_variants": sum(v.get("total_variants", 0) for v in variant_summary.values()),
            "timestamp": result.get("analysis_date", ""),
            "locus_details": locus_details,
            "fused_result": None,  # Will be populated when combined with thermal
            # Include full analysis for reference
            "analysis": result,
        }

        return jsonify(response_data), 200
    except Exception as e:
        logger.error(f"Error analyzing genome: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/analyze-fasta", methods=["POST"])
def analyze_fasta():
    """
    Analyze patient genome from FASTA content.

    Request body:
    {
      "patient_id": "string",
      "fasta_content": {
        "VEGF": ">header...\\nATCG...",
        ...
      }
    }

    Returns:
        Comprehensive genomic analysis report
    """
    try:
        data = request.get_json()
        patient_id = data.get("patient_id", "unknown")
        fasta_content = data.get("fasta_content", {})

        sequences = {}
        for gene, fasta_text in fasta_content.items():
            seq, _ = FastaLoader.parse_fasta(fasta_text)
            sequences[gene] = seq

        if not sequences:
            return (
                jsonify({"status": "error", "message": "No valid sequences found"}),
                400,
            )

        logger.info(f"Analyzing FASTA genome for patient {patient_id}")

        result = analysis_engine.analyze_patient_genome(sequences)

        return (
            jsonify(
                {
                    "status": "success",
                    "patient_id": patient_id,
                    "analysis": result,
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Error analyzing FASTA: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/variants/<patient_id>", methods=["GET"])
def get_variant_report(patient_id):
    """
    Get variant report for a patient (requires prior analysis).

    Returns:
        Variant summary and details
    """
    try:
        # In production, retrieve from database using patient_id
        return (
            jsonify(
                {
                    "status": "success",
                    "patient_id": patient_id,
                    "message": "Use /analyze endpoint to generate variant report",
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Error getting variant report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/prs/<patient_id>", methods=["GET"])
def get_prs_report(patient_id):
    """
    Get Polygenic Risk Score report for a patient.

    Returns:
        PRS score and clinical interpretation
    """
    try:
        # In production, retrieve from database using patient_id
        return (
            jsonify(
                {
                    "status": "success",
                    "patient_id": patient_id,
                    "message": "Use /analyze endpoint to generate PRS report",
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Error getting PRS report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/clinical-interpretation/<patient_id>", methods=["GET"])
def get_clinical_interpretation(patient_id):
    """
    Get clinical interpretation for analyzed patient.

    Returns:
        Risk level, recommendations, and clinical insights
    """
    try:
        # In production, retrieve from database using patient_id
        return (
            jsonify(
                {
                    "status": "success",
                    "patient_id": patient_id,
                    "message": "Use /analyze endpoint to get clinical interpretation",
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Error getting clinical interpretation: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@genomic_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health check for genomic analysis service.

    Returns:
        Service status and reference genome statistics
    """
    try:
        summary = analysis_engine.get_summary_statistics()
        return (
            jsonify(
                {
                    "status": "healthy",
                    "service": "genomic-analysis",
                    "reference_genes_loaded": summary["total_genes"],
                    "reference_genes": summary["genes"],
                }
            ),
            200,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "status": "error",
                    "service": "genomic-analysis",
                    "message": str(e),
                }
            ),
            500,
        )


def create_genomic_api(app):
    """
    Register genomic API blueprint with Flask app.

    Args:
        app: Flask application instance
    """
    app.register_blueprint(genomic_bp)
    logger.info("Genomic API endpoints registered")
