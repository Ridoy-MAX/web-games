// Player session + API client shared by the home page and every game.
// The session token is created by the server when a username is claimed and
// lives in localStorage on this device.
const KEY = 'webgames.session';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function getSession() {
  const s = readStore();
  return s && s.token && s.username ? s : null;
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the session lasts until the tab closes */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const s = getSession();
    if (!s) throw new ApiError('Create a username first.', 401, 'NO_SESSION');
    headers.Authorization = `Bearer ${s.token}`;
  }
  let res;
  try {
    res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0, 'OFFLINE');
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    if (res.status === 401 && auth) clearSession();
    throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data.code);
  }
  return data;
}

export const checkUsername = (username) => api(`username-check?username=${encodeURIComponent(username)}`);

export async function createUser(username) {
  const data = await api('users', { method: 'POST', body: { username } });
  saveSession({ username: data.user.username, token: data.token });
  return data;
}

export const fetchMe = () => api('me', { auth: true });
export const submitScore = (run) => api('scores', { method: 'POST', body: run, auth: true });
export const fetchLeaderboard = (game, limit = 10) => api(`leaderboard?game=${encodeURIComponent(game)}&limit=${limit}`);

const FIRST = ['Sir', 'Captain', 'Lady', 'Professor', 'Agent', 'Baron', 'Doctor', 'Chef', 'Turbo', 'Lil'];
const LAST = ['Moosalot', 'Udderly', 'Hoofington', 'Cheddar', 'Mooington', 'Bovinator', 'Grassnacks', 'Milkshake', 'Haybale', 'Cowabunga'];

export function suggestUsername() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(FIRST)}${pick(LAST)}${Math.floor(Math.random() * 90 + 10)}`;
}
