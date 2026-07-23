"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  FaceLandmarker,
  HandLandmarker,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

export type VisionKind = "hand" | "face" | "pose";
export type CameraStatus =
  | "idle"
  | "requesting"
  | "camera-ready"
  | "loading-model"
  | "tracking"
  | "error";

export interface PinchInteraction {
  x: number;
  y: number;
  viewportX: number;
  viewportY: number;
  distance: number;
  active: boolean;
  phase: "idle" | "start" | "move" | "end";
}

export interface VisionFrame {
  landmarks: NormalizedLandmark[][];
  handedness?: string;
  handednesses?: string[];
  confidence?: number;
  blendshapes?: Record<string, number>;
  interaction?: PinchInteraction;
  fps: number;
  inferenceMs?: number;
}

interface Diagnostics {
  activeStream: boolean;
  activeModel: VisionKind | null;
  fps: number;
  inferenceMs: number;
  handDetected: boolean;
  poseDetected: boolean;
  faceDetected: boolean;
  pinch: boolean;
  pointerX: number;
  pointerY: number;
  grabbedObject: string;
  lastError: string;
}

interface CameraSession {
  owner: symbol;
  kind: VisionKind;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onFrame?: (frame: VisionFrame) => void;
}

interface CameraContextValue {
  status: CameraStatus;
  modelLabel: string;
  error: string;
  diagnostics: Diagnostics;
  start: (session: CameraSession) => Promise<void>;
  stop: (owner?: symbol) => void;
  setGrabbedObject: (name: string) => void;
}

type VisionTask = HandLandmarker | FaceLandmarker | PoseLandmarker;

const CameraContext = createContext<CameraContextValue | null>(null);
const HAND_CONNECTIONS: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const POSE_CONNECTIONS: [number, number][] = [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
const asset = (path: string) =>
  typeof window !== "undefined" && window.location.pathname.includes("/go-live/")
    ? `../public/${path}`
    : `/${path}`;

const initialDiagnostics: Diagnostics = {
  activeStream: false,
  activeModel: null,
  fps: 0,
  inferenceMs: 0,
  handDetected: false,
  poseDetected: false,
  faceDetected: false,
  pinch: false,
  pointerX: 0.5,
  pointerY: 0.5,
  grabbedObject: "none",
  lastError: "",
};

function friendlyCameraError(cause: unknown) {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError") return "Camera permission was denied. Allow camera access in the address bar, then retry.";
    if (cause.name === "NotFoundError") return "No webcam was found. Connect a camera, then retry.";
    if (cause.name === "NotReadableError") return "The webcam is already in use by another app. Close that app, then retry.";
    if (cause.name === "OverconstrainedError") return "This camera cannot provide the requested video format.";
  }
  return cause instanceof Error ? cause.message : "The camera or vision model could not start.";
}

