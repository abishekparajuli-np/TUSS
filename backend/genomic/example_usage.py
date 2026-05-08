#!/usr/bin/env python3
"""
PAITALA Genomic Analysis Example Script

Demonstrates complete workflow for genomic analysis including:
- Loading reference sequences
- Analyzing patient genomes
- Computing risk scores
- Generating clinical reports
"""

import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from genomic import GenomicAnalysisEngine, FastaLoader


def example_1_reference_info():
    """Example 1: Load and inspect reference sequences."""
    print("\n" + "="*70)
    print("EXAMPLE 1: Reference Sequence Information")
    print("="*70)

    reference_dir = Path(__file__).parent / "refrence"
    loader = FastaLoader(str(reference_dir))

    print(f"\n✓ Loaded {len(loader.sequences)} reference genes")
    print("\nReference Sequences:")
    for gene, seq in loader.sequences.items():
        metadata = loader.metadata[gene]
        print(
            f"  {gene:8s} | {metadata['length']:5d}bp | "
            f"GC={metadata['gc_content']:.1%} | {metadata['file']}"
        )

    print("\nSummary:")
    summary = loader.summary()
    print(f"  Total genes: {summary['total_genes']}")
    print(f"  Total bases: {summary['total_bp']} bp")


def example_2_sequence_validation():
    """Example 2: Validate DNA sequences."""
    print("\n" + "="*70)
    print("EXAMPLE 2: Sequence Validation")
    print("="*70)

    test_sequences = [
        ("Valid sequence", "ATCGATCGATCGATCGATCGATCGATCG"),
        ("With N (ambiguous)", "ATCGATNGATCGATCGATCGATCGATCG"),
        ("Invalid (contains U)", "ATCGAUCGATCGATCGATCGATCGATCG"),
        ("Invalid (contains number)", "ATC1GATCGATCGATCGATCGATCGATCG"),
    ]

    loader = FastaLoader(str(Path(__file__).parent / "refrence"))

    for name, seq in test_sequences:
        is_valid, message = loader.validate_sequence(seq)
        status = "✓" if is_valid else "✗"
        print(f"{status} {name:30s} → {message}")


def example_3_patient_analysis():
    """Example 3: Analyze patient genome."""
    print("\n" + "="*70)
    print("EXAMPLE 3: Patient Genome Analysis")
    print("="*70)

    # Initialize engine
    reference_dir = Path(__file__).parent / "refrence"
    engine = GenomicAnalysisEngine(str(reference_dir))

    # Simulate patient sequences (use reference as base)
    loader = FastaLoader(str(reference_dir))
    patient_sequences = {}

    for gene, ref_seq in loader.sequences.items():
        # Simulate patient sequence with ~1% variation
        patient_seq = ref_seq
        if len(ref_seq) > 100:
            # Introduce a few mutations
            seq_list = list(patient_seq)
            bases = ["A", "T", "C", "G"]

            # SNP at position 100
            seq_list[100] = "G" if seq_list[100] != "G" else "A"

            # SNP at position 500
            if len(seq_list) > 500:
                seq_list[500] = "T" if seq_list[500] != "T" else "C"

            patient_seq = "".join(seq_list)

        patient_sequences[gene] = patient_seq

    print(f"\nAnalyzing patient with {len(patient_sequences)} genes")
    print(f"Patient ID: PAT-2024-DEMO-001")

    # Perform analysis
    result = engine.analyze_patient_genome(patient_sequences)

    # Print results
    print("\n📊 ALIGNMENT RESULTS:")
    for gene, alignment in result["alignment_results"].items():
        print(
            f"  {gene:8s}: Score={alignment['alignment_score']:.4f}, "
            f"Identity={alignment['identity_percent']:.1f}%"
        )

    print("\n🧬 VARIANT SUMMARY:")
    total_variants = 0
    for gene, variants in result["variant_summary"].items():
        total = variants["total_variants"]
        total_variants += total
        print(
            f"  {gene:8s}: {total} variants "
            f"(SNPs={variants['snp_count']}, "
            f"INDELs={variants['insertion_count'] + variants['deletion_count']})"
        )

    print(f"\n  TOTAL VARIANTS: {total_variants}")

    print("\n⚕️ POLYGENIC RISK SCORE:")
    prs = result["polygenic_risk_score"]
    print(f"  PRS Score: {prs['prs']:.4f}")
    print(f"  Risk Category: {prs['risk_category']}")

    print("\n  Per-Gene Contribution:")
    for gene, details in prs["locus_details"].items():
        print(
            f"    {gene:8s}: Weight={details['weight']:.2f}, "
            f"Risk={details['locus_risk']:.4f}, "
            f"Contribution={details['weighted_contribution']:.4f}"
        )

    print("\n📋 CLINICAL INTERPRETATION:")
    clinical = result["clinical_interpretation"]
    print(f"  Risk Level: {clinical['risk_level']}")
    print(f"  Interpretation: {clinical['risk_interpretation']}")
    print(f"  Recommendations:")
    for rec in clinical["clinical_recommendations"]:
        print(f"    • {rec}")


