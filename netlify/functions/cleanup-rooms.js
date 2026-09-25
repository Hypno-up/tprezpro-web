// Scheduled daily (see netlify.toml): deletes rooms with no activity for ROOM_TTL_DAYS.
// "Activity" = room creation or the last Start press (state.lastTick).
const { firebaseRequest } = require('../lib/firebase-rest');

const ROOM_TTL_DAYS = 30;

exports.handler = async () => {
  if (!process.env.FIREBASE_DB_SECRET) {
    console.error('cleanup-rooms: FIREBASE_DB_SECRET missing, skipping');
    return { statusCode: 500 };
  }
  const cutoff = Date.now() - ROOM_TTL_DAYS * 24 * 60 * 60 * 1000;
  const rooms = (await firebaseRequest('/rooms')) || {};

  const stale = {};
  for (const [code, room] of Object.entries(rooms)) {
    const lastActivity = Math.max(room?.createdAt || 0, room?.state?.lastTick || 0);
    if (lastActivity < cutoff) stale[code] = null;
  }

  const count = Object.keys(stale).length;
  if (count > 0) await firebaseRequest('/rooms', 'PATCH', stale);
  console.log(`cleanup-rooms: ${count} deleted / ${Object.keys(rooms).length} total`);
  return { statusCode: 200 };
};
