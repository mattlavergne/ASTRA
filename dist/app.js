import { Universe, PRESETS, TAU, randomGenerator } from './physics.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#space');
const ctx = canvas.getContext('2d', { alpha: false });
const field = $('#universe');
const trailCanvas = document.createElement('canvas');
const trail = trailCanvas.getContext('2d');
const background = document.createElement('canvas');
const bg = background.getContext('2d');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const sim = new Universe();
let width = 1, height = 1, dpr = 1, scale = 1;
let paused = motionQuery.matches;
let timeSpeed = 1;
let tool = 'attract';
let pointer = { x: 0, y: 0, active: false, visible: false, mode: tool, keyboard: false };
let dragStart = null;
let activePointerId = null;
let nodes = [];
let soundEnabled = false;
let audioContext = null;
let lastSoundTime = 0;
let toastTimeout;
let previousTime = 0;
let frames = 0, fpsStart = 0;
let helpReturnFocus = null;
const colors = {
  orbit: ['#d5f990', '#bed295', '#f8ebc1', '#b6c6b0', '#769574'],
  binary: ['#bcd6ff', '#8daedf', '#ffe0ad', '#f2e9d8', '#879dbe'],
  vortex: ['#d6baff', '#b795e7', '#edddff', '#aec8e7', '#8a87bb'],
  supernova: ['#ffc38d', '#eb9969', '#ffdfad', '#efd3d7', '#b79ad8'],
};
const instructions = {
  attract: 'Press and hold anywhere to pull the stars.',
  repel: 'Press and hold to push the stars away.',
  launch: 'Drag back and release to launch a cluster.',
  connect: 'Tap to place stars. Build a constellation.',
};

