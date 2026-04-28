# 贪吃蛇小游戏打磨升级 设计文档

**日期**: 2026-04-28
**目标**: 在不重构、不破坏老用户存档的前提下，通过资源接入和细节打磨，让现有微信小游戏的视觉与体验显著提升。
**项目**: `/Users/shaohuihui/uni-app/Snake`（单文件 `game.js`，约 1481 行 Canvas 2D 微信小游戏）
**用户状态**: 已上线，少量真实用户，需要保留存档兼容。

---

## 1. 设计目标

- **不重构**：不拆分文件，不引入构建工具或框架。所有改动只在 `game.js` 内进行（必要时新增 `js/` 下小工具文件）。
- **零破坏**：现有 `wx.getStorageSync` 的所有 key、皮肤 ID、成就 ID、价格全部保留。
- **小成本资源**：仅引入 4–6 张精选 PNG、5 个短音效、1 个中文字体。
- **可降级**：所有资源加载失败时，自动降级为现有的纯 Canvas 绘制路径，不阻塞游戏运行。

## 2. 资源清单

### 2.1 图片（`assets/img/`）

| 文件 | 尺寸 | 用途 | 必须 |
|---|---|---|---|
| `apple.png` | 64×64 | 普通食物，替换现 header 同款金币圆 | 是 |
| `coin.png` | 32×32 | 顶部 UI 金币图标，替换 emoji 💰 | 是 |
| `bonus.png` | 64×64 | bonus 食物（可选，留白则保留现有星形） | 否 |
| `shop_icon.png` | 48×48 | 主菜单商店按钮图标 | 否 |
| `achievement_icon.png` | 48×48 | 主菜单成就按钮图标 | 否 |

### 2.2 音效（`assets/audio/`，建议 mp3，每个 < 50KB，时长 < 1s）

| 文件 | 触发时机 |
|---|---|
| `eat.mp3` | 吃普通食物 |
| `bonus.mp3` | 吃 bonus 食物 |
| `die.mp3` | 游戏结束 |
| `click.mp3` | 任何按钮点击 |
| `unlock.mp3` | 解锁新成就 |

### 2.3 字体（`assets/font/font.ttf`）

通过 `wx.loadFont()` 加载，加载成功后赋值给全局 `GAME_FONT`，所有 `ctx.font` 字符串引用它，失败回退到 Arial。

**降级策略**: 任一资源缺失或加载失败，对应位置使用原有的纯 Canvas 绘制 / 默认字体，不阻塞游戏。

## 3. 视觉改造

### 3.1 食物渲染
- 用 `ctx.drawImage(Assets.images.apple, ...)` 替换 `drawGameArea` 中食物绘制段（当前 `game.js:643-674`）。
- 保留 `pulse` 缩放动画。
- 资源缺失时降级为原金币画法。

### 3.2 蛇头舌头
- 当前是单条直线（`game.js:574-586`），改为分叉 Y 字：从蛇头中心向前延伸一段后分裂成左右两条。
- 仍保持 `frameCounter % 60 < 30` 的吐舌频闪。

### 3.3 标题
- `drawStartScreen` 中标题字符串从「超级贪贪贪吃蛇」改为「贪吃蛇大冒险」(`game.js:721`)。

### 3.4 字体
- 全局 `GAME_FONT` 变量，所有 `"bold 18px Arial"` 类字符串改为 `` `bold 18px ${GAME_FONT}` ``（用模板字符串）。
- 在 `loadAssets` 阶段调用 `wx.loadFont(path)` 拿到 family 名。

### 3.5 顶部金币图标
- `drawHeader` 中手绘金币（`game.js:398-422`）替换为 `drawImage(Assets.images.coin, ...)`。
- 主菜单右上角的 `💰 ${totalCoins}`（`game.js:811-814`）也改用图片 + 数字。

### 3.6 颜色函数 bug 修复
- `adjustColor`（`game.js:1463-1477`）中变量命名错误：`b = ((num >> 8) & 0x00FF)` 实际拿到的是 G，`g = (num & 0x0000FF)` 拿到的是 B，最后又按 `(g | (b << 8) | (r << 16))` 重组。整体抵消后效果正常但变量名误导，需要改为正确的 r/g/b 名字以便维护。

## 4. 玩法 / UX 改造

### 4.1 游戏结束面板升级

将 `drawGameOverScreen` / `drawOverlay` 拆出一个新的 `drawGameOverPanel()`，包含：

```
┌─────────────────────────┐
│      游戏结束             │
│                         │
│   本局得分               │
│      0123  [NEW!]       │
│                         │
│  用时 01:23  金币 +123   │
│                         │
│  🏆 解锁: 初露锋芒        │
│                         │
│  [再来一局]  [回主菜单]   │
└─────────────────────────┘
```

新增状态变量：
- `gameStartTime` — 在 `startGame()` 中赋值 `Date.now()`
- `coinsEarnedThisRun` — 在 `handleGameOver` 累计本局金币（含成就奖励）
- `newAchievementsThisRun` — 数组，在 `handleGameOver` 收集本局解锁的成就

「NEW RECORD!」闪烁仅在 `score > 上一局 highScore` 时显示。

### 4.2 商店 / 成就滚动

