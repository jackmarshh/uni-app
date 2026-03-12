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
    'default': { name: '经典绿', price: 0, color: ['#4ade80', '#16a34a'], head: ['#86efac', '#22c55e'] },
    'gold': { name: '土豪金', price: 500, color: ['#fcd34d', '#d97706'], head: ['#fde047', '#b45309'] },
    'ice': { name: '冰川蓝', price: 1000, color: ['#60a5fa', '#2563eb'], head: ['#93c5fd', '#1d4ed8'] },
    'pink': { name: '樱花粉', price: 1500, color: ['#f472b6', '#db2777'], head: ['#fbcfe8', '#ec4899'] },
    'purple': { name: '魅影紫', price: 2000, color: ['#c084fc', '#7e22ce'], head: ['#d8b4fe', '#6b21a8'] },
    'red': { name: '火焰红', price: 3000, color: ['#f87171', '#dc2626'], head: ['#fca5a5', '#ef4444'] },
    'dark': { name: '暗夜黑', price: 5000, color: ['#475569', '#1e293b'], head: ['#64748b', '#334155'] }
};

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
  
  // Background Grid
  ctx.save();
  ctx.beginPath();
  ctx.rect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  ctx.clip();

  const gridSize = CELL_SIZE;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  for (let x = GAME_AREA_X; x <= GAME_AREA_X + GRID_WIDTH * CELL_SIZE; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, GAME_AREA_Y); ctx.lineTo(x, GAME_AREA_Y + GRID_HEIGHT * CELL_SIZE); ctx.stroke();
  }
  for (let y = GAME_AREA_Y; y <= GAME_AREA_Y + GRID_HEIGHT * CELL_SIZE; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(GAME_AREA_X, y); ctx.lineTo(GAME_AREA_X + GRID_WIDTH * CELL_SIZE, y); ctx.stroke();
  }
  ctx.restore();

  // Border
  ctx.strokeStyle = COLORS.BORDER;
  ctx.lineWidth = 4;
  ctx.strokeRect(GAME_AREA_X, GAME_AREA_Y, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  
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
  (Array.isArray(snake) ? snake : []).forEach((segment, index) => {
    const cx = GAME_AREA_X + segment.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = GAME_AREA_Y + segment.y * CELL_SIZE + CELL_SIZE / 2;
    
    // Tapering size for tail
    let size = CELL_SIZE - 2;
    if (snake.length > 5 && index > snake.length - 4) {
        const reduction = (index - (snake.length - 4)) * 3;
        size = Math.max(6, size - reduction);
    }

    if (index === 0) { // Head
      const headSize = CELL_SIZE + 2; // Slightly larger head
      
      // Head Gradient
      const grad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, headSize/2);
      const colors = SKINS[currentSkin] ? SKINS[currentSkin].head : SKINS['default'].head;
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      
      // Draw Head Shape
      ctx.beginPath();
      ctx.arc(cx, cy, headSize/2, 0, Math.PI * 2);
      ctx.fill();

      // Eyes Configuration
      const eyeSize = 5.5;
      const eyeOffset = 7;
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

      // Eye Whites (Sclera)
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 2;
      ctx.beginPath(); ctx.arc(lx, ly, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ry, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Pupils (Black)
      ctx.fillStyle = '#1e293b';
      const pupilSize = 3;
      ctx.beginPath(); ctx.arc(lx + dx, ly + dy, pupilSize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx + dx, ry + dy, pupilSize, 0, Math.PI * 2); ctx.fill();
      
      // Eye Highlights (Kawaii shine)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lx - 1.5, ly - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rx - 1.5, ry - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();

      // Tongue
      if (frameCounter % 60 < 30) { // Flickering effect
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const tx = cx + dx * 2.5;
          const ty = cy + dy * 2.5;
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + dx * 1.5, ty + dy * 1.5);
          
          // Fork
          // Not easy to calculate generic fork without vector math, simple line is fine for now
          ctx.stroke();
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
              ctx.fillStyle = colors[1]; // Darker color for connector/shadow
              ctx.lineWidth = size;
              ctx.strokeStyle = colors[1];
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(cx, cy);
              ctx.stroke();
          }
      }

      const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, size/2);
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
      ctx.arc(cx, cy, size/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Body Shine (Top Left)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(cx - size * 0.25, cy - size * 0.25, size * 0.2, 0, Math.PI * 2);
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
  
  // Button Inner Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; // Reduced opacity
  drawRoundRect(ctx, btnX + 10, btnY + 5, btnW - 20, btnH / 2 - 5, 20);
  ctx.fill();

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
  ctx.fillText(`💰 ${totalCoins}`, SCREEN_WIDTH - 20, 40);

  // Footer
  ctx.font = "14px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText("© 2026 超级贪贪贪吃蛇", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30);
}

function drawSystemButton(ctx, x, y, w, h, text, color) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawRoundRect(ctx, x + 2, y + 4, w, h, 15);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    drawRoundRect(ctx, x, y, w, h, 15);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    drawRoundRect(ctx, x + 5, y + 2, w - 10, h/2, 8);
    ctx.fill();

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, x + w/2, y + h/2 + 6);
}

