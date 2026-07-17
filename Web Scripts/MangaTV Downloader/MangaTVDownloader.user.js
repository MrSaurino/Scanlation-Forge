// ==UserScript==
// @name         MangaTV - Cap Downloader
// @namespace    https://mangatv.net/
// @version      5.4
// @description  Manga chapters downloader for the website MangaTV
// @author       MrSaurino
// @match        https://mangatv.net/*
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      mangatv.net
// ==/UserScript==

/* global fflate */

(function () {
    'use strict';

    // Inject UI styles for buttons and toast notifications
    GM_addStyle(`
        #mtv-dl-wrap { display:flex; justify-content:center; margin:14px 0; width:100%; }
        #mtv-dl-btn { display:inline-flex; align-items:center; gap:8px; background:#e94560; color:#fff !important; font-size:15px; font-weight:700; padding:11px 26px; border-radius:8px; border:none; cursor:pointer; font-family:inherit; box-shadow:0 3px 12px rgba(233,69,96,0.45); transition:background .2s, transform .1s; }
        #mtv-dl-btn:hover  { background:#c73652; transform:translateY(-2px); }
        #mtv-dl-btn:active { transform:translateY(0); }
        #mtv-dl-btn.loading { background:#555; cursor:wait; pointer-events:none; }
        .mtv-row-btn { display:inline-flex; align-items:center; gap:5px; background:#e94560; color:#fff !important; font-size:12px; font-weight:700; padding:4px 10px; border-radius:6px; border:none; cursor:pointer; font-family:inherit; margin-left:8px; vertical-align:middle; white-space:nowrap; text-decoration:none !important; transition:background .2s; }
        .mtv-row-btn:hover   { background:#c73652; }
        .mtv-row-btn.loading { background:#555; cursor:wait; pointer-events:none; }
        .mtv-row-btn.done    { background:#1d9e75; }
        #mtv-toast { position:fixed; bottom:26px; left:50%; transform:translateX(-50%); background:#1a1a2e; color:#e0e0e0; border:1px solid #e94560; border-radius:10px; padding:13px 24px; font-family:'Segoe UI', sans-serif; font-size:13px; z-index:999999; min-width:260px; text-align:center; box-shadow:0 4px 20px rgba(0,0,0,.7); display:none; }
        #mtv-toast-bar  { height:4px; background:#333; border-radius:2px; margin-top:8px; overflow:hidden; }
        #mtv-toast-fill { height:100%; width:0%; background:#e94560; transition:width .3s; border-radius:2px; }
    `);

    const v_toast = document.createElement('div');
    v_toast.id = 'mtv-toast';
    v_toast.innerHTML = `<span id="mtv-tmsg"></span><div id="mtv-toast-bar"><div id="mtv-toast-fill"></div></div>`;
    document.body.appendChild(v_toast);

    function showToast(v_msg, v_pct) {
        v_toast.style.display = 'block', document.getElementById('mtv-tmsg').textContent = v_msg, document.getElementById('mtv-toast-fill').style.width = v_pct + '%';
    }

    function hideToast() {
        setTimeout(() => (v_toast.style.display = 'none', document.getElementById('mtv-toast-fill').style.width = '0%'), 2800);
    }

    function dlIcon(v_size) {
        return `<svg width="${v_size || 14}" height="${v_size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    }

    function safeName(v_str) {
        return (v_str || 'capitulo').replace(/[^\w\sáéíóúñÁÉÍÓÚÑ\-]/g, '').trim().substring(0, 80) || 'capitulo';
    }

    //XHR requests and binary transformations
    function fetchImageBuffer(v_url) {
        return new Promise((v_resolve, v_reject) => GM_xmlhttpRequest({
            method: 'GET', url: v_url, responseType: 'arraybuffer', timeout: 15000,
            headers: { 'Referer': 'https://mangatv.net/', 'Origin': 'https://mangatv.net' },
            onload: v_r => (v_r.status === 200 && v_r.response) ? v_resolve(new Uint8Array(v_r.response)) : v_reject(new Error('HTTP ' + v_r.status)),
            onerror: () => v_reject(new Error('Error de red')),
            ontimeout: () => v_reject(new Error('Timeout'))
        }));
    }

    // Renders bytes to canvas and strictly exports as PNG
    const toPng = async v_b => {
        let v_c = document.createElement('canvas'), v_img = await createImageBitmap(new Blob([v_b]));
        return v_c.width = v_img.width, v_c.height = v_img.height, v_c.getContext('2d').drawImage(v_img, 0, 0), new Promise(v_r => v_c.toBlob(async v_p => v_r(new Uint8Array(await v_p.arrayBuffer())), 'image/png'));
    };

    function isValidChapterPage(v_url) {
        if (!v_url || !v_url.toLowerCase().includes('/library/')) return false;
        for (let v_word of ['cover', 'thumb', 'avatar', 'logo', 'banner', 'readerarea.svg', 'assets'])
            if (v_url.toLowerCase().includes(v_word)) return false;
        return v_url.toLowerCase().split('/library/')[1].split('/').length >= 3;
    }

    // Extracts images from the website
    function extractImagesFromText(v_text) {
        var v_urls = [], v_seen = {}, v_m, v_cleanUrl, v_re = /["'\`]?([^"'\`\s<>]*?\.(?:webp|jpg|jpeg|png|gif)(?:\?[^"'\`\s<>]*)?)["'\`]?/gi;
        while ((v_m = v_re.exec(v_text)) !== null)
            if (isValidChapterPage(v_cleanUrl = v_m[1].replace(/\\/g, ''))) {
                v_cleanUrl = v_cleanUrl.startsWith('http') ? v_cleanUrl : (v_cleanUrl.startsWith('//') ? 'https:' : v_cleanUrl.startsWith('/') ? 'https://mangatv.net' : 'https://mangatv.net/') + v_cleanUrl;
                if (!v_seen[v_cleanUrl]) v_seen[v_cleanUrl] = true, v_urls.push(v_cleanUrl);
            }
        return v_urls;
    }

    function collectPageUrls(v_doc) {
        var v_urls = [], v_seen = {}, v_cleanUrl;
        Array.from(v_doc.querySelectorAll('img')).forEach(v_img => {
            for (var v_c of [v_img.getAttribute('data-src'), v_img.getAttribute('data-lazy'), v_img.getAttribute('data-original'), v_img.src])
                if (v_c && isValidChapterPage(v_c)) {
                    v_cleanUrl = v_c.replace(/\\/g, '');
                    v_cleanUrl = v_cleanUrl.startsWith('http') ? v_cleanUrl : (v_cleanUrl.startsWith('//') ? 'https:' : v_cleanUrl.startsWith('/') ? 'https://mangatv.net' : 'https://mangatv.net/') + v_cleanUrl;
                    if (!v_seen[v_cleanUrl]) v_seen[v_cleanUrl] = true, v_urls.push(v_cleanUrl);
                    break;
                }
        });
        if (!v_urls.length) Array.from(v_doc.querySelectorAll('script:not([src])')).forEach(v_s => extractImagesFromText(v_s.textContent).forEach(v_u => !v_seen[v_u] && (v_seen[v_u] = true, v_urls.push(v_u))));
        return v_urls;
    }

    function waitForPages(v_timeoutMs = 30000) {
        return new Promise(v_resolve => {
            var v_start = Date.now(), v_poll = () => {
                var v_urls = collectPageUrls(document);
                if (v_urls.length > 0) return v_resolve(v_urls);
                if (Date.now() - v_start > v_timeoutMs) return v_resolve([]);
                setTimeout(v_poll, 800);
            };
            v_poll();
        });
    }

    // In case if DOM hides URLs
    function loadChapterBackground(v_url) {
        return new Promise(v_resolve => GM_xmlhttpRequest({
            method: 'GET', url: v_url, timeout: 12000,
            onload: v_r => v_resolve(v_r.status === 200 ? extractImagesFromText(v_r.responseText) : []),
            onerror: () => v_resolve([]), ontimeout: () => v_resolve([])
        }));
    }

    function loadChapterIframeFallback(v_url, v_timeoutMs = 25000) {
        return new Promise(v_resolve => {
            var v_iframe = document.createElement('iframe'), v_done = false, v_start = Date.now();
            v_iframe.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; opacity:0.001; pointer-events:none; z-index:-9999; border:none;';
            v_iframe.src = v_url;
            document.body.appendChild(v_iframe);

            var v_cleanup = v_urls => { if (!v_done) v_done = true, v_iframe.remove(), v_resolve(v_urls); };
            var v_poll = () => {
                if (v_done) return;
                try {
                    var v_doc = v_iframe.contentDocument || v_iframe.contentWindow.document;
                    if (!v_doc || v_doc.readyState === 'loading') return setTimeout(v_poll, 500);
                    v_iframe.contentWindow.scrollTo(0, 99999);
                    var v_urls = collectPageUrls(v_doc);
                    if (v_urls.length > 0) return v_cleanup(v_urls);
                    if (Date.now() - v_start > v_timeoutMs) return v_cleanup([]);
                    setTimeout(v_poll, 800);
                } catch(v_e) { v_cleanup([]); }
            };
            v_iframe.addEventListener('load', () => setTimeout(v_poll, 1000));
            setTimeout(() => v_cleanup([]), v_timeoutMs + 2000);
        });
    }

    // Concurrent download and binary compression
    async function downloadZip(v_urls, v_name, v_btn) {
        if (!v_urls.length) return showToast('❌ No se encontraron imágenes válidas', 0), hideToast();
        if (v_btn) v_btn.classList.add('loading'), v_btn.innerHTML = '⏳ Descargando…';

        var v_folderObj = {}, v_zipObj = { [v_name]: v_folderObj }, v_errores = 0, v_completadas = 0;
        showToast('Iniciando descarga y conversión...', 5);

        for (let v_i = 0; v_i < v_urls.length; v_i += 4)
            // Process in batches of 4 for faster downloading
            await Promise.all(v_urls.slice(v_i, v_i + 4).map(async (v_url, v_index) => {
                try {
                    // Conversion to .png and forcing the png format
                    v_folderObj['pag_' + String(v_i + v_index + 1).padStart(3, '0') + '.png'] = await toPng(await fetchImageBuffer(v_url));
                }
                catch(v_e) { v_errores++; }
                finally { v_completadas++, showToast('Procesando... ' + v_completadas + ' / ' + v_urls.length, Math.round((v_completadas / v_urls.length) * 88)); }
            }));

        showToast('Generando ZIP...', 95);
        await new Promise(v_r => setTimeout(v_r, 50));

        try {
            var v_zipBlob = new Blob([fflate.zipSync(v_zipObj, { level: 0 })], { type: 'application/zip' }), v_a = document.createElement('a');
            showToast('Guardando archivo...', 98);
            v_a.href = URL.createObjectURL(v_zipBlob), v_a.download = v_name + '.zip', document.body.appendChild(v_a), v_a.click(), v_a.remove();
            setTimeout(() => URL.revokeObjectURL(v_a.href), 10000);

            showToast('✅ ' + (v_urls.length - v_errores) + ' páginas' + (v_errores ? ' (' + v_errores + ' errores)' : ''), 100), hideToast();
            if (v_btn) v_btn.classList.remove('loading'), v_btn.classList.add('done'), v_btn.innerHTML = '✅ Descargado', setTimeout(() => (v_btn.classList.remove('done'), v_btn.innerHTML = dlIcon() + ' ZIP'), 4000);
        } catch (v_err) {
            showToast('❌ Error al empaquetar el ZIP', 0), hideToast();
            if (v_btn) v_btn.classList.remove('loading'), v_btn.innerHTML = '❌ Error';
        }
    }

    // Inject UI buttons into the website
    function initReader() {
        if (document.getElementById('mtv-dl-wrap')) return;
        var v_wrap = document.createElement('div'), v_btn = document.createElement('button'), v_tryInsert = () => {
            var v_target = document.querySelector('#readerarea, .readerarea, [id*="reader"], main, .container');
            return v_target ? (v_target.insertAdjacentElement('beforebegin', v_wrap), true) : false;
        };
        v_wrap.id = 'mtv-dl-wrap', v_btn.id = 'mtv-dl-btn', v_btn.innerHTML = dlIcon(17) + ' Descargar capítulo (ZIP)', v_wrap.appendChild(v_btn);

        v_btn.addEventListener('click', async () => {
            v_btn.classList.add('loading'), v_btn.innerHTML = '⏳ Buscando imágenes…', showToast('Buscando páginas…', 5);
            var v_urls = await waitForPages();
            if (!v_urls.length) return showToast('❌ No se encontraron páginas válidas.', 0), hideToast(), v_btn.classList.remove('loading'), v_btn.innerHTML = dlIcon(17) + ' Descargar capítulo (ZIP)';
            await downloadZip(v_urls, safeName(document.title), v_btn);
        });

        if (!v_tryInsert()) new MutationObserver((v__, v_obs) => v_tryInsert() && v_obs.disconnect()).observe(document.body, { childList: true, subtree: true });
    }

    function initMangaList() {
        var v_addButtons = () => document.querySelectorAll('li:not([data-mtv-done])').forEach(v_li => {
            var v_link = v_li.querySelector('a[href*="/leer/"]'), v_btn;
            if (!v_link) return;
            v_li.setAttribute('data-mtv-done', '1');
            v_btn = document.createElement('button'), v_btn.className = 'mtv-row-btn', v_btn.innerHTML = dlIcon(12) + ' ZIP', v_btn.title = 'Descargar este capítulo como ZIP';

            v_btn.addEventListener('click', async v_e => {
                v_e.preventDefault(), v_e.stopPropagation(), v_btn.classList.add('loading'), v_btn.innerHTML = '⏳', showToast('Obteniendo información…', 5);
                var v_imgUrls = await loadChapterBackground(v_link.href);
                if (!v_imgUrls.length) showToast('Recuperando imagenes', 5), v_imgUrls = await loadChapterIframeFallback(v_link.href);
                if (!v_imgUrls.length) return showToast('⚠️ No se pudieron obtener imágenes. Abre el capítulo.', 0), hideToast(), v_btn.classList.remove('loading'), v_btn.innerHTML = dlIcon(12) + ' ZIP';
                await downloadZip(v_imgUrls, safeName(v_li.textContent.trim().split('\n')[0]), v_btn);
            });
            v_link.insertAdjacentElement('afterend', v_btn);
        });

        v_addButtons();
        var v_obs = new MutationObserver(v_addButtons);
        v_obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => v_obs.disconnect(), 15000);
    }

    function route() {
        var v_path = location.pathname;
        if (v_path.startsWith('/leer/')) initReader();
        else if (v_path.startsWith('/manga/') && v_path.split('/').length >= 4) initMangaList();
    }

    ['pushState', 'replaceState'].forEach(v_fn => { var v_orig = history[v_fn]; history[v_fn] = function() { v_orig.apply(this, arguments), setTimeout(route, 500); }; });
    window.addEventListener('popstate', () => setTimeout(route, 500));
    route();

})();