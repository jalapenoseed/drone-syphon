const C = document.getElementById('c');
const X = C.getContext('2d');
X.imageSmoothingEnabled = false;

const PAL = {
  void: '#0d1210', shadow: '#1c2420', sage: '#3d4a3a', dust: '#8a7b58',
  bone: '#c4b48a', moss: '#6b8f6a', lime: '#d4e07a', rust: '#e07a4a'
};

const keys = Object.create(null);
const hold = { L: false, R: false, J: false, F: false, E: false };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if ([' ','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
const bind = (id, k) => {
  const el = document.getElementById(id);
  const on = e => { e.preventDefault(); hold[k] = true; el.classList.add('on'); };
  const off = e => { e.preventDefault(); hold[k] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
};
bind('bL', 'L'); bind('bR', 'R'); bind('bJ', 'J'); bind('bF', 'F'); bind('bE', 'E');

const roadY = x => 210 + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.003) * 4;
const panel = { x: 420, y: 0, w: 28, h: 22, pool: 40 };
const gateX = 720;
const crate = { x: 210, y: 0 };

const s = {
  mode: 'bike',
  x: 40, y: 200, vx: 0, vy: 0, grounded: true,
  pack: 27, trailer: 8, stamina: 100,
  dx: 40, dy: 180, dvx: 0, dvy: 0, dbat: 100, tether: 42,
  face: 1, msgT: 6, won: false, launched: false
};
panel.y = roadY(panel.x) - 28;
crate.y = roadY(crate.x) - 16;

let last = performance.now();
let fLatch = false;

function left() { return keys['a'] || keys['arrowleft'] || hold.L; }
function right() { return keys['d'] || keys['arrowright'] || hold.R; }
function hop() { return keys[' '] || hold.J; }
function launch() { return keys['f'] || hold.F; }
function use() { return keys['e'] || hold.E; }

function msg(t) {
  s.msgT = 5;
  document.getElementById('msg').textContent = t;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  draw();
  requestAnimationFrame(loop);
}

function step(dt) {
  const ax = (right() ? 1 : 0) - (left() ? 1 : 0);
  if (ax) s.face = ax;

  if (s.mode === 'bike') {
    const human = s.pack <= 0.5;
    const acc = human ? 2.2 : 7;
    s.vx += ax * acc * dt;
    if (!ax) s.vx *= Math.max(0, 1 - 3.2 * dt);
    const cap = human ? 5 : 18;
    s.vx = Math.max(-cap, Math.min(cap, s.vx));
    if (hop() && s.grounded) { s.vy = -7.2; s.grounded = false; }
    s.vy += 22 * dt;
    s.x += s.vx * dt * 18;
    s.y += s.vy * dt * 18;
    const g = roadY(s.x) - 14;
    if (s.y >= g) { s.y = g; s.vy = 0; s.grounded = true; }
    else s.grounded = false;
    if (s.x < 8) { s.x = 8; s.vx = 0; }
    if (s.x > gateX - 10 && s.trailer < 18) { s.x = gateX - 10; s.vx = 0; msg('Gate cold. Syphon the panel.'); }
    if (!human && Math.abs(s.vx) > 0.4) s.pack = Math.max(0, s.pack - (0.55 * Math.abs(s.vx) + (ax ? 1.8 : 0.2)) * dt);
    if (human && ax) s.stamina = Math.max(0, s.stamina - 12 * dt);
    else s.stamina = Math.min(100, s.stamina + 8 * dt);
    if (s.grounded && !ax && s.trailer > 0 && s.pack < 27) {
      const n = Math.min(s.trailer, 12 * dt, 27 - s.pack);
      s.trailer -= n; s.pack += n;
    }
    if (launch() && !fLatch && s.pack > 1) {
      s.mode = 'drone';
      s.launched = true;
      s.dx = s.x + 6; s.dy = s.y - 18;
      s.dvx = s.vx * 8; s.dvy = -20;
      msg('Quad up. Hold E on the lime panel.');
    }
  } else {
    s.dvx += ax * 20 * dt;
    const ay = (hop() ? -1 : 0) + (keys['s'] || keys['arrowdown'] ? 1 : 0);
    s.dvy += ay * 16 * dt;
    if (!ax) s.dvx *= Math.max(0, 1 - 4 * dt);
    if (!ay) s.dvy *= Math.max(0, 1 - 3 * dt);
    s.dvy += (s.dbat > 0 ? 2.2 : 9) * dt;
    s.dvx = Math.max(-11, Math.min(11, s.dvx));
    s.dvy = Math.max(-7, Math.min(8, s.dvy));
    s.dx += s.dvx * dt * 16;
    s.dy += s.dvy * dt * 16;
    const dist = Math.hypot(s.dx - s.x, s.dy - s.y);
    if (dist > s.tether) {
      const k = s.tether / dist;
      s.dx = s.x + (s.dx - s.x) * k;
      s.dy = s.y + (s.dy - s.y) * k;
      s.dvx *= 0.5; s.dvy *= 0.5;
      msg('Tether taut.');
    }
    s.dbat = Math.max(0, s.dbat - (2.2 + Math.hypot(s.dvx, s.dvy) * 0.15) * dt);
    const over = s.dx > panel.x - 6 && s.dx < panel.x + panel.w + 6 && s.dy > panel.y - 16 && s.dy < panel.y + panel.h + 8;
    if (use() && over && panel.pool > 0 && s.dbat > 5) {
      const flow = Math.min(7 * dt, panel.pool, 40 - s.trailer);
      panel.pool -= flow;
      s.trailer += flow;
      s.dbat -= 4 * dt;
      if (s.trailer >= 18 && !s.won) { s.won = true; msg('Trailer warm. Gate will take you.'); }
    }
    if (s.dy > roadY(s.dx) - 6) { s.dy = roadY(s.dx) - 6; s.dvy = Math.min(0, s.dvy); }
    if ((launch() && !fLatch) || s.dbat <= 0) {
      s.mode = 'bike';
      s.dbat = Math.max(s.dbat, 8);
      msg(s.trailer >= 18 ? 'Docked. Ride the gate.' : 'Docked.');
    }
  }
  fLatch = launch();
  s.msgT = Math.max(0, s.msgT - dt);
  document.getElementById('pack').textContent = Math.floor(s.pack);
  document.getElementById('tr').textContent = s.trailer.toFixed(1);
  document.getElementById('dr').textContent = Math.floor(s.dbat);
}

function draw() {
  const cam = Math.max(0, (s.mode === 'bike' ? s.x : s.dx) - 140);
  X.fillStyle = PAL.void; X.fillRect(0, 0, 480, 270);
  X.fillStyle = PAL.shadow;
  for (let i = 0; i < 18; i++) {
    const x = ((i * 73 - cam * 0.2) % 520 + 520) % 520 - 20;
    X.fillRect(x, 118 + (i % 3) * 3, 18, 4);
  }
  X.fillStyle = PAL.sage;
  for (let px = 80; px < 900; px += 160) {
    const x = px - cam * 0.55;
    X.fillRect(x, 70, 3, 150);
    X.fillRect(x - 10, 78, 24, 2);
  }
  for (let sx = 0; sx < 500; sx += 8) {
    const wx = sx + cam;
    const y = roadY(wx);
    X.fillStyle = PAL.dust; X.fillRect(sx, y, 8, 270 - y);
    X.fillStyle = PAL.sage; X.fillRect(sx, y, 8, 3);
  }
  const cx = crate.x - cam;
  X.fillStyle = PAL.rust; X.fillRect(cx, crate.y, 16, 14);
  X.fillStyle = PAL.bone; X.fillRect(cx + 1, crate.y + 1, 14, 3);
  const px = panel.x - cam;
  X.fillStyle = PAL.sage; X.fillRect(px, panel.y + 8, 28, 14);
  X.fillStyle = panel.pool > 0 ? PAL.lime : PAL.shadow;
  X.fillRect(px + 2, panel.y, 24, 16);
  X.fillStyle = PAL.rust; X.fillRect(px + 12, panel.y + 16, 3, 12);
  const gx = gateX - cam;
  X.fillStyle = s.trailer >= 18 ? PAL.lime : PAL.rust;
  X.fillRect(gx, roadY(gateX) - 70, 6, 70);
  X.fillRect(gx - 8, roadY(gateX) - 74, 22, 5);
  const bx = s.x - cam, by = s.y;
  X.fillStyle = PAL.bone;
  X.fillRect(bx - 10, by, 22, 6);
  X.fillRect(bx - 2, by - 7, 10, 7);
  X.fillStyle = PAL.shadow;
  X.beginPath(); X.arc(bx - 8, by + 7, 4, 0, 7); X.fill();
  X.beginPath(); X.arc(bx + 8, by + 7, 4, 0, 7); X.fill();
  X.fillStyle = PAL.sage; X.fillRect(bx + 10, by + 2, 14, 5);
  const show = s.mode === 'drone' || s.launched;
  if (show) {
    const dx = (s.mode === 'drone' ? s.dx : s.x + 6) - cam;
    const dy = s.mode === 'drone' ? s.dy : s.y - 16;
    X.fillStyle = use() && s.mode === 'drone' ? PAL.lime : PAL.bone;
    X.fillRect(dx - 6, dy, 12, 5);
    X.fillStyle = PAL.sage;
    X.fillRect(dx - 8, dy - 2, 4, 2);
    X.fillRect(dx + 4, dy - 2, 4, 2);
  }
  if (s.mode === 'drone') {
    X.strokeStyle = PAL.moss; X.setLineDash([3, 3]);
    X.beginPath(); X.moveTo(bx, by); X.lineTo(s.dx - cam, s.dy); X.stroke(); X.setLineDash([]);
  }
  X.fillStyle = PAL.bone;
  X.fillText(s.mode === 'drone' ? 'DRONE' : 'BIKE', 8, 14);
}

requestAnimationFrame(loop);
msg('Ride east. F launches the quad. Hold E on the panel to drink.');
