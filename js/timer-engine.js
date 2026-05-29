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
// In countdown mode: returns remaining seconds (floored at 0).
// In countup mode:   returns elapsed seconds (no upper cap — keeps growing past totalTime).
export function computeTimeLeft(state) {
  if (!state) return 0;
  if (!state.isRunning) return state.timeLeft || 0;

  const now = Date.now();
  const base = state.startedTimeLeft != null ? state.startedTimeLeft : state.timeLeft;
  const tick = state.lastTick || now;
  const elapsed = Math.max(0, Math.round((now - tick) / 1000));

  if (state.mode === 'countup') {
    return base + elapsed;
  }
  return Math.max(0, base - elapsed);
}

// Should the timer blink based on current state? Centralised so all displays agree.
export function shouldBlink(state) {
  if (!state) return false;
  if (state.isBlinking) return true; // manual blink override
  const t = state.timeLeft || 0;
  if (state.mode === 'countup') {
    // Blink in the last `autoBlinkSeconds` before the target, AND continuously past the target
    const total = state.totalTime || 0;
    if (total > 0 && t >= total) return true; // overflow — keep blinking
    const remaining = total - t;
    return state.autoBlinkSeconds > 0 && remaining >= 0 && remaining <= state.autoBlinkSeconds;
  }
  // countdown
  return state.autoBlinkSeconds > 0 && t > 0 && t <= state.autoBlinkSeconds;
}

// Is the timer in "overflow" (countup past target)? Used to force red color.
export function isOverflow(state) {
  if (!state || state.mode !== 'countup') return false;
  return (state.totalTime || 0) > 0 && (state.timeLeft || 0) >= state.totalTime;
}

// === Local tick loop (runs on every client for smooth display) ===
function startLocalCountdown() {
  stopLocalCountdown();
  localCountdown = setInterval(() => {
    if (!localState.isRunning) {
      stopLocalCountdown();
      return;
    }
    // Always compute from timestamps — no drift, no delay
    localState.timeLeft = computeTimeLeft(localState);

    if (localState.mode === 'countup') {
      // Auto-blink in last `autoBlinkSeconds` before target (and past it)
      const remaining = (localState.totalTime || 0) - localState.timeLeft;
      if (localState.autoBlinkSeconds > 0 && remaining <= localState.autoBlinkSeconds) {
        localState.isBlinking = true;
      }
      // Countup never auto-stops — keeps incrementing forever until user pauses
    } else {
      // countdown: blink near 0, stop at 0
      if (localState.autoBlinkSeconds > 0 && localState.timeLeft <= localState.autoBlinkSeconds) {
        localState.isBlinking = true;
      }
      if (localState.timeLeft === 0) {
        localState.isRunning = false;
        localState.isBlinking = false;
        stopLocalCountdown();
        writeState({ timeLeft: 0, isRunning: false, isBlinking: false });
      }
    }
  }, 500); // 500ms for smoother updates
}

function stopLocalCountdown() {
  if (localCountdown) {
    clearInterval(localCountdown);
    localCountdown = null;
  }
}

// === Actions ===

export function startTimer() {
  // Countdown: can't start at 0. Countup: any value is fine (it counts up).
  if (localState.mode !== 'countup' && localState.timeLeft <= 0) return;
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
  // countdown resets to totalTime, countup resets to 0
  const resetTo = localState.mode === 'countup' ? 0 : localState.totalTime;
  localState.timeLeft = resetTo;
  localState.isBlinking = false;
  writeState({
    isRunning: false,
    timeLeft: resetTo,
    startedTimeLeft: resetTo,
    isBlinking: false
  });
}

export function setTime(seconds) {
  stopLocalCountdown();
  localState.totalTime = seconds;
  // countdown starts AT `seconds` (counting down). countup starts at 0 (with `seconds` as target).
  const startAt = localState.mode === 'countup' ? 0 : seconds;
  localState.timeLeft = startAt;
  localState.isRunning = false;
  localState.isBlinking = false;
  writeState({
    totalTime: seconds,
    timeLeft: startAt,
    startedTimeLeft: startAt,
    isRunning: false,
    isBlinking: false
  });
}

// Switch between countdown and countup. Resets the timer to a sensible value for the new mode.
export function setMode(mode) {
  if (mode !== 'countdown' && mode !== 'countup') return;
  stopLocalCountdown();
  localState.mode = mode;
  localState.isRunning = false;
  localState.isBlinking = false;
  const startAt = mode === 'countup' ? 0 : (localState.totalTime || 300);
  localState.timeLeft = startAt;
  writeState({
    mode: mode,
    isRunning: false,
    timeLeft: startAt,
    startedTimeLeft: startAt,
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
  const nowRunning = newState.isRunning !== undefined ? newState.isRunning : wasRunning;

  // Only update non-timer fields if countdown is already running locally
  if (wasRunning && nowRunning && localCountdown) {
    // Timer is running and local countdown is active — don't touch timeLeft
    // Just update appearance/control fields
    const { timeLeft, startedTimeLeft, lastTick, isRunning, ...safeFields } = newState;
    localState = { ...localState, ...safeFields };
    return;
  }

  // State transition or first sync — apply everything
  localState = { ...localState, ...newState };

  if (localState.isRunning) {
    // Recalculate once and start local countdown
    localState.timeLeft = computeTimeLeft(localState);
    if (!localCountdown) {
      startLocalCountdown();
    }
  } else {
    stopLocalCountdown();
    // Use the timeLeft from Firebase when stopped
    if (newState.timeLeft !== undefined) {
      localState.timeLeft = newState.timeLeft;
    }
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
  // Countdown auto-stops at 0; countup keeps running
  if (localState.mode !== 'countup' && localState.timeLeft === 0) {
    localState.isRunning = false;
    localState.isBlinking = false;
    stopLocalCountdown();
  } else if (!localCountdown) {
    startLocalCountdown();
  }
}
