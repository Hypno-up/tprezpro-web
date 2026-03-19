// Room management - creation, joining, code generation
import { getDb } from './firebase-config.js';

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion

const DEFAULT_STATE = {
  timeLeft: 300,
  totalTime: 300,
  isRunning: false,
  isVisible: true,
  color: null,
  size: 'text-6xl',
  transparency: 100,
  isBlinking: false,
  autoBlinkSeconds: 30,
  message: '',
  messagePosition: 'below',
  isLocked: false,
  lastTick: 0
};

function generateRoomCode() {
  const array = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, b => ROOM_CODE_CHARS[b % ROOM_CODE_CHARS.length]).join('');
}

function getSessionId() {
  let id = sessionStorage.getItem('timer-session-id');
  if (!id) {
    id = 'sess_' + crypto.randomUUID();
    sessionStorage.setItem('timer-session-id', id);
  }
  return id;
}

export async function createRoom(firebase) {
  const db = getDb();
  const { ref, set, get, serverTimestamp } = firebase;

  let code = generateRoomCode();
  let attempts = 0;

  // Check for collision
  while (attempts < 10) {
    const snapshot = await get(ref(db, `rooms/${code}`));
    if (!snapshot.exists()) break;
    code = generateRoomCode();
    attempts++;
  }

  const roomData = {
    createdAt: Date.now(),
    ownerId: getSessionId(),
    state: { ...DEFAULT_STATE, lastTick: Date.now() }
  };

  await set(ref(db, `rooms/${code}`), roomData);
  return code;
}

export async function roomExists(firebase, code) {
  const db = getDb();
  const { ref, get } = firebase;
  const snapshot = await get(ref(db, `rooms/${code}`));
  return snapshot.exists();
}

export function isRoomOwner(ownerId) {
  return ownerId === getSessionId();
}

export function getDisplayURL(roomCode) {
  const base = window.location.origin;
  return `${base}/room/${roomCode}`;
}

export function getAdminURL(roomCode) {
  const base = window.location.origin;
  return `${base}/admin/${roomCode}`;
}

export function getRoomCodeFromURL() {
  // Check query param first (?room=CODE)
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('room');
  if (fromParam) return fromParam;

  // Check path pattern: /admin/CODE or /room/CODE
  const pathMatch = window.location.pathname.match(/^\/(admin|room)\/([A-Za-z0-9]+)/);
  if (pathMatch) return pathMatch[2];

  return null;
}

export { DEFAULT_STATE, getSessionId };
