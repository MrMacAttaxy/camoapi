const express = require('express');
const axios = require('axios');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.all('/proxy', async (req, res) => {
  const { query, method, body, headers } = req;
  let targetUrl = query.url;

  if (!targetUrl) {
    return res.status(400).send('No target URL provided');
  }

  targetUrl = decodeURIComponent(targetUrl);

  try {
    const config = {
      method,
      url: targetUrl,
      headers: {
        ...headers,
        'User-Agent': req.headers['user-agent'],
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
      },
      data: method !== 'GET' ? body : undefined,
      responseType: 'arraybuffer',
    };

    const response = await axios(config);

    const contentType = response.headers['content-type'];

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      const injectScript = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        <script>
          document.querySelectorAll('a').forEach(a => {
            let href = a.href;
            if (href && !href.startsWith('/proxy?url=')) {
              a.href = '/proxy?url=' + encodeURIComponent(href);
            }
          });

          document.querySelectorAll('form').forEach(form => {
            let action = form.action;
            if (action && !action.startsWith('/proxy?url=')) {
              form.action = '/proxy?url=' + encodeURIComponent(action);
            }
          });

          const originalLocation = window.location;
          Object.defineProperty(window, 'location', {
            set: function(value) {
              if (value && !value.startsWith('/proxy?url=')) {
                value = '/proxy?url=' + encodeURIComponent(value);
              }
              originalLocation.assign(value);
            }
          });

          const originalOpen = window.open;
          window.open = function(url) {
            if (url && !url.startsWith('/proxy?url=')) {
              url = '/proxy?url=' + encodeURIComponent(url);
            }
            return originalOpen.apply(window, [url]);
          };

          const originalXHR = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (url && !url.startsWith('/proxy?url=')) {
              url = '/proxy?url=' + encodeURIComponent(url);
            }
            originalXHR.apply(this, arguments);
          };

          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            if (typeof input === 'string' && input && !input.startsWith('/proxy?url=')) {
              input = '/proxy?url=' + encodeURIComponent(input);
            }
            return originalFetch(input, init);
          };
        </script>
      `;

      htmlContent = htmlContent.replace('</body>', `${injectScript}</body>`);

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
