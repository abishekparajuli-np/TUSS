import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './utils/ProtectedRoute';
import DNABackgroundCanvas from './components/DNABackgroundCanvas';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import ScanSessionPage from './pages/ScanSessionPage';
import ReportPage from './pages/ReportPage';
import PatientProfilePage from './pages/PatientProfilePage';

// Styles
import './styles/globals.css';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        {/* Animated DNA Background */}
        <DNABackgroundCanvas />
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients/new"
            element={
              <ProtectedRoute>
                <PatientRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scan/:patientId"
            element={
              <ProtectedRoute>
                <ScanSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report/:scanId"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients/:patientId"
            element={
              <ProtectedRoute>
                <PatientProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0a1628',
              color: '#00ffc8',
              border: '1px solid rgba(0, 255, 200, 0.2)',
              fontFamily: "'IBM Plex Mono', monospace",
            },
          }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
