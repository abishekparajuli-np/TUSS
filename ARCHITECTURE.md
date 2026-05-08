# ARCHITECTURE & TECHNICAL DESIGN

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        THERMASCAN AI                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│ React 18 + Tailwind CSS + Biotech UI                        │
│ Pages: Login | Dashboard | Registration | Scan | Report    │
│ Components: DNA Background | Status Badge | Risk Bar        │
│ State: Auth Context + Zustand (optional)                    │
└─────────────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│ Firebase Auth (JWT tokens)                                  │
│ Axios + Socket.io Client (WebSocket)                        │
│ State Management: Auth, UI, Scan Data                       │
│ Protected Routes & Error Boundaries                         │
└─────────────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (Python)                     │
├─────────────────────────────────────────────────────────────┤
│ Flask REST API (Port 5050)                                  │
│ Endpoints:                                                  │
│   - GET /status (polling every 500ms)                       │
│   - POST /start_analysis                                    │
│   - POST /stop_analysis                                     │
│   - GET /final_result                                       │
│   - WebSocket /stream (MJPEG frames)                        │
│ Threading: Stream capture + Analysis loop                   │
│ Error Handling: Reconnection logic                          │
└─────────────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────────────┐
│                      AI/ML LAYER                            │
├─────────────────────────────────────────────────────────────┤
│ PyTorch + TIMM                                              │
│ Model: DeiT Small (deit_small_patch16_224)                 │
│ Input: 224×224 thermal images                              │
│ Output: 2-class softmax (HEALTHY / ULCER RISK)             │
│ Processing:                                                 │
│   1. Stream capture (OpenCV)                                │
│   2. Preprocessing (resize, normalize)                      │
│   3. Inference (forward pass)                               │
│   4. Post-processing (confidence, risk score)               │
│   5. Metrics calculation (asymmetry, variance)              │
└─────────────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Firebase)                    │
├─────────────────────────────────────────────────────────────┤
│ Firestore Collections:                                      │
│   • users (doctor profiles, role-based access)             │
│   • patients (clinical history)                             │
│   • scans (thermal imaging analysis results)                │
│   • reports (doctor review + PDF metadata)                  │
│                                                             │
│ Firebase Storage:                                           │
│   • reports/{patientMrn}/{scanId}/report.pdf               │
│   • model-inputs/{scanId}/input.png                         │
│                                                             │
│ Firebase Auth:                                              │
│   • Email/password authentication                           │
│   • JWT tokens (automatic)                                  │
│   • Role-based access control (custom claims optional)      │
└─────────────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────────────┐
│                   HARDWARE LAYER                            │
├─────────────────────────────────────────────────────────────┤
│ Thermal Camera (RTSP/MJPEG stream)                          │
│ Server Hardware (GPU optional, recommended)                 │
│ Network Infrastructure                                      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Scan Workflow
```
1. Doctor Registration (Firestore users collection)
   ↓
2. Patient Registration Form
   → POST to Firestore /patients/{patientId}
   ↓
3. Scan Session Page
   → GET /status (polling)
   → WebSocket stream frames display
   ↓
4. Analysis Trigger
   → POST /start_analysis (Python backend)
   → Timer starts (20 seconds)
   ↓
5. Real-time Metrics
   → Loop: GET /status every 500ms
   → Update UI with confidence, risk, metrics
   ↓
6. Analysis Complete
   → GET /final_result
   → Lock final predictions
   ↓
7. Report Generation
   → Doctor fills: remarks, diagnosis, treatment
   → Client-side jsPDF generation
   → Upload PDF to Firebase Storage
   → Save metadata to Firestore /reports/{scanId}
   ↓
8. Patient Profile
   → Display scan timeline
   → Show all reports + metrics history
```

## Component Hierarchy

```
App
├── AuthProvider (Context)
├── Router
│   ├── LoginPage (public)
│   ├── ProtectedRoute
│   │   ├── DashboardPage
│   │   ├── PatientRegistrationPage
│   │   ├── ScanSessionPage
│   │   │   ├── DNABackground
│   │   │   ├── StatusBadge
│   │   │   ├── ThermalRiskBar
│   │   │   ├── PredictionBuffer
│   │   │   └── MetricDisplay
│   │   ├── ReportPage
│   │   └── PatientProfilePage
│   └── Toaster (Toast notifications)
└── DNABackgroundCanvas (Global animation)
```

## State Management

### Frontend State Structure
```javascript
{
  // Auth (Context)
  auth: {
    currentUser: { uid, email },
    userRole: "doctor",
    loading: boolean,
  },

  // UI
  ui: {
    toastMessage: string,
    isLoading: boolean,
  },

  // Scan Session (Local State)
  scanSession: {
    patientId: string,
    scanId: UUID,
    status: "ANALYZING" | "HEALTHY" | "ULCER RISK",
    confidence: number,
    riskScore: number,
    asymmetry: number,
    variance: number,
    edgeStrength: number,
    fps: number,
    bufferLength: number,
    predictionHistory: number[],
    analysisActive: boolean,
    countdownTime: number,
  },

  // Report
  report: {
    doctorRemarks: string,
    finalDiagnosis: string,
    treatmentPlan: string,
    submitting: boolean,
  },
}
```

