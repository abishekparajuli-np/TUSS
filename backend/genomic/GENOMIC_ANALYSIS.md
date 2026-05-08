# 🧬 PAITALA Genomic Analysis System

## Overview

The genomic analysis system performs comprehensive genetic analysis to predict diabetic foot ulcer risk through:

- **Reference Sequence Loading**: Loads FASTA files for 5 key wound-healing genes
- **Sequence Alignment**: Smith-Waterman local alignment algorithm
- **Variant Detection**: Identifies SNPs, INDELs, and deletions
- **Haplotype Analysis**: Classifies genetic variants
- **Polygenic Risk Scoring**: Computes weighted genetic risk score
- **Clinical Interpretation**: Provides actionable medical recommendations

---

## Reference Genes

The system analyzes 5 critical wound-healing genes:

| Gene | Weight | Function | Clinical Significance |
|------|--------|----------|----------------------|
| **VEGF** | 0.30 | Vascular Endothelial Growth Factor | Angiogenesis, vascular formation |
| **MMP1** | 0.25 | Matrix Metalloproteinase-1 | Tissue remodeling, ECM degradation |
| **COL1A1** | 0.20 | Collagen Type I Alpha 1 | Structural healing, tissue integrity |
| **TNF** | 0.15 | Tumor Necrosis Factor | Inflammatory response regulation |
| **IL6** | 0.10 | Interleukin-6 | Inflammatory signaling |

---

## Architecture

```
┌─────────────────────────────────────────┐
│   Patient Genome Sequences (FASTA)      │
└──────────────┬──────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ FastaLoader  │ ← Loads reference genes
        └──────┬───────┘
               │
               ▼
    ┌──────────────────────┐
    │ SequenceAnalyzer     │ ← Alignment & variants
    └──────┬───────────────┘
           │
           ├─ Smith-Waterman Alignment
           ├─ SNP Detection
           ├─ INDEL Detection
           └─ Haplotype Classification
           │
           ▼
    ┌──────────────────────┐
    │ GenomicAnalysisEngine│ ← Complete analysis
    └──────┬───────────────┘
           │
           ├─ Sequence validation
           ├─ Per-gene analysis
           ├─ Variant summarization
           └─ Clinical interpretation
           │
           ▼
    ┌──────────────────────┐
    │ GenomicRiskScorer    │ ← PRS computation
    └──────┬───────────────┘
           │
           ├─ Locus risk calculation
           ├─ Weighted PRS
           └─ Risk categorization
           │
           ▼
    ┌──────────────────────┐
    │ Clinical Report      │ ← Final output
    └──────────────────────┘
```

---

## Installation

### 1. Verify FASTA Files

Ensure all reference FASTA files are in `backend/genomic/refrence/`:

```bash
ls -la backend/genomic/refrence/
# Output:
# COL1A1.fasta
# IL6.fasta
# MMP1.fasta
# TNF.fasta
# VEGF.fasta
```

### 2. Install Dependencies

All required packages are in `backend/requirements.txt`:

```bash
pip install -r backend/requirements.txt
```

---

## API Endpoints

### Base URL
```
http://localhost:5051/api/genomic
```

### 1. Reference Information

**Endpoint**: `GET /api/genomic/reference-info`

**Description**: Get information about loaded reference sequences

**Response**:
```json
{
  "status": "success",
  "data": {
    "total_genes": 5,
    "genes": ["VEGF", "MMP1", "COL1A1", "TNF", "IL6"],
    "total_bp": 12450,
    "metadata": {
      "VEGF": {
        "file": "backend/genomic/refrence/VEGF.fasta",
        "length": 2450,
        "gc_content": 0.52
      }
    }
  }
}
```

---

### 2. Analyze Genome

**Endpoint**: `POST /api/genomic/analyze`

**Description**: Perform complete genomic analysis

**Request**:
```json
{
  "patient_id": "PAT-2024-001",
  "sequences": {
    "VEGF": "ATGAACTTTCTGCTGTCTTGG...",
    "MMP1": "ATGCACAGCTTTCCTCCACTG...",
    "COL1A1": "ATGTTCAGCTTTGTGGACCTC...",
    "TNF": "ATGAGCACTGAAAGCATGATC...",
    "IL6": "ATGAACTCCTTCTCCACAAGC..."
  }
}
```

