const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send('Invalid or missing "url" parameter.');
  }

  if (targetUrl.startsWith(`https://${req.headers.host}`)) {
    return res.status(400).send('Cannot proxy to the same domain.');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Referer': targetUrl,
        'Origin': targetUrl
      }
    });

    if (!response.ok) {
      return res.status(404).send('Could not fetch the target page.');
    }

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Content-Type', contentType);

    if (contentType.startsWith('text/html')) {
      let body = await response.text();
      const proxyBase = `${req.protocol}://${req.headers.host}/api/proxy?url=`;

      body = body.replace(/(href|src|action|data|poster|background)=(["']?)(https?:\/\/[^"'\s>]+)(["']?)/gi, (_, attr, quote1, link, quote2) => {
        return `${attr}=${quote1}${proxyBase}${encodeURIComponent(link)}${quote2}`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proxy Content</title>
          </head>
          <body>
            ${body}
          </body>
        </html>
      `);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Length', buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send('Could not fetch the target URL.');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
