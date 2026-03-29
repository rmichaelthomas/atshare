/**
 * Simple JSON file-based store.
 * Replaces SQLite for shared hosting where native modules aren't available.
 * Data is small (a few OAuth sessions) so JSON is fine.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

mkdirSync(DATA_DIR, { recursive: true });

export class JsonStore {
  constructor(name) {
    this._path = `${DATA_DIR}/${name}.json`;
    this._data = {};
    if (existsSync(this._path)) {
      try {
        this._data = JSON.parse(readFileSync(this._path, 'utf-8'));
      } catch {
        this._data = {};
      }
    }
  }

  _save() {
    writeFileSync(this._path, JSON.stringify(this._data, null, 2), 'utf-8');
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    this._data[key] = value;
    this._save();
  }

  del(key) {
    delete this._data[key];
    this._save();
  }
}
