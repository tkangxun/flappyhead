/**
 * Flappy Head — raise or lower your head to steer the character
 * (or use the mouse as a fallback).
 *
 * Two themes share all game logic:
 *   classic — blue sky, green pipes, yellow bird
 *   climba  — bouldering gym: wall + holds, rock spires, crash pads,
 *             and the Climba mascot as the flying character
 */
(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 480
  const H = canvas.height;  // 640
  const GROUND_H = 70;

  const HOLD_COLORS = ["#35bfc4", "#5b8c6e", "#e0745c", "#e8b64c", "#8e6bb5"];

  // ---------- Elements ----------
  const el = (id) => document.getElementById(id);
  const screens = {
    menu: el("menu-screen"),
    setup: el("setup-screen"),
    countdown: el("countdown-screen"),
    gameover: el("gameover-screen"),
  };
  const hud = el("hud");

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name) screens[name].classList.remove("hidden");
  }

  // ---------- Game state ----------
  const state = {
    theme: localStorage.getItem("flappy-theme") || "classic",
    mode: "mouse",           // "head" | "mouse"
    running: false,
    score: 0,
    best: Number(localStorage.getItem("flappy-head-best") || 0),
    mouseY: H / 2,
    targetY: H / 2,
    neutralEyeY: null,       // eye height (0..1) considered "center"
    // How strongly head movement maps to bird movement (user setting)
    headGain: Number(localStorage.getItem("flappy-head-gain")) || 3.2,
    bird: { x: 110, y: H / 2, vy: 0, r: 16 },
    pipes: [],               // { x, gapY, gapH, w, scored }
    pipeTimer: 0,
    speed: 2.3,
    groundOffset: 0,
    padOffset: 0,
    clouds: [],              // classic clouds / climba chalk puffs
    holds: [],               // climba background climbing holds
  };

  for (let i = 0; i < 5; i++) {
    state.clouds.push({
      x: Math.random() * W,
      y: 40 + Math.random() * 200,
      s: 0.6 + Math.random() * 0.8,
    });
  }
  for (let i = 0; i < 14; i++) {
    state.holds.push({
      x: Math.random() * W,
      y: 30 + Math.random() * (H - GROUND_H - 90),
      r: 7 + Math.random() * 9,
      c: HOLD_COLORS[i % HOLD_COLORS.length],
      a: Math.random() * Math.PI,
    });
  }

  // ---------- Input ----------
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseY = ((e.clientY - rect.top) / rect.height) * H;
  });
  canvas.addEventListener("touchmove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseY = ((e.touches[0].clientY - rect.top) / rect.height) * H;
    e.preventDefault();
  }, { passive: false });

  function updateTarget() {
    if (state.mode === "head") {
      const eyeY = FaceController.getEyeY();
      if (eyeY !== null && state.neutralEyeY !== null) {
        // Head below neutral -> larger eyeY -> character descends (and vice versa)
        const offset = (eyeY - state.neutralEyeY) * state.headGain;
        state.targetY = Math.max(0, Math.min(1, 0.5 + offset)) * H;
      }
      // If the face is lost, keep the last target so the character holds position
    } else {
      state.targetY = state.mouseY;
    }
  }

  // ---------- Game logic ----------
  function resetGame() {
    state.score = 0;
    state.bird.y = H / 2;
    state.bird.vy = 0;
    state.pipes = [];
    state.pipeTimer = 0;
    state.speed = 2.3;
    el("hud-score").textContent = "0";
  }

  function spawnPipe() {
    const gapH = Math.max(150, 200 - state.score * 2); // narrows as you score
    const margin = 60;
    const gapY = margin + Math.random() * (H - GROUND_H - gapH - margin * 2);
    state.pipes.push({ x: W + 40, gapY, gapH, w: 66, scored: false });
  }

  function update(dt) {
    updateTarget();

    // Character eases toward the target with spring-damper motion
    const b = state.bird;
    const stiffness = 0.006;
    const damping = 0.88;
    b.vy += (state.targetY - b.y) * stiffness * dt;
    b.vy *= damping;
    b.y += b.vy * dt * 0.06;

    // Pipes
    state.pipeTimer += dt;
    const interval = Math.max(1100, 1600 - state.score * 10);
    if (state.pipeTimer > interval) {
      state.pipeTimer = 0;
      spawnPipe();
    }

    const px = state.speed * dt * 0.06;
    state.speed = 2.3 + Math.min(2, state.score * 0.06); // gentle ramp-up
    state.groundOffset = (state.groundOffset + px) % 24;
    state.padOffset = (state.padOffset + px) % 96;

    for (const p of state.pipes) {
      p.x -= px;
      if (!p.scored && p.x + p.w < b.x - b.r) {
        p.scored = true;
        state.score++;
        el("hud-score").textContent = state.score;
      }
    }
    state.pipes = state.pipes.filter((p) => p.x + p.w > -10);

    // Clouds / chalk puffs drift
    for (const c of state.clouds) {
      c.x -= px * 0.25 * c.s;
      if (c.x < -80) c.x = W + 60;
    }
    // Background holds drift (parallax)
    for (const h of state.holds) {
      h.x -= px * 0.35;
      if (h.x < -20) {
        h.x = W + 20;
        h.y = 30 + Math.random() * (H - GROUND_H - 90);
      }
    }

    // Collisions
    if (b.y - b.r < 0 || b.y + b.r > H - GROUND_H) return gameOver();
    for (const p of state.pipes) {
      const inX = b.x + b.r > p.x && b.x - b.r < p.x + p.w;
      if (inX && (b.y - b.r < p.gapY || b.y + b.r > p.gapY + p.gapH)) {
        return gameOver();
      }
    }
  }

  // ---------- Rendering ----------
  function draw() {
    if (state.theme === "climba") {
      drawGymWall();
      drawChalkPuffs();
      for (const p of state.pipes) {
        drawBoulder(p, true);
        drawBoulder(p, false);
      }
      drawCrashPads();
    } else {
      drawSky();
      drawClouds();
      for (const p of state.pipes) {
        drawPipe(p.x, 0, p.w, p.gapY, true);
        drawPipe(p.x, p.gapY + p.gapH, p.w, H - GROUND_H - (p.gapY + p.gapH), false);
      }
      drawGrass();
    }

    // Target height indicator (head mode)
    if (state.running && state.mode === "head") {
      ctx.strokeStyle = state.theme === "climba" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.45)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, state.targetY);
      ctx.lineTo(W, state.targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!FaceController.isFaceSeen()) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(W / 2 - 130, 70, 260, 40);
        ctx.fillStyle = "#ffd23f";
        ctx.font = "bold 18px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Face not detected!", W / 2, 96);
        ctx.textAlign = "left";
      }
    }

    drawPlayer();
  }

  // ----- Classic world -----
  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#6ec6ff");
    sky.addColorStop(1, "#b3e5fc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }

  function drawClouds() {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of state.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 34 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 22 * c.s, c.y - 8 * c.s, 22 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22 * c.s, c.y - 5 * c.s, 20 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPipe(x, y, w, h, isTop) {
    if (h <= 0) return;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#66bb6a");
    grad.addColorStop(0.5, "#43a047");
    grad.addColorStop(1, "#2e7d32");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const lipH = 24;
    const lipY = isTop ? y + h - lipH : y;
    ctx.fillStyle = "#388e3c";
    ctx.fillRect(x - 4, lipY, w + 8, lipH);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(x - 4, lipY, w + 8, lipH);
  }

  function drawGrass() {
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "#7cb342";
    ctx.fillRect(0, H - GROUND_H, W, 14);
    ctx.fillStyle = "#689f38";
    for (let x = -state.groundOffset; x < W; x += 24) {
      ctx.fillRect(x, H - GROUND_H, 12, 14);
    }
  }

  // ----- Climba world -----
  function drawGymWall() {
    ctx.fillStyle = "#ece7dd"; // plywood wall
    ctx.fillRect(0, 0, W, H);

    // Faint panel seams
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 2;
    const seamOffset = (state.padOffset * 0.5) % 120;
    for (let x = -seamOffset; x < W; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - GROUND_H);
      ctx.stroke();
    }

    // Bolted-on climbing holds (parallax background)
    for (const h of state.holds) {
      ctx.fillStyle = h.c;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, h.a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.3)"; // bolt
      ctx.beginPath();
      ctx.arc(h.x, h.y, Math.max(1.5, h.r * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawChalkPuffs() {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const c of state.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 26 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 16 * c.s, c.y - 6 * c.s, 16 * c.s, 9 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 16 * c.s, c.y - 4 * c.s, 14 * c.s, 8 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
      // chalk speckles
      ctx.fillStyle = "rgba(190,185,175,0.5)";
      ctx.fillRect(c.x + 30 * c.s, c.y + 6, 2, 2);
      ctx.fillRect(c.x - 28 * c.s, c.y + 9, 2, 2);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
    }
  }

  function drawBoulder(p, isTop) {
    const x = p.x;
    const w = p.w;
    const y = isTop ? 0 : p.gapY + p.gapH;
    const h = isTop ? p.gapY : H - GROUND_H - y;
    if (h <= 0) return;

    // Rock column
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#a89a8a");
    grad.addColorStop(0.5, "#7d7264");
    grad.addColorStop(1, "#575046");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Jagged edge facing the gap
    const edgeY = isTop ? y + h : y;
    const dir = isTop ? 1 : -1;
    ctx.fillStyle = "#4a443c";
    ctx.beginPath();
    ctx.moveTo(x - 4, edgeY);
    const teeth = 4;
    for (let i = 0; i < teeth; i++) {
      const tx = x - 4 + ((w + 8) / teeth) * i;
      ctx.lineTo(tx + (w + 8) / teeth / 2, edgeY + dir * 14);
      ctx.lineTo(tx + (w + 8) / teeth, edgeY);
    }
    ctx.lineTo(x - 4, edgeY);
    ctx.fill();

    // Cracks/speckles (deterministic per pipe, using gapY as seed)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 5; i++) {
      const sx = x + ((i * 37 + p.gapY) % (w - 10)) + 5;
      const sy = y + ((i * 97 + p.gapY * 3) % Math.max(1, h - 12)) + 6;
      ctx.fillRect(sx, sy, 5, 3);
    }

    // A brand-teal hold bolted onto the rock
    const holdY = isTop ? y + h - 40 : y + 40;
    if (h > 55) {
      ctx.fillStyle = "#35bfc4";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, holdY, 8, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(x + w / 2, holdY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrashPads() {
    ctx.fillStyle = "#33415c";
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "#4a69bd"; // top surface
    ctx.fillRect(0, H - GROUND_H, W, 14);

    // Pad seams scroll with the world
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    for (let x = -state.padOffset; x < W; x += 96) {
      ctx.fillRect(x, H - GROUND_H, 4, GROUND_H);
    }
    // Velcro flap detail
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = -state.padOffset + 30; x < W; x += 96) {
      ctx.fillRect(x, H - GROUND_H + 26, 36, 8);
    }
  }

  // ----- Characters -----
  function drawPlayer() {
    if (state.theme === "climba") drawMascot();
    else drawBird();
  }

  function drawBird() {
    const b = state.bird;
    const tilt = Math.max(-0.5, Math.min(0.5, b.vy * 0.06));

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(tilt);

    // Body
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r + 2, b.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e6a817";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wing (flaps with time)
    const flap = Math.sin(performance.now() / 90) * 5;
    ctx.fillStyle = "#ffb300";
    ctx.beginPath();
    ctx.ellipse(-4, 2 + flap * 0.4, 9, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#263238";
    ctx.beginPath();
    ctx.arc(9, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#ff7043";
    ctx.beginPath();
    ctx.moveTo(b.r - 2, -2);
    ctx.lineTo(b.r + 10, 2);
    ctx.lineTo(b.r - 2, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Vector redraw of the Climba mascot: teal blob, googly eyes,
  // halftone-dotted belly
  function drawMascot() {
    const b = state.bird;
    const tilt = Math.max(-0.4, Math.min(0.4, b.vy * 0.05));
    const bob = Math.sin(performance.now() / 220) * 1.5; // gentle idle wobble

    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.rotate(tilt);

    // Blob body
    ctx.fillStyle = "#35bfc4";
    ctx.beginPath();
    ctx.moveTo(-24, 10);
    ctx.quadraticCurveTo(-30, -12, -12, -18);
    ctx.quadraticCurveTo(8, -24, 22, -12);
    ctx.quadraticCurveTo(28, -2, 24, 10);
    ctx.quadraticCurveTo(10, 15, -2, 13);
    ctx.quadraticCurveTo(-14, 16, -24, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0f0f0f";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Halftone belly dots
    ctx.fillStyle = "rgba(15,15,15,0.75)";
    for (let i = -3; i <= 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        ctx.arc(i * 6 + (j % 2) * 3 - 1, 8 + j * 4, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Googly eyes
    const eyes = [
      { x: -8, y: -6, r: 8, pr: 3.4 },
      { x: 10, y: -3, r: 7, pr: 3.0 },
    ];
    for (const e of eyes) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f0f0f";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pupils look slightly toward where the character is heading
      const look = Math.max(-2, Math.min(2, b.vy * 0.4));
      ctx.fillStyle = "#0f0f0f";
      ctx.beginPath();
      ctx.arc(e.x + 1, e.y + look, e.pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------- Loop ----------
  let lastTime = 0;
  function loop(t) {
    if (!state.running) return;
    const dt = Math.min(40, t - lastTime || 16);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem("flappy-theme", theme);
    el("theme-classic").classList.toggle("active", theme === "classic");
    el("theme-climba").classList.toggle("active", theme === "climba");

    const title = el("menu-title");
    const subtitle = el("menu-subtitle");
    if (theme === "climba") {
      title.innerHTML =
        `<img id="menu-logo" src="assets/climba-logo.png" alt="CLIMba"` +
        ` onerror="this.outerHTML='CLIM<span>ば</span>'">`;
      subtitle.textContent = "Steer the mascot with your head — send it!";
      el("gameover-title").textContent = "You fell! (onto the pad)";
    } else {
      title.innerHTML = "Flappy <span>Head</span>";
      subtitle.textContent = "Move your head up & down to steer the bird";
      el("gameover-title").textContent = "Game Over";
    }
    draw(); // refresh the backdrop behind the menu
  }

  el("theme-classic").addEventListener("click", () => applyTheme("classic"));
  el("theme-climba").addEventListener("click", () => applyTheme("climba"));

  // ---------- Flow ----------
  async function startGame(mode) {
    state.mode = mode;
    resetGame();
    showScreen("countdown");
    el("countdown-hint").textContent =
      mode === "head"
        ? "Hold a comfortable head position — this becomes your center…"
        : "Move the mouse up and down to steer!";

    for (let n = 3; n >= 1; n--) {
      el("countdown-number").textContent = n;
      await new Promise((r) => setTimeout(r, 800));
    }

    if (mode === "head") {
      // Current head height becomes the neutral reference
      state.neutralEyeY = FaceController.getEyeY() ?? 0.5;
      el("btn-recenter").classList.remove("hidden");
    } else {
      el("btn-recenter").classList.add("hidden");
    }

    showScreen(null);
    hud.classList.remove("hidden");
    state.running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    hud.classList.add("hidden");

    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("flappy-head-best", state.best);
    }
    el("final-score").textContent = state.score;
    el("best-score").textContent = state.best;
    el("submit-status").textContent = "";
    el("btn-submit-score").disabled = false;
    showScreen("gameover");
  }

  // ---------- Leaderboard ----------
  async function loadLeaderboard() {
    const list = el("leaderboard-list");
    try {
      const res = await fetch("/api/scores");
      const scores = await res.json();
      list.innerHTML = scores.length
        ? scores.map((s) => `<li>${escapeHtml(s.name)} <strong>${s.score}</strong></li>`).join("")
        : '<li class="muted">No scores yet — be the first!</li>';
    } catch {
      list.innerHTML = '<li class="muted">Could not load scores</li>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function submitScore() {
    const btn = el("btn-submit-score");
    const status = el("submit-status");
    btn.disabled = true;
    status.textContent = "Submitting…";
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: el("player-name").value,
          score: state.score,
        }),
      });
      const data = await res.json();
      status.textContent = data.madeLeaderboard
        ? "🎉 You made the leaderboard!"
        : "Score submitted!";
      loadLeaderboard();
    } catch {
      status.textContent = "Failed to submit — is the server running?";
      btn.disabled = false;
    }
  }

  // ---------- Settings ----------
  const slider = el("sensitivity-slider");
  slider.value = state.headGain;
  el("sensitivity-value").textContent = state.headGain.toFixed(1);
  slider.addEventListener("input", () => {
    state.headGain = Number(slider.value);
    el("sensitivity-value").textContent = state.headGain.toFixed(1);
    localStorage.setItem("flappy-head-gain", state.headGain);
  });

  // ---------- Buttons ----------
  el("btn-play-mouse").addEventListener("click", () => startGame("mouse"));

  el("btn-play-head").addEventListener("click", () => {
    if (FaceController.isRunning()) {
      startGame("head");
    } else {
      showScreen("setup");
    }
  });

  el("btn-start-camera").addEventListener("click", async () => {
    const status = el("setup-status");
    const btn = el("btn-start-camera");
    btn.disabled = true;
    try {
      await FaceController.start((msg) => (status.textContent = msg));
    } catch (err) {
      status.textContent = "⚠ " + err.message;
      btn.disabled = false;
      return;
    }
    startGame("head");
    btn.disabled = false;
  });

  el("btn-setup-back").addEventListener("click", () => showScreen("menu"));

  el("btn-recenter").addEventListener("click", () => {
    const y = FaceController.getEyeY();
    if (y !== null) state.neutralEyeY = y;
  });

  el("btn-submit-score").addEventListener("click", submitScore);
  el("btn-retry").addEventListener("click", () => startGame(state.mode));
  el("btn-menu").addEventListener("click", () => {
    showScreen("menu");
    loadLeaderboard();
  });

  // End the round when the tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running) gameOver();
  });

  // ---------- Init ----------
  applyTheme(state.theme);
  loadLeaderboard();
})();
