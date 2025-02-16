const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/proxy', async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('No target URL provided');
  }

  targetUrl = decodeURIComponent(targetUrl);

  try {
    const options = {
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': req.headers['user-agent'],
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        ...req.headers,
      },
      data: req.body,
      maxRedirects: 10,
      responseType: 'arraybuffer',
    };

    const response = await axios(options);
    const contentType = response.headers['content-type'];

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');
      const script = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;

      htmlContent = htmlContent.replace(/(src|href|srcset)="([^"<>]+)"/g, (match, p1, p2) => {
        let newUrl = decodeURIComponent(p2);
        if (newUrl.startsWith('/')) {
          newUrl = new URL(newUrl, targetUrl).href;
        }
        return `${p1}="/proxy?url=${encodeURIComponent(newUrl)}"`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);
      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.includes('text/css')) {
      let cssContent = response.data.toString('utf-8');
      cssContent = cssContent.replace(/url\(\s*["']?(\/[^"')]+)["']?\s*\)/g, (match, p1) => {
        return `url("/proxy?url=${encodeURIComponent(new URL(p1, targetUrl).href)}")`;
      });
      res.setHeader('Content-Type', 'text/css');
      res.status(response.status).send(cssContent);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.status(response.status).send(Buffer.from(response.data));
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(Buffer.from(response.data));
    }
  } catch (error) {
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
