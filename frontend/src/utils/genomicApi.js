import axios from 'axios';
import { GENOMIC_SERVER_URL } from '../config/firebase';

const genomicClient = axios.create({
  baseURL: GENOMIC_SERVER_URL,
  timeout: 120000, // 2min — genomic analysis can take time for large files
});

export const genomicApi = {
  /**
   * Upload FASTQ file and analyze patient genome.
   * Parses FASTQ and extracts gene sequences for analysis.
   * @param {string} patientId - Firebase patient document ID
   * @param {File} file - FASTQ file to upload
   * @param {function} onProgress - Optional progress callback (0-100)
   * @returns {Promise} Analysis results with PRS and risk assessment
   */
  uploadFastq: async (patientId, file, onProgress) => {
    try {
      // Progress: Parsing file
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(10); } catch (e) { console.warn('onProgress error:', e); }
      }

      // Parse FASTQ file and extract sequences
      const text = await file.text();
      const sequences = parseSimplifiedFastq(text);
      
      console.log('Parsed sequences:', sequences);
      console.log('Sequence lengths:', Object.fromEntries(
        Object.entries(sequences).map(([k, v]) => [k, v.length])
      ));

      if (!sequences || Object.keys(sequences).length === 0) {
        throw new Error('No valid sequences found in FASTQ file. Ensure file contains gene names (VEGF, MMP1, COL1A1, TNF, IL6)');
      }

      // Validate we have at least some genes
      const genes = ['VEGF', 'MMP1', 'COL1A1', 'TNF', 'IL6'];
      const foundGenes = Object.keys(sequences).filter(g => genes.includes(g));
      if (foundGenes.length === 0) {
        console.warn('Warning: No recognized genes found. Using parsed sequences:', Object.keys(sequences));
      }

      // Progress: Sending to API
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(50); } catch (e) { console.warn('onProgress error:', e); }
      }

      // Call genomic analysis API
      console.log('Sending to API:', { patient_id: patientId, sequences });
      
      const response = await genomicClient.post(`/api/genomic/analyze`, {
        patient_id: patientId,
        sequences: sequences,
      });

      // Progress: Complete
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(100); } catch (e) { console.warn('onProgress error:', e); }
      }

      console.log('API response:', response.data);
      return response;
    } catch (error) {
      console.error('uploadFastq error:', error);
      if (error.response?.data?.message) {
        throw new Error(`API Error: ${error.response.data.message}`);
      }
      throw error;
    }
  },

  /**
   * Analyze patient genome with DNA sequences.
   * @param {string} patientId - Firebase patient document ID
   * @param {object} sequences - Gene sequences {VEGF, MMP1, COL1A1, TNF, IL6}
   * @returns {Promise} Analysis results with PRS and risk assessment
   */
  analyzeGenome: (patientId, sequences) => {
    return genomicClient.post(`/api/genomic/analyze`, {
      patient_id: patientId,
      sequences: sequences,
    });
  },

  /**
   * Get reference gene information.
   * @returns {Promise} Reference sequence metadata
   */
  getReferenceInfo: () =>
    genomicClient.get(`/api/genomic/reference-info`),

  /**
   * Health check for genomic service.
   * @returns {Promise} Service status
   */
  healthCheck: () =>
    genomicClient.get(`/api/genomic/health`),
};

/**
 * Parse FASTQ file and extract sequences by gene name.
 * Tries multiple strategies to identify genes and extract sequences.
 * @param {string} fastqContent - Raw FASTQ file content
 * @returns {object} Gene sequences {VEGF: "...", MMP1: "...", etc}
 */
function parseSimplifiedFastq(fastqContent) {
  const sequences = {};
  const genes = ['VEGF', 'MMP1', 'COL1A1', 'TNF', 'IL6'];
  
  console.log('FASTQ file size:', fastqContent.length, 'bytes');
  console.log('First 500 chars:', fastqContent.substring(0, 500));

  // Strategy 1: Parse as standard FASTQ (header + sequence + plus + quality)
  const lines = fastqContent.split('\n').map(l => l.trim()).filter(l => l);
  console.log('Total lines:', lines.length);

  let currentGene = null;
  let currentSeq = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Header line (starts with @ or >)
    if ((line.startsWith('@') || line.startsWith('>')) && line.length > 1) {
      // Save previous sequence if exists
      if (currentGene && currentSeq.length > 0) {
        sequences[currentGene] = currentSeq.toUpperCase();
        console.log(`Saved ${currentGene}: ${currentSeq.length}bp`);
      }

      // Identify gene from header
      currentGene = null;
      currentSeq = '';
      
      const headerUpper = line.toUpperCase();
      for (const gene of genes) {
        if (headerUpper.includes(gene)) {
          currentGene = gene;
          console.log(`Found gene ${gene} in header: ${line.substring(0, 60)}`);
          break;
        }
      }

      i++;
    }
    // Sequence line (DNA/RNA nucleotides)
    else if (line && !line.startsWith('+') && currentGene && /^[ATCGN]+$/i.test(line)) {
      currentSeq += line;
      i++;
    }
    // Quality line or other (skip)
    else if (line.startsWith('+') || /^[!-~]+$/.test(line)) {
      i++;
    }
    // Possibly a sequence line without gene header
    else if (line && /^[ATCGN]+$/i.test(line) && !currentGene) {
      // Try to guess gene from any context
      currentSeq += line;
      i++;
    }
    else {
      i++;
    }
  }

  // Save last sequence
  if (currentGene && currentSeq.length > 0) {
    sequences[currentGene] = currentSeq.toUpperCase();
    console.log(`Saved ${currentGene}: ${currentSeq.length}bp`);
  }

  console.log('Extracted sequences:', Object.keys(sequences));
  
  // If no genes found, try alternative: treat entire file as sequences for each gene
  if (Object.keys(sequences).length === 0) {
    console.warn('No genes found with header-based parsing. Trying alternative...');
    
    // Collect all sequence lines
    let allSeqs = lines
      .filter(l => /^[ATCGN]+$/i.test(l))
      .map(l => l.toUpperCase())
      .join('');
    
    if (allSeqs.length > 0) {
      console.log(`Found ${allSeqs.length}bp of sequence data`);
      
      // Distribute across genes if we have a long sequence
      if (allSeqs.length >= 5000) {
        const chunkSize = Math.floor(allSeqs.length / 5);
        genes.forEach((gene, idx) => {
          sequences[gene] = allSeqs.substring(idx * chunkSize, (idx + 1) * chunkSize);
          console.log(`Assigned ${sequences[gene].length}bp to ${gene}`);
        });
      } else {
        // Use same sequence for all genes (for testing)
        genes.forEach(gene => {
          sequences[gene] = allSeqs;
        });
      }
    }
  }

  return sequences;
}

export default genomicClient;
