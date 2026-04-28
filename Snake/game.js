const { SCREEN_WIDTH, SCREEN_HEIGHT, DEVICE_PIXEL_RATIO, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, COLORS } = require('./js/config.js');

// Initialize Canvas
// In Mini Game environment, 'canvas' is a global variable, but explicit creation is safer for some adapters
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, Math.min(3, DEVICE_PIXEL_RATIO || 1));
if (canvas && typeof canvas.width === 'number') canvas.width = Math.round(SCREEN_WIDTH * DPR);
if (canvas && typeof canvas.height === 'number') canvas.height = Math.round(SCREEN_HEIGHT * DPR);
if (canvas && canvas.style) {
  canvas.style.width = `${SCREEN_WIDTH}px`;
  canvas.style.height = `${SCREEN_HEIGHT}px`;
}
if (ctx && typeof ctx.scale === 'function') {
  ctx.scale(DPR, DPR);
}

function raf(cb) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  if (canvas && typeof canvas.requestAnimationFrame === 'function') return canvas.requestAnimationFrame(cb);
  if (wx && typeof wx.requestAnimationFrame === 'function') return wx.requestAnimationFrame(cb);
  return setTimeout(() => cb(Date.now()), 16);
}

// Game State
let snake = [];
let food = {};
let bonusFood = null; // {x, y, spawnTime, duration}
let direction = 'RIGHT';
let nextDirection = 'RIGHT';
let score = 0;
let highScore = 0;
let gameLoop = null;
let isPlaying = false;
let isPaused = false;
let gameOver = false;
let showHelp = false;
let showShop = false;
let showAchievements = false;
let speed = 200; // ms
let baseSpeed = 200;
let lastTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let startedThisTouch = false;
let longPressTimer = null;
let accelerating = false;
let bgParticles = []; // Background animation particles
let gameParticles = []; // In-game effect particles
let frameCounter = 0;
let happyUntil = 0;
let gameStartTime = 0;
let gameDurationMs = 0;
let coinsEarnedThisRun = 0;
let newAchievementsThisRun = [];
let wasNewHighScoreThisRun = false;
let previousHighScoreThisRun = 0;
let shopScrollY = 0;
let achievementScrollY = 0;
let scrollDragging = false;
let scrollLastY = 0;
let activeScrollPanel = null;

// Level Themes
const LEVEL_THEMES = [
    { name: '1-1', bgTop: '#38bdf8', bg: '#0f8fcf', bgBottom: '#0f5f96', border: '#7dd3fc', grid: 'rgba(7, 42, 72, 0.34)' },
    { name: '1-2', bgTop: '#34d399', bg: '#0d9488', bgBottom: '#0f766e', border: '#99f6e4', grid: 'rgba(5, 46, 42, 0.32)' },
    { name: '1-3', bgTop: '#22d3ee', bg: '#0284c7', bgBottom: '#075985', border: '#bae6fd', grid: 'rgba(8, 47, 73, 0.34)' },
    { name: '1-4', bgTop: '#818cf8', bg: '#4f46e5', bgBottom: '#312e81', border: '#c4b5fd', grid: 'rgba(30, 27, 75, 0.35)' },
    { name: '2-1', bgTop: '#60a5fa', bg: '#2563eb', bgBottom: '#1e3a8a', border: '#bfdbfe', grid: 'rgba(23, 37, 84, 0.35)' },
    { name: '2-2', bgTop: '#2dd4bf', bg: '#0891b2', bgBottom: '#164e63', border: '#a5f3fc', grid: 'rgba(8, 51, 68, 0.36)' },
    { name: '2-3', bgTop: '#334155', bg: '#1e293b', bgBottom: '#020617', border: '#94a3b8', grid: 'rgba(15, 23, 42, 0.5)' }
];

// New Systems Data
let totalCoins = 0; // Persistent currency
let currentSkin = 'default';
let unlockedSkins = ['default'];
let achievements = [
    { id: 'score_100', name: '初露锋芒', desc: '单局达到100分', unlocked: false, reward: 50 },
    { id: 'score_500', name: '贪吃大师', desc: '单局达到500分', unlocked: false, reward: 200 },
    { id: 'score_1000', name: '传奇蛇王', desc: '单局达到1000分', unlocked: false, reward: 500 },
    { id: 'skin_3', name: '时尚达人', desc: '解锁3个皮肤', unlocked: false, reward: 100 },
    { id: 'skin_5', name: '收藏家', desc: '解锁5个皮肤', unlocked: false, reward: 300 },
    { id: 'games_10', name: '坚持不懈', desc: '进行10局游戏', unlocked: false, reward: 50 },
    { id: 'games_50', name: '游戏狂人', desc: '进行50局游戏', unlocked: false, reward: 200 },
    { id: 'coins_1000', name: '大富翁', desc: '拥有1000金币', unlocked: false, reward: 150 }
];
let gamesPlayed = 0;

const SKINS = {
    'default': { name: '经典绿', price: 0, color: ['#7ddf9a', '#22c55e'], head: ['#bbf7d0', '#34d399'] },
    'gold': { name: '土豪金', price: 500, color: ['#fcd34d', '#d97706'], head: ['#fde047', '#b45309'] },
    'ice': { name: '冰川蓝', price: 1000, color: ['#60a5fa', '#2563eb'], head: ['#93c5fd', '#1d4ed8'] },
    'pink': { name: '樱花粉', price: 1500, color: ['#f472b6', '#db2777'], head: ['#fbcfe8', '#ec4899'] },
    'purple': { name: '魅影紫', price: 2000, color: ['#c084fc', '#7e22ce'], head: ['#d8b4fe', '#6b21a8'] },
    'red': { name: '火焰红', price: 3000, color: ['#f87171', '#dc2626'], head: ['#fca5a5', '#ef4444'] },
    'dark': { name: '暗夜黑', price: 5000, color: ['#475569', '#1e293b'], head: ['#64748b', '#334155'] }
};

// UI Layout
let SAFE_AREA_TOP = 0;
try {
    const sysInfo = wx.getSystemInfoSync();
    if (sysInfo.safeArea) {
        SAFE_AREA_TOP = sysInfo.safeArea.top;
    }
} catch (e) {
    // Fallback if not in WeChat environment
    SAFE_AREA_TOP = 20; 
}

const GAME_AREA_X = (SCREEN_WIDTH - GRID_WIDTH * CELL_SIZE) / 2;
const GAME_AREA_Y = 100 + SAFE_AREA_TOP; // Top padding for header + safe area

// Assets
const marioFont = "bold 20px Arial"; // Fallback font

