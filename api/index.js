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
      },
      maxRedirects: 10,
    });

    let contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      const script = `
        <script>
          function proxyUrl(url) {
            return '/proxy?url=' + encodeURIComponent(url);
          }

          (function() {
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
              return originalFetch(proxyUrl(url), options);
            };

            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              arguments[1] = proxyUrl(url);
              return originalXhrOpen.apply(this, arguments);
            };

            document.addEventListener('click', function(e) {
              if (e.target.tagName === 'A') {
                e.preventDefault();
                e.target.href = proxyUrl(e.target.href);
              }
            });

            document.addEventListener('submit', function(e) {
              e.preventDefault();
              let form = e.target;
              if (form.action) {
                form.action = proxyUrl(form.action);
                form.submit();
              }
            });
          })();
        </script>
      `;

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.status(response.status).send(htmlContent);
    } else {
      res.status(response.status).send(Buffer.from(response.data));
    }
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
