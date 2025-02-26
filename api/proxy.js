import axios from 'axios';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL encoding' });
  }

  const validUrlPattern = /^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/;
  if (!validUrlPattern.test(decodedUrl)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': req.headers['user-agent'],
      },
    });

    const contentType = response.headers['content-type'];

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      htmlContent = htmlContent.replace(/<\/body>/, `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        </body>
      `);

      htmlContent = htmlContent.replace(/(<[^>]+)(href|src|action|data-src|data-href)=["']([^"']+)["']/gi, (match, tag, attr, url) => {
        return `${tag}${attr}="${createProxyUrl(url, decodedUrl)}"`;
      });

      htmlContent = htmlContent.replace(/(<iframe[^>]+src=["'])([^"']+)["']/gi, (match, prefix, url) => {
        return `${prefix}${createProxyUrl(url, decodedUrl)}"`;
      });

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.status(response.status).send(response.data);
    } else if (contentType.includes('image/') || contentType.includes('video/')) {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(response.data);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Error fetching resource', details: error.message });
  }
}

function createProxyUrl(url, baseUrl) {
  if (!url) return url;
  const absoluteUrlPattern = /^https?:\/\//;
  if (!absoluteUrlPattern.test(url)) {
    return `/api/proxy?url=${encodeURIComponent(new URL(url, baseUrl).href)}`;
  }
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}