### Backend State (inference_server.py)
```python
{
  # Stream
  current_frame: numpy.ndarray,
  frame_count: int,
  fps: float,

  # Analysis
  analysis_active: boolean,
  analysis_start_time: timestamp,

  # Predictions
  status: "ANALYZING" | "HEALTHY" | "ULCER RISK" | "NO FOOT",
  confidence: float (0-1),
  risk_score: float (0-100),
  prediction_history: deque[int],
  
  # Metrics
  asymmetry: float,
  variance: float,
  edge_strength: float,
  
  # Detection
  bounding_box: (x, y, w, h),
  hottest_point: (x, y),
  model_input_frame: numpy.ndarray,
}
```

## Security Architecture

### Authentication Flow
```
1. Doctor Login
   → Email + Password
   → Firebase Auth
   → JWT Token (httpOnly cookie)
   ↓
2. Protected Routes
   → Check currentUser in Auth Context
   → Redirect to /login if null
   ↓
3. API Access
   → Attach Firebase ID token to requests
   → Backend verifies token
   ↓
4. Firestore Rules
   → Check auth.uid == doctorId
   → Prevent cross-doctor data access
```

### Data Access Control
```
Firestore Security Rules:
  - /users/{userId}
    - read: auth.uid == userId OR hasRole("doctor")
    - write: false (admin only)

  - /patients/{patientId}
    - read: auth.uid == patient.doctorId
    - create: auth.uid == request.doctorId
    - update: auth.uid == patient.doctorId
    - delete: false

  - /scans/{scanId}
    - read: auth.uid == scan.doctorId
    - create: auth.uid == request.doctorId
    - update: auth.uid == scan.doctorId
    - delete: false

  - /reports/{reportId}
    - read: auth.uid == report.doctorId
    - create: auth.uid == request.doctorId
    - update: auth.uid == report.doctorId
    - delete: false

Storage Rules:
  - Authenticated users only
  - File size limits (50MB PDFs, 10MB images)
  - Path-based access control
```

## Performance Considerations

### Frontend Optimization
- **Code Splitting**: React.lazy for pages
- **Image Optimization**: Lazy-load thermal feed
- **Caching**: Service Worker + Cache API
- **Bundle Size**: Tree-shake unused code
- **Animations**: GPU-accelerated DNA background (will-change)

### Backend Optimization
- **Stream Processing**: Threading for non-blocking I/O
- **Model Inference**: GPU acceleration (if available)
- **Caching**: Cache frame buffers
- **Memory**: Bounded prediction history (60 frames)
- **Network**: WebSocket for efficient streaming

### Database Optimization
- **Indexes**: Create for common queries (doctorId, patientId)
- **Queries**: Paginate large result sets
- **Archiving**: Move old scans to backup storage
- **Read/Write Optimization**: Batch operations when possible

## Error Handling & Recovery

### Frontend Error Handling
```
Try-Catch → Toast Notification
  ├── Auth errors → Redirect to /login
  ├── Network errors → Retry with exponential backoff
  ├── Firestore errors → Show error message
  └── Stream errors → Show reconnect UI

Error Boundary:
  ├── Scan session drops → Offer reconnect
  └── Report generation fails → Retry
```

### Backend Error Handling
```
Stream Disconnection:
  → Log error
  → Wait 2 seconds
  → Attempt reconnect
  → Retry up to N times

Model Inference Errors:
  → Status: "ANALYZING"
  → Continue capturing frames
  → Return error on next status poll

Database Errors:
  → Firebase handles replication
  → Automatic retry
```

## Scaling Strategy

### Current Capacity
- Single doctor instance: 1
- Concurrent scans: 1
- Max inference latency: ~2s
- Max thermal stream latency: ~100ms

### Scaling to Production

#### Horizontal Scaling (Multiple Doctors)
1. **Load Balancer** (Nginx / AWS ALB)
   - Route frontend to CDN
   - Route backend API calls

2. **Multiple Backend Instances**
   - Each instance handles own stream
   - Shared Firestore database
   - Model loaded per instance

3. **Database Optimization**
   - Firestore auto-scales
   - Create indexes for common queries
   - Archive old data

#### Vertical Scaling (Single Server)
1. **Increase Resources**
   - More CPU cores (parallel inference)
   - More RAM (larger buffers)
   - GPU (10-100x faster inference)

2. **Model Optimization**
   - Quantization (FP32 → INT8)
   - Pruning (remove non-essential weights)
   - Distillation (smaller, faster model)

3. **Infrastructure**
   - Managed services (AWS Lambda, Google Cloud Run)
   - Auto-scaling groups

## Monitoring & Observability

### Metrics to Monitor

**Frontend**
- Page load time
- API latency
- Error rate
- User sessions

**Backend**
- Stream FPS
- Model inference time
- Memory usage
- CPU usage
- Error rate

**Database**
- Firestore read/write count
- Storage usage
- Query latency

**Infrastructure**
- Server uptime
- Network latency
- GPU utilization (if applicable)

### Logging
- Frontend: Console logs (dev), Sentry (prod)
- Backend: Flask logging + Sentry
- Database: Firebase Activity Logs

### Alerting
- Backend unavailable → Slack notification
- High error rate → Email to ops
- Database quota exceeded → Upgrade notice

## Future Architecture Enhancements

1. **Real-time WebSocket Polling**
   - Replace HTTP polling with socket.io
   - Reduce latency for metrics updates

2. **Model Versioning**
   - Support multiple model versions
   - A/B testing framework

3. **Distributed Inference**
   - Edge computing (model on camera device)
   - Federated learning

4. **Advanced Analytics**
   - Aggregate statistics across doctors
   - Trend analysis over time
   - Predictive modeling for risk

5. **Integration APIs**
   - EHR/EMR system integration
   - DICOM standard support
   - HL7 messaging

---

**Architecture Version**: 1.0  
**Last Updated**: January 2025
