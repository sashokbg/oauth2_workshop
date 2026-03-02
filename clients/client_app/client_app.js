const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const {engine} = require("express-handlebars");
const conf = require("@oauth-exercise/lib/config");

const client_app = express()
const port = 3000

client_app.engine('handlebars', engine());
client_app.set('view engine', 'handlebars');
client_app.set('views', './views');
client_app.use(cookieParser());

client_app.get('/', async (req, res) => {
  const username = "anonymous"

  res.render('home', {username})
})

client_app.get('/agenda', async (req, res) => {
  try {
    const response = await axios.get(`${conf.agenda.APP_URL}/agenda`);
    res.render('agenda', {items: response.data.items});
  } catch (err) {
    const error = err.response?.data?.error || err.message;
    res.render('agenda', {error});
  }
})

client_app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
