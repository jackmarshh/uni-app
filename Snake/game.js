const { SCREEN_WIDTH, SCREEN_HEIGHT, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, COLORS } = require('./js/config.js');

// Initialize Canvas
// In Mini Game environment, 'canvas' is a global variable, but explicit creation is safer for some adapters
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
if (canvas && typeof canvas.width === 'number') canvas.width = SCREEN_WIDTH;
if (canvas && typeof canvas.height === 'number') canvas.height = SCREEN_HEIGHT;

function raf(cb) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  if (canvas && typeof canvas.requestAnimationFrame === 'function') return canvas.requestAnimationFrame(cb);
  if (wx && typeof wx.requestAnimationFrame === 'function') return wx.requestAnimationFrame(cb);
  return setTimeout(() => cb(Date.now()), 16);
}

// Game State
let snake = [];
let food = {};
let direction = 'RIGHT';
let nextDirection = 'RIGHT';
let score = 0;
let highScore = 0;
let gameLoop = null;
let isPlaying = false;
let isPaused = false;
let gameOver = false;
let showHelp = false;
let speed = 200; // ms
let baseSpeed = 200;
let lastTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let startedThisTouch = false;
let longPressTimer = null;
let accelerating = false;

// UI Layout
const GAME_AREA_X = (SCREEN_WIDTH - GRID_WIDTH * CELL_SIZE) / 2;
const GAME_AREA_Y = 100; // Top padding for header

// Assets
const marioFont = "bold 20px Arial"; // Fallback font

function init() {
  // Load high score
  try {
    const value = wx.getStorageSync('snake_high_score');
    if (value) highScore = value;
  } catch (e) {}
  
  snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  food = spawnFood();
  baseSpeed = 200;
  speed = baseSpeed;
  lastTime = 0;
  isPlaying = false;
  isPaused = false;
  gameOver = false;
  showHelp = false;

  // Bind input
  wx.onTouchStart(handleTouchStart);
  wx.onTouchMove(handleTouchMove);
  wx.onTouchEnd(handleTouchEnd);
  
  // Create an offscreen canvas for better performance if needed, but simple drawing is fine
  
  // Game Loop
  const loop = () => {
    update();
    draw();
    raf(loop);
  };
  raf(loop);
}

function startGame() {
  snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  food = spawnFood();
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
}

function spawnFood() {
  let newFood;
  let valid = false;
  while (!valid) {
    newFood = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT)
    };
    valid = !snake.some(s => s.x === newFood.x && s.y === newFood.y);
  }
  return newFood;
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
      food = spawnFood();
      // Speed up every 50 points
      if (score % 50 === 0 && baseSpeed > 50) {
        baseSpeed -= 10;
        speed = baseSpeed;
      }
    } else {
      snake.pop();
    }
  }
}

function handleGameOver() {
  isPlaying = false;
  gameOver = true;
  if (score > highScore) {
    highScore = score;
    wx.setStorageSync('snake_high_score', highScore);
  }
}

// Drawing Functions
function draw() {
  if (!isPlaying && !gameOver) {
    drawStartScreen();
    return;
  }
  
  // Clear Screen
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  
  // Draw Header
  drawHeader();
  
  // Draw Game Area
  drawGameArea();
  
  // Overlays
  if (gameOver) drawGameOverScreen();
  if (isPaused) drawPauseScreen();
  if (showHelp) drawHelpScreen();
}

