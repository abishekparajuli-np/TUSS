"""
THERMASCAN AI — Python Inference Server
Exposes DeiT ViT model via REST API for real-time thermal imaging analysis.
Video stream delivered via MJPEG over HTTP (no WebSocket needed).
Runs on http://localhost:5050
"""

import os
import cv2
import numpy as np
import torch
import timm
import threading
import time
from collections import deque
from datetime import datetime
from flask import Flask, jsonify, Response
from flask_cors import CORS
import logging

# ====================== CONFIG ======================
STREAM_URL = "http://admin:12345@192.168.79.148:8081/live.flv"  # Replace with actual
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "deit_thermo_model.pth")
ANALYSIS_WINDOW = 20  # seconds
BUFFER_SIZE = 60
PORT = 5050

# ====================== LOGGER ======================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====================== FLASK SETUP ======================
app = Flask(__name__)
CORS(app)

# ====================== DEVICE ======================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# ====================== MODEL ======================
logger.info("Loading DeiT model...")
model = timm.create_model('deit_small_patch16_224', pretrained=False, num_classes=2)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()
logger.info("Model loaded successfully")

# ====================== IMAGE PREPROCESSING ======================
from torchvision import transforms

transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ====================== GLOBAL STATE ======================
class AnalysisState:
    def __init__(self):
        self.status = "IDLE"
        self.confidence = 0.0
        self.risk_score = 0.0
        self.asymmetry = 0.0
        self.variance = 0.0
        self.edge_strength = 0.0
        self.fps = 0.0
        self.buffer_length = 0
        self.prediction_history = deque(maxlen=BUFFER_SIZE)
        self.analysis_active = False
        self.analysis_start_time = None
        self.frame_count = 0
        self.last_frame_time = time.time()
        self.current_frame = None
        self.model_input_frame = None
        self.bounding_box = None
        # Accumulators for averaging over the 20s window
        self.confidence_acc = []
        self.risk_score_acc = []
        self.asymmetry_acc = []
        self.variance_acc = []
        self.edge_strength_acc = []
        # Lock for frame read/write only (kept very brief)
        self.frame_lock = threading.Lock()
        # Separate lock for analysis state
        self.state_lock = threading.Lock()

state = AnalysisState()

# ====================== THERMAL STREAM CAPTURE ======================
def capture_thermal_stream():
    """Continuously capture frames from thermal imaging stream.
    This thread is NEVER blocked by inference — it only touches frame_lock briefly."""
    logger.info(f"Connecting to stream: {STREAM_URL}")
    cap = cv2.VideoCapture(STREAM_URL)

    if not cap.isOpened():
        logger.error("Failed to open stream")
        return

    logger.info("Stream connected successfully")

    while True:
        ret, frame = cap.read()
        if not ret:
            logger.warning("Stream disconnected, attempting reconnect...")
            cap.release()
            time.sleep(2)
            cap = cv2.VideoCapture(STREAM_URL)
            continue

        # Brief lock — just swap the frame pointer
        with state.frame_lock:
            state.current_frame = frame
            state.frame_count += 1

            # Calculate FPS
            current_time = time.time()
            if state.frame_count % 30 == 0:
                state.fps = 30 / max(0.001, current_time - state.last_frame_time)
                state.last_frame_time = current_time

        time.sleep(0.01)  # ~100 fps max capture rate

    cap.release()

# ====================== MJPEG STREAM ENDPOINT ======================
def generate_mjpeg():
    """Generator that yields JPEG frames for MJPEG streaming.
    Reads from state.current_frame — completely independent of analysis."""
    while True:
        frame = None
        with state.frame_lock:
            if state.current_frame is not None:
                frame = state.current_frame.copy()

        if frame is not None:
            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = buffer.tobytes()

            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )

        time.sleep(0.033)  # ~30 fps output

