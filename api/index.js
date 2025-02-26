import axios from 'axios';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

  try {
    const response = await axios.get(url, {
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

      res.setHeader('Content-Type', 'text/html');
      res.status(response.status).send(htmlContent);
    } else {
      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching resource' });
  }
}