function drawHeader() {
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  
  // MARIO SCORE
  ctx.fillText("MARIO", SCREEN_WIDTH * 0.15, 30);
  ctx.font = "bold 18px Arial";
  ctx.fillText(score.toString().padStart(6, '0'), SCREEN_WIDTH * 0.15, 55);
  
  // COINS
  ctx.font = "bold 14px Arial";
  ctx.fillText("COINS", SCREEN_WIDTH * 0.4, 30);
  const iconX = SCREEN_WIDTH * 0.38;
  const iconY = 50;
  const r = 7.5;
  const g = ctx.createRadialGradient(iconX - 2, iconY - 2, 1, iconX, iconY, r);
  g.addColorStop(0, '#fff7b2');
  g.addColorStop(0.6, '#ffdf33');
  g.addColorStop(1, '#c7a100');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(iconX, iconY, r, 0, Math.PI * 2);
  ctx.fill();
  const a = (Date.now() % 1000) / 1000 * Math.PI * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(iconX + Math.cos(a) * r * 0.2, iconY + Math.sin(a) * r * 0.2);
  ctx.lineTo(iconX + Math.cos(a) * r * 0.9, iconY + Math.sin(a) * r * 0.9);
  ctx.moveTo(iconX + Math.cos(a + Math.PI/2) * r * 0.2, iconY + Math.sin(a + Math.PI/2) * r * 0.2);
  ctx.lineTo(iconX + Math.cos(a + Math.PI/2) * r * 0.9, iconY + Math.sin(a + Math.PI/2) * r * 0.9);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(iconX, iconY, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 18px Arial";
  ctx.fillText("x" + Math.floor(score / 10).toString().padStart(2, '0'), SCREEN_WIDTH * 0.45, 55);
  
  // WORLD
  ctx.font = "bold 14px Arial";
  ctx.fillText("WORLD", SCREEN_WIDTH * 0.65, 30);
  ctx.font = "bold 18px Arial";
  ctx.fillText("1-1", SCREEN_WIDTH * 0.65, 55);
  
  // TOP
  ctx.font = "bold 14px Arial";
  ctx.fillText("TOP", SCREEN_WIDTH * 0.85, 30);
  ctx.font = "bold 18px Arial";
  ctx.fillText(highScore.toString().padStart(6, '0'), SCREEN_WIDTH * 0.85, 55);
}

function drawGameArea() {
  // Background
  ctx.fillStyle = COLORS.GAME_BG;
  ctx.fillRect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  
  // Border
  ctx.strokeStyle = COLORS.BORDER;
  ctx.lineWidth = 4;
  ctx.strokeRect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  
  // Snake
  (Array.isArray(snake) ? snake : []).forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? COLORS.SNAKE_HEAD : COLORS.SNAKE_BODY;
    ctx.fillRect(
      GAME_AREA_X + segment.x * CELL_SIZE + 1, 
      GAME_AREA_Y + segment.y * CELL_SIZE + 1, 
      CELL_SIZE - 2, 
      CELL_SIZE - 2
    );
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
  const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, rCoin);
  grad.addColorStop(0, '#fff7b2');
  grad.addColorStop(0.6, '#ffdf33');
  grad.addColorStop(1, '#c7a100');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rCoin, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b08500';
  ctx.lineWidth = 2;
  ctx.stroke();
  const ang = (t % 1200) / 1200 * Math.PI * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ang) * rCoin * 0.2, cy + Math.sin(ang) * rCoin * 0.2);
  ctx.lineTo(cx + Math.cos(ang) * rCoin * 0.95, cy + Math.sin(ang) * rCoin * 0.95);
  ctx.moveTo(cx + Math.cos(ang + Math.PI/2) * rCoin * 0.2, cy + Math.sin(ang + Math.PI/2) * rCoin * 0.2);
  ctx.lineTo(cx + Math.cos(ang + Math.PI/2) * rCoin * 0.95, cy + Math.sin(ang + Math.PI/2) * rCoin * 0.95);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(cx - rCoin * 0.25, cy - rCoin * 0.25, rCoin * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawStartScreen() {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  
  // Decorative Snake
  const t = Date.now() / 1000;
  const startY = SCREEN_HEIGHT / 2 - 40;
  for (let i = 0; i < 8; i++) {
      const x = SCREEN_WIDTH / 2 - 80 + i * 20;
      const y = startY + Math.sin(t * 5 + i * 0.5) * 15;
      ctx.fillStyle = i === 7 ? COLORS.SNAKE_HEAD : COLORS.SNAKE_BODY;
      ctx.fillRect(x, y, 18, 18);
  }
  
  // Title
  drawArtTitle("超级贪贪贪吃蛇", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 200);
  
  // Start Button
  const btnW = 220;
  const btnH = 70;
  const btnX = (SCREEN_WIDTH - btnW) / 2;
  const btnY = SCREEN_HEIGHT / 2 + 80;
  
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
  
  // Button Inner Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  drawRoundRect(ctx, btnX + 10, btnY + 5, btnW - 20, btnH / 2 - 5, 20);
  ctx.fill();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = "900 32px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowOffsetY = 2;
  ctx.fillText("START GAME", centerX, centerY);
  
  ctx.restore();
  
  // Footer
  ctx.font = "14px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("© 2026 超级贪贪贪吃蛇", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30);
}

function drawGameOverScreen() {
  drawOverlay("GAME OVER", "TRY AGAIN");
}

function drawPauseScreen() {
  drawOverlay("PAUSED", "RESUME");
}

function drawHelpScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = SCREEN_WIDTH * 0.8;
    const boxH = 300;
    const boxX = (SCREEN_WIDTH - boxW)/2;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial';
  ctx.fillText('HOW TO PLAY', SCREEN_WIDTH/2, boxY + 40);
    
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    const startX = boxX + 40;
  ctx.fillText('🎮 滑动屏幕改变方向', startX, boxY + 90);
  ctx.fillText('⚡ 长按屏幕右侧加速', startX, boxY + 130);
  ctx.fillText('⏸ 轻点屏幕暂停/继续', startX, boxY + 170);
    ctx.fillText('🪙 吃金币得分并增长', startX, boxY + 210);
    
    // OK Button
    const btnW = 100;
    const btnH = 40;
    const btnX = (SCREEN_WIDTH - btnW)/2;
    const btnY = boxY + 240;
    ctx.fillStyle = '#e75c10';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('OK', SCREEN_WIDTH/2, btnY + 25);
}

function drawArtTitle(text, x, y) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 44px Arial";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawArtTitle(title, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);
  
  // Button
  const btnW = 200;
  const btnH = 50;
  const btnX = (SCREEN_WIDTH - btnW) / 2;
  const btnY = SCREEN_HEIGHT / 2 + 20;
  
  ctx.fillStyle = '#e75c10';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  
  ctx.fillStyle = '#fff';
  ctx.font = "bold 24px Arial";
  ctx.fillText(btnText, SCREEN_WIDTH / 2, btnY + 33);
}

// Input Handling
function handleTouchStart(e) {
  const t = e.touches[0];
  startedThisTouch = false;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
  if (!isPlaying) {
    startGame();
    startedThisTouch = true;
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

// Start
init();
