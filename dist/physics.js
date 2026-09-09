// A deliberately forgiving gravity model. Distances are world units, time is seconds.
export const TAU = Math.PI * 2;
export const MU = 1450000;
export const MAX_PARTICLES = 2000;
export const PRESETS = {
  orbit: { name: 'ORBITAL FIELD', tip: 'Hold near the edge of an orbit. How long can you keep it together?', color: '#d5f990' },
  binary: { name: 'BINARY STAR SYSTEM', tip: 'Try pulling a stream from one star to the other. Then let gravity take over.', color: '#afcbfa' },
  vortex: { name: 'VORTEX FIELD', tip: 'Switch to Repel and hold in the center to push back against the spiral.', color: '#c1adee' },
  supernova: { name: 'SUPERNOVA FIELD', tip: 'Slow time down, then launch a cluster across the expanding cloud.', color: '#ffbf88' },
};

export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export class Universe {
  constructor({ width = 1000, height = 800, count = 900, seed = 412 } = {}) {
    this.width = width;
    this.height = height;
    this.random = randomGenerator(seed);
    this.gravity = 1;
    this.time = 0;
    this.particles = [];
    this.wells = [];
    this.setPreset('orbit', count);
  }
  get radius() { return Math.min(this.width, this.height) * 0.37; }
  resize(width, height) {
    const oldRadius = this.radius;
    this.width = width;
    this.height = height;
    const ratio = this.radius / oldRadius;
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    for (const p of this.particles) {
      p.x *= ratio; p.y *= ratio; p.px = p.x; p.py = p.y;
      p.vx /= Math.sqrt(ratio); p.vy /= Math.sqrt(ratio);
    }
    this.updateWells();
  }
  setPreset(preset, count = this.particles.length) {
    if (!PRESETS[preset]) throw new Error('Unknown universe preset');
    this.preset = preset;
    this.time = 0;
    this.particles = [];
    this.updateWells();
    this.setCount(count);
  }
  updateWells() {
    if (this.preset === 'binary') {
      const angle = this.time * 0.07;
      const distance = this.radius * 0.42;
      this.wells = [
        { x: Math.cos(angle) * -distance, y: Math.sin(angle) * -distance, mass: 0.58, color: '#ffe2ad' },
        { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, mass: 0.58, color: '#a4c6ff' },
      ];
    } else {
      this.wells = [{ x: 0, y: 0, mass: this.preset === 'supernova' ? 0.1 : 1, color: this.preset === 'vortex' ? '#cebcff' : '#e2fbc0' }];
    }
  }
  createParticle() {
    const random = this.random;
    const theta = random() * TAU;
    let radius = this.radius * (0.32 + Math.pow(random(), 0.65) * 0.88);
    let center = { x: 0, y: 0, mass: 1 };
    if (this.preset === 'binary') {
      if (random() < 0.73) {
        center = this.wells[random() < 0.5 ? 0 : 1];
        radius *= 0.42;
      }
    }
    let speed = Math.sqrt(MU * center.mass * this.gravity / radius);
    let x = center.x + Math.cos(theta) * radius;
    let y = center.y + Math.sin(theta) * radius * 0.78;
    let vx = -Math.sin(theta) * speed;
    let vy = Math.cos(theta) * speed * 0.89;
    if (this.preset === 'vortex') {
      speed *= 0.83;
      vx = -Math.sin(theta) * speed - Math.cos(theta) * 12;
      vy = Math.cos(theta) * speed - Math.sin(theta) * 12;
    }
    if (this.preset === 'supernova') {
      radius = this.radius * (0.03 + random() * 0.37);
      x = Math.cos(theta) * radius;
      y = Math.sin(theta) * radius;
      speed = 35 + random() * 78;
      vx = Math.cos(theta) * speed;
      vy = Math.sin(theta) * speed;
    }
    return { x, y, px: x, py: y, vx, vy, color: Math.floor(random() * 5), size: 0.4 + random() * 1.05, age: 0 };
  }
  setCount(count) {
    const target = Math.max(0, Math.min(MAX_PARTICLES, Math.round(count)));
    this.particles.length = Math.min(this.particles.length, target);
    while (this.particles.length < target) this.particles.push(this.createParticle());
  }
  launch(x, y, vx, vy, count = 64) {
    if (![x, y, vx, vy, count].every(Number.isFinite)) return;
    count = Math.max(0, Math.min(MAX_PARTICLES, Math.round(count)));
    if (this.particles.length + count > MAX_PARTICLES) this.particles.splice(0, this.particles.length + count - MAX_PARTICLES);
    for (let i = 0; i < count; i++) {
      const p = this.createParticle();
      p.x = x + (this.random() - 0.5) * 12;
      p.y = y + (this.random() - 0.5) * 12;
      p.px = p.x; p.py = p.y;
      p.vx = Math.max(-450, Math.min(450, vx)) + (this.random() - 0.5) * 18;
      p.vy = Math.max(-450, Math.min(450, vy)) + (this.random() - 0.5) * 18;
      this.particles.push(p);
    }
  }
  step(elapsed, pointer = null) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return;
    const dt = Math.min(elapsed, 1 / 20);
    this.time += dt;
    this.updateWells();
    const softening = 22 * 22;
    for (const p of this.particles) {
      p.px = p.x; p.py = p.y;
      let ax = 0, ay = 0;
      for (const well of this.wells) {
        const dx = well.x - p.x, dy = well.y - p.y;
        const d2 = dx * dx + dy * dy + softening;
        const factor = MU * well.mass * this.gravity / (d2 * Math.sqrt(d2));
        ax += dx * factor; ay += dy * factor;
      }
      if (pointer?.active && (pointer.mode === 'attract' || pointer.mode === 'repel')) {
        const dx = pointer.x - p.x, dy = pointer.y - p.y;
        const d2 = dx * dx + dy * dy + 1200;
        const factor = MU * 2.7 * (pointer.mode === 'repel' ? -1 : 1) / (d2 * Math.sqrt(d2));
        ax += dx * factor; ay += dy * factor;
      }
      p.vx += ax * dt; p.vy += ay * dt;
      if (this.preset === 'vortex') {
        const damping = Math.exp(-0.035 * dt);
        p.vx *= damping; p.vy *= damping;
      }
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 650) { p.vx *= 650 / speed; p.vy *= 650 / speed; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
      // Recycling out-of-view stars keeps every preset playable indefinitely.
      if (!Number.isFinite(p.x + p.y + p.vx + p.vy) || Math.abs(p.x) > this.width * 0.82 || Math.abs(p.y) > this.height * 0.82 || (this.preset === 'vortex' && Math.hypot(p.x, p.y) < 12)) {
        Object.assign(p, this.createParticle());
      }
    }
  }
}
