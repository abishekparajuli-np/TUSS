# THERMASCAN AI - Clinical Dashboard

> Doctor-only clinical web application for diabetic foot ulcer risk screening using live thermal imaging and AI-powered analysis.

## 🏥 Overview

THERMASCAN AI integrates:
- **Real-time thermal imaging** from medical-grade cameras
- **DeiT ViT AI model** for automated ulcer risk prediction
- **Firebase backend** for secure patient data management  
- **Clinical-grade UI** with biotech aesthetics (teal accents, animated DNA background)
- **PDF report generation** for clinical documentation

## 🏗️ Architecture

```
THERMASCAN AI
├── Frontend (React + Tailwind)
│   ├── Pages: Login, Dashboard, Registration, Scan, Report, Patient Profile
│   ├── Components: Biotech UI (DNA background, status badges, metrics)
│   └── Firebase Auth + Firestore integration
├── Backend (Python Flask)
│   ├── inference_server.py: Exposes DeiT model via REST API
│   ├── WebSocket streaming: Live thermal frames
│   └── Port: localhost:5050
├── AI Model
│   ├── deit_thermo_model.pth (pretrained DeiT Small)
│   └── 224×224 input, 2-class output (HEALTHY/ULCER RISK)
└── Infrastructure
    ├── Firebase Firestore: patients, scans, reports, users
    ├── Firebase Storage: PDFs, model inputs
    └── Firebase Auth: Doctor-only access
```

## 📋 Features

### Authentication
- **Doctor-only login** (email/password via Firebase Auth)
- **No self-registration** (admin-provisioned accounts)
- **Protected routes** - unauthenticated users redirected to login

### Patient Management
- **Registration form** with clinical history
- **Patient profiles** with scan timeline
- **Medical history tracking** (diabetes type, duration, foot conditions)

### Live Thermal Scanning
- **Real-time MJPEG stream** from thermal camera
- **Live AI inference** (polling /status every 500ms)
- **20-second analysis window** with countdown timer
- **Prediction buffer visualization** (60-frame history)
- **Thermal risk index bar** (teal → red gradient)

### AI Analysis
- **Status**: HEALTHY, ULCER RISK, ANALYZING, UNCERTAIN, NO FOOT
- **Confidence**: 0.00 - 1.00 probability
- **Metrics**: Asymmetry, variance, edge strength, FPS
- **Bounding box + hotspot detection** overlaid on stream

### Report Generation
- **Client-side PDF generation** (jsPDF)
- **Comprehensive report** with AI analysis, doctor remarks, diagnosis
- **Firebase Storage upload** for archiving
- **Firestore metadata** for patient history

### Dashboard
- **Today's stats**: Total scans, high-risk cases, patients seen
- **Recent scans** with quick links to reports
- **System status** indicators

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.9+
- **Firebase** project (Firestore, Storage, Auth enabled)
- **Thermal camera** with RTSP/MJPEG stream

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure stream URL
# Edit inference_server.py line 23: STREAM_URL = "your_rtsp_url"

# Run inference server
python inference_server.py
# Server runs on http://localhost:5050
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure Firebase
# Copy .env.example to .env.local and add Firebase credentials
cp .env.example .env.local

# Add to .env.local:
# REACT_APP_FIREBASE_API_KEY=...
# REACT_APP_FIREBASE_AUTH_DOMAIN=...
# REACT_APP_FIREBASE_PROJECT_ID=...
# etc.

# Start development server
npm start
# Frontend runs on http://localhost:3000
```

### 3. Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize project
firebase init

# Deploy security rules
firebase deploy --only firestore:rules,storage
```

### 4. Create Doctor Account

In Firebase Console:
1. Go to **Authentication** > **Users**
2. Click **Add User** (email/password)
3. Go to **Firestore** > **users** collection
4. Create document with ID = user UID
5. Add field: `role: "doctor"` and `clinic: "Your Clinic"`

## 📁 Project Structure

```
TUSS/
├── backend/
│   ├── inference_server.py       # Flask + WebSocket + PyTorch
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # React pages
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── PatientRegistrationPage.jsx
│   │   │   ├── ScanSessionPage.jsx
│   │   │   ├── ReportPage.jsx
│   │   │   └── PatientProfilePage.jsx
│   │   ├── components/          # Reusable UI components
│   │   │   ├── DNABackground.jsx
│   │   │   ├── DNABackgroundCanvas.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── ThermalRiskBar.jsx
│   │   │   ├── MetricDisplay.jsx
│   │   │   └── PredictionBuffer.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Firebase Auth + Protected routes
│   │   ├── utils/
│   │   │   ├── firebaseInit.js
│   │   │   ├── inferenceApi.js  # Axios client for backend
│   │   │   └── ProtectedRoute.jsx
│   │   ├── styles/
│   │   │   └── globals.css      # Tailwind + biotech theme
│   │   ├── App.jsx              # Router + Auth provider
│   │   └── index.jsx
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── .env.example
├── firestore.rules              # Security rules
├── storage.rules
├── firestore.indexes.json
├── firebase.json
└── README.md
```

## 🎨 Design System

