import db from '../db.js';

/**
 * SQLite-backed SessionStore for @atproto/oauth-client-node.
 * Stores OAuth sessions (tokens, DPoP keys) keyed by user DID.
 */
export class SessionStore {
  get(key) {
    const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : undefined;
  }

  set(key, value) {
    db.prepare(
      'INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)'
    ).run(key, JSON.stringify(value));
  }

  del(key) {
    db.prepare('DELETE FROM sessions WHERE key = ?').run(key);
  }
}
