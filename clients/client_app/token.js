const axios = require("axios");

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

module.exports = {exchange_code_for_token}
