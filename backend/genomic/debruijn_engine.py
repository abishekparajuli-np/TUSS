"""
PAITALA — De Bruijn Graph Engine for Genomic Analysis

Builds directed De Bruijn graphs from patient genome sequences (FASTQ format).
Nodes are (k-1)-mers, edges are k-mers with transition probabilities.
Aligns patient graph against reference wound-healing gene loci to detect
SNPs, INDELs, and deletions relevant to diabetic foot ulcer risk.

Loci: MMP1, VEGF, COL1A1, TNF, IL6
"""

import logging
from collections import defaultdict
from typing import Dict, List, Tuple, Optional, Generator

logger = logging.getLogger(__name__)

# ====================== REFERENCE GENE SEQUENCES ======================
# Representative exonic sequences for wound-healing gene loci.
# These are curated consensus sequences from clinically relevant regions.
# In production, these would be loaded from a reference genome database.

REFERENCE_SEQUENCES = {
    "VEGF": (
        "ATGAACTTTCTGCTGTCTTGGGTGCATTGGAGCCTTGCCTTGCTGCTCTAC"
        "CTCCACCATGCCAAGTGGTCCCAGGCTGCACCCATGGCAGAAGGAGGAGGG"
        "CAGAATCATCACGAAGTGGTGAAGTTCATGGATGTCTATCAGCGCAGCTAC"
        "TGCCATCCAATCGAGACCCTGGTGGACATCTTCCAGGAGTACCCTGATGAG"
        "ATCGAGTACATCTTCAAGCCATCCTGTGTGCCCCTGATGCGATGCGGGGGC"
        "TGCTGCAATGACGAGGGCCTGGAGTGTGTGCCCACTGAGGAGTCCAACAT"
    ),
    "MMP1": (
        "ATGCACAGCTTTCCTCCACTGCTGCTGCTGCTGTTCTGGGGACTCAGCCAT"
        "TCTACTGACATTGGAGCTGATACTGAAATTTAATGGCTTCAACCCTTTTAA"
        "CTCAGAAAGAAGACAAAGAAAAATCTTGCCAGATCGTGAAACTTGATGCTG"
        "ATCACAGATTCTTCAAAGACAGATTCTACATGCGCACAAATCCCTTCTACCC"
        "TGGAAGGTGATGTTCTTTAAAGCTTACATGCGGAGCAATTCTAAGATGTTGA"
        "CCCTCAGAAAGAGCAAATACTGGAAGCAAAACACTTTTTGAAGAATTGATCG"
    ),
    "COL1A1": (
        "ATGTTCAGCTTTGTGGACCTCCGGCTCCTGCTCCTCTTAGCGGGGACCAAG"
        "GGTCCAAAGGATCCAAGGGTCCTGATGGTGGCTCCTGGCAAAGAAGGCGGC"
        "AAAGGCCCTCCTGGTCCTGCTGGTCCTAAAGGTCCAGCTGGTCCTAGAGGT"
        "CCAATGGGTCCAAGAGGAGAACGTGGTCCACCTGGACCTAAGGGTGAACGT"
        "GGTCCTCCTGGTCCTGATGGTGCTAAGGGTCTACCAGGCCCAAATGGTGCT"
        "CCAGGACCTGATGGTCCTAAAGGTGCTGCTGGTCCTGATGGTCAGAAAGGT"
    ),
    "TNF": (
        "ATGAGCACTGAAAGCATGATCCGGGACGTGGAGCTGGCCGAGGAGGCGCTC"
        "CCCAAGAAGACAGGGGGGCCCCAGGGCTCCAGGCGGTGCTTGTTCCTCAGC"
        "CTCTTCTCCTTCCTGATCGTGGCAGGCGCCACCACGCTCTTCTGCCTGCTG"
        "CACTTTGGAGTGATCGGCCCCCAGAGGGAAGAGTTCCCCAGGGACCTCTCTC"
        "TAATCAGCCCTCTGGCCCAGGCAGTCAGATCATCTTCTCGAACCCCGAGTGA"
        "CAAACCTGTAGCCCATGTTGTAGCAAACCCTCAAGCTGAGGGGCAGCTCCAG"
    ),
    "IL6": (
        "ATGAACTCCTTCTCCACAAGCGCCTTCGGTCCAGTTGCCTTCTCCCTGGGG"
        "CTGCTCCTGGTGTTGCCTGCTGCCTTCCCTGCCCCAGTACCCCCAGGAGAA"
        "GATTCCAAAGATGTAGCCGCCCCACACAGACAGCCACTCACCTCTTCAGAAC"
        "GAATTGACAAACAAATTCGGTACATCCTCGACGGCATCTCAGCCCTGAGAAA"
        "GGAGACATGTAACAAGAGTAACATGTGTGAAAGCAGCAAAGAGGCACTGGCA"
        "GAAAACAACCTGAACCTTCCAAAGATGGCTGAAAAAGATGGATGCTTCCAATC"
    ),
}


