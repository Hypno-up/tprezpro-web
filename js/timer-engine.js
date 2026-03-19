// Timer Engine - countdown logic, runs only in BackOffice
import { getDb } from './firebase-config.js';

let timerInterval = null;
let localState = null;
let roomCode = null;
let firebaseRef = null;
let firebaseUpdate = null;

export function initTimerEngine(firebase, code, initialState) {
  roomCode = code;
  localState = { ...initialState };
  firebaseRef = firebase.ref;
  firebaseUpdate = firebase.update;

  startInterval();
}

function startInterval() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    if (localState.isRunning && localState.timeLeft > 0) {
      localState.timeLeft--;
      localState.lastTick = Date.now();

      if (localState.autoBlinkSeconds > 0 && localState.timeLeft <= localState.autoBlinkSeconds) {
        localState.isBlinking = true;
      }

      if (localState.timeLeft === 0) {
        localState.isRunning = false;
        localState.isBlinking = false;
      }

      writeState({
        timeLeft: localState.timeLeft,
        isRunning: localState.isRunning,
        isBlinking: localState.isBlinking,
        lastTick: localState.lastTick
      });
    }
  }, 1000);
}

export function stopTimerEngine() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function writeState(partial) {
  const db = getDb();
  if (!db || !roomCode) return;
  const stateRef = firebaseRef(db, `rooms/${roomCode}/state`);
  firebaseUpdate(stateRef, partial);
}

// Actions
export function startTimer() {
  if (localState.timeLeft <= 0) return;
  localState.isRunning = true;
  localState.lastTick = Date.now();
  writeState({ isRunning: true, lastTick: localState.lastTick });
}

export function pauseTimer() {
  localState.isRunning = false;
  writeState({ isRunning: false });
}

export function resetTimer() {
  localState.isRunning = false;
  localState.timeLeft = localState.totalTime;
  localState.isBlinking = false;
  writeState({
    isRunning: false,
    timeLeft: localState.totalTime,
    isBlinking: false
  });
}

export function setTime(seconds) {
  localState.totalTime = seconds;
  localState.timeLeft = seconds;
  localState.isRunning = false;
  localState.isBlinking = false;
  writeState({
    totalTime: seconds,
    timeLeft: seconds,
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
  localState = { ...localState, ...newState };
}

export function getLocalState() {
  return { ...localState };
}

// Handle tab visibility changes - recalculate elapsed time
export function handleVisibilityChange() {
  if (document.hidden) return;
  if (!localState.isRunning || !localState.lastTick) return;

  const elapsed = Math.floor((Date.now() - localState.lastTick) / 1000);
  if (elapsed > 1) {
    localState.timeLeft = Math.max(0, localState.timeLeft - elapsed + 1);
    localState.lastTick = Date.now();

    if (localState.timeLeft === 0) {
      localState.isRunning = false;
      localState.isBlinking = false;
    }

    if (localState.autoBlinkSeconds > 0 && localState.timeLeft <= localState.autoBlinkSeconds) {
      localState.isBlinking = true;
    }

    writeState({
      timeLeft: localState.timeLeft,
      isRunning: localState.isRunning,
      isBlinking: localState.isBlinking,
      lastTick: localState.lastTick
    });
  }
}
