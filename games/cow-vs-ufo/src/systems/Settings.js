// Settings and the offline best score are stored per player name.
let KEY = 'cowVsUfo.settings';
let BEST_KEY = 'cowVsUfo.best';

const defaults = {
  sound: true,
  music: true,
  volume: 0.7,
  quality: 'auto', // auto | high | low
  sensitivity: 1,
  skin: 0,
  accessory: 0,
};

// localStorage can throw (private mode, blocked storage) so every access is guarded.
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: settings simply won't persist */
  }
}

export const Settings = {
  data: { ...defaults },

  load(username) {
    if (username) {
      const id = username.toLowerCase();
      KEY = `cowVsUfo.${id}.settings`;
      BEST_KEY = `cowVsUfo.${id}.best`;
    }
    try {
      Object.assign(this.data, JSON.parse(read(KEY) || '{}'));
    } catch {
      /* corrupt settings: keep defaults */
    }
    return this.data;
  },

  set(key, value) {
    this.data[key] = value;
    write(KEY, JSON.stringify(this.data));
  },

  getBest() {
    return Number(read(BEST_KEY)) || 0;
  },

  setBest(value) {
    write(BEST_KEY, String(value));
  },
};
