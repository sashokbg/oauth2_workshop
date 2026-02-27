const dotenv = require("dotenv");
const axios = require('axios');

dotenv.config()

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

function requireToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  req.token = token;
  next();
}

async function introspectToken(req, res, next) {
  const introspectUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token/introspect`;
  try {
    const body = new URLSearchParams({
      token: req.token,
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
    });
    const response = await axios.post(introspectUrl, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    req.tokenInfo = response.data;
  } catch (err) {
    console.error('Introspection error', err.message);
    return res.status(500).json({ error: 'Token introspection failed' });
  }

  if (!req.tokenInfo.active) {
    return res.status(401).json({ error: 'Token is not active' });
  }

  next();
}

module.exports = { introspectToken, requireToken }
