// Player session + API client shared by the home page and every game.
// The session token is issued by the server on signup or login and lives in
// localStorage on this device. Each device gets its own token.
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
    if (!s) throw new ApiError('Create a player or log in first.', 401, 'NO_SESSION');
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

function signedIn(data) {
  saveSession({ username: data.user.username, token: data.token });
  return data;
}

export const createUser = async (username, password) => signedIn(await api('users', { method: 'POST', body: { username, password } }));
export const login = async (username, password) => signedIn(await api('session', { method: 'POST', body: { username, password } }));

// Logs out this device only. The local session is cleared even if the server is unreachable.
export async function logout() {
  try {
    if (getSession()) await api('session', { method: 'DELETE', auth: true });
  } catch {
    /* token already invalid or offline: forgetting it locally is enough */
  } finally {
    clearSession();
  }
}

export const setPassword = (newPassword, currentPassword) =>
  api('password', { method: 'POST', body: { newPassword, currentPassword }, auth: true });

export const fetchMe = () => api('me', { auth: true });
export const submitScore = (run) => api('scores', { method: 'POST', body: run, auth: true });
export const fetchLeaderboard = (game, limit = 10) => api(`leaderboard?game=${encodeURIComponent(game)}&limit=${limit}`);

const FIRST = ['Sir', 'Captain', 'Lady', 'Professor', 'Agent', 'Baron', 'Doctor', 'Chef', 'Turbo', 'Lil'];
const LAST = ['Moosalot', 'Udderly', 'Hoofington', 'Cheddar', 'Mooington', 'Bovinator', 'Grassnacks', 'Milkshake', 'Haybale', 'Cowabunga'];

export function suggestUsername() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(FIRST)}${pick(LAST)}${Math.floor(Math.random() * 90 + 10)}`;
}
