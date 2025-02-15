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
    return res.status(400).send("400 - Invalid URL parameter.");
  }

  if (targetUrl.startsWith(url.origin)) {
    return res.status(400).send("400 - Cannot proxy to the same domain.");
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
      return res.status(response.status).send("404 - Could not fetch the target page.");
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

      const scriptInjection = `
      <script>
        document.querySelectorAll('script, img').forEach(el => {
          const src = el.getAttribute('src');
          if (src && src.startsWith('http')) {
            el.setAttribute('src', '/api/proxy?url=' + encodeURIComponent(src));
          }
        });

        const originalAppendChild = HTMLElement.prototype.appendChild;
        HTMLElement.prototype.appendChild = function(child) {
          if (child.tagName === 'SCRIPT' || child.tagName === 'IMG') {
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

      res.send(body);
    } else {
      response.headers.forEach((value, name) => res.setHeader(name, value));
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Length", buffer.length);
      res.status(response.status).send(buffer);
    }
  } catch (error) {
    res.status(500).send("500 - Could not fetch the target URL.");
  }
}
