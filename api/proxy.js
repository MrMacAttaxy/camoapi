export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send("Invalid or missing 'url' parameter.");
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send("Failed to fetch resource.");
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.startsWith("text/html")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (_, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.send(body);
    } else {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Length", buffer.byteLength);
      res.status(response.status).send(Buffer.from(buffer));
    }
  } catch (error) {
    res.status(500).send("Error fetching the target URL.");
  }
}
