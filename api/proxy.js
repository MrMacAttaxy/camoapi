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
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CamoAPI Error</title>
        </head>
        <body>
          <h1>400 - Invalid or missing 'url' parameter.</h1>
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
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CamoAPI Error</title>
          </head>
          <body>
            <h1>404 - Could not fetch the target page.</h1>
          </body>
        </html>
      `);
    }

    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);

    if (contentType.startsWith("text/html")) {
      let body = await response.text();
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      // Replace all URLs for attributes like href, src, action, etc.
      body = body.replace(/(href|src|action|data|poster|background)=(["']?)(https?:\/\/[^"'\s>]+)(["']?)/gi, (_, attr, quote1, link, quote2) => {
        return `${attr}=${quote1}${proxyBase}${encodeURIComponent(link)}${quote2}`;
      });

      body = body.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (_, link) => {
        return `url("${proxyBase}${encodeURIComponent(link)}")`;
      });

      // Inject the script to handle dynamic script loading and chunked scripts
      const scriptInjection = `
      <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
      <script>eruda.init();</script>
      <script>
        document.querySelectorAll('script').forEach(function(script) {
          const src = script.getAttribute('src');
          if (src && src.startsWith('http')) {
            script.setAttribute('src', '/api/proxy?url=' + encodeURIComponent(src));
          }
        });
        
        // Re-check for dynamically injected scripts (for chunk loading or async scripts)
        const originalAppendChild = HTMLElement.prototype.appendChild;
        HTMLElement.prototype.appendChild = function(child) {
          if (child.tagName === 'SCRIPT') {
            const src = child.getAttribute('src');
            if (src && src.startsWith('http')) {
              child.setAttribute('src', '/api/proxy?url=' + encodeURIComponent(src));
            }
          }
          return originalAppendChild.call(this, child);
        };
      </script>
      `;
      body = body.replace('</body>', `${scriptInjection}</body>`);

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Proxy Content</title>
          </head>
          <body>
            ${body}
          </body>
        </html>
      `);
    } else {
      // For images, video, or other binary files, forward the content directly
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CamoAPI Error</title>
        </head>
        <body>
          <h1>500 - Could not fetch the target URL.</h1>
        </body>
      </html>
    `);
  }
}
