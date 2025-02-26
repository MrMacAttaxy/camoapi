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

  if (decodedUrl.includes('/api/proxy')) {
    return res.status(400).json({ error: 'Proxying self is not allowed' });
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

// New function to handle Google search URLs
function createGoogleSearchUrl(query) {
  const baseGoogleUrl = 'https://google.com/search';
  return `${baseGoogleUrl}?q=${encodeURIComponent(query)}`;
}
