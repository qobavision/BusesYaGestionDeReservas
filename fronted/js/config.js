// URL del backend FastAPI (cambiar si usas otro puerto)
const API_URL = "https://busesyagestiondereservas.onrender.com";

/** Base + ruta tipo /api/... — evita doble /api si API_URL terminaba mal en /api */
function urlBackend(rutaAbsoluta) {
    var r = typeof rutaAbsoluta === 'string' ? rutaAbsoluta : '';
    if (!r.startsWith('/')) {
        r = '/' + r;
    }
    var base =
        typeof API_URL !== 'undefined' && API_URL !== null
            ? String(API_URL).trim()
            : '';
    base = base.replace(/\/+$/, '');
    while (/\/api$/i.test(base)) {
        base = base.replace(/\/api$/i, '').replace(/\/+$/, '');
    }
    return base ? base + r : r;
}

/**
 * fetch con tiempo máximo (evita "Cargando…" / "Ingresando…" infinitos si el API no responde).
 */
function fetchConTimeout(url, options, timeoutMs) {
    var ms = timeoutMs || 20000;
    var opts = options || {};
    if (typeof AbortController !== 'undefined') {
        var ctrl = new AbortController();
        opts = Object.assign({}, opts, { signal: ctrl.signal });
        var timer = setTimeout(function () {
            ctrl.abort();
        }, ms);
        return fetch(url, opts).finally(function () {
            clearTimeout(timer);
        });
    }
    return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () {
            if (!done) {
                done = true;
                reject(new Error('TIMEOUT'));
            }
        }, ms);
        fetch(url, opts)
            .then(function (r) {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    resolve(r);
                }
            })
            .catch(function (e) {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    reject(e);
                }
            });
    });
}

function mensajeErrorRedFetch(err) {
    if (!err) {
        return 'No se pudo conectar con el servidor.';
    }
    if (err.name === 'AbortError' || err.message === 'TIMEOUT') {
        return (
            'El servidor no respondió a tiempo. Comprueba que uvicorn esté en marcha en ' +
            (typeof API_URL !== 'undefined' ? API_URL : '127.0.0.1:8000') +
            ' (desde la carpeta backend: uvicorn main:app --reload).'
        );
    }
    var msg = err.message || '';
    if (
        msg === 'Failed to fetch' ||
        (err.name === 'TypeError' && /fetch|network|Failed/i.test(msg))
    ) {
        var api =
            typeof API_URL !== 'undefined' && API_URL
                ? String(API_URL).trim()
                : 'http://127.0.0.1:8000';
        return (
            'No se pudo conectar (Failed to fetch). Revisa: 1) que el backend esté en marcha ' +
            '(carpeta backend: uvicorn main:app --reload); 2) que en fronted/js/config.js API_URL sea la misma ' +
            'base donde corre FastAPI (host y puerto); 3) CORS: abre el HTML con Live Server (http://127.0.0.1:…), ' +
            'no como archivo file://; si entras desde otra PC o por IP de red local, añade ese origen en backend/.env ' +
            '(FRONTEND_URL o FRONTEND_URLS_EXTRA). API configurada: ' +
            api +
            '.'
        );
    }
    return 'No se pudo conectar con el servidor.';
}
