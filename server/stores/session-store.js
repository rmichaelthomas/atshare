import { JsonStore } from '../db.js';

/**
 * JSON file-backed SessionStore for @atproto/oauth-client-node.
 */
export class SessionStore extends JsonStore {
  constructor() {
    super('sessions');
  }
}
