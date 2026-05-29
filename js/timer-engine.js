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

// Sentinel value written to Firebase's `timeLeft` and `startedTimeLeft` in countup mode.
// Purpose: defeats legacy engines (pre-1.8.2) that auto-write `isRunning: false` the
// instant they see `timeLeft === 0`. With 999999 sitting in those fields, an old client
// computes `999999 - elapsed` and never reaches 0 within any realistic session. The
// new engine ignores these fields for countup display and reads `chronoBase` instead.
const COUNTUP_SENTINEL = 999999;

// === Compute the value to display from timestamps + state ===
// In countdown mode: returns remaining seconds (floored at 0). Uses startedTimeLeft + lastTick.
// In countup mode:   returns elapsed seconds (no upper cap). Uses chronoBase + lastTick.
//                    `state.timeLeft` is IGNORED for countup (it's the legacy-compat sentinel).
export function computeTimeLeft(state) {
  if (!state) return 0;

  if (state.mode === 'countup') {
    const base = state.chronoBase != null ? state.chronoBase : 0;
    if (!state.isRunning) return base;
    const now = Date.now();
    const tick = state.lastTick || now;
    const elapsed = Math.max(0, Math.round((now - tick) / 1000));
    return base + elapsed;
  }

  // countdown
  if (!state.isRunning) return state.timeLeft || 0;
  const now = Date.now();
  const base = state.startedTimeLeft != null ? state.startedTimeLeft : state.timeLeft;
  const tick = state.lastTick || now;
  const elapsed = Math.max(0, Math.round((now - tick) / 1000));
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

  if (localState.mode === 'countup') {
    // Snapshot current elapsed (localState.timeLeft) as the new chronoBase.
    // Live elapsed from now on = chronoBase + (Date.now() - lastTick) / 1000.
    localState.chronoBase = localState.timeLeft || 0;
    localState.startedTimeLeft = COUNTUP_SENTINEL;
    writeState({
      isRunning: true,
      lastTick: localState.lastTick,
      chronoBase: localState.chronoBase,
      // Legacy-compat sentinels — keep old cached engines from auto-stopping at 0:
      startedTimeLeft: COUNTUP_SENTINEL,
      timeLeft: COUNTUP_SENTINEL
    });
  } else {
    localState.startedTimeLeft = localState.timeLeft;
    writeState({
      isRunning: true,
      lastTick: localState.lastTick,
      startedTimeLeft: localState.timeLeft,
      timeLeft: localState.timeLeft
    });
  }
  startLocalCountdown();
}

export function pauseTimer() {
  stopLocalCountdown();
  localState.isRunning = false;

  if (localState.mode === 'countup') {
    // Freeze the displayed elapsed value into chronoBase so we resume from here.
    localState.chronoBase = localState.timeLeft || 0;
    writeState({
      isRunning: false,
      chronoBase: localState.chronoBase,
      timeLeft: COUNTUP_SENTINEL,
      startedTimeLeft: COUNTUP_SENTINEL
    });
  } else {
    writeState({
      isRunning: false,
      timeLeft: localState.timeLeft,
      startedTimeLeft: localState.timeLeft
    });
  }
}

export function resetTimer() {
  stopLocalCountdown();
  localState.isRunning = false;
  localState.isBlinking = false;

  if (localState.mode === 'countup') {
    localState.chronoBase = 0;
    localState.timeLeft = 0; // local display value; Firebase keeps sentinel
    writeState({
      isRunning: false,
      chronoBase: 0,
      timeLeft: COUNTUP_SENTINEL,
      startedTimeLeft: COUNTUP_SENTINEL,
      isBlinking: false
    });
  } else {
    localState.timeLeft = localState.totalTime;
    writeState({
      isRunning: false,
      timeLeft: localState.totalTime,
      startedTimeLeft: localState.totalTime,
      isBlinking: false
    });
  }
}

export function setTime(seconds) {
  stopLocalCountdown();
  localState.totalTime = seconds;
  localState.isRunning = false;
  localState.isBlinking = false;

  if (localState.mode === 'countup') {
    // Countup: `seconds` becomes the target. Restart elapsed at 0.
    localState.chronoBase = 0;
    localState.timeLeft = 0;
    writeState({
      totalTime: seconds,
      chronoBase: 0,
      timeLeft: COUNTUP_SENTINEL,
      startedTimeLeft: COUNTUP_SENTINEL,
      isRunning: false,
      isBlinking: false
    });
  } else {
    localState.timeLeft = seconds;
    writeState({
      totalTime: seconds,
      timeLeft: seconds,
      startedTimeLeft: seconds,
      isRunning: false,
      isBlinking: false
    });
  }
}

// Switch between countdown and countup. Resets the timer to a sensible value for the new mode.
export function setMode(mode) {
  if (mode !== 'countdown' && mode !== 'countup') return;
  stopLocalCountdown();
  localState.mode = mode;
  localState.isRunning = false;
  localState.isBlinking = false;

  if (mode === 'countup') {
    localState.chronoBase = 0;
    localState.timeLeft = 0;
    writeState({
      mode: 'countup',
      isRunning: false,
      chronoBase: 0,
      timeLeft: COUNTUP_SENTINEL,
      startedTimeLeft: COUNTUP_SENTINEL,
      isBlinking: false
    });
  } else {
    const startAt = localState.totalTime || 300;
    localState.timeLeft = startAt;
    writeState({
      mode: 'countdown',
      isRunning: false,
      timeLeft: startAt,
      startedTimeLeft: startAt,
      isBlinking: false
    });
  }
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

  // If we were already running and still are, the local tick is authoritative for
  // timing fields — only merge non-timing fields so we don't reset the displayed value.
  if (wasRunning && nowRunning && localCountdown) {
    const { timeLeft, startedTimeLeft, lastTick, isRunning, chronoBase, ...safeFields } = newState;
    localState = { ...localState, ...safeFields };
    return;
  }

  // State transition or first sync — apply everything from Firebase, then derive the
  // displayed `timeLeft` from computeTimeLeft. This is critical for countup because
  // Firebase stores the COUNTUP_SENTINEL in `timeLeft`, not the real elapsed.
  localState = { ...localState, ...newState };
  localState.timeLeft = computeTimeLeft(localState);

  if (localState.isRunning) {
    if (!localCountdown) startLocalCountdown();
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
  // Countdown auto-stops at 0; countup keeps running
  if (localState.mode !== 'countup' && localState.timeLeft === 0) {
    localState.isRunning = false;
    localState.isBlinking = false;
    stopLocalCountdown();
  } else if (!localCountdown) {
    startLocalCountdown();
  }
}