**Response**:
```json
{
  "status": "success",
  "patient_id": "PAT-2024-001",
  "analysis": {
    "analysis_date": "2024-05-09T14:30:00Z",
    "alignment_results": {
      "VEGF": {
        "alignment_score": 0.92,
        "identity_percent": 95.3,
        "reference_length": 2450,
        "query_length": 2445
      }
    },
    "variant_summary": {
      "VEGF": {
        "total_variants": 3,
        "snp_count": 2,
        "insertion_count": 0,
        "deletion_count": 1,
        "variants": {
          "snps": [
            {
              "position": 145,
              "reference": "A",
              "alternate": "G"
            }
          ]
        }
      }
    },
    "haplotype_analysis": {
      "VEGF": {
        "haplotype_type": "COMMON_VARIANT",
        "variant_burden": 3,
        "allele_frequency_estimate": "1-5% (low frequency)",
        "functional_impact": "MILD_IMPACT"
      }
    },
    "polygenic_risk_score": {
      "prs": 0.42,
      "risk_category": "MODERATE",
      "total_variants": 12,
      "locus_details": {
        "VEGF": {
          "weight": 0.30,
          "alignment_score": 0.92,
          "variant_count": 3,
          "locus_risk": 0.18,
          "weighted_contribution": 0.054
        }
      }
    },
    "clinical_interpretation": {
      "risk_level": "MODERATE",
      "prs_score": 0.42,
      "risk_interpretation": "Moderate genetic risk for diabetic foot complications. Enhanced monitoring and preventive care recommended.",
      "gene_insights": {
        "VEGF": "Significant sequence variation detected (95.3% identity)"
      },
      "clinical_recommendations": [
        "Regular wound surveillance",
        "Standard diabetes management with enhanced foot care"
      ],
      "total_variants_detected": 12
    }
  }
}
```

---

### 3. Analyze FASTA Content

**Endpoint**: `POST /api/genomic/analyze-fasta`

**Description**: Analyze patient genome from raw FASTA format

**Request**:
```json
{
  "patient_id": "PAT-2024-001",
  "fasta_content": {
    "VEGF": ">chr6:VEGF_exon1\nATGAACTTTCTGCTGTCTTGGGTGCATTGGAGCCTTGCCTTGCTGCTCTAC...",
    "MMP1": ">chr11:MMP1_exon1\nATGCACAGCTTTCCTCCACTGCTGCTGCTGCTGCTGTCTGGGGACTCAGC..."
  }
}
```

---

### 4. Get Variant Report

**Endpoint**: `GET /api/genomic/variants/<patient_id>`

**Description**: Retrieve variant report for analyzed patient

**Response**:
```json
{
  "status": "success",
  "patient_id": "PAT-2024-001",
  "variants": {
    "VEGF": {
      "snps": [
        {
          "position": 145,
          "reference": "A",
          "alternate": "G",
          "functional_class": "missense"
        }
      ],
      "indels": []
    }
  }
}
```

---

### 5. Get PRS Report

**Endpoint**: `GET /api/genomic/prs/<patient_id>`

**Description**: Get Polygenic Risk Score for patient

**Response**:
```json
{
  "status": "success",
  "patient_id": "PAT-2024-001",
  "prs_report": {
    "prs": 0.42,
    "risk_category": "MODERATE",
    "per_locus_scores": {
      "VEGF": 0.054,
      "MMP1": 0.062,
      "COL1A1": 0.040,
      "TNF": 0.038,
      "IL6": 0.026
    }
  }
}
```

---

### 6. Get Clinical Interpretation

**Endpoint**: `GET /api/genomic/clinical-interpretation/<patient_id>`

**Description**: Get clinical report and recommendations

**Response**:
```json
{
  "status": "success",
  "patient_id": "PAT-2024-001",
  "clinical_report": {
    "risk_level": "MODERATE",
    "risk_interpretation": "Moderate genetic risk...",
    "recommendations": [
      "Regular wound surveillance",
      "Enhanced diabetes management"
    ]
  }
}
```

---

### 7. Health Check

**Endpoint**: `GET /api/genomic/health`

**Description**: Service health and reference status

**Response**:
```json
{
  "status": "healthy",
  "service": "genomic-analysis",
  "reference_genes_loaded": 5,
  "reference_genes": ["VEGF", "MMP1", "COL1A1", "TNF", "IL6"]
}
```

---

## Usage Example

### Python Client

