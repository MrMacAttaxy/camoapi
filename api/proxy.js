export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send("Invalid or missing 'url' parameter.");
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.7012.3 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const proxyBase = `https://${req.headers.host}${url.pathname}?url=`;

    if (contentType.includes("text/html")) {
      let body = await response.text();

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (match, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/window\.location\.href\s*=\s*["'](https?:\/\/[^"']+)["']/gi, (match, link) => {
        return `window.location.href="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/<button([^>]*) onclick=["']location\.href=['"](https?:\/\/[^"'>]+)['"]/gi, (match, btnAttrs, link) => {
        return `<button${btnAttrs} onclick="location.href='${proxyBase}${encodeURIComponent(link)}'"`;
      });

      res.send(body);
    } else if (contentType.includes("text/css")) {
      let body = await response.text();

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (match, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.send(body);
    } else if (contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
      let body = await response.text();

      body = body.replace(/(["'`])https?:\/\/[^"'`]+(["'`])/gi, (match, quote, link) => {
        return `${quote}${proxyBase}${encodeURIComponent(link)}${quote}`;
      });

      res.send(body);
    } else {
      res.setHeader("Content-Length", response.headers.get("content-length") || ""); // Preserve file size
      res.setHeader("Content-Disposition", response.headers.get("content-disposition") || "inline"); // Force display if needed

      const readableStream = response.body;
      readableStream.pipe(res); // Pipe binary data directly
    }
  } catch (error) {
    res.status(500).send("Error fetching the target URL.");
  }
}
