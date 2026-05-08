"""
PAITALA — Comprehensive Genomic Analysis Engine

Performs end-to-end genomic analysis including:
- Sequence alignment (Smith-Waterman local alignment)
- Variant detection (SNPs, INDELs, deletions)
- Haplotype analysis
- Polygenic Risk Score computation
- Clinical interpretation
"""

import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import json

from .fasta_loader import FastaLoader, SequenceAnalyzer
from .risk_scorer import GenomicRiskScorer

logger = logging.getLogger(__name__)


class GenomicAnalysisEngine:
    """Complete genomic analysis pipeline."""

    def __init__(self, reference_dir: str):
        """
        Initialize genomic analysis engine.

        Args:
            reference_dir: Path to FASTA reference files
        """
        self.fasta_loader = FastaLoader(reference_dir)
        self.sequence_analyzer = SequenceAnalyzer()
        self.risk_scorer = GenomicRiskScorer()
        self.clinical_genes = ["VEGF", "MMP1", "COL1A1", "TNF", "IL6"]

    def analyze_patient_genome(
        self, patient_sequences: Dict[str, str]
    ) -> Dict:
        """
        Perform complete genomic analysis for a patient.

        Args:
            patient_sequences: Dict of {gene: sequence} from patient

        Returns:
            Comprehensive analysis report
        """
        logger.info(
            f"Starting genomic analysis for {len(patient_sequences)} genes"
        )

        alignment_results = {}
        variant_summary = {}
        haplotype_analysis = {}

        # Analyze each gene
        for gene in self.clinical_genes:
            reference_seq = self.fasta_loader.get_sequence(gene)
            patient_seq = patient_sequences.get(gene)

            if not reference_seq:
                logger.warning(f"Reference sequence not found for {gene}")
                continue

            if not patient_seq:
                logger.warning(f"Patient sequence not found for {gene}")
                continue

            # Perform alignment
            alignment = self.smith_waterman_align(reference_seq, patient_seq)
            alignment_results[gene] = alignment

            # Detect variants
            variants = self.sequence_analyzer.find_variants(
                reference_seq, patient_seq
            )
            variant_summary[gene] = {
                "total_variants": (
                    len(variants["snps"])
                    + len(variants["insertions"])
                    + len(variants["deletions"])
                ),
                "snp_count": len(variants["snps"]),
                "insertion_count": len(variants["insertions"]),
                "deletion_count": len(variants["deletions"]),
                "variants": variants,
            }

            # Analyze haplotypes
            haplotype_analysis[gene] = self.analyze_haplotypes(
                reference_seq, patient_seq, variants
            )

        # Compute risk score
        prs_result = self.risk_scorer.compute_prs(alignment_results)

        # Generate clinical interpretation
        clinical_report = self.generate_clinical_report(
            alignment_results, variant_summary, prs_result
        )

        result = {
            "analysis_date": self._get_timestamp(),
            "alignment_results": alignment_results,
            "variant_summary": variant_summary,
            "haplotype_analysis": haplotype_analysis,
            "polygenic_risk_score": prs_result,
            "clinical_interpretation": clinical_report,
        }

        logger.info(
            f"Genomic analysis complete. PRS: {prs_result['prs']:.4f} "
            f"({prs_result['risk_category']})"
        )

        return result

    def smith_waterman_align(
        self, reference: str, query: str, match_score: int = 2, gap_penalty: int = -1
    ) -> Dict:
        """
        Smith-Waterman local sequence alignment algorithm.

        Finds optimal local alignment between sequences.

        Args:
            reference: Reference sequence
            query: Query sequence
            match_score: Score for matching bases
            gap_penalty: Penalty for gaps

        Returns:
            Alignment results with score and identity
        """
        ref_len = len(reference)
        query_len = len(query)

        # Initialize score matrix
        score_matrix = [[0] * (ref_len + 1) for _ in range(query_len + 1)]

        max_score = 0
        max_pos = (0, 0)

        # Fill the matrix
        for i in range(1, query_len + 1):
            for j in range(1, ref_len + 1):
                if query[i - 1] == reference[j - 1]:
                    score = score_matrix[i - 1][j - 1] + match_score
                else:
                    score = max(
                        score_matrix[i - 1][j - 1] - 1,
                        score_matrix[i][j - 1] + gap_penalty,
                        score_matrix[i - 1][j] + gap_penalty,
                        0,
                    )

                score_matrix[i][j] = score

                if score > max_score:
                    max_score = score
                    max_pos = (i, j)

        # Calculate alignment statistics
        alignment_score = max_score / (max(ref_len, query_len) * match_score)
        identity = self.sequence_analyzer.sequence_identity(reference, query)

        return {
            "alignment_score": max(0.0, min(1.0, alignment_score)),
            "max_score": max_score,
            "identity_percent": identity,
            "reference_length": ref_len,
            "query_length": query_len,
            "alignment_position": max_pos,
        }

    def analyze_haplotypes(
        self, reference: str, query: str, variants: Dict
    ) -> Dict:
        """
        Analyze haplotype phase and structure.

        Args:
            reference: Reference sequence
            query: Query sequence
            variants: Detected variants

        Returns:
            Haplotype analysis
        """
        # Simple haplotype classification based on variant burden
        total_variants = (
            len(variants["snps"])
            + len(variants["insertions"])
            + len(variants["deletions"])
        )

        if total_variants == 0:
            haplotype_type = "WILDTYPE"
        elif total_variants <= 2:
            haplotype_type = "COMMON_VARIANT"
        else:
            haplotype_type = "RARE_VARIANT"

        return {
            "haplotype_type": haplotype_type,
            "variant_burden": total_variants,
            "allele_frequency_estimate": self._estimate_allele_frequency(
                total_variants
            ),
            "functional_impact": self._predict_functional_impact(
                variants, reference, query
            ),
        }

    def generate_clinical_report(
        self, alignment_results: Dict, variant_summary: Dict, prs_result: Dict
    ) -> Dict:
        """
        Generate clinical interpretation report.

        Args:
            alignment_results: Alignment data for each gene
            variant_summary: Variant counts and types
            prs_result: Polygenic Risk Score result

        Returns:
            Clinical interpretation
        """
        prs = prs_result["prs"]
        risk_category = prs_result["risk_category"]

        # Determine clinical recommendations
        recommendations = []

        if risk_category == "HIGH":
            recommendations.append(
                "Frequent wound monitoring and aggressive prevention strategies"
            )
            recommendations.append("Consider genetic counseling for family members")
            recommendations.append(
                "Intensive diabetes management and regular foot care"
            )
        elif risk_category == "MODERATE":
            recommendations.append("Regular wound surveillance")
            recommendations.append(
                "Standard diabetes management with enhanced foot care"
            )
        else:
            recommendations.append("Routine diabetes management")
            recommendations.append("Standard foot care practices")

        # Gene-specific insights
        gene_insights = {}
        for gene, alignment in alignment_results.items():
            identity = alignment.get("identity_percent", 0)
            if identity < 95:
                gene_insights[gene] = f"Significant sequence variation detected ({identity:.1f}% identity)"
            else:
                gene_insights[gene] = f"Normal sequence ({identity:.1f}% identity)"

        return {
            "risk_level": risk_category,
            "prs_score": round(prs, 4),
            "risk_interpretation": self._interpret_risk(prs),
            "gene_insights": gene_insights,
            "clinical_recommendations": recommendations,
            "total_variants_detected": prs_result["total_variants"],
        }

    @staticmethod
    def _interpret_risk(prs: float) -> str:
        """Interpret PRS value clinically."""
        if prs < 0.3:
            return (
                "Low genetic risk for diabetic foot complications. "
                "Patient has favorable genetic markers for wound healing."
            )
        elif prs < 0.6:
            return (
                "Moderate genetic risk for diabetic foot complications. "
                "Enhanced monitoring and preventive care recommended."
            )
        else:
            return (
                "High genetic risk for diabetic foot complications. "
                "Intensive medical management and close surveillance essential."
            )

    @staticmethod
    def _estimate_allele_frequency(variant_count: int) -> str:
        """Estimate allele frequency based on variant burden."""
        if variant_count == 0:
            return "> 5% (common)"
        elif variant_count <= 2:
            return "1-5% (low frequency)"
        else:
            return "< 1% (rare)"

    @staticmethod
    def _predict_functional_impact(variants: Dict, reference: str, query: str) -> str:
        """Predict functional impact of variants."""
        snp_count = len(variants["snps"])
        indel_count = len(variants["insertions"]) + len(variants["deletions"])

        if indel_count > 0:
            return "FRAMESHIFT_RISK - High functional impact"
        elif snp_count >= 3:
            return "MODERATE_IMPACT - Multiple mutations detected"
        elif snp_count > 0:
            return "MILD_IMPACT - Single or few SNPs"
        else:
            return "NO_IMPACT - Wildtype"

    @staticmethod
    def _get_timestamp() -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"

    def get_summary_statistics(self) -> Dict:
        """Get summary statistics for loaded reference sequences."""
        return self.fasta_loader.summary()
