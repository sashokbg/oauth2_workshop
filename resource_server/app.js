require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { engine } = require('express-handlebars');
const app = express();
const port = 3001;

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

const AGENDA_ITEMS = [
  { time: '09:00', title: 'Morning standup' },
  { time: '10:30', title: 'Architecture review' },
  { time: '12:00', title: 'Lunch' },
  { time: '14:00', title: 'Sprint planning' },
  { time: '16:00', title: 'Code review' },
];

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/agenda', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log("GETTING AGENDA");

  if (!token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  // Validate the token via Keycloak token introspection
  const introspectUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token/introspect`;
  let tokenInfo;
  try {
    const body = new URLSearchParams({
      token,
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
    });
    const response = await axios.post(introspectUrl, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    tokenInfo = response.data;
  } catch (err) {
    console.error('Introspection error', err.message);
    return res.status(500).json({ error: 'Token introspection failed' });
  }

  if (!tokenInfo.active) {
    return res.status(401).json({ error: 'Token is not active' });
  }

  const scopes = (tokenInfo.scope || '').split(' ');
  if (!scopes.includes('agenda.read')) {
    return res.status(403).json({ error: 'Missing required scope: agenda.read' });
  }

  res.json({ items: AGENDA_ITEMS });
});

app.listen(port, () => {
  console.log(`Resource server listening on port ${port}`);
});
