import { ACCESSORIES, SKINS } from '../player/Cow.js';
import { Settings } from '../systems/Settings.js';
import { titleFor } from '../../../../src/shared/titles.js';

const $ = (id) => document.getElementById(id);

// Main menu, how-to, settings and wardrobe wiring.
export function bindMainMenu(ui, game) {
  const s = Settings.data;
  const soundBtn = $('btn-sound');
  const refreshSound = () => {
    soundBtn.textContent = s.sound ? '🔊' : '🔇';
    $('set-sound').checked = s.sound;
    $('set-music').checked = s.music;
  };

  ui.on('play', () => game.startLevel(1));
  ui.on('continue', () => game.continueGame());
  ui.on('home', () => (location.href = '/'));
  ui.on('howto', () => ui.show('howto', { push: true }));
  ui.on('settings', () => ui.show('settings', { push: true }));
  ui.on('wardrobe', () => {
    game.focusWardrobe(true);
    ui.show('wardrobe', { push: true });
  });

  soundBtn.addEventListener('click', () => {
    game.audio.unlock();
    Settings.set('sound', !s.sound);
    game.audio.applySettings();
    refreshSound();
  });

  // Settings controls.
  $('set-sound').addEventListener('change', (e) => {
    Settings.set('sound', e.target.checked);
    game.audio.applySettings();
    refreshSound();
  });
  $('set-music').addEventListener('change', (e) => {
    Settings.set('music', e.target.checked);
    game.audio.unlock();
    game.audio.applySettings();
  });
  const vol = $('set-volume');
  vol.value = s.volume;
  vol.addEventListener('input', () => {
    Settings.set('volume', Number(vol.value));
    game.audio.applySettings();
  });
  const sens = $('set-sens');
  sens.value = s.sensitivity;
  sens.addEventListener('input', () => Settings.set('sensitivity', Number(sens.value)));
  const quality = $('set-quality');
  quality.value = s.quality;
  quality.addEventListener('change', () => {
    Settings.set('quality', quality.value);
    $('quality-hint').textContent = 'Saved. Reload the page to apply graphics changes.';
  });

  // Wardrobe pickers.
  const refreshWardrobe = () => {
    $('skin-name').textContent = SKINS[s.skin].name;
    $('acc-name').textContent = ACCESSORIES[s.accessory];
  };
  const cycle = (key, list, dir) => {
    Settings.set(key, (s[key] + dir + list.length) % list.length);
    game.applyWardrobe();
    refreshWardrobe();
  };
  ui.on('skin-prev', () => cycle('skin', SKINS, -1));
  ui.on('skin-next', () => cycle('skin', SKINS, 1));
  ui.on('acc-prev', () => cycle('accessory', ACCESSORIES, -1));
  ui.on('acc-next', () => cycle('accessory', ACCESSORIES, 1));

  // Leaving the wardrobe returns the camera to the wide menu orbit.
  const baseBack = ui.handlers.back;
  ui.on('back', () => {
    if (ui.current === 'wardrobe') game.focusWardrobe(false);
    baseBack();
  });

  refreshSound();
  refreshWardrobe();
  const refreshBest = () => ($('menu-best').textContent = game.score.best.toLocaleString());
  return {
    refreshBest,
    refreshProfile(username, progress, error) {
      const best = Math.max(progress?.bestScore ?? 0, game.score.best);
      const t = titleFor(best);
      $('menu-player').textContent = username ?? '';
      $('menu-rank').textContent = `${t.icon} ${t.title}`;
      const level = progress?.highestLevel ?? 1;
      const cont = $('btn-continue');
      cont.hidden = level <= 1;
      cont.textContent = `⏩ Continue · Level ${level}`;
      $('menu-offline').hidden = !error;
      if (error) $('menu-offline').textContent = `Offline: scores may not save (${error})`;
      refreshBest();
    },
  };
}
