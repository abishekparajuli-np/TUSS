#!/usr/bin/env python3
"""
Quick verification script for genomic analysis fixes.
Tests the API response format transformation.
"""

import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def verify_api_response_format():
    """Verify API returns correct response format"""
    from genomic import GenomicAnalysisEngine
    from pathlib import Path
    
    print("=" * 60)
    print("GENOMIC ANALYSIS FIX VERIFICATION")
    print("=" * 60)
    
    # Initialize engine
    reference_dir = Path(__file__).parent / "backend" / "genomic" / "refrence"
    engine = GenomicAnalysisEngine(str(reference_dir))
    
    print(f"✓ Engine initialized")
    print(f"  Reference dir: {reference_dir}")
    print(f"  Genes: {engine.clinical_genes}")
    
    # Test with sample sequences
    test_sequences = {
        "VEGF": "ATGAACTTTCTGCTGTCTTGGGTGCATTGGAGCCTTGCCTTGCTGCTCTACCTCCACCATGCCAAGTGGTCCCAGGCTGCACCCATGGCAGAAGGAGGAGGG",
        "MMP1": "ATGCACAGCTTTCCTCCACTGCTGCTGCTGCTGTTCTGGGGACTCAGCCATTCTACTGACATTGGAGCTGATACTGAAATTTAATGGCTTCAACCCTTTTAAC",
        "COL1A1": "ATGTTCAGCTTTGTGGACCTCCGGCTCCTGCTCCTCTTAGCGGGGACCAAGGGTCCAAAGGATCCAAGGGTCCTGATGGTGGCTCCTGGCAAAGAAGGCGGCA",
        "TNF": "ATGAGCACTGAAAGCATGATCCGGGACGTGGAGCTGGCCGAGGAGGCGCTCCCCAAGAAGACAGGGGGGCCCCAGGGCTCCAGGCGGTGCTTGTTCCTCAGCC",
        "IL6": "ATGAACTCCTTCTCCACAAGCGCCTTCGGTCCAGTTGCCTTCTCCCTGGGGCTGCTCCTGGTGTTGCCTGCTGCCTTCCCTGCCCCAGTACCCCCAGGAGAAG",
    }
    
    print(f"\n✓ Analyzing test sequences...")
    result = engine.analyze_patient_genome(test_sequences)
    
    # Extract response data like the API would
    prs_data = result.get("polygenic_risk_score", {})
    variant_summary = result.get("variant_summary", {})
    alignment_results = result.get("alignment_results", {})
    
    # Build locus_details like the API transformation
    locus_details = {}
    for gene in engine.clinical_genes:
        locus_details[gene] = {
            "variant_count": variant_summary.get(gene, {}).get("total_variants", 0),
            "snp_count": variant_summary.get(gene, {}).get("snp_count", 0),
            "indel_count": variant_summary.get(gene, {}).get("insertion_count", 0),
            "deletion_count": variant_summary.get(gene, {}).get("deletion_count", 0),
            "alignment_score": alignment_results.get(gene, {}).get("alignment_score", 0),
        }
    
    # Build response like the API
    response_data = {
        "status": "success",
        "patient_id": "test_patient",
        "prs": prs_data.get("prs", 0),
        "risk_category": prs_data.get("risk_category", "UNKNOWN"),
        "total_variants": sum(v.get("total_variants", 0) for v in variant_summary.values()),
        "timestamp": result.get("analysis_date", ""),
        "locus_details": locus_details,
    }
    
    print("\n" + "=" * 60)
    print("API RESPONSE FORMAT")
    print("=" * 60)
    print(json.dumps(response_data, indent=2))
    
    # Verify response has expected fields
    print("\n" + "=" * 60)
    print("VALIDATION")
    print("=" * 60)
    
    checks = [
        ("PRS value", response_data.get("prs") is not None and response_data["prs"] > 0),
        ("Risk category", response_data.get("risk_category") in ["LOW", "MODERATE", "HIGH"]),
        ("Total variants", response_data.get("total_variants") is not None),
        ("Locus details", len(response_data.get("locus_details", {})) == 5),
        ("Gene alignment scores", all(locus_details[g]["alignment_score"] > 0 for g in engine.clinical_genes)),
    ]
    
    all_passed = True
    for check_name, passed in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {check_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL CHECKS PASSED")
        print("The API response format is correct!")
        print("Frontend should now display real values instead of zeros.")
    else:
        print("✗ SOME CHECKS FAILED")
        print("There may be issues with the analysis results.")
    print("=" * 60 + "\n")
    
    return all_passed

if __name__ == "__main__":
    try:
        success = verify_api_response_format()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
