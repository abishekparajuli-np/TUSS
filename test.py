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

ANALYSIS_SECONDS = 3

prediction_history = deque(maxlen=60)
confidence_history = deque(maxlen=60)

prev_time = time.time()

analysis_start = time.time()

stable_result = "ANALYZING"

# =========================================================
# WINDOW
# =========================================================

cv2.namedWindow("THERMAL FOOT AI")

# =========================================================
# MAIN LOOP
# =========================================================

while True:

    ret, frame = cap.read()

    if not ret:
        continue

    # =====================================================
    # RESIZE
    # =====================================================

    frame = cv2.resize(
        frame,
        (FW, FH)
    )

    # =====================================================
    # KEEP LOWER THERMAL FEED
    # =====================================================

    thermal_frame = frame[FH//2:, :]

    thermal_frame = cv2.resize(
        thermal_frame,
        (FW, FH)
    )

    # =====================================================
    # PREPROCESS
    # =====================================================

    gray = cv2.cvtColor(
        thermal_frame,
        cv2.COLOR_BGR2GRAY
    )

    blur = cv2.GaussianBlur(
        gray,
        (5,5),
        0
    )

    # =====================================================
    # ADAPTIVE THRESHOLD
    # =====================================================

    dynamic_thresh = int(
        np.mean(blur) + 15
    )

    _, thresh = cv2.threshold(
        blur,
        dynamic_thresh,
        255,
        cv2.THRESH_BINARY
    )

    # =====================================================
    # CLEANUP
    # =====================================================

    kernel = np.ones((5,5), np.uint8)

    mask = cv2.morphologyEx(
        thresh,
        cv2.MORPH_OPEN,
        kernel
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel
    )

    # =====================================================
    # CONTOURS
    # =====================================================

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    display_thermal = cv2.applyColorMap(
        blur,
        cv2.COLORMAP_INFERNO
    )

    model_preview = np.zeros(
        (224,224,3),
        dtype=np.uint8
    )

    stable_result = "NO FOOT"

    confidence = 0

    risk_score = 0

    if len(contours) > 0:

        largest = max(
            contours,
            key=cv2.contourArea
        )

        area = cv2.contourArea(
            largest
        )

        if area > 3000:

            # =============================================
            # DRAW FOOT CONTOUR
            # =============================================

            cv2.drawContours(
                display_thermal,
                [largest],
                -1,
                (255,255,255),
                2
            )

            # =============================================
            # BOUNDING BOX
            # =============================================

            x, y, w, h = cv2.boundingRect(
                largest
            )

            padding = 20

            x = max(0, x-padding)
            y = max(0, y-padding)

            w = min(FW-x, w+padding*2)
            h = min(FH-y, h+padding*2)

            # =============================================
            # FOOT CROP
            # =============================================

            foot_crop = thermal_frame[
                y:y+h,
                x:x+w
            ]

            # =============================================
            # MASK CROP
            # =============================================

            foot_mask = np.zeros_like(mask)

            cv2.drawContours(
                foot_mask,
                [largest],
                -1,
                255,
                -1
            )

            foot_mask_crop = foot_mask[
                y:y+h,
                x:x+w
            ]

            # =============================================
            # ISOLATE FOOT
            # =============================================

            isolated = cv2.bitwise_and(
                foot_crop,
                foot_crop,
                mask=foot_mask_crop
            )

            # =============================================
            # BLACK BACKGROUND
            # =============================================

            black_bg = np.zeros_like(
                isolated
            )

            isolated = np.where(
                isolated > 0,
                isolated,
                black_bg
            ).astype(np.uint8)

            # =============================================
            # NORMALIZE
            # =============================================

            isolated_gray = cv2.cvtColor(
                isolated,
                cv2.COLOR_BGR2GRAY
            )

            isolated_gray = cv2.equalizeHist(
                isolated_gray
            )

            # =============================================
            # MATCH TRAINING STYLE
            # =============================================

            thermal_match = cv2.applyColorMap(
                isolated_gray,
                cv2.COLORMAP_OCEAN
            )

            # =============================================
            # CENTER FOOT ON BLACK CANVAS
            # =============================================

            canvas = np.zeros(
                (224,224,3),
                dtype=np.uint8
            )

            resized = cv2.resize(
                thermal_match,
                (180,180)
            )

            offset = 22

            canvas[
                offset:offset+180,
                offset:offset+180
            ] = resized

            model_preview = canvas.copy()

            # =============================================
            # AI INFERENCE
            # =============================================

            rgb = cv2.cvtColor(
                canvas,
                cv2.COLOR_BGR2RGB
            )

            img_tensor = transform(rgb)

            img_tensor = img_tensor.unsqueeze(0)

            img_tensor = img_tensor.to(device)

            with torch.no_grad():

                output = model(img_tensor)

                probs = torch.softmax(
                    output,
                    dim=1
                )

                confidence = torch.max(
                    probs
                ).item()

                prediction = torch.argmax(
                    output,
                    dim=1
                ).item()

            prediction_history.append(
                prediction
            )

            confidence_history.append(
                confidence
            )

            # =============================================
            # TEMPORAL STABILIZATION
            # =============================================

            elapsed = time.time() - analysis_start

            if elapsed < ANALYSIS_SECONDS:

                stable_result = "ANALYZING"

            else:

                avg_pred = np.mean(
                    prediction_history
                )

                avg_conf = np.mean(
                    confidence_history
                )

                if avg_conf < 0.65:

                    stable_result = "UNCERTAIN"

                else:

                    if avg_pred < 0.5:
                        stable_result = "HEALTHY"
                    else:
                        stable_result = "ULCER RISK"

            # =============================================
            # HOTSPOT ANALYSIS
            # =============================================

            hotspot = isolated_gray > (
                np.mean(isolated_gray) + 25
            )

            hotspot_area = np.sum(
                hotspot
            )

            # =============================================
            # ASYMMETRY
            # =============================================

            left = isolated_gray[
                :,
                :isolated_gray.shape[1]//2
            ]

            right = isolated_gray[
                :,
                isolated_gray.shape[1]//2:
            ]

            asymmetry = abs(
                np.mean(left) -
                np.mean(right)
            )

            # =============================================
            # VARIANCE
            # =============================================

            variance = np.var(
                isolated_gray
            )

            # =============================================
            # EDGE STRENGTH
            # =============================================

            edges = cv2.Canny(
                isolated_gray,
                50,
                150
            )

            edge_strength = np.mean(
                edges
            )

            # =============================================
            # RISK SCORE
            # =============================================

            risk_score = (
                confidence * 35 +
                asymmetry * 0.4 +
                variance * 0.08 +
                hotspot_area * 0.001 +
                edge_strength * 0.1
            )

            risk_score = np.clip(
                risk_score,
                0,
                100
            )

            # =============================================
            # HOTTEST POINT
            # =============================================

            minVal, maxVal, minLoc, maxLoc = cv2.minMaxLoc(
                isolated_gray
            )

            maxLoc = (
                maxLoc[0] + x,
                maxLoc[1] + y
            )

            cv2.circle(
                display_thermal,
                maxLoc,
                8,
                (255,255,255),
                2
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

    panel_h = 320

    display = np.zeros(
        (FH + panel_h, FW + 224, 3),
        dtype=np.uint8
    )

    # left thermal feed

    display[:FH, :FW] = display_thermal

    # right model input preview

    display[:224, FW:FW+224] = model_preview

    panel = display[FH:, :]

    # =====================================================
    # TEXT
    # =====================================================

    y_text = 25

    def put(txt):

        global y_text

        cv2.putText(
            panel,
            txt,
            (10, y_text),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255,255,255),
            1
        )

        y_text += 25

    put(f"FPS: {fps:.1f}")

    put(f"STATUS: {stable_result}")

    put(f"CONFIDENCE: {confidence:.2f}")

    put(f"THERMAL RISK INDEX: {risk_score:.1f}/100")

    put(f"PREDICTION BUFFER: {len(prediction_history)}")

    # =====================================================
    # RISK BAR
    # =====================================================

    bar_x = 10
    bar_y = 260
    bar_w = 300
    bar_h = 25

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
        (10, 250),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255,255,255),
        1
    )

    # =====================================================
    # TITLES
    # =====================================================

    cv2.putText(
        display,
        "LIVE THERMAL",
        (10, 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255,255,255),
        2
    )

    cv2.putText(
        display,
        "MODEL INPUT",
        (FW + 20, 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255,255,255),
        2
    )

    # =====================================================
    # DISPLAY
    # =====================================================

    cv2.imshow(
        "THERMAL FOOT AI",
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