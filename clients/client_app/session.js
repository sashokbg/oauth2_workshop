const path = require("node:path");
const fs = require('fs/promises');
const crypto = require("crypto");
const SESSION_STORE_PATH = path.join(__dirname, 'sessions.json');

async function readSessionStore() {
  try {
    const raw = await fs.readFile(SESSION_STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {sessions: {}};
    }
    throw err;
  }
}

async function writeSessionStore(store) {
  await fs.writeFile(SESSION_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

module.exports = {readSessionStore, writeSessionStore};
