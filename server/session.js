const dotenv = require("dotenv");
const path = require("node:path");
const fs = require('fs/promises');
const SESSION_STORE_PATH = path.join(__dirname, 'sessions.json');

dotenv.config({ path: `${__dirname}/.env` });

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI;

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

async function requireSession(req, res, next) {
  const sessionCookie = req.cookies?.SESSION;
  if (!sessionCookie) {
    console.log("COOKIE NOT FOUND IN STORE");
    res.clearCookie('SESSION');
    const authUrl = new URL(
      `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`
    );
    authUrl.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    return res.redirect(authUrl.toString());

  }
  const store = await readSessionStore();
  const session = store.sessions[sessionCookie];
  if (!session) {
    res.clearCookie('SESSION');
    return res.redirect('/');
  }
  req.sessionId = sessionCookie;
  req.session = session;
  req.sessionStore = store;
  next();
}

module.exports = {readSessionStore, writeSessionStore, requireSession};
