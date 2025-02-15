const axios = require('axios');
const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/proxy', async (req, res) => {
  const { query } = req;
  let targetUrl = query.url;

  if (!targetUrl) {
    return res.status(400).send('No target URL provided');
  }

  targetUrl = decodeURIComponent(targetUrl);

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': req.headers['user-agent'],
        'Accept': '*/*',
      },
    });

    const contentType = response.headers['content-type'];

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      const script = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;
      
      htmlContent = htmlContent.replace(/(src|href)="(\/[^"]+)"/g, (match, p1, p2) => {
        return `${p1}="/proxy?url=${encodeURIComponent(targetUrl + p2)}"`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(Buffer.from(response.data));
    }

  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
