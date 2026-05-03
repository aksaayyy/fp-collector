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
  const COLLECT_DURATION = 7000;

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



  /* ═══════ ANTIBOT_COMPREHENSIVE — signals beyond Arkose ═══════════════════
   * Targets hCaptcha (window globals + Chrome modern API + wallet extensions),
   * reCAPTCHA/BotGuard (anti-debug, devtools), DataDome/Akamai/Shape/Kasada
   * (behavioral + iframe lineage + worker context), Castle (iframe).
   */

  // ── Window globals — enumerate Object.getOwnPropertyNames(window) ──
  // hCap fingerprints: hash of sorted property names + count + presence of specific keys.
  // Headless / older browsers / extensions all change this.
  function collectWindowGlobals() {
    try {
      const props = Object.getOwnPropertyNames(window);
      props.sort();
      const set = new Set(props);
      // Modern Chrome platform APIs (rotates with version — strong UA-vs-runtime cross-check)
      const modern = [
        "launchQueue","documentPictureInPicture","getScreenDetails","queryLocalFonts",
        "showDirectoryPicker","showOpenFilePicker","showSaveFilePicker","originAgentCluster",
        "onpageswap","onpagereveal","credentialless","fence","sharedStorage","cookieStore",
        "caches","webkitRequestFileSystem","webkitResolveLocalFileSystemURL",
        "onscrollend","onscrollsnapchange","onscrollsnapchanging","ondevicemotion",
        "ondeviceorientation","ondeviceorientationabsolute","speechSynthesis",
        "structuredClone","webkitCancelAnimationFrame","webkitRequestAnimationFrame",
      ];
      const modern_hits = {};
      for (const k of modern) modern_hits[k] = set.has(k);
      // Wallet extension globals — strong human-user signal
      const wallets = [
        "ethereum","solana","phantomHideProvidersArray","_phantomHideProvidersArray",
        "_phantomShowMetamaskExplainer","BinanceChain","TrustBinanceChain","trustwallet",
        "trustwalletTon","trustWallet","TrustCosmos","ton","tronWeb",
        "coinbaseWallet","coinbaseWalletExtension","coinbaseWalletRequestProvider",
        "CoinbaseWalletSDK","CoinbaseWalletProvider","WalletLink","WalletLinkProvider",
        "walletLinkExtension","original","originalSolana","isPhantomInstalled","define",
      ];
      const wallet_hits = {};
      for (const k of wallets) wallet_hits[k] = set.has(k);
      // Tracker / SDK globals — real-page artifacts
      const trackers = [
        "__SENTRY__","__SENTRY_IPC__","_sentryDebugIds","_sentryDebugIdIdentifier",
        "SENTRY_RELEASE","DD_RUM","Raven","dataLayer","google_tag_data","google_tag_manager",
        "litHtmlVersions","webpackJsonp","__core-js_shared__","regeneratorRuntime",
        "Osano","webpackChunk_osano_cmp_consent_manager","__uspapi","grecaptcha","hcaptcha",
        "hcaptchaOnLoad","hCaptchaReady","hCaptchaLoaded","__SECRET_EMOTION__","IntlPolyfill",
      ];
      const tracker_hits = {};
      for (const k of trackers) tracker_hits[k] = set.has(k);
      // Anti-bot/automation globals (presence = compromised)
      const automation = [
        "_phantom","__phantom","callPhantom","Buffer","emit","spawn","webdriver",
        "__webdriver_evaluate","__selenium_evaluate","__webdriver_script_function",
        "__webdriver_script_func","__webdriver_script_fn","__fxdriver_evaluate",
        "__driver_unwrapped","__webdriver_unwrapped","__driver_evaluate","__selenium_unwrapped",
        "__fxdriver_unwrapped","__nightmare","_Selenium_IDE_Recorder","_selenium",
        "calledSelenium","__webdriver","domAutomation","domAutomationController",
        "cdc_adoQpoasnfa76pfcZLmcfl_Array","cdc_adoQpoasnfa76pfcZLmcfl_Promise",
        "cdc_adoQpoasnfa76pfcZLmcfl_Symbol","Frida","_frida",
      ];
      const automation_hits = {};
      let automation_count = 0;
      for (const k of automation) {
        const has = set.has(k);
        automation_hits[k] = has;
        if (has) automation_count++;
      }

      return {
        count: props.length,
        first16: props.slice(0, 16),  // sample for sanity
        last16: props.slice(-16),     // recent additions tend to be at end
        sha256_of_sorted: null,        // computed below via crypto.subtle
        modern_chrome_apis: modern_hits,
        wallet_extensions: wallet_hits,
        trackers: tracker_hits,
        automation: automation_hits,
        automation_flag_count: automation_count,
      };
    } catch (e) { return null; }
  }

  // ── DevTools / debugger detection ──
  // BotGuard probes: performance.now() + Date.now() + console hook + debugger timing
  function detectDevTools() {
    const r = { open: false, signals: [] };
    try {
      // Method 1: console.log getter
      let consoleHit = false;
      const probe = {};
      Object.defineProperty(probe, "id", {
        get: function () { consoleHit = true; return ""; },
      });
      // Don't actually call console in production — just check if a getter would fire
      // (real probe would dirArray it; we leave it implicit).
      // Method 2: window.outerWidth/Height vs innerWidth/Height — devtools open shrinks inner
      const w_diff = Math.abs(window.outerWidth - window.innerWidth);
      const h_diff = Math.abs(window.outerHeight - window.innerHeight);
      if (w_diff > 200) { r.signals.push("width_delta_" + w_diff); r.open = true; }
      if (h_diff > 250) { r.signals.push("height_delta_" + h_diff); r.open = true; }
      // Method 3: debugger keyword timing — tight loop, debugger pauses if open
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      // (Don't actually emit debugger; — would break collection. Just measure base perf.)
      for (let i = 0; i < 100; i++) { /* spin */ }
      const t1 = performance.now();
      const baseline_us = (t1 - t0) * 1000;
      r.spin_us = Math.round(baseline_us);
      // Method 4: devtools-elements check
      r.firefox_devtools = "MozAppearance" in document.documentElement.style ? null : false;
      // Method 5: console-related
      r.console_clear = (typeof console.clear === "function");
      r.console_dir = (typeof console.dir === "function");
      r.console_table = (typeof console.table === "function");
    } catch (e) { r.error = String(e); }
    return r;
  }

  // ── Anti-debug timing divergence ──
  // Real browsers: performance.now() and Date.now() advance ~together with small jitter.
  // Debugger-stepping or instrumented runtime: gaps appear.
  function timingDivergence() {
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const p = performance.now();
      const d = Date.now();
      samples.push([p, d]);
    }
    let max_skew = 0, total_skew = 0;
    for (let i = 1; i < samples.length; i++) {
      const dp = samples[i][0] - samples[i - 1][0];
      const dd = samples[i][1] - samples[i - 1][1];
      const skew = Math.abs(dp - dd);
      if (skew > max_skew) max_skew = skew;
      total_skew += skew;
    }
    return {
      max_skew_ms: Math.round(max_skew * 100) / 100,
      avg_skew_ms: Math.round((total_skew / (samples.length - 1)) * 100) / 100,
      samples_n: samples.length,
    };
  }

  // ── Iframe lineage (Castle / Sardine fingerprint context) ──
  function collectIframeContext() {
    try {
      const r = {
        is_top: window.top === window,
        is_main_frame: window === window.parent,
        depth: 0,
        ancestor_origins: [],
        same_origin_parent: null,
      };
      let cur = window;
      while (cur !== cur.parent && r.depth < 10) { cur = cur.parent; r.depth++; }
      try { r.ancestor_origins = Array.from(window.location.ancestorOrigins || []); } catch {}
      try { r.same_origin_parent = (window.parent === window) ? null :
        (window.parent.location.origin === window.location.origin); } catch {
        r.same_origin_parent = false;  // cross-origin parent throws
      }
      return r;
    } catch (e) { return null; }
  }

  // ── Worker context ──
  // Headless / automation typically lacks ServiceWorker controller.
  function collectWorkerContext() {
    return {
      has_serviceWorker: !!navigator.serviceWorker,
      sw_controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      has_Worker: typeof Worker !== "undefined",
      has_SharedWorker: typeof SharedWorker !== "undefined",
      has_Worklet: typeof Worklet !== "undefined",
    };
  }

  // ── Real instantiation tests (vs typeof-only) ──
  // Automation can fake `typeof Accelerometer === "function"` — but new Accelerometer()
  // requires permission OR throws specific error. Real failure modes differ.
  function realInstantiationProbes() {
    const r = {};
    function probe(name, fn) {
      try { fn(); r[name] = "ok"; }
      catch (e) { r[name] = e.name + ":" + (e.message || "").slice(0, 60); }
    }
    probe("Accelerometer", () => { if (typeof Accelerometer !== "function") throw new Error("undef"); new Accelerometer(); });
    probe("Gyroscope", () => { if (typeof Gyroscope !== "function") throw new Error("undef"); new Gyroscope(); });
    probe("Magnetometer", () => { if (typeof Magnetometer !== "function") throw new Error("undef"); new Magnetometer(); });
    probe("AmbientLightSensor", () => { if (typeof AmbientLightSensor !== "function") throw new Error("undef"); new AmbientLightSensor(); });
    probe("AbsoluteOrientationSensor", () => { if (typeof AbsoluteOrientationSensor !== "function") throw new Error("undef"); new AbsoluteOrientationSensor(); });
    return r;
  }

  // ── Network connection type details ──
  function collectConnectionFull() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return null;
    return {
      type: c.type || null,           // wifi | cellular | ethernet | bluetooth | ...
      effectiveType: c.effectiveType, // slow-2g | 2g | 3g | 4g
      downlink: c.downlink,
      downlinkMax: c.downlinkMax,
      rtt: c.rtt,
      saveData: c.saveData,
    };
  }

  // ── Visibility / lifecycle ──
  function collectVisibility() {
    return {
      state: document.visibilityState,
      hidden: document.hidden,
      hasFocus: document.hasFocus(),
      activeElement_tag: document.activeElement ? document.activeElement.tagName : null,
    };
  }

  // ── Pointer / touch capability ──
  function collectPointerCapability() {
    return {
      maxTouchPoints: navigator.maxTouchPoints || 0,
      hasTouchEvent: ("ontouchstart" in window),
      hasPointerEvent: ("PointerEvent" in window),
      has_pointercoarse: matchMedia("(pointer: coarse)").matches,
      has_pointerfine: matchMedia("(pointer: fine)").matches,
      has_anyhover: matchMedia("(any-hover: hover)").matches,
      has_anypointer_coarse: matchMedia("(any-pointer: coarse)").matches,
      has_anypointer_fine: matchMedia("(any-pointer: fine)").matches,
    };
  }

  // ── Storage roundtrip (some automation has read-only stubs) ──
  function storageRoundtrip() {
    const r = { localStorage: false, sessionStorage: false, cookies: false, indexedDB_open: null };
    try { localStorage.setItem("_t", "1"); r.localStorage = localStorage.getItem("_t") === "1"; localStorage.removeItem("_t"); } catch {}
    try { sessionStorage.setItem("_t", "1"); r.sessionStorage = sessionStorage.getItem("_t") === "1"; sessionStorage.removeItem("_t"); } catch {}
    try { document.cookie = "_t=1; SameSite=Lax"; r.cookies = document.cookie.includes("_t=1"); document.cookie = "_t=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; } catch {}
    try { r.indexedDB_open = !!window.indexedDB && typeof window.indexedDB.open === "function"; } catch {}
    return r;
  }

  async function buildAntibotComprehensive() {
    const out = {
      window_globals: collectWindowGlobals(),
      devtools: detectDevTools(),
      timing: timingDivergence(),
      iframe: collectIframeContext(),
      worker: collectWorkerContext(),
      sensor_real: realInstantiationProbes(),
      connection_full: collectConnectionFull(),
      visibility: collectVisibility(),
      pointer: collectPointerCapability(),
      storage_roundtrip: storageRoundtrip(),
      cookieStore_present: typeof window.cookieStore !== "undefined",
      // Async hash of sorted window prop names (for hCap unique_keys / common_keys_hash check)
      window_globals_hash: null,
    };
    try {
      if (out.window_globals && crypto?.subtle) {
        const buf = await crypto.subtle.digest("SHA-256",
          new TextEncoder().encode(Object.getOwnPropertyNames(window).sort().join(",")));
        out.window_globals_hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
    return out;
  }

  /* ═══════ /ANTIBOT_COMPREHENSIVE ═══════════════════════════════════════ */

  /* ═══════ ARKOSE_NATIVE — full reference-spec FP block ═══════════════════
   * Adds the 23 fe-fields + 70+ enhanced_fp entries with their obfuscated keys
   * and invisible unicode markers exactly as Arkose enforcement script captures.
   * Most replay tools strip ⁢/⁣ → instant flag. We preserve them.
   */

  // ── md5 (RSA Data Security 1991, public domain) ──────────────────────────
  function md5(str) {
    function add32(a,b){return (a+b)&0xFFFFFFFF}
    function cmn(q,a,b,x,s,t){a=add32(add32(a,q),add32(x,t));return add32((a<<s)|(a>>>(32-s)),b)}
    function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t)}
    function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t)}
    function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t)}
    function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t)}
    function md5cycle(x,k){var a=x[0],b=x[1],c=x[2],d=x[3];
      a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
      a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
      a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);
      a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);
      a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
      a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
      a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
      a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
      a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
      a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
      a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
      a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
      a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
      a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
      a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);
      a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
      x[0]=add32(a,x[0]);x[1]=add32(b,x[1]);x[2]=add32(c,x[2]);x[3]=add32(d,x[3])}
    function md5blk(s){var r=[],i;for(i=0;i<64;i+=4)r[i>>2]=s.charCodeAt(i)+(s.charCodeAt(i+1)<<8)+(s.charCodeAt(i+2)<<16)+(s.charCodeAt(i+3)<<24);return r}
    function md51(s){var n=s.length,state=[1732584193,-271733879,-1732584194,271733878],i;
      for(i=64;i<=n;i+=64)md5cycle(state,md5blk(s.substring(i-64,i)));
      s=s.substring(i-64);var tail=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      for(i=0;i<s.length;i++)tail[i>>2]|=s.charCodeAt(i)<<((i%4)<<3);
      tail[i>>2]|=0x80<<((i%4)<<3);
      if(i>55){md5cycle(state,tail);tail=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
      tail[14]=n*8;md5cycle(state,tail);return state}
    var hex_chr='0123456789abcdef'.split('');
    function rhex(n){var s='',j;for(j=0;j<4;j++)s+=hex_chr[(n>>(j*8+4))&0x0F]+hex_chr[(n>>(j*8))&0x0F];return s}
    function hex(x){for(var i=0;i<x.length;i++)x[i]=rhex(x[i]);return x.join('')}
    return hex(md51(str));
  }

  // ── murmurhash3 (Austin Appleby, public domain) ──────────────────────────
  function mh3(key, seed){seed=seed||0;var rem=key.length&3,bytes=key.length-rem,h1=seed,c1=0xcc9e2d51,c2=0x1b873593,i=0,k1;
    while(i<bytes){k1=(key.charCodeAt(i)&0xff)|((key.charCodeAt(++i)&0xff)<<8)|((key.charCodeAt(++i)&0xff)<<16)|((key.charCodeAt(++i)&0xff)<<24);++i;
      k1=Math.imul(k1,c1);k1=(k1<<15)|(k1>>>17);k1=Math.imul(k1,c2);h1^=k1;h1=(h1<<13)|(h1>>>19);h1=(Math.imul(h1,5)+0xe6546b64)|0}
    k1=0;switch(rem){case 3:k1^=(key.charCodeAt(i+2)&0xff)<<16;case 2:k1^=(key.charCodeAt(i+1)&0xff)<<8;case 1:k1^=(key.charCodeAt(i)&0xff);
      k1=Math.imul(k1,c1);k1=(k1<<15)|(k1>>>17);k1=Math.imul(k1,c2);h1^=k1}
    h1^=key.length;h1^=h1>>>16;h1=Math.imul(h1,0x85ebca6b);h1^=h1>>>13;h1=Math.imul(h1,0xc2b2ae35);h1^=h1>>>16;return h1|0}

  function mqv(prop, vals){for(const v of vals)try{if(matchMedia(`(${prop}: ${v})`).matches)return v}catch{}return "none"}

  // ── Arkose-spec canvas FP (different from our SHA-256 canvas — uses murmurhash3 of toDataURL) ──
  function arkoseCanvasFP(){
    try{const c=document.createElement("canvas");if(!c.getContext)return false;
      c.width=2000;c.height=200;const ctx=c.getContext("2d");if(!ctx)return false;
      const parts=[];
      ctx.rect(0,0,10,10);ctx.rect(2,2,6,6);
      parts.push("canvas winding:"+(ctx.isPointInPath(5,5,"evenodd")===false?"yes":"no"));
      ctx.textBaseline="alphabetic";ctx.fillStyle="#f60";ctx.fillRect(125,1,62,20);
      ctx.fillStyle="#069";ctx.font="11pt no-real-font-123";ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F603}",2,15);
      ctx.fillStyle="rgba(102,204,0,0.2)";ctx.font="18pt Arial";ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F603}",4,45);
      ctx.globalCompositeOperation="multiply";
      ctx.fillStyle="rgb(255,0,255)";ctx.beginPath();ctx.arc(50,50,50,0,Math.PI*2,true);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgb(0,255,255)";ctx.beginPath();ctx.arc(100,50,50,0,Math.PI*2,true);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgb(255,255,0)";ctx.beginPath();ctx.arc(75,100,50,0,Math.PI*2,true);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgb(255,0,255)";ctx.arc(75,75,75,0,Math.PI*2,true);ctx.arc(75,75,25,0,Math.PI*2,true);ctx.fill("evenodd");
      parts.push("canvas fp:"+c.toDataURL());
      return mh3(parts.join("~"));
    }catch{return false}
  }

  // ── ApplePay version probe (1..30) ──
  function applePayVersion(){let v=0;try{if(window.ApplePaySession&&location.protocol==="https:")for(let i=1;i<=30;i++)if(ApplePaySession.supportsVersion(i))v=i}catch{}return v}

  // ── Wallet detection (MetaMask/Coinbase/Brave) ──
  function walletDetect(){const w=[];try{const e=window.ethereum;if(e){if(e.isMetaMask)w.push("MetaMask");if(e.isCoinbaseWallet)w.push("Coinbase");if(e.isBraveWallet)w.push("Brave")}}catch{}return w}

  // ── Async signal collectors ──
  async function arkoseAudioFP(){return new Promise(res=>{try{const AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!AC){res(null);return}
    const ctx=new AC(1,44100,44100),osc=ctx.createOscillator(),comp=ctx.createDynamicsCompressor();
    osc.type="triangle";osc.frequency.value=10000;
    if(comp.threshold)comp.threshold.value=-50;if(comp.knee)comp.knee.value=40;if(comp.ratio)comp.ratio.value=12;
    if(comp.attack)comp.attack.value=0;if(comp.release)comp.release.value=0.25;
    osc.connect(comp);comp.connect(ctx.destination);osc.start(0);ctx.startRendering();
    ctx.oncomplete=e=>{let s=0;const d=e.renderedBuffer.getChannelData(0);for(let i=4500;i<5000;i++)s+=Math.abs(d[i]);comp.disconnect();res(s.toString())}
    }catch{res(null)}})}
  async function devicesHash(){try{if(!navigator.mediaDevices?.enumerateDevices)return null;const d=await navigator.mediaDevices.enumerateDevices();return md5(JSON.stringify(d.map(x=>({kind:x.kind,id:x.deviceId,group:x.groupId}))))}catch{return null}}
  async function permsHash(){try{if(!navigator.permissions)return null;const names=["notifications","push","midi","camera","microphone","speaker","device-info","background-fetch","background-sync","bluetooth","persistent-storage","ambient-light-sensor","accelerometer","gyroscope","magnetometer","clipboard-read","screen-wake-lock","nfc","display-capture"];const r={};for(const n of names){try{r[n]=(await navigator.permissions.query({name:n})).state}catch{r[n]="error"}}return md5(JSON.stringify(r))}catch{return null}}
  async function speechVoices(){return new Promise(res=>{try{if(!window.speechSynthesis){res({def:null,hash:null});return}
    const get=()=>{const v=speechSynthesis.getVoices();if(!v.length)return null;return{def:v[0].name+" || "+v[0].lang,hash:md5(v.map(x=>x.name+":"+x.lang).join(","))}};
    const r=get();if(r){res(r);return}speechSynthesis.onvoiceschanged=()=>res(get()||{def:null,hash:null});setTimeout(()=>res({def:null,hash:null}),200)}catch{res({def:null,hash:null})}})}
  async function keyboardHash(){try{if(!navigator.keyboard?.getLayoutMap)return md5("false");const m=await navigator.keyboard.getLayoutMap();const e=[];m.forEach((v,k)=>e.push(k+":"+v));return md5(e.join("|"))}catch{return md5("false")}}

  async function buildArkoseNative(){
    const n=navigator,scr=screen,W=window;
    // ── fe — 23 strings ──
    const S=scr.height>scr.width?[scr.height,scr.width]:[scr.width,scr.height];
    const AS=scr.availHeight>scr.availWidth?[scr.availHeight,scr.availWidth]:[scr.availWidth,scr.availHeight];
    let mt=n.maxTouchPoints||n.msMaxTouchPoints||0;if(isNaN(mt))mt=-999;
    let te=false;try{document.createEvent("TouchEvent");te=true}catch{}
    const plugins=[];if(n.plugins)for(let i=0;i<n.plugins.length;i++)plugins.push(n.plugins[i].name);
    const ua=n.userAgent.toLowerCase(),pl=n.platform.toLowerCase();
    const detectedOS=ua.includes("win")?"Windows":ua.includes("mac")?"Mac":ua.includes("linux")?"Linux":ua.includes("android")?"Android":(ua.includes("iphone")||ua.includes("ipad"))?"iOS":"Other";
    const fos=(pl.includes("win")&&detectedOS!=="Windows")||(pl.includes("linux")&&detectedOS!=="Linux"&&detectedOS!=="Android")||(pl.includes("mac")&&detectedOS!=="Mac"&&detectedOS!=="iOS");
    let fb=false;try{const l=eval.toString().length;fb=(l===37&&!/safari|firefox/i.test(n.userAgent))||(l===39&&!/trident/i.test(n.userAgent))||(l===33&&!/chrome|opera/i.test(n.userAgent))}catch{}
    const fr=Math.max(scr.width,scr.height)<Math.max(scr.availWidth,scr.availHeight)||Math.min(scr.width,scr.height)<Math.min(scr.availWidth,scr.availHeight);
    const fonts=collectFonts().detected||[];
    const fe=[
      "DNT:"+(n.doNotTrack||n.msDoNotTrack||W.doNotTrack||"unknown"),
      "L:"+(n.language||""),
      "D:"+(scr.colorDepth||-1),
      "PR:"+(W.devicePixelRatio||""),
      "S:"+S.join(","),
      "AS:"+AS.join(","),
      "TO:"+new Date().getTimezoneOffset(),
      "SS:"+(()=>{try{return !!W.sessionStorage}catch{return true}})(),
      "LS:"+(()=>{try{return !!W.localStorage}catch{return true}})(),
      "IDB:"+(()=>{try{return !!W.indexedDB}catch{return true}})(),
      "B:"+(!!document.body&&!!document.body.addBehavior),
      "ODB:"+!!W.openDatabase,
      "CPUC:"+(n.cpuClass||"unknown"),
      "PK:"+(n.platform||"unknown"),
      "CFP:"+arkoseCanvasFP(),
      "FR:"+fr,
      "FOS:"+fos,
      "FB:"+fb,
      "JSF:"+fonts.join(","),
      "P:"+plugins.join(","),
      "T:"+[mt,te,"ontouchstart" in W].join(","),
      "H:"+(n.hardwareConcurrency||"unknown"),
      "SWF:"+(typeof W.swfobject!=="undefined"),
    ];

    // ── enhanced_fp — async signals ──
    const [audioFP,devH,permsH,sp,kbH]=await Promise.all([arkoseAudioFP(),devicesHash(),permsHash(),speechVoices(),keyboardHash()]);
    const efp=[];

    // WebGL re-collected with Arkose key names (md5 hashes inline)
    try{const gl=document.createElement("canvas").getContext("webgl")||document.createElement("canvas").getContext("experimental-webgl");
      if(gl){const exts=gl.getSupportedExtensions()||[];
        efp.push({key:"webgl_extensions",value:exts.join(";")});
        efp.push({key:"webgl_extensions_hash",value:md5(exts.join(";"))});
        efp.push({key:"webgl_renderer",value:gl.getParameter(gl.RENDERER)});
        efp.push({key:"webgl_vendor",value:gl.getParameter(gl.VENDOR)});
        efp.push({key:"webgl_version",value:gl.getParameter(gl.VERSION)});
        efp.push({key:"webgl_shading_language_version",value:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)});
        efp.push({key:"webgl_aliased_line_width_range",value:JSON.stringify(Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)))});
        efp.push({key:"webgl_aliased_point_size_range",value:JSON.stringify(Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)))});
        efp.push({key:"webgl_antialiasing",value:gl.getContextAttributes().antialias?"yes":"no"});
        efp.push({key:"webgl_bits",value:[gl.getParameter(gl.ALPHA_BITS),gl.getParameter(gl.DEPTH_BITS),gl.getParameter(gl.STENCIL_BITS),gl.getParameter(gl.RED_BITS),gl.getParameter(gl.GREEN_BITS),gl.getParameter(gl.BLUE_BITS)].join(",")});
        const dbg=gl.getExtension("WEBGL_debug_renderer_info");
        efp.push({key:"webgl_unmasked_vendor",value:dbg?gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL):null});
        efp.push({key:"webgl_unmasked_renderer",value:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null});
      }
    }catch{}

    const audioCod={ogg:document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"'),mp3:document.createElement("audio").canPlayType("audio/mpeg"),wav:document.createElement("audio").canPlayType('audio/wav; codecs="1"'),m4a:document.createElement("audio").canPlayType("audio/x-m4a"),aac:document.createElement("audio").canPlayType("audio/aac")};
    const videoCod={ogg:document.createElement("video").canPlayType('video/ogg; codecs="theora"'),h264:document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"'),webm:document.createElement("video").canPlayType('video/webm; codecs="vp8, vorbis"'),vp9:document.createElement("video").canPlayType('video/webm; codecs="vp9"')};

    efp.push({key:"user_agent_data_brands",value:n.userAgentData?.brands?JSON.stringify(n.userAgentData.brands):null});
    efp.push({key:"user_agent_data_mobile",value:n.userAgentData?.mobile??null});
    efp.push({key:"navigator_connection_downlink",value:n.connection?.downlink??null});
    efp.push({key:"navigator_connection_downlink_max",value:n.connection?.downlinkMax??null});
    efp.push({key:"network_info_rtt",value:n.connection?.rtt??null});
    efp.push({key:"network_info_save_data",value:n.connection?.saveData??null});
    efp.push({key:"network_info_rtt_type",value:n.connection?.type??md5("").slice(0,6)});
    efp.push({key:"screen_pixel_depth",value:scr.pixelDepth});
    efp.push({key:"navigator_device_memory",value:n.deviceMemory??null});
    efp.push({key:"navigator_languages",value:n.languages?n.languages.join(","):n.language});
    efp.push({key:"window_inner_width",value:W.innerWidth});
    efp.push({key:"window_inner_height",value:W.innerHeight});
    efp.push({key:"window_outer_width",value:W.outerWidth});
    efp.push({key:"window_outer_height",value:W.outerHeight});
    efp.push({key:"browser_detection_firefox",value:n.userAgent.toLowerCase().includes("firefox")});
    efp.push({key:"browser_detection_brave",value:!!n.brave});
    efp.push({key:"f58835f",value:md5(JSON.stringify([typeof PermissionStatus,typeof EyeDropper,typeof AudioData,typeof WritableStreamDefaultController,typeof CSSCounterStyleRule,typeof NavigatorUAData,typeof BarcodeDetector,typeof Intl?.DisplayNames,typeof ContactsManager,typeof SVGDiscardElement,typeof USB,typeof n.mediaDevices]))});
    efp.push({key:"browser_object_checks",value:md5(JSON.stringify([!!W.chrome,!!W.safari,!!W.__crWeb,!!W.__gCrWeb,!!W.yandex,!!W.__yb,!!W.__ybro,!!W.__firefox__,!!W.__edgeTrackingPreventionStatistics,!!W.webkit,!!W.opr,!!W.samsungAr,!!W.ucweb,!!W.UCShellJava,!!W.puffinDevice]))});
    // Invisible unicode marker ⁣ — Arkose state field
    efp.push({key:"29s83ih9",value:md5(JSON.stringify([typeof globalThis?.global,typeof globalThis?.setImmediate,typeof globalThis?.module]))+"⁣"});
    efp.push({key:"audio_codecs",value:JSON.stringify(audioCod)});
    efp.push({key:"audio_codecs_extended_hash",value:md5(JSON.stringify(audioCod))});
    efp.push({key:"video_codecs",value:JSON.stringify(videoCod)});
    efp.push({key:"video_codecs_extended_hash",value:md5(JSON.stringify(videoCod))});
    efp.push({key:"media_query_dark_mode",value:matchMedia("(prefers-color-scheme: dark)").matches});
    efp.push({key:"f9bf2db",value:JSON.stringify({pc:mqv("prefers-contrast",["high","more","low","less","forced","no-preference"]),ah:mqv("any-hover",["hover","none"]),ap:mqv("any-pointer",["fine","coarse","none"]),p:mqv("pointer",["fine","coarse","none"]),h:mqv("hover",["hover","none"]),u:mqv("update",["fast","slow","none"]),ic:mqv("inverted-colors",["inverted","none"]),prm:mqv("prefers-reduced-motion",["reduce","no-preference"]),s:mqv("scripting",["enabled","initial-only","none"]),fc:mqv("forced-colors",["active","none"])})});
    efp.push({key:"headless_browser_phantom",value:!!(W.callPhantom||W._phantom)});
    efp.push({key:"headless_browser_selenium",value:!!(W.__webdriver_evaluate||W.__selenium_evaluate||W.__fxdriver_evaluate||W.__driver_evaluate)});
    efp.push({key:"headless_browser_nightmare_js",value:!!W.__nightmare});
    efp.push({key:"862f2c1",value:(n.webdriver?4:0)});
    // ⁣ marker
    efp.push({key:"1l2l5234ar2",value:Date.now().toString()+"⁣"});
    efp.push({key:"document__referrer",value:document.referrer});
    efp.push({key:"window__ancestor_origins",value:W.location.ancestorOrigins?Array.from(W.location.ancestorOrigins):[]});
    efp.push({key:"window__tree_index",value:[]});
    efp.push({key:"window__tree_structure",value:JSON.stringify([[],[[]]])});
    efp.push({key:"window__location_href",value:W.location.href});
    efp.push({key:"client_config__sitedata_location_href",value:W.location.href});
    efp.push({key:"client_config__language",value:null});
    efp.push({key:"client_config__surl",value:null});
    // ⁢ marker
    efp.push({key:"c8480e29a",value:md5("null")+"⁢"});
    efp.push({key:"client_config__triggered_inline",value:false});
    efp.push({key:"mobile_sdk__is_sdk",value:false});
    if(audioFP)efp.push({key:"audio_fingerprint",value:audioFP});
    try{if(n.getBattery){const b=await n.getBattery();efp.push({key:"navigator_battery_charging",value:b.charging})}}catch{}
    if(devH)efp.push({key:"7541c2s",value:devH});
    if(permsH)efp.push({key:"1f220c9",value:permsH});
    if(sp.def)efp.push({key:"speech_default_voice",value:sp.def});
    if(sp.hash)efp.push({key:"speech_voices_hash",value:sp.hash});
    efp.push({key:"math_fingerprint",value:md5([Math.acos(0.123456789),Math.acosh(1e308),Math.asin(0.123456789),Math.asinh(1),Math.atan(2),Math.atanh(0.5),Math.cbrt(100),Math.cos(21*Math.LN2),Math.cosh(1),Math.exp(1),Math.expm1(1),Math.log(10),Math.log1p(10),Math.log2(10),Math.log10(10),Math.pow(Math.PI,-100),Math.sin(21*Math.LN2),Math.sinh(1),Math.sqrt(2),Math.tan(Math.PI/4),Math.tanh(1)].join(","))});
    efp.push({key:"supported_math_functions",value:md5(Object.getOwnPropertyNames(Math).sort().join(","))});
    efp.push({key:"3f76dd27",value:scr.orientation?.type||null});
    efp.push({key:"5dd48ca0",value:(W.RTCPeerConnection?1:0)+(W.webkitRTCPeerConnection?2:0)+(W.mozRTCPeerConnection?4:0)});
    efp.push({key:"4b4b269e68",value:crypto.randomUUID()});
    efp.push({key:"6a62b2a558",value:md5(W.location.origin)});
    efp.push({key:"is_keyless",value:false});
    efp.push({key:"c2d2015",value:md5(JSON.stringify([typeof Accelerometer,typeof Gyroscope,typeof AmbientLightSensor,typeof Magnetometer,typeof AbsoluteOrientationSensor]))});
    efp.push({key:"43f2d94",value:walletDetect()});
    efp.push({key:"20c15922",value:!!n.bluetooth});
    efp.push({key:"4f59ca8",value:applePayVersion()});
    efp.push({key:"3ea7194",value:{supported:false,formats:[],isHDR:matchMedia("(dynamic-range: high)").matches}});
    efp.push({key:"05d3d24",value:md5(JSON.stringify({colorScheme:matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light",reducedMotion:matchMedia("(prefers-reduced-motion:reduce)").matches?"reduce":"no-preference",forcedColors:matchMedia("(forced-colors:active)").matches?"active":"none",hover:matchMedia("(hover:hover)").matches?"hover":"none",pointer:mqv("pointer",["fine","coarse","none"]),orientation:matchMedia("(orientation:landscape)").matches?"landscape":"portrait",dynamicRange:matchMedia("(dynamic-range:high)").matches?"high":"standard"}))});
    if(kbH)efp.push({key:"83eb055",value:kbH});
    efp.push({key:"vsadsa",value:(()=>{try{return W.navigation?.entries?.()?.length??null}catch{return null}})()});
    efp.push({key:"basfas",value:(()=>{try{const m=performance?.memory;if(!m)return [1,null];return [0,m.jsHeapSizeLimit]}catch{return [1,null]}})()});
    efp.push({key:"lfasdgs",value:crypto.randomUUID()});

    // ── jsbd ──
    let nwd=JSON.stringify(n.webdriver);
    if(n.webdriver===undefined){nwd="undefined";if(Object.getOwnPropertyDescriptor(n,"webdriver"))nwd="faked"}
    const jsbd=JSON.stringify({HL:W.history.length,NCE:n.cookieEnabled,DT:document.title,NWD:nwd,DMTO:1,DOTO:1});

    // ── compute hashes (Arkose-spec) ──
    const f_hash=md5(fe.join(";"));
    const wh=f_hash+"|"+md5(efp.map(x=>JSON.stringify(x.value)).join(","));
    const ife_hash=md5(fe.join(","));

    // ── final spec-compliant payload (replay-ready) ──
    const ts=Math.floor(Date.now()/1000);
    return {
      api_type:"js",
      f:f_hash,
      n:btoa(ts.toString()),
      wh:wh,
      enhanced_fp:efp,
      fe:fe,
      ife_hash:ife_hash,
      jsbd:jsbd,
    };
  }

  /* ═══════ /ARKOSE_NATIVE ═══════════════════════════════════════════════ */

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
    try { fp.arkose_native = await buildArkoseNative(); } catch (e) { fp.arkose_native = null; }
    try { fp.antibot = await buildAntibotComprehensive(); } catch (e) { fp.antibot = null; }
    fp.behavioral = { mouse: behav.mouse.length, keyboard: behav.keyboard.length, scroll: behav.scroll.length, touch: behav.touch.length, click: behav.click.length, focus: behav.focus.length, collectionDurationMs: ts() };
    fp._hp = safe(() => document.getElementById("hp_email")?.value || "", "");
    fp._meta = { collectedAt: new Date().toISOString(), url: window.location.href, referrer: document.referrer, collectionDurationMs: ts() };
    return fp;
  }

  /* ═══════ SEND ═══════ */
  function getScriptCfg() {
    try {
      const cur = document.currentScript || (function(){var a=document.getElementsByTagName('script');for(var i=a.length-1;i>=0;i--){if(a[i].src&&a[i].src.indexOf('embed.js')>-1)return a[i];}return a[a.length-1];})();
      return { link_code: cur ? cur.getAttribute('data-id') : null, endpoint: (cur && cur.getAttribute('data-endpoint')) || location.origin };
    } catch { return { link_code: null, endpoint: location.origin }; }
  }
  async function send(fp) {
    const cfg = getScriptCfg();
    const challenge = await solveChallenge();
    const payload = { fingerprint: fp, behavioral: behav, challenge, link_code: cfg.link_code, meta: { collectedAt: new Date().toISOString(), url: location.href, referrer: document.referrer, durationMs: ts() } };
    const body = JSON.stringify(payload);
    try {
      // fetch with keepalive — sendBeacon has 64KB limit; our payload (5000 mouse pts + arkose_native + antibot) exceeds it
      fetch(cfg.endpoint + COLLECT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(()=>{});
    } catch {}
  }

  /* ═══════ INIT ═══════ */
  let _sent = false;
  async function init() {
    setupBehavioral();
    if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = () => {}; speechSynthesis.getVoices(); }
    window.addEventListener('beforeunload', () => {
      if (_sent) return;
      try {
        const cfg = getScriptCfg();
        const partial = { partial: true, link_code: cfg.link_code, navigator: collectNavigator(), screen: collectScreen(), behavioral: behav, meta: { url: location.href, referrer: document.referrer, durationMs: ts() } };
        try { fetch(cfg.endpoint + COLLECT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partial), keepalive: true }).catch(()=>{}); } catch {}
      } catch {}
    });
    setTimeout(async () => { const fp = await collect(); _sent = true; await send(fp); }, COLLECT_DURATION);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
