"""
PAITALA — FASTA File Loader

Loads and manages reference gene sequences from FASTA files.
Provides sequence retrieval, validation, and analysis utilities.
"""

import os
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class FastaLoader:
    """Load and manage FASTA reference sequences."""

    def __init__(self, reference_dir: str):
        """
        Initialize FASTA loader.

        Args:
            reference_dir: Path to directory containing .fasta files
        """
        self.reference_dir = Path(reference_dir)
        self.sequences: Dict[str, str] = {}
        self.metadata: Dict[str, dict] = {}
        self.load_all_sequences()

    def load_all_sequences(self) -> None:
        """Load all FASTA files from reference directory."""
        if not self.reference_dir.exists():
            logger.error(f"Reference directory not found: {self.reference_dir}")
            return

        fasta_files = list(self.reference_dir.glob("*.fasta")) + list(
            self.reference_dir.glob("*.fa")
        )

        logger.info(f"Found {len(fasta_files)} FASTA files in {self.reference_dir}")

        for fasta_file in fasta_files:
            gene_name = fasta_file.stem.upper()
            try:
                sequence, headers = self.parse_fasta(fasta_file)
                self.sequences[gene_name] = sequence
                self.metadata[gene_name] = {
                    "file": str(fasta_file),
                    "length": len(sequence),
                    "headers": headers,
                    "gc_content": self.calculate_gc_content(sequence),
                }
                logger.info(
                    f"✓ Loaded {gene_name}: {len(sequence)}bp, "
                    f"GC={self.metadata[gene_name]['gc_content']:.1%}"
                )
            except Exception as e:
                logger.error(f"✗ Failed to load {fasta_file}: {e}")

    @staticmethod
    def parse_fasta(fasta_input) -> Tuple[str, list]:
        """
        Parse FASTA file or FASTA content string.

        Args:
            fasta_input: Path to FASTA file, or raw FASTA content string

        Returns:
            Tuple of (sequence_string, headers_list)
        """
        sequence = ""
        headers = []

        # Determine if input is a file path or raw content
        input_path = Path(fasta_input) if not isinstance(fasta_input, Path) else fasta_input

        if input_path.exists() and input_path.is_file():
            # Input is a file path — read from disk
            with open(input_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith(">"):
                        headers.append(line[1:])
                    else:
                        sequence += line.upper()
        else:
            # Input is raw FASTA content string
            content = str(fasta_input)
            for line in content.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if line.startswith(">"):
                    headers.append(line[1:])
                else:
                    sequence += line.upper()

        return sequence, headers

    def get_sequence(self, gene: str) -> Optional[str]:
        """
        Get reference sequence for a gene.

        Args:
            gene: Gene name (e.g., "VEGF", "MMP1")

        Returns:
            Sequence string or None if not found
        """
        return self.sequences.get(gene.upper())

    def get_all_sequences(self) -> Dict[str, str]:
        """Get all loaded reference sequences."""
        return self.sequences.copy()

    def get_metadata(self, gene: str) -> Optional[dict]:
        """Get metadata for a loaded sequence."""
        return self.metadata.get(gene.upper())

    @staticmethod
    def calculate_gc_content(sequence: str) -> float:
        """Calculate GC content percentage."""
        if not sequence:
            return 0.0
        gc_count = sequence.count("G") + sequence.count("C")
        return gc_count / len(sequence)

    def validate_sequence(self, sequence: str) -> Tuple[bool, str]:
        """
        Validate DNA sequence (only ATCG+N allowed).

        Args:
            sequence: DNA sequence string

        Returns:
            Tuple of (is_valid, message)
        """
        sequence = sequence.upper()
        valid_chars = set("ATCGN")
        invalid_chars = set(sequence) - valid_chars

        if invalid_chars:
            return False, f"Invalid characters: {invalid_chars}"

        return True, "Sequence is valid"

    def summary(self) -> dict:
        """Get summary of loaded sequences."""
        return {
            "total_genes": len(self.sequences),
            "genes": list(self.sequences.keys()),
            "total_bp": sum(len(seq) for seq in self.sequences.values()),
            "metadata": self.metadata,
        }


class SequenceAnalyzer:
    """Analyze and process DNA sequences."""

    @staticmethod
    def count_kmers(sequence: str, k: int = 21) -> Dict[str, int]:
        """
        Count k-mers in sequence.

        Args:
            sequence: DNA sequence
            k: k-mer size (default 21)

        Returns:
            Dictionary of k-mer counts
        """
        kmers = {}
        sequence = sequence.upper()

        for i in range(len(sequence) - k + 1):
            kmer = sequence[i : i + k]
            if "N" not in kmer:  # Skip k-mers with ambiguous bases
                kmers[kmer] = kmers.get(kmer, 0) + 1

        return kmers

    @staticmethod
    def find_variants(
        reference: str, query: str, window_size: int = 21
    ) -> Dict[str, list]:
        """
        Detect variants (SNPs, INDELs) between sequences.

        Args:
            reference: Reference sequence
            query: Query sequence
            window_size: Analysis window size

        Returns:
            Dict with variant types and positions
        """
        variants = {"snps": [], "insertions": [], "deletions": []}

        ref_upper = reference.upper()
        query_upper = query.upper()

        # SNP detection (point mutations)
        min_len = min(len(ref_upper), len(query_upper))
        for i in range(min_len):
            if ref_upper[i] != query_upper[i]:
                variants["snps"].append(
                    {
                        "position": i,
                        "reference": ref_upper[i],
                        "alternate": query_upper[i],
                    }
                )

        # INDEL detection
        if len(query_upper) > len(ref_upper):
            variants["insertions"].append(
                {
                    "position": min_len,
                    "length": len(query_upper) - len(ref_upper),
                    "sequence": query_upper[min_len:],
                }
            )
        elif len(ref_upper) > len(query_upper):
            variants["deletions"].append(
                {
                    "position": min_len,
                    "length": len(ref_upper) - len(query_upper),
                    "sequence": ref_upper[min_len:],
                }
            )

        return variants

    @staticmethod
    def sequence_identity(seq1: str, seq2: str) -> float:
        """
        Calculate sequence identity percentage.

        Args:
            seq1: First sequence
            seq2: Second sequence

        Returns:
            Identity percentage (0-100)
        """
        s1 = seq1.upper()
        s2 = seq2.upper()

        if not s1 or not s2:
            return 0.0

        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        return (matches / max(len(s1), len(s2))) * 100

    @staticmethod
    def mutation_rate(variants_dict: Dict) -> float:
        """
        Calculate mutation rate from variants.

        Args:
            variants_dict: Output from find_variants()

        Returns:
            Mutations per 1000 bp
        """
        total_variants = (
            len(variants_dict.get("snps", []))
            + len(variants_dict.get("insertions", []))
            + len(variants_dict.get("deletions", []))
        )
        return total_variants * 1000 / max(1, len(variants_dict))
