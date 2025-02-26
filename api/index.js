const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

const isAbsoluteURL = (url) => {
  return url.startsWith('http') || url.startsWith('//');
};

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
      htmlContent = htmlContent.replace(/(href|src)="(?!http)([^"]*)"/g, (match, attr, url) => {
        return `${attr}="/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}"`;
      });
      htmlContent = htmlContent.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
        const newSrc = isAbsoluteURL(src) ? src : new URL(src, targetUrl).href;
        return match.replace(src, `/proxy?url=${encodeURIComponent(newSrc)}`);
      });
      htmlContent = htmlContent.replace(/<\/body>/, `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        </body>
      `);
      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.startsWith('image/')) {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(response.data);
    } else if (contentType.includes('text/css')) {
      let cssContent = response.data.toString('utf-8');
      cssContent = cssContent.replace(/url\(\s*["']?(?!https?:\/\/|\/proxy\?url=)([^"')]+)["']?\s*\)/g, (match, url) => {
        let newUrl = new URL(url, targetUrl).href;
        return `url("/proxy?url=${encodeURIComponent(newUrl)}")`;
      });
      res.setHeader('Content-Type', 'text/css');
      res.status(response.status).send(cssContent);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      let jsContent = response.data.toString('utf-8');
      jsContent = jsContent.replace(/(ad|ads|advertisement|doubleclick|popunder|banner|track|analytics)/gi, '');
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
