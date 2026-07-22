'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    style: 'flat',
    bg: null,
    grid: null,
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#ec407a'],
  },
  neon: {
    style: 'neon',
    bg: '#000000',
    grid: '#1a1a1a',
    colors: [null, '#00e5ff', '#faff00', '#e040fb', '#00ff6a', '#ff1744', '#2979ff', '#ff9100', '#ff4081'],
  },
  pastel: {
    style: 'pastel',
    bg: '#f7f2ec',
    grid: '#e8ded4',
    colors: [null, '#a7e0e8', '#fdf0a8', '#d8b8e8', '#b6e3c3', '#f5b6b6', '#b7cdf0', '#f7d2a0', '#f3b6d6'],
  },
  pixel: {
    style: 'pixel',
    bg: null,
    grid: null,
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#ec407a'],
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
const highscoresListEl = document.getElementById('highscores-list');
const overlayHighscoresListEl = document.getElementById('overlay-highscores-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const newHighscoreForm = document.getElementById('new-highscore-form');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuView = document.getElementById('pause-menu-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const viewControlsBtn = document.getElementById('view-controls-btn');
const backControlsBtn = document.getElementById('back-controls-btn');
const startLevelSelect = document.getElementById('start-level-select');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxComboThisGame;
let gridColor = '#22222e';
let startLevel = 1;
let currentSkin = 'retro';

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

function loadHighScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY));
    return { bestCombo: raw?.bestCombo || 0, maxLines: raw?.maxLines || 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForHighScore(candidateScore) {
  const list = loadHighScores();
  if (list.length < MAX_HIGHSCORES) return true;
  return candidateScore > list[list.length - 1].score;
}

function addHighScore(name, candidateScore) {
  const list = loadHighScores();
  list.push({ name: name || 'ANON', score: candidateScore });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighScores(list);
  return list;
}

function renderHighScores(currentScore) {
  const list = loadHighScores();
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;

  const renderInto = (el, highlightScore) => {
    el.innerHTML = '';
    if (list.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Sin récords aún';
      el.appendChild(li);
      return;
    }
    let highlighted = false;
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      const shouldHighlight = !highlighted && highlightScore != null && entry.score === highlightScore;
      if (shouldHighlight) { li.classList.add('current'); highlighted = true; }
      li.innerHTML = `<span class="pos">${i + 1}.</span><span class="name">${escapeHtml(entry.name)}</span><span class="pts">${entry.score.toLocaleString()}</span>`;
      el.appendChild(li);
    });
  };

  renderInto(highscoresListEl, null);
  renderInto(overlayHighscoresListEl, currentScore != null ? currentScore : null);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const MAX_START_LEVEL = 10;

function activeSkin() {
  return SKINS[currentSkin] || SKINS.retro;
}

function applySkin(name) {
  currentSkin = SKINS[name] ? name : 'retro';
  skinSelect.value = currentSkin;
  if (typeof current !== 'undefined' && current) {
    draw();
    drawNext();
  }
}

function initSkin() {
  applySkin(localStorage.getItem(SKIN_KEY) || 'retro');
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    localStorage.setItem(SKIN_KEY, currentSkin);
  });
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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
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
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxComboThisGame = Math.max(maxComboThisGame, combo);
  } else {
    combo = 0;
  }
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

function drawFlatBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.6;
  context.fillStyle = '#0a0a0a';
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.restore();
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPastelBlock(context, px, py, size, color) {
  roundRectPath(context, px + 2, py + 2, size - 4, size - 4, 6);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 1.5;
  context.stroke();
}

function drawPixelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  const cell = (size - 2) / 4;
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let ry = 0; ry < 4; ry++)
    for (let rx = 0; rx < 4; rx++)
      if ((rx + ry) % 2 === 0)
        context.fillRect(px + 1 + rx * cell, py + 1 + ry * cell, cell, cell);
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, size - 2, size - 2);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = activeSkin();
  const color = skin.colors[colorIndex];
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  switch (skin.style) {
    case 'neon': drawNeonBlock(context, px, py, size, color); break;
    case 'pastel': drawPastelBlock(context, px, py, size, color); break;
    case 'pixel': drawPixelBlock(context, px, py, size, color); break;
    default: drawFlatBlock(context, px, py, size, color);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  const skin = activeSkin();
  ctx.strokeStyle = skin.grid || gridColor;
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
  const skin = activeSkin();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (skin.bg) {
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  const skin = activeSkin();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (skin.bg) {
    nextCtx.fillStyle = skin.bg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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

  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, maxComboThisGame);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveStats(stats);

  if (qualifiesForHighScore(score) && score > 0) {
    newHighscoreForm.classList.remove('hidden');
    playerNameInput.value = '';
    renderHighScores(null);
    overlay.classList.remove('hidden');
    playerNameInput.focus();
  } else {
    newHighscoreForm.classList.add('hidden');
    renderHighScores(score);
    overlay.classList.remove('hidden');
  }
}

function submitHighScore() {
  const name = playerNameInput.value.trim().slice(0, 12);
  addHighScore(name, score);
  newHighscoreForm.classList.add('hidden');
  renderHighScores(score);
}

function showPauseMenuView() {
  pauseMenuView.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
}

function populateStartLevelSelect() {
  startLevelSelect.innerHTML = '';
  for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
    const opt = document.createElement('option');
    opt.value = lvl;
    opt.textContent = lvl;
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = startLevel;
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
    showPauseMenuView();
    populateStartLevelSelect();
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
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  combo = 0;
  maxComboThisGame = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  newHighscoreForm.classList.add('hidden');
  renderHighScores(null);
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
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

saveScoreBtn.addEventListener('click', submitHighScore);
playerNameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter' || e.key === 'Enter') submitHighScore();
});

resetScoresBtn.addEventListener('click', () => {
  if (!confirm('¿Resetear todos los récords?')) return;
  saveHighScores([]);
  saveStats({ bestCombo: 0, maxLines: 0 });
  renderHighScores(gameOver ? score : null);
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  paused = false;
  init();
});
viewControlsBtn.addEventListener('click', () => {
  pauseMenuView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});
backControlsBtn.addEventListener('click', showPauseMenuView);
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

initTheme();
initSkin();
init();
