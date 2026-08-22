/**
 * FaceController — tracks the vertical position of your eyes in the webcam
 * frame using MediaPipe Face Detector. No calibration needed: the game reads
 * getEyeY() (0 = top of camera frame, 1 = bottom) and moves the bird
 * relative to a neutral position captured at the start of each round.
 */
const FaceController = (() => {
  const MEDIAPIPE_PKG = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
  const SMOOTHING = 0.35; // higher = more responsive, lower = smoother

  let video = null;
  let detector = null;
  let running = false;
  let eyeY = null; // smoothed normalized eye height in the camera frame
  let faceSeen = false;

  function friendlyCameraError(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Camera access was denied. Please allow camera access and try again.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No camera found. Connect a webcam or use Mouse mode.";
    }
    if (name === "NotReadableError") {
      return "The camera is in use by another app or tab. Close it and try again.";
    }
    return "Could not start the camera: " + ((err && err.message) || err);
  }

  async function start(onStatus) {
    if (running) return;
    const status = onStatus || (() => {});

    status("Starting camera…");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
    } catch (err) {
      throw new Error(friendlyCameraError(err));
    }

    video = document.getElementById("camera-preview");
    video.srcObject = stream;
    video.classList.remove("hidden");
    await video.play();

    status("Loading face tracker…");
    const visionModule = await import(`${MEDIAPIPE_PKG}/vision_bundle.mjs`);
    const fileset = await visionModule.FilesetResolver.forVisionTasks(
      `${MEDIAPIPE_PKG}/wasm`
    );

    // Prefer GPU, fall back to CPU (some machines lack WebGL support)
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
    });
    try {
      detector = await visionModule.FaceDetector.createFromOptions(fileset, options("GPU"));
    } catch {
      detector = await visionModule.FaceDetector.createFromOptions(fileset, options("CPU"));
    }

    running = true;
    requestAnimationFrame(loop);
    status("Face tracker ready");
  }

  function loop() {
    if (!running) return;
    if (video.readyState >= 2) {
      const result = detector.detectForVideo(video, performance.now());
      if (result.detections.length > 0) {
        // Keypoints 0 and 1 are the eyes (normalized coordinates)
        const kp = result.detections[0].keypoints;
        const y = (kp[0].y + kp[1].y) / 2;
        eyeY = eyeY === null ? y : eyeY + (y - eyeY) * SMOOTHING;
        faceSeen = true;
      } else {
        faceSeen = false;
      }
    }
    requestAnimationFrame(loop);
  }

  return {
    start,
    getEyeY: () => eyeY,
    isFaceSeen: () => faceSeen,
    isRunning: () => running,
  };
})();
