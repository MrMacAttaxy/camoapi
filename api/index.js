const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
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
          (function() {
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
              if (!url.startsWith('/proxy?url=') && !url.startsWith('blob:')) {
                url = "/proxy?url=" + encodeURIComponent(new URL(url, location.href).href);
              }
              return originalFetch.call(this, url, options);
            };

            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              if (!url.startsWith('/proxy?url=') && !url.startsWith('blob:')) {
                url = "/proxy?url=" + encodeURIComponent(new URL(url, location.href).href);
              }
              return originalXHROpen.apply(this, arguments);
            };
          })();
        </script>
      `;

      htmlContent = htmlContent.replace(/(\b(?:src|href|poster|srcset|data-src|data-poster|action|formaction|content|profile|cite|icon|longdesc|usemap|manifest|ping)=")([^"<>]+)/gi, (match, attr, url) => {
        let newUrl = url;
        if (newUrl.startsWith('/') || !newUrl.startsWith('http')) {
          newUrl = new URL(newUrl, targetUrl).href;
        }
        return `${attr}"/proxy?url=${encodeURIComponent(newUrl)}"`;
      });

      htmlContent = htmlContent.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
        return `<script>/* Proxified Script */\n${scriptContent.replace(/(fetch\(['"]?)(https?:\/\/[^'")]+)/gi, (m, prefix, url) => {
          return `${prefix}/proxy?url=${encodeURIComponent(url)}`;
        })}</script>`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.includes('text/css')) {
      let cssContent = response.data.toString('utf-8');
      cssContent = cssContent.replace(/url\(\s*["']?(\/?[^"')]+)["']?\s*\)/g, (match, url) => {
        let newUrl = url;
        if (newUrl.startsWith('/') || !newUrl.startsWith('http')) {
          newUrl = new URL(newUrl, targetUrl).href;
        }
        return `url("/proxy?url=${encodeURIComponent(newUrl)}")`;
      });

      res.setHeader('Content-Type', 'text/css');
      res.status(response.status).send(cssContent);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      let jsContent = response.data.toString('utf-8');
      jsContent = jsContent.replace(/(fetch\(['"]?)(https?:\/\/[^'")]+)/gi, (match, prefix, url) => {
        return `${prefix}/proxy?url=${encodeURIComponent(url)}`;
      });

      res.setHeader('Content-Type', 'application/javascript');
      res.status(response.status).send(jsContent);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(Buffer.from(response.data));
    }
  } catch (error) {
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
