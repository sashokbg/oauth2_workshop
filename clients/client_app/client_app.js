const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const {engine} = require("express-handlebars");
const {exchange_code_for_token, decodeJwtPayload, getClientToken, tokenRefresher, redirectToAuth} = require("./token");
const {readSessionStore, writeSessionStore} = require("./session.js");
const conf = require("@oauth-exercise/lib/config");

const client_app = express()
const port = 3000

client_app.engine('handlebars', engine());
client_app.set('view engine', 'handlebars');
client_app.set('views', './views');
client_app.use(cookieParser());

client_app.use(async (req, res, next) => {
  let sessionId = req.cookies?.SESSION;
  const store = await readSessionStore();

  if (!sessionId || !store.sessions[sessionId]) {
    sessionId = crypto.randomUUID();
    store.sessions[sessionId] = {
      createdAt: new Date().toISOString(),
    };
    await writeSessionStore(store);

    res.cookie('SESSION', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  if (!req.url.startsWith("/callback") && !store.sessions[sessionId]?.tokens?.id_token) {
    const authUrl = new URL(
      `${conf.client.KEYCLOAK_BASE_URL}/realms/${conf.client.KEYCLOAK_REALM}/protocol/openid-connect/auth`
    );
    const pkce = crypto.randomBytes(32).toString('base64url');

    const hashedSecret = crypto.createHash("sha256").update(pkce).digest('base64url');
    const randomState = crypto.randomBytes(32).toString('base64url');

    authUrl.searchParams.set('code_challenge', hashedSecret);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('client_id', conf.client.KEYCLOAK_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('redirect_uri', conf.client.KEYCLOAK_REDIRECT_URI);
    authUrl.searchParams.set('state', randomState);

    store.sessions[sessionId].pkce = pkce;
    store.sessions[sessionId].state = randomState;
    await writeSessionStore(store);

    return res.redirect(authUrl.toString());
  }

  req.sessionId = sessionId;
  req.session = store.sessions[sessionId];
  req.sessionStore = store;
  next();
})

client_app.get('/', async (req, res) => {
  const {session} = req;
  const hasAgendaToken = Boolean(session?.agenda?.access_token);
  const hasContactsToken = Boolean(session?.contacts?.access_token);

  const username = session?.decodedTokens?.id_token?.preferred_username

  res.render('home', {username, hasAgendaToken, hasContactsToken})
})

client_app.get('/agenda', tokenRefresher, async (req, res) => {
  const {session, sessionStore} = req;
  let accessToken = session['agenda']?.access_token;
  try {
    const response = await axios.get(`${conf.agenda.APP_URL}/agenda`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 400) {
      delete session.agenda;
      await writeSessionStore(sessionStore);
      return redirectToAuth(res, 'agenda');
    }
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

client_app.get('/contacts', async (req, res) => {
  const {session, sessionStore} = req;
  const accessToken = session.contacts?.access_token;
  if (!accessToken) {
    return redirectToAuth(res, 'contacts');
  }

  try {
    const response = await axios.get(`${conf.contacts.APP_URL}/contacts`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    res.render('contacts', {items: response.data.items});
  } catch (err) {
    if (err.response?.status === 401) {
      delete session.contacts;
      await writeSessionStore(sessionStore);
      return redirectToAuth(res, 'contacts')
    }
    const error = err.response?.data?.error || err.message;
    res.render('contacts', {error});
  }
})

async function handleResourceCallback(code, req, res, app) {
  const c = conf[app];
  const {session, sessionStore} = req;

  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      c.KEYCLOAK_REALM,
      c.KEYCLOAK_BASE_URL,
      c.KEYCLOAK_CLIENT_ID,
      c.KEYCLOAK_CLIENT_SECRET,
      c.KEYCLOAK_REDIRECT_URI
    );
    session[app] = tokenResponse.data;
    await writeSessionStore(sessionStore);

    return res.redirect(c.POST_AUTH_REDIRECT);
  } catch (err) {
    console.error('AGENDA TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('agenda', {error: JSON.stringify(error)});
  }
}

async function handleCallback(code, sessionState, iss, res, sessionId) {
  const c = conf.client;
  const store = await readSessionStore();
  let session = store.sessions[sessionId];

  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      c.KEYCLOAK_REALM,
      c.KEYCLOAK_BASE_URL,
      c.KEYCLOAK_CLIENT_ID,
      c.KEYCLOAK_CLIENT_SECRET,
      c.KEYCLOAK_REDIRECT_URI,
      session.pkce
    );

    const tokenData = tokenResponse.data;

    store.sessions[sessionId] = {
      tokens: tokenData,
      decodedTokens: {
        access_token: decodeJwtPayload(tokenData.access_token),
        id_token: decodeJwtPayload(tokenData.id_token)
      },
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
}

async function logout(req, res, app) {
  const sessionCookie = req.cookies?.SESSION;
  let idTokenHint = '';

  if (sessionCookie) {
    const store = await readSessionStore();
    const session = store.sessions[sessionCookie];

    if (app === 'client') {
      if (session?.tokens?.id_token) {
        idTokenHint = session.tokens.id_token;
      }
      delete store.sessions[sessionCookie];
      await writeSessionStore(store);
      res.clearCookie('SESSION');
    } else {
      delete store.sessions[sessionCookie][app];
      await writeSessionStore(store);
    }
  }

  const c = conf[app];

  const logoutUrl = new URL(
    `${c.KEYCLOAK_BASE_URL}/realms/${c.KEYCLOAK_REALM}/protocol/openid-connect/logout`
  );
  if (idTokenHint) {
    logoutUrl.searchParams.set('id_token_hint', idTokenHint);
  }
  logoutUrl.searchParams.set('post_logout_redirect_uri', c.POST_LOGOUT_REDIRECT_URI);
  logoutUrl.searchParams.set('client_id', c.KEYCLOAK_CLIENT_ID);

  return res.redirect(logoutUrl.toString());
}

client_app.get('/callback', async (req, res) => {
  const {code, session_state: sessionState, iss, state} = req.query;
  const {session} = req;

  if(session.state !== state) {
    console.error("Bad state");
    res.status(403).send("Invalid state parameter")
  }

  await handleCallback(code, sessionState, iss, res, req.sessionId);
});

client_app.get('/callback-agenda', async (req, res) => {
  const {code} = req.query;
  await handleResourceCallback(code, req, res, 'agenda');
});

client_app.get('/callback-contacts', async (req, res) => {
  const {code} = req.query;
  await handleResourceCallback(code, req, res, 'contacts');
});

client_app.get('/logout', async (req, res) => {
  return await logout(req, res, 'client');
});

client_app.get('/logout-agenda', async (req, res) => {
  return await logout(req, res, 'agenda');
});

client_app.get('/logout-contacts', async (req, res) => {
  return await logout(req, res, 'contacts');
});

client_app.get('/backoffice', async (req, res) => {
  if (!req.session.decodedTokens.access_token?.resource_access?.["client-app"]?.roles.includes("backoffice_admin")) {
    res.status(403);
    res.json("Requires role 'backoffice_admin'");
  } else {
    res.json("OK");
  }
})

client_app.get('/server-to-server', async (req, res) => {
  const c = conf.server_client;

  let clientTokenResponse = await getClientToken(c.KEYCLOAK_BASE_URL, c.KEYCLOAK_REALM, c.KEYCLOAK_CLIENT_ID, c.KEYCLOAK_CLIENT_SECRET);

  try {
    const response = await axios.get(`${conf.agenda.APP_URL}/agenda`, {
      headers: {Authorization: `Bearer ${clientTokenResponse.data.access_token}`},
    });
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

client_app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
