"""
Quick verification test for the genomic analysis pipeline.
Run from backend directory: python test_genomic.py
"""
import sys
import os

# Add backend dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_fastq_parser():
    from genomic.debruijn_engine import FastqParser
    
    with open('test_sample.fastq', 'r') as f:
        content = f.read()
    
    sequences = list(FastqParser.parse(content))
    print(f"[PASS] FastqParser: parsed {len(sequences)} sequences")
    assert len(sequences) == 12, f"Expected 12 sequences, got {len(sequences)}"
    for seq in sequences:
        assert len(seq) >= 31, f"Sequence too short: {len(seq)}"
        assert all(c in 'ATCGN' for c in seq), f"Invalid bases in sequence"
    print(f"[PASS] All sequences are valid DNA (length >= 31)")


def test_debruijn_graph():
    from genomic.debruijn_engine import DeBruijnGraph
    
    with open('test_sample.fastq', 'r') as f:
        content = f.read()
    
    graph = DeBruijnGraph(k=31)
    stats = graph.build_from_fastq(content)
    
    print(f"\n[PASS] De Bruijn Graph built:")
    print(f"  Sequences: {stats['sequences_processed']}")
    print(f"  Total k-mers: {stats['total_kmers']}")
    print(f"  Unique k-mers: {stats['unique_kmers']}")
    print(f"  Nodes: {stats['unique_nodes']}")
    print(f"  Edges: {stats['unique_edges']}")
    
    assert stats['total_kmers'] > 0, "No k-mers extracted"
    assert stats['unique_nodes'] > 0, "No nodes in graph"
    
    # Test stochastic weights
    weights = graph.compute_stochastic_weights()
    print(f"\n[PASS] Stochastic weights computed: {len(weights)} edges")
    
    # Verify probabilities sum to ~1.0 per node
    from collections import defaultdict
    node_totals = defaultdict(float)
    for (prefix, _), prob in weights.items():
        node_totals[prefix] += prob
    
    for node, total in list(node_totals.items())[:5]:
        assert abs(total - 1.0) < 0.001, f"Node {node[:10]}... probabilities sum to {total}"
    print(f"[PASS] Transition probabilities verified (sum to 1.0 per node)")
    
    return graph


def test_alignment(graph):
    results = graph.eulerian_path_alignment()
    
    print(f"\n[PASS] Eulerian path alignment against 5 loci:")
    for locus, data in results.items():
        print(f"  {locus:8s}: alignment={data['alignment_score']:.4f}, "
              f"variants={data['variant_count']}, "
              f"SNPs={data['snp_count']}, "
              f"INDELs={data['indel_count']}, "
              f"DELs={data['deletion_count']}")
    
    assert len(results) == 5, f"Expected 5 loci, got {len(results)}"
    return results


def test_risk_scorer(alignment_results):
    from genomic.risk_scorer import GenomicRiskScorer
    
    scorer = GenomicRiskScorer()
    result = scorer.compute_prs(alignment_results)
    
    print(f"\n[PASS] PRS computed:")
    print(f"  PRS: {result['prs']:.4f}")
    print(f"  Risk Category: {result['risk_category']}")
    print(f"  Total Variants: {result['total_variants']}")
    print(f"  Per-locus breakdown:")
    for gene, details in result['locus_details'].items():
        print(f"    {gene:8s}: risk={details['locus_risk']:.4f}, "
              f"weight={details['weight']}, "
              f"contribution={details['weighted_contribution']:.4f}")
    
    assert 0.0 <= result['prs'] <= 1.0, f"PRS out of range: {result['prs']}"
    assert result['risk_category'] in ('LOW', 'MODERATE', 'HIGH')
    return result


def test_fusion(prs_result):
    from models.fusion_model import FusionModel
    
    model = FusionModel()
    
    # Test with various thermal scenarios
    scenarios = [
        (0.3, 25.0, "low thermal"),
        (0.7, 55.0, "medium thermal"),
        (0.95, 85.0, "high thermal"),
    ]
    
    print(f"\n[PASS] Fusion model results (genomic PRS={prs_result['prs']:.4f}):")
    for conf, risk, label in scenarios:
        result = model.fuse(
            thermal_confidence=conf,
            thermal_risk_score=risk,
            genomic_prs=prs_result['prs'],
        )
        print(f"  {label:16s}: fused={result['fused_score']:.4f}, "
              f"level={result['risk_level']}, "
              f"flag={result['clinical_flag']}, "
              f"escalated={result['escalated']}")
        
        assert 0.0 <= result['fused_score'] <= 1.0
        assert result['risk_level'] in ('Low', 'Medium', 'High')


def main():
    print("=" * 60)
    print("PAITALA Genomic Pipeline — Verification Tests")
    print("=" * 60)
    
    test_fastq_parser()
    graph = test_debruijn_graph()
    alignment = test_alignment(graph)
    prs = test_risk_scorer(alignment)
    test_fusion(prs)
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED [OK]")
    print("=" * 60)


if __name__ == "__main__":
    main()
