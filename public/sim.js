/**
 * GameSim — the rules of Flappy Head.
 *
 * Callers pass a target height each tick and get back { died, points, px }.
 * Drawing, HUD, and camera stay outside this module.
 */
(function (root) {
  const W = 480;
  const H = 640;
  const GROUND_H = 70;

  function create() {
    return {
      bird: { x: 110, y: H / 2, vy: 0, r: 16 },
      pipes: [],
      pipeTimer: 0,
      speed: 2.3,
      score: 0,
      groundOffset: 0,
      padOffset: 0,
    };
  }

  function reset(world) {
    world.bird.y = H / 2;
    world.bird.vy = 0;
    world.pipes = [];
    world.pipeTimer = 0;
    world.speed = 2.3;
    world.score = 0;
    world.groundOffset = 0;
    world.padOffset = 0;
  }

  function spawnPipe(world, rng) {
    const random = rng || Math.random;
    const gapH = Math.max(150, 200 - world.score * 2);
    const margin = 60;
    const gapY = margin + random() * (H - GROUND_H - gapH - margin * 2);
    world.pipes.push({ x: W + 40, gapY, gapH, w: 66, scored: false });
  }

  /**
   * Advance one frame.
   * @param {object} world
   * @param {number} dt milliseconds, already capped by the caller
   * @param {number} targetY canvas Y the bird should ease toward
   * @param {function} [rng] optional, for tests
   * @returns {{ died: boolean, points: number, px: number }}
   */
  function update(world, dt, targetY, rng) {
    const b = world.bird;
    const stiffness = 0.006;
    const damping = 0.88;
    b.vy += (targetY - b.y) * stiffness * dt;
    b.vy *= damping;
    b.y += b.vy * dt * 0.06;

    world.pipeTimer += dt;
    const interval = Math.max(1100, 1600 - world.score * 10);
    if (world.pipeTimer > interval) {
      world.pipeTimer = 0;
      spawnPipe(world, rng);
    }

    const px = world.speed * dt * 0.06;
    world.speed = 2.3 + Math.min(2, world.score * 0.06);
    world.groundOffset = (world.groundOffset + px) % 24;
    world.padOffset = (world.padOffset + px) % 96;

    let points = 0;
    for (const p of world.pipes) {
      p.x -= px;
      if (!p.scored && p.x + p.w < b.x - b.r) {
        p.scored = true;
        world.score++;
        points++;
      }
    }
    world.pipes = world.pipes.filter((p) => p.x + p.w > -10);

    const hitGround = b.y - b.r < 0 || b.y + b.r > H - GROUND_H;
    let hitPipe = false;
    if (!hitGround) {
      for (const p of world.pipes) {
        const inX = b.x + b.r > p.x && b.x - b.r < p.x + p.w;
        if (inX && (b.y - b.r < p.gapY || b.y + b.r > p.gapY + p.gapH)) {
          hitPipe = true;
          break;
        }
      }
    }

    return { died: hitGround || hitPipe, points, px };
  }

  const GameSim = { W, H, GROUND_H, create, reset, update };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GameSim;
  } else {
    root.GameSim = GameSim;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
