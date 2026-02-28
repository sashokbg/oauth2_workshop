const dotenv = require('dotenv');
dotenv.config({path: `${__dirname}/.env`});

const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const {engine} = require("express-handlebars");
const {readSessionStore, requireSession} = require("./session.js");
const {decodeJwtPayload} = require("./token.js");
const {writeSessionStore} = require("./session");
const {exchange_code_for_token} = require("./token");
const {
  KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_RESOURCE_CLIENT_ID, KEYCLOAK_RESOURCE_CLIENT_SECRET,
  AGENDA_REDIRECT_URI, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, REDIRECT_URI, KEYCLOAK_RESOURCE_BASE_URL,
  RESOURCE_SERVER_URL, POST_LOGOUT_REDIRECT_URI, KEYCLOAK_RESOURCE_REALM
} = require("./config");

const app = express()
const port = 3000

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');
app.use(cookieParser());

app.get('/', requireSession, async (req, res) => {
  const {session, _} = req;

  const token = session.tokens?.id_token || session.tokens?.access_token;
  const claims = decodeJwtPayload(token) || {};
  const username =
    claims.preferred_username ||
    claims.email ||
    claims.name ||
    claims.sub || 'unknown';

  res.render('home', {username})
})

function redirectToAgendaAuth(res) {
  const authUrl = new URL(
    `${KEYCLOAK_RESOURCE_BASE_URL}/realms/${KEYCLOAK_RESOURCE_REALM}/protocol/openid-connect/auth`
  );
  authUrl.searchParams.set('client_id', KEYCLOAK_RESOURCE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'agenda.read');
  authUrl.searchParams.set('redirect_uri', AGENDA_REDIRECT_URI);
  authUrl.searchParams.set('prompt', 'consent');
  return res.redirect(authUrl.toString());
}

app.get('/agenda', requireSession, async (req, res) => {
  const {session, sessionStore} = req;
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
      await writeSessionStore(sessionStore);
      return redirectToAgendaAuth(res);
    }
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

app.get('/callback-resource', requireSession, async (req, res) => {
  const {code} = req.query;
  const {session, sessionStore} = req;

  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      KEYCLOAK_RESOURCE_REALM,
      KEYCLOAK_RESOURCE_BASE_URL,
      KEYCLOAK_RESOURCE_CLIENT_ID,
      KEYCLOAK_RESOURCE_CLIENT_SECRET,
      AGENDA_REDIRECT_URI
    );
    session.agendaTokens = tokenResponse.data;
    await writeSessionStore(sessionStore);

    return res.redirect('/agenda');
  } catch (err) {
    console.error('AGENDA TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('agenda', {error: JSON.stringify(error)});
  }
});


app.get('/callback', async (req, res) => {
  const {code, session_state: sessionState, iss} = req.query;
  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      KEYCLOAK_REALM,
      KEYCLOAK_BASE_URL,
      KEYCLOAK_CLIENT_ID,
      KEYCLOAK_CLIENT_SECRET,
      REDIRECT_URI
    );

    const store = await readSessionStore();
    const sessionId = crypto.randomUUID();
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
    `${KEYCLOAK_RESOURCE_BASE_URL}/realms/${KEYCLOAK_RESOURCE_REALM}/protocol/openid-connect/logout`
  );
  logoutUrl.searchParams.set('post_logout_redirect_uri', POST_LOGOUT_REDIRECT_URI);
  logoutUrl.searchParams.set('client_id', KEYCLOAK_RESOURCE_CLIENT_ID);

  return res.redirect(logoutUrl.toString());
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
