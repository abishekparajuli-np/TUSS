"""
PAITALA — Genomic Risk Scorer

Computes a Polygenic Risk Score (PRS) from De Bruijn graph alignment results.
Weighted by gene clinical importance for diabetic wound healing.

Gene Weights:
  VEGF   = 0.30  (vascular endothelial growth factor — angiogenesis)
  MMP1   = 0.25  (matrix metalloproteinase — tissue remodeling)
  COL1A1 = 0.20  (collagen type I — structural healing)
  TNF    = 0.15  (tumor necrosis factor — inflammation)
  IL6    = 0.10  (interleukin-6 — inflammatory response)

Risk Categories:
  LOW      < 0.3
  MODERATE   0.3 – 0.6
  HIGH     > 0.6
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Clinical importance weights for wound-healing gene loci
GENE_WEIGHTS = {
    "VEGF":   0.30,
    "MMP1":   0.25,
    "COL1A1": 0.20,
    "TNF":    0.15,
    "IL6":    0.10,
}

# Variant penalty — each variant contributes this much to locus risk
VARIANT_PENALTY = 0.05

# Risk category thresholds
RISK_THRESHOLDS = {
    "LOW":      0.3,
    "MODERATE": 0.6,
}


class GenomicRiskScorer:
    """
    Computes Polygenic Risk Score from alignment results.

    The PRS is a weighted sum of per-locus risk scores,
    where each locus risk is derived from alignment quality
    and variant burden.
    """

    def __init__(
        self,
        gene_weights: Optional[Dict[str, float]] = None,
        variant_penalty: float = VARIANT_PENALTY,
    ):
        """
        Initialize the scorer.

        Args:
            gene_weights: Custom gene weights (must sum to ~1.0).
                         Defaults to the standard VEGF/MMP1/COL1A1/TNF/IL6 weights.
            variant_penalty: Risk penalty per detected variant (default 0.05)
        """
        self.gene_weights = gene_weights or GENE_WEIGHTS
        self.variant_penalty = variant_penalty

    def compute_locus_risk(
        self, alignment_score: float, variant_count: int
    ) -> float:
        """
        Compute risk score for a single gene locus.

        Risk formula:
          locus_risk = (1.0 - alignment_score) + (variant_penalty * variant_count)
          Clamped to [0.0, 1.0]

        Higher alignment = lower risk (good match to reference).
        More variants = higher risk.

        Args:
            alignment_score: Fraction of reference k-mers matched (0.0–1.0)
            variant_count: Number of detected variants at this locus

        Returns:
            Locus risk score (0.0–1.0)
        """
        base_risk = 1.0 - alignment_score
        variant_risk = self.variant_penalty * variant_count
        total = base_risk + variant_risk
        return max(0.0, min(1.0, total))

    def compute_prs(self, alignment_results: Dict[str, dict]) -> dict:
        """
        Compute the Polygenic Risk Score from alignment results across all loci.

        PRS = Σ (gene_weight_i × locus_risk_i) for all 5 loci

        Args:
            alignment_results: Dict from DeBruijnGraph.eulerian_path_alignment()
                              Maps locus name -> {alignment_score, variant_count, ...}

        Returns:
            Dict with:
              - prs: float (0.0–1.0)
              - risk_category: str ("LOW", "MODERATE", "HIGH")
              - locus_details: per-gene breakdown
              - total_variants: int
        """
        prs = 0.0
        total_variants = 0
        locus_details = {}

        for gene, weight in self.gene_weights.items():
            locus_data = alignment_results.get(gene, {})
            alignment_score = locus_data.get("alignment_score", 0.0)
            variant_count = locus_data.get("variant_count", 0)

            locus_risk = self.compute_locus_risk(alignment_score, variant_count)
            weighted_contribution = weight * locus_risk

            prs += weighted_contribution
            total_variants += variant_count

            locus_details[gene] = {
                "weight": weight,
                "alignment_score": round(alignment_score, 4),
                "variant_count": variant_count,
                "locus_risk": round(locus_risk, 4),
                "weighted_contribution": round(weighted_contribution, 4),
                "snp_count": locus_data.get("snp_count", 0),
                "indel_count": locus_data.get("indel_count", 0),
                "deletion_count": locus_data.get("deletion_count", 0),
                "reference_kmers_total": locus_data.get("reference_kmers_total", 0),
                "matched_kmers": locus_data.get("matched_kmers", 0),
            }

        # Clamp PRS to [0.0, 1.0]
        prs = max(0.0, min(1.0, prs))

        # Determine risk category
        if prs < RISK_THRESHOLDS["LOW"]:
            risk_category = "LOW"
        elif prs < RISK_THRESHOLDS["MODERATE"]:
            risk_category = "MODERATE"
        else:
            risk_category = "HIGH"

        result = {
            "prs": round(prs, 4),
            "risk_category": risk_category,
            "total_variants": total_variants,
            "locus_details": locus_details,
        }

        logger.info(
            f"PRS computed: {prs:.4f} ({risk_category}), "
            f"total variants: {total_variants}"
        )

        return result

    @staticmethod
    def get_risk_category(prs: float) -> str:
        """
        Get risk category string from a PRS value.

        Args:
            prs: Polygenic Risk Score (0.0–1.0)

        Returns:
            "LOW", "MODERATE", or "HIGH"
        """
        if prs < RISK_THRESHOLDS["LOW"]:
            return "LOW"
        elif prs < RISK_THRESHOLDS["MODERATE"]:
            return "MODERATE"
        else:
            return "HIGH"
