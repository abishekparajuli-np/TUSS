// Firebase configuration - loaded from .env file
// Required env variables (Vite format with VITE_ prefix):
// VITE_FIREBASE_API_KEY
// VITE_FIREBASE_AUTH_DOMAIN
// VITE_FIREBASE_PROJECT_ID
// VITE_FIREBASE_STORAGE_BUCKET
// VITE_FIREBASE_MESSAGING_SENDER_ID
// VITE_FIREBASE_APP_ID
// VITE_INFERENCE_SERVER (optional, defaults to localhost:5050)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase config on load
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing!');
  console.error('Please ensure .env file is in frontend/ directory with all required Firebase credentials.');
  console.error('Current config:', firebaseConfig);
}

// Inference server endpoint
export const INFERENCE_SERVER_URL = import.meta.env.VITE_INFERENCE_SERVER || 'http://localhost:5050';

// Genomic analysis server endpoint (integrated with inference server)
export const GENOMIC_SERVER_URL = import.meta.env.VITE_GENOMIC_SERVER || 'http://localhost:5050';
