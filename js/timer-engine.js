// Timer Engine - countdown logic
// Only ONE client drives the countdown (the one that starts it).
// All others compute timeLeft from lastTick + startedTimeLeft.
import { getDb } from './firebase-config.js';

let localState = null;
let roomCode = null;
let firebaseRef = null;
let firebaseUpdate = null;
let tickRafId = null;
let isMaster = false; // true = this client drives the countdown

export function initTimerEngine(firebase, code, initialState) {
  roomCode = code;
  localState = { ...initialState };
  firebaseRef = firebase.ref;
  firebaseUpdate = firebase.update;
}

function writeState(partial) {
  const db = getDb();
  if (!db || !roomCode) return;
  const stateRef = firebaseRef(db, `rooms/${roomCode}/state`);
  firebaseUpdate(stateRef, partial);
}

// === Compute real timeLeft from Firebase state ===
// startedTimeLeft = time remaining when timer was started/last written
// lastTick = timestamp when startedTimeLeft was recorded
// If running, timeLeft = startedTimeLeft - elapsed seconds since lastTick
export function computeTimeLeft(state) {
  if (!state) return 0;
  if (!state.isRunning) return state.timeLeft;

  const now = Date.now();
  const elapsed = Math.floor((now - (state.lastTick || now)) / 1000);
  return Math.max(0, (state.startedTimeLeft || state.timeLeft) - elapsed);
}

// === Master tick loop ===
// Only the client that pressed Start writes countdown updates.
function masterTick() {
  if (!isMaster || !localState.isRunning) return;

  const realTimeLeft = computeTimeLeft(localState);

  if (realTimeLeft !== localState.timeLeft) {
    localState.timeLeft = realTimeLeft;

    if (localState.autoBlinkSeconds > 0 && realTimeLeft <= localState.autoBlinkSeconds) {
      localState.isBlinking = true;
    }

    if (realTimeLeft === 0) {
      localState.isRunning = false;
      localState.isBlinking = false;
      isMaster = false;
      writeState({
        timeLeft: 0,
        isRunning: false,
        isBlinking: false
      });
      return;
    }

    // Write every 5 seconds to keep Firebase in sync without flooding
    if (realTimeLeft % 5 === 0) {
      writeState({
        timeLeft: realTimeLeft,
        isBlinking: localState.isBlinking
      });
    }
  }

  tickRafId = setTimeout(masterTick, 1000);
}

function stopMasterTick() {
  if (tickRafId) {
    clearTimeout(tickRafId);
    tickRafId = null;
  }
}

// === Actions (any client can trigger these) ===

export function startTimer() {
  if (localState.timeLeft <= 0) return;
  isMaster = true;
  localState.isRunning = true;
  localState.lastTick = Date.now();
  localState.startedTimeLeft = localState.timeLeft;
  writeState({
    isRunning: true,
    lastTick: localState.lastTick,
    startedTimeLeft: localState.timeLeft,
    timeLeft: localState.timeLeft
  });
  stopMasterTick();
  tickRafId = setTimeout(masterTick, 1000);
}

export function pauseTimer() {
  isMaster = false;
  stopMasterTick();
  const realTimeLeft = computeTimeLeft(localState);
  localState.isRunning = false;
  localState.timeLeft = realTimeLeft;
  writeState({
    isRunning: false,
    timeLeft: realTimeLeft,
    startedTimeLeft: realTimeLeft
  });
}

export function resetTimer() {
  isMaster = false;
  stopMasterTick();
  localState.isRunning = false;
  localState.timeLeft = localState.totalTime;
  localState.isBlinking = false;
  writeState({
    isRunning: false,
    timeLeft: localState.totalTime,
    startedTimeLeft: localState.totalTime,
    isBlinking: false
  });
}

export function setTime(seconds) {
  isMaster = false;
  stopMasterTick();
  localState.totalTime = seconds;
  localState.timeLeft = seconds;
  localState.isRunning = false;
  localState.isBlinking = false;
  writeState({
    totalTime: seconds,
    timeLeft: seconds,
    startedTimeLeft: seconds,
    isRunning: false,
    isBlinking: false
  });
}

export function setColor(color) {
  localState.color = color;
  writeState({ color });
}

export function setSize(size) {
  localState.size = size;
  writeState({ size });
}

export function setTransparency(value) {
  localState.transparency = value;
  writeState({ transparency: value });
}

export function setVisibility(visible) {
  localState.isVisible = visible;
  writeState({ isVisible: visible });
}

export function setMessage(message) {
  localState.message = message;
  writeState({ message });
}

export function setMessagePosition(position) {
  localState.messagePosition = position;
  writeState({ messagePosition: position });
}

export function toggleLock() {
  localState.isLocked = !localState.isLocked;
  writeState({ isLocked: localState.isLocked });
}

export function updateLocalState(newState) {
  const wasRunning = localState?.isRunning;
  localState = { ...localState, ...newState };

  // If another client started the timer, compute correct timeLeft locally
  if (localState.isRunning && !isMaster) {
    localState.timeLeft = computeTimeLeft(localState);
  }
}

export function getLocalState() {
  // Always compute real-time timeLeft
  if (localState.isRunning) {
    return { ...localState, timeLeft: computeTimeLeft(localState) };
  }
  return { ...localState };
}

// Handle tab coming back to foreground
export function handleVisibilityChange() {
  if (document.hidden) return;
  if (!localState.isRunning) return;

  // Recalculate from Firebase state
  localState.timeLeft = computeTimeLeft(localState);

  if (localState.timeLeft === 0) {
    localState.isRunning = false;
    localState.isBlinking = false;
  }
}
