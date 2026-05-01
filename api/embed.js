// /api/embed — collector script (loaded by /s/:code interstitial + landing page)
export const config = { runtime: "edge" };

const COLLECTOR_JS = `
(function(){
  try {
    var s = document.currentScript || (function(){var a=document.getElementsByTagName('script');return a[a.length-1]})();
    var id = s.getAttribute('data-id') || 'unknown';
    var endpoint = s.getAttribute('data-endpoint') || location.origin;

    function snap() {
      var nav = navigator;
      var scr = screen;
      return {
        ts: Date.now(),
        link_code: id,
        ua: nav.userAgent,
        platform: nav.platform,
        languages: nav.languages,
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: { w: scr.width, h: scr.height, dpr: window.devicePixelRatio, depth: scr.colorDepth },
        viewport: { w: innerWidth, h: innerHeight },
        cookieEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack,
        webdriver: nav.webdriver,
        connection: (nav.connection ? { downlink: nav.connection.downlink, rtt: nav.connection.rtt, type: nav.connection.effectiveType } : null),
        referrer: document.referrer,
        url: location.href,
      };
    }

    function send(path, body) {
      try {
        var blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        if (nav.sendBeacon) {
          nav.sendBeacon(endpoint + path, blob);
        } else {
          fetch(endpoint + path, { method:'POST', body: JSON.stringify(body), headers:{'content-type':'application/json'}, keepalive: true });
        }
      } catch(e) {}
    }
    var nav = navigator;

    // Initial snapshot
    send('/api/behavioral', { fingerprintId: id, eventType: 'pageview', data: snap() });

    // Mouse movement sample (1Hz, capped 30 events)
    var mouseEvents = [];
    var lastSampled = 0;
    document.addEventListener('mousemove', function(e){
      var now = Date.now();
      if (now - lastSampled < 1000) return;
      lastSampled = now;
      mouseEvents.push({ x:e.clientX, y:e.clientY, t:now });
      if (mouseEvents.length >= 30) {
        send('/api/behavioral', { fingerprintId:id, eventType:'mouse', data:{events:mouseEvents.slice(),snap:snap()} });
        mouseEvents = [];
      }
    }, { passive: true });

    window.addEventListener('beforeunload', function(){
      if (mouseEvents.length) {
        send('/api/behavioral', { fingerprintId:id, eventType:'mouse', data:{events:mouseEvents,snap:snap()} });
      }
      send('/api/behavioral', { fingerprintId:id, eventType:'unload', data:{ duration: Date.now() - (window._qlStart || Date.now()) } });
    });
    window._qlStart = Date.now();
  } catch(e) {}
})();
`;

export default async function handler(req) {
  return new Response(COLLECTOR_JS, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