function announce(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2200);
}
function toScreen(x, y) { return { x: width / 2 + x * scale, y: height * 0.46 + y * scale }; }
function toWorld(x, y) { return { x: (x - width / 2) / scale, y: (y - height * 0.46) / scale }; }
function eventPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return toWorld(event.clientX - bounds.left, event.clientY - bounds.top);
}
function clearTrails() { trail.clearRect(0, 0, width, height); }
function buildBackground() {
  bg.setTransform(dpr, 0, 0, dpr, 0, 0);
  bg.fillStyle = '#090f0c'; bg.fillRect(0, 0, width, height);
  const glow = bg.createRadialGradient(width * 0.5, height * 0.43, 0, width * 0.5, height * 0.43, Math.max(width, height) * 0.64);
  glow.addColorStop(0, sim.preset === 'vortex' ? '#191621' : sim.preset === 'binary' ? '#111c23' : sim.preset === 'supernova' ? '#211a13' : '#1b2815');
  glow.addColorStop(0.52, '#101910'); glow.addColorStop(1, '#090f0c');
  bg.fillStyle = glow; bg.fillRect(0, 0, width, height);
  bg.strokeStyle = '#abc99208'; bg.lineWidth = 0.5;
  bg.beginPath();
  for (let x = width / 2 % 60; x < width; x += 60) { bg.moveTo(x, 0); bg.lineTo(x, height); }
  for (let y = height * 0.46 % 60; y < height; y += 60) { bg.moveTo(0, y); bg.lineTo(width, y); }
  bg.stroke();
  const random = randomGenerator(731);
  for (let i = 0; i < 170; i++) {
    const x = random() * width, y = random() * height, size = random() > 0.91 ? 1.1 : 0.55;
    bg.fillStyle = `rgba(195,218,174,${0.1 + random() * 0.3})`;
    bg.fillRect(x, y, size, size);
    if (size > 1) { bg.fillStyle = '#c0d9a91c'; bg.fillRect(x - 2, y + 0.3, 5, 0.6); bg.fillRect(x + 0.3, y - 2, 0.6, 5); }
  }
  // Reference rings are deliberately faint, allowing the particle trails to lead.
  const center = toScreen(0, 0);
  bg.strokeStyle = '#b2cc8a0c'; bg.lineWidth = 0.7;
  for (const factor of [0.48, 0.8, 1.14, 1.48]) {
    bg.beginPath(); bg.arc(center.x, center.y, sim.radius * scale * factor, 0, TAU); bg.stroke();
  }
  bg.strokeStyle = '#93ad762b'; bg.lineWidth = 1;
  for (const [x, y] of [[19, 19], [width - 19, 19], [19, height - 19], [width - 19, height - 19]]) {
    bg.beginPath(); bg.moveTo(x - 3, y); bg.lineTo(x + 3, y); bg.moveTo(x, y - 3); bg.lineTo(x, y + 3); bg.stroke();
  }
}
function resize() {
  const rect = field.getBoundingClientRect();
  const oldScale = scale;
  width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  dpr = Math.min(devicePixelRatio || 1, 2);
  scale = Math.min(width / 850, height / 800);
  const oldRadius = sim.radius;
  sim.resize(width / scale, height / scale);
  const ratio = sim.radius / oldRadius;
  nodes = nodes.map(n => ({ ...n, x: n.x * ratio, y: n.y * ratio }));
  pointer.active = false; dragStart = null; activePointerId = null;
  if (oldScale > 0) { pointer.x *= ratio; pointer.y *= ratio; }
  for (const layer of [canvas, trailCanvas, background]) { layer.width = Math.round(width * dpr); layer.height = Math.round(height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  trail.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildBackground();
  // Pre-draw short trajectories so even a paused first visit has a visible field.
  drawParticles(1, true);
  render(0);
}
function drawParticles(dt, seed = false) {
  trail.globalCompositeOperation = 'destination-out';
  trail.fillStyle = `rgba(0,0,0,${seed ? 1 : 1 - Math.exp(-dt * 1.65)})`;
  trail.fillRect(0, 0, width, height);
  trail.globalCompositeOperation = 'lighter';
  const palette = colors[sim.preset];
  for (let index = 0; index < palette.length; index++) {
    trail.strokeStyle = palette[index];
    trail.globalAlpha = index === 4 ? 0.32 : 0.65;
    trail.lineWidth = Math.max(0.55, scale * 0.8);
    trail.beginPath();
    for (const p of sim.particles) {
      if (p.color !== index) continue;
      const end = toScreen(p.x, p.y);
      const start = seed ? toScreen(p.x - p.vx * 0.055, p.y - p.vy * 0.055) : toScreen(p.px, p.py);
      trail.moveTo(start.x, start.y); trail.lineTo(end.x, end.y);
    }
    trail.stroke();
  }
  trail.globalAlpha = 1;
  trail.globalCompositeOperation = 'source-over';
}
function render(dt) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(background, 0, 0, width, height);
  ctx.drawImage(trailCanvas, 0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  const palette = colors[sim.preset];
  for (let index = 0; index < palette.length; index++) {
    ctx.fillStyle = palette[index]; ctx.globalAlpha = index === 4 ? 0.48 : 0.87;
    ctx.beginPath();
    for (const p of sim.particles) {
      if (p.color !== index) continue;
      const point = toScreen(p.x, p.y);
      const radius = Math.max(0.45, p.size * scale * 0.78);
      ctx.moveTo(point.x + radius, point.y); ctx.arc(point.x, point.y, radius, 0, TAU);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const well of sim.wells) {
    const point = toScreen(well.x, well.y);
    const glowSize = Math.max(25, 58 * scale);
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowSize);
    glow.addColorStop(0, `${well.color}9a`); glow.addColorStop(0.075, `${well.color}58`); glow.addColorStop(0.25, `${well.color}15`); glow.addColorStop(1, `${well.color}00`);
    ctx.fillStyle = glow; ctx.fillRect(point.x - glowSize, point.y - glowSize, glowSize * 2, glowSize * 2);
    ctx.strokeStyle = `${well.color}1a`; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(point.x, point.y, 12 * scale, 0, TAU); ctx.stroke();
    ctx.fillStyle = well.color; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1.7, 2.7 * scale), 0, TAU); ctx.fill();
    ctx.strokeStyle = `${well.color}66`; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(point.x - 10 * scale, point.y); ctx.lineTo(point.x + 10 * scale, point.y); ctx.moveTo(point.x, point.y - 10 * scale); ctx.lineTo(point.x, point.y + 10 * scale); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (nodes.length) {
    ctx.strokeStyle = '#d7edb394'; ctx.lineWidth = 1;
    ctx.beginPath();
    nodes.forEach((node, i) => { const point = toScreen(node.x, node.y); i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y); });
    ctx.stroke();
    nodes.forEach((node, i) => {
      const point = toScreen(node.x, node.y);
      ctx.fillStyle = '#deffb8'; ctx.shadowColor = '#ceff91'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(point.x, point.y, 2.6, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d5f99055'; ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, TAU); ctx.stroke();
      ctx.font = '12px monospace'; ctx.fillStyle = '#c2d9a7'; ctx.fillText(String(i + 1).padStart(2, '0'), point.x + 11, point.y - 8);
    });
  }
  if (pointer.visible || pointer.keyboard) {
    const point = toScreen(pointer.x, pointer.y);
    const radius = pointer.active && tool !== 'launch' ? 22 : 12;
    ctx.strokeStyle = tool === 'repel' ? '#ffd1acaa' : '#d5f990aa'; ctx.lineWidth = 1;
    ctx.setLineDash(pointer.active ? [] : [2, 4]);
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(point.x - 4, point.y); ctx.lineTo(point.x + 4, point.y); ctx.moveTo(point.x, point.y - 4); ctx.lineTo(point.x, point.y + 4); ctx.stroke();
    if (pointer.active) { ctx.strokeStyle = '#d5f99025'; ctx.beginPath(); ctx.arc(point.x, point.y, 40, 0, TAU); ctx.stroke(); }
    if (dragStart && tool === 'launch') {
      const start = toScreen(dragStart.x, dragStart.y);
      ctx.strokeStyle = '#d5f990b0'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(start.x, start.y); ctx.lineTo(start.x + (start.x - point.x) * 0.65, start.y + (start.y - point.y) * 0.65); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0ffae'; ctx.beginPath(); ctx.arc(start.x, start.y, 4, 0, TAU); ctx.fill();
    }
    if (tool === 'connect' && nodes.length) {
      const last = toScreen(nodes.at(-1).x, nodes.at(-1).y);
      ctx.strokeStyle = '#d5f99055'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(point.x, point.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  const shade = ctx.createLinearGradient(0, height - 165, 0, height);
  shade.addColorStop(0, '#090f0c00'); shade.addColorStop(1, '#090f0ca6');
  ctx.fillStyle = shade; ctx.fillRect(0, height - 165, width, 165);
}
function frame(timestamp) {
  const dt = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.05) : 1 / 60;
  previousTime = timestamp;
  if (!document.hidden && !$('#help-dialog').open) {
    if (!paused) {
      // Substeps keep the force integration stable at high speed and low frame rates.
      const steps = Math.max(1, Math.ceil(dt * timeSpeed / (1 / 100)));
      for (let i = 0; i < steps; i++) {
        sim.step(dt * timeSpeed / steps, pointer);
        drawParticles(dt / steps);
      }
    }
    render(dt);
    frames++;
    if (timestamp - fpsStart > 650) {
      const fps = Math.round(frames * 1000 / Math.max(1, timestamp - fpsStart));
      $('#fps').textContent = paused ? 'PAUSED' : `${fps} FPS`;
      frames = 0; fpsStart = timestamp;
    }
  }
  requestAnimationFrame(frame);
}
function syncCount() {
  $('#particle-count').textContent = sim.particles.length.toLocaleString();
  $('#particles-value').textContent = sim.particles.length.toLocaleString();
  const input = $('#particles');
  input.value = sim.particles.length;
  input.style.setProperty('--fill', `${(sim.particles.length - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
}
function note(index = 0, duration = 0.7) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  if (now - lastSoundTime < 0.055) return;
  lastSoundTime = now;
  const frequencies = [174.61, 220, 261.63, 349.23, 392, 440, 523.25, 698.46];
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine'; oscillator.frequency.value = frequencies[index % frequencies.length];
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.09, now + 0.025); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(now); oscillator.stop(now + duration + 0.03);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function setTool(next) {
  tool = next; pointer.mode = next; pointer.active = false; dragStart = null;
  document.querySelectorAll('[data-tool]').forEach(button => { const selected = button.dataset.tool === tool; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('#tool-instruction').textContent = instructions[tool];
  $('#undo-button').hidden = tool !== 'connect' || !nodes.length;
}
function setPreset(preset, notify = true) {
  sim.setPreset(preset, Number($('#particles').value));
  nodes = []; pointer.active = false; dragStart = null;
  $('#undo-button').hidden = true;
  document.querySelectorAll('[data-preset]').forEach((button, index) => {
    const selected = button.dataset.preset === preset;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    if (selected) $('.preset-section .section-heading>span').textContent = `0${index + 1} / 04`;
  });
  $('#field-name').textContent = PRESETS[preset].name;
  $('#experiment-tip').textContent = PRESETS[preset].tip;
  syncCount(); clearTrails(); buildBackground(); drawParticles(1, true); render(0);
  if (notify) { note(Object.keys(PRESETS).indexOf(preset) + 2); announce('Universe changed. Try a different tool.'); }
}
function setPaused(value, notify = true) {
  paused = value;
  field.classList.toggle('paused', paused);
  $('#field-state').textContent = paused ? 'PAUSED' : 'RUNNING';
  $('#pause-button use').setAttribute('href', paused ? '#i-play' : '#i-pause');
  $('#pause-button span').textContent = paused ? 'Play' : 'Pause';
  $('#pause-button').setAttribute('aria-label', paused ? 'Play simulation' : 'Pause simulation');
  $('#pause-button').title = paused ? 'Play (Space)' : 'Pause (Space)';
  $('#fps').textContent = paused ? 'PAUSED' : 'LIVE';
  pointer.active = false;
  if (notify) announce(paused ? 'Time paused. Take a look around.' : 'Time is moving again.');
}
function addNode(x, y) {
  if (nodes.length >= 80) { announce('80 stars connected. Undo a star or reset to start again.'); return; }
  nodes.push({ x, y });
  $('#undo-button').hidden = false;
  note(nodes.length + 1);
  if (nodes.length === 1) announce('Your first star. Tap again to connect it.');
  else if (nodes.length === 5) announce('A constellation of your own.');
}
function launchCluster(start, velocity) {
  sim.launch(start.x, start.y, velocity.x, velocity.y, 100);
  syncCount(); note(5); announce('100 new stars launched.');
  if (paused) { drawParticles(1, true); render(0); }
}

document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.preset)));
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
for (const id of ['gravity', 'speed', 'particles']) {
  const input = $(`#${id}`);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    input.style.setProperty('--fill', `${(value - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
    if (id === 'gravity') { sim.gravity = value; $('#gravity-value').textContent = `${value.toFixed(1)}×`; }
    if (id === 'speed') { timeSpeed = value; $('#speed-value').textContent = `${value.toFixed(1)}×`; }
    if (id === 'particles') { sim.setCount(value); syncCount(); if (paused) { clearTrails(); drawParticles(1, true); } }
  });
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || activePointerId !== null) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
  Object.assign(pointer, eventPosition(event), { active: true, visible: true, keyboard: false });
  if (tool === 'connect') { addNode(pointer.x, pointer.y); pointer.active = false; }
  else if (tool === 'launch') dragStart = { x: pointer.x, y: pointer.y };
  else note(tool === 'repel' ? 2 : 0);
});
canvas.addEventListener('pointermove', event => {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  Object.assign(pointer, eventPosition(event), { visible: true, keyboard: false });
});
function endPointer(event, canceled = false) {
  if (event.pointerId !== activePointerId) return;
  if (tool === 'launch' && dragStart && !canceled) {
    const end = eventPosition(event);
    const vx = (dragStart.x - end.x) * 1.2, vy = (dragStart.y - end.y) * 1.2;
    launchCluster(dragStart, Math.hypot(vx, vy) < 8 ? { x: 130, y: -80 } : { x: vx, y: vy });
  }
  pointer.active = false; dragStart = null; activePointerId = null;
  if (event.pointerType === 'touch') pointer.visible = false;
}
canvas.addEventListener('pointerup', event => endPointer(event));
canvas.addEventListener('pointercancel', event => endPointer(event, true));
canvas.addEventListener('lostpointercapture', event => endPointer(event, true));
canvas.addEventListener('pointerleave', () => { if (activePointerId === null) pointer.visible = false; });
canvas.addEventListener('blur', () => { pointer.active = false; pointer.keyboard = false; pointer.visible = false; dragStart = null; });
window.addEventListener('blur', () => { pointer.active = false; dragStart = null; activePointerId = null; });
document.addEventListener('visibilitychange', () => { previousTime = 0; pointer.active = false; });
$('#pause-button').addEventListener('click', () => setPaused(!paused));
$('#reset-button').addEventListener('click', () => { setPreset(sim.preset, false); announce('A fresh universe. Same rules.'); note(3); });
$('#undo-button').addEventListener('click', () => { nodes.pop(); $('#undo-button').hidden = !nodes.length; announce('Last star removed.'); });
$('#sound-button').addEventListener('click', async () => {
  try {
    const AudioConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioConstructor) { announce('Sound is not supported in this browser.'); return; }
    audioContext ??= new AudioConstructor();
    soundEnabled = !soundEnabled;
    if (soundEnabled) { await audioContext.resume(); note(3); }
    else await audioContext.suspend();
    $('#sound-button').setAttribute('aria-pressed', String(soundEnabled));
    $('#sound-button use').setAttribute('href', soundEnabled ? '#i-sound' : '#i-muted');
    $('#sound-button span').textContent = soundEnabled ? 'Sound on' : 'Sound off';
    announce(soundEnabled ? 'Sound on. Your interactions make music.' : 'Sound off.');
  } catch { soundEnabled = false; announce('Audio could not start. Try the sound button again.'); }
});
$('#expand-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (field.requestFullscreen) await field.requestFullscreen();
    else announce('Full screen is unavailable in this browser.');
  } catch { announce('Full screen is unavailable in this browser.'); }
});
document.addEventListener('fullscreenchange', () => { $('#expand-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'); });
function openHelp() {
  const dialog = $('#help-dialog');
  if (dialog.open) return;
  helpReturnFocus = document.activeElement;
  pointer.active = false;
  dialog.showModal();
}
function closeHelp() { $('#help-dialog').close(); }
$('#help-button').addEventListener('click', openHelp);
$('#close-help').addEventListener('click', closeHelp);
$('#start-playing').addEventListener('click', closeHelp);
$('#help-dialog').addEventListener('close', () => { previousTime = 0; helpReturnFocus?.focus({ preventScroll: true }); });
$('#help-dialog').addEventListener('click', event => {
  if (event.target !== $('#help-dialog')) return;
  const r = event.target.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeHelp();
});
document.addEventListener('keydown', event => {
  if ($('#help-dialog').open || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (['1', '2', '3', '4'].includes(key)) { setTool(['attract', 'repel', 'launch', 'connect'][Number(key) - 1]); announce(`${key === '4' ? 'Connect' : tool[0].toUpperCase() + tool.slice(1)} tool selected.`); }
  if (key === 'h') { event.preventDefault(); openHelp(); }
  if (key === 'r' && !event.repeat) { setPreset(sim.preset, false); announce('Universe reset.'); }
  if (key === ' ' && !/BUTTON|A/.test(event.target.tagName)) { event.preventDefault(); if (!event.repeat) setPaused(!paused); }
  if (key === 'escape') { pointer.active = false; dragStart = null; }
  if (event.target !== canvas) return;
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
    event.preventDefault(); pointer.keyboard = true; pointer.visible = true;
    const distance = (event.shiftKey ? 35 : 14) / scale;
    if (key === 'arrowleft') pointer.x -= distance;
    if (key === 'arrowright') pointer.x += distance;
    if (key === 'arrowup') pointer.y -= distance;
    if (key === 'arrowdown') pointer.y += distance;
    pointer.x = Math.max(-width / scale / 2 + 20, Math.min(width / scale / 2 - 20, pointer.x));
    pointer.y = Math.max(-height * 0.46 / scale + 60, Math.min(height * 0.54 / scale - 190, pointer.y));
  }
  if (key === 'enter' && !event.repeat) {
    event.preventDefault(); pointer.keyboard = true; pointer.visible = true;
    if (tool === 'connect') addNode(pointer.x, pointer.y);
    else if (tool === 'launch') launchCluster(pointer, { x: 130, y: -80 });
    else { pointer.active = !pointer.active; announce(pointer.active ? `${tool === 'attract' ? 'Attraction' : 'Repulsion'} on. Press Enter to release.` : 'Gravity tool released.'); note(2); }
  }
});
motionQuery.addEventListener('change', event => { if (event.matches) setPaused(true); });
new ResizeObserver(resize).observe(field);
setPaused(paused, false);
requestAnimationFrame(frame);
