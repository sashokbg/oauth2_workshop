require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const express = require('express')
const axios = require('axios');
const cookieParser = require('cookie-parser');
const {engine} = require("express-handlebars");
const app = express()
const port = 3000

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'master';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'exercise-app';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';


const KEYCLOAK_RESOURCE_BASE_URL = process.env.KEYCLOAK_RESOURCE_BASE_URL;
const KEYCLOAK_RESOURCE_CLIENT_ID = process.env.KEYCLOAK_RESOURCE_CLIENT_ID;
const KEYCLOAK_RESOURCE_CLIENT_SECRET = process.env.KEYCLOAK_RESOURCE_CLIENT_SECRET || '';

const REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || `http://localhost:${port}/callback`;
const AGENDA_REDIRECT_URI = process.env.KEYCLOAK_RESOURCE_REDIRECT_URI;

const POST_LOGOUT_REDIRECT_URI =
  process.env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI || `http://localhost:${port}/`;
const SESSION_STORE_PATH = path.join(__dirname, 'sessions.json');
const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL || 'http://localhost:3001';

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');
app.use(cookieParser());

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

function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

app.get('/', async (req, res) => {
  const sessionCookie = req.cookies?.SESSION;

  if (!sessionCookie) {
    console.log("NO COOKIE");
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

  const token = session.tokens?.id_token || session.tokens?.access_token;
  const claims = decodeJwtPayload(token) || {};
  const username =
    claims.preferred_username ||
    claims.email ||
    claims.name ||
    claims.sub ||
    'unknown';

  res.render('home', {username})
})

function redirectToAgendaAuth(res) {
  const authUrl = new URL(
    `${KEYCLOAK_RESOURCE_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`
  );
  authUrl.searchParams.set('client_id', KEYCLOAK_RESOURCE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'agenda.read');
  authUrl.searchParams.set('redirect_uri', AGENDA_REDIRECT_URI);
  return res.redirect(authUrl.toString());
}

app.get('/agenda', async (req, res) => {
  const sessionCookie = req.cookies?.SESSION;
  if (!sessionCookie) {
    return res.redirect('/');
  }
  const store = await readSessionStore();
  const session = store.sessions[sessionCookie];
  if (!session) {
    res.clearCookie('SESSION');
    return res.redirect('/');
  }

  const accessToken = session.agendaTokens?.access_token;
  if (!accessToken) {
    return redirectToAgendaAuth(res);
  }

  try {
    const response = await axios.get(`${RESOURCE_SERVER_URL}/agenda`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    if (err.response?.status === 401) {
      delete session.agendaTokens;
      await writeSessionStore(store);
      return redirectToAgendaAuth(res);
    }
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

app.get('/callback-resource', async (req, res) => {
  const {code, session_state: sessionState, iss} = req.query;
  const sessionCookie = req.cookies?.SESSION;

  if (!sessionCookie) {
    return res.redirect('/');
  }

  const store = await readSessionStore();
  const session = store.sessions[sessionCookie];
  if (!session) {
    res.clearCookie('SESSION');
    return res.redirect('/');
  }

  try {
    const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_RESOURCE_CLIENT_ID,
      client_secret: KEYCLOAK_RESOURCE_CLIENT_SECRET,
      redirect_uri: AGENDA_REDIRECT_URI,
      code: code || '',
    });

    const tokenResponse = await axios.post(tokenUrl, body, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });

    console.log('AGENDA TOKEN RESPONSE', tokenResponse.data);
    session.agendaTokens = tokenResponse.data;
    await writeSessionStore(store);

    return res.redirect('/agenda');
  } catch (err) {
    console.error('AGENDA TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('agenda', {error: JSON.stringify(error)});
  }
});


app.get('/callback', async (req, res) => {
  const {code, session_state: sessionState, iss, state} = req.query;
  console.log('CALLBACK QUERY', req.query);
  console.log('CALLBACK PARSED', {code, sessionState, issuer: iss});
  try {
    const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: code || '',
    });

    const tokenResponse = await axios.post(tokenUrl, body, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });

    console.log('TOKEN RESPONSE', tokenResponse.data);
    const sessionId = crypto.randomUUID();
    const store = await readSessionStore();
    store.sessions[sessionId] = {
      tokens: tokenResponse.data,
      createdAt: new Date().toISOString(),
      sessionState,
      issuer: iss,
    };
    await writeSessionStore(store);

    res.cookie('SESSION', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
    });

    res.render('callback', {
      sessionId,
      sessionJson: JSON.stringify({sessionId}, null, 2),
    });
  } catch (err) {
    console.error('TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('callback', {
      error,
      errorJson: JSON.stringify(error, null, 2),
    });
  }

  console.log("Received callback");
});

app.get('/logout', async (req, res) => {
  const sessionCookie = req.cookies?.SESSION;
  let idTokenHint = '';

  if (sessionCookie) {
    const store = await readSessionStore();
    const session = store.sessions[sessionCookie];
    if (session?.tokens?.id_token) {
      idTokenHint = session.tokens.id_token;
    }
    if (session) {
      delete store.sessions[sessionCookie];
      await writeSessionStore(store);
    }
  }

  res.clearCookie('SESSION');

  const logoutUrl = new URL(
    `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`
  );
  if (idTokenHint) {
    logoutUrl.searchParams.set('id_token_hint', idTokenHint);
  }
  logoutUrl.searchParams.set('post_logout_redirect_uri', POST_LOGOUT_REDIRECT_URI);
  logoutUrl.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);

  return res.redirect(logoutUrl.toString());
});

app.get('/logout-resource', async (req, res) => {
  const logoutUrl = new URL(
    `${KEYCLOAK_RESOURCE_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`
  );
  logoutUrl.searchParams.set('post_logout_redirect_uri', POST_LOGOUT_REDIRECT_URI);
  logoutUrl.searchParams.set('client_id', KEYCLOAK_RESOURCE_CLIENT_ID);

  return res.redirect(logoutUrl.toString());
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
