const axios = require('axios');

module.exports = async (req, res) => {
  const { query } = req;
  const targetUrl = query.url;

  if (!targetUrl) {
    return res.status(400).send('No target URL provided');
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': req.headers['user-agent'],
        'Accept': '*/*',
      },
    });

    res.setHeader('Content-Type', response.headers['content-type']);
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error proxying request');
  }
};
