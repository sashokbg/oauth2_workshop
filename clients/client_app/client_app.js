const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const {engine} = require("express-handlebars");
const {readSessionStore, writeSessionStore} = require("./session.js");
const {exchange_code_for_token} = require("./token");
const conf = require("@oauth-exercise/lib/config");

const client_app = express()
const port = 3000

client_app.engine('handlebars', engine());
client_app.set('view engine', 'handlebars');
client_app.set('views', './views');
client_app.use(cookieParser());

client_app.use(async (req, res, next) => {
  let sessionCookie = req.cookies?.SESSION;
  const store = await readSessionStore();

  if (!sessionCookie || !store.sessions[sessionCookie]) {
    const sessionId = crypto.randomUUID();
    sessionCookie = sessionId;
    store.sessions[sessionId] = {
      createdAt: new Date().toISOString(),
    };
    await writeSessionStore(store);

    res.cookie('SESSION', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  req.sessionId = sessionCookie;
  req.session = store.sessions[sessionCookie];
  req.sessionStore = store;
  next();
})

client_app.get('/', async (req, res) => {
  const {session} = req;
  const hasAgendaToken = Boolean(session?.agenda?.access_token);

  res.render('home', {username: "unknown", hasAgendaToken})
})

function redirectToAgendaAuth(res) {
  const authUrl = new URL(
    `${conf.agenda.KEYCLOAK_BASE_URL}/realms/${conf.agenda.KEYCLOAK_REALM}/protocol/openid-connect/auth`
  );
  authUrl.searchParams.set('client_id', conf.agenda.KEYCLOAK_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', conf.agenda.KEYCLOAK_REDIRECT_URI);
  authUrl.searchParams.set('prompt', 'consent');
  return res.redirect(authUrl.toString());
}

client_app.get('/agenda',  async (req, res) => {
  const {session, sessionStore} = req;
  const accessToken = session['agenda']?.access_token;
  if (!accessToken) {
    return redirectToAgendaAuth(res);
  }

  try {
    const response = await axios.get(`${conf.agenda.APP_URL}/agenda`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    if (err.response?.status === 401) {
      delete session.agenda;
      await writeSessionStore(sessionStore);
      return redirectToAgendaAuth(res);
    }
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

client_app.get('/callback-agenda', async (req, res) => {
  const {code} = req.query;
  const {session, sessionStore} = req;

  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      conf.agenda.KEYCLOAK_REALM,
      conf.agenda.KEYCLOAK_BASE_URL,
      conf.agenda.KEYCLOAK_CLIENT_ID,
      conf.agenda.KEYCLOAK_CLIENT_SECRET,
      conf.agenda.KEYCLOAK_REDIRECT_URI
    );
    session['agenda'] = tokenResponse.data;
    await writeSessionStore(sessionStore);

    return res.redirect(conf.agenda.POST_AUTH_REDIRECT);
  } catch (err) {
    console.error('AGENDA TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('agenda', {error: JSON.stringify(error)});
  }
});


client_app.get('/logout-agenda', async (req, res) => {
  const sessionCookie = req.cookies?.SESSION;

  if (sessionCookie) {
    const store = await readSessionStore();
    const session = store.sessions[sessionCookie];
    if (session) {
      delete store.sessions[sessionCookie].agendaTokens;
      await writeSessionStore(store);
    }

    res.clearCookie('SESSION');
  }

  const logoutUrl = new URL(
    `${conf.agenda.KEYCLOAK_BASE_URL}/realms/${conf.agenda.KEYCLOAK_REALM}/protocol/openid-connect/logout`
  );
  logoutUrl.searchParams.set('post_logout_redirect_uri', conf.agenda.POST_LOGOUT_REDIRECT_URI);
  logoutUrl.searchParams.set('client_id', conf.agenda.KEYCLOAK_CLIENT_ID);

  return res.redirect(logoutUrl.toString());
});

client_app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
