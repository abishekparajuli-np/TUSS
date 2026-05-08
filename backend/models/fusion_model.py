"""
PAITALA — Late Fusion Model

Combines thermal imaging confidence score (DeiT) with genomic PRS
to produce a unified clinical risk assessment.

Fusion Weights:
  Thermal = 0.65  (primary clinical signal)
  Genomic = 0.35  (additive genetic risk layer)

Escalation Rule:
  If BOTH thermal AND genomic indicate HIGH risk, the fused score
  is escalated by 20% to reflect compounded clinical concern.

Output:
  - fused_score (0.0–1.0)
  - risk_level ("Low", "Medium", "High")
  - clinical_flag (bool, true if fused_score > 0.7)
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Fusion weights
THERMAL_WEIGHT = 0.65
GENOMIC_WEIGHT = 0.35

# Escalation multiplier when both signals are HIGH
ESCALATION_FACTOR = 1.20

# Thermal risk score threshold (from 0-100 scale, mapped to 0-1)
THERMAL_HIGH_THRESHOLD = 0.6

# Genomic PRS HIGH threshold
GENOMIC_HIGH_THRESHOLD = 0.6

# Clinical flag threshold
CLINICAL_FLAG_THRESHOLD = 0.7


class FusionModel:
    """
    Late fusion model combining thermal and genomic risk signals.

    The thermal confidence score (0-1) from DeiT and the genomic PRS (0-1)
    are combined with weighted averaging, with an escalation rule for
    cases where both signals indicate high risk.
    """

    def __init__(
        self,
        thermal_weight: float = THERMAL_WEIGHT,
        genomic_weight: float = GENOMIC_WEIGHT,
        escalation_factor: float = ESCALATION_FACTOR,
    ):
        self.thermal_weight = thermal_weight
        self.genomic_weight = genomic_weight
        self.escalation_factor = escalation_factor

    def fuse(
        self,
        thermal_confidence: float,
        thermal_risk_score: float,
        genomic_prs: float,
        genomic_risk_category: Optional[str] = None,
    ) -> dict:
        """
        Perform late fusion of thermal and genomic signals.

        Args:
            thermal_confidence: DeiT model confidence (0.0–1.0)
            thermal_risk_score: Thermal risk index (0–100 scale)
            genomic_prs: Polygenic Risk Score (0.0–1.0)
            genomic_risk_category: Optional pre-computed category

        Returns:
            Dict with fused_score, risk_level, clinical_flag, and metadata
        """
        # Normalize thermal risk to 0-1 scale
        thermal_normalized = min(1.0, max(0.0, thermal_risk_score / 100.0))

        # Use the higher of confidence and normalized risk for thermal signal
        thermal_signal = max(thermal_confidence, thermal_normalized)

        # Base fusion: weighted average
        fused_score = (
            self.thermal_weight * thermal_signal
            + self.genomic_weight * genomic_prs
        )

        # Check if both signals indicate HIGH risk
        thermal_is_high = thermal_signal >= THERMAL_HIGH_THRESHOLD
        genomic_is_high = genomic_prs >= GENOMIC_HIGH_THRESHOLD

        escalated = False
        if thermal_is_high and genomic_is_high:
            fused_score = min(1.0, fused_score * self.escalation_factor)
            escalated = True

        # Clamp to [0.0, 1.0]
        fused_score = max(0.0, min(1.0, fused_score))

        # Determine risk level
        if fused_score < 0.3:
            risk_level = "Low"
        elif fused_score < 0.6:
            risk_level = "Medium"
        else:
            risk_level = "High"

        # Clinical flag
        clinical_flag = fused_score > CLINICAL_FLAG_THRESHOLD

        result = {
            "fused_score": round(fused_score, 4),
            "risk_level": risk_level,
            "clinical_flag": clinical_flag,
            "escalated": escalated,
            "thermal_signal": round(thermal_signal, 4),
            "thermal_confidence": round(thermal_confidence, 4),
            "thermal_risk_score": round(thermal_risk_score, 2),
            "genomic_prs": round(genomic_prs, 4),
            "thermal_weight": self.thermal_weight,
            "genomic_weight": self.genomic_weight,
        }

        logger.info(
            f"Fusion: thermal={thermal_signal:.4f} + genomic={genomic_prs:.4f} "
            f"→ fused={fused_score:.4f} ({risk_level})"
            f"{' [ESCALATED]' if escalated else ''}"
            f"{' [CLINICAL FLAG]' if clinical_flag else ''}"
        )

        return result