def example_4_haplotype_analysis():
    """Example 4: Haplotype analysis."""
    print("\n" + "="*70)
    print("EXAMPLE 4: Haplotype Classification")
    print("="*70)

    reference_dir = Path(__file__).parent / "refrence"
    engine = GenomicAnalysisEngine(str(reference_dir))
    loader = FastaLoader(str(reference_dir))

    # Analyze haplotypes
    print("\nHaplotype Types and Frequencies:")
    haplotype_types = {
        "WILDTYPE": {"description": "No variants", "frequency": "Common (>5%)"},
        "COMMON_VARIANT": {
            "description": "1-2 variants",
            "frequency": "Low frequency (1-5%)",
        },
        "RARE_VARIANT": {
            "description": "3+ variants",
            "frequency": "Rare (<1%)",
        },
    }

    for htype, info in haplotype_types.items():
        print(f"\n  {htype:18s}")
        print(f"    Description: {info['description']}")
        print(f"    Frequency: {info['frequency']}")


def example_5_risk_scoring():
    """Example 5: Risk score interpretation."""
    print("\n" + "="*70)
    print("EXAMPLE 5: Risk Score Interpretation")
    print("="*70)

    from genomic.risk_scorer import RISK_THRESHOLDS

    print("\nRisk Categories and Thresholds:")
    print(f"  LOW:       PRS < {RISK_THRESHOLDS['LOW']}")
    print(
        f"  MODERATE:  {RISK_THRESHOLDS['LOW']} ≤ PRS < {RISK_THRESHOLDS['MODERATE']}"
    )
    print(f"  HIGH:      PRS ≥ {RISK_THRESHOLDS['MODERATE']}")

    print("\nClinical Recommendations by Risk Level:")

    recommendations = {
        "LOW": [
            "Routine diabetes management",
            "Standard foot care practices",
            "Annual screening",
        ],
        "MODERATE": [
            "Regular wound surveillance (quarterly)",
            "Enhanced diabetes management",
            "Genetic counseling recommended",
        ],
        "HIGH": [
            "Intensive wound monitoring (monthly)",
            "Specialist referral recommended",
            "Consider prophylactic interventions",
            "Family genetic screening",
        ],
    }

    for risk_level, recs in recommendations.items():
        print(f"\n  {risk_level}:")
        for rec in recs:
            print(f"    • {rec}")


def main():
    """Run all examples."""
    print("\n" + "="*70)
    print("PAITALA GENOMIC ANALYSIS EXAMPLES")
    print("="*70)

    try:
        example_1_reference_info()
        example_2_sequence_validation()
        example_3_patient_analysis()
        example_4_haplotype_analysis()
        example_5_risk_scoring()

        print("\n" + "="*70)
        print("✓ All examples completed successfully")
        print("="*70 + "\n")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
