const express = require('express');
const axios = require('axios');

const app = express();

app.get('/proxy/*', async (req, res) => {
  const targetUrl = req.params[0];

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': req.get('User-Agent'),
      },
    });
    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
