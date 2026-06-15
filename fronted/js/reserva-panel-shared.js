/**
 * Utilidades compartidas entre panel administrador y panel asesor (modal editar reserva).
 * Debe cargarse después de auth.js y antes de panel-admin.js / panel-asesor.js.
 */
(function (global) {
    'use strict';

    global.tituloEditarReservaCliente = function (nombre, dni, telefono) {
        var nom = (nombre || '')
            .trim()
            .replace(/\s+\.\s*$/, '')
            .replace(/\.+$/, '')
            .trim();
        var dniTxt = (dni || '').trim();
        if (dniTxt === '—') {
            dniTxt = '';
        }
        var telTxt = (telefono || '').trim();
        if (telTxt === '—' || telTxt === '-') {
            telTxt = '';
        }
        var nomUp = nom ? nom.toUpperCase() : '';
        var partes = [];
        if (nomUp) {
            partes.push(nomUp);
        }
        if (dniTxt) {
            partes.push('DNI: ' + dniTxt);
        }
        if (telTxt) {
            partes.push('TEL:' + telTxt);
        }
        if (partes.length) {
            return partes.join(' / ');
        }
        return '—';
    };

    global.fechaMinimaDatetimeLocal = function () {
        var ahora = new Date();
        ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
        return ahora.toISOString().slice(0, 16);
    };

    global.isoParaDatetimeLocal = function (desdeServidorIso) {
        if (!desdeServidorIso) {
            return '';
        }
        var d = new Date(desdeServidorIso);
        if (isNaN(d.getTime())) {
            return '';
        }
        var off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
    };

    global.datetimeLocalAISO = function (loc) {
        if (!loc || !String(loc).trim()) {
            return null;
        }
        var d = new Date(loc);
        if (isNaN(d.getTime())) {
            return null;
        }
        return d.toISOString();
    };
})(typeof window !== 'undefined' ? window : this);
