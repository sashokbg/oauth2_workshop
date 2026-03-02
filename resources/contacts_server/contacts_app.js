const express = require("express");
const {tokenVerifier, tokenIntrospector} = require("@oauth-exercise/lib");
const conf = require("@oauth-exercise/lib/config");

const port = 3002

const agenda_app = express();

const CONTACT_ITEMS = [
  {
    "name": "John Doe",
    "email": "j.doe@example.com",
    "tel": "01 22 53 55 32 11",
    "agenda": [
      {time: '09:00', title: 'Morning standup'},
      {time: '10:30', title: 'Architecture review'},
      {time: '12:00', title: 'Lunch'},
      {time: '14:00', title: 'Sprint planning'},
      {time: '16:00', title: 'Code review'},
    ]
  },
  {
    "name": "Jane Bishop",
    "email": "jane@example.com",
    "tel": "02 52 13 55 72 20",
    "agenda": [
      {time: '09:00', title: 'Morning standup'},
      {time: '11:00', title: 'Marketing meeting'},
      {time: '12:30', title: 'Lunch'},
      {time: '16:00', title: 'Roadmap planning'},
    ]
  }
]

const tokenVerifyMiddleware = tokenVerifier(
  `${conf.contacts.KEYCLOAK_BASE_URL}/realms/${conf.contacts.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  'agenda.read'
);

const tokenIntrospectMiddleware = tokenIntrospector(
  conf.contacts.KEYCLOAK_BASE_URL,
  conf.contacts.KEYCLOAK_REALM,
  conf.contacts.KEYCLOAK_CLIENT_ID,
  conf.contacts.KEYCLOAK_CLIENT_SECRET
)

agenda_app.get("/contacts", tokenVerifyMiddleware, tokenIntrospectMiddleware, (req, res) => {
  if(!req.tokenInfo.aud || req.tokenInfo.aud !== 'contacts-app-audience') {
    return res.status(500).json({error: `Bad token audience ${req.tokenInfo.aud}`});
  }

  res.json({items: CONTACT_ITEMS});
})

console.log(`Contacts server listening on ${port}`);
agenda_app.listen(port);

