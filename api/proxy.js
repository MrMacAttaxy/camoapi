export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || /^data:/.test(targetUrl) || !/^https?:\/\//.test(targetUrl)) {
    return res.status(404).send(`
      <html>
        <head>
          <title>CamoAPI Error</title>
        </head>
        <body>
          <h1>CamoAPI Error</h1>
          <p>Error Type: 404</p>
          <p>Could not find the page you wanted!<br>Please Try Again</p>
        </body>
      </html>
    `);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": targetUrl,
        "Origin": targetUrl,
        "X-Forwarded-For": req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      },
    });

    if (!response.ok) {
      return res.status(404).send(`
        <html>
          <head>
            <title>CamoAPI Error</title>
          </head>
          <body>
            <h1>CamoAPI Error</h1>
            <p>Error Type: 404</p>
            <p>Could not fetch the page at the provided URL.<br>Please try again with a valid URL.</p>
          </body>
        </html>
      `);
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.startsWith("text/html") || contentType.startsWith("text/")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (_, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      body = body.replace(/<iframe[^>]+src=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<iframe src="${proxyBase}${encodeURIComponent(link)}"></iframe>`;
      });

      res.setHeader("Content-Type", contentType);
      res.send(body);
    } else if (contentType.startsWith("image/") || contentType.startsWith("audio/") || contentType.startsWith("video/")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    return res.status(404).send(`
      <html>
        <head>
          <title>CamoAPI Error</title>
        </head>
        <body>
          <h1>CamoAPI Error</h1>
          <p>Error Type: 404</p>
          <p>Could not find the page at the provided URL.<br>Please try again with a valid URL.</p>
        </body>
      </html>
    `);
  }
}
