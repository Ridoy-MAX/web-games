// Pause screen buttons. Settings opened from here returns to the pause screen.
export function bindPauseMenu(ui, game) {
  ui.on('resume', () => game.resume());
  ui.on('restart', () => game.restartLevel());
  ui.on('menu', () => game.toMenu());
  document.getElementById('btn-pause').addEventListener('click', () => {
    game.audio.click();
    game.pause();
  });
}
