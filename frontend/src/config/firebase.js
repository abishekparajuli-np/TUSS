// Firebase configuration - loaded from .env file
// Required env variables:
// REACT_APP_FIREBASE_API_KEY
// REACT_APP_FIREBASE_AUTH_DOMAIN
// REACT_APP_FIREBASE_PROJECT_ID
// REACT_APP_FIREBASE_STORAGE_BUCKET
// REACT_APP_FIREBASE_MESSAGING_SENDER_ID
// REACT_APP_FIREBASE_APP_ID
// REACT_APP_INFERENCE_SERVER (optional, defaults to localhost:5050)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
};

// Validate Firebase config on load
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing!');
  console.error('Please ensure .env file is in frontend/ directory with all required Firebase credentials.');
  console.error('Current config:', firebaseConfig);
}

// Inference server endpoint
export const INFERENCE_SERVER_URL = import.meta.env.VITE_INFERENCE_SERVER || process.env.REACT_APP_INFERENCE_SERVER || 'http://localhost:5050';
