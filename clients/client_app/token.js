const axios = require("axios");

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
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
