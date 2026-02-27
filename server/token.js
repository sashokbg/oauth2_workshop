const {writeSessionStore, readSessionStore} = require("./session");
const {
  KEYCLOAK_BASE_URL,
  KEYCLOAK_REALM,
  REDIRECT_URI,
  KEYCLOAK_CLIENT_SECRET,
  KEYCLOAK_CLIENT_ID
} = require("./config");
const axios = require("axios");

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

module.exports = {decodeJwtPayload, exchange_code_for_token}
