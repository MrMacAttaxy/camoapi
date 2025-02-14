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
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);

    if (contentType.includes("text/html")) {
      let body = await response.text();
      const proxyBase = `https://${req.headers.host}${url.pathname}?url=`;

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (match, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/<button([^>]*) onclick=["']location\.href=['"](https?:\/\/[^"'>]+)['"]/gi, (match, btnAttrs, link) => {
        return `<button${btnAttrs} onclick="location.href='${proxyBase}${encodeURIComponent(link)}'"`;
      });

      res.send(body);
    } else {
      res.send(await response.arrayBuffer());
    }
  } catch (error) {
    res.status(500).send("Error fetching the target URL.");
  }
}