function vibrate(type) {
  try {
    if (type) {
      wx.vibrateShort({ type });
    } else {
      wx.vibrateShort();
    }
  } catch (e) {}
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function isPointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function getModalRect(widthRatio, heightRatio) {
  const w = SCREEN_WIDTH * widthRatio;
  const h = SCREEN_HEIGHT * heightRatio;
  return {
    x: (SCREEN_WIDTH - w) / 2,
    y: (SCREEN_HEIGHT - h) / 2,
    w,
    h
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getScrollablePanelMetrics(type) {
  const boxH = SCREEN_HEIGHT * 0.8;
  const boxY = (SCREEN_HEIGHT - boxH) / 2;
  const startY = boxY + (type === 'shop' ? 88 : 70);
  const endY = boxY + boxH - 80;
  const itemH = 70;
  const gap = 15;
  const count = type === 'shop' ? Object.keys(SKINS).length : achievements.length;
  const contentH = count * (itemH + gap) - gap;
  const viewH = endY - startY;
  return {
    box: getModalRect(0.9, 0.8),
    startY,
    endY,
    itemH,
    gap,
    contentH,
    viewH,
    minScroll: Math.min(0, viewH - contentH)
  };
}

function setPanelScroll(type, value) {
  const metrics = getScrollablePanelMetrics(type);
  if (type === 'shop') {
    shopScrollY = clamp(value, metrics.minScroll, 0);
  } else {
    achievementScrollY = clamp(value, metrics.minScroll, 0);
  }
}

function drawCoin(x, y, radius, options = {}) {
  const t = Date.now();
  const spin = options.spin === false ? 0 : Math.sin(t / 450) * 0.08;
  const squash = options.spin === false ? 1 : 1 - Math.abs(Math.sin(t / 520)) * 0.06;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, 1);
  ctx.rotate(spin);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.beginPath();
  ctx.ellipse(radius * 0.12, radius * 0.22, radius * 0.88, radius * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  const outer = ctx.createLinearGradient(-radius, -radius, radius, radius);
  outer.addColorStop(0, '#fff7ad');
  outer.addColorStop(0.24, '#facc15');
  outer.addColorStop(0.58, '#f59e0b');
  outer.addColorStop(1, '#92400e');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = Math.max(1.2, radius * 0.16);
  ctx.stroke();

  const inner = ctx.createRadialGradient(-radius * 0.28, -radius * 0.32, radius * 0.08, 0, 0, radius * 0.78);
  inner.addColorStop(0, '#fef9c3');
  inner.addColorStop(0.45, '#facc15');
  inner.addColorStop(1, '#d97706');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(146, 64, 14, 0.72)';
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = `900 ${Math.max(9, radius * 1.05)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, radius * 0.04);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-radius * 0.48, -radius * 0.48);
  ctx.lineTo(-radius * 0.16, -radius * 0.66);
  ctx.stroke();

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.lineCap = 'butt';
}

function getDirectionVector(dir) {
  if (dir === 'UP') return { x: 0, y: -1 };
  if (dir === 'DOWN') return { x: 0, y: 1 };
  if (dir === 'LEFT') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function init() {
  // Load high score
  try {
    const value = wx.getStorageSync('snake_high_score');
    if (value) highScore = value;
    
    // Load coins
    const coins = wx.getStorageSync('snake_coins');
    if (coins) totalCoins = coins;

    // Load skins
    const skins = wx.getStorageSync('snake_skins');
    if (skins) unlockedSkins = JSON.parse(skins);

    // Load current skin
    const current = wx.getStorageSync('snake_current_skin');
    if (current) currentSkin = current;
    
    // Load achievements
    const ach = wx.getStorageSync('snake_achievements');
    if (ach) {
        const saved = JSON.parse(ach);
        achievements.forEach(a => {
            if (saved.includes(a.id)) a.unlocked = true;
        });
    }

    // Load stats
    const games = wx.getStorageSync('snake_games_played');
    if (games) gamesPlayed = games;

  } catch (e) {}
  
  snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  food = spawnFood();
  bonusFood = null;
  baseSpeed = 200;
  speed = baseSpeed;
  lastTime = 0;
  isPlaying = false;
  isPaused = false;
  gameOver = false;
  showHelp = false;
  showShop = false;
  showAchievements = false;
  gameParticles = []; // Clear particles

  // Bind input
  wx.onTouchStart(handleTouchStart);
  wx.onTouchMove(handleTouchMove);
  wx.onTouchEnd(handleTouchEnd);
  
  // Initialize Background Particles
  for (let i = 0; i < 20; i++) {
    bgParticles.push({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 8 + 4,
      speed: Math.random() * 1.5 + 0.5,
      color: Math.random() > 0.5 ? '#fbbf24' : '#4ade80' // Gold or Green
    });
  }
  
  // Game Loop
  const loop = () => {
    frameCounter++;
    update();
    draw();
    raf(loop);
  };
  raf(loop);
}

function startGame() {
  snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  food = spawnFood();
  bonusFood = null;
  direction = 'RIGHT';
  nextDirection = 'RIGHT';
  score = 0;
  isPlaying = true;
  isPaused = false;
  gameOver = false;
  showHelp = false;
  baseSpeed = 200;
  speed = baseSpeed;
  lastTime = Date.now();
  gameStartTime = Date.now();
  gameDurationMs = 0;
  coinsEarnedThisRun = 0;
  newAchievementsThisRun = [];
  wasNewHighScoreThisRun = false;
  previousHighScoreThisRun = highScore;
}

// Helper to check valid spawn
function getValidSpawn() {
  let pos;
  let valid = false;
  while (!valid) {
    pos = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT)
    };
    // Check against snake
    const onSnake = snake.some(s => s.x === pos.x && s.y === pos.y);
    // Check against regular food
    const onFood = food && food.x === pos.x && food.y === pos.y;
    // Check against bonus food (if existing)
    const onBonus = bonusFood && bonusFood.x === pos.x && bonusFood.y === pos.y;
    
    valid = !onSnake && !onFood && !onBonus;
  }
  return pos;
}

function spawnFood() {
  return getValidSpawn();
}

function update(dt) {
  if (!isPlaying || isPaused || gameOver) return;

  if (Date.now() - lastTime > speed) {
    lastTime = Date.now();
    
    // Move Snake
    direction = nextDirection;
    const head = { ...snake[0] };
    
    switch (direction) {
      case 'UP': head.y--; break;
      case 'DOWN': head.y++; break;
      case 'LEFT': head.x--; break;
      case 'RIGHT': head.x++; break;
    }
    
    // Collision Check
    if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT || 
        snake.some(s => s.x === head.x && s.y === head.y)) {
      handleGameOver();
      return;
    }
    
    snake.unshift(head);
    
    // Eat Food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      happyUntil = Date.now() + 360;
      vibrate('light');
      
      // Spawn Particles
      spawnGameParticles(
          GAME_AREA_X + head.x * CELL_SIZE + CELL_SIZE / 2, 
          GAME_AREA_Y + head.y * CELL_SIZE + CELL_SIZE / 2, 
          '#ffd700'
      );

      food = spawnFood();
      // Speed up every 50 points
      if (score % 50 === 0 && baseSpeed > 50) {
        baseSpeed -= 10;
        speed = baseSpeed;
      }
      
      // Spawn Bonus Food (20% chance if none exists)
      if (!bonusFood && Math.random() < 0.2) {
          bonusFood = getValidSpawn();
          bonusFood.spawnTime = Date.now();
          bonusFood.duration = 5000; // 5 seconds
      }
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
        // Eat Bonus Food
        score += 50;
        happyUntil = Date.now() + 520;
        vibrate('medium');
        spawnGameParticles(
            GAME_AREA_X + head.x * CELL_SIZE + CELL_SIZE / 2, 
            GAME_AREA_Y + head.y * CELL_SIZE + CELL_SIZE / 2, 
            '#f59e0b' // Orange/Gold
        );
        bonusFood = null;
    } else {
      snake.pop();
    }
  }

  // Handle Bonus Food Timer
  if (bonusFood && Date.now() - bonusFood.spawnTime > bonusFood.duration) {
      bonusFood = null;
  }
  
  // Update Game Particles
  for (let i = gameParticles.length - 1; i >= 0; i--) {
      const p = gameParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) {
          gameParticles.splice(i, 1);
      }
  }
}

function spawnGameParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        gameParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: Math.random() * 3 + 2
        });
    }
}

function handleGameOver() {
  isPlaying = false;
  gameOver = true;
  vibrate('heavy');
  gameDurationMs = Date.now() - gameStartTime;
  previousHighScoreThisRun = highScore;
  wasNewHighScoreThisRun = score > highScore;
  coinsEarnedThisRun = score;
  newAchievementsThisRun = [];
  if (score > highScore) {
    highScore = score;
    wx.setStorageSync('snake_high_score', highScore);
  }
  
  // Save coins
  totalCoins += score;
  wx.setStorageSync('snake_coins', totalCoins);
  
  // Save stats
  gamesPlayed++;
  wx.setStorageSync('snake_games_played', gamesPlayed);

  // Check Achievements
  let newUnlock = false;
  achievements.forEach(a => {
      if (!a.unlocked) {
          if (a.id === 'score_100' && score >= 100) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'score_500' && score >= 500) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'score_1000' && score >= 1000) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'skin_3' && unlockedSkins.length >= 3) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'skin_5' && unlockedSkins.length >= 5) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'games_10' && gamesPlayed >= 10) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'games_50' && gamesPlayed >= 50) { a.unlocked = true; newUnlock = true; }
          if (a.id === 'coins_1000' && totalCoins >= 1000) { a.unlocked = true; newUnlock = true; }
          
          if (a.unlocked) {
              totalCoins += a.reward;
              coinsEarnedThisRun += a.reward;
              newAchievementsThisRun.push(a);
              vibrate('medium');
              wx.showToast({ title: `成就解锁: ${a.name}`, icon: 'success' });
          }
      }
  });
  
  if (newUnlock) {
      wx.setStorageSync('snake_achievements', JSON.stringify(achievements.filter(a => a.unlocked).map(a => a.id)));
      wx.setStorageSync('snake_coins', totalCoins);
  }
}

// Drawing Functions
function draw() {
  if (!isPlaying && !gameOver) {
    drawStartScreen();
    if (showHelp) drawHelpScreen();
    if (showShop) drawShopScreen();
    if (showAchievements) drawAchievementsScreen();
    return;
  }
  
  // Clear Screen
  const levelIndex = Math.floor(score / 100) % LEVEL_THEMES.length;
  const currentTheme = LEVEL_THEMES[levelIndex];

  const bgGrad = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  bgGrad.addColorStop(0, currentTheme.bgTop || currentTheme.bg);
  bgGrad.addColorStop(0.55, currentTheme.bg);
  bgGrad.addColorStop(1, currentTheme.bgBottom || currentTheme.bg);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  
  // Draw Header
  drawHeader(currentTheme);
  
  // Draw Game Area
  drawGameArea(currentTheme);
  
  // Overlays
  if (gameOver) drawGameOverScreen();
  if (isPaused) drawPauseScreen();
  if (showHelp) drawHelpScreen();
}

function drawHeader(theme) {
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  
  const topY = 30 + SAFE_AREA_TOP;
  const bottomY = 55 + SAFE_AREA_TOP;

  // SCORE -> 得分
  ctx.fillText("得分", SCREEN_WIDTH * 0.15, topY);
  ctx.font = "bold 18px Arial";
  ctx.fillText(score.toString().padStart(6, '0'), SCREEN_WIDTH * 0.15, bottomY);
  
  // COINS -> 金币
  ctx.font = "bold 14px Arial";
  ctx.fillText("金币", SCREEN_WIDTH * 0.4, topY);
  const iconX = SCREEN_WIDTH * 0.38;
  const iconY = 50 + SAFE_AREA_TOP;
  drawCoin(iconX, iconY, 8, { spin: false });
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 18px Arial";
  ctx.fillText("x" + Math.floor(score / 10).toString().padStart(2, '0'), SCREEN_WIDTH * 0.45, bottomY);
  
  // LEVEL -> 关卡
  ctx.font = "bold 14px Arial";
  ctx.fillText("关卡", SCREEN_WIDTH * 0.65, topY);
  ctx.font = "bold 18px Arial";
  ctx.fillText(theme ? theme.name : "1-1", SCREEN_WIDTH * 0.65, bottomY);
  
  // TOP -> 最高分
  ctx.font = "bold 14px Arial";
  ctx.fillText("最高分", SCREEN_WIDTH * 0.85, topY);
  ctx.font = "bold 18px Arial";
  ctx.fillText(highScore.toString().padStart(6, '0'), SCREEN_WIDTH * 0.85, bottomY);
}

function drawGameArea(theme) {
  // Background
  const boardGrad = ctx.createLinearGradient(0, GAME_AREA_Y, 0, GAME_AREA_Y + GRID_HEIGHT * CELL_SIZE);
  boardGrad.addColorStop(0, 'rgba(8, 47, 73, 0.38)');
  boardGrad.addColorStop(1, theme ? theme.grid : COLORS.GAME_BG);
  ctx.fillStyle = boardGrad;
  ctx.fillRect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  
  // Background Grid
  ctx.save();
  ctx.beginPath();
  ctx.rect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  ctx.clip();

  const gridSize = CELL_SIZE;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  
  for (let x = GAME_AREA_X; x <= GAME_AREA_X + GRID_WIDTH * CELL_SIZE; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, GAME_AREA_Y); ctx.lineTo(x, GAME_AREA_Y + GRID_HEIGHT * CELL_SIZE); ctx.stroke();
  }
  for (let y = GAME_AREA_Y; y <= GAME_AREA_Y + GRID_HEIGHT * CELL_SIZE; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(GAME_AREA_X, y); ctx.lineTo(GAME_AREA_X + GRID_WIDTH * CELL_SIZE, y); ctx.stroke();
  }
  ctx.restore();

  // Border
  ctx.strokeStyle = theme ? theme.border : COLORS.BORDER;
  ctx.lineWidth = 4;
  ctx.strokeRect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);

  ctx.strokeStyle = 'rgba(2, 6, 23, 0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(GAME_AREA_X + 5, GAME_AREA_Y + 5, GRID_WIDTH * CELL_SIZE - 10, GRID_HEIGHT * CELL_SIZE - 10);
  
  // Bonus Food
  if (bonusFood) {
      const cx = GAME_AREA_X + bonusFood.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = GAME_AREA_Y + bonusFood.y * CELL_SIZE + CELL_SIZE / 2;
      
      const t = Date.now();
      const timeLeft = bonusFood.duration - (t - bonusFood.spawnTime);
      
      // Blink when expiring
      if (timeLeft < 1500 && Math.floor(t / 100) % 2 === 0) {
          // Skip drawing
      } else {
          // Draw Star Shape
          const spikes = 5;
          const outerRadius = CELL_SIZE / 2 - 2;
          const innerRadius = outerRadius / 2;
          
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t / 500); // Spin
          
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
              const r = i % 2 === 0 ? outerRadius : innerRadius;
              const a = (Math.PI * i) / spikes - Math.PI / 2;
              ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          
          const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, outerRadius);
          grad.addColorStop(0, '#fef3c7');
          grad.addColorStop(1, '#f59e0b');
          ctx.fillStyle = grad;
          ctx.fill();
          
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          ctx.restore();
      }
  }

  // Snake
  (Array.isArray(snake) ? snake.slice().reverse() : []).forEach((segment, reversedIndex) => {
    const index = snake.length - 1 - reversedIndex;
    const cx = GAME_AREA_X + segment.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = GAME_AREA_Y + segment.y * CELL_SIZE + CELL_SIZE / 2;
    
    // Tapering size for tail
    let size = CELL_SIZE - 2;
    if (snake.length > 5 && index > snake.length - 4) {
        const reduction = (index - (snake.length - 4)) * 3;
        size = Math.max(6, size - reduction);
    }

    if (index === 0) { // Head
      const happy = Date.now() < happyUntil;
      const headPulse = happy ? 1.08 + 0.04 * Math.sin(frameCounter * 0.8) : 1;
      const headSize = (CELL_SIZE + 6) * headPulse; // Cute oversized head
      
      // Head Gradient
      const grad = ctx.createRadialGradient(cx - 6, cy - 7, 3, cx, cy, headSize/2);
      const colors = SKINS[currentSkin] ? SKINS[currentSkin].head : SKINS['default'].head;
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      
      // Draw Head Shape
      ctx.beginPath();
      ctx.arc(cx, cy, headSize/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.24)';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Soft cheek patches
      const dirVec = getDirectionVector(direction);
      const sideVec = { x: -dirVec.y, y: dirVec.x };
      ctx.fillStyle = 'rgba(255, 183, 197, 0.56)';
      ctx.beginPath();
      ctx.arc(cx + sideVec.x * 6 - dirVec.x * 1, cy + sideVec.y * 6 - dirVec.y * 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - sideVec.x * 6 - dirVec.x * 1, cy - sideVec.y * 6 - dirVec.y * 1, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Eyes Configuration
      const eyeSize = happy ? 6.1 : 5.8;
      const eyeOffset = 7.5;
      let lx = cx, ly = cy, rx = cx, ry = cy;
      let dx = 0, dy = 0; // Pupil offset

      if (direction === 'UP') {
        lx -= eyeOffset; ly -= 5; rx += eyeOffset; ry -= 5; dy = -2.5;
      } else if (direction === 'DOWN') {
        lx -= eyeOffset; ly += 5; rx += eyeOffset; ry += 5; dy = 2.5;
      } else if (direction === 'LEFT') {
        lx -= 5; ly -= eyeOffset; rx -= 5; ry += eyeOffset; dx = -2.5;
      } else { // RIGHT
        lx += 5; ly -= eyeOffset; rx += 5; ry += eyeOffset; dx = 2.5;
      }

      if (happy) {
        dx *= 0.65;
        dy *= 0.65;
      }

      // Eye Whites (Sclera)
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 2;
      ctx.beginPath(); ctx.arc(lx, ly, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ry, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Pupils (Black)
      ctx.fillStyle = '#1e293b';
      const pupilSize = happy ? 2.8 : 3.2;
      ctx.beginPath(); ctx.arc(lx + dx, ly + dy, pupilSize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx + dx, ry + dy, pupilSize, 0, Math.PI * 2); ctx.fill();
      
      // Eye Highlights (Kawaii shine)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lx - 1.5, ly - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx - 1.5, ry - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();

      // Tiny smile
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.58)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx + dirVec.x * 4, cy + dirVec.y * 4 + 1, happy ? 4.2 : 3.2, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Tongue
      if (frameCounter % 60 < 30) { // Flickering effect
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          const vx = dirVec.x;
          const vy = dirVec.y;
          const px = -vy;
          const py = vx;
          const baseX = cx + vx * 8;
          const baseY = cy + vy * 8;
          const tipX = cx + vx * 15;
          const tipY = cy + vy * 15;
          ctx.moveTo(baseX, baseY);
          ctx.lineTo(tipX, tipY);
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX + vx * 5 + px * 3, tipY + vy * 5 + py * 3);
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX + vx * 5 - px * 3, tipY + vy * 5 - py * 3);
          ctx.stroke();
          ctx.lineCap = 'butt';
      }

    } else { // Body
      // Draw Connector to previous segment to avoid gaps
      if (index > 0) {
          const prev = snake[index - 1];
          const px = GAME_AREA_X + prev.x * CELL_SIZE + CELL_SIZE / 2;
          const py = GAME_AREA_Y + prev.y * CELL_SIZE + CELL_SIZE / 2;
          
          // Only draw connector if close (not wrapped)
          if (Math.abs(prev.x - segment.x) <= 1 && Math.abs(prev.y - segment.y) <= 1) {
              const colors = SKINS[currentSkin] ? SKINS[currentSkin].color : SKINS['default'].color;
              ctx.lineWidth = Math.max(6, size * 0.82);
              ctx.lineCap = 'round';
              ctx.strokeStyle = adjustColor(colors[1], -8);
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(cx, cy);
              ctx.stroke();
              ctx.lineCap = 'butt';
          }
      }

      const wiggle = Math.sin(frameCounter * 0.18 + index * 0.75) * 0.55;
      const bodySize = (index === snake.length - 1 ? Math.max(7, size * 0.82) : size) + wiggle;
      const grad = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, bodySize/2);
      const colors = SKINS[currentSkin] ? SKINS[currentSkin].color : SKINS['default'].color;
      
      // Pattern: Alternating slightly
      if (index % 2 === 0) {
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1]);
      } else {
          grad.addColorStop(0, adjustColor(colors[0], -10));
          grad.addColorStop(1, adjustColor(colors[1], -10));
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, bodySize/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + bodySize * 0.14, bodySize * 0.25, bodySize * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Body Shine (Top Left)
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(cx - bodySize * 0.24, cy - bodySize * 0.26, bodySize * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Game Particles
  gameParticles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
  });
  
  // Food
  if (!food || typeof food.x !== 'number' || typeof food.y !== 'number') return;
  const cx = GAME_AREA_X + food.x * CELL_SIZE + CELL_SIZE / 2;
  const cy = GAME_AREA_Y + food.y * CELL_SIZE + CELL_SIZE / 2;
  const t = Date.now();
  const pulse = 1 + 0.08 * Math.sin((t % 800) / 800 * Math.PI * 2);
  const rBase = CELL_SIZE / 2 - 2;
  const rMax = CELL_SIZE / 2 - 1;
  const rCoin = Math.min(rMax, rBase * pulse);
  drawCoin(cx, cy, rCoin);
}

function drawStartScreen() {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  
  // Draw Background Grid
  const gridSize = 40;
  const offset = (Date.now() / 50) % gridSize;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  // Vertical lines
  for (let x = offset; x < SCREEN_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SCREEN_HEIGHT);
      ctx.stroke();
  }
  // Horizontal lines
  for (let y = offset; y < SCREEN_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SCREEN_WIDTH, y);
      ctx.stroke();
  }

  // Draw Floating Particles
  bgParticles.forEach(p => {
    p.y += p.speed;
    if (p.y > SCREEN_HEIGHT) {
      p.y = -10;
      p.x = Math.random() * SCREEN_WIDTH;
    }
    
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(p.x, p.y, p.size, p.size); // Pixel style squares
    ctx.globalAlpha = 1.0;
  });

  // Title with simple pulse
  const pulse = 1 + 0.05 * Math.sin(Date.now() / 500);
  ctx.save();
  ctx.translate(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 140);
  ctx.scale(pulse, pulse);
  drawArtTitle("超级贪贪贪吃蛇", 0, 0);
  ctx.restore();
  
  // Start Button
  const btnW = 220;
  const btnH = 70;
  const btnX = (SCREEN_WIDTH - btnW) / 2;
  const btnY = SCREEN_HEIGHT / 2 + 40;
  
  // Button Jelly Animation
  const tBtn = Date.now() / 150;
  const scaleX = 1 + 0.05 * Math.sin(tBtn);
  const scaleY = 1 + 0.05 * Math.cos(tBtn);
  const centerX = btnX + btnW / 2;
  const centerY = btnY + btnH / 2;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -centerY);

  // Button Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  drawRoundRect(ctx, btnX + 4, btnY + 8, btnW, btnH, 35);
  ctx.fill();

  // Button Body Gradient
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  btnGrad.addColorStop(0, '#ff9a44');
  btnGrad.addColorStop(1, '#e75c10');
  
  ctx.fillStyle = btnGrad;
  drawRoundRect(ctx, btnX, btnY, btnW, btnH, 35);
  ctx.fill();
  
  // Button Border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Text
  ctx.fillStyle = '#fff';
  ctx.font = "900 32px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowOffsetY = 2;
  ctx.fillText("开始游戏", centerX, centerY);
  
  ctx.restore();

  // Intro Button (Text Link Style)
  const introBtnH = 30;
  const introBtnY = btnY + btnH + 90;

  ctx.textAlign = "center";
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = "bold 16px Arial";
  ctx.fillText("游戏介绍", SCREEN_WIDTH / 2, introBtnY + introBtnH / 2);

  // Underline
  const textWidth = ctx.measureText("游戏介绍").width;
  const lineY = introBtnY + introBtnH / 2 + 10;
  ctx.beginPath();
  ctx.moveTo(SCREEN_WIDTH / 2 - textWidth / 2, lineY);
  ctx.lineTo(SCREEN_WIDTH / 2 + textWidth / 2, lineY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // New System Buttons (Shop & Achievements)
  const sysBtnW = 100;
  const sysBtnH = 40;
  const gap = 20;
  const sysBtnY = btnY + btnH + 30;
  const shopX = SCREEN_WIDTH / 2 - sysBtnW - gap/2;
  const achX = SCREEN_WIDTH / 2 + gap/2;
  
  // Shop Button
  drawSystemButton(ctx, shopX, sysBtnY, sysBtnW, sysBtnH, '🛒 商店', '#ec4899');
  
  // Achievement Button
  drawSystemButton(ctx, achX, sysBtnY, sysBtnW, sysBtnH, '🏆 成就', '#8b5cf6');

  // Currency Display
  ctx.fillStyle = '#fbbf24';
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`💰 ${totalCoins}`, SCREEN_WIDTH - 20, 40 + SAFE_AREA_TOP);


}

function drawSystemButton(ctx, x, y, w, h, text, color) {
    // Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
    drawRoundRect(ctx, x + 2, y + 5, w, h, 16);
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, adjustColor(color, 18));
    grad.addColorStop(1, adjustColor(color, -8));
    ctx.fillStyle = grad;
    drawRoundRect(ctx, x, y, w, h, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w/2, y + h/2 + 1);
    ctx.textBaseline = "alphabetic";
}

function drawMiniButton(x, y, w, h, text, color, disabled) {
    ctx.fillStyle = disabled ? 'rgba(15, 23, 42, 0.3)' : 'rgba(2, 6, 23, 0.2)';
    drawRoundRect(ctx, x + 1.5, y + 3, w, h, 12);
    ctx.fill();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (disabled) {
        grad.addColorStop(0, '#64748b');
        grad.addColorStop(1, '#475569');
    } else {
        grad.addColorStop(0, adjustColor(color, 18));
        grad.addColorStop(1, adjustColor(color, -10));
    }
    ctx.fillStyle = grad;
    drawRoundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(203, 213, 225, 0.32)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = disabled ? '#e2e8f0' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 12px Arial";
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
}

function drawLockIcon(x, y, size, color) {
    const bodyW = size * 0.68;
    const bodyH = size * 0.46;
    const bodyX = x - bodyW / 2;
    const bodyY = y - bodyH / 2 + size * 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, bodyY, size * 0.25, Math.PI, 0, false);
    ctx.stroke();
    ctx.fillStyle = color;
    drawRoundRect(ctx, bodyX, bodyY, bodyW, bodyH, size * 0.09);
    ctx.fill();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.beginPath();
    ctx.arc(x, bodyY + bodyH * 0.42, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';
}

function drawShopScreen() {
    drawModalBase('商店');
    
    const boxH = SCREEN_HEIGHT * 0.8;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    const coinPillW = 132;
    const coinPillH = 30;
    const coinPillX = (SCREEN_WIDTH - coinPillW) / 2;
    const coinPillY = boxY + 50;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
    drawRoundRect(ctx, coinPillX, coinPillY, coinPillW, coinPillH, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`金币 ${totalCoins}`, SCREEN_WIDTH / 2, coinPillY + coinPillH / 2 + 1);
    ctx.textBaseline = "alphabetic";

    const startY = boxY + 88; // Start below title and coin balance
    const endY = boxY + boxH - 80; // End above close button (more padding)
    const itemH = 70;
    const itemW = Math.min(310, SCREEN_WIDTH * 0.78);
    
    let currentY = startY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, startY - 8, SCREEN_WIDTH, endY - startY + 16);
    ctx.clip();
    ctx.translate(0, shopScrollY);
    
    Object.keys(SKINS).forEach((key, index) => {
        // Only draw if within content area
        if (currentY + shopScrollY + itemH >= startY - 8 && currentY + shopScrollY <= endY + 8) {
            const y = currentY;
            const x = (SCREEN_WIDTH - itemW) / 2;
            
            // Item bg
            const itemGrad = ctx.createLinearGradient(x, y, x, y + itemH);
            if (key === currentSkin) {
                itemGrad.addColorStop(0, 'rgba(20, 184, 166, 0.34)');
                itemGrad.addColorStop(1, 'rgba(14, 116, 144, 0.22)');
            } else {
                itemGrad.addColorStop(0, 'rgba(30, 41, 59, 0.62)');
                itemGrad.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
            }
            ctx.fillStyle = itemGrad;
            drawRoundRect(ctx, x, y, itemW, itemH, 14);
            ctx.fill();
            
            if (key === currentSkin) {
                ctx.strokeStyle = '#5eead4';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Preview Circle
            const grad = ctx.createRadialGradient(x + 40, y + 35, 2, x + 40, y + 35, 22);
            grad.addColorStop(0, SKINS[key].head[0]);
            grad.addColorStop(1, SKINS[key].head[1]);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x + 40, y + 35, 22, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Name
            ctx.fillStyle = '#fff';
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "left";
            ctx.fillText(SKINS[key].name, x + 78, y + 31);

            const isUnlocked = unlockedSkins.includes(key);
            ctx.fillStyle = isUnlocked ? '#99f6e4' : '#cbd5e1';
            ctx.font = "12px Arial";
            ctx.fillText(isUnlocked ? '已解锁' : `需要 ${SKINS[key].price} 金币`, x + 78, y + 52);
            
            // Price/Status
            const btnW = 68;
            const btnH = 30;
            const btnX = x + itemW - btnW - 16;
            const btnY = y + 20;
            
            if (key === currentSkin) {
                ctx.fillStyle = '#5eead4';
                ctx.font = "bold 14px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText('使用中', btnX + btnW/2, btnY + btnH/2 + 1);
                ctx.textBaseline = "alphabetic";
            } else if (isUnlocked) {
                drawMiniButton(btnX, btnY, btnW, btnH, '装备', '#0ea5e9', false);
            } else {
                const canBuy = totalCoins >= SKINS[key].price;
                drawMiniButton(btnX, btnY, btnW, btnH, '购买', '#f59e0b', !canBuy);
            }
        }
        currentY += (itemH + 15);
    });

    ctx.restore();

    const contentH = Object.keys(SKINS).length * (itemH + 15) - 15;
    const viewH = endY - startY;
    if (contentH > viewH) {
        const trackH = viewH;
        const thumbH = Math.max(36, viewH * viewH / contentH);
        const maxScroll = contentH - viewH;
        const thumbY = startY + (-shopScrollY / maxScroll) * (trackH - thumbH);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        drawRoundRect(ctx, SCREEN_WIDTH * 0.93, startY, 4, trackH, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        drawRoundRect(ctx, SCREEN_WIDTH * 0.93, thumbY, 4, thumbH, 2);
        ctx.fill();
    }
}

function drawAchievementsScreen() {
    drawModalBase('成就');
    
    const boxH = SCREEN_HEIGHT * 0.8;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    const startY = boxY + 70;
    const endY = boxY + boxH - 80;
    const itemH = 70;
    const itemW = Math.min(310, SCREEN_WIDTH * 0.78);
    
    let currentY = startY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, startY - 8, SCREEN_WIDTH, endY - startY + 16);
    ctx.clip();
    ctx.translate(0, achievementScrollY);
    
    achievements.forEach((ach, index) => {
        if (currentY + achievementScrollY + itemH >= startY - 8 && currentY + achievementScrollY <= endY + 8) {
            const y = currentY;
            const x = (SCREEN_WIDTH - itemW) / 2;
            
            // Item bg
            const itemGrad = ctx.createLinearGradient(x, y, x, y + itemH);
            if (ach.unlocked) {
                itemGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
                itemGrad.addColorStop(1, 'rgba(120, 53, 15, 0.16)');
            } else {
                itemGrad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
                itemGrad.addColorStop(1, 'rgba(30, 41, 59, 0.44)');
            }
            ctx.fillStyle = itemGrad;
            drawRoundRect(ctx, x, y, itemW, itemH, 14);
            ctx.fill();
            
            if (ach.unlocked) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Icon
            ctx.fillStyle = ach.unlocked ? 'rgba(251, 191, 36, 0.18)' : 'rgba(100, 116, 139, 0.18)';
            ctx.beginPath();
            ctx.arc(x + 40, y + 35, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = ach.unlocked ? 'rgba(251, 191, 36, 0.55)' : 'rgba(148, 163, 184, 0.28)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (ach.unlocked) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = "26px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText('🏆', x + 40, y + 36);
                ctx.textBaseline = "alphabetic";
            } else {
                drawLockIcon(x + 40, y + 36, 28, '#94a3b8');
            }
            
            // Text
            ctx.textAlign = "left";
            ctx.fillStyle = ach.unlocked ? '#fde68a' : '#e2e8f0';
            ctx.font = "bold 16px Arial";
            ctx.fillText(ach.name, x + 80, y + 30);
            
            ctx.fillStyle = ach.unlocked ? '#fef3c7' : '#94a3b8';
            ctx.font = "12px Arial";
            ctx.fillText(ach.desc, x + 80, y + 50);
            
            // Reward
            if (!ach.unlocked) {
                ctx.textAlign = "right";
                ctx.fillStyle = '#fbbf24';
                ctx.font = "bold 14px Arial";
                ctx.fillText(`+${ach.reward}`, x + itemW - 20, y + 40);
            } else {
                ctx.textAlign = "right";
                ctx.fillStyle = '#5eead4';
                ctx.font = "bold 14px Arial";
                ctx.fillText(`已领取`, x + itemW - 20, y + 40);
            }
        }
        currentY += (itemH + 15);
    });

    ctx.restore();

    const contentH = achievements.length * (itemH + 15) - 15;
    const viewH = endY - startY;
    if (contentH > viewH) {
        const trackH = viewH;
        const thumbH = Math.max(36, viewH * viewH / contentH);
        const maxScroll = contentH - viewH;
        const thumbY = startY + (-achievementScrollY / maxScroll) * (trackH - thumbH);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        drawRoundRect(ctx, SCREEN_WIDTH * 0.93, startY, 4, trackH, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        drawRoundRect(ctx, SCREEN_WIDTH * 0.93, thumbY, 4, thumbH, 2);
        ctx.fill();
    }
}

function drawModalBase(title) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = SCREEN_WIDTH * 0.9;
    const boxH = SCREEN_HEIGHT * 0.8; // Increased height to 0.8
    const boxX = (SCREEN_WIDTH - boxW)/2;
    const boxY = (SCREEN_HEIGHT - boxH)/2;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.38)';
    drawRoundRect(ctx, boxX + 8, boxY + 10, boxW, boxH, 22);
    ctx.fill();
    
    // Panel Background
    const panelGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    panelGrad.addColorStop(0, '#164e63');
    panelGrad.addColorStop(0.45, '#0f172a');
    panelGrad.addColorStop(1, '#111827');
    ctx.fillStyle = panelGrad;
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, boxX + 5, boxY + 5, boxW - 10, boxH - 10, 18);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = "900 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, SCREEN_WIDTH/2, boxY + 40);

    ctx.fillStyle = 'rgba(125, 211, 252, 0.38)';
    drawRoundRect(ctx, boxX + 24, boxY + 56, boxW - 48, 2, 1);
    ctx.fill();
    
    // Close Button
    const btnW = 100;
    const btnH = 36;
    const btnX = (SCREEN_WIDTH - btnW)/2;
    const btnY = boxY + boxH - 50;
    
    drawMiniButton(btnX, btnY, btnW, btnH, '关闭', '#0ea5e9', false);
}

function drawGameOverScreen() {
  drawGameOverPanel();
}

function drawPauseScreen() {
  drawOverlay("游戏暂停", "继续游戏");
}

function drawGameOverPanel() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const boxW = Math.min(330, SCREEN_WIDTH * 0.88);
    const boxH = 330;
    const boxX = (SCREEN_WIDTH - boxW) / 2;
    const boxY = (SCREEN_HEIGHT - boxH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawRoundRect(ctx, boxX + 8, boxY + 8, boxW, boxH, 20);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();

    ctx.strokeStyle = wasNewHighScoreThisRun ? '#fbbf24' : '#3b82f6';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = "900 30px Arial";
    ctx.fillText('游戏结束', SCREEN_WIDTH / 2, boxY + 48);

    ctx.fillStyle = '#94a3b8';
    ctx.font = "bold 14px Arial";
    ctx.fillText('本局得分', SCREEN_WIDTH / 2, boxY + 82);

    ctx.fillStyle = '#fbbf24';
    ctx.font = "900 42px Arial";
    ctx.fillText(score.toString().padStart(4, '0'), SCREEN_WIDTH / 2, boxY + 124);

    if (wasNewHighScoreThisRun) {
        ctx.fillStyle = Math.floor(Date.now() / 250) % 2 === 0 ? '#fef3c7' : '#f59e0b';
        ctx.font = "bold 16px Arial";
        ctx.fillText('NEW RECORD!', SCREEN_WIDTH / 2, boxY + 148);
    } else {
        ctx.fillStyle = '#64748b';
        ctx.font = "bold 13px Arial";
        ctx.fillText(`历史最高 ${previousHighScoreThisRun}`, SCREEN_WIDTH / 2, boxY + 148);
    }

    const statY = boxY + 184;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    drawRoundRect(ctx, boxX + 24, statY - 24, boxW - 48, 48, 12);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = "bold 15px Arial";
    ctx.textAlign = 'left';
    ctx.fillText(`用时 ${formatDuration(gameDurationMs)}`, boxX + 42, statY + 5);
    ctx.textAlign = 'right';
    ctx.fillText(`金币 +${coinsEarnedThisRun}`, boxX + boxW - 42, statY + 5);

    ctx.textAlign = 'center';
    if (newAchievementsThisRun.length > 0) {
        const names = newAchievementsThisRun.slice(0, 2).map(a => a.name).join('、');
        const suffix = newAchievementsThisRun.length > 2 ? ` 等${newAchievementsThisRun.length}项` : '';
        ctx.fillStyle = '#4ade80';
        ctx.font = "bold 14px Arial";
        ctx.fillText(`成就解锁：${names}${suffix}`, SCREEN_WIDTH / 2, boxY + 232);
    } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = "14px Arial";
        ctx.fillText('继续挑战，离下个奖励更近一步', SCREEN_WIDTH / 2, boxY + 232);
    }

    const btnGap = 14;
    const btnW = (boxW - 56 - btnGap) / 2;
    const btnH = 50;
    const btnY = boxY + boxH - 72;
    drawActionButton(boxX + 28, btnY, btnW, btnH, '再来一局', '#f97316');
    drawActionButton(boxX + 28 + btnW + btnGap, btnY, btnW, btnH, '回主菜单', '#3b82f6');
}

function drawActionButton(x, y, w, h, text, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawRoundRect(ctx, x + 2, y + 4, w, h, 18);
    ctx.fill();
    ctx.fillStyle = color;
    drawRoundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 17px Arial";
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
}

function drawHelpScreen() {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = SCREEN_WIDTH * 0.85;
    const boxH = 420; // Increased height
    const boxX = (SCREEN_WIDTH - boxW)/2;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    // Panel Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.38)';
    drawRoundRect(ctx, boxX + 8, boxY + 10, boxW, boxH, 22);
    ctx.fill();

    // Panel Background
    const panelGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    panelGrad.addColorStop(0, '#164e63');
    panelGrad.addColorStop(0.45, '#0f172a');
    panelGrad.addColorStop(1, '#111827');
    ctx.fillStyle = panelGrad;
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.fill();
    
    // Panel Border
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, boxX + 5, boxY + 5, boxW - 10, boxH - 10, 18);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.font = '900 26px Arial';
    ctx.fillText('游戏介绍', SCREEN_WIDTH/2, boxY + 50);
    ctx.fillStyle = 'rgba(125, 211, 252, 0.38)';
    drawRoundRect(ctx, boxX + 24, boxY + 66, boxW - 48, 2, 1);
    ctx.fill();
    
    // Content
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    const startX = boxX + 40;
    const lineHeight = 40;
    const contentY = boxY + 96;

    const items = [
        { icon: '🎮', text: '滑动屏幕控制移动方向' },
        { icon: '⚡', text: '长按屏幕右侧进行加速' },
        { icon: '⏸', text: '轻点屏幕暂停/继续游戏' },
        { icon: '🪙', text: '吃掉金币得分并积累财富' },
        { icon: '🛒', text: '商店购买解锁更多皮肤' },
        { icon: '🏆', text: '完成成就获取丰厚奖励' }
    ];

    items.forEach((item, index) => {
        const y = contentY + index * lineHeight;
        ctx.fillStyle = '#fbbf24'; // Icon color
        ctx.fillText(item.icon, startX, y);
        ctx.fillStyle = '#e2e8f0'; // Text color
        ctx.fillText(item.text, startX + 35, y);
    });
    
    const btnW = 120;
    const btnH = 40;
    const btnX = (SCREEN_WIDTH - btnW)/2;
    const btnY = boxY + boxH - 70;
    drawMiniButton(btnX, btnY, btnW, btnH, '我知道了', '#0ea5e9', false);
}

function drawArtTitle(text, x, y) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 44px Arial";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 10;
  ctx.strokeText(text, x, y);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.strokeText(text, x, y);
  const grd = ctx.createLinearGradient(0, y - 30, 0, y + 30);
  grd.addColorStop(0, "#ff6b6b");
  grd.addColorStop(1, "#d00000");
  ctx.fillStyle = grd;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Helper for rounded rect (canvas compatibility)
function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawOverlay(title, btnText) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = 300;
    const boxH = 220;
    const boxX = (SCREEN_WIDTH - boxW) / 2;
    const boxY = (SCREEN_HEIGHT - boxH) / 2;
    
    // Modal shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawRoundRect(ctx, boxX + 8, boxY + 8, boxW, boxH, 20);
    ctx.fill();

    // Modal background
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    
    // Modal border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 16);
    ctx.stroke();

    // Draw Title
    drawArtTitle(title, SCREEN_WIDTH / 2, boxY + 70);
    
    // Button
    const btnW = 180;
    const btnH = 54;
    const btnX = (SCREEN_WIDTH - btnW) / 2;
    const btnY = boxY + boxH - 80;
    
    // Button shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawRoundRect(ctx, btnX + 3, btnY + 5, btnW, btnH, 27);
    ctx.fill();

    // Button gradient
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#ff9a44');
    btnGrad.addColorStop(1, '#e75c10');
    
    ctx.fillStyle = btnGrad;
    drawRoundRect(ctx, btnX, btnY, btnW, btnH, 27);
    ctx.fill();
    
    // Button Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Button highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    drawRoundRect(ctx, btnX + 8, btnY + 4, btnW - 16, btnH/2 - 2, 14);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 22px Arial";
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowOffsetY = 2;
    ctx.fillText(btnText, SCREEN_WIDTH / 2, btnY + btnH / 2);
    ctx.shadowOffsetY = 0; // reset shadow
}

// Input Handling
function handleTouchStart(e) {
  const t = e.touches[0];
  startedThisTouch = false;
  scrollDragging = false;
  activeScrollPanel = null;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();

  if (showHelp) {
      // Check OK Button
      const boxW = SCREEN_WIDTH * 0.85;
      const boxH = 420; // Increased height to match drawHelpScreen
      const boxY = (SCREEN_HEIGHT - boxH)/2;
      const btnW = 120;
      const btnH = 44;
      const btnX = (SCREEN_WIDTH - btnW)/2;
      const btnY = boxY + boxH - 70;
      
      const helpRect = getModalRect(0.85, 420 / SCREEN_HEIGHT);
      if (!isPointInRect(touchStartX, touchStartY, helpRect)) {
          vibrate();
          showHelp = false;
          startedThisTouch = true;
          return;
      }

      if (touchStartX >= btnX && touchStartX <= btnX + btnW &&
          touchStartY >= btnY && touchStartY <= btnY + btnH) {
          vibrate();
          showHelp = false;
          startedThisTouch = true;
      }
      return;
  }

  if (showShop) {
      const metrics = getScrollablePanelMetrics('shop');
      const boxX = metrics.box.x;
      const boxY = metrics.box.y;
      const boxH = metrics.box.h;
      const startY = metrics.startY;
      const itemH = metrics.itemH;

      if (!isPointInRect(touchStartX, touchStartY, metrics.box)) {
          vibrate();
          showShop = false;
          startedThisTouch = true;
          return;
      }
      
      // Close Button
      const closeBtnW = 100;
      const closeBtnH = 36;
      const closeBtnX = (SCREEN_WIDTH - closeBtnW)/2;
      const closeBtnY = boxY + boxH - 50;
      
      if (touchStartX >= closeBtnX && touchStartX <= closeBtnX + closeBtnW &&
          touchStartY >= closeBtnY && touchStartY <= closeBtnY + closeBtnH) {
          vibrate();
          showShop = false;
          startedThisTouch = true;
          return;
      }

      if (touchStartY >= metrics.startY && touchStartY <= metrics.endY) {
          scrollDragging = true;
          activeScrollPanel = 'shop';
          scrollLastY = touchStartY;
      }
      
      // Shop Items
      Object.keys(SKINS).forEach((key, index) => {
          const y = startY + index * (itemH + 15) + shopScrollY;
          const itemW = Math.min(310, SCREEN_WIDTH * 0.78);
          const x = (SCREEN_WIDTH - itemW) / 2;
          const btnW = 68;
          const btnX = x + itemW - btnW - 16;
          const btnY = y + 20;
          const btnH = 30;
          
          if (touchStartX >= btnX && touchStartX <= btnX + btnW &&
              touchStartY >= btnY && touchStartY <= btnY + btnH) {
              vibrate();
              
              if (unlockedSkins.includes(key)) {
                  // Equip
                  currentSkin = key;
                  wx.setStorageSync('snake_current_skin', currentSkin);
                  wx.showToast({ title: '已装备', icon: 'success' });
              } else {
                  // Buy
                  const price = SKINS[key].price;
                  if (totalCoins >= price) {
                      totalCoins -= price;
                      unlockedSkins.push(key);
                      currentSkin = key;
                      wx.setStorageSync('snake_coins', totalCoins);
                      wx.setStorageSync('snake_skins', JSON.stringify(unlockedSkins));
                      wx.setStorageSync('snake_current_skin', currentSkin);
                      wx.showToast({ title: '购买成功', icon: 'success' });
                  } else {
                      wx.showToast({ title: '金币不足', icon: 'none' });
                  }
              }
              startedThisTouch = true;
          }
      });
      return;
  }

  if (showAchievements) {
      const metrics = getScrollablePanelMetrics('achievements');
      const boxX = metrics.box.x;
      const boxY = metrics.box.y;
      const boxH = metrics.box.h;

      if (!isPointInRect(touchStartX, touchStartY, metrics.box)) {
          vibrate();
          showAchievements = false;
          startedThisTouch = true;
          return;
      }
      
      const closeBtnW = 100;
      const closeBtnH = 36;
      const closeBtnX = (SCREEN_WIDTH - closeBtnW)/2;
      const closeBtnY = boxY + boxH - 50;
      
      if (touchStartX >= closeBtnX && touchStartX <= closeBtnX + closeBtnW &&
          touchStartY >= closeBtnY && touchStartY <= closeBtnY + closeBtnH) {
          vibrate();
          showAchievements = false;
          startedThisTouch = true;
          return;
      }

      if (touchStartY >= metrics.startY && touchStartY <= metrics.endY) {
          scrollDragging = true;
          activeScrollPanel = 'achievements';
          scrollLastY = touchStartY;
      }
      return;
  }

  if (gameOver) {
      const boxW = Math.min(330, SCREEN_WIDTH * 0.88);
      const boxH = 330;
      const boxX = (SCREEN_WIDTH - boxW) / 2;
      const boxY = (SCREEN_HEIGHT - boxH) / 2;
      const btnGap = 14;
      const btnW = (boxW - 56 - btnGap) / 2;
      const btnH = 50;
      const btnY = boxY + boxH - 72;
      const replayRect = { x: boxX + 28, y: btnY, w: btnW, h: btnH };
      const menuRect = { x: boxX + 28 + btnW + btnGap, y: btnY, w: btnW, h: btnH };

      if (isPointInRect(touchStartX, touchStartY, replayRect)) {
          vibrate();
          startGame();
          startedThisTouch = true;
          return;
      }
      if (isPointInRect(touchStartX, touchStartY, menuRect)) {
          vibrate();
          gameOver = false;
          isPlaying = false;
          isPaused = false;
          startedThisTouch = true;
          return;
      }
      return;
  }

  if (!isPlaying) {
    // Start Screen
    const btnW = 220;
    const btnH = 70;
    const btnX = (SCREEN_WIDTH - btnW) / 2;
    const btnY = SCREEN_HEIGHT / 2 + 40;

    // Check Start Button
    if (touchStartX >= btnX && touchStartX <= btnX + btnW &&
        touchStartY >= btnY && touchStartY <= btnY + btnH) {
        vibrate();
        startGame();
        startedThisTouch = true;
        return;
    }

    // Check Intro Button
    const introBtnH = 30;
    const introBtnY = btnY + btnH + 90;

    if (touchStartX >= 0 && touchStartX <= SCREEN_WIDTH &&
        touchStartY >= introBtnY && touchStartY <= introBtnY + introBtnH) {
        vibrate();
        showHelp = true;
        startedThisTouch = true;
        return;
    }
    
    // Check System Buttons
    const sysBtnW = 100;
    const sysBtnH = 40;
    const gap = 20;
    const sysBtnY = btnY + btnH + 30;
    const shopX = SCREEN_WIDTH / 2 - sysBtnW - gap/2;
    const achX = SCREEN_WIDTH / 2 + gap/2;
    
    // Shop
    if (touchStartX >= shopX && touchStartX <= shopX + sysBtnW &&
        touchStartY >= sysBtnY && touchStartY <= sysBtnY + sysBtnH) {
        vibrate();
        showShop = true;
        shopScrollY = 0;
        startedThisTouch = true;
        return;
    }
    
    // Achievements
    if (touchStartX >= achX && touchStartX <= achX + sysBtnW &&
        touchStartY >= sysBtnY && touchStartY <= sysBtnY + sysBtnH) {
        vibrate();
        showAchievements = true;
        achievementScrollY = 0;
        startedThisTouch = true;
        return;
    }

    return;
  }
  if (isPaused) {
    isPaused = false;
    startedThisTouch = true;
    return;
  }
  // schedule long-press accelerate when pressing right half of screen
  if (isPlaying && !isPaused && touchStartX > SCREEN_WIDTH / 2) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressTimer = setTimeout(() => {
      if (isPlaying && !isPaused) {
        speed = Math.max(30, Math.floor(baseSpeed / 2));
        accelerating = true;
      }
    }, 400);
  }
}

function handleTouchMove(e) {
  const t = e.touches[0];
  if (scrollDragging && activeScrollPanel) {
    const dy = t.clientY - scrollLastY;
    if (activeScrollPanel === 'shop') {
      setPanelScroll('shop', shopScrollY + dy);
    } else {
      setPanelScroll('achievements', achievementScrollY + dy);
    }
    scrollLastY = t.clientY;
    startedThisTouch = true;
    return;
  }

  if (showHelp || showShop || showAchievements) return;

  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 10 && direction !== 'LEFT') nextDirection = 'RIGHT';
    if (dx < -10 && direction !== 'RIGHT') nextDirection = 'LEFT';
  } else {
    if (dy > 10 && direction !== 'UP') nextDirection = 'DOWN';
    if (dy < -10 && direction !== 'DOWN') nextDirection = 'UP';
  }
}

function handleTouchEnd(e) {
  if (scrollDragging) {
    scrollDragging = false;
    activeScrollPanel = null;
    return;
  }
  if (startedThisTouch) return;
  const t = e.changedTouches[0];
  const dt = Date.now() - touchStartTime;
  const dist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (accelerating) {
    speed = baseSpeed;
    accelerating = false;
  }
  if (dt < 200 && dist < 10 && isPlaying) {
    isPaused = !isPaused;
  }
}

function adjustColor(hex, amount) {
    let usePound = false;
    if (hex[0] === "#") {
        hex = hex.slice(1);
        usePound = true;
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let g = ((num >> 8) & 0x00FF) + amount;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    let b = (num & 0x0000FF) + amount;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// Start
init();
