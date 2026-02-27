require('dotenv').config();
const express = require('express');
const {requireToken, introspectToken} = require("./token_utils");
const app = express();
const port = 3001;

const AGENDA_ITEMS = [
  { time: '09:00', title: 'Morning standup' },
  { time: '10:30', title: 'Architecture review' },
  { time: '12:00', title: 'Lunch' },
  { time: '14:00', title: 'Sprint planning' },
  { time: '16:00', title: 'Code review' },
];

app.get('/agenda', requireToken, introspectToken, (req, res) => {
  console.log("GETTING AGENDA");

  const scopes = (req.tokenInfo.scope || '').split(' ');
  if (!scopes.includes('agenda.read')) {
    return res.status(403).json({ error: 'Missing required scope: agenda.read' });
  }

  res.json({ items: AGENDA_ITEMS });
});

app.listen(port, () => {
  console.log(`Resource server listening on port ${port}`);
});
