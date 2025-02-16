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
            if (form && form.action && !form.action.startsWith('/proxy?url=')) {
              form.action = '/proxy?url=' + encodeURIComponent(form.action);
            }
          });

          document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
              let link = e.target;
              if (link.href && !link.href.startsWith('/proxy?url=')) {
                link.href = '/proxy?url=' + encodeURIComponent(link.href);
              }
            }
          });
        </script>
      `;

      htmlContent = htmlContent.replace(/(href|src|srcset)="(?!https?:\/\/)([^\"]+)"/g, (match, p1, p2) => {
        let newUrl = decodeURIComponent(p2);
        if (newUrl.startsWith('/')) {
          newUrl = targetUrl + newUrl;
        }
        return `${p1}="/proxy?url=${encodeURIComponent(newUrl)}"`;
      });

      htmlContent = htmlContent.replace('</body>', `${script}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.includes('text/css')) {
      let cssContent = response.data.toString('utf-8');

      cssContent = cssContent.replace(/url\(\s*["']?(\/[^"')]+)["']?\s*\)/g, (match, p1) => {
        return `url("/proxy?url=${encodeURIComponent(targetUrl + decodeURIComponent(p1))}")`;
      });

      res.setHeader('Content-Type', 'text/css');
      res.status(response.status).send(cssContent);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      let jsContent = response.data.toString('utf-8');

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
