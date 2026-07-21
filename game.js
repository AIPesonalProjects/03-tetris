'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#64b5f6', '#ffb74d', '#ec407a',
    ],
    draw: drawBlockRetro,
  },
  neon: {
    colors: [
      null,
      '#00e5ff', '#ffea00', '#d500f9', '#00e676',
      '#ff1744', '#2979ff', '#ff9100', '#f50057',
    ],
    draw: drawBlockNeon,
  },
  pastel: {
    colors: [
      null,
      '#a8dadc', '#ffe8a3', '#c8b6ff', '#b5ead7',
      '#ffb5b5', '#a0c4ff', '#ffd6a5', '#ffb3c6',
    ],
    draw: drawBlockPastel,
  },
  pixel: {
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#64b5f6', '#ffb74d', '#ec407a',
    ],
    draw: drawBlockPixel,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut - hueco central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const skinSelect = document.getElementById('skin-select');
const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayRecords = document.getElementById('overlay-records');
const nameInput = document.getElementById('name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayTopRecordsWrap = document.getElementById('overlay-top-records-wrap');
const overlayTopRecordsList = document.getElementById('overlay-top-records');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMain = document.getElementById('pause-main');
const pauseControlsView = document.getElementById('pause-controls-view');
const startLevelSelect = document.getElementById('start-level-select');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxComboThisGame, pendingEntry;
let gridColor = '#22222e';
let currentSkin = 'retro';
let startLevel = 1;

for (let i = 1; i <= 10; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = i;
  startLevelSelect.appendChild(opt);
}
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
});

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { bestCombo: 0, maxLines: 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForRecords(candidateScore) {
  const records = loadRecords();
  if (records.length < MAX_RECORDS) return candidateScore > 0;
  return candidateScore > records[records.length - 1].score;
}

function insertRecord(name, entry) {
  const records = loadRecords();
  const newRecord = { name, ...entry };
  records.push(newRecord);
  records.sort((a, b) => b.score - a.score);
  const trimmed = records.slice(0, MAX_RECORDS);
  saveRecords(trimmed);
  return trimmed.indexOf(newRecord);
}

function updateStats(entry) {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, entry.combo);
  stats.maxLines = Math.max(stats.maxLines, entry.lines);
  saveStats(stats);
  return stats;
}

function buildRecordsRows(tbody, highlightIndex) {
  const records = loadRecords();
  tbody.innerHTML = '';
  if (records.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Sin récords aún';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  records.forEach((rec, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('highlight');
    const cells = [i + 1, rec.name, rec.score.toLocaleString(), rec.lines, rec.combo];
    cells.forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderRecords(highlightIndex) {
  buildRecordsRows(recordsListEl, highlightIndex);
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;
}

function renderOverlayRecords(highlightIndex) {
  buildRecordsRows(overlayTopRecordsList, highlightIndex);
  overlayTopRecordsWrap.classList.remove('hidden');
}

function initRecords() {
  renderRecords();
  resetRecordsBtn.addEventListener('click', () => {
    if (!confirm('¿Borrar todos los récords y estadísticas?')) return;
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(STATS_KEY);
    renderRecords();
  });
  saveRecordBtn.addEventListener('click', submitRecord);
  nameInput.addEventListener('keydown', e => {
    if (e.code === 'Enter') {
      e.preventDefault();
      submitRecord();
    }
  });
}

function submitRecord() {
  if (!pendingEntry) return;
  const name = nameInput.value.trim().slice(0, 10) || 'Jugador';
  const idx = insertRecord(name, pendingEntry);
  pendingEntry = null;
  overlayRecords.classList.add('hidden');
  renderRecords(idx);
  renderOverlayRecords(idx);
}

function updateGridColor() {
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeSwitch.checked = isLight;
  updateGridColor();
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light');
  themeSwitch.addEventListener('change', () => {
    applyTheme(themeSwitch.checked);
    localStorage.setItem(THEME_KEY, themeSwitch.checked ? 'light' : 'dark');
  });
}

function applySkin(name) {
  currentSkin = SKINS[name] ? name : 'retro';
  document.body.classList.remove('skin-neon', 'skin-pastel', 'skin-pixel');
  if (currentSkin !== 'retro') document.body.classList.add(`skin-${currentSkin}`);
  skinSelect.value = currentSkin;
  updateGridColor();
  if (current) { draw(); drawNext(); }
}

function initSkin() {
  applySkin(localStorage.getItem(SKIN_KEY) || 'retro');
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    localStorage.setItem(SKIN_KEY, skinSelect.value);
  });
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxComboThisGame) maxComboThisGame = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = calcDropInterval(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function calcDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function shadeColor(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function drawBlockRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, color, size) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  context.fillStyle = color;
  context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 1;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.restore();
}

function drawBlockPastel(context, x, y, color, size) {
  const px = x * size + 2, py = y * size + 2, s = size - 4, radius = size * 0.22;
  context.fillStyle = color;
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(px, py, s, s, radius);
  } else {
    context.rect(px, py, s, s);
  }
  context.fill();
  context.strokeStyle = shadeColor(color, -15);
  context.lineWidth = 1;
  context.stroke();
}

function drawBlockPixel(context, x, y, color, size) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  const half = s / 2;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.fillStyle = shadeColor(color, 18);
  context.fillRect(px, py, half, half);
  context.fillRect(px + half, py + half, half, half);
  context.fillStyle = shadeColor(color, -18);
  context.fillRect(px + half, py, half, half);
  context.fillRect(px, py + half, half, half);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x, y, color, size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  const entry = { score, lines, level, combo: maxComboThisGame };
  updateStats(entry);
  if (qualifiesForRecords(score)) {
    pendingEntry = entry;
    overlayRecords.classList.remove('hidden');
    nameInput.value = '';
    renderRecords();
    overlayTopRecordsWrap.classList.add('hidden');
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    pendingEntry = null;
    overlayRecords.classList.add('hidden');
    renderRecords();
    renderOverlayRecords();
    overlay.classList.remove('hidden');
  }
}

function showPauseMain() {
  pauseMain.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
}

function showPauseControls() {
  pauseMain.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMain();
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  maxComboThisGame = 0;
  pendingEntry = null;
  dropInterval = calcDropInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  overlayTopRecordsWrap.classList.add('hidden');
  renderRecords();
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && paused && !pauseControlsView.classList.contains('hidden')) {
    showPauseMain();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', showPauseControls);
backBtn.addEventListener('click', showPauseMain);

initTheme();
initSkin();
initRecords();
init();
