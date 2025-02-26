const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

const isEncodedUrl = (url) => {
  return /%[0-9A-Fa-f]{2}/.test(url);
};

app.get('/proxy', async (req, res) => {
  const { query } = req;
  let targetUrl = query.url;

  if (!targetUrl || isEncodedUrl(targetUrl)) {
    return res.status(400).send('Invalid target URL provided');
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

      htmlContent = htmlContent.replace(/(href|src|action)="(?!http)([^"]*)"/g, (match, attr, url) => {
        return `${attr}="/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}"`;
      });

      htmlContent = htmlContent.replace(/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/g, (match, url) => {
        const proxiedUrl = `/proxy?url=${encodeURIComponent(url)}`;
        return `<iframe src="${proxiedUrl}" frameborder="0" allowfullscreen></iframe>`;
      });

      htmlContent = htmlContent.replace(/<img[^>]*src="([^"]*)"[^>]*>/g, (match, url) => {
        const proxiedUrl = `/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}`;
        return `<img src="${proxiedUrl}" />`;
      });

      htmlContent = htmlContent.replace(/<link[^>]*href="([^"]*)"[^>]*>/g, (match, url) => {
        const proxiedUrl = `/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}`;
        return `<link href="${proxiedUrl}" rel="stylesheet" />`;
      });

      htmlContent = htmlContent.replace(/<script[^>]*src="([^"]*)"[^>]*><\/script>/g, (match, url) => {
        const proxiedUrl = `/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}`;
        return `<script src="${proxiedUrl}"></script>`;
      });

      htmlContent = htmlContent.replace(/<source[^>]*src="([^"]*)"[^>]*>/g, (match, url) => {
        const proxiedUrl = `/proxy?url=${encodeURIComponent(new URL(url, targetUrl).href)}`;
        return `<source src="${proxiedUrl}" />`;
      });

      htmlContent = htmlContent.replace(/<\/body>/, `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        </body>
      `);

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.startsWith('video/') || contentType.startsWith('image/') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(response.data);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(Buffer.from(response.data));
    }
  } catch (error) {
    res.status(500).send('Error proxying request');
  }
});

module.exports = app;
