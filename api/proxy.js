const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).send(`
      <html>
        <head><title>CamoAPI Error</title></head>
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
          <head><title>CamoAPI Error</title></head>
          <body>
            <h1>CamoAPI Error</h1>
            <p>Error Type: 404</p>
            <p>Could not fetch the target page.</p>
          </body>
        </html>
      `);
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);

    if (contentType.startsWith("text/html")) {
      let body = await response.text();
      const proxyBase = `${req.protocol}://${req.get("host")}/api/proxy?url=`;

      const script = `
        <script>
          let link = document.createElement("link");
          link.rel = "icon";
          link.href = "https://www.google.com/s2/favicons?sz=64&domain=" + new URL("${targetUrl}").hostname;
          document.head.appendChild(link);
        </script>
      `;

      body = body.replace("</body>", `${script}</body>`);

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (_, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      res.send(body);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send(`
      <html>
        <head><title>CamoAPI Error</title></head>
        <body>
          <h1>CamoAPI Error</h1>
          <p>Error Type: 500</p>
          <p>Could not fetch the target URL.</p>
        </body>
      </html>
    `);
  }
});

module.exports = app;
