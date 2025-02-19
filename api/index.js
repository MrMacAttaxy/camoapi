const express = require('express');
const fetch = require('node-fetch');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

app.get('/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('No target URL provided');

  targetUrl = decodeURIComponent(targetUrl);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'],
        'Accept': '*/*',
        'Cache-Control': 'public, max-age=31536000',
      }
    });

    const contentType = response.headers.get('content-type');

    if (contentType.includes('text/html')) {
      let htmlContent = await response.text();
      const script = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;

      htmlContent = htmlContent.replace(/(\b(?:src|href|poster|srcset|data-src|data-poster|action|formaction|content|profile|cite|icon|longdesc|usemap|manifest|ping)=\"|\')(?!https?:\/\/|\/proxy\?url=)([^"<>]+)(\"|\')/gi, (match, attr, url, quote) => {
        let newUrl = new URL(url, targetUrl).href;
        return `${attr}/proxy?url=${newUrl}${quote}`;
      });

      htmlContent = htmlContent.replace(/style=["']([^"']*url\(['"]?)(?!https?:\/\/|\/proxy\?url=)([^"')]+)(['"]?\))/gi, (match, prefix, url, suffix) => {
        let newUrl = new URL(url, targetUrl).href;
        return `style="${prefix}/proxy?url=${newUrl}${suffix}`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status);
      response.body.pipe(res);
    }
  } catch (error) {
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
