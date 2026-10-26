# Flappy Head 📷🐤

Flappy Bird, but you steer the bird **with your head**. The game uses
[MediaPipe Face Detector](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector)
to track where your eyes are in the webcam frame — raise your head and the
bird climbs, lower it and the bird descends. A mouse mode is included as a
fallback for devices without a webcam.

## Features

- **Head-position control** — no calibration needed; your position during the
  countdown becomes the neutral center, with a Re-center button in-game
- **Mouse/touch mode** fallback
- Canvas-rendered game with pipes, scoring, and increasing difficulty
- **Themes** — Classic, Climba (bouldering gym), and Christmas (night sky + trees)
- **Leaderboard** backed by an Express API (top 10 scores stored server-side)
- Personal best stored in the browser

## Run locally

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm start
```

Then open **http://localhost:3000** in Chrome or Edge.

## How to play

1. Click **Play with Head Control** and allow camera access.
2. During the countdown, hold a comfortable head position — that becomes
   your center.
3. Raise your head to fly up, lower it to descend. A dashed line shows the
   height the bird is flying toward.
4. Use **Re-center** (top-right) any time your seating position changes.
5. Submit your score to the leaderboard when you crash.

## Important: HTTPS in production

Browsers only allow webcam access on `localhost` or over **HTTPS**. When
deploying, the site must be served over HTTPS or head tracking will not work.

## Project structure

```
server.js          Express server + leaderboard API
scores.json        Leaderboard storage (created automatically)
public/
  index.html       UI screens (menu, camera setup, game over)
  style.css        Styling
  head.js          MediaPipe face tracking (eye position in camera frame)
  game.js          Game engine (canvas rendering, physics, scoring)
```
