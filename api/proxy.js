export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get("url");

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
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.startsWith("text/html") || contentType.startsWith("text/")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      const script = `
        <script>
          javascript:(function()%7Bvar%20erudaScript%3Ddocument.createElement('script')%3BerudaScript.src%3D%22%2F%2Fcdn.jsdelivr.net%2Fnpm%2Feruda%2Feruda.min.js%22%3Bvar%20erudaTimingScript%3Ddocument.createElement('script')%3BerudaTimingScript.src%3D%22%2F%2Fcdn.jsdelivr.net%2Fnpm%2Feruda-timing%2Feruda-timing.min.js%22%3Bvar%20erudaCodeScript%3Ddocument.createElement('script')%3BerudaCodeScript.src%3D%22%2F%2Fcdn.jsdelivr.net%2Fnpm%2Feruda-code%2Feruda-code.min.js%22%3Bvar%20erudaDomScript%3Ddocument.createElement('script')%3BerudaDomScript.src%3D%22%2F%2Fcdn.jsdelivr.net%2Fnpm%2Feruda-dom%2Feruda-dom.min.js%22%3Bdocument.body.appendChild(erudaScript)%3BerudaScript.onload%3Dfunction()%7Beruda.init()%3Bdocument.body.appendChild(erudaTimingScript)%3BerudaTimingScript.onload%3Dfunction()%7Beruda.add(erudaTiming)%7D%3Bdocument.body.appendChild(erudaCodeScript)%3BerudaCodeScript.onload%3Dfunction()%7Beruda.add(erudaCode)%7D%3Bdocument.body.appendChild(erudaDomScript)%3BerudaDomScript.onload%3Dfunction()%7Beruda.add(erudaDom)%7D%3B%7D%7D)()%3B
        </script>
      `;

      body = body.replace("</body>", `${script}</body>`);

      body = body.replace(/<iframe[^>]+src=["'](https?:\/\/www.youtube.com[^"'>]+)["'][^>]*>/gi, (_, link) => {
        return `<iframe src="${proxyBase}${encodeURIComponent(link)}"></iframe>`;
      });

      body = body.replace(/(href|src|action)=["'](https?:\/\/[^"'>]+)["']/gi, (_, attr, link) => {
        return `${attr}="${proxyBase}${encodeURIComponent(link)}"`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
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
    console.error(error);
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
}