export function CameraProvider({ children }: { children: ReactNode }) {
  const streamRef = useRef<MediaStream | null>(null);
  const tasksRef = useRef(new Map<VisionKind, VisionTask>());
  const activeRef = useRef<CameraSession | null>(null);
  const rafRef = useRef(0);
  const generationRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const sampleTimesRef = useRef<number[]>([]);
  const pinchRef = useRef(false);
  const smoothedRef = useRef({ x: 0.5, y: 0.5, ready: false });
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [modelLabel, setModelLabel] = useState("Camera Off");
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);

  const stop = useCallback((owner?: symbol) => {
    if (owner && activeRef.current?.owner !== owner) return;
    generationRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    const session = activeRef.current;
    activeRef.current = null;
    if (session) {
      session.video.pause();
      session.video.srcObject = null;
      const context = session.canvas.getContext("2d");
      context?.clearRect(0, 0, session.canvas.width, session.canvas.height);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pinchRef.current = false;
    smoothedRef.current.ready = false;
    lastVideoTimeRef.current = -1;
    sampleTimesRef.current = [];
    setStatus("idle");
    setModelLabel("Camera Off");
    setDiagnostics((current) => ({
      ...current,
      activeStream: false,
      activeModel: null,
      fps: 0,
      handDetected: false,
      poseDetected: false,
      faceDetected: false,
      pinch: false,
      grabbedObject: "none",
    }));
  }, []);

  useEffect(() => () => {
    stop();
    tasksRef.current.forEach((task) => task.close());
    tasksRef.current.clear();
  }, [stop]);

  const loadTask = useCallback(async (kind: VisionKind, generation: number) => {
    const cached = tasksRef.current.get(kind);
    if (cached) return cached;
    setStatus("loading-model");
    setModelLabel(`Loading ${kind === "hand" ? "Hand" : kind === "pose" ? "Pose" : "Face"} Model`);
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(asset("mediapipe/wasm"));
    const create = async (delegate: "GPU" | "CPU"): Promise<VisionTask> => {
      const baseOptions = {
        modelAssetPath: asset(`models/${kind === "hand" ? "hand_landmarker.task" : kind === "pose" ? "pose_landmarker_lite.task" : "face_landmarker.task"}`),
        delegate,
      };
      if (kind === "hand") return vision.HandLandmarker.createFromOptions(files, {
        baseOptions,
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      if (kind === "pose") return vision.PoseLandmarker.createFromOptions(files, {
        baseOptions,
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions,
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    };
    let task: VisionTask;
    try {
      task = await create("GPU");
    } catch {
      task = await create("CPU");
    }
    if (generation !== generationRef.current) {
      task.close();
      throw new DOMException("Camera start was cancelled.", "AbortError");
    }
    tasksRef.current.set(kind, task);
    return task;
  }, []);

  const start = useCallback(async (session: CameraSession) => {
    if (!window.isSecureContext) {
      const message = "Camera access requires HTTPS or localhost. Use npm run dev or VS Code Live Server.";
      setError(message);
      setStatus("error");
      setModelLabel("Camera Error");
      setDiagnostics((current) => ({ ...current, lastError: message }));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "This browser does not support webcam access. Use current Chrome or Edge.";
      setError(message);
      setStatus("error");
      setModelLabel("Unsupported Browser");
      setDiagnostics((current) => ({ ...current, lastError: message }));
      return;
    }

    stop();
    const generation = generationRef.current;
    activeRef.current = session;
    setError("");
    setStatus("requesting");
    setModelLabel("Requesting Permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      if (generation !== generationRef.current || activeRef.current?.owner !== session.owner) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      session.video.srcObject = stream;
      await session.video.play();
      setStatus("camera-ready");
      setModelLabel("Camera Active");
      setDiagnostics((current) => ({ ...current, activeStream: true }));

      const task = await loadTask(session.kind, generation);
      if (generation !== generationRef.current || activeRef.current?.owner !== session.owner) return;
      setStatus("tracking");
      setModelLabel(`${session.kind === "hand" ? "Hand" : session.kind === "pose" ? "Pose" : "Face"} Tracking Ready`);
      setDiagnostics((current) => ({ ...current, activeModel: session.kind }));

      const loop = () => {
        if (generation !== generationRef.current || activeRef.current?.owner !== session.owner) return;
        const video = session.video;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          const started = performance.now();
          let landmarks: NormalizedLandmark[][] = [];
          let handednesses: string[] | undefined;
          let confidence: number | undefined;
          let blendshapes: Record<string, number> | undefined;

          if (session.kind === "hand") {
            const result = (task as HandLandmarker).detectForVideo(video, started);
            landmarks = result.landmarks;
            handednesses = result.handedness?.map((entry) => entry[0]?.categoryName ?? "Unknown");
            confidence = result.handedness?.[0]?.[0]?.score;
          } else if (session.kind === "pose") {
            const result = (task as PoseLandmarker).detectForVideo(video, started);
            landmarks = result.landmarks;
            confidence = landmarks[0]?.[11]?.visibility;
          } else {
            const result = (task as FaceLandmarker).detectForVideo(video, started);
            landmarks = result.faceLandmarks;
            blendshapes = Object.fromEntries((result.faceBlendshapes?.[0]?.categories ?? []).map((item) => [item.categoryName, item.score]));
          }

          const interaction = session.kind === "hand"
            ? makePinchInteraction(landmarks[0], session.canvas, pinchRef, smoothedRef)
            : undefined;
          drawLandmarks(session.canvas, video, landmarks, session.kind);
          const finished = performance.now();
          sampleTimesRef.current.push(finished);
          sampleTimesRef.current = sampleTimesRef.current.filter((time) => finished - time < 1000);
          const frame: VisionFrame = {
            landmarks,
            handedness: handednesses?.[0],
            handednesses,
            confidence,
            blendshapes,
            interaction,
            fps: sampleTimesRef.current.length,
            inferenceMs: finished - started,
          };
          session.onFrame?.(frame);
          setDiagnostics((current) => ({
            ...current,
            fps: frame.fps,
            inferenceMs: frame.inferenceMs ?? 0,
            handDetected: session.kind === "hand" && landmarks.length > 0,
            poseDetected: session.kind === "pose" && landmarks.length > 0,
            faceDetected: session.kind === "face" && landmarks.length > 0,
            pinch: interaction?.active ?? false,
            pointerX: interaction?.x ?? current.pointerX,
            pointerY: interaction?.y ?? current.pointerY,
          }));
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const message = friendlyCameraError(cause);
      stop();
      setError(message);
      setStatus("error");
      setModelLabel(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Permission Denied" : "Camera Error");
      setDiagnostics((current) => ({ ...current, lastError: message }));
    }
  }, [loadTask, stop]);

  const setGrabbedObject = useCallback((name: string) => {
    setDiagnostics((current) => ({ ...current, grabbedObject: name || "none" }));
  }, []);

  const value = useMemo(() => ({
    status,
    modelLabel,
    error,
    diagnostics,
    start,
    stop,
    setGrabbedObject,
  }), [status, modelLabel, error, diagnostics, start, stop, setGrabbedObject]);

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

function makePinchInteraction(
  hand: NormalizedLandmark[] | undefined,
  canvas: HTMLCanvasElement,
  pinchRef: RefObject<boolean>,
  smoothedRef: RefObject<{ x: number; y: number; ready: boolean }>,
): PinchInteraction | undefined {
  if (!hand?.[4] || !hand[8]) {
    if (pinchRef.current) pinchRef.current = false;
    smoothedRef.current.ready = false;
    return undefined;
  }
  const distance = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y, (hand[4].z ?? 0) - (hand[8].z ?? 0));
  const wasActive = pinchRef.current;
  const active = wasActive ? distance <= 0.065 : distance < 0.045;
  pinchRef.current = active;
  const rawX = 1 - hand[8].x;
  const rawY = hand[8].y;
  const smooth = smoothedRef.current;
  if (!smooth.ready) {
    smooth.x = rawX;
    smooth.y = rawY;
    smooth.ready = true;
  } else {
    smooth.x += (rawX - smooth.x) * 0.32;
    smooth.y += (rawY - smooth.y) * 0.32;
  }
  const rect = canvas.getBoundingClientRect();
  return {
    x: smooth.x,
    y: smooth.y,
    viewportX: rect.left + smooth.x * rect.width,
    viewportY: rect.top + smooth.y * rect.height,
    distance,
    active,
    phase: active && !wasActive ? "start" : active ? "move" : !active && wasActive ? "end" : "idle",
  };
}

function drawLandmarks(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  sets: NormalizedLandmark[][],
  kind: VisionKind,
) {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const connections = kind === "hand" ? HAND_CONNECTIONS : kind === "pose" ? POSE_CONNECTIONS : [];
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = kind === "pose" ? 5 : 3;
  context.strokeStyle = "#38e8ff";
  context.fillStyle = "#89ffca";
  sets.forEach((points) => {
    connections.forEach(([from, to]) => {
      const a = points[from];
      const b = points[to];
      if (!a || !b || (kind === "pose" && ((a.visibility ?? 1) < 0.45 || (b.visibility ?? 1) < 0.45))) return;
      context.beginPath();
      context.moveTo(a.x * width, a.y * height);
      context.lineTo(b.x * width, b.y * height);
      context.stroke();
    });
    const visiblePoints = kind === "face" ? points.filter((_, index) => index % 3 === 0) : points;
    visiblePoints.forEach((point) => {
      if (kind === "pose" && (point.visibility ?? 1) < 0.45) return;
      context.beginPath();
      context.arc(point.x * width, point.y * height, kind === "face" ? 1.25 : 4.5, 0, Math.PI * 2);
      context.fill();
    });
  });
  context.restore();
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) throw new Error("useCamera must be used inside CameraProvider");
  return context;
}

export function CameraStage({
  kind,
  onFrame,
  compact = false,
  cameraFunction,
}: {
  kind: VisionKind;
  onFrame?: (frame: VisionFrame) => void;
  compact?: boolean;
  cameraFunction?: string;
}) {
  const { status, modelLabel, error, diagnostics, start, stop } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ownerRef = useRef(Symbol("camera-stage"));
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => () => stop(ownerRef.current), [stop]);
  const begin = () => {
    if (!videoRef.current || !canvasRef.current) return;
    void start({
      owner: ownerRef.current,
      kind,
      video: videoRef.current,
      canvas: canvasRef.current,
      onFrame: (frame) => callbackRef.current?.(frame),
    });
  };
  const active = status === "tracking" || status === "camera-ready" || status === "loading-model";
  const loading = status === "requesting" || status === "camera-ready" || status === "loading-model";
  return (
    <section className={`vision-stage ${compact ? "compact" : ""} ${active ? "camera-live" : ""}`}>
      <div className="vision-feed">
        <video ref={videoRef} muted playsInline />
        <div className="camera-tint" />
        <canvas ref={canvasRef} />
        {!active && (
          <div className="vision-cover">
            <span>◉</span>
            <b>{status === "error" ? modelLabel : "CAMERA EXPERIENCE READY"}</b>
            <small>{status === "error" ? error : cameraFunction ?? `Camera function: loads ${kind} tracking for this experience.`}</small>
            <button type="button" onClick={begin}>START CAMERA EXPERIENCE</button>
          </div>
        )}
        {loading && (
          <div className="camera-loading" role="status">
            <i />
            <b>{modelLabel}</b>
            <span>Keep this tab visible while the local model starts.</span>
          </div>
        )}
        <div className="vision-badge"><i className={status} />{modelLabel}</div>
        {kind === "hand" && diagnostics.handDetected && (
          <div
            className={`pinch-cursor ${diagnostics.pinch ? "pinching" : ""}`}
            style={{
              left: `${diagnostics.pointerX * 100}%`,
              top: `${diagnostics.pointerY * 100}%`,
            }}
          />
        )}
      </div>
      {active && <button type="button" className="stop-camera" onClick={() => stop(ownerRef.current)}>STOP CAMERA</button>}
      {kind === "hand" && active && <p className="pinch-hint">PINCH THUMB + INDEX FINGER TO GRAB</p>}
    </section>
  );
}

export function CameraDiagnostics({ visible }: { visible: boolean }) {
  const { diagnostics, status, modelLabel } = useCamera();
  if (!visible) return null;
  return (
    <aside className="camera-diagnostics" aria-label="Developer camera diagnostics">
      <b>VISION DIAGNOSTICS</b>
      <span>Status <strong>{status}</strong></span>
      <span>Stream <strong>{diagnostics.activeStream ? "active" : "off"}</strong></span>
      <span>Model <strong>{modelLabel}</strong></span>
      <span>FPS <strong>{diagnostics.fps}</strong></span>
      <span>Inference <strong>{diagnostics.inferenceMs.toFixed(1)} ms</strong></span>
      <span>Hand <strong>{diagnostics.handDetected ? "yes" : "no"}</strong></span>
      <span>Pose <strong>{diagnostics.poseDetected ? "yes" : "no"}</strong></span>
      <span>Face <strong>{diagnostics.faceDetected ? "yes" : "no"}</strong></span>
      <span>Pinch <strong>{diagnostics.pinch ? "active" : "open"}</strong></span>
      <span>Grabbed <strong>{diagnostics.grabbedObject}</strong></span>
      <span>Error <strong>{diagnostics.lastError || "none"}</strong></span>
    </aside>
  );
}

export const useHandTracking = useCamera;
export const usePoseTracking = useCamera;
export const useFaceTracking = useCamera;
export const useModelLoader = useCamera;
export const usePinchInteraction = useCamera;
