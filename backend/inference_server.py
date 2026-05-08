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
import base64
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
    This thread is NEVER blocked by inference — it only touches frame_lock briefly.
    Retries indefinitely with exponential backoff if stream fails."""
    
    retry_delay = 2  # Start with 2s retry
    max_retry_delay = 30
    consecutive_failures = 0

    while True:
        logger.info(f"Connecting to stream: {STREAM_URL}")
        
        try:
            cap = cv2.VideoCapture(STREAM_URL)
        except Exception as e:
            logger.error(f"Failed to create VideoCapture: {e}")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)
            continue

        if not cap.isOpened():
            logger.warning(f"Failed to open stream, retrying in {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)
            continue

        logger.info("Stream connected successfully")
        retry_delay = 2  # Reset backoff on successful connection
        consecutive_failures = 0

        while True:
            try:
                ret, frame = cap.read()
            except Exception as e:
                logger.error(f"Frame read exception: {e}")
                break

            if not ret:
                consecutive_failures += 1
                if consecutive_failures <= 3 or consecutive_failures % 50 == 0:
                    logger.warning(f"Frame read failed (#{consecutive_failures}), retrying...")
                if consecutive_failures > 10:
                    # Too many failures — reconnect
                    logger.warning("Too many consecutive failures, reconnecting...")
                    break
                time.sleep(0.05)
                continue

            # Got a good frame — reset failure count
            consecutive_failures = 0

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

        # Cleanup before retry
        try:
            cap.release()
        except:
            pass
        
        logger.info(f"Reconnecting in {retry_delay}s...")
        time.sleep(retry_delay)


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

def generate_model_input_mjpeg():
    """Generator that yields the model input preview as MJPEG frames.
    Shows the 224x224 preprocessed canvas during analysis."""
    placeholder = np.zeros((224, 224, 3), dtype=np.uint8)
    # Add "WAITING" text to placeholder
    cv2.putText(placeholder, 'WAITING', (50, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (80, 80, 80), 2)

    while True:
        frame = None
        with state.state_lock:
            if state.model_input_frame is not None:
                frame = state.model_input_frame.copy()

        if frame is None:
            frame = placeholder

        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_bytes = buffer.tobytes()

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )

        time.sleep(0.1)  # ~10 fps for model input (updates less frequently)

@app.route('/model_input_feed')
def model_input_feed():
    """MJPEG stream of model input preview — use as <img src="http://localhost:5050/model_input_feed">"""
    return Response(
        generate_model_input_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

# ====================== FRAME DIMENSIONS ======================
FW = 320
FH = 240

# ====================== INFERENCE LOOP ======================
def analyze_frames():
    """Continuously analyze frames during the 20s analysis window.
    Uses the full preprocessing pipeline from test.py:
    - Lower half crop (thermal data region)
    - Adaptive thresholding
    - Morphological cleanup
    - Foot isolation via contour mask
    - Histogram equalization
    - COLORMAP_OCEAN to match training style
    - Centered on 224x224 canvas
    All heavy computation runs OUTSIDE any lock."""
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
            # ---- Step 1: Resize to standard dimensions ----
            frame = cv2.resize(frame, (FW, FH))

            # ---- Step 2: Keep lower half (thermal data region) ----
            thermal_frame = frame[FH // 2:, :]
            thermal_frame = cv2.resize(thermal_frame, (FW, FH))

            # ---- Step 3: Preprocess ----
            gray = cv2.cvtColor(thermal_frame, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)

            # ---- Step 4: Adaptive threshold ----
            dynamic_thresh = int(np.mean(blur) + 15)
            _, thresh = cv2.threshold(blur, dynamic_thresh, 255, cv2.THRESH_BINARY)

            # ---- Step 5: Morphological cleanup ----
            kernel = np.ones((5, 5), np.uint8)
            mask = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            # ---- Step 6: Find contours ----
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # Default: no foot detected
            status = "NO FOOT"
            confidence = 0.0
            risk_score = 0.0
            asymmetry_val = 0.0
            variance_val = 0.0
            edge_val = 0.0
            prediction = 0
            model_input = None

            if len(contours) > 0:
                largest = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(largest)

                if area > 3000:
                    # ---- Step 7: Padded bounding box ----
                    x, y, w, h = cv2.boundingRect(largest)
                    padding = 20
                    x = max(0, x - padding)
                    y = max(0, y - padding)
                    w = min(FW - x, w + padding * 2)
                    h = min(FH - y, h + padding * 2)

                    # ---- Step 8: Crop foot region ----
                    foot_crop = thermal_frame[y:y + h, x:x + w]

                    # ---- Step 9: Create foot mask and isolate ----
                    foot_mask = np.zeros_like(mask)
                    cv2.drawContours(foot_mask, [largest], -1, 255, -1)
                    foot_mask_crop = foot_mask[y:y + h, x:x + w]

                    isolated = cv2.bitwise_and(foot_crop, foot_crop, mask=foot_mask_crop)

                    # Black background
                    black_bg = np.zeros_like(isolated)
                    isolated = np.where(isolated > 0, isolated, black_bg).astype(np.uint8)

                    # ---- Step 10: Normalize with histogram equalization ----
                    isolated_gray = cv2.cvtColor(isolated, cv2.COLOR_BGR2GRAY)
                    isolated_gray = cv2.equalizeHist(isolated_gray)

                    # ---- Step 11: Match training style with COLORMAP_OCEAN ----
                    thermal_match = cv2.applyColorMap(isolated_gray, cv2.COLORMAP_OCEAN)

                    # ---- Step 12: Center foot on 224x224 black canvas ----
                    canvas = np.zeros((224, 224, 3), dtype=np.uint8)
                    resized = cv2.resize(thermal_match, (180, 180))
                    offset = 22
                    canvas[offset:offset + 180, offset:offset + 180] = resized

                    model_input = canvas.copy()

                    # ---- Step 13: AI Inference ----
                    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
                    img_tensor = transform(rgb).unsqueeze(0).to(device)

                    with torch.no_grad():
                        output = model(img_tensor)
                        probs = torch.softmax(output, dim=1)
                        confidence = torch.max(probs).item()
                        prediction = torch.argmax(output, dim=1).item()

                    # ---- Step 14: Hotspot analysis ----
                    hotspot = isolated_gray > (np.mean(isolated_gray) + 25)
                    hotspot_area = float(np.sum(hotspot))

                    # ---- Step 15: Asymmetry (left vs right half) ----
                    mid = isolated_gray.shape[1] // 2
                    left_half = isolated_gray[:, :mid]
                    right_half = isolated_gray[:, mid:]
                    asymmetry_val = float(abs(np.mean(left_half) - np.mean(right_half)))

                    # ---- Step 16: Variance ----
                    variance_val = float(np.var(isolated_gray))

                    # ---- Step 17: Edge strength ----
                    edges = cv2.Canny(isolated_gray, 50, 150)
                    edge_val = float(np.mean(edges))

                    # ---- Step 18: Composite risk score ----
                    risk_score = (
                        confidence * 35 +
                        asymmetry_val * 0.4 +
                        variance_val * 0.08 +
                        hotspot_area * 0.001 +
                        edge_val * 0.1
                    )
                    risk_score = float(np.clip(risk_score, 0, 100))

                    # ---- Step 19: Temporal stabilization ----
                    elapsed = time.time() - (state.analysis_start_time or time.time())
                    if elapsed < 3:
                        status = "ANALYZING"
                    else:
                        avg_conf = float(np.mean(state.confidence_acc)) if state.confidence_acc else confidence
                        if avg_conf < 0.65:
                            status = "UNCERTAIN"
                        elif prediction == 0:
                            status = "HEALTHY"
                        else:
                            status = "ULCER RISK"

            # Write results — brief state lock
            with state.state_lock:
                if model_input is not None:
                    state.model_input_frame = model_input
                    state.bounding_box = (x, y, w, h)
                state.confidence = confidence
                state.prediction_history.append(prediction)
                state.buffer_length = len(state.prediction_history)
                state.status = status
                state.risk_score = risk_score
                state.asymmetry = asymmetry_val
                state.variance = variance_val
                state.edge_strength = edge_val

                # Accumulate for averaging over full window
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

@app.route('/snapshot', methods=['GET'])
def snapshot():
    """Return current thermal frame and model input as base64 images for report embedding."""
    thermal_b64 = ''
    model_input_b64 = ''
    
    # Grab current live frame
    with state.frame_lock:
        if state.current_frame is not None:
            frame = state.current_frame.copy()
            # Apply thermal colormap for better visualization
            gray = cv2.cvtColor(cv2.resize(frame, (FW, FH)), cv2.COLOR_BGR2GRAY)
            thermal_colored = cv2.applyColorMap(gray, cv2.COLORMAP_INFERNO)
            _, buf = cv2.imencode('.jpg', thermal_colored, [cv2.IMWRITE_JPEG_QUALITY, 90])
            thermal_b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
    
    # Grab model input frame
    with state.state_lock:
        if state.model_input_frame is not None:
            _, buf = cv2.imencode('.jpg', state.model_input_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            model_input_b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
    
    return jsonify({
        'thermal_frame': thermal_b64,
        'model_input': model_input_b64,
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
