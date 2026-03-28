import db from '../db.js';

/**
 * SQLite-backed StateStore for @atproto/oauth-client-node.
 * Stores OAuth state parameters (PKCE verifier, CSRF) during the auth flow.
 * Entries are short-lived — deleted after callback or after 10 minutes.
 */
export class StateStore {
  get(key) {
    const row = db.prepare('SELECT value FROM states WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : undefined;
  }

  set(key, value) {
    db.prepare(
      'INSERT OR REPLACE INTO states (key, value) VALUES (?, ?)'
    ).run(key, JSON.stringify(value));
  }

  del(key) {
    db.prepare('DELETE FROM states WHERE key = ?').run(key);
  }
}
