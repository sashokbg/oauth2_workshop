const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const {engine} = require("express-handlebars");
const conf = require("@oauth-exercise/lib/config");
const {exchange_code_for_token} = require("./token");

const client_app = express()
const port = 3000

client_app.engine('handlebars', engine());
client_app.set('view engine', 'handlebars');
client_app.set('views', './views');
client_app.use(cookieParser());

let token = '';

client_app.get('/', async (req, res) => {
  const username = "anonymous"
  const hasAgendaToken = Boolean(token);

  res.render('home', {username, hasAgendaToken})
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

client_app.get('/agenda', async (req, res) => {
  try {
    const response = await axios.get(`${conf.agenda.APP_URL}/agenda`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    if (err.response?.status === 401) {
      return redirectToAgendaAuth(res);
    }
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

client_app.get('/callback-agenda', async (req, res) => {
  const {code} = req.query;

  try {
    const tokenResponse = await exchange_code_for_token(
      code,
      conf.agenda.KEYCLOAK_REALM,
      conf.agenda.KEYCLOAK_BASE_URL,
      conf.agenda.KEYCLOAK_CLIENT_ID,
      conf.agenda.KEYCLOAK_CLIENT_SECRET,
      conf.agenda.KEYCLOAK_REDIRECT_URI
    );

    token = tokenResponse.data.access_token;

    return res.redirect('/agenda');
  } catch (err) {
    console.error('AGENDA TOKEN EXCHANGE ERROR', err.response?.data || err.message);
    const error = err.response?.data || err.message;
    res.status(500).render('agenda', {error: JSON.stringify(error)});
  }
});

client_app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
