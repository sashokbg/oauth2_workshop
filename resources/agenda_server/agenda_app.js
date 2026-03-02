const express = require('express');
const {tokenVerifier, tokenIntrospector} = require("@oauth-exercise/lib");
const conf = require("@oauth-exercise/lib/config");

const agenda_app = express();
const port = 3001;

const AGENDA_ITEMS = [
  {time: '09:00', title: 'Morning standup'},
  {time: '10:30', title: 'Architecture review'},
  {time: '12:00', title: 'Lunch'},
  {time: '14:00', title: 'Sprint planning'},
  {time: '16:00', title: 'Code review'},
];


const tokenVerifyMiddleware = tokenVerifier(
  `${conf.agenda.KEYCLOAK_BASE_URL}/realms/${conf.agenda.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  'agenda.read'
);

const tokenIntrospectMiddleware = tokenIntrospector(
  conf.agenda.KEYCLOAK_BASE_URL,
  conf.agenda.KEYCLOAK_REALM,
  conf.agenda.KEYCLOAK_CLIENT_ID,
  conf.agenda.KEYCLOAK_CLIENT_SECRET
)

agenda_app.get('/agenda', tokenVerifyMiddleware, tokenIntrospectMiddleware, (req, res) => {
  console.log("GETTING AGENDA");

  res.json({items: AGENDA_ITEMS});
});

agenda_app.listen(port, () => {
  console.log(`Resource server listening on port ${port}`);
});
