import cv2
import numpy as np
import time
from collections import deque

import torch
import timm

from torchvision import transforms

# =========================================================
# STREAM CONFIG
# =========================================================

url = "http://admin:12345@192.168.79.148:8081/live.flv"

cap = cv2.VideoCapture(url)

# =========================================================
# MODEL
# =========================================================

device = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)

model = timm.create_model(
    'deit_small_patch16_224',
    pretrained=False,
    num_classes=2
)

model.load_state_dict(
    torch.load(
        "deit_thermo_model.pth",
        map_location=device
    )
)

model.to(device)

model.eval()

# =========================================================
# TRANSFORM
# =========================================================

transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# =========================================================
# SETTINGS
# =========================================================

FW = 320
FH = 240

ROI_SIZE = 90

ANALYSIS_SECONDS = 3

prediction_history = deque(maxlen=60)
confidence_history = deque(maxlen=60)
temp_history = deque(maxlen=60)

prev_time = time.time()

# =========================================================
# WINDOW
# =========================================================

cv2.namedWindow("THERMAL FOOT ANALYSIS")

# =========================================================
# MAIN LOOP
# =========================================================

analysis_start = time.time()

stable_result = "ANALYZING"

while True:

    ret, frame = cap.read()

    if not ret:
        continue

    # =====================================================
    # RESIZE INPUT
    # =====================================================

    frame = cv2.resize(frame, (FW, FH))

    # =====================================================
    # KEEP LOWER THERMAL SECTION ONLY
    # =====================================================

    thermal_frame = frame[FH//2:, :]

    thermal_frame = cv2.resize(
        thermal_frame,
        (FW, FH)
    )

    # =====================================================
    # THERMAL PROCESSING
    # =====================================================

    gray = cv2.cvtColor(
        thermal_frame,
        cv2.COLOR_BGR2GRAY
    )

    blur = cv2.GaussianBlur(
        gray,
        (5, 5),
        0
    )

    thermal = cv2.applyColorMap(
        blur,
        cv2.COLORMAP_INFERNO
    )

    # =====================================================
    # ROI
    # =====================================================

    cx = FW // 2
    cy = FH // 2

    x1 = cx - ROI_SIZE // 2
    y1 = cy - ROI_SIZE // 2

    x2 = x1 + ROI_SIZE
    y2 = y1 + ROI_SIZE

    roi = blur[y1:y2, x1:x2]

    # =====================================================
    # METRICS
    # =====================================================

    roi_mean = np.mean(roi)

    roi_std = np.std(roi)

    minVal, maxVal, minLoc, maxLoc = cv2.minMaxLoc(
        blur
    )

    hotspot_delta = maxVal - roi_mean

    asymmetry_score = abs(
        np.mean(blur[:, :FW//2]) -
        np.mean(blur[:, FW//2:])
    )

    thermal_variance = np.var(blur)

    edge_strength = cv2.Laplacian(
        blur,
        cv2.CV_64F
    ).var()

    temp_history.append(roi_mean)

    # =====================================================
    # AI INFERENCE
    # =====================================================

    rgb = cv2.cvtColor(
        thermal,
        cv2.COLOR_BGR2RGB
    )

    img_tensor = transform(rgb)

    img_tensor = img_tensor.unsqueeze(0)

    img_tensor = img_tensor.to(device)

    with torch.no_grad():

        output = model(img_tensor)

        probabilities = torch.softmax(
            output,
            dim=1
        )

        confidence = torch.max(
            probabilities
        ).item()

        prediction = torch.argmax(
            output,
            dim=1
        ).item()

    prediction_history.append(prediction)

    confidence_history.append(confidence)

    # =====================================================
    # TEMPORAL STABILIZATION
    # =====================================================

    elapsed = time.time() - analysis_start

    if elapsed < ANALYSIS_SECONDS:

        stable_result = "ANALYZING"

    else:

        avg_prediction = np.mean(
            prediction_history
        )

        avg_confidence = np.mean(
            confidence_history
        )

        if avg_confidence < 0.65:

            stable_result = "UNCERTAIN"

        else:

            if avg_prediction < 0.5:
                stable_result = "HEALTHY"
            else:
                stable_result = "ULCER RISK"

    # =====================================================
    # RISK SCORING
    # =====================================================

    risk_score = (
        hotspot_delta * 0.4 +
        asymmetry_score * 0.3 +
        thermal_variance * 0.2 +
        edge_strength * 0.1
    )

    risk_score = np.clip(
        risk_score / 25,
        0,
        100
    )

    # =====================================================
    # DRAWINGS
    # =====================================================

    cv2.rectangle(
        thermal,
        (x1, y1),
        (x2, y2),
        (255, 255, 255),
        2
    )

    cv2.circle(
        thermal,
        maxLoc,
        8,
        (255, 255, 255),
        2
    )

    cv2.line(
        thermal,
        (cx - 20, cy),
        (cx + 20, cy),
        (255, 255, 255),
        1
    )

    cv2.line(
        thermal,
        (cx, cy - 20),
        (cx, cy + 20),
        (255, 255, 255),
        1
    )

    # =====================================================
    # FPS
    # =====================================================

    current_time = time.time()

    fps = 1 / (current_time - prev_time)

    prev_time = current_time

    # =====================================================
    # METRIC PANEL
    # =====================================================

    panel_h = 220

    display = np.zeros(
        (FH + panel_h, FW, 3),
        dtype=np.uint8
    )

    display[:FH, :] = thermal

    panel = display[FH:, :]

    # =====================================================
    # TEXT
    # =====================================================

    y = 25

    def put(txt):

        global y

        cv2.putText(
            panel,
            txt,
            (10, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1
        )

        y += 25

    put(f"FPS: {fps:.1f}")

    put(f"STATUS: {stable_result}")

    put(f"CONFIDENCE: {np.mean(confidence_history):.2f}")

    put(f"MAX INTENSITY: {maxVal:.1f}")

    put(f"ROI TEMP AVG: {roi_mean:.1f}")

    put(f"HOTSPOT DELTA: {hotspot_delta:.1f}")

    put(f"ASYMMETRY SCORE: {asymmetry_score:.1f}")

    put(f"THERMAL VARIANCE: {thermal_variance:.1f}")

    put(f"EDGE STRENGTH: {edge_strength:.1f}")

    put(f"RISK SCORE: {risk_score:.1f}/100")

    # =====================================================
    # RISK BAR
    # =====================================================

    bar_x = 10
    bar_y = 180
    bar_w = 280
    bar_h = 20

    cv2.rectangle(
        panel,
        (bar_x, bar_y),
        (bar_x + bar_w, bar_y + bar_h),
        (255,255,255),
        1
    )

    fill_w = int(
        (risk_score / 100) * bar_w
    )

    cv2.rectangle(
        panel,
        (bar_x, bar_y),
        (bar_x + fill_w, bar_y + bar_h),
        (255,255,255),
        -1
    )

    cv2.putText(
        panel,
        "THERMAL RISK INDEX",
        (10, 170),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255,255,255),
        1
    )

    # =====================================================
    # DISPLAY
    # =====================================================

    cv2.imshow(
        "THERMAL FOOT ANALYSIS",
        display
    )

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break

# =========================================================
# CLEANUP
# =========================================================

cap.release()

cv2.destroyAllWindows()