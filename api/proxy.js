export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send(`<html><head><title>CamoAPI Error</title></head><body><h1>400 - Invalid or missing 'url' parameter.</h1></body></html>`);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": targetUrl,
        "Origin": targetUrl,
      },
    });

    if (!response.ok) {
      return res.status(404).send(`<html><head><title>CamoAPI Error</title></head><body><h1>404 - Could not fetch the target page.</h1></body></html>`);
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);

    if (contentType.startsWith("text/html")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      body = body.replace(/(href|src|action|data|poster|background)=(["']?)(https?:\/\/[^"'\s>]+)(["']?)/gi, (_, attr, quote1, link, quote2) => {
        return `${attr}=${quote1}${proxyBase}${encodeURIComponent(link)}${quote2}`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.send(body);
    } else if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send(`<html><head><title>CamoAPI Error</title></head><body><h1>500 - Could not fetch the target URL.</h1></body></html>`);
  }
}
