#!/bin/bash
# Setup script for THERMASCAN AI

set -e

echo "🏥 THERMASCAN AI - Setup Script"
echo "================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.9+"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Prerequisites verified"

# Backend setup
echo ""
echo "🔧 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate

pip install -r requirements.txt
echo "✅ Backend dependencies installed"

cd ..

# Frontend setup
echo ""
echo "⚙️  Setting up frontend..."
cd frontend

npm install
echo "✅ Frontend dependencies installed"

# Copy env file
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo "⚠️  Created .env.local - Please update with Firebase credentials"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update frontend/.env.local with Firebase credentials"
echo "2. Update backend/inference_server.py with thermal camera STREAM_URL"
echo "3. Run the backend: cd backend && python inference_server.py"
echo "4. Run the frontend: cd frontend && npm start"
echo ""
echo "🌐 Access the app at http://localhost:3000"
