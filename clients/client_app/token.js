const axios = require("axios");
const conf = require("@oauth-exercise/lib/config");
const {writeSessionStore} = require("./session");

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function redirectToAuth(res, app) {
  let c = conf[app];

  const authUrl = new URL(
    `${c.KEYCLOAK_BASE_URL}/realms/${c.KEYCLOAK_REALM}/protocol/openid-connect/auth`
  );
  authUrl.searchParams.set('client_id', c.KEYCLOAK_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'agenda.read');
  authUrl.searchParams.set('redirect_uri', c.KEYCLOAK_REDIRECT_URI);
  authUrl.searchParams.set('prompt', 'consent');
  return res.redirect(authUrl.toString());
}

async function tokenRefresher(req, res, next) {
  const {session, sessionStore} = req;
  let accessToken = session['agenda']?.access_token;

  if (!accessToken) {
    return redirectToAuth(res, 'agenda');
  }

  const decoded = decodeJwtPayload(accessToken);
  let now = (new Date().getTime() / 1000);

  if (decoded.exp < now) {
    console.log("Token expired !");

    const c = conf.agenda;

    const tokenUrl = `${c.KEYCLOAK_BASE_URL}/realms/${c.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: c.KEYCLOAK_CLIENT_ID,
      client_secret: c.KEYCLOAK_CLIENT_SECRET,
      redirect_uri: c.KEYCLOAK_REDIRECT_URI,
      refresh_token: session['agenda']?.refresh_token || '',
    });

    const tokenResponse = await axios.post(tokenUrl, body, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });

    session['agenda'] = tokenResponse.data;
    await writeSessionStore(sessionStore);
    console.log("TOKEN REFRESHED !")
  } else {
    console.log(`Token expires in ${decoded.exp - now} seconds`);
  }
  next()
}


async function exchange_code_for_token(code, realm, base_url, client_id, client_secret, redirect_uri) {
  const tokenUrl = `${base_url}/realms/${realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: client_id,
    client_secret: client_secret,
    redirect_uri: redirect_uri,
    code: code || '',
  });

  return await axios.post(tokenUrl, body, {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  });
}

module.exports = {decodeJwtPayload, exchange_code_for_token, tokenRefresher, redirectToAuth}
