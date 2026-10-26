export const STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
};

export class GameState {
  constructor() {
    this.current = STATES.MENU;
    this.listeners = [];
  }

  is(...states) {
    return states.includes(this.current);
  }

  set(state) {
    if (state === this.current) return;
    const prev = this.current;
    this.current = state;
    for (const fn of this.listeners) fn(state, prev);
  }

  onChange(fn) {
    this.listeners.push(fn);
  }
}