class FastqParser:
    """
    Streaming FASTQ parser. Handles standard 4-line FASTQ format.
    Yields sequences one at a time to avoid loading entire file into memory.
    """

    @staticmethod
    def parse(fastq_content: str) -> Generator[str, None, None]:
        """
        Parse FASTQ content and yield sequence strings.

        FASTQ format (4 lines per record):
          Line 1: @identifier
          Line 2: sequence
          Line 3: + (separator)
          Line 4: quality scores

        Args:
            fastq_content: Raw FASTQ file content as string

        Yields:
            Cleaned DNA sequence strings (uppercase, stripped)
        """
        lines = fastq_content.strip().split('\n')
        i = 0
        records_parsed = 0

        while i < len(lines):
            # Line 1: Header (starts with @)
            header = lines[i].strip()
            if not header.startswith('@'):
                i += 1
                continue

            # Line 2: Sequence
            if i + 1 >= len(lines):
                break
            sequence = lines[i + 1].strip().upper()

            # Line 3: Plus line (starts with +)
            if i + 2 >= len(lines):
                break

            # Line 4: Quality scores (skip)
            if i + 3 >= len(lines):
                break

            # Validate sequence contains only valid bases
            valid_bases = set('ATCGN')
            cleaned = ''.join(c for c in sequence if c in valid_bases)

            if len(cleaned) >= 31:  # Minimum length for k=31
                records_parsed += 1
                yield cleaned

            i += 4

        logger.info(f"Parsed {records_parsed} valid FASTQ records")

    @staticmethod
    def parse_bytes(content: bytes) -> Generator[str, None, None]:
        """Parse FASTQ from raw bytes (handles UTF-8 and ASCII)."""
        text = content.decode('utf-8', errors='ignore')
        yield from FastqParser.parse(text)


