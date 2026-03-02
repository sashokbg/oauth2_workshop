const express = require('express');
const agenda_app = express();
const port = 3001;

const AGENDA_ITEMS = [
  {time: '09:00', title: 'Morning standup'},
  {time: '10:30', title: 'Architecture review'},
  {time: '12:00', title: 'Lunch'},
  {time: '14:00', title: 'Sprint planning'},
  {time: '16:00', title: 'Code review'},
];

agenda_app.get('/agenda', (req, res) => {
  console.log("GETTING AGENDA");

  res.json({items: AGENDA_ITEMS});
});

agenda_app.listen(port, () => {
  console.log(`Resource server listening on port ${port}`);
});