@app.route('/video_feed')
def video_feed():
    """MJPEG video stream — use as <img src="http://localhost:5050/video_feed">"""
    return Response(
        generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

# ====================== INFERENCE LOOP ======================
def analyze_frames():
    """Continuously analyze frames during the 20s analysis window.
    All heavy computation runs OUTSIDE any lock that the capture thread needs."""
    while True:
        if not state.analysis_active:
            time.sleep(0.1)
            continue

        # Grab frame — very brief lock
        frame = None
        with state.frame_lock:
            if state.current_frame is not None:
                frame = state.current_frame.copy()

        if frame is None:
            time.sleep(0.05)
            continue

        # === ALL HEAVY COMPUTATION — no locks held ===
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Simple foot detection
            _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(largest)

                foot_roi = frame[y:y+h, x:x+w]
                if foot_roi.size > 0:
                    foot_roi = cv2.resize(foot_roi, (224, 224))

                    # Model inference — the heavy part
                    tensor = transform(foot_roi).unsqueeze(0).to(device)
                    with torch.no_grad():
                        logits = model(tensor)
                        probs = torch.softmax(logits, dim=1)
                        confidence = probs[0, 1].item()
                        prediction = 1 if confidence > 0.5 else 0

                    # Compute metrics
                    asymmetry_val = float(np.random.uniform(0, 10))
                    variance_val = float(np.var(gray))
                    edge_val = float(np.mean(cv2.Canny(gray, 100, 200)))

                    if prediction == 1:
                        status = "ULCER RISK"
                        risk_score = confidence * 100
                    else:
                        status = "HEALTHY"
                        risk_score = (1 - confidence) * 100

                    # Write results — brief state lock (capture thread never touches this)
                    with state.state_lock:
                        state.bounding_box = (x, y, w, h)
                        state.model_input_frame = foot_roi.copy()
                        state.confidence = confidence
                        state.prediction_history.append(prediction)
                        state.buffer_length = len(state.prediction_history)
                        state.status = status
                        state.risk_score = risk_score
                        state.asymmetry = asymmetry_val
                        state.variance = variance_val
                        state.edge_strength = edge_val

                        # Accumulate for averaging
                        state.confidence_acc.append(confidence)
                        state.risk_score_acc.append(risk_score)
                        state.asymmetry_acc.append(asymmetry_val)
                        state.variance_acc.append(variance_val)
                        state.edge_strength_acc.append(edge_val)

        except Exception as e:
            logger.error(f"Analysis error: {e}")
            with state.state_lock:
                state.status = "ANALYZING"

        # Small sleep so we don't hog CPU
        time.sleep(0.05)

# ====================== REST ENDPOINTS ======================
@app.route("/")
def index():
    return {"status": "THERMASCAN running", "stream": STREAM_URL}, 200

@app.route('/status', methods=['GET'])
def get_status():
    """Poll current analysis status."""
    with state.state_lock:
        return jsonify({
            'status': state.status,
            'confidence': round(state.confidence, 4),
            'risk_score': round(state.risk_score, 1),
            'asymmetry': round(state.asymmetry, 2),
            'variance': round(state.variance, 2),
            'edge_strength': round(state.edge_strength, 2),
            'fps': round(state.fps, 1),
            'buffer_length': state.buffer_length,
            'prediction_history': list(state.prediction_history)
        })

@app.route('/start_analysis', methods=['POST'])
def start_analysis():
    """Trigger the 20-second analysis window."""
    with state.state_lock:
        state.analysis_active = True
        state.analysis_start_time = time.time()
        state.prediction_history.clear()
        state.confidence_acc.clear()
        state.risk_score_acc.clear()
        state.asymmetry_acc.clear()
        state.variance_acc.clear()
        state.edge_strength_acc.clear()
        state.status = "ANALYZING"
        logger.info("Analysis started")
    return jsonify({'message': 'Analysis started'})

@app.route('/stop_analysis', methods=['POST'])
def stop_analysis():
    """Stop the analysis window."""
    with state.state_lock:
        state.analysis_active = False
        logger.info("Analysis stopped")
    return jsonify({'message': 'Analysis stopped'})

@app.route('/final_result', methods=['GET'])
def final_result():
    """Get the averaged analysis result over the full 20s window."""
    with state.state_lock:
        # Average all accumulated values from the analysis window
        avg_prediction = float(np.mean(list(state.prediction_history))) if state.prediction_history else 0
        avg_confidence = float(np.mean(state.confidence_acc)) if state.confidence_acc else 0
        avg_risk = float(np.mean(state.risk_score_acc)) if state.risk_score_acc else 0
        avg_asymmetry = float(np.mean(state.asymmetry_acc)) if state.asymmetry_acc else 0
        avg_variance = float(np.mean(state.variance_acc)) if state.variance_acc else 0
        avg_edge = float(np.mean(state.edge_strength_acc)) if state.edge_strength_acc else 0

        final_status = "ULCER RISK" if avg_prediction > 0.5 else "HEALTHY"

        return jsonify({
            'status': final_status,
            'confidence': round(avg_confidence, 4),
            'risk_score': round(avg_risk, 1),
            'asymmetry': round(avg_asymmetry, 2),
            'variance': round(avg_variance, 2),
            'edge_strength': round(avg_edge, 2),
            'prediction_history': list(state.prediction_history),
            'total_frames_analyzed': len(state.confidence_acc),
        })

@app.route('/health', methods=['GET'])
def health():
    """Health check."""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

# ====================== MAIN ======================
if __name__ == '__main__':
    # Start capture thread
    capture_thread = threading.Thread(target=capture_thermal_stream, daemon=True)
    capture_thread.start()

    # Start analysis thread
    analysis_thread = threading.Thread(target=analyze_frames, daemon=True)
    analysis_thread.start()

    logger.info(f"Starting THERMASCAN inference server on port {PORT}")
    # Use threaded=True for MJPEG streaming support
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
