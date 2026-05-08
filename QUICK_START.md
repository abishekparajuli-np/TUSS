# 🚀 QUICK START GUIDE

Get THERMASCAN AI running in 5 minutes!

## Prerequisites
- Python 3.9+
- Node.js 18+
- Firebase account (free tier works)
- Thermal camera with network stream (or use placeholder)

## Step 1: Clone & Setup (2 min)

```bash
# Windows
setup.bat

# macOS/Linux
bash setup.sh
```

## Step 2: Firebase Configuration (1 min)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project (or use existing)
3. Enable: Firestore, Storage, Authentication
4. Go to **Project Settings** → **Service Accounts**
5. Click "Generate New Private Key"
6. Save as `serviceAccountKey.json` in project root

## Step 3: Frontend Environment (1 min)

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your Firebase credentials from Step 2:
```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

## Step 4: Start Backend (1 min)

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows

# Run
python inference_server.py
```

Server runs on **http://localhost:5050**

## Step 5: Start Frontend

In a new terminal:
```bash
cd frontend
npm start
```

App opens on **http://localhost:3000**

## Step 6: Create Doctor Account (1 min)

```bash
python admin.py create-doctor \
  doctor@example.com \
  password123 \
  "Dr. Smith" \
  "City Clinic"
```

## Step 7: Login & Test

1. Go to http://localhost:3000
2. Login with: doctor@example.com / password123
3. Click "+ NEW PATIENT SCAN"
4. Fill registration form
5. Click "Proceed to Scan"
6. Click "START ANALYSIS" (mock data will be returned)

## 🎉 Done!

You now have a working THERMASCAN AI instance!

---

## Next Steps

### 1. Connect Real Thermal Camera
Edit `backend/inference_server.py` line 23:
```python
STREAM_URL = "rtsp://admin:password@192.168.1.100:8080/stream"  # Your camera
```

### 2. Deploy to Production
See [DEPLOYMENT.md](./DEPLOYMENT.md)

### 3. Customize Branding
- Update logo in frontend/public/
- Modify colors in frontend/src/styles/globals.css
- Update titles/descriptions in frontend/public/index.html

### 4. Add More Features
- Patient search
- Batch export reports
- Advanced analytics dashboard

---

## Troubleshooting

### Backend won't start
```
Error: Cannot find deit_thermo_model.pth
→ Ensure model file is in backend/ directory
```

### Firebase connection error
```
Error: Missing Firebase credentials
→ Check .env.local in frontend/
→ Verify serviceAccountKey.json in root
```

### Port already in use
```
# Change backend port (default 5050)
python inference_server.py --port 5051

# Change frontend port (default 3000)
PORT=3001 npm start
```

### Model inference slow
```
→ Use GPU (if available): verify CUDA in backend
→ Try smaller model: deit_tiny_patch16_224
→ Reduce resolution: 224 → 128
```

---

## Quick Commands Reference

```bash
# Backend
cd backend && python inference_server.py

# Frontend
cd frontend && npm start

# Admin - Create doctor
python admin.py create-doctor EMAIL PASSWORD NAME CLINIC

# Admin - List doctors
python admin.py list-doctors

# Admin - Delete doctor
python admin.py delete-doctor UID

# Deploy Firebase
firebase deploy --only firestore:rules,storage

# Run with Docker
docker-compose up
```

---

## Demo Mode (No Camera)

If you don't have a thermal camera yet:

1. Backend returns mock data (works as-is)
2. Frontend displays placeholder stream
3. Predictions are simulated
4. All features work normally
5. Perfect for UI/UX testing

---

## Support

- 📖 Full docs: [README.md](./README.md)
- 🏗️ Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🚀 Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 🐛 Issues: Create GitHub issue

---

**Ready to scan?** 🏥  
Access the app: **http://localhost:3000**
