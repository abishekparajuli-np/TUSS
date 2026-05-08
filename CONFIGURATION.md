# ⚙️ CONFIGURATION GUIDE

This guide explains all configuration files and how to set them up.

## 🔑 Environment Variables

### Frontend Configuration

**File**: `frontend/.env.local`

```bash
# Copy from .env.example
cp frontend/.env.example frontend/.env.local

# Get these from Firebase Console
REACT_APP_FIREBASE_API_KEY=YOUR_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
REACT_APP_FIREBASE_APP_ID=YOUR_APP_ID

# Inference server endpoint (default for local dev)
REACT_APP_INFERENCE_SERVER=http://localhost:5050
```

**Where to Find These**:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Settings** ⚙️ → **Project Settings**
4. Scroll to **Your Apps** section
5. Click on your web app
6. Copy the config

### Backend Configuration

**File**: `backend/inference_server.py`

```python
# Line 23: Update thermal camera stream URL
STREAM_URL = "http://admin:12345@192.168.79.148:8081/live.flv"  # ← Change this

# Model path (ensure deit_thermo_model.pth exists in backend/)
MODEL_PATH = "deit_thermo_model.pth"

# Server port (default 5050)
PORT = 5050

# Analysis window duration (seconds)
ANALYSIS_WINDOW = 20

# Prediction buffer size (frames to remember)
BUFFER_SIZE = 60
```

**Thermal Camera Setup**:
- Replace `STREAM_URL` with your camera's stream URL
- Format: `http://username:password@ip:port/stream`
- Test: `ffplay rtsp://...` or open in VLC

### Docker Environment

**File**: `.env` (optional, for docker-compose)

```bash
# Thermal camera stream
STREAM_URL=http://admin:password@192.168.1.100:8081/live.flv

# Firebase credentials (copy from frontend/.env.local)
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
# ... (all Firebase variables)

# Inference server (inside Docker network)
REACT_APP_INFERENCE_SERVER=http://backend:5050
```

---

## 🔐 Firebase Setup

### 1. Create Firebase Project

```bash
# Go to https://console.firebase.google.com
# Click "Add project"
# Project name: "THERMASCAN AI"
# Enable Google Analytics (optional)
# Click "Create project"
```

### 2. Enable Required Services

In Firebase Console:

1. **Firestore Database**
   - Click "Create database"
   - Select "Start in production mode"
   - Location: Choose closest to you
   - Click "Create"

2. **Authentication**
   - Click "Authentication"
   - Click "Get started"
   - Select "Email/Password"
   - Enable "Email/Password"

3. **Storage**
   - Click "Storage"
   - Click "Get started"
   - Accept default rules
   - Click "Done"

### 3. Download Service Account Key

```bash
# In Firebase Console:
# 1. Go to Project Settings ⚙️
# 2. Click "Service Accounts" tab
# 3. Click "Generate New Private Key"
# 4. Save as "serviceAccountKey.json" in project root

# This is needed for admin.py
# ⚠️ NEVER commit this to git!
```

### 4. Update Security Rules

```bash
# Deploy Firestore and Storage rules
firebase deploy --only firestore:rules,storage
```

**Or manually**:
1. Go to Firestore → Rules tab
2. Copy content from `firestore.rules`
3. Click "Publish"

4. Go to Storage → Rules tab
5. Copy content from `storage.rules`
6. Click "Publish"

---

## 🗄️ Database Indexes

### Auto-Generated Indexes

Firestore will prompt to create indexes when you run queries. Accept the prompts.

### Manual Index Creation

```bash
# Deploy predefined indexes
firebase deploy --only firestore:indexes
```

**Or manually**:
1. Go to Firestore → Indexes tab
2. Refer to `firestore.indexes.json` for recommended indexes
3. Create each index

---

## 🐳 Docker Configuration

### docker-compose.yml

Defined services:
- **backend** - Python inference server
- **frontend** - React app

Required environment variables:
```yaml
services:
  backend:
    environment:
      - STREAM_URL=your_camera_url
      - MODEL_PATH=/app/deit_thermo_model.pth

  frontend:
    environment:
      - REACT_APP_FIREBASE_*=your_firebase_creds
```

---

## 🎨 UI Customization

### Colors & Theme

**File**: `frontend/src/styles/globals.css` or `tailwind.config.js`

```css
/* Update color palette */
:root {
  --color-bg-primary: #050d1a;      /* Background */
  --color-bg-surface: #0a1628;      /* Card background */
  --color-accent-teal: #00ffc8;     /* Primary accent */
  --color-accent-blue: #0080ff;     /* Secondary accent */
  --color-danger: #ff4b6e;          /* Risk/danger */
  --color-success: #00e676;         /* Healthy/safe */
  --color-text-primary: #e0f7fa;    /* Main text */
  --color-text-muted: #546e7a;      /* Muted text */
}
```

### Fonts

**File**: `frontend/public/index.html`

