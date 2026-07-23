# Vision AI Science Lab

**Tagline:** Learn Science Through Artificial Intelligence
**Event:** INSIGHT 2026 · AI Category

Vision AI Science Lab combines MediaPipe computer vision, curriculum-aligned simulations, a 64-question science quiz, and a two-servo Arduino robot. The original **Beat the Robot** Rock–Paper–Scissors arena remains the main attraction.

## Implemented experiences

Priority 1:

- Beat the Robot — MediaPipe Gesture Recognizer + Web Serial
- Finger Counter — two hands, addition, binary and timed challenge modes
- Hand Landmark Explorer — 21 points, handedness, pinch and coordinates
- Pose Intelligence — joint angles, pose tasks, squat and jumping-jack counters
- AI Science Quiz — 64 original questions with filters and explanations

Priority 2:

- Force and Laws of Motion
- Reflection of Light
- Electricity and Circuits
- Atomic Structure
- Cell Explorer

Priority 3:

- Work, Energy and Power
- Human Eye and Vision
- Human Skeleton
- Digestive System
- Circulatory System
- Respiratory System
- Chemical Reactions
- Carbon Compounds
- Face Intelligence

Each module includes a learning objective, live interaction, curriculum concept, AI explanation, limitation statement, and short knowledge checks. Deterministic simulations are never presented as AI.

## Main source structure

```text
app/
├── layout.tsx                 Global metadata and styles
├── page.tsx                   Preserved Beat the Robot arena + platform
├── science-platform.tsx       Module registry, vision runtime and experiences
├── science-platform.css       Responsive exhibition UI
├── quiz-data.ts               64 typed Class 9–10 questions
├── script-loader.tsx          Browser-only TinyBot loader
└── globals.css                Original TinyBot styling
public/
├── tinybot.js                 MediaPipe game, audio, scores and Web Serial
├── models/                    Local hand, face, pose and gesture task models
├── mediapipe/                 Local browser bundle and WASM runtime
├── sw.js                      Offline runtime/model cache
└── favicon.svg
arduino/
└── TinyBotTwoServo/
    └── TinyBotTwoServo.ino
```

## Install and run

Requirements: Node.js 22.13 or newer, Chrome or Edge, and a camera.

```bash
npm install
npm run dev
```

Open the local address printed by the terminal. This is the primary development workflow.

### VS Code Go Live version

The repository also includes a complete browser bundle for Live Server:

```bash
npm run build:go-live
```

Then right-click `go-live/index.html` in VS Code and select **Open with Live Server**. Use the localhost address opened by the extension and allow camera access. Do not open the HTML file directly with a `file://` address.

Production verification:

```bash
npm run build
npm run validate:artifact
```

## MediaPipe assets

`@mediapipe/tasks-vision` is installed from npm. WASM files and all four model files are already included in `public/`, so no model download is required.

Models:

- `gesture_recognizer.task`
- `hand_landmarker.task`
- `face_landmarker.task`
- `pose_landmarker_lite.task`

The service worker caches the application, MediaPipe runtime and models after the first complete visit. Reopen each camera module once while online before relying on offline exhibition mode.

## Browser requirements

- Chrome or Edge recommended
- `localhost` or HTTPS is required for camera access
- Web Serial is available in Chromium browsers only
- Safari/Firefox can use simulations but not Arduino Web Serial
- Allow camera permission when prompted

## Performance architecture

- Browser-only dynamic MediaPipe import
- One shared `CameraProvider` owns the active stream and inference loop
- `CameraStage` attaches the real stream and aligned AR canvas to each experience
- Only the model required by the active module performs inference
- GPU delegate first, automatic CPU fallback
- 640 × 480 capture target
- `requestAnimationFrame` video processing
- Duplicate video timestamps skipped
- Pinch hysteresis: grab below `0.045`, release above `0.065`
- Smoothed mirrored fingertip coordinates and single-object grab locks
- High-frequency stream, task, timing and pinch state held in refs
- Camera tracks and animation frames are released on exit; safely loaded models are cached until the provider closes
- Two-hand processing only for Finger Counter; other activities use the minimum needed model
- Reduced-motion CSS support

### Camera status and diagnostics

Every camera experience shows permission, camera and model state instead of hiding failures. The main control reads **START CAMERA EXPERIENCE** and changes to **STOP CAMERA** while active.

Open the gear button on the landing page to reveal the developer diagnostics panel. It reports the active stream/model, FPS, inference time, hand/pose/face detection, pinch state, grabbed object and last camera error. It stays hidden in normal exhibition mode.

The AR layer order is:

1. mirrored live webcam
2. subtle `rgba(0, 0, 0, 0.14)` visibility tint
3. aligned landmark canvas and educational objects
4. controls and status UI

The camera is not blurred.

## Arduino integration

The website sends only the robot move at **115200 baud**:

| Robot move | Serial byte | D9: index + middle | D10: ring + pinky |
|---|---|---|---|
| Rock | `R` | Closed | Closed |
| Paper | `P` | Open | Open |
| Scissors | `S` | Open | Closed |

The thumb stays mechanically fixed. Use an external regulated 5 V supply for two loaded SG90 servos and connect the supply ground to Arduino GND. Close Arduino Serial Monitor before connecting from the website.

The application remains fully usable without Arduino.

## Exhibition checklist

- [ ] Open the site in Chrome or Edge and allow camera access
- [ ] Confirm **START CAMERA EXPERIENCE** shows permission and model-loading states
- [ ] Stop and restart each camera without refreshing
- [ ] Exit each module and confirm the browser camera indicator turns off
- [ ] Open Finger Counter after Pose, Face and Beat the Robot
- [ ] Open Beat the Robot again after another camera experience
- [ ] Visit Hand, Face and Pose modules once to warm/cache each model
- [ ] Confirm hand landmarks align with the mirrored hand
- [ ] Pinch the Force block, move it, release it, then hold an open palm to reset
- [ ] Verify Skeleton Explorer hides low-confidence points and reports elbow angles
- [ ] Verify separate squat and jumping-jack counters do not double count
- [ ] Confirm Beat the Robot locks Rock, Paper and Scissors reliably
- [ ] Confirm only the robot move reaches the Arduino
- [ ] Test `R`, `P` and `S` from Serial Monitor before the website test
- [ ] Close Serial Monitor, connect Web Serial, and play three rounds
- [ ] Check both servos with an external 5 V supply and common ground
- [ ] Test quiz mouse and keyboard controls
- [ ] Test Force, Reflection, Electricity, Atom and Cell interactions
- [ ] Enter and exit full-screen Exhibition Mode
- [ ] Verify inactivity returns to the homepage and shows the attract screen
- [ ] Test projector resolution and reduced-motion mode
- [ ] Disconnect Wi-Fi and confirm cached models reopen

## Important limitations

- Automated builds validate code, assets and lifecycle wiring, but a real webcam permission prompt and physical gestures must be checked on the exhibition laptop.
- Webcam force, height, gaze, posture and body-region values are educational screen estimates.
- Pose lines do not represent visible bones.
- The camera cannot see internal organs or measure heart rate/lung capacity.
- Face geometry is not used to infer identity, character, honesty, intelligence, attention, mental state or true emotion.
- The Bohr atom and molecular drawings are simplified school-level models.
