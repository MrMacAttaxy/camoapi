export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send(`
      <html>
        <head>
          <title>CamoAPI Error</title>
          <link rel="icon" href="https://www.google.com/s2/favicons?sz=64&domain=camoapi.vercel.app" />
        </head>
        <body>
          <h1>CamoAPI Error</h1>
          <p>Error Type: 400</p>
          <p>Invalid or missing 'url' parameter.</p>
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
      },
    });

    if (!response.ok) {
      return res.status(404).send(`
        <html>
          <head>
            <title>CamoAPI Error</title>
            <link rel="icon" href="https://www.google.com/s2/favicons?sz=64&domain=camoapi.vercel.app" />
          </head>
          <body>
            <h1>CamoAPI Error</h1>
            <p>Error Type: 404</p>
            <p>Could not fetch the target page.</p>
          </body>
        </html>
      `);
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.startsWith("text/html")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      const script = `
        <script>
          let link = document.createElement("link");
          link.rel = "icon";
          link.href = "https://www.google.com/s2/favicons?sz=64&domain=" + new URL("${targetUrl}").hostname;
          document.head.appendChild(link);
        </script>
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;

      body = body.replace("</body>", `${script}</body>`);

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (_, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      body = body.replace(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<img src="${proxyBase}${encodeURIComponent(link)}">`;
      });

      body = body.replace(/<source[^>]+src=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<source src="${proxyBase}${encodeURIComponent(link)}">`;
      });

      body = body.replace(/<iframe[^>]+src=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<iframe src="${proxyBase}${encodeURIComponent(link)}"></iframe>`;
      });

      body = body.replace(/<script[^>]+src=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<script src="${proxyBase}${encodeURIComponent(link)}"></script>`;
      });

      body = body.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:\/\/[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<link rel="stylesheet" href="${proxyBase}${encodeURIComponent(link)}">`;
      });

      body = body.replace(/background(-image)?:\s*url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, prop, link) => {
        return `background${prop ? "-image" : ""}: url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.setHeader("Content-Type", contentType);
      res.send(body);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send(`
      <html>
        <head>
          <title>CamoAPI Error</title>
          <link rel="icon" href="https://www.google.com/s2/favicons?sz=64&domain=camoapi.vercel.app" />
        </head>
        <body>
          <h1>CamoAPI Error</h1>
          <p>Error Type: 500</p>
          <p>Could not fetch the target URL.</p>
        </body>
      </html>
    `);
  }
}
