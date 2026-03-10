// Global configuration
const info = wx.getSystemInfoSync();
module.exports = {
  SCREEN_WIDTH: info.windowWidth,
  SCREEN_HEIGHT: info.windowHeight,
  CELL_SIZE: 20,
  GRID_WIDTH: Math.floor((info.windowWidth - 40) / 20),
  // Expand game area vertically since on-screen buttons are removed
  GRID_HEIGHT: Math.max(10, Math.floor((info.windowHeight - 160) / 20)),
  COLORS: {
    BACKGROUND: '#5c94fc',
    GAME_BG: 'rgba(255, 255, 255, 0.18)',
    BORDER: '#e75c10',
    SNAKE_HEAD: '#ff0000',
    SNAKE_BODY: '#00cc00',
    FOOD: '#ffd700',
    TEXT: '#ffffff',
    SHADOW: '#000000'
  }
};
