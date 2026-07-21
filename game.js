'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#ec407a', // Nut - magenta
];

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

const NEON_COLORS = [
  null,
  '#00e5ff', // I - cyan
  '#ffea00', // O - yellow
  '#e040fb', // T - purple
  '#00e676', // S - green
  '#ff1744', // Z - red
  '#2979ff', // J - pale blue
  '#ff9100', // L - orange
  '#f50057', // Nut - magenta
];

const PASTEL_COLORS = [
  null,
  '#b3e5fc', // I - cyan
  '#fff9c4', // O - yellow
  '#e1bee7', // T - purple
  '#c8e6c9', // S - green
  '#ffcdd2', // Z - red
  '#bbdefb', // J - pale blue
  '#ffe0b2', // L - orange
  '#f8bbd0', // Nut - magenta
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
const highscorePanel = document.getElementById('highscore-panel');
const highscoreBody = document.getElementById('highscore-body');
const highscoreForm = document.getElementById('highscore-form');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';
let combo = 0;
let gameStarted = false;

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
let currentSkin = 'retro';
const HS_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function loadBestCombo() {
  return Number(localStorage.getItem(BEST_COMBO_KEY)) || 0;
}

function saveBestCombo(value) {
  localStorage.setItem(BEST_COMBO_KEY, String(value));
}

function loadMaxLines() {
  return Number(localStorage.getItem(MAX_LINES_KEY)) || 0;
}

function saveMaxLines(value) {
  localStorage.setItem(MAX_LINES_KEY, String(value));
}

let bestCombo = loadBestCombo();
let maxLinesRecord = loadMaxLines();

function qualifiesForHighScore(candidateScore) {
  const list = loadHighScores();
  if (list.length < 5) return true;
  return candidateScore > list[list.length - 1].score;
}

function renderHighScoreTable(list, highlightEntry) {
  highscoreBody.innerHTML = '';
  if (list.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Sin récords todavía';
    td.className = 'highscore-empty';
    tr.appendChild(td);
    highscoreBody.appendChild(tr);
    return;
  }
  list.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (highlightEntry && entry === highlightEntry) tr.classList.add('highscore-new');
    const rankTd = document.createElement('td');
    rankTd.textContent = String(i + 1);
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name;
    const scoreTd = document.createElement('td');
    scoreTd.textContent = entry.score.toLocaleString();
    tr.append(rankTd, nameTd, scoreTd);
    highscoreBody.appendChild(tr);
  });
}

function renderStats() {
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLinesRecord;
}

function saveScoreEntry() {
  const name = nameInput.value.trim().slice(0, 12) || 'AAA';
  const list = loadHighScores();
  const entry = { name, score };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 5);
  saveHighScores(trimmed);
  highscoreForm.classList.add('hidden');
  renderHighScoreTable(trimmed, trimmed.includes(entry) ? entry : null);
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
    if (combo > bestCombo) {
      bestCombo = combo;
      saveBestCombo(bestCombo);
    }
    if (cleared > maxLinesRecord) {
      maxLinesRecord = cleared;
      saveMaxLines(maxLinesRecord);
    }
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
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

function retroDrawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = COLORS[colorIndex];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function neonDrawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = NEON_COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 15;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.2)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function pastelDrawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = PASTEL_COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const r = Math.min(6, s / 4);

  const roundedPath = (rx, ry, rw, rh, rr) => {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(rx, ry, rw, rh, rr);
    } else {
      context.moveTo(rx + rr, ry);
      context.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      context.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      context.arcTo(rx, ry + rh, rx, ry, rr);
      context.arcTo(rx, ry, rx + rw, ry, rr);
      context.closePath();
    }
  };

  context.fillStyle = color;
  roundedPath(px, py, s, s, r);
  context.fill();

  // soft highlight
  context.fillStyle = 'rgba(255,255,255,0.3)';
  roundedPath(px, py, s, Math.max(4, s * 0.35), r);
  context.fill();

  context.globalAlpha = 1;
}

function pixelDrawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.fillStyle = color;
  context.fillRect(px, py, s, s);

  // checkerboard pixel texture
  const cell = Math.max(2, Math.floor(s / 4));
  context.fillStyle = 'rgba(0,0,0,0.15)';
  for (let ry = 0; ry < s; ry += cell) {
    for (let rx = 0; rx < s; rx += cell) {
      if (((rx / cell + ry / cell) % 2) === 0) {
        context.fillRect(px + rx, py + ry, cell, cell);
      }
    }
  }

  // chunky border
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);

  context.globalAlpha = 1;
}

const SKINS = {
  retro: { boardBg: null, drawBlock: retroDrawBlock },
  neon: { boardBg: '#000000', drawBlock: neonDrawBlock },
  pastel: { boardBg: null, drawBlock: pastelDrawBlock },
  pixel: { boardBg: null, drawBlock: pixelDrawBlock },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size, alpha);
}

function applySkinBoardBg() {
  const bg = SKINS[currentSkin].boardBg;
  canvas.style.background = bg || '';
  nextCanvas.style.background = bg || '';
}

function applySkin(name) {
  currentSkin = SKINS[name] ? name : 'retro';
  skinSelect.value = currentSkin;
  applySkinBoardBg();
  // reset any leftover shadow state before redrawing
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  nextCtx.shadowBlur = 0;
  nextCtx.shadowColor = 'transparent';
  if (board) draw();
  if (next) drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved || 'retro');
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    localStorage.setItem(SKIN_KEY, currentSkin);
  });
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
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
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
  nextCtx.shadowBlur = 0;
  nextCtx.shadowColor = 'transparent';
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
  restartBtn.textContent = 'Reiniciar';
  renderStats();
  renderHighScoreTable(loadHighScores(), null);
  if (qualifiesForHighScore(score)) {
    nameInput.value = '';
    highscoreForm.classList.remove('hidden');
  } else {
    highscoreForm.classList.add('hidden');
  }
  highscorePanel.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    highscorePanel.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  highscoreForm.classList.add('hidden');
  renderStats();
  renderHighScoreTable(loadHighScores(), null);
  highscorePanel.classList.remove('hidden');
  overlay.classList.remove('hidden');
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
  gameStarted = true;
  restartBtn.textContent = 'Reiniciar';
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (!gameStarted || paused || gameOver) return;
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

saveScoreBtn.addEventListener('click', saveScoreEntry);

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveScoreEntry();
  }
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem(HS_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  bestCombo = 0;
  maxLinesRecord = 0;
  renderStats();
  renderHighScoreTable(loadHighScores(), null);
});

initTheme();
initSkin();
showStartScreen();