```python
import requests
import json

# API base URL
BASE_URL = "http://localhost:5051/api/genomic"

# Patient genome sequences
patient_data = {
    "patient_id": "PAT-2024-001",
    "sequences": {
        "VEGF": "ATGAACTTTCTGCTGTCTTGG...",  # ~2400 bp
        "MMP1": "ATGCACAGCTTTCCTCCACTG...",  # ~1800 bp
        "COL1A1": "ATGTTCAGCTTTGTGGACCTC...", # ~2100 bp
        "TNF": "ATGAGCACTGAAAGCATGATC...",   # ~1900 bp
        "IL6": "ATGAACTCCTTCTCCACAAGC...",    # ~1650 bp
    }
}

# Send analysis request
response = requests.post(
    f"{BASE_URL}/analyze",
    json=patient_data,
    headers={"Content-Type": "application/json"}
)

if response.status_code == 200:
    result = response.json()
    
    # Extract key findings
    analysis = result["analysis"]
    prs = analysis["polygenic_risk_score"]["prs"]
    risk = analysis["polygenic_risk_score"]["risk_category"]
    
    print(f"PRS Score: {prs:.4f}")
    print(f"Risk Category: {risk}")
    print(f"Recommendations: {analysis['clinical_interpretation']['clinical_recommendations']}")
else:
    print(f"Error: {response.status_code}")
    print(response.json())
```

### cURL Example

```bash
curl -X POST http://localhost:5051/api/genomic/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "PAT-2024-001",
    "sequences": {
      "VEGF": "ATGAACTTTCTGCTGTCTTGG...",
      "MMP1": "ATGCACAGCTTTCCTCCACTG...",
      "COL1A1": "ATGTTCAGCTTTGTGGACCTC...",
      "TNF": "ATGAGCACTGAAAGCATGATC...",
      "IL6": "ATGAACTCCTTCTCCACAAGC..."
    }
  }'
```

---

## Risk Interpretation

### PRS Score Thresholds

| PRS Range | Risk Category | Interpretation | Recommendations |
|-----------|---------------|-----------------|-----------------|
| < 0.30 | **LOW** | Favorable genetic markers for wound healing | Standard diabetes management |
| 0.30-0.60 | **MODERATE** | Enhanced risk monitoring needed | Enhanced foot care + surveillance |
| > 0.60 | **HIGH** | Significant genetic predisposition | Intensive management + counseling |

### Clinical Actions by Risk Level

**LOW Risk (PRS < 0.30)**
- Routine diabetes management
- Standard foot care practices
- Annual screening

**MODERATE Risk (0.30 ≤ PRS < 0.60)**
- Regular wound surveillance (quarterly)
- Enhanced diabetes management
- Genetic counseling recommended
- Advanced foot care education

**HIGH Risk (PRS ≥ 0.60)**
- Intensive wound monitoring (monthly)
- Frequent clinical reviews
- Specialist referral recommended
- Consider prophylactic interventions
- Family genetic screening

---

## Variant Classifications

### SNP (Single Nucleotide Polymorphism)
- Single base pair substitution (A↔T, A↔G, etc.)
- Can be synonymous or non-synonymous
- Detected at specific positions

### INDEL (Insertion/Deletion)
- Gain or loss of DNA segment
- Can cause frameshift mutations
- Higher functional impact than SNPs

### Deletion
- Loss of reference sequence segment
- May indicate structural variation
- Can have severe functional consequences

---

## File Format Specifications

### FASTA Format

```
>header_line
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG
```

### Validation Rules

✓ Valid: ATCG and N characters only (case-insensitive)
✗ Invalid: U (RNA), special characters, numbers

---

## Performance Characteristics

- **Sequence Alignment**: O(n×m) where n,m are sequence lengths
- **Variant Detection**: O(n) where n is sequence length
- **PRS Computation**: O(1) - constant time
- **Average Analysis Time**: ~500ms for 5 genes

---

## Troubleshooting

### Common Errors

**1. "Reference directory not found"**
```
Solution: Ensure backend/genomic/refrence/ directory exists
         with all 5 FASTA files
```

**2. "Invalid sequence" error**
```
Solution: Check sequences contain only ATCGN characters
         Remove spaces, newlines, and other characters
```

**3. "Sequence not found for gene"**
```
Solution: Verify gene names match: VEGF, MMP1, COL1A1, TNF, IL6
         Gene names are case-sensitive
```

---

## Database Integration

To store and retrieve analyses:

```python
# Save analysis result
analysis_result = {
    "patient_id": "PAT-2024-001",
    "analysis": {...},
    "timestamp": "2024-05-09T14:30:00Z"
}

# Store in Firestore
db.collection("genomic_analyses").document(patient_id).set(analysis_result)

# Retrieve later
doc = db.collection("genomic_analyses").document(patient_id).get()
if doc.exists:
    analysis = doc.to_dict()
```

---

## References

- **Smith-Waterman Algorithm**: Local sequence alignment
- **De Bruijn Graphs**: Efficient k-mer analysis
- **Polygenic Risk Score**: Weighted genetic risk computation
- **Clinical Guidelines**: Diabetic foot ulcer prevention

---

**Last Updated**: May 9, 2026  
**Version**: 1.0  
**Status**: Production Ready