```html
<!-- Currently uses Google Fonts -->
<!-- To use local fonts, download and update paths -->
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

### Logo & Branding

Update these files:
- `frontend/public/index.html` - Page title + description
- `frontend/src/pages/LoginPage.jsx` - Logo display
- `frontend/public/favicon.ico` - Favicon

---

## 🏥 Admin Configuration

### Create Doctor Accounts

```bash
# Using admin.py
python admin.py create-doctor \
  email@clinic.com \
  password123 \
  "Dr. Full Name" \
  "Clinic Name"
```

**Requirements**:
- `serviceAccountKey.json` must be in project root
- Firebase Admin SDK configured
- Firestore accessible

---

## 🚀 Deployment Configuration

### Heroku

```bash
# Create app
heroku create app-name

# Set config variables
heroku config:set STREAM_URL="your_camera_url"
heroku config:set MODEL_PATH="deit_thermo_model.pth"

# Deploy
git push heroku main
```

### Railway

```bash
# Set environment variables in Railway dashboard
STREAM_URL=your_camera_url
MODEL_PATH=deit_thermo_model.pth

# Variables are auto-loaded
```

### AWS/Google Cloud

Environment variables via:
- Lambda environment variables
- Cloud Run environment variables
- or `.env` file mounted as secret

---

## 🔄 Backup Configuration

### Firebase Backups

```bash
# Export Firestore
gcloud firestore export gs://bucket-name/backup

# Restore
gcloud firestore import gs://bucket-name/backup/timestamp
```

### Model Backup

```bash
# Keep multiple versions of deit_thermo_model.pth
# Store in version control (Git LFS) or cloud storage
```

---

## 📊 Monitoring Configuration

### Error Tracking (Sentry)

**File**: `backend/inference_server.py`

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://your-sentry-dsn@sentry.io/123456",
    traces_sample_rate=1.0
)
```

**File**: `frontend/src/App.jsx`

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://your-sentry-dsn@sentry.io/123456",
  environment: "production",
});
```

### Logging

Backend logging is built-in (Flask logger)
- Logs go to stdout in Docker
- Check with: `docker logs <container_id>`

---

## 🔐 Security Configuration

### CORS Setup

**File**: `backend/inference_server.py`

```python
from flask_cors import CORS

CORS(app, origins=["http://localhost:3000", "https://yourdomain.com"])
```

### HTTPS/SSL

**In Production**:
- Use Firebase Hosting (auto SSL)
- Or Netlify/Vercel (auto SSL)
- Or CloudFlare + certificate

**Self-signed for testing**:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

---

## ✅ Configuration Checklist

- [ ] Firebase project created
- [ ] Firestore enabled + rules deployed
- [ ] Authentication (email/password) enabled
- [ ] Storage enabled + rules deployed
- [ ] Service account key downloaded
- [ ] Firebase credentials in `.env.local`
- [ ] Thermal camera stream URL configured
- [ ] Model file (`deit_thermo_model.pth`) in backend/
- [ ] Doctor accounts created via admin.py
- [ ] Email domain configured (if needed)
- [ ] HTTPS certificate installed
- [ ] Monitoring/logging set up
- [ ] Backups configured
- [ ] Documentation updated with custom info

---

## 🆘 Configuration Troubleshooting

### Firebase Connection Failed
```
❌ Error: Firebase app not initialized
→ Check .env.local in frontend/
→ Verify credentials from Firebase Console
→ Ensure Firestore is enabled
```

### Backend Can't Connect to Camera
```
❌ Error: Cannot connect to stream
→ Check STREAM_URL in inference_server.py
→ Test URL manually with ffplay
→ Verify camera IP and credentials
→ Check firewall/network settings
```

### Port Already in Use
```
❌ Error: Address already in use
→ Backend: Change PORT in inference_server.py
→ Frontend: npm start --port 3001
→ Or kill existing process: lsof -i :5050
```

### Slow Inference
```
⚠️ Model taking >2 seconds
→ Use GPU if available
→ Reduce image resolution
→ Try smaller model (deit_tiny)
→ Upgrade server hardware
```

---

## 📝 Keeping Secrets Safe

### Never Commit These Files
```
.env.local                  # Frontend env
.env                        # Backend env
serviceAccountKey.json      # Firebase admin key
.firebase/                  # Firebase cache
```

### Use .gitignore
```bash
# Already in project .gitignore
# ⚠️ Double-check before first commit
```

### Rotating Credentials
1. Download new Firebase service account key
2. Update serviceAccountKey.json
3. (Optional) Invalidate old key in Firebase Console
4. Re-deploy if needed

---

## 📞 Configuration Support

- **Firebase**: [Firebase Docs](https://firebase.google.com/docs)
- **Docker**: [Docker Docs](https://docs.docker.com)
- **Tailwind**: [Tailwind Docs](https://tailwindcss.com/docs)
- **React**: [React Docs](https://react.dev)
- **Python**: [Python Docs](https://docs.python.org)

---

**Configuration Version**: 1.0  
**Last Updated**: January 2025
