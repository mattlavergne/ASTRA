import test from 'node:test';
import assert from 'node:assert/strict';
import { Universe, MAX_PARTICLES, PRESETS } from '../dist/physics.js';

test('all presets remain finite and populated during prolonged interaction', () => {
  for (const preset of Object.keys(PRESETS)) {
    const sim = new Universe({ count: 120, seed: 7 });
    sim.setPreset(preset);
    sim.gravity = 2.5;
    for (let frame = 0; frame < 2400; frame++) {
      sim.step(1 / 60, {
        x: Math.cos(frame / 130) * 180,
        y: Math.sin(frame / 130) * 180,
        active: frame % 180 < 100,
        mode: frame % 360 < 180 ? 'attract' : 'repel',
      });
    }
    assert.equal(sim.particles.length, 120, preset);
    for (const p of sim.particles) {
      assert.ok([p.x, p.y, p.vx, p.vy].every(Number.isFinite), preset);
      assert.ok(Math.hypot(p.vx, p.vy) <= 650.00001, preset);
    }
  }
});

test('attract and repel accelerate a resting particle in opposite directions', () => {
  function velocity(mode) {
    const sim = new Universe({ count: 1 });
    sim.gravity = 0;
    Object.assign(sim.particles[0], { x: 0, y: 0, vx: 0, vy: 0 });
    sim.step(1 / 60, { x: 100, y: 0, active: true, mode });
    return sim.particles[0].vx;
  }
  assert.ok(velocity('attract') > 0);
  assert.ok(velocity('repel') < 0);
  assert.ok(Math.abs(velocity('attract') + velocity('repel')) < 1e-9);
});

test('launching preserves the particle limit and rejects invalid coordinates', () => {
  const sim = new Universe({ count: MAX_PARTICLES - 10 });
  sim.launch(100, -20, 200, -100, 64);
  assert.equal(sim.particles.length, MAX_PARTICLES);
  assert.ok(sim.particles.slice(-64).every(p => p.vx > 180 && p.vy < -80));
  const before = structuredClone(sim.particles);
  sim.launch(NaN, 0, 0, 0);
  assert.deepEqual(sim.particles, before);
});

test('zero elapsed time freezes the universe and resize preserves finite trajectories', () => {
  const sim = new Universe({ count: 60 });
  const before = structuredClone(sim.particles);
  sim.step(0);
  assert.deepEqual(sim.particles, before);
  for (const [width, height] of [[360, 800], [1800, 800], [740, 1200]]) {
    sim.resize(width, height);
    sim.step(1 / 60);
    assert.equal(sim.particles.length, 60);
    assert.ok(sim.particles.every(p => [p.x, p.y, p.vx, p.vy].every(Number.isFinite)));
  }
});