新增状态：
```js
let shopScrollY = 0;
let achievementScrollY = 0;
let scrollDragging = false;
let scrollLastY = 0;
```

绘制：在 `drawShopScreen` / `drawAchievementsScreen` 内容绘制前 `ctx.save() + ctx.beginPath() + ctx.rect(panel viewport) + ctx.clip() + ctx.translate(0, scrollY)`，结束 `ctx.restore()`。

输入：
- `handleTouchStart` 在面板内（且不在按钮/关闭按钮命中）时 `scrollDragging = true; scrollLastY = touchY`。
- `handleTouchMove` 在 `scrollDragging` 时累加 `scrollY += t.clientY - scrollLastY`，clamp 到 `[-(contentH - viewH), 0]`，然后 `scrollLastY = t.clientY`。
- `handleTouchEnd` 重置 `scrollDragging = false`。
- 命中检测：把按钮 y 加上 `scrollY` 再判断是否点中。
- 拖动距离超过阈值时，`handleTouchEnd` 不触发按钮点击（已通过 `startedThisTouch` 类似机制保护）。

打开面板时把对应 `scrollY` 重置为 0。

### 4.3 点击面板外关闭

商店、成就、帮助：在 `handleTouchStart` 中如果点击落在面板矩形之外，关闭对应面板（不触发 close 按钮也行，提升手感）。

### 4.4 触感反馈

| 事件 | 调用 |
|---|---|
| 吃普通食物 | `wx.vibrateShort({type:'light'})` |
| 吃 bonus | `wx.vibrateShort({type:'medium'})` |
| 游戏结束 | `wx.vibrateShort({type:'heavy'})` |
| 任意按钮点击 | `wx.vibrateShort()` |
| 解锁成就 | `wx.vibrateShort({type:'medium'})` |

包装 `vibrate(type)` 工具函数，`try/catch` 防止旧基础库不支持时报错。

## 5. 代码组织

仍然单文件 `game.js`，但在文件顶部新增几段隔离良好的「模块」：

```js
// === Asset Loader ===
const Assets = {
  images: {},   // { apple: Image, coin: Image, ... }
  audios: {},   // { eat: InnerAudioContext, ... } 每个音效一个池
  font: 'Arial', // wx.loadFont 成功后赋实际 family
  ready: false,
};

function loadAssets(done) {
  // 并行加载图片 + 字体 + 音效，全部完成或超时（3s）后调用 done()
  // 单个资源失败不阻塞，对应 Assets.images[k] 留空即可
}

// === Sound Manager ===
function playSound(name) {
  const a = Assets.audios[name];
  if (!a) return;
  try { a.stop(); a.seek(0); a.play(); } catch (e) {}
}

// === Vibration Helper ===
function vibrate(type) {
  try {
    if (type === 'heavy' || type === 'medium' || type === 'light') {
      wx.vibrateShort({ type });
    } else {
      wx.vibrateShort();
    }
  } catch (e) {}
}
```

`init()` 改造：

```js
function bootstrap() {
  drawLoadingScreen(0);
  loadAssets((progress) => drawLoadingScreen(progress));
  // 加载完成后真正进入游戏
}
```

加载界面用现有色调画一个简单进度条（不依赖任何资源）。

## 6. 向后兼容

完全保留以下 storage key 与数据格式：
- `snake_high_score`
- `snake_coins`
- `snake_skins`（JSON 数组）
- `snake_current_skin`
- `snake_achievements`（JSON 数组的成就 ID）
- `snake_games_played`

皮肤字典 `SKINS` 的 key、`achievements` 的 `id` 与 `reward`、价格全部不变。`LEVEL_THEMES` 的 `name` 不变（老存档不依赖它，但保持一致）。

如未来需要新存档字段（本设计不引入），仅追加新 key，不修改老 key 的语义。

## 7. 测试 / 验证策略

由于是 Canvas 微信小游戏，无单元测试基建。验证方式：
1. 微信开发者工具中本地预览，跑一局完整流程：开始 → 吃食物 → 死亡 → 重开 → 进商店 → 进成就 → 帮助。
2. 故意删除 `assets/img/apple.png`，确认降级到原有金币画法、不报错。
3. 对比改动前后存档：用旧存档（金币、已购皮肤、已解锁成就）启动新版本，确认数据完整加载。
4. 真机扫码体验：iOS / Android 各一次，确认字体、音效、震动、滚动手感。

## 8. 不做的事（YAGNI）

- 不加难度选择
- 不加排行榜 / 后端
- 不重构成多文件 / 引入框架
- 不加新皮肤、新成就、新关卡主题
- 不加每日任务、登录、分享激励
- 不加滚动惯性（先做基础拖动，需要再加）

## 9. 任务粒度（供后续 plan 参考）

按可独立验证的最小粒度排列：
1. 新增资源加载器 + loading 界面（无资源时也能跑）
2. 接入字体加载，全局 font 替换
3. 接入苹果图片 + 顶部金币图片
4. 接入 5 个音效 + sound manager
5. 接入震动反馈
6. 修复 `adjustColor` 变量命名 bug
7. 改标题、改舌头分叉
8. 改造游戏结束面板（加统计 / 新纪录 / 双按钮 / 解锁成就列表）
9. 商店 / 成就滚动支持
10. 点击面板外关闭

每步独立 commit，便于回滚。