function drawShopScreen() {
    drawModalBase('商店');
    
    const boxH = SCREEN_HEIGHT * 0.8;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    const startY = boxY + 70; // Start below title
    const endY = boxY + boxH - 80; // End above close button (more padding)
    const itemH = 70;
    const itemW = 300;
    
    let currentY = startY;
    
    Object.keys(SKINS).forEach((key, index) => {
        // Only draw if within content area
        if (currentY + itemH <= endY) {
            const y = currentY;
            const x = (SCREEN_WIDTH - itemW) / 2;
            
            // Item bg
            ctx.fillStyle = key === currentSkin ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.08)';
            drawRoundRect(ctx, x, y, itemW, itemH, 16);
            ctx.fill();
            
            if (key === currentSkin) {
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
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
            
            // Name
            ctx.fillStyle = '#fff';
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "left";
            ctx.fillText(SKINS[key].name, x + 80, y + 40);
            
            // Price/Status
            const isUnlocked = unlockedSkins.includes(key);
            const btnX = x + 210;
            const btnY = y + 20;
            const btnW = 70;
            const btnH = 30;
            
            if (key === currentSkin) {
                ctx.fillStyle = '#4ade80';
                ctx.font = "bold 14px Arial";
                ctx.textAlign = "center";
                ctx.fillText('已装备', btnX + btnW/2, y + 40);
            } else if (isUnlocked) {
                // Equip Button
                ctx.fillStyle = '#3b82f6';
                drawRoundRect(ctx, btnX, btnY, btnW, btnH, 15);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.textAlign = "center";
                ctx.font = "bold 12px Arial";
                ctx.fillText('装备', btnX + btnW/2, btnY + 20);
            } else {
                // Buy Button
                const canBuy = totalCoins >= SKINS[key].price;
                ctx.fillStyle = canBuy ? '#f59e0b' : '#475569';
                drawRoundRect(ctx, btnX, btnY, btnW, btnH, 15);
                ctx.fill();
                ctx.fillStyle = canBuy ? '#fff' : '#94a3b8';
                ctx.textAlign = "center";
                ctx.font = "bold 12px Arial";
                ctx.fillText(`💰 ${SKINS[key].price}`, btnX + btnW/2, btnY + 20);
            }
        }
        currentY += (itemH + 15);
    });
}

function drawAchievementsScreen() {
    drawModalBase('成就');
    
    const boxH = SCREEN_HEIGHT * 0.8;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    const startY = boxY + 70;
    const endY = boxY + boxH - 80;
    const itemH = 70;
    const itemW = 300;
    
    let currentY = startY;
    
    achievements.forEach((ach, index) => {
        if (currentY + itemH <= endY) {
            const y = currentY;
            const x = (SCREEN_WIDTH - itemW) / 2;
            
            // Item bg
            ctx.fillStyle = ach.unlocked ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.08)';
            drawRoundRect(ctx, x, y, itemW, itemH, 16);
            ctx.fill();
            
            if (ach.unlocked) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Icon
            ctx.fillStyle = ach.unlocked ? '#fbbf24' : '#64748b';
            ctx.font = "32px Arial";
            ctx.textAlign = "center";
            ctx.fillText(ach.unlocked ? '🏆' : '🔒', x + 40, y + 45);
            
            // Text
            ctx.textAlign = "left";
            ctx.fillStyle = ach.unlocked ? '#fbbf24' : '#94a3b8';
            ctx.font = "bold 16px Arial";
            ctx.fillText(ach.name, x + 80, y + 30);
            
            ctx.fillStyle = '#94a3b8';
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
                ctx.fillStyle = '#4ade80';
                ctx.font = "bold 14px Arial";
                ctx.fillText(`已领取`, x + itemW - 20, y + 40);
            }
        }
        currentY += (itemH + 15);
    });
}

function drawModalBase(title) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = SCREEN_WIDTH * 0.9;
    const boxH = SCREEN_HEIGHT * 0.8; // Increased height to 0.8
    const boxX = (SCREEN_WIDTH - boxW)/2;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    // Panel Background
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, SCREEN_WIDTH/2, boxY + 40);
    
    // Close Button
    const btnW = 100;
    const btnH = 36;
    const btnX = (SCREEN_WIDTH - btnW)/2;
    const btnY = boxY + boxH - 50;
    
    ctx.fillStyle = '#3b82f6';
    drawRoundRect(ctx, btnX, btnY, btnW, btnH, 18);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = "bold 16px Arial";
    ctx.fillText('关闭', SCREEN_WIDTH/2, btnY + 24);
}

function drawGameOverScreen() {
  drawOverlay("GAME OVER", "TRY AGAIN");
}

function drawPauseScreen() {
  drawOverlay("PAUSED", "RESUME");
}

function drawHelpScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    const boxW = SCREEN_WIDTH * 0.85;
    const boxH = 420; // Increased height
    const boxX = (SCREEN_WIDTH - boxW)/2;
    const boxY = (SCREEN_HEIGHT - boxH)/2;
    
    // Panel Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawRoundRect(ctx, boxX + 10, boxY + 10, boxW, boxH, 20);
    ctx.fill();

    // Panel Background
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    
    // Panel Border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 16);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#60a5fa';
    ctx.textAlign = 'center';
    ctx.font = '900 28px Arial';
    ctx.fillText('游戏介绍', SCREEN_WIDTH/2, boxY + 50);
    
    // Content
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    const startX = boxX + 40;
    const lineHeight = 40;
    const contentY = boxY + 90;

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
    
    // OK Button
    const btnW = 120;
    const btnH = 44;
    const btnX = (SCREEN_WIDTH - btnW)/2;
    const btnY = boxY + boxH - 70;

    // OK Button Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawRoundRect(ctx, btnX + 2, btnY + 4, btnW, btnH, 22);
    ctx.fill();

    // OK Button Gradient
    const okGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    okGrad.addColorStop(0, '#3b82f6');
    okGrad.addColorStop(1, '#2563eb');
    
    ctx.fillStyle = okGrad;
    drawRoundRect(ctx, btnX, btnY, btnW, btnH, 22);
    ctx.fill();

    // OK Button Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    drawRoundRect(ctx, btnX + 5, btnY + 3, btnW - 10, btnH/2, 10);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('我知道了', SCREEN_WIDTH/2, btnY + 28);
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

  if (showHelp) {
      // Check OK Button
      const boxW = SCREEN_WIDTH * 0.85;
      const boxH = 420; // Increased height to match drawHelpScreen
      const boxY = (SCREEN_HEIGHT - boxH)/2;
      const btnW = 120;
      const btnH = 44;
      const btnX = (SCREEN_WIDTH - btnW)/2;
      const btnY = boxY + boxH - 70;
      
      if (touchStartX >= btnX && touchStartX <= btnX + btnW &&
          touchStartY >= btnY && touchStartY <= btnY + btnH) {
          showHelp = false;
          startedThisTouch = true;
      }
      return;
  }

  if (showShop) {
      const boxW = SCREEN_WIDTH * 0.9;
      const boxH = SCREEN_HEIGHT * 0.8;
      const boxX = (SCREEN_WIDTH - boxW)/2;
      const boxY = (SCREEN_HEIGHT - boxH)/2;
      
      const startY = boxY + 70;
      const itemH = 70;
      
      // Close Button
      const closeBtnW = 100;
      const closeBtnH = 36;
      const closeBtnX = (SCREEN_WIDTH - closeBtnW)/2;
      const closeBtnY = boxY + boxH - 50;
      
      if (touchStartX >= closeBtnX && touchStartX <= closeBtnX + closeBtnW &&
          touchStartY >= closeBtnY && touchStartY <= closeBtnY + closeBtnH) {
          showShop = false;
          startedThisTouch = true;
          return;
      }
      
      // Shop Items
      Object.keys(SKINS).forEach((key, index) => {
          const y = startY + index * (itemH + 15);
          const x = (SCREEN_WIDTH - 300) / 2; // Updated width
          const btnX = x + 210;
          const btnY = y + 20;
          const btnW = 70;
          const btnH = 30;
          
          if (touchStartX >= btnX && touchStartX <= btnX + btnW &&
              touchStartY >= btnY && touchStartY <= btnY + btnH) {
              
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
      const boxW = SCREEN_WIDTH * 0.9;
      const boxH = SCREEN_HEIGHT * 0.8;
      const boxX = (SCREEN_WIDTH - boxW)/2;
      const boxY = (SCREEN_HEIGHT - boxH)/2;
      
      const closeBtnW = 100;
      const closeBtnH = 36;
      const closeBtnX = (SCREEN_WIDTH - closeBtnW)/2;
      const closeBtnY = boxY + boxH - 50;
      
      if (touchStartX >= closeBtnX && touchStartX <= closeBtnX + closeBtnW &&
          touchStartY >= closeBtnY && touchStartY <= closeBtnY + closeBtnH) {
          showAchievements = false;
          startedThisTouch = true;
      }
      return;
  }

  if (gameOver) {
      // Click anywhere to restart
      startGame();
      startedThisTouch = true;
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
        startGame();
        startedThisTouch = true;
        return;
    }

    // Check Intro Button
    const introBtnH = 30;
    const introBtnY = btnY + btnH + 90;

    if (touchStartX >= 0 && touchStartX <= SCREEN_WIDTH &&
        touchStartY >= introBtnY && touchStartY <= introBtnY + introBtnH) {
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
        showShop = true;
        startedThisTouch = true;
        return;
    }
    
    // Achievements
    if (touchStartX >= achX && touchStartX <= achX + sysBtnW &&
        touchStartY >= sysBtnY && touchStartY <= sysBtnY + sysBtnH) {
        showAchievements = true;
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

function adjustColor(hex, amount) {
    let usePound = false;
    if (hex[0] === "#") {
        hex = hex.slice(1);
        usePound = true;
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// Start
init();
