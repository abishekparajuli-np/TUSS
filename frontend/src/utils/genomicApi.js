import axios from 'axios';
import { GENOMIC_SERVER_URL } from '../config/firebase';

const genomicClient = axios.create({
  baseURL: GENOMIC_SERVER_URL,
  timeout: 120000, // 2min — genomic analysis can take time for large files
});

export const genomicApi = {
  /**
   * Upload FASTQ file and analyze patient genome via De Bruijn graph pipeline.
   * Sends raw file as multipart/form-data to the FastAPI server.
   * @param {string} patientId - Firebase patient document ID
   * @param {File} file - FASTQ/FASTA file to upload
   * @param {function} onProgress - Optional progress callback (0-100)
   * @returns {Promise} Analysis results with PRS and risk assessment
   */
  uploadFastq: async (patientId, file, onProgress) => {
    try {
      // Progress: Preparing upload
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(10); } catch (e) { console.warn('onProgress error:', e); }
      }

      // Build multipart FormData — send raw file to server
      const formData = new FormData();
      formData.append('file', file, file.name);

      console.log('Uploading file to genomic server:', file.name, `(${file.size} bytes)`);

      // Progress: Uploading
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(30); } catch (e) { console.warn('onProgress error:', e); }
      }

      // POST to FastAPI endpoint with multipart upload
      const response = await genomicClient.post(`/analyze/genomic/${patientId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && typeof onProgress === 'function' && progressEvent.total) {
            // Map upload progress to 30-80% range
            const uploadPct = 30 + Math.round((progressEvent.loaded / progressEvent.total) * 50);
            try { onProgress(Math.min(uploadPct, 80)); } catch (e) { /* ignore */ }
          }
        },
      });

      // Progress: Complete
      if (onProgress && typeof onProgress === 'function') {
        try { onProgress(100); } catch (e) { console.warn('onProgress error:', e); }
      }

      console.log('Genomic API response:', response.data);
      return response;
    } catch (error) {
      console.error('uploadFastq error:', error);
      if (error.response?.data?.detail) {
        throw new Error(`Genomic API Error: ${error.response.data.detail}`);
      }
      if (error.response?.data?.message) {
        throw new Error(`Genomic API Error: ${error.response.data.message}`);
      }
      throw error;
    }
  },

  /**
   * Retrieve stored genomic profile for a patient from the server.
   * @param {string} patientId - Firebase patient document ID
   * @returns {Promise} Stored genomic profile and fused risk history
   */
  getGenomicProfile: (patientId) => {
    return genomicClient.get(`/genomic/profile/${patientId}`);
  },

  /**
   * Trigger fusion of genomic data with latest thermal scan.
   * @param {string} patientId - Firebase patient document ID
   * @returns {Promise} Fused risk result
   */
  triggerFusion: (patientId) => {
    return genomicClient.post(`/fuse/${patientId}`);
  },

  /**
   * Health check for genomic service.
   * @returns {Promise} Service status
   */
  healthCheck: () =>
    genomicClient.get(`/health`),
};

export default genomicClient;
