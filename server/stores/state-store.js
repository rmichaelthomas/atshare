import { JsonStore } from '../db.js';

/**
 * JSON file-backed StateStore for @atproto/oauth-client-node.
 */
export class StateStore extends JsonStore {
  constructor() {
    super('states');
  }
}