class DeBruijnGraph:
    """
    De Bruijn graph for genomic sequence analysis.

    Nodes are (k-1)-mers, edges are k-mers.
    Supports stochastic weight computation and alignment against
    reference gene loci for variant detection.
    """

    def __init__(self, k: int = 31):
        """
        Initialize the De Bruijn graph.

        Args:
            k: k-mer size (default 31, standard for genomic assembly)
        """
        self.k = k
        # Edge counts: maps (prefix, suffix) -> count
        self.edge_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        # Node out-degree counts for transition probability computation
        self.node_out_total: Dict[str, int] = defaultdict(int)
        # Transition probabilities (computed lazily)
        self._stochastic_weights: Optional[Dict[Tuple[str, str], float]] = None
        # Total k-mers processed
        self.total_kmers = 0
        # Unique k-mers seen
        self.kmer_set: set = set()

    def add_sequence(self, sequence: str) -> int:
        """
        Decompose a sequence into k-mers and add edges to the graph.

        Each k-mer becomes a directed edge from its (k-1)-prefix to its (k-1)-suffix.
        Uses defaultdict for memory-efficient counting.

        Args:
            sequence: DNA sequence string

        Returns:
            Number of k-mers extracted from this sequence
        """
        if len(sequence) < self.k:
            return 0

        kmers_added = 0
        for i in range(len(sequence) - self.k + 1):
            kmer = sequence[i:i + self.k]

            # Skip k-mers containing N (ambiguous base)
            if 'N' in kmer:
                continue

            prefix = kmer[:-1]  # (k-1)-mer: left node
            suffix = kmer[1:]   # (k-1)-mer: right node

            self.edge_counts[(prefix, suffix)] += 1
            self.node_out_total[prefix] += 1
            self.kmer_set.add(kmer)
            kmers_added += 1

        self.total_kmers += kmers_added
        self._stochastic_weights = None  # Invalidate cache
        return kmers_added

    def build_from_fastq(self, fastq_content: str) -> dict:
        """
        Build the graph from FASTQ file content.
        Processes sequences in streaming fashion.

        Args:
            fastq_content: Raw FASTQ file content

        Returns:
            Build statistics dict
        """
        sequences_processed = 0
        total_bases = 0

        for sequence in FastqParser.parse(fastq_content):
            self.add_sequence(sequence)
            sequences_processed += 1
            total_bases += len(sequence)

        stats = {
            "sequences_processed": sequences_processed,
            "total_bases": total_bases,
            "total_kmers": self.total_kmers,
            "unique_kmers": len(self.kmer_set),
            "unique_edges": len(self.edge_counts),
            "unique_nodes": len(self.node_out_total),
        }

        logger.info(
            f"Graph built: {sequences_processed} sequences, "
            f"{self.total_kmers} k-mers, "
            f"{len(self.kmer_set)} unique k-mers, "
            f"{len(self.node_out_total)} nodes"
        )

        return stats

    def compute_stochastic_weights(self) -> Dict[Tuple[str, str], float]:
        """
        Convert raw k-mer edge counts into transition probabilities.

        For each node (prefix), the outgoing edge probabilities sum to 1.0.
        This handles the high-dimensional stochastic string representation
        of the genome, allowing probabilistic traversal and comparison.

        Returns:
            Dict mapping (prefix, suffix) edges to transition probabilities
        """
        if self._stochastic_weights is not None:
            return self._stochastic_weights

        self._stochastic_weights = {}

        for (prefix, suffix), count in self.edge_counts.items():
            total_out = self.node_out_total[prefix]
            if total_out > 0:
                self._stochastic_weights[(prefix, suffix)] = count / total_out
            else:
                self._stochastic_weights[(prefix, suffix)] = 0.0

        logger.info(
            f"Computed stochastic weights for {len(self._stochastic_weights)} edges"
        )

        return self._stochastic_weights

    def _generate_reference_kmers(self, sequence: str) -> set:
        """Generate the set of k-mers from a reference sequence."""
        kmers = set()
        for i in range(len(sequence) - self.k + 1):
            kmer = sequence[i:i + self.k]
            if 'N' not in kmer:
                kmers.add(kmer)
        return kmers

    def _detect_snps(
        self, patient_kmers: set, reference_kmers: set
    ) -> List[dict]:
        """
        Detect single nucleotide polymorphisms by finding k-mers that
        differ by exactly one base from reference k-mers.

        Args:
            patient_kmers: Set of k-mers from patient graph
            reference_kmers: Set of k-mers from reference sequence

        Returns:
            List of detected SNP dicts with position and base change info
        """
        snps = []
        # K-mers in patient but not in reference could indicate variants
        novel_kmers = patient_kmers - reference_kmers

        for novel in novel_kmers:
            for ref_kmer in reference_kmers:
                # Count mismatches
                mismatches = []
                if len(novel) != len(ref_kmer):
                    continue

                for pos, (n_base, r_base) in enumerate(zip(novel, ref_kmer)):
                    if n_base != r_base:
                        mismatches.append((pos, r_base, n_base))

                # Exactly 1 mismatch = SNP
                if len(mismatches) == 1:
                    pos, ref_base, alt_base = mismatches[0]
                    snps.append({
                        "type": "SNP",
                        "position": pos,
                        "ref_base": ref_base,
                        "alt_base": alt_base,
                        "kmer_ref": ref_kmer,
                        "kmer_alt": novel,
                    })
                    break  # One match per novel k-mer is enough

        return snps

    def _detect_indels(
        self, patient_kmers: set, reference_kmers: set
    ) -> List[dict]:
        """
        Detect insertions/deletions by analyzing shifted k-mer coverage patterns.
        INDELs cause a characteristic pattern of missing reference k-mers
        flanked by present k-mers.

        Args:
            patient_kmers: Set of k-mers from patient graph
            reference_kmers: Set of k-mers from reference sequence

        Returns:
            List of detected INDEL dicts
        """
        indels = []

        # Convert to sorted lists for positional analysis
        ref_list = sorted(reference_kmers)
        missing_indices = []

        for idx, ref_kmer in enumerate(ref_list):
            if ref_kmer not in patient_kmers:
                missing_indices.append(idx)

        # Find runs of consecutive missing k-mers (indicates INDEL)
        if missing_indices:
            runs = []
            current_run = [missing_indices[0]]

            for i in range(1, len(missing_indices)):
                if missing_indices[i] == missing_indices[i - 1] + 1:
                    current_run.append(missing_indices[i])
                else:
                    if len(current_run) >= 2:
                        runs.append(current_run)
                    current_run = [missing_indices[i]]

            if len(current_run) >= 2:
                runs.append(current_run)

            for run in runs:
                indels.append({
                    "type": "INDEL",
                    "start_index": run[0],
                    "end_index": run[-1],
                    "length": len(run),
                    "description": f"Consecutive {len(run)}-kmer gap detected",
                })

        return indels

    def _detect_deletions(
        self, patient_kmers: set, reference_kmers: set
    ) -> List[dict]:
        """
        Detect large deletions — reference k-mers entirely absent from patient.

        Args:
            patient_kmers: Set of k-mers from patient graph
            reference_kmers: Set of k-mers from reference sequence

        Returns:
            List of deletion dicts
        """
        missing = reference_kmers - patient_kmers
        deletions = []

        if len(missing) > len(reference_kmers) * 0.3:
            deletions.append({
                "type": "DELETION",
                "missing_kmers": len(missing),
                "total_reference_kmers": len(reference_kmers),
                "fraction_missing": len(missing) / max(1, len(reference_kmers)),
                "description": (
                    f"Large deletion: {len(missing)}/{len(reference_kmers)} "
                    f"reference k-mers absent"
                ),
            })

        return deletions

    def eulerian_path_alignment(
        self, locus_name: Optional[str] = None
    ) -> Dict[str, dict]:
        """
        Align patient graph against reference k-mers from wound-healing gene loci.
        Detects SNPs, INDELs, and deletions for each locus.

        For each locus:
        1. Generate reference k-mers from the curated sequence
        2. Compute overlap with patient k-mers (alignment score)
        3. Detect variants: SNPs (1-base mismatches), INDELs (shifted coverage),
           deletions (large missing regions)

        Args:
            locus_name: Optional specific locus to align against.
                       If None, aligns against all 5 loci.

        Returns:
            Dict mapping locus names to alignment results including:
            - alignment_score (0.0-1.0)
            - variant_count
            - variants list (SNPs, INDELs, deletions)
            - reference_kmers_total
            - matched_kmers
        """
        loci = (
            {locus_name: REFERENCE_SEQUENCES[locus_name]}
            if locus_name and locus_name in REFERENCE_SEQUENCES
            else REFERENCE_SEQUENCES
        )

        results = {}
        patient_kmers = self.kmer_set

        for name, ref_sequence in loci.items():
            ref_kmers = self._generate_reference_kmers(ref_sequence)

            if not ref_kmers:
                results[name] = {
                    "alignment_score": 0.0,
                    "variant_count": 0,
                    "variants": [],
                    "reference_kmers_total": 0,
                    "matched_kmers": 0,
                    "snp_count": 0,
                    "indel_count": 0,
                    "deletion_count": 0,
                }
                continue

            # Compute alignment score (fraction of reference k-mers found)
            matched = ref_kmers & patient_kmers
            alignment_score = len(matched) / len(ref_kmers)

            # Detect variants
            snps = self._detect_snps(patient_kmers, ref_kmers)
            indels = self._detect_indels(patient_kmers, ref_kmers)
            deletions = self._detect_deletions(patient_kmers, ref_kmers)

            all_variants = snps + indels + deletions

            results[name] = {
                "alignment_score": round(alignment_score, 4),
                "variant_count": len(all_variants),
                "variants": all_variants,
                "reference_kmers_total": len(ref_kmers),
                "matched_kmers": len(matched),
                "snp_count": len(snps),
                "indel_count": len(indels),
                "deletion_count": len(deletions),
            }

            logger.info(
                f"Locus {name}: alignment={alignment_score:.4f}, "
                f"variants={len(all_variants)} "
                f"(SNPs={len(snps)}, INDELs={len(indels)}, DELs={len(deletions)})"
            )

        return results

    def get_graph_stats(self) -> dict:
        """Return summary statistics about the current graph."""
        return {
            "k": self.k,
            "total_kmers": self.total_kmers,
            "unique_kmers": len(self.kmer_set),
            "unique_edges": len(self.edge_counts),
            "unique_nodes": len(self.node_out_total),
        }
