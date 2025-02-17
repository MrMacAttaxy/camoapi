self.addEventListener("fetch", event => {
    let url = new URL(event.request.url);
    
    if (url.pathname.startsWith("/proxy/")) {
        let targetUrl = atob(url.pathname.replace("/proxy/", ""));
        event.respondWith(fetch(targetUrl, { mode: "cors" }).catch(() => fetch(targetUrl)));
    }
});
