const GameSim = require("./public/sim.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// Ceiling
{
  const world = GameSim.create();
  world.bird.y = 0;
  assert(GameSim.update(world, 16, 0).died, "dies on ceiling");
}

// Ground
{
  const world = GameSim.create();
  world.bird.y = GameSim.H - GameSim.GROUND_H;
  assert(GameSim.update(world, 16, world.bird.y).died, "dies on ground");
}

// Pipe overlap
{
  const world = GameSim.create();
  world.bird.y = 100;
  world.pipes.push({ x: 100, gapY: 400, gapH: 150, w: 66, scored: false });
  assert(GameSim.update(world, 16, 100).died, "dies on pipe");
}

// Scoring when a pipe has fully passed
{
  const world = GameSim.create();
  world.pipes.push({ x: 10, gapY: 200, gapH: 220, w: 66, scored: false });
  const result = GameSim.update(world, 16, GameSim.H / 2);
  assert(!result.died, "gap is clear at start height");
  assert(result.points === 1 && world.score === 1, "scores when pipe passes");
}

// Reset clears score and pipes
{
  const world = GameSim.create();
  world.score = 9;
  world.pipes.push({ x: 200, gapY: 200, gapH: 180, w: 66, scored: true });
  GameSim.reset(world);
  assert(world.score === 0 && world.pipes.length === 0, "reset clears world");
}

console.log("GameSim tests passed");
