// Timer Engine - clean countdown with Firebase sync
// Firebase stores: startedTimeLeft, lastTick, isRunning
// Each client computes locally, Firebase syncs commands only
import { getDb } from './firebase-config.js';

let localState = null;
let roomCode = null;
let firebaseRef = null;
let firebaseUpdate = null;
let localCountdown = null; // local interval for smooth ticking

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

// === Compute real timeLeft from timestamps (used once on sync) ===
export function computeTimeLeft(state) {
  if (!state) return 0;
  if (!state.isRunning) return state.timeLeft || 0;

  const now = Date.now();
  const base = state.startedTimeLeft != null ? state.startedTimeLeft : state.timeLeft;
  const tick = state.lastTick || now;
  const elapsed = Math.max(0, Math.round((now - tick) / 1000));
  return Math.max(0, base - elapsed);
}

// === Local countdown (runs on every client for smooth display) ===
function startLocalCountdown() {
  stopLocalCountdown();
  localCountdown = setInterval(() => {
    if (!localState.isRunning || localState.timeLeft <= 0) {
      stopLocalCountdown();
      return;
    }
    localState.timeLeft = Math.max(0, localState.timeLeft - 1);

    if (localState.autoBlinkSeconds > 0 && localState.timeLeft <= localState.autoBlinkSeconds) {
      localState.isBlinking = true;
    }

    if (localState.timeLeft === 0) {
      localState.isRunning = false;
      localState.isBlinking = false;
      stopLocalCountdown();
      // Write final state
      writeState({ timeLeft: 0, isRunning: false, isBlinking: false });
    }
  }, 1000);
}

function stopLocalCountdown() {
  if (localCountdown) {
    clearInterval(localCountdown);
    localCountdown = null;
  }
}

// === Actions ===

export function startTimer() {
  if (localState.timeLeft <= 0) return;
  localState.isRunning = true;
  localState.lastTick = Date.now();
  localState.startedTimeLeft = localState.timeLeft;
  writeState({
    isRunning: true,
    lastTick: localState.lastTick,
    startedTimeLeft: localState.timeLeft,
    timeLeft: localState.timeLeft
  });
  startLocalCountdown();
}

export function pauseTimer() {
  stopLocalCountdown();
  localState.isRunning = false;
  writeState({
    isRunning: false,
    timeLeft: localState.timeLeft,
    startedTimeLeft: localState.timeLeft
  });
}

export function resetTimer() {
  stopLocalCountdown();
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
  stopLocalCountdown();
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

// Called when Firebase sends a new state
export function updateLocalState(newState) {
  const wasRunning = localState?.isRunning;
  localState = { ...localState, ...newState };

  // Compute correct timeLeft from timestamps
  if (localState.isRunning) {
    localState.timeLeft = computeTimeLeft(localState);
    if (!localCountdown) {
      startLocalCountdown();
    }
  } else {
    stopLocalCountdown();
  }
}

export function getLocalState() {
  return { ...localState };
}

export function handleVisibilityChange() {
  if (document.hidden) return;
  if (!localState.isRunning) return;
  // Recalculate on tab focus
  localState.timeLeft = computeTimeLeft(localState);
  if (localState.timeLeft === 0) {
    localState.isRunning = false;
    localState.isBlinking = false;
    stopLocalCountdown();
  } else if (!localCountdown) {
    startLocalCountdown();
  }
}
