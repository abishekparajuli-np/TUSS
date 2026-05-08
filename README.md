# पैताला - AI-Powered Clinical Diabetic Foot Ulcer Risk Screening

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-Production%20Ready-green)
![License](https://img.shields.io/badge/license-MIT-green)

> A sophisticated, doctor-only clinical web application leveraging real-time thermal imaging and deep learning AI models for automated diabetic foot ulcer risk prediction and clinical documentation.

## 📋 Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [📥 Model Download (REQUIRED)](#-ai-model-download-required)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Features](#features)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🏥 Problem Statement

### Clinical Challenge

Diabetic foot ulcers are a significant complication affecting millions of patients worldwide. Early detection is critical for prevention and treatment, but traditional visual inspection methods often miss early-stage thermal anomalies that precede visible ulcer formation.

### Current Limitations

- **Delayed Detection**: Manual inspection by healthcare providers can miss subtle thermal changes
- **Inconsistency**: Diagnosis varies based on clinician experience
- **Time-Consuming**: Physical examinations require significant healthcare provider time
- **Limited Access**: Screening availability restricted to specialized clinics
- **Documentation Gaps**: Lack of standardized, digitized clinical records

### Proposed Solution

**पैताला** (Paitala) provides:
- **Real-time AI Analysis**: Instantaneous thermal imaging analysis using DeiT Deep Vision Transformer
- **Clinical-Grade Accuracy**: 2-class classification (HEALTHY / ULCER RISK)
- **Secure Documentation**: PDF report generation for clinical records
- **Doctor-Only Access**: Role-based authentication for medical professionals only
- **Complete Patient History**: Comprehensive patient profiles with scan timelines

---

## 💡 Solution Overview

पैताला integrates cutting-edge thermal imaging technology with state-of-the-art deep learning to provide clinicians with:

1. **Live Thermal Stream Processing**: Real-time MJPEG streaming from medical-grade thermal cameras
2. **AI-Powered Risk Assessment**: Deep learning model inference on thermal frames
3. **Clinical Dashboard**: Intuitive interface for patient management and scan history
4. **Secure Data Management**: Firebase backend with role-based access control
5. **Clinical Documentation**: Automated PDF report generation with detailed metrics

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.2.0 | UI Framework |
| **Vite** | 4.5.0 | Build tool & dev server |
| **Tailwind CSS** | 3.3.3 | Utility-first CSS styling |
| **React Router** | 6.16.0 | Client-side routing |
| **Firebase SDK** | 10.4.0 | Authentication & Firestore |
| **Axios** | 1.5.0 | HTTP client |
| **Socket.io Client** | 4.7.2 | WebSocket communication |
| **jsPDF** | 2.5.1 | PDF generation |
| **html2canvas** | 1.4.1 | Screenshot capturing |
| **React Hot Toast** | 2.4.1 | Toast notifications |
| **Firestore** | Firebase SDK | Genomic data persistence |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.9+ | Server runtime |
| **Flask** | 2.3.3 | Web framework |
| **Flask-SocketIO** | 5.3.4 | WebSocket support |
| **PyTorch** | 2.0.1 | Deep learning framework |
| **TIMM** | 0.9.7 | PyTorch image models |
| **OpenCV** | 4.8.1.78 | Image processing |
| **NumPy** | 1.24.3 | Numerical computing |
| **Biopython** | 1.81+ | FASTA parsing & sequence analysis |
| **Smith-Waterman** | Custom | Local sequence alignment |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Firebase** | Authentication, Firestore DB, Cloud Storage |
| **Docker** | Containerization |
| **Docker Compose** | Multi-service orchestration |

### AI/ML
| Component | Details |
|-----------|---------|
| **Thermal Model** | DeiT Small (Data-efficient Image Transformer) |
| **Thermal Input** | 224×224 thermal images |
| **Thermal Output** | 2-class classification (HEALTHY / ULCER RISK) |
| **Thermal Framework** | PyTorch + TIMM |
| **Genomic Model** | De Bruijn Graph + Smith-Waterman Alignment |
| **Genomic Input** | FASTQ patient sequences |
| **Genomic Output** | Polygenic Risk Score (PRS) + Variant Detection |
| **Reference Genes** | VEGF, MMP1, COL1A1, TNF, IL6 (wound healing genes) |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              THERMASCAN AI SYSTEM ARCHITECTURE          │
└─────────────────────────────────────────────────────────┘

                        CLIENT LAYER
                    ┌─────────────────┐
                    │   Web Browser   │
                    │   (React 18)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    REST API            WebSocket            Firebase
   (HTTP)            (Live Frames)          (Auth/DB)
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Flask API    │   │ Stream Handler   │ Authentication
│ (Port 5050)  │   │ (Port 5050)      │ & Firestore
└──────┬───────┘   └──────┬───────┘   └──────────────┘
       │                  │
        ┌────────────┬───────────┴────────────┐
                  │                        │
         ┌────────▼────────┐   ┌──────────▼──────────┐
         │  DeiT Model     │   │  Genomic Analysis   │
         │  Inference      │   │  Engine             │
         │  (Thermal)      │   │  (FASTQ sequences)  │
         └────────┬────────┘   └──────────┬──────────┘
                  │                       │
                  ▼                       ▼
         ┌─────────────────┐   ┌──────────────────────┐
         │ Thermal Camera  │   │ Reference Genes      │
         │ Stream (MJPEG)  │   │ (FASTA files)        │
         └─────────────────┘   │ - VEGF, MMP1, etc.   │
                               └──────────────────────┘

        DATABASE LAYER
       ┌──────────────────┐
       │ Firebase         │
       │ ├─ Firestore DB  │
       │ ├─ Cloud Storage │
       │ ├─ Auth          │
       │ └─ Rules Engine  │
       └──────────────────┘
```

### Data Flow

```
1. Doctor Login
   Browser → Firebase Auth → JWT Token

2. Patient Registration
   Browser (Form) → Firebase (Firestore) → Patient Record

3. Live Scan Analysis (Thermal) — 20-second window
   Thermal Camera → MJPEG Stream → Backend WebSocket
   Backend → DeiT Model → Prediction Buffer → Frontend
   Frontend (Real-time UI Updates) → Doctor Review

4. Genomic Analysis (FASTQ Upload)
   Patient FASTQ File → Frontend Parser → Backend API
   Backend: Load Reference Genes (FASTA files)
            → Smith-Waterman Alignment
            → Variant Detection (SNPs, INDELs)
            → Polygenic Risk Score (PRS) Calculation
            → Firestore Storage
   Frontend: Display PRS gauge, gene breakdown table, results

5. Fused Risk Analysis
   Thermal Results + Genomic PRS → Clinical Interpretation
   Combined risk score with thermal-genomic weighting

6. Report Generation
   Thermal Results + Genomic Data → PDF Generator
   → Firebase Storage → Download

7. Patient History
   Browser → Firebase Query → Recent Scans + Analyses → Display
```

---

## 📁 Project Structure

```
पैताला/
├── 📁 frontend/                      # React Frontend Application
│   ├── 📁 src/
│   │   ├── 📁 pages/                # Page components (6 pages)
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── PatientRegistrationPage.jsx
│   │   │   ├── ScanSessionPage.jsx
│   │   │   ├── ReportPage.jsx
│   │   │   └── PatientProfilePage.jsx
│   │   ├── 📁 components/           # Reusable components
│   │   │   ├── DNABackground.jsx
│   │   │   ├── DNABackgroundCanvas.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── ThermalRiskBar.jsx
│   │   │   ├── PredictionBuffer.jsx
│   │   │   ├── MetricDisplay.jsx
│   │   │   └── GenomicRiskPanel.jsx   # Genomic analysis UI
│   │   ├── 📁 context/              # React Context (Auth)
│   │   │   └── AuthContext.jsx
│   │   ├── 📁 utils/                # Utility functions
│   │   │   ├── firebaseInit.js
│   │   │   ├── inferenceApi.js
│   │   │   ├── genomicApi.js          # Genomic analysis API
│   │   │   └── ProtectedRoute.jsx
│   │   ├── 📁 config/               # Configuration
│   │   │   └── firebase.js
│   │   ├── 📁 styles/               # Global styles
│   │   │   └── globals.css
│   │   ├── App.jsx                  # Main App component
│   │   ├── main.jsx                 # Entry point
│   │   └── index.jsx
│   ├── 📁 public/                   # Static assets
│   │   ├── logo1.png                # Project logo (navbar)
│   │   ├── logo2.png                # Favicon (title bar)
│   │   └── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.local (required)
│
├── 📁 backend/                      # Python Flask Backend
│   ├── inference_server.py          # Main API server
│   ├── deit_thermo_model.pth        # AI Model (PyTorch - Thermal)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── 📁 genomic/                  # Genomic analysis module
│   │   ├── __init__.py
│   │   ├── analysis_engine.py       # Main genomic analysis pipeline
│   │   ├── fasta_loader.py          # FASTA parser & sequence analysis
│   │   ├── api.py                   # Genomic API endpoints
│   │   ├── refrence/                # Reference gene sequences
│   │   │   ├── VEGF.fasta
│   │   │   ├── MMP1.fasta
│   │   │   ├── COL1A1.fasta
│   │   │   ├── TNF.fasta
│   │   │   └── IL6.fasta
│   │   └── 📁 models/               # Genomic model weights (optional)
│   └── 📁 build/                    # Build output
│
├── 📁 firebase/                     # Firebase Configuration
│   ├── firebase.json
│   ├── firestore.indexes.json
│   ├── firestore.rules
│   └── storage.rules
│
├── docker-compose.yml               # Docker Compose configuration
├── setup.sh                         # Linux/Mac setup script
├── setup.bat                        # Windows setup script
├── serviceAccountKey.json           # Firebase service account
│
└── 📄 Documentation
    ├── README.md                    # This file
    ├── ARCHITECTURE.md
    ├── CONFIGURATION.md
    ├── DEVELOPMENT.md
    └── QUICK_START.md
```

---

## 📦 Prerequisites

### 🤖 AI Model Download (Required)

**IMPORTANT**: Before proceeding with installation, download the DeiT thermal model:

1. **Download Link**: [deit_thermo_model.pth](https://drive.google.com/file/d/10u9a7vkIzuAgG0EoWXazbOKjeMVeyQ_g/view?usp=sharing)
2. **Place the file** in: `backend/deit_thermo_model.pth`
3. **File size**: ~22MB
4. **Verify**: 
   ```bash
   ls backend/deit_thermo_model.pth        # macOS/Linux
   dir backend\deit_thermo_model.pth       # Windows
   ```

> ⚠️ **Without this model file, the backend inference server will not start!**

---

### System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: Minimum 8GB (16GB recommended for AI inference)
- **Disk Space**: 5GB free space
- **Network**: Stable internet connection for Firebase
- **Camera**: Medical-grade thermal camera (MJPEG stream capable)

### Software Requirements

- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **Python**: 3.9 or higher
- **pip**: Package manager for Python
- **Docker** (optional): v20.10+ for containerized deployment
- **Docker Compose** (optional): v1.29+ for multi-service setup

### Firebase Setup

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Create Firestore Database (production mode with security rules)
4. Create Cloud Storage bucket
5. Download service account key JSON file
6. Get Firebase config from project settings

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/paitala.git
cd paitala
```

### 2. Backend Setup (Python)

#### Install Python Dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

#### Verify Model File

```bash
# Ensure deit_thermo_model.pth exists in backend/
ls backend/deit_thermo_model.pth
# or on Windows: dir backend\deit_thermo_model.pth
```

### 3. Frontend Setup (React)

```bash
cd frontend
npm install
```

#### Create Environment File

```bash
# In frontend/ directory
cp .env.example .env.local
```

Update `.env.local` with your Firebase credentials:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Backend API (Thermal & Genomic Analysis)
REACT_APP_INFERENCE_SERVER=http://localhost:5050

# Optional: Separate genomic server (uses inference server by default)
REACT_APP_GENOMIC_SERVER=http://localhost:5050
```

### 4. Firebase Configuration

#### Download Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save as `serviceAccountKey.json` in project root

#### Deploy Firestore Rules & Indexes

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 5. Configure Backend

Edit `backend/inference_server.py`:

```python
# Line 23 - Update thermal camera stream URL
STREAM_URL = "http://admin:12345@192.168.79.148:8081/live.flv"  # ← Your camera stream URL

# Line 24 - Verify model path
MODEL_PATH = "deit_thermo_model.pth"

# Line 25 - Server port
PORT = 5050
```

---

## 🚀 Running the Application

### Option 1: Local Development (Recommended)

#### Terminal 1 - Start Backend API Server

```bash
cd backend

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Start Flask server
python inference_server.py

# Expected output:
# * Running on http://127.0.0.1:5050
# [INFO] DeiT model loaded successfully
```

#### Terminal 2 - Start Frontend Dev Server

```bash
cd frontend
npm start

# Expected output:
# VITE v4.5.0 ready in XXX ms
# Local:   http://localhost:5173/
# Press h to show help
```

#### Access Application

Open browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5050
- **Firebase Console**: https://console.firebase.google.com

### Option 2: Docker Deployment (Production)

#### Build & Run with Docker Compose

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Service URLs**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5050
- Check health: http://localhost:5050/health

#### Individual Container Commands

```bash
# Build backend
docker build -t paitala-backend ./backend

# Build frontend
docker build -t paitala-frontend ./frontend

# Run backend
docker run -p 5050:5050 \
  -e STREAM_URL="http://..." \
  -v ./backend/deit_thermo_model.pth:/app/deit_thermo_model.pth \
  paitala-backend

# Run frontend
docker run -p 3000:80 \
  -e REACT_APP_INFERENCE_SERVER=http://backend:5050 \
  paitala-frontend
```

---

## 🔧 Configuration

### Frontend Configuration

**Location**: `frontend/.env.local`

```env
# Firebase Configuration (Required)
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123:web:abc123

# Backend Inference Server (Default: local development)
REACT_APP_INFERENCE_SERVER=http://localhost:5050
```

### Backend Configuration

**Location**: `backend/inference_server.py` (Lines 20-30)

```python
# ──── Configuration ────
STREAM_URL = "http://admin:12345@192.168.79.148:8081/live.flv"  # Thermal camera stream
MODEL_PATH = "deit_thermo_model.pth"                             # AI model file
PORT = 5050                                                      # Flask server port
ANALYSIS_WINDOW = 20                                             # Analysis duration (seconds)
BUFFER_SIZE = 60                                                 # Frame buffer size
CONFIDENCE_THRESHOLD = 0.5                                       # Prediction threshold
```

### Genomic Analysis Configuration

**Location**: `backend/genomic/` (Automatic)

The genomic analysis system is automatically initialized with:

```python
# Reference genes directory
backend/genomic/refrence/
  ├── VEGF.fasta     (30% weight - Angiogenesis)
  ├── MMP1.fasta     (25% weight - Tissue Remodeling)
  ├── COL1A1.fasta   (20% weight - Collagen production)
  ├── TNF.fasta      (15% weight - Inflammation)
  └── IL6.fasta      (10% weight - Immune Response)

# Analysis parameters (in analysis_engine.py)
Clinical Genes: VEGF, MMP1, COL1A1, TNF, IL6
Alignment Method: Smith-Waterman (local alignment)
Risk Thresholds:
  - LOW: PRS < 0.30
  - MODERATE: PRS 0.30-0.60
  - HIGH: PRS ≥ 0.60
```

**Frontend Setup for Genomic Upload**:
- Supported formats: `.fastq`, `.fq`, `.txt`
- Maximum file size: 50MB
- Automatic FASTQ parsing with gene identification
- Results automatically saved to Firestore

---

### Firebase Configuration

**Location**: `firebase.json`

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

**Security Rules**: See `firestore.rules` and `storage.rules` for access control

---

## 📡 API Documentation

### Backend REST API (Flask)

#### Base URL: `http://localhost:5050`

### Endpoints

#### 1. **Health Check**

```http
GET /health
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "model": "loaded",
  "stream": "connected"
}
```

---

#### 2. **Start Analysis**

```http
POST /start_analysis
Content-Type: application/json

{
  "patientId": "patient_123",
  "duration": 20
}
```

**Response** (200 OK):
```json
{
  "status": "analysis_started",
  "duration": 20,
  "frameCount": 0
}
```

---

#### 3. **Get Current Status**

```http
GET /status
```

**Response** (200 OK):
```json
{
  "status": "running",
  "frameCount": 45,
  "elapsedTime": 9.2,
  "prediction": 0.87,
  "riskLevel": "HIGH",
  "temperature": 32.5
}
```

---

#### 4. **Stop Analysis**

```http
POST /stop_analysis
```

**Response** (200 OK):
```json
{
  "status": "analysis_stopped",
  "finalResult": {
    "classification": "ULCER RISK",
    "confidence": 0.89,
    "avgTemp": 32.1
  }
}
```

---

#### 5. **Get Final Result**

```http
GET /final_result
```

**Response** (200 OK):
```json
{
  "status": "ULCER RISK",
  "confidence": 0.89,
  "risk_score": 85,
  "framesCaptured": 60,
  "analysisTime": 20.3,
  "avgTemperature": 32.1,
  "maxTemperature": 35.8,
  "timestamp": "2024-05-09T14:30:00Z"
}
```

---

### WebSocket Endpoints

#### Stream Connection

```javascript
// Client-side JavaScript
const socket = io('http://localhost:5050');

// Listen for frames
socket.on('frame', (data) => {
  // data: {
  //   image: base64_string,
  //   timestamp: ms,
  //   prediction: float
  // }
});

// Listen for analysis updates
socket.on('update', (data) => {
  // data: {
  //   frameCount: int,
  //   prediction: float,
  //   temperature: float
  // }
});
```

---

### Genomic Analysis API Endpoints

#### 1. **Health Check** (Genomic Service)

```http
GET /api/genomic/health
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "genes_loaded": 5,
  "reference_sequences": {
    "VEGF": 1200,
    "MMP1": 1150,
    "COL1A1": 1500,
    "TNF": 1050,
    "IL6": 1300
  }
}
```

---

#### 2. **Get Reference Information**

```http
GET /api/genomic/reference-info
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "genes": ["VEGF", "MMP1", "COL1A1", "TNF", "IL6"],
    "total_sequences": 5,
    "weights": {
      "VEGF": 0.30,
      "MMP1": 0.25,
      "COL1A1": 0.20,
      "TNF": 0.15,
      "IL6": 0.10
    }
  }
}
```

---

#### 3. **Analyze Patient Genome**

```http
POST /api/genomic/analyze
Content-Type: application/json

{
  "patient_id": "patient_123",
  "sequences": {
    "VEGF": "ATGAACTTTCTGCTGTCTT...",
    "MMP1": "ATGCACAGCTTTCCTCCAC...",
    "COL1A1": "ATGTTCAGCTTTGTGGACC...",
    "TNF": "ATGAGCACTGAAAGCATGA...",
    "IL6": "ATGAACTCCTTCTCCACAA..."
  }
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "patient_id": "patient_123",
  "prs": 0.45,
  "risk_category": "MODERATE",
  "total_variants": 4,
  "timestamp": "2024-05-09T14:30:00Z",
  "locus_details": {
    "VEGF": {
      "variant_count": 2,
      "snp_count": 1,
      "indel_count": 1,
      "deletion_count": 0,
      "alignment_score": 0.855
    },
    "MMP1": {
      "variant_count": 0,
      "snp_count": 0,
      "indel_count": 0,
      "deletion_count": 0,
      "alignment_score": 0.923
    },
    "COL1A1": {
      "variant_count": 1,
      "snp_count": 1,
      "indel_count": 0,
      "deletion_count": 0,
      "alignment_score": 0.789
    },
    "TNF": {
      "variant_count": 0,
      "snp_count": 0,
      "indel_count": 0,
      "deletion_count": 0,
      "alignment_score": 0.882
    },
    "IL6": {
      "variant_count": 1,
      "snp_count": 1,
      "indel_count": 0,
      "deletion_count": 0,
      "alignment_score": 0.815
    }
  },
  "analysis": {
    "alignment_results": {...},
    "variant_summary": {...},
    "haplotype_analysis": {...},
    "polygenic_risk_score": {...},
    "clinical_interpretation": {...}
  }
}
```

---

#### 4. **Upload & Analyze FASTQ File**

```javascript
// Client-side (JavaScript/React)
const formData = new FormData();
formData.append('file', fastqFile);
formData.append('patient_id', 'patient_123');

fetch('http://localhost:5050/api/genomic/analyze', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
```

**Response**: Same as #3 above (PRS score, variants, locus details)

---

#### 5. **Get Variant Report**

```http
GET /api/genomic/variants/patient_123
```

**Response** (200 OK):
```json
{
  "status": "success",
  "patient_id": "patient_123",
  "variants": {
    "VEGF": {
      "snps": [...],
      "insertions": [...],
      "deletions": [...]
    },
    ...
  },
  "timestamp": "2024-05-09T14:30:00Z"
}
```

---

#### 6. **Get PRS Report**

```http
GET /api/genomic/prs/patient_123
```

**Response** (200 OK):
```json
{
  "status": "success",
  "patient_id": "patient_123",
  "prs": 0.45,
  "risk_category": "MODERATE",
  "risk_description": "Moderate genetic predisposition to delayed wound healing",
  "gene_contributions": {
    "VEGF": 0.135,
    "MMP1": 0.115,
    "COL1A1": 0.090,
    "TNF": 0.068,
    "IL6": 0.042
  }
}
```

---

#### 7. **Get Clinical Interpretation**

```http
GET /api/genomic/clinical-interpretation/patient_123
```

**Response** (200 OK):
```json
{
  "status": "success",
  "patient_id": "patient_123",
  "interpretation": {
    "risk_level": "MODERATE",
    "summary": "Patient shows moderate genetic predisposition to delayed wound healing",
    "key_genes": ["VEGF", "MMP1"],
    "recommendations": [
      "Enhanced wound care monitoring",
      "Consider genetic counseling",
      "Regular follow-up assessments"
    ],
    "clinical_significance": "..."
  }
}
```

---

### 1. **Authentication & Authorization**
- ✅ Doctor-only email/password login via Firebase
- ✅ JWT token-based session management
- ✅ Protected routes with role-based access
- ✅ Auto logout on token expiration

### 2. **Patient Management**
- ✅ Comprehensive patient registration form
- ✅ Medical history tracking (diabetes type, duration, complications)
- ✅ Patient profiles with scan timeline
- ✅ Search & filter patient database
- ✅ Patient edit & update capabilities

### 3. **Live Thermal Scanning**
- ✅ Real-time MJPEG stream from thermal camera
- ✅ Live AI inference with 20-second analysis window
- ✅ Real-time metric display (confidence, temperature, risk score)
- ✅ 60-frame prediction buffer visualization
- ✅ Countdown timer & progress indicators

### 4. **AI Analysis**
- ✅ DeiT Small Vision Transformer model
- ✅ 2-class classification (HEALTHY / ULCER RISK)
- ✅ Real-time predictions (500ms polling)
- ✅ Confidence scoring (0-100%)
- ✅ Risk level categorization (LOW/MEDIUM/HIGH)

### 5. **Report Generation**
- ✅ Automated PDF report generation
- ✅ Clinical-grade metrics & visualizations
- ✅ Patient & scan details inclusion
- ✅ Doctor annotation capability
- ✅ Thermal imaging results with confidence scores
- ✅ Genomic analysis integration (PRS, variants, genes)
- ✅ Cloud storage integration

### 6. **Genomic Analysis** 🧬
- ✅ FASTQ file upload for patient sequences
- ✅ Reference gene management (VEGF, MMP1, COL1A1, TNF, IL6)
- ✅ Smith-Waterman sequence alignment algorithm
- ✅ Variant detection (SNPs, INDELs, deletions)
- ✅ Polygenic Risk Score (PRS) calculation with weighted genes
- ✅ Risk categorization (LOW/MODERATE/HIGH)
- ✅ Per-gene breakdown with alignment scores
- ✅ Firestore persistence for genomic profiles
- ✅ Genomic data in PDF reports

### 7. **Fused Risk Analysis**
- ✅ Thermal risk + Genomic PRS combination
- ✅ Integrated clinical interpretation
- ✅ Weighted risk scoring across modalities

### 8. **Dashboard & Analytics**
- ✅ Daily statistics (scans, high-risk cases, unique patients)
- ✅ Recent scan history with status badges
- ✅ Quick navigation & action buttons
- ✅ System status monitoring

### 9. **UI/UX**
- ✅ Biotech-themed design (orange/purple colors)
- ✅ Animated DNA background
- ✅ Responsive layout (desktop-optimized)
- ✅ Dark mode color scheme
- ✅ Toast notifications for user feedback
- ✅ Loading states & error boundaries

---

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 1. **Backend Server Won't Start**

```
Error: Address already in use
```

**Solution**:
```bash
# Find process using port 5050
lsof -i :5050                          # macOS/Linux
netstat -ano | findstr :5050           # Windows

# Kill the process and restart
kill -9 <PID>                          # macOS/Linux
taskkill /PID <PID> /F                # Windows

# Try different port
python inference_server.py --port 5051
```

#### 2. **CORS Errors**

```
Access to XMLHttpRequest blocked by CORS
```

**Solution**: Backend Flask CORS is pre-configured. Verify:
```python
# In inference_server.py
CORS(app, resources={r"/api/*": {"origins": "*"}})
```

#### 3. **Model Loading Failed**

```
Error: Model file not found (deit_thermo_model.pth)
```

**Solution**:
```bash
# Verify file exists
ls -la backend/deit_thermo_model.pth

# Download from storage if missing
# Place in backend/ directory and restart
```

#### 4. **Firebase Connection Issues**

```
Error: Cannot read property 'currentUser' of null
```

**Solution**:
1. Verify `.env.local` contains correct Firebase credentials
2. Check Firebase project is active in console
3. Verify internet connection
4. Check Firebase security rules allow read/write

#### 5. **Thermal Camera Stream Not Connecting**

```
Error: Failed to connect to STREAM_URL
```

**Solution**:
```bash
# Verify camera is online
ping 192.168.79.148

# Test stream URL directly in browser
http://admin:12345@192.168.79.148:8081/live.flv

# Update STREAM_URL in backend/inference_server.py
STREAM_URL = "http://admin:password@camera_ip:port/stream_path"
```

#### 6. **Frontend Blank/White Screen**

**Solution**:
```bash
# Clear npm cache & reinstall
rm -rf node_modules package-lock.json
npm install

# Clear browser cache (Ctrl+Shift+Delete)
# Restart dev server
npm start
```

#### 7. **Database Connection Timeout**

```
Error: Firestore connection timeout
```

**Solution**:
- Verify internet connection
- Check Firebase project exists & is active
- Verify serviceAccountKey.json is valid
- Try Firebase emulator for local development:
```bash
firebase emulators:start
```

#### 8. **Genomic Analysis - FASTQ Upload Fails**

```
Error: No valid sequences found in FASTQ file
```

**Solution**:
1. Verify FASTQ file format is valid:
   ```bash
   # Should have @ headers, sequences, + lines, quality scores
   head -20 your_file.fastq
   ```
2. Check file contains recognized gene names (VEGF, MMP1, COL1A1, TNF, IL6)
3. Verify sequences contain only valid DNA bases (ATCGN)
4. Check file size doesn't exceed 50MB

#### 9. **Genomic Analysis - Zero PRS Score**

```
Result shows: PRS: 0, Risk Category: LOW
```

**Solution**:
1. Verify genomic server is running (`/api/genomic/health` returns 200)
2. Check reference genes are loaded:
   ```bash
   curl http://localhost:5050/api/genomic/reference-info
   ```
3. Verify patient sequences are not empty
4. Check API response format in browser DevTools Network tab
5. Ensure Firestore is receiving genomic_profile data

#### 10. **Genomic Analysis - Reference Genes Not Loading**

```
Error: Reference sequence not found for VEGF
```

**Solution**:
```bash
# Verify FASTA files exist
ls backend/genomic/refrence/

# Should show: VEGF.fasta MMP1.fasta COL1A1.fasta TNF.fasta IL6.fasta

# Check FASTA file format (must start with >)
head -5 backend/genomic/refrence/VEGF.fasta
# Should output:
# >VEGF_reference_sequence
# ATGAACTTTCTGCTGTCTT...
```

---

### Frontend

```bash
# Build optimized production bundle
cd frontend
npm run build

# Analyze bundle size
npm run build -- --analyze
```

### Backend

```bash
# Use Gunicorn for production
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -b 0.0.0.0:5050 inference_server:app
```

---

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and test locally

3. **Commit with meaningful messages**
   ```bash
   git commit -m "feat: add thermal calibration feature"
   ```

4. **Push to branch**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request** with description

### Code Standards

- **Frontend**: ESLint, Prettier (JavaScript/JSX)
- **Backend**: PEP 8 (Python)
- **Commits**: Conventional Commits format
- **Testing**: Unit tests required for new features

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [PyTorch Documentation](https://pytorch.org/docs)
- [DeiT Paper](https://arxiv.org/abs/2012.12556)
- [Vite Documentation](https://vitejs.dev)

---

## 📄 License

This project is licensed under the MIT License - see `LICENSE` file for details.

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Firebase security rules reviewed & deployed
- [ ] Backend model file verified (deit_thermo_model.pth)
- [ ] Thermal camera stream URL tested
- [ ] Frontend build tested locally
- [ ] API endpoints tested with real data
- [ ] Error handling & logging configured
- [ ] SSL/TLS certificates installed (HTTPS)
- [ ] Database backups configured
- [ ] Monitoring & alerting setup
- [ ] Documentation updated
- [ ] Team trained on system usage

---

## 🔐 Security Considerations

- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based access control (Firestore rules)
- **Data Encryption**: HTTPS/TLS for all communications
- **Database Security**: Firebase security rules enforced
- **API Security**: CORS configured, rate limiting recommended
- **Secrets Management**: Use environment variables (never commit secrets)
- **Model Protection**: Model file permissions restricted

---

**Last Updated**: May 9, 2026 (Updated with Genomic Analysis System)

**Status**: ✅ Production Ready with Integrated Genomic & Thermal Analysis

**Features**: 
- ✅ Real-time thermal imaging analysis (DeiT model)
- ✅ Genomic analysis (Smith-Waterman alignment, PRS scoring)
- ✅ Fused risk assessment
- ✅ Comprehensive PDF reports
- ✅ Firebase cloud integration
- ✅ Doctor-only authentication

---

*पैताला - Advancing Clinical Care Through AI Innovation*
*Combining Thermal Imaging & Genomic Analysis for Comprehensive Diabetic Foot Ulcer Risk Assessment*