### Color Palette
```
Background: #050d1a (near-black navy)
Surface:    #0a1628 (dark blue-gray)
Accent:     #00ffc8 (bioluminescent teal)
Secondary:  #0080ff (electric blue)
Danger:     #ff4b6e (coral red)
Success:    #00e676 (lime green)
Text:       #e0f7fa (cool white)
Muted:      #546e7a (slate)
```

### Fonts
- **Data/Metrics**: IBM Plex Mono (monospace)
- **Body Text**: Inter (sans-serif)

### Visual Elements
- **Animated DNA helix** background (sine-wave strands + rungs)
- **Glowing cards** with subtle box-shadow
- **Teal borders + text** for interactive elements
- **Status badges** color-coded (green/red/amber/blue)
- **Thermal risk bar** with gradient (teal → red)

## 🔌 API Reference

### Inference Server (Python Backend)

#### GET /status
```json
{
  "status": "HEALTHY",
  "confidence": 0.87,
  "risk_score": 42.3,
  "asymmetry": 3.1,
  "variance": 120.5,
  "edge_strength": 8.2,
  "fps": 24.1,
  "buffer_length": 45,
  "prediction_history": [0, 0, 1, 0, ...]
}
```

#### POST /start_analysis
Triggers 20-second analysis window

#### POST /stop_analysis
Stops current analysis

#### GET /final_result
Returns locked analysis result

#### WebSocket ws://localhost:5050/stream
Sends MJPEG frames in real-time

## 📊 Firestore Schema

```
/users/{userId}
  ├── name: string
  ├── email: string
  ├── role: "doctor" (enum)
  └── clinic: string

/patients/{patientId}
  ├── name: string
  ├── mrn: string
  ├── dob: string (YYYY-MM-DD)
  ├── diabetesType: "Type 1" | "Type 2" | "Gestational" | "Other"
  ├── duration: number (years)
  ├── conditions: string[] (multiselect)
  ├── notes: string
  ├── createdAt: timestamp
  └── doctorId: string (FK to users)

/scans/{scanId}
  ├── patientId: string (FK)
  ├── doctorId: string (FK)
  ├── startedAt: timestamp
  ├── completedAt: timestamp
  ├── status: "HEALTHY" | "ULCER RISK" | ...
  ├── confidence: number (0-1)
  ├── riskScore: number (0-100)
  ├── asymmetry: number
  ├── variance: number
  ├── edgeStrength: number
  ├── predictionHistory: number[]
  └── modelInputImageUrl: string

/reports/{scanId}
  ├── patientId: string (FK)
  ├── doctorId: string (FK)
  ├── generatedAt: timestamp
  ├── doctorRemarks: string
  ├── finalDiagnosis: string
  ├── treatmentPlan: string
  ├── doctorSignature: string
  ├── pdfUrl: string (Firebase Storage URL)
  └── aiSummary: string
```

## 🔐 Security

- **Firebase Auth** + email/password for doctors
- **Firestore Rules** restrict data access to own records
- **Storage Rules** limit file sizes (50MB PDFs, 10MB images)
- **No self-registration** - admin-provisioned only
- **Audit trail** - deletion prevented, timestamps recorded

## 📱 Responsiveness

- **Desktop**: Full 2-column layout (thermal stream + metrics)
- **Tablet** (1024px+): Optimized for bedside use
- **Mobile**: Stacked single-column, touch-friendly buttons

## ⚠️ Important Notes

1. **Thermal Camera Setup**
   - Update `STREAM_URL` in `inference_server.py`
   - Support RTSP/MJPEG streams
   - Credentials embedded in URL (update security as needed)

2. **Model Path**
   - Ensure `deit_thermo_model.pth` is in `backend/` directory
   - Model: DeiT Small (deit_small_patch16_224), 2-class output

3. **Firebase Credentials**
   - Never commit `.env.local` files
   - Use `.env.example` as template
   - Add to `.gitignore`

4. **WebSocket Connection**
   - Frontend polls `/status` every 500ms (not WebSocket)
   - Can upgrade to socket.io for live streaming if needed

5. **PDF Generation**
   - Client-side jsPDF (works offline after initial load)
   - Alternative: Firebase Cloud Function for server-side generation

## 🚀 Deployment

### Frontend (Vercel / Netlify)
```bash
npm run build
# Deploy dist/ folder
```

### Backend (Heroku / Railway / AWS)
```bash
python inference_server.py
# Ensure STREAM_URL and MODEL_PATH are set via environment
```

### Firebase
```bash
firebase deploy
```

## 📈 Future Enhancements

- [ ] Real-time WebSocket instead of polling
- [ ] Batch patient scan export
- [ ] Advanced analytics dashboard
- [ ] Model retraining pipeline
- [ ] Multi-clinic support
- [ ] Appointment scheduling integration
- [ ] Push notifications
- [ ] Video recording during scans

## 📝 License

Internal Use - HIPAA Compliant

## 🤝 Support

For issues or questions, contact: [support@thermascan.ai](mailto:support@thermascan.ai)

---

**Last Updated**: January 2025  
**Maintained By**: Clinical Engineering Team
