const express = require('express');
const axios = require('axios');
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
        'Cache-Control': 'no-cache',
      },
      maxRedirects: 10,
    });

    const contentType = response.headers['content-type'];

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      const script = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        <script>
          document.addEventListener('submit', function(e) {
            let form = e.target;
            if (form && form.action) {
              let originalAction = form.action;
              if (originalAction && !originalAction.startsWith('/proxy?url=')) {
                form.action = '/proxy?url=' + encodeURIComponent(originalAction);
              }
            }
          });

          const inputs = document.querySelectorAll('input[type="search"], input[type="text"]');
          inputs.forEach(input => {
            input.addEventListener('keydown', function(e) {
              if (e.key === 'Enter' && input.form) {
                let form = input.form;
                let originalAction = form.action;
                if (originalAction && !originalAction.startsWith('/proxy?url=')) {
                  form.action = '/proxy?url=' + encodeURIComponent(originalAction);
                }
              }
            });
          });
        </script>
      `;

      htmlContent = htmlContent.replace(/(src|href|srcset)="(\/[^"]+)"/g, (match, p1, p2) => {
        return `${p1}="/proxy?url=${encodeURIComponent(targetUrl + p2)}"`;
      });

      htmlContent = htmlContent.replace(/url\(\s*["']?(\/[^"')]+)["']?\s*\)/g, (match, p1) => {
        return `url("/proxy?url=${encodeURIComponent(targetUrl + p1)}")`;
      });

      htmlContent = htmlContent.replace(/<script src="(\/[^"]+)"/g, (match, p1) => {
        return `<script src="/proxy?url=${encodeURIComponent(targetUrl + p1)}"`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.includes('text/css')) {
      let cssContent = response.data.toString('utf-8');

      cssContent = cssContent.replace(/url\(\s*["']?(\/[^"')]+)["']?\s*\)/g, (match, p1) => {
        return `url("/proxy?url=${encodeURIComponent(targetUrl + p1)}")`;
      });

      res.setHeader('Content-Type', 'text/css');
      res.status(response.status).send(cssContent);
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
