// ============================================
// PANEL-ASESOR.JS - Panel Asesor de Ventas
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    var usuarioSesion = verificarSesion(['asesor', 'asesor de ventas', 'asesor_ventas', 2]);
    if (!usuarioSesion) {
        return;
    }

    var RESERVAS_POR_PAGINA = 5;
    var cacheReservas = [];
    var reservasPaginaActual = 1;
    var catalogoVehiculosApi = [];
    var conductoresApi = [];

    function headersAuthJSON() {
        return {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (localStorage.getItem('token') || '')
        };
    }

    function headersAuthBearer() {
        return {
            Authorization: 'Bearer ' + (localStorage.getItem('token') || '')
        };
    }

    function fetchApi(url, options, timeoutMs) {
        return fetchConTimeout(url, options || {}, timeoutMs || 20000);
    }

    function interpretarRespuestaApi(response) {
        return response.text().then(function (txt) {
            var data = null;
            try {
                data = txt ? JSON.parse(txt) : null;
            } catch (e) {
                data = { detail: txt || response.statusText };
            }
            return { ok: response.ok, status: response.status, data: data };
        });
    }

    function mensajeErrorApi(data) {
        if (!data) {
            return 'Error desconocido';
        }
        if (typeof data.detail === 'string') {
            return data.detail;
        }
        if (Array.isArray(data.detail)) {
            return data.detail
                .map(function (d) {
                    return d.msg || String(d);
                })
                .join(', ');
        }
        return 'No se pudo completar la operación';
    }

    function escapeHtml(s) {
        if (s == null) {
            return '';
        }
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escaparParaAtributoHtml(valor) {
        if (valor === undefined || valor === null) {
            return '';
        }
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    /** Fechas reserva: ver reserva-panel-shared.js (isoParaDatetimeLocal, datetimeLocalAISO). */

    function formatearSolesPEN(valor) {
        var n = typeof valor === 'number' ? valor : parseFloat(valor);
        if (isNaN(n)) {
            return 'S/ 0.00';
        }
        return (
            'S/ ' +
            n.toLocaleString('es-PE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        );
    }

    function formatearIsoEnTexto(es) {
        if (!es) {
            return '—';
        }
        var d = new Date(es);
        if (isNaN(d.getTime())) {
            return '—';
        }
        return d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
    }

    function formatearSoles(valor) {
        var n = Number(valor);
        if (isNaN(n)) {
            return '—';
        }
        return 'S/ ' + n.toFixed(2);
    }

    function formatearNombrePersona(texto) {
        var t = String(texto || '').trim().toLowerCase();
        if (!t) {
            return '';
        }
        return t.replace(/\b\w/g, function (c) {
            return c.toUpperCase();
        });
    }

    function normalizarClaveEstadoViaje(estado) {
        return (estado || '').toLowerCase().replace(/\s+/g, '_');
    }

    function etiquetaEstadoViajeHumano(estadoSlug) {
        var raw = (estadoSlug || '').trim();
        if (!raw) {
            return 'Pendiente';
        }
        var e = raw.toLowerCase().replace(/_/g, ' ');
        var mapa = {
            pendiente: 'Pendiente',
            'en camino': 'En camino',
            en_camino: 'En camino',
            finalizado: 'Finalizado',
            completado: 'Finalizado',
            cancelado: 'Cancelado'
        };
        if (mapa[e]) {
            return mapa[e];
        }
        return raw;
    }

    function claseEstadoPillViaje(estado) {
        var e = normalizarClaveEstadoViaje(estado);
        if (e === 'cancelado' || e === 'cancelada') {
            return 'estado-pill estado-pill--inactivo';
        }
        if (e === 'finalizado' || e === 'completado') {
            return 'estado-pill estado-pill--activo';
        }
        if (e === 'en_camino') {
            return 'estado-pill estado-pill--reservado';
        }
        return 'estado-pill estado-pill--pendiente';
    }

    /** Misma lógica que panel-admin: nombre en mayúsculas y rol legible. */
    function rotuloRolSesionAsesor(rol) {
        var r = String(rol || '').toLowerCase();
        if (r.indexOf('admin') >= 0) {
            return 'Administrador';
        }
        if (r.indexOf('asesor') >= 0) {
            return 'Asesor de Ventas';
        }
        if (r.indexOf('conductor') >= 0) {
            return 'Conductor';
        }
        return 'Usuario';
    }

    function nombreUsuarioMayusculas(nombre) {
        return String(nombre || 'Asesor')
            .trim()
            .toUpperCase();
    }

    function inicialesDesdeNombreUsuario(nombre) {
        var t = nombreUsuarioMayusculas(nombre);
        if (!t || t === 'ASESOR') {
            return 'AS';
        }
        var sinEsp = t.replace(/\s+/g, '');
        if (sinEsp.length >= 2) {
            return sinEsp.slice(0, 2);
        }
        return sinEsp.slice(0, 1) || 'AS';
    }

    function aplicarPerfilAsesor(usuario) {
        var nombreMostrar = nombreUsuarioMayusculas(usuario.nombre_usuario);
        var rolMostrar = rotuloRolSesionAsesor(usuario.rol);
        var iniciales = inicialesDesdeNombreUsuario(usuario.nombre_usuario);

        var elNomSide = document.getElementById('asesorNombreSidebar');
        if (elNomSide) {
            elNomSide.textContent = nombreMostrar;
        }
        var sidebarRole = document.getElementById('sidebarUserRole');
        if (sidebarRole) {
            sidebarRole.textContent = rolMostrar;
        }
        var sidebarAvatar = document.getElementById('sidebarUserAvatar');
        if (sidebarAvatar) {
            sidebarAvatar.textContent = iniciales;
        }
        var headerName = document.getElementById('headerUserName');
        if (headerName) {
            headerName.textContent = nombreMostrar;
        }
        var headerRole = document.getElementById('headerUserRole');
        if (headerRole) {
            headerRole.textContent = rolMostrar;
        }
        var headerAvatar = document.getElementById('headerUserAvatar');
        if (headerAvatar) {
            headerAvatar.textContent = iniciales;
        }
    }

    aplicarPerfilAsesor(usuarioSesion);

    function claseEstadoPillReserva(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'confirmada') {
            return 'estado-pill estado-pill--activo';
        }
        if (e === 'cancelada') {
            return 'estado-pill estado-pill--inactivo';
        }
        return 'estado-pill estado-pill--pendiente';
    }

    function etiquetaEstadoReserva(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'confirmada') {
            return 'Confirmada';
        }
        if (e === 'cancelada') {
            return 'Cancelada';
        }
        return 'Pendiente';
    }

    function claseEstadoPago(estado) {
        if ((estado || '').toLowerCase() === 'verificado') {
            return 'estado-pill estado-pill--activo';
        }
        return 'estado-pill estado-pill--pendiente';
    }

    function etiquetaEstadoPago(estado) {
        return (estado || '').toLowerCase() === 'verificado' ? 'Verificado' : 'Pendiente';
    }

    function urlComprobante(ruta) {
        if (!ruta) {
            return '';
        }
        var limpia = String(ruta).replace(/^\/+/, '');
        return urlBackend('/uploads/' + limpia);
    }

    // ——— Navegación ———
    var pageTitle = document.getElementById('pageTitle');
    var navItems = document.querySelectorAll('.panel__nav-item');
    var sections = document.querySelectorAll('.section');

    var cacheListaViajes = [];
    var viajesListaPaginaActual = 1;
    var VIAJES_LISTADO_POR_PAGINA = 5;
    var viajesModoSoloSinFlota = false;
    var pagosPaginaActual = 1;

    var titulos = {
        'mis-reservas': 'Mis reservas',
        viajes: 'Viajes',
        'control-pagos': 'Pagos'
    };

    function abrirModal(id) {
        var m = document.getElementById(id);
        if (m) {
            m.classList.add('modal-panel--active');
        }
    }

    function cerrarModal(id) {
        var m = document.getElementById(id);
        if (m) {
            m.classList.remove('modal-panel--active');
        }
    }

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    document.querySelectorAll('.modal-panel__close, [data-modal]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var modalId = btn.dataset.modal || btn.closest('.modal-panel').id;
            cerrarModal(modalId);
        });
    });

    document.querySelectorAll('.modal-panel').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                cerrarModal(modal.id);
            }
        });
    });

    // ——— Cargar reservas API (compartido: Mis reservas, Pagos, etc.) ———
    function cargarReservasDesdeApi() {
        return fetchApi(urlBackend('/api/reservas/admin'), {
            headers: headersAuthJSON()
        })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        cerrarSesion();
                        return [];
                    }
                    throw new Error(mensajeErrorApi(result.data));
                }
                cacheReservas = Array.isArray(result.data) ? result.data : [];
                return cacheReservas;
            });
    }

    function actualizarStatsReservasListado() {
        var lista = cacheReservas;
        var setNum = function (id, n) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = String(n);
            }
        };
        setNum('statResTotal', lista.length);
        setNum(
            'statResPendientes',
            lista.filter(function (r) {
                return (r.estado || '').toLowerCase() === 'pendiente';
            }).length
        );
        setNum(
            'statResConfirmadas',
            lista.filter(function (r) {
                return (r.estado || '').toLowerCase() === 'confirmada';
            }).length
        );
        setNum(
            'statResCanceladas',
            lista.filter(function (r) {
                return (r.estado || '').toLowerCase() === 'cancelada';
            }).length
        );
        actualizarStatsPagos();
    }

    function actualizarStatsPagos() {
        var lista = cacheReservas || [];
        var setNum = function (id, n) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = String(n);
            }
        };
        var canal = function (r) {
            return (r.registro_origen || '').toLowerCase();
        };
        var conComp = function (r) {
            return !!(r.comprobante_pago && String(r.comprobante_pago).trim());
        };
        var pagoOk = function (r) {
            return (r.estado_pago || 'pendiente').toLowerCase() === 'verificado';
        };
        setNum(
            'statPagosPanel',
            lista.filter(function (r) {
                return canal(r) === 'panel';
            }).length
        );
        setNum(
            'statPagosWeb',
            lista.filter(function (r) {
                return canal(r) === 'web';
            }).length
        );
        setNum(
            'statPagosComprobante',
            lista.filter(function (r) {
                return conComp(r);
            }).length
        );
        setNum(
            'statPagosOk',
            lista.filter(function (r) {
                return pagoOk(r);
            }).length
        );
        setNum(
            'statPagosPend',
            lista.filter(function (r) {
                return !pagoOk(r);
            }).length
        );
        setNum('statPagosDetalle', lista.length);
    }

    function actualizarPaginacionReservasListado(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('misReservasPaginacionInfo');
        var label = document.getElementById('misReservasPaginaLabel');
        var btnPrev = document.getElementById('misReservasPaginaPrev');
        var btnNext = document.getElementById('misReservasPaginaNext');
        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 reservas';
            }
            if (label) {
                label.textContent = '1';
            }
            if (btnPrev) {
                btnPrev.disabled = true;
            }
            if (btnNext) {
                btnNext.disabled = true;
            }
            return;
        }
        if (info) {
            info.textContent =
                'Mostrando ' +
                (inicioIdx + 1) +
                ' a ' +
                (inicioIdx + cantEnPagina) +
                ' de ' +
                totalFiltrados +
                ' reservas';
        }
        if (label) {
            label.textContent = String(reservasPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = reservasPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = reservasPaginaActual >= totalPaginas;
        }
    }

    function actualizarPaginacionPagos(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('pagosPaginacionInfo');
        var label = document.getElementById('pagosPaginaLabel');
        var btnPrev = document.getElementById('pagosPaginaPrev');
        var btnNext = document.getElementById('pagosPaginaNext');
        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 registros';
            }
            if (label) {
                label.textContent = '1';
            }
            if (btnPrev) {
                btnPrev.disabled = true;
            }
            if (btnNext) {
                btnNext.disabled = true;
            }
            return;
        }
        if (info) {
            info.textContent =
                'Mostrando ' +
                (inicioIdx + 1) +
                ' a ' +
                (inicioIdx + cantEnPagina) +
                ' de ' +
                totalFiltrados +
                ' registros';
        }
        if (label) {
            label.textContent = String(pagosPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = pagosPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = pagosPaginaActual >= totalPaginas;
        }
    }

    function limpiarErrorReservaFormulario() {
        var x = document.getElementById('reservaFormError');
        if (x) {
            x.textContent = '';
            x.classList.remove('form-group__error--visible');
        }
    }

    function pintarErrorReserva(msg) {
        var x = document.getElementById('reservaFormError');
        if (x) {
            x.textContent = msg || '';
            if (msg) {
                x.classList.add('form-group__error--visible');
            } else {
                x.classList.remove('form-group__error--visible');
            }
        }
    }

    function aplicarDatosModalReservaEdicion(r) {
        limpiarErrorReservaFormulario();
        var hidId = document.getElementById('reservaEditId');
        if (hidId) {
            hidId.value = String(r.id_reserva);
        }
        var titCli = document.getElementById('reservaModalTituloCliente');
        if (titCli) {
            titCli.textContent = tituloEditarReservaCliente(
                r.cliente_nombre,
                r.cliente_dni,
                r.cliente_telefono
            );
        }

        var elPas = document.getElementById('reservaEditPasajeros');
        if (elPas) {
            elPas.value = r.cantidad_pasajeros != null ? String(r.cantidad_pasajeros) : '1';
        }
        var elOri = document.getElementById('reservaEditOrigen');
        if (elOri) {
            elOri.value = r.origen || '';
        }
        var elDst = document.getElementById('reservaEditDestino');
        if (elDst) {
            elDst.value = r.destino || '';
        }
        var elFp = document.getElementById('reservaEditFechaPartida');
        if (elFp) {
            elFp.value = isoParaDatetimeLocal(r.fecha_partida);
        }
        var retIso = r.fecha_retorno;
        var elHad = document.getElementById('reservaHadRetornoInicial');
        if (elHad) {
            elHad.value = retIso ? '1' : '';
        }
        var elFr = document.getElementById('reservaEditFechaRetorno');
        if (elFr) {
            elFr.value = retIso ? isoParaDatetimeLocal(retIso) : '';
        }
        var st = (r.estado || 'pendiente').toLowerCase();
        if (!['pendiente', 'confirmada', 'cancelada'].includes(st)) {
            st = 'pendiente';
        }
        var elEst = document.getElementById('reservaEditEstado');
        if (elEst) {
            elEst.value = st;
        }
        var precInp = document.getElementById('reservaEditPrecioTotal');
        var precIni = document.getElementById('reservaEditPrecioInicial');
        var pnGuardado = null;
        if (r.precio_total != null && String(r.precio_total).trim() !== '') {
            pnGuardado = parseFloat(r.precio_total);
            if (isNaN(pnGuardado)) {
                pnGuardado = null;
            }
        }
        if (precIni) {
            precIni.value = pnGuardado != null && pnGuardado > 0 ? String(pnGuardado) : '';
        }
        if (precInp) {
            precInp.value = pnGuardado != null && pnGuardado > 0 ? String(pnGuardado) : '';
        }
        var elEstIni = document.getElementById('reservaEditEstadoInicial');
        if (elEstIni) {
            elEstIni.value = st;
        }
        var elCompFlag = document.getElementById('reservaEditTeniaComprobante');
        if (elCompFlag) {
            elCompFlag.value =
                r.comprobante_pago && String(r.comprobante_pago).trim() ? '1' : '';
        }
        var elComp = document.getElementById('reservaEditComprobante');
        if (elComp) {
            elComp.value = '';
        }
        actualizarMinimosEditarReserva();
    }

    function actualizarMinimosEditarReserva() {
        var fp = document.getElementById('reservaEditFechaPartida');
        var fr = document.getElementById('reservaEditFechaRetorno');
        if (!fp) {
            return;
        }
        var minimo = fechaMinimaDatetimeLocal();
        fp.min = minimo;
        if (fr) {
            var minRet = fp.value && fp.value >= minimo ? fp.value : minimo;
            fr.min = minRet;
        }
    }

    function validarFechasEditarReserva(errNr) {
        var fp = document.getElementById('reservaEditFechaPartida');
        var fr = document.getElementById('reservaEditFechaRetorno');
        if (!fp || !fp.value) {
            return false;
        }
        var minimo = fechaMinimaDatetimeLocal();
        if (fp.value < minimo) {
            if (errNr) {
                errNr.textContent =
                    'La fecha de partida no puede ser anterior a la fecha y hora actuales.';
                errNr.classList.add('form-group__error--visible');
            }
            fp.focus();
            return false;
        }
        if (fr && fr.value) {
            if (fr.value < fp.value) {
                if (errNr) {
                    errNr.textContent =
                        'La fecha de retorno debe ser igual o posterior a la de partida.';
                    errNr.classList.add('form-group__error--visible');
                }
                fr.focus();
                return false;
            }
        }
        return true;
    }

    function montoReservaDesdeFormularioEdicion() {
        var precTotEl = document.getElementById('reservaEditPrecioTotal');
        var precIni = document.getElementById('reservaEditPrecioInicial');
        if (precTotEl) {
            var ptx = precTotEl.value.trim();
            if (ptx !== '') {
                var pnum = parseFloat(ptx.replace(',', '.'));
                if (!isNaN(pnum) && pnum >= 0) {
                    return pnum;
                }
            }
        }
        if (precIni && precIni.value.trim() !== '') {
            var prev = parseFloat(precIni.value.replace(',', '.'));
            if (!isNaN(prev) && prev >= 0) {
                return prev;
            }
        }
        return null;
    }

    function abrirConfirmEliminarReserva(idRes, codigo) {
        var hid = document.getElementById('eliminarReservaId');
        if (hid) {
            hid.value = String(idRes);
        }
        var p = document.getElementById('eliminarReservaMensaje');
        var cod = (codigo || '').trim();
        if (p) {
            p.textContent =
                cod.length > 0
                    ? '¿Eliminar la reserva «' + cod + '» de forma permanente?'
                    : '¿Eliminar esta reserva de forma permanente?';
        }
        abrirModal('modalConfirmEliminarReserva');
    }

    function refrescarTrasCambioReservaAsesor() {
        cargarReservasDesdeApi()
            .then(function () {
                reservasPaginaActual = 1;
                renderMisReservas();
                var secCp = document.getElementById('control-pagos');
                if (secCp && secCp.classList.contains('section--active')) {
                    pintarTablaControlPagos();
                }
            })
            .catch(function () {});
    }

    var fpEditRes = document.getElementById('reservaEditFechaPartida');
    var frEditRes = document.getElementById('reservaEditFechaRetorno');
    if (fpEditRes) {
        fpEditRes.addEventListener('change', actualizarMinimosEditarReserva);
        fpEditRes.addEventListener('input', actualizarMinimosEditarReserva);
    }
    if (frEditRes) {
        frEditRes.addEventListener('change', actualizarMinimosEditarReserva);
        frEditRes.addEventListener('input', actualizarMinimosEditarReserva);
    }

    var tablaMisReservasEl = document.getElementById('tablaMisReservas');
    if (tablaMisReservasEl) {
        tablaMisReservasEl.addEventListener('click', function (e) {
            var btEd = e.target.closest('.btn-reserva-editar');
            var btElim = e.target.closest('.btn-reserva-eliminar');
            if (btEd && btEd.dataset.id) {
                limpiarErrorReservaFormulario();
                fetchApi(
                    urlBackend('/api/reservas/admin/' + encodeURIComponent(btEd.dataset.id)),
                    { headers: headersAuthJSON() }
                )
                    .then(interpretarRespuestaApi)
                    .then(function (result) {
                        if (!result.ok) {
                            if (result.status === 401) {
                                alert('Sesión expirada. Vuelve a iniciar sesión.');
                                cerrarSesion();
                                return;
                            }
                            alert(mensajeErrorApi(result.data));
                            return;
                        }
                        aplicarDatosModalReservaEdicion(result.data);
                        abrirModal('modalReservaEditar');
                    })
                    .catch(function () {
                        alert('No se pudo cargar la reserva.');
                    });
                return;
            }
            if (btElim && btElim.dataset.id) {
                abrirConfirmEliminarReserva(btElim.dataset.id, btElim.dataset.codigo || '');
            }
        });
    }

    var btnGuardarReservaEditar = document.getElementById('btnGuardarReservaEditar');
    if (btnGuardarReservaEditar) {
        btnGuardarReservaEditar.addEventListener('click', function () {
            var hid = document.getElementById('reservaEditId');
            var idRes = hid && hid.value ? hid.value.trim() : '';
            if (!idRes) {
                return;
            }
            var form = document.getElementById('formReservaEditar');
            limpiarErrorReservaFormulario();
            if (!form) {
                return;
            }
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            var elPas = document.getElementById('reservaEditPasajeros');
            var pas = parseInt(elPas ? elPas.value : '0', 10);
            if (isNaN(pas) || pas < 1 || pas > 50) {
                pintarErrorReserva('Cantidad de pasajeros entre 1 y 50.');
                return;
            }
            var ori = document.getElementById('reservaEditOrigen').value.trim();
            var dst = document.getElementById('reservaEditDestino').value.trim();
            if (!ori || !dst) {
                pintarErrorReserva('Indica origen y destino.');
                return;
            }
            var errResForm = document.getElementById('reservaFormError');
            if (!validarFechasEditarReserva(errResForm)) {
                return;
            }
            var partLoc = document.getElementById('reservaEditFechaPartida').value;
            var partIso = datetimeLocalAISO(partLoc);
            if (!partIso) {
                pintarErrorReserva('Fecha de partida no válida.');
                return;
            }
            var estadoSel = document.getElementById('reservaEditEstado').value;
            var montoRes = montoReservaDesdeFormularioEdicion();
            if (estadoSel === 'confirmada') {
                if (montoRes == null || montoRes <= 0) {
                    pintarErrorReserva(
                        'Para confirmar como pagada indica el monto de la reserva (mayor a 0).'
                    );
                    var focoPrec = document.getElementById('reservaEditPrecioTotal');
                    if (focoPrec) {
                        focoPrec.focus();
                    }
                    return;
                }
            }
            var estadoIni = '';
            var elEstIni = document.getElementById('reservaEditEstadoInicial');
            if (elEstIni && elEstIni.value) {
                estadoIni = elEstIni.value.trim().toLowerCase();
            }
            if (!['pendiente', 'confirmada', 'cancelada'].includes(estadoIni)) {
                estadoIni = 'pendiente';
            }
            var elTeniaComp = document.getElementById('reservaEditTeniaComprobante');
            var teniaComp = elTeniaComp && elTeniaComp.value === '1';
            var archEl = document.getElementById('reservaEditComprobante');
            var arch = archEl && archEl.files && archEl.files[0] ? archEl.files[0] : null;
            var pideSubirComp =
                estadoIni === 'pendiente' && estadoSel === 'confirmada' && !teniaComp;
            if (pideSubirComp && !arch) {
                pintarErrorReserva(
                    'Para confirmar como pagada adjunta el comprobante de pago.'
                );
                if (archEl) {
                    archEl.focus();
                }
                return;
            }
            var cuerpo = {
                cantidad_pasajeros: pas,
                origen: ori.slice(0, 50),
                destino: dst.slice(0, 50),
                fecha_partida: partIso,
                estado: estadoSel
            };
            if (montoRes != null) {
                if (montoRes < 0) {
                    pintarErrorReserva('Monto no válido (número ≥ 0).');
                    return;
                }
                cuerpo.precio_total = montoRes;
            }
            var teniaIni =
                document.getElementById('reservaHadRetornoInicial').value === '1';
            var retLoc = document.getElementById('reservaEditFechaRetorno').value.trim();
            if (retLoc === '') {
                if (teniaIni) {
                    cuerpo.fecha_retorno = null;
                }
            } else {
                var retIso = datetimeLocalAISO(retLoc);
                if (!retIso) {
                    pintarErrorReserva('Fecha de retorno no válida.');
                    return;
                }
                cuerpo.fecha_retorno = retIso;
            }
            var btnGr = document.getElementById('btnGuardarReservaEditar');
            var txtOg = btnGr.textContent;
            btnGr.disabled = true;
            btnGr.textContent = 'Guardando…';

            function ejecutarPatchReservaEdicion() {
                return fetchApi(urlBackend('/api/reservas/admin/' + encodeURIComponent(idRes)), {
                    method: 'PATCH',
                    headers: headersAuthJSON(),
                    body: JSON.stringify(cuerpo)
                }).then(interpretarRespuestaApi);
            }

            var cadena = Promise.resolve(null);
            if (pideSubirComp && arch) {
                var fdC = new FormData();
                fdC.append('comprobante', arch);
                cadena = fetchApi(
                    urlBackend(
                        '/api/reservas/admin/' +
                            encodeURIComponent(idRes) +
                            '/comprobante'
                    ),
                    { method: 'POST', headers: headersAuthBearer(), body: fdC }
                ).then(interpretarRespuestaApi);
            }

            cadena
                .then(function (rUp) {
                    if (pideSubirComp && arch) {
                        if (!rUp || !rUp.ok) {
                            if (rUp && rUp.status === 401) {
                                alert('Sesión expirada. Vuelve a iniciar sesión.');
                                cerrarSesion();
                                return null;
                            }
                            pintarErrorReserva(
                                rUp ? mensajeErrorApi(rUp.data) : 'No se pudo subir el comprobante.'
                            );
                            return null;
                        }
                    }
                    return ejecutarPatchReservaEdicion();
                })
                .then(function (result) {
                    if (result === null || result === undefined) {
                        return;
                    }
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        pintarErrorReserva(mensajeErrorApi(result.data));
                        return;
                    }
                    cerrarModal('modalReservaEditar');
                    refrescarTrasCambioReservaAsesor();
                })
                .catch(function () {
                    pintarErrorReserva('No se pudo conectar con el servidor.');
                })
                .finally(function () {
                    btnGr.disabled = false;
                    btnGr.textContent = txtOg;
                });
        });
    }

    var btnConfirmEliminarReserva = document.getElementById('btnConfirmEliminarReserva');
    if (btnConfirmEliminarReserva) {
        btnConfirmEliminarReserva.addEventListener('click', function () {
            var hid = document.getElementById('eliminarReservaId');
            var idDel = hid && hid.value ? hid.value.trim() : '';
            var btnConf = this;
            if (!idDel) {
                cerrarModal('modalConfirmEliminarReserva');
                return;
            }
            btnConf.disabled = true;
            fetchApi(urlBackend('/api/reservas/admin/' + encodeURIComponent(idDel)), {
                method: 'DELETE',
                headers: headersAuthJSON()
            })
                .then(function (response) {
                    if (response.status === 401) {
                        cerrarModal('modalConfirmEliminarReserva');
                        alert('Sesión expirada. Vuelve a iniciar sesión.');
                        cerrarSesion();
                        return Promise.resolve();
                    }
                    if (response.status === 204) {
                        cerrarModal('modalConfirmEliminarReserva');
                        if (hid) {
                            hid.value = '';
                        }
                        refrescarTrasCambioReservaAsesor();
                        return Promise.resolve();
                    }
                    return interpretarRespuestaApi(response).then(function (r) {
                        cerrarModal('modalConfirmEliminarReserva');
                        alert(mensajeErrorApi(r.data));
                    });
                })
                .catch(function () {
                    cerrarModal('modalConfirmEliminarReserva');
                    alert('No se pudo conectar con el servidor.');
                })
                .finally(function () {
                    btnConf.disabled = false;
                });
        });
    }

    function limpiarErrorNuevaReserva() {
        var x = document.getElementById('nuevaReservaFormError');
        if (x) {
            x.textContent = '';
            x.classList.remove('form-group__error--visible');
        }
    }

    function actualizarMinimosNuevaReservaAdmin() {
        var fp = document.getElementById('nuevaResFechaPartida');
        var fr = document.getElementById('nuevaResFechaRetorno');
        if (!fp) {
            return;
        }
        var minimo = fechaMinimaDatetimeLocal();
        fp.min = minimo;
        if (fr) {
            var minRet = fp.value && fp.value >= minimo ? fp.value : minimo;
            fr.min = minRet;
        }
    }

    var fpNuevaRes = document.getElementById('nuevaResFechaPartida');
    var frNuevaRes = document.getElementById('nuevaResFechaRetorno');
    if (fpNuevaRes) {
        fpNuevaRes.addEventListener('change', actualizarMinimosNuevaReservaAdmin);
        fpNuevaRes.addEventListener('input', actualizarMinimosNuevaReservaAdmin);
    }
    if (frNuevaRes) {
        frNuevaRes.addEventListener('change', actualizarMinimosNuevaReservaAdmin);
        frNuevaRes.addEventListener('input', actualizarMinimosNuevaReservaAdmin);
    }

    function validarFechasNuevaReservaAdmin(errNr) {
        var fp = document.getElementById('nuevaResFechaPartida');
        var fr = document.getElementById('nuevaResFechaRetorno');
        if (!fp || !fp.value) {
            return false;
        }
        var minimo = fechaMinimaDatetimeLocal();
        if (fp.value < minimo) {
            if (errNr) {
                errNr.textContent =
                    'La fecha de partida no puede ser anterior a la fecha y hora actuales.';
                errNr.classList.add('form-group__error--visible');
            }
            fp.focus();
            return false;
        }
        if (fr && fr.value) {
            if (fr.value < fp.value) {
                if (errNr) {
                    errNr.textContent =
                        'La fecha de retorno debe ser igual o posterior a la de partida.';
                    errNr.classList.add('form-group__error--visible');
                }
                fr.focus();
                return false;
            }
            if (fr.value < minimo) {
                if (errNr) {
                    errNr.textContent =
                        'La fecha de retorno no puede ser anterior a la fecha y hora actuales.';
                    errNr.classList.add('form-group__error--visible');
                }
                fr.focus();
                return false;
            }
        }
        return true;
    }

    var btnNuevaReservaAsesor = document.getElementById('btnNuevaReservaAsesor');
    if (btnNuevaReservaAsesor) {
        btnNuevaReservaAsesor.addEventListener('click', function () {
            var formNr = document.getElementById('formNuevaReservaAdmin');
            var errNr = document.getElementById('nuevaReservaFormError');
            if (formNr) {
                formNr.reset();
            }
            if (errNr) {
                errNr.textContent = '';
                errNr.classList.remove('form-group__error--visible');
            }
            actualizarMinimosNuevaReservaAdmin();
            abrirModal('modalNuevaReservaAdmin');
        });
    }

    var btnGuardarNuevaReservaAdm = document.getElementById('btnGuardarNuevaReservaAdmin');
    if (btnGuardarNuevaReservaAdm) {
        btnGuardarNuevaReservaAdm.addEventListener('click', function () {
            var formNr = document.getElementById('formNuevaReservaAdmin');
            var errNr = document.getElementById('nuevaReservaFormError');
            if (!formNr) {
                return;
            }
            if (errNr) {
                errNr.textContent = '';
                errNr.classList.remove('form-group__error--visible');
            }
            if (!formNr.checkValidity()) {
                formNr.reportValidity();
                return;
            }

            var dniInp = document.getElementById('nuevaResDni');
            var telInp = document.getElementById('nuevaResTelefono');
            var dniVal = dniInp ? dniInp.value.trim() : '';
            var telVal = telInp ? telInp.value.trim() : '';
            if (!/^\d{8}$/.test(dniVal)) {
                if (errNr) {
                    errNr.textContent = 'El DNI debe tener exactamente 8 dígitos numéricos.';
                    errNr.classList.add('form-group__error--visible');
                }
                if (dniInp) {
                    dniInp.focus();
                }
                return;
            }
            if (!/^\d{9}$/.test(telVal)) {
                if (errNr) {
                    errNr.textContent = 'El teléfono debe tener exactamente 9 dígitos (Perú).';
                    errNr.classList.add('form-group__error--visible');
                }
                if (telInp) {
                    telInp.focus();
                }
                return;
            }

            if (!validarFechasNuevaReservaAdmin(errNr)) {
                return;
            }

            var fd = new FormData(formNr);
            var precVal = document.getElementById('nuevaResPrecio');
            if (precVal && !String(precVal.value || '').trim()) {
                fd.delete('precio_total');
            }
            var emailInp = document.getElementById('nuevaResEmail');
            if (emailInp && !emailInp.value.trim()) {
                fd.delete('email');
            }

            var btn = this;
            var txtOg = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Registrando…';

            fetchApi(urlBackend('/api/reservas/admin'), {
                method: 'POST',
                headers: headersAuthBearer(),
                body: fd
            })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        var msg = mensajeErrorApi(result.data);
                        if (errNr) {
                            errNr.textContent = msg;
                            errNr.classList.add('form-group__error--visible');
                        } else {
                            alert(msg);
                        }
                        return;
                    }
                    var cod =
                        result.data && result.data.codigo_reserva
                            ? String(result.data.codigo_reserva)
                            : '';
                    cerrarModal('modalNuevaReservaAdmin');
                    alert(
                        cod
                            ? 'Reserva creada. Código: ' + cod
                            : 'Reserva creada correctamente.'
                    );
                    refrescarTrasCambioReservaAsesor();
                })
                .catch(function () {
                    if (errNr) {
                        errNr.textContent = 'No se pudo conectar con el servidor.';
                        errNr.classList.add('form-group__error--visible');
                    } else {
                        alert('No se pudo conectar con el servidor.');
                    }
                })
                .finally(function () {
                    btn.disabled = false;
                    btn.textContent = txtOg;
                });
        });
    }

    function reservaListaCoincideFiltro(rv, textoBusqueda, estadoFiltro, pagoFiltro) {
        var estado = (rv.estado || 'pendiente').toLowerCase();
        if (estadoFiltro && estado !== estadoFiltro.toLowerCase()) {
            return false;
        }
        var pago = (rv.estado_pago || 'pendiente').toLowerCase();
        if (pagoFiltro && pago !== pagoFiltro.toLowerCase()) {
            return false;
        }
        var q = (textoBusqueda || '').trim().toLowerCase();
        if (!q) {
            return true;
        }
        var campos = [
            rv.codigo_reserva,
            rv.cliente_nombre,
            rv.cliente_dni,
            rv.cliente_telefono,
            rv.origen,
            rv.destino,
            rv.cantidad_pasajeros != null ? String(rv.cantidad_pasajeros) : '',
            rv.precio_total != null ? String(rv.precio_total) : '',
            formatearSolesPEN(rv.precio_total),
            rv.estado,
            etiquetaEstadoReserva(rv.estado),
            rv.estado_pago,
            etiquetaEstadoPago(rv.estado_pago),
            formatearIsoEnTexto(rv.fecha_partida)
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function htmlFilaMisReserva(rv) {
        var est = (rv.estado || 'pendiente').toLowerCase();
        var estClase = claseEstadoPillReserva(est);
        var estTxt = escapeHtml(etiquetaEstadoReserva(est));
        var orig = escapeHtml(rv.origen || '—');
        var dst = escapeHtml(rv.destino || '—');
        var rutaTxt = orig + ' → ' + dst;
        var telRaw = String(rv.cliente_telefono || '').trim();
        var telTd;
        if (!telRaw || telRaw === '—') {
            telTd = '<td class="table-cell--muted">—</td>';
        } else {
            var hrefTel = 'tel:' + telRaw.replace(/\s+/g, '');
            telTd =
                '<td><a href="' +
                escapeHtml(hrefTel) +
                '" class="table--reservas-tel-link">' +
                escapeHtml(telRaw) +
                '</a></td>';
        }
        var codEsc = escaparParaAtributoHtml(rv.codigo_reserva || '');
        var precioTd;
        if (rv.precio_total != null && String(rv.precio_total).trim() !== '') {
            var pn = parseFloat(rv.precio_total);
            precioTd =
                '<td class="table-cell--monto">' +
                escapeHtml(!isNaN(pn) ? formatearSolesPEN(pn) : '—') +
                '</td>';
        } else {
            precioTd = '<td class="table-cell--monto table-cell--muted">—</td>';
        }
        return (
            '<tr>' +
            '<td class="table-cell--codigo">' +
            escapeHtml(rv.codigo_reserva || '—') +
            '</td>' +
            '<td class="table-cell--nombre">' +
            escapeHtml(formatearNombrePersona(rv.cliente_nombre) || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            rutaTxt +
            '</td>' +
            telTd +
            precioTd +
            '<td><span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estTxt +
            '</span></td>' +
            '<td class="table__acciones-iconos">' +
            '<button type="button" class="btn--icon btn-ver-detalle" data-id="' +
            rv.id_reserva +
            '" title="Detalles" aria-label="Ver detalles"><i class="fas fa-eye"></i></button>' +
            '<button type="button" class="btn--icon btn-reserva-editar" data-id="' +
            rv.id_reserva +
            '" title="Editar" aria-label="Editar reserva"><i class="fas fa-pen-to-square"></i></button>' +
            '<button type="button" class="btn--icon btn-reserva-eliminar" data-id="' +
            rv.id_reserva +
            '" data-codigo="' +
            codEsc +
            '" title="Eliminar" aria-label="Eliminar reserva"><i class="fas fa-trash"></i></button>' +
            '</td>' +
            '</tr>'
        );
    }

    function renderMisReservas() {
        var tbodyR = document.getElementById('tablaMisReservas');
        if (!tbodyR) {
            return;
        }
        var inputBuscar = document.getElementById('buscarMisReserva');
        var selEstado = document.getElementById('filtroEstadoMisReserva');
        var selPago = document.getElementById('filtroPagoMisReserva');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var estadoF = selEstado ? selEstado.value : '';
        var pagoF = selPago ? selPago.value : '';

        actualizarStatsReservasListado();

        if (!cacheReservas.length) {
            tbodyR.innerHTML =
                '<tr><td colspan="7">No hay reservas registradas.</td></tr>';
            actualizarPaginacionReservasListado(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheReservas.filter(function (rv) {
            return reservaListaCoincideFiltro(rv, texto, estadoF, pagoF);
        });

        if (!filtrados.length) {
            tbodyR.innerHTML =
                '<tr><td colspan="7">No hay reservas que coincidan con la búsqueda.</td></tr>';
            actualizarPaginacionReservasListado(0, 0, 0, 1);
            return;
        }

        var totalPaginas = Math.max(1, Math.ceil(filtrados.length / RESERVAS_POR_PAGINA));
        if (reservasPaginaActual > totalPaginas) {
            reservasPaginaActual = totalPaginas;
        }
        if (reservasPaginaActual < 1) {
            reservasPaginaActual = 1;
        }
        var inicio = (reservasPaginaActual - 1) * RESERVAS_POR_PAGINA;
        var pagina = filtrados.slice(inicio, inicio + RESERVAS_POR_PAGINA);
        tbodyR.innerHTML = pagina.map(htmlFilaMisReserva).join('');
        actualizarPaginacionReservasListado(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );

        tbodyR.querySelectorAll('.btn-ver-detalle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                mostrarDetalleReserva(parseInt(btn.dataset.id, 10));
            });
        });
    }

    var inputBuscarMisRes = document.getElementById('buscarMisReserva');
    if (inputBuscarMisRes) {
        inputBuscarMisRes.addEventListener('input', function () {
            reservasPaginaActual = 1;
            renderMisReservas();
        });
    }
    var filtroEstadoMisRes = document.getElementById('filtroEstadoMisReserva');
    if (filtroEstadoMisRes) {
        filtroEstadoMisRes.addEventListener('change', function () {
            reservasPaginaActual = 1;
            renderMisReservas();
        });
    }
    var filtroPagoMisRes = document.getElementById('filtroPagoMisReserva');
    if (filtroPagoMisRes) {
        filtroPagoMisRes.addEventListener('change', function () {
            reservasPaginaActual = 1;
            renderMisReservas();
        });
    }
    var btnResPrev = document.getElementById('misReservasPaginaPrev');
    if (btnResPrev) {
        btnResPrev.addEventListener('click', function () {
            if (reservasPaginaActual > 1) {
                reservasPaginaActual -= 1;
                renderMisReservas();
            }
        });
    }
    var btnResNext = document.getElementById('misReservasPaginaNext');
    if (btnResNext) {
        btnResNext.addEventListener('click', function () {
            reservasPaginaActual += 1;
            renderMisReservas();
        });
    }

    function viajeListaCoincideFiltro(v, textoBusqueda, estadoFiltro) {
        var clave = normalizarClaveEstadoViaje(v.estado);
        if (estadoFiltro && clave !== estadoFiltro.toLowerCase()) {
            return false;
        }
        var q = (textoBusqueda || '').trim().toLowerCase();
        if (!q) {
            return true;
        }
        var rutaCombo = ((v.origen || '') + ' ' + (v.destino || '')).trim();
        var campos = [
            v.codigo_viaje,
            v.codigo_reserva,
            v.cliente_nombre,
            v.origen,
            v.destino,
            rutaCombo,
            v.vehiculo_texto,
            v.conductor_texto,
            v.estado,
            etiquetaEstadoViajeHumano(v.estado),
            formatearIsoEnTexto(v.fecha_salida),
            v.fecha_retorno ? formatearIsoEnTexto(v.fecha_retorno) : ''
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function actualizarStatsViajesListado() {
        var lista = cacheListaViajes;
        var setNum = function (id, n) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = String(n);
            }
        };
        setNum('statVjTotal', lista.length);
        setNum(
            'statVjPendientes',
            lista.filter(function (v) {
                return normalizarClaveEstadoViaje(v.estado) === 'pendiente';
            }).length
        );
        setNum(
            'statVjEnCamino',
            lista.filter(function (v) {
                return normalizarClaveEstadoViaje(v.estado) === 'en_camino';
            }).length
        );
        setNum(
            'statVjFinalizados',
            lista.filter(function (v) {
                var e = normalizarClaveEstadoViaje(v.estado);
                return e === 'finalizado' || e === 'completado';
            }).length
        );
    }

    function actualizarPaginacionViajesListado(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('viajesPaginacionInfo');
        var label = document.getElementById('viajesPaginaLabel');
        var btnPrev = document.getElementById('viajesPaginaPrev');
        var btnNext = document.getElementById('viajesPaginaNext');
        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 viajes';
            }
            if (label) {
                label.textContent = '1';
            }
            if (btnPrev) {
                btnPrev.disabled = true;
            }
            if (btnNext) {
                btnNext.disabled = true;
            }
            return;
        }
        if (info) {
            info.textContent =
                'Mostrando ' +
                (inicioIdx + 1) +
                ' a ' +
                (inicioIdx + cantEnPagina) +
                ' de ' +
                totalFiltrados +
                ' viajes';
        }
        if (label) {
            label.textContent = String(viajesListaPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = viajesListaPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = viajesListaPaginaActual >= totalPaginas;
        }
    }

    /** Mismos colores que el panel administrador (vehículos → tipo). */
    function claseBadgeTipoVehiculoViaje(tipo) {
        var t = (tipo || '').trim().toLowerCase();
        if (t === 'minivan') {
            return 'badge-tipo badge-tipo--minivan';
        }
        if (t === 'van') {
            return 'badge-tipo badge-tipo--van';
        }
        if (t === 'coaster') {
            return 'badge-tipo badge-tipo--coaster';
        }
        if (t === 'longibus' || t === 'omnibus' || t === 'ómnibus' || t === 'autobús' || t === 'autobus') {
            return 'badge-tipo badge-tipo--omnibus';
        }
        return 'badge-tipo';
    }

    function htmlTipoVehiculoCeldaViaje(v) {
        var raw = (v.vehiculo_texto || '').trim();
        var low = raw.toLowerCase();
        if (!raw || low === 'sin asignar' || raw === '—' || low === '-') {
            return '<span class="table-cell--muted">—</span>';
        }
        return '<span class="' + claseBadgeTipoVehiculoViaje(raw) + '">' + escapeHtml(raw) + '</span>';
    }

    function htmlConductorCeldaViaje(v) {
        var raw = (v.conductor_texto || '').trim();
        var low = raw.toLowerCase();
        if (!raw || low === 'sin asignar' || raw === '—' || low === '-') {
            return '<span class="table-cell--muted">—</span>';
        }
        return '<span class="table-cell--muted">' + escapeHtml(raw) + '</span>';
    }

    function htmlFilaViajeListado(v) {
        var codigo =
            v.codigo_viaje && String(v.codigo_viaje).trim()
                ? escapeHtml(String(v.codigo_viaje).trim().toUpperCase())
                : '—';
        var cliente = escapeHtml(formatearNombrePersona(v.cliente_nombre) || '—');
        var estClase = claseEstadoPillViaje(v.estado);
        var estTxt = escapeHtml(etiquetaEstadoViajeHumano(v.estado));
        var celdaEstado =
            '<td class="table-cell--viaje-estado">' +
            '<span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estTxt +
            '</span></td>';

        var acciones;
        if (viajeNecesitaFlota(v)) {
            acciones =
                '<td class="table__acciones-iconos">' +
                '<button type="button" class="btn btn--flota btn--sm btn-abrir-asignar" data-id="' +
                v.id_viaje +
                '" title="Elegir vehículo y conductor">' +
                '<i class="fas fa-truck-field" aria-hidden="true"></i> Asignar' +
                '</button></td>';
        } else {
            acciones =
                '<td class="table__acciones-iconos viajes-acciones-flota">' +
                '<button type="button" class="btn--icon btn-ver-detalle-viaje" data-id="' +
                v.id_viaje +
                '" title="Ver detalles del viaje" aria-label="Detalles de viaje">' +
                '<i class="fas fa-eye" aria-hidden="true"></i></button>' +
                '<button type="button" class="btn--icon btn-reserva-editar btn-abrir-asignar" data-id="' +
                v.id_viaje +
                '" title="Cambiar vehículo o conductor" aria-label="Cambiar flota">' +
                '<i class="fas fa-pen-to-square" aria-hidden="true"></i></button>' +
                '</td>';
        }
        return (
            '<tr>' +
            '<td class="table-cell--codigo">' +
            codigo +
            '</td>' +
            '<td class="table-cell--nombre">' +
            cliente +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(v.origen || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(v.destino || '—') +
            '</td>' +
            '<td class="table-cell--viaje-flota">' +
            htmlTipoVehiculoCeldaViaje(v) +
            '</td>' +
            '<td class="table-cell--viaje-flota">' +
            htmlConductorCeldaViaje(v) +
            '</td>' +
            celdaEstado +
            acciones +
            '</tr>'
        );
    }

    function renderTablaViajes() {
        var tbodyVj = document.getElementById('tablaViajes');
        if (!tbodyVj) {
            return;
        }
        var inputBuscar = document.getElementById('buscarViajeAdmin');
        var selEstado = document.getElementById('filtroEstadoViaje');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var estadoF = selEstado ? selEstado.value : '';

        actualizarStatsViajesListado();

        if (!cacheListaViajes.length) {
            tbodyVj.innerHTML =
                '<tr><td colspan="8">No hay viajes confirmados. Confirma una reserva para generar un código de viaje.</td></tr>';
            actualizarPaginacionViajesListado(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheListaViajes.filter(function (v) {
            if (viajesModoSoloSinFlota && !viajeNecesitaFlota(v)) {
                return false;
            }
            return viajeListaCoincideFiltro(v, texto, estadoF);
        });
        filtrados.sort(function (a, b) {
            var ta = new Date(a.fecha_salida).getTime();
            var tb = new Date(b.fecha_salida).getTime();
            if (isNaN(ta) && isNaN(tb)) {
                return (b.id_viaje || 0) - (a.id_viaje || 0);
            }
            if (isNaN(ta)) {
                return 1;
            }
            if (isNaN(tb)) {
                return -1;
            }
            if (ta !== tb) {
                return ta - tb;
            }
            return (a.id_viaje || 0) - (b.id_viaje || 0);
        });

        if (!filtrados.length) {
            var msgVac =
                viajesModoSoloSinFlota ?
                    'No hay viajes sin flota asignada: todos ya tienen vehículo y conductor.'
                :   'No hay viajes que coincidan con la búsqueda.';
            tbodyVj.innerHTML = '<tr><td colspan="8">' + msgVac + '</td></tr>';
            actualizarPaginacionViajesListado(0, 0, 0, 1);
            return;
        }

        var totalPaginas = Math.max(
            1,
            Math.ceil(filtrados.length / VIAJES_LISTADO_POR_PAGINA)
        );
        if (viajesListaPaginaActual > totalPaginas) {
            viajesListaPaginaActual = totalPaginas;
        }
        if (viajesListaPaginaActual < 1) {
            viajesListaPaginaActual = 1;
        }
        var inicio = (viajesListaPaginaActual - 1) * VIAJES_LISTADO_POR_PAGINA;
        var pagina = filtrados.slice(inicio, inicio + VIAJES_LISTADO_POR_PAGINA);
        tbodyVj.innerHTML = pagina.map(htmlFilaViajeListado).join('');
        tbodyVj.querySelectorAll('.btn-abrir-asignar').forEach(function (btn) {
            btn.addEventListener('click', function () {
                abrirModalAsignar(parseInt(btn.dataset.id, 10));
            });
        });
        tbodyVj.querySelectorAll('.btn-ver-detalle-viaje').forEach(function (btn) {
            btn.addEventListener('click', function () {
                mostrarDetalleViaje(parseInt(btn.dataset.id, 10));
            });
        });
        actualizarPaginacionViajesListado(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var inputBuscarViajeAdmin = document.getElementById('buscarViajeAdmin');
    if (inputBuscarViajeAdmin) {
        inputBuscarViajeAdmin.addEventListener('input', function () {
            viajesListaPaginaActual = 1;
            renderTablaViajes();
        });
    }
    var filtroEstadoViajeEl = document.getElementById('filtroEstadoViaje');
    if (filtroEstadoViajeEl) {
        filtroEstadoViajeEl.addEventListener('change', function () {
            viajesListaPaginaActual = 1;
            renderTablaViajes();
        });
    }

    function syncViajesModoFlotaUi() {
        var chk = document.getElementById('chkViajesSoloSinFlota');
        if (chk) {
            chk.checked = viajesModoSoloSinFlota;
        }
    }

    var chkViajesSoloSinFlota = document.getElementById('chkViajesSoloSinFlota');
    if (chkViajesSoloSinFlota) {
        chkViajesSoloSinFlota.addEventListener('change', function () {
            viajesModoSoloSinFlota = chkViajesSoloSinFlota.checked;
            viajesListaPaginaActual = 1;
            syncViajesModoFlotaUi();
            renderTablaViajes();
        });
    }
    syncViajesModoFlotaUi();

    var btnVjPrev = document.getElementById('viajesPaginaPrev');
    if (btnVjPrev) {
        btnVjPrev.addEventListener('click', function () {
            if (viajesListaPaginaActual > 1) {
                viajesListaPaginaActual -= 1;
                renderTablaViajes();
            }
        });
    }
    var btnVjNext = document.getElementById('viajesPaginaNext');
    if (btnVjNext) {
        btnVjNext.addEventListener('click', function () {
            viajesListaPaginaActual += 1;
            renderTablaViajes();
        });
    }

    function cargarViajesListadoDesdeApi() {
        var tbodyVj = document.getElementById('tablaViajes');
        if (!tbodyVj) {
            return Promise.resolve();
        }
        tbodyVj.innerHTML = '<tr><td colspan="8">Cargando…</td></tr>';
        return fetchApi(urlBackend('/api/viajes'), { headers: headersAuthJSON() })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        cerrarSesion();
                        return;
                    }
                    tbodyVj.innerHTML =
                        '<tr><td colspan="8">' +
                        escapeHtml(mensajeErrorApi(result.data)) +
                        '</td></tr>';
                    return;
                }
                cacheListaViajes = Array.isArray(result.data) ? result.data : [];
                viajesListaPaginaActual = 1;
                renderTablaViajes();
            })
            .catch(function (errFetch) {
                var msgRed =
                    typeof mensajeErrorRedFetch === 'function' ?
                        mensajeErrorRedFetch(errFetch)
                    :   'No se pudo conectar con el API.';
                tbodyVj.innerHTML =
                    '<tr><td colspan="8">' + escapeHtml(msgRed) + '</td></tr>';
            });
    }

    function inicialesClienteDetalle(nombreCompleto) {
        var partes = String(nombreCompleto || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (!partes.length) {
            return '?';
        }
        if (partes.length === 1) {
            return partes[0].slice(0, 2).toUpperCase();
        }
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    function claseRdMetodoPago(mp) {
        var m = String(mp || '').toLowerCase();
        if (m.indexOf('yape') >= 0) {
            return 'rd-method rd-method--yape';
        }
        if (m.indexOf('plin') >= 0) {
            return 'rd-method rd-method--plin';
        }
        if (m.indexOf('bcp') >= 0) {
            return 'rd-method rd-method--bcp';
        }
        if (m.indexOf('interbank') >= 0) {
            return 'rd-method rd-method--interbank';
        }
        if (m.indexOf('efectivo') >= 0) {
            return 'rd-method rd-method--efectivo';
        }
        return 'rd-method rd-method--default';
    }

    function htmlDetalleReserva(r) {
        var est = (r.estado || 'pendiente').toLowerCase();
        var estClase = claseEstadoPillReserva(est);
        var pagoClase = claseEstadoPago(r.estado_pago);
        var nombreCli = String(r.cliente_nombre || '—').trim() || '—';
        var iniCli = inicialesClienteDetalle(r.cliente_nombre);
        var creada = r.fecha_registro_reserva
            ? formatearIsoEnTexto(r.fecha_registro_reserva)
            : '—';
        var codRes = escapeHtml(r.codigo_reserva || '—');
        var telRawDet = String(r.cliente_telefono || '').trim();
        var telDetalle =
            telRawDet && telRawDet !== '—'
                ? '<div class="rd-cliente__dni">TEL: <a href="' +
                  escapeHtml('tel:' + telRawDet.replace(/\s+/g, '')) +
                  '" class="table--reservas-tel-link">' +
                  escapeHtml(telRawDet) +
                  '</a></div>'
                : '<div class="rd-cliente__dni">TEL: —</div>';
        var metodoRaw = (r.metodo_pago || '').trim();
        var metodoEsc = escapeHtml(metodoRaw || '—');
        var metodoBadge =
            metodoRaw ?
                '<span class="' +
                claseRdMetodoPago(metodoRaw) +
                '"><i class="fas fa-wallet" aria-hidden="true"></i> ' +
                metodoEsc +
                '</span>'
            :   '';
        var compTiene = !!(r.comprobante_pago && String(r.comprobante_pago).trim());
        var compHtml = compTiene
            ? '<a href="' +
              escapeHtml(urlComprobante(r.comprobante_pago)) +
              '" target="_blank" rel="noopener" class="rd-pago__comp-link">Ver comprobante adjunto</a>'
            :   '<span class="rd-pago__comp-sub">Sin comprobante adjunto</span>';
        var codViaje = r.codigo_viaje ? escapeHtml(String(r.codigo_viaje)) : '—';
        var vTxt = (r.vehiculo_texto || '').trim();
        var cTxt = (r.conductor_texto || '').trim();
        var vehEsc = escapeHtml(vTxt || '—');
        var condEsc = escapeHtml(cTxt || '—');
        var notaFlota = r.flota_asignada
            ? ''
            : '<p class="rd-unidad__note">Sin flota asignada</p>';
        var retTxt = formatearIsoEnTexto(r.fecha_retorno) || '—';

        return (
            '<div class="rd-v2">' +
            '<div class="rd-v2__summary">' +
            '<div class="rd-v2__summary-icon" aria-hidden="true"><i class="fas fa-file-lines"></i></div>' +
            '<div class="rd-v2__summary-text">' +
            '<div class="rd-v2__summary-title">' +
            codRes +
            '</div>' +
            '<div class="rd-v2__summary-meta">Creada el ' +
            escapeHtml(creada) +
            '</div></div>' +
            '<span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            escapeHtml(etiquetaEstadoReserva(est)) +
            '</span></div>' +
            '<div class="rd-v2__cols">' +
            '<div class="rd-v2__col rd-v2__col--left">' +
            '<section class="rd-card">' +
            '<div class="rd-card__head"><i class="fas fa-user" aria-hidden="true"></i> Cliente</div>' +
            '<div class="rd-cliente">' +
            '<div class="rd-cliente__avatar" aria-hidden="true">' +
            escapeHtml(iniCli) +
            '</div><div>' +
            '<div class="rd-cliente__nombre">' +
            escapeHtml(nombreCli) +
            '</div>' +
            '<div class="rd-cliente__dni">DNI: ' +
            escapeHtml(r.cliente_dni || '—') +
            '</div>' +
            telDetalle +
            '</div></div></section>' +
            '<section class="rd-card rd-card--pago">' +
            '<div class="rd-card__head"><i class="fas fa-credit-card" aria-hidden="true"></i> Pago</div>' +
            '<div class="rd-pago__monto">' +
            escapeHtml(formatearSolesPEN(r.precio_total)) +
            '</div>' +
            '<div class="rd-pago__badges">' +
            '<span class="' +
            pagoClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            escapeHtml(etiquetaEstadoPago(r.estado_pago)) +
            '</span>' +
            metodoBadge +
            '</div>' +
            '<div class="rd-pago__comp">' +
            '<div class="rd-pago__comp-label"><i class="fas fa-file-invoice" aria-hidden="true"></i> Comprobante</div>' +
            compHtml +
            '</div></section></div>' +
            '<div class="rd-v2__col rd-v2__col--right">' +
            '<section class="rd-card rd-card--servicio">' +
            '<div class="rd-card__head"><i class="fas fa-bus" aria-hidden="true"></i> Servicio</div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--origen"><i class="fas fa-location-dot"></i></span>' +
            '<span class="rd-servicio__label">Origen</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(r.origen || '—') +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--destino"><i class="fas fa-location-dot"></i></span>' +
            '<span class="rd-servicio__label">Destino</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(r.destino || '—') +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--salida"><i class="fas fa-calendar-day"></i></span>' +
            '<span class="rd-servicio__label">Salida</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(formatearIsoEnTexto(r.fecha_partida)) +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--retorno"><i class="fas fa-arrow-rotate-left"></i></span>' +
            '<span class="rd-servicio__label">Retorno</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(retTxt) +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--pax"><i class="fas fa-users"></i></span>' +
            '<span class="rd-servicio__label">Pasajeros</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(r.cantidad_pasajeros != null ? String(r.cantidad_pasajeros) : '—') +
            '</span></div>' +
            '</section></div></div>' +
            '<section class="rd-card rd-card--unidad">' +
            '<div class="rd-card__head"><i class="fas fa-bus" aria-hidden="true"></i> Unidad asignada</div>' +
            '<div class="rd-unidad__body">' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Código viaje</span>' +
            '<span class="rd-unidad__val">' +
            codViaje +
            '</span></div>' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Vehículo</span>' +
            '<span class="rd-unidad__val">' +
            vehEsc +
            '</span></div>' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Conductor</span>' +
            '<span class="rd-unidad__val">' +
            condEsc +
            '</span></div>' +
            notaFlota +
            '</div></section></div>'
        );
    }

    function mostrarDetalleReserva(id) {
        fetchApi(urlBackend('/api/reservas/admin/' + encodeURIComponent(id)), {
            headers: headersAuthJSON()
        })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                if (!result.ok) {
                    alert(mensajeErrorApi(result.data));
                    return;
                }
                document.getElementById('detalleReservaBody').innerHTML = htmlDetalleReserva(
                    result.data
                );
                abrirModal('modalDetalleReserva');
            })
            .catch(function () {
                alert('No se pudo cargar el detalle.');
            });
    }

    function recargarReservasActivas() {
        return cargarReservasDesdeApi().then(function () {
            var secR = document.getElementById('mis-reservas');
            if (secR && secR.classList.contains('section--active')) {
                renderMisReservas();
            }
            var secCp = document.getElementById('control-pagos');
            if (secCp && secCp.classList.contains('section--active')) {
                pintarTablaControlPagos();
            }
            var secVj = document.getElementById('viajes');
            if (secVj && secVj.classList.contains('section--active')) {
                cargarViajesListadoDesdeApi();
            }
        });
    }

    // ——— Asignar flota (modal; listado en pestaña Viajes) ———
    function mismoDiaSalidaViaje(fechaA, fechaB) {
        if (!fechaA || !fechaB) {
            return false;
        }
        var da = new Date(fechaA);
        var db = new Date(fechaB);
        if (isNaN(da.getTime()) || isNaN(db.getTime())) {
            return false;
        }
        return (
            da.getFullYear() === db.getFullYear() &&
            da.getMonth() === db.getMonth() &&
            da.getDate() === db.getDate()
        );
    }

    function idsFlotaOcupadaMismoDiaSalida(viajeActual) {
        var bloqVeh = {};
        var bloqEmp = {};
        if (!viajeActual || !cacheListaViajes.length) {
            return { veh: bloqVeh, emp: bloqEmp };
        }
        cacheListaViajes.forEach(function (t) {
            if (!t || t.id_viaje === viajeActual.id_viaje) {
                return;
            }
            if (!mismoDiaSalidaViaje(t.fecha_salida, viajeActual.fecha_salida)) {
                return;
            }
            if (t.id_vehiculo != null && !Number.isNaN(Number(t.id_vehiculo))) {
                bloqVeh[Number(t.id_vehiculo)] = true;
            }
            if (t.id_empleado != null && !Number.isNaN(Number(t.id_empleado))) {
                bloqEmp[Number(t.id_empleado)] = true;
            }
        });
        return { veh: bloqVeh, emp: bloqEmp };
    }

    function viajeNecesitaFlota(v) {
        return v.id_vehiculo == null || v.id_empleado == null;
    }

    function cargarCatalogoFlota(opts) {
        opts = opts || {};
        var incluirVid =
            opts.incluirIdVehiculo != null && opts.incluirIdVehiculo !== '' ?
                Number(opts.incluirIdVehiculo)
            :   null;
        var incluirEid =
            opts.incluirIdEmpleado != null && opts.incluirIdEmpleado !== '' ?
                Number(opts.incluirIdEmpleado)
            :   null;
        return Promise.all([
            fetchApi(urlBackend('/api/vehiculos'), { headers: headersAuthJSON() }).then(
                interpretarRespuestaApi
            ),
            fetchApi(urlBackend('/api/empleados'), { headers: headersAuthJSON() }).then(
                interpretarRespuestaApi
            )
        ]).then(function (results) {
            if (results[0].ok && Array.isArray(results[0].data)) {
                catalogoVehiculosApi = results[0].data.filter(function (v) {
                    var e = (v.estado || '').toLowerCase();
                    return (
                        e === 'disponible' ||
                        (incluirVid != null && !Number.isNaN(incluirVid) && Number(v.id_vehiculo) === incluirVid)
                    );
                });
            }
            if (results[1].ok && Array.isArray(results[1].data)) {
                conductoresApi = results[1].data.filter(function (emp) {
                    var cargo = (emp.cargo || '').toLowerCase();
                    if (cargo !== 'conductor') {
                        return false;
                    }
                    if (emp.estado !== false) {
                        return true;
                    }
                    return (
                        incluirEid != null &&
                        !Number.isNaN(incluirEid) &&
                        Number(emp.id_empleado) === incluirEid
                    );
                });
            }
        });
    }

    function selectTieneValor(selectEl, val) {
        if (!selectEl || val == null || val === '') {
            return false;
        }
        var s = String(val);
        for (var i = 0; i < selectEl.options.length; i++) {
            if (selectEl.options[i].value === s) {
                return true;
            }
        }
        return false;
    }

    function llenarSelectsAsignar(pasajeros, pre, viajeActual) {
        pre = pre || {};
        var selectVehiculo = document.getElementById('selectVehiculo');
        var selectConductor = document.getElementById('selectConductor');
        var pax = typeof pasajeros === 'number' ? pasajeros : 0;
        var bloq =
            viajeActual ? idsFlotaOcupadaMismoDiaSalida(viajeActual) : { veh: {}, emp: {} };
        var pidV = pre.id_vehiculo != null ? Number(pre.id_vehiculo) : null;
        var pidE = pre.id_empleado != null ? Number(pre.id_empleado) : null;

        var vehiculos = catalogoVehiculosApi.slice().filter(function (veh) {
            var id = Number(veh.id_vehiculo);
            if (pidV != null && !Number.isNaN(pidV) && id === pidV) {
                return true;
            }
            return !bloq.veh[id];
        });
        if (pax > 0) {
            vehiculos.sort(function (a, b) {
                var ca = a.capacidad || 0;
                var cb = b.capacidad || 0;
                var da = ca >= pax ? ca - pax : 9999;
                var db = cb >= pax ? cb - pax : 9999;
                return da - db;
            });
        }

        var conductores = conductoresApi.slice().filter(function (emp) {
            var id = Number(emp.id_empleado);
            if (pidE != null && !Number.isNaN(pidE) && id === pidE) {
                return true;
            }
            return !bloq.emp[id];
        });

        selectVehiculo.innerHTML =
            '<option value="" disabled selected>Seleccionar vehículo</option>' +
            vehiculos
                .map(function (v) {
                    var etiqueta = [v.placa, v.tipo, v.capacidad ? v.capacidad + ' pax' : '']
                        .filter(Boolean)
                        .join(' · ');
                    return (
                        '<option value="' +
                        v.id_vehiculo +
                        '">' +
                        escapeHtml(etiqueta) +
                        '</option>'
                    );
                })
                .join('');
        selectConductor.innerHTML =
            '<option value="" disabled selected>Seleccionar conductor</option>' +
            conductores
                .map(function (c) {
                    var ape = (c.apellido || '').trim();
                    if (ape === '.' || ape === '-') {
                        ape = '';
                    }
                    var nombre = ((c.nombre || '') + ' ' + ape).trim();
                    var lic = c.licencia ? ' — Lic. ' + c.licencia : '';
                    return (
                        '<option value="' +
                        c.id_empleado +
                        '">' +
                        escapeHtml(nombre + lic) +
                        '</option>'
                    );
                })
                .join('');

        if (pre.id_vehiculo && !selectTieneValor(selectVehiculo, pre.id_vehiculo)) {
            selectVehiculo.insertAdjacentHTML(
                'beforeend',
                '<option value="' +
                    Number(pre.id_vehiculo) +
                    '">' +
                    escapeHtml(pre.vehiculoEtiqueta || 'Vehículo actual') +
                    '</option>'
            );
        }
        if (pre.id_empleado && !selectTieneValor(selectConductor, pre.id_empleado)) {
            selectConductor.insertAdjacentHTML(
                'beforeend',
                '<option value="' +
                    Number(pre.id_empleado) +
                    '">' +
                    escapeHtml(pre.conductorEtiqueta || 'Conductor actual') +
                    '</option>'
            );
        }
        if (pre.id_vehiculo && selectTieneValor(selectVehiculo, pre.id_vehiculo)) {
            selectVehiculo.value = String(pre.id_vehiculo);
        }
        if (pre.id_empleado && selectTieneValor(selectConductor, pre.id_empleado)) {
            selectConductor.value = String(pre.id_empleado);
        }
    }

    /** Resumen superior del modal asignar flota (mismo patrón que detalle de reserva). */
    function htmlAsignarViajeResumenInterior(v) {
        var codV = (v.codigo_viaje && String(v.codigo_viaje).trim()) || '';
        var codR = (v.codigo_reserva && String(v.codigo_reserva).trim()) || '';
        var titLine =
            codV && codR ?
                escapeHtml(codV) + ' <span class="asignar-viaje-resumen__slash" aria-hidden="true">/</span> ' + escapeHtml(codR)
            : codV ?
                escapeHtml(codV)
            :   escapeHtml('Viaje');
        var cliente =
            v.cliente_nombre && String(v.cliente_nombre).trim() ?
                escapeHtml(formatearNombrePersona(v.cliente_nombre))
            :   '—';
        var estClase = claseEstadoPillViaje(v.estado);
        var estTxt = escapeHtml(etiquetaEstadoViajeHumano(v.estado));
        return (
            '<div class="rd-v2__summary-icon" aria-hidden="true"><i class="fas fa-file-lines"></i></div>' +
            '<div class="rd-v2__summary-text">' +
            '<div class="rd-v2__summary-title">' +
            titLine +
            '</div>' +
            '<div class="rd-v2__summary-meta">Cliente: ' +
            cliente +
            '</div></div>' +
            '<span class="' +
            estClase +
            ' asignar-viaje-resumen__estado">' +
            estTxt +
            '</span>'
        );
    }

    /** Tarjeta “Ruta y fechas”: mismas filas .rd-servicio que el detalle de reserva. */
    function htmlAsignarViajeDetalleServicio(v) {
        var retTxt = v.fecha_retorno
            ? escapeHtml(formatearIsoEnTexto(v.fecha_retorno))
            : '—';
        var pax =
            v.cantidad_pasajeros != null ?
                escapeHtml(String(v.cantidad_pasajeros))
            :   '—';
        return (
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--origen"><i class="fas fa-location-dot"></i></span>' +
            '<span class="rd-servicio__label">Origen</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(v.origen || '—') +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--destino"><i class="fas fa-location-dot"></i></span>' +
            '<span class="rd-servicio__label">Destino</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(v.destino || '—') +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--salida"><i class="fas fa-calendar-day"></i></span>' +
            '<span class="rd-servicio__label">Fecha salida</span>' +
            '<span class="rd-servicio__val">' +
            escapeHtml(formatearIsoEnTexto(v.fecha_salida)) +
            '</span></div>' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--retorno"><i class="fas fa-arrow-rotate-left"></i></span>' +
            '<span class="rd-servicio__label">Fecha retorno</span>' +
            '<span class="rd-servicio__val">' +
            retTxt +
            '</span></div>' +
            '<div class="rd-servicio__pax-wrap">' +
            '<div class="rd-servicio__row">' +
            '<span class="rd-servicio__ic rd-servicio__ic--pax"><i class="fas fa-users"></i></span>' +
            '<span class="rd-servicio__label">Pasajeros</span>' +
            '<span class="rd-servicio__val">' +
            pax +
            '</span></div></div>'
        );
    }

    /** Cuerpo del modal «Detalle de viaje» (misma estructura visual que asignar, sin formulario). */
    function htmlDetalleViajeCuerpo(v) {
        var resumen = htmlAsignarViajeResumenInterior(v);
        var servicio = htmlAsignarViajeDetalleServicio(v);
        var vehHtml = htmlTipoVehiculoCeldaViaje(v);
        var condEsc = escapeHtml(v.conductor_texto || '—');
        var placaEsc =
            v.vehiculo_placa && String(v.vehiculo_placa).trim() ?
                escapeHtml(String(v.vehiculo_placa).trim())
            :   '—';
        var montoEsc =
            v.monto_total != null && String(v.monto_total) !== '' ?
                escapeHtml(formatearSolesPEN(v.monto_total))
            :   '—';
        return (
            '<div class="rd-v2">' +
            '<div class="rd-v2__summary" role="group" aria-label="Resumen del viaje">' +
            resumen +
            '</div>' +
            '<div class="rd-v2__cols rd-v2__cols--asignar-flota">' +
            '<div class="rd-v2__col rd-v2__col--left">' +
            '<section class="rd-card rd-card--servicio">' +
            '<div class="rd-card__head"><i class="fas fa-route" aria-hidden="true"></i> Ruta y fechas</div>' +
            servicio +
            '</section></div>' +
            '<div class="rd-v2__col rd-v2__col--right">' +
            '<section class="rd-card rd-card--unidad">' +
            '<div class="rd-card__head"><i class="fas fa-bus" aria-hidden="true"></i> Vehículo y conductor</div>' +
            '<div class="rd-unidad__body">' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Vehículo</span>' +
            '<span class="rd-unidad__val">' +
            vehHtml +
            '</span></div>' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Placa</span>' +
            '<span class="rd-unidad__val">' +
            placaEsc +
            '</span></div>' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Conductor</span>' +
            '<span class="rd-unidad__val">' +
            condEsc +
            '</span></div>' +
            '<div class="rd-unidad__row">' +
            '<span class="rd-unidad__lbl">Monto</span>' +
            '<span class="rd-unidad__val">' +
            montoEsc +
            '</span></div>' +
            '</div></section></div></div></div>'
        );
    }

    function mostrarDetalleViaje(idViaje) {
        var v = cacheListaViajes.find(function (x) {
            return x.id_viaje === idViaje;
        });
        var body = document.getElementById('detalleViajeBody');
        if (!v || !body || viajeNecesitaFlota(v)) {
            return;
        }
        body.innerHTML = htmlDetalleViajeCuerpo(v);
        abrirModal('modalDetalleViaje');
    }

    function abrirModalAsignar(idViaje) {
        var v = cacheListaViajes.find(function (x) {
            return x.id_viaje === idViaje;
        });
        if (!v) {
            return;
        }
        var necesita = viajeNecesitaFlota(v);
        var titModal = document.getElementById('modalAsignarViajeTitulo');
        if (titModal) {
            titModal.textContent = necesita
                ? 'Asignar conductor y vehículo'
                : 'Cambiar flota del viaje';
        }
        var btnOk = document.getElementById('btnConfirmarAsignacion');
        if (btnOk) {
            btnOk.textContent = necesita ? 'Asignar flota' : 'Guardar cambios';
        }
        document.getElementById('asignarIdViaje').value = String(idViaje);
        document.getElementById('asignarResumen').innerHTML = htmlAsignarViajeResumenInterior(v);
        var elServ = document.getElementById('asignarDetalleServicio');
        if (elServ) {
            elServ.innerHTML = htmlAsignarViajeDetalleServicio(v);
        }
        var errAsig = document.getElementById('asignarViajeFormError');
        if (errAsig) {
            errAsig.textContent = '';
            errAsig.classList.remove('form-group__error--visible');
        }
        cargarCatalogoFlota({
            incluirIdVehiculo: v.id_vehiculo,
            incluirIdEmpleado: v.id_empleado
        }).then(function () {
            llenarSelectsAsignar(
                v.cantidad_pasajeros,
                {
                    id_vehiculo: v.id_vehiculo,
                    id_empleado: v.id_empleado,
                    vehiculoEtiqueta: v.vehiculo_texto,
                    conductorEtiqueta: v.conductor_texto
                },
                v
            );
            abrirModal('modalAsignarViaje');
        });
    }

    document.getElementById('btnConfirmarAsignacion').addEventListener('click', function () {
        var form = document.getElementById('formAsignarViaje');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        var fd = new FormData(form);
        var idViaje = parseInt(fd.get('id_viaje'), 10);
        var btn = this;
        btn.disabled = true;
        fetchApi(urlBackend('/api/viajes/' + encodeURIComponent(idViaje) + '/asignar'), {
            method: 'PATCH',
            headers: headersAuthJSON(),
            body: JSON.stringify({
                id_vehiculo: parseInt(fd.get('id_vehiculo'), 10),
                id_empleado: parseInt(fd.get('id_conductor'), 10)
            })
        })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                btn.disabled = false;
                if (!result.ok) {
                    alert(mensajeErrorApi(result.data));
                    return;
                }
                cerrarModal('modalAsignarViaje');
                form.reset();
                alert('Flota guardada para el viaje ' + (result.data.codigo_viaje || '') + '.');
                recargarReservasActivas();
            })
            .catch(function (err) {
                btn.disabled = false;
                alert(
                    typeof mensajeErrorRedFetch === 'function' ?
                        mensajeErrorRedFetch(err)
                    :   'Sin conexión'
                );
            });
    });

    // ——— Pagos (panel asesor) ———
    function pintarTablaControlPagos() {
        var tbody = document.getElementById('tablaControlPagos');
        if (!tbody) {
            return;
        }
        actualizarStatsPagos();
        var lista = cacheReservas.slice().sort(function (a, b) {
            var fa = a.fecha_registro_reserva ? new Date(a.fecha_registro_reserva).getTime() : 0;
            var fb = b.fecha_registro_reserva ? new Date(b.fecha_registro_reserva).getTime() : 0;
            return fb - fa;
        });
        var filtroMetodo = document.getElementById('filtroMetodoControlPagos');
        var met = filtroMetodo ? filtroMetodo.value : '';
        if (met) {
            lista = lista.filter(function (r) {
                return (r.metodo_pago || '').toLowerCase() === met;
            });
        }
        if (!lista.length) {
            var msgVacio;
            if (met) {
                msgVacio = 'No hay reservas con el método de pago seleccionado.';
            } else if (!cacheReservas.length) {
                msgVacio = 'No hay reservas registradas.';
            } else {
                msgVacio = 'No hay reservas para mostrar.';
            }
            tbody.innerHTML =
                '<tr><td colspan="8" style="text-align:center;color:#6c757d;">' +
                msgVacio +
                '</td></tr>';
            actualizarPaginacionPagos(0, 0, 0, 1);
            return;
        }
        var totalPaginas = Math.max(1, Math.ceil(lista.length / RESERVAS_POR_PAGINA));
        if (pagosPaginaActual > totalPaginas) {
            pagosPaginaActual = totalPaginas;
        }
        if (pagosPaginaActual < 1) {
            pagosPaginaActual = 1;
        }
        var inicio = (pagosPaginaActual - 1) * RESERVAS_POR_PAGINA;
        var pagina = lista.slice(inicio, inicio + RESERVAS_POR_PAGINA);
        tbody.innerHTML = pagina
            .map(function (rv) {
                var canal = (rv.registro_origen || '').toLowerCase();
                var origenCell;
                if (canal === 'panel') {
                    origenCell =
                        '<span class="cp-origen cp-origen--panel"><i class="fas fa-desktop" aria-hidden="true"></i> Panel</span>';
                } else if (canal === 'web') {
                    origenCell =
                        '<span class="cp-origen cp-origen--web"><i class="fas fa-globe" aria-hidden="true"></i> Web</span>';
                } else {
                    origenCell =
                        '<span class="cp-origen cp-origen--legacy" title="Reserva anterior a registro de canal">—</span>';
                }
                var urlComp = rv.comprobante_pago ? urlComprobante(rv.comprobante_pago) : '';
                var compTone =
                    canal === 'panel' ? ' cp-comp-actions--panel' : canal === 'web' ? ' cp-comp-actions--web' : '';
                var compCell;
                if (urlComp) {
                    compCell =
                        '<div class="cp-comp-actions' +
                        compTone +
                        '">' +
                        '<a href="' +
                        escapeHtml(urlComp) +
                        '" target="_blank" rel="noopener noreferrer" class="btn--icon cp-comp-icon" title="Abrir comprobante en nueva pestaña" aria-label="Abrir comprobante en nueva pestaña">' +
                        '<i class="fas fa-download" aria-hidden="true"></i></a>' +
                        '</div>';
                } else {
                    compCell =
                        '<span class="table-cell--muted cp-comp-sin" title="Sin archivo"><i class="fas fa-file-circle-xmark" aria-hidden="true"></i></span>';
                }
                var pagoOk = (rv.estado_pago || 'pendiente').toLowerCase() === 'verificado';
                var checkMarca = pagoOk
                    ? '<span class="cp-pago-est cp-pago-est--ok" title="Pago verificado"><i class="fas fa-circle-check" aria-hidden="true"></i></span>'
                    : '<span class="cp-pago-est cp-pago-est--pend" title="Pago pendiente de verificar"><i class="fas fa-hourglass-half" aria-hidden="true"></i></span>';
                var montoTxt =
                    rv.precio_total != null && String(rv.precio_total).trim() !== ''
                        ? escapeHtml(formatearSolesPEN(rv.precio_total))
                        : '<span class="table-cell--muted">—</span>';
                var dniTxt = escapeHtml(rv.cliente_dni || '—');
                return (
                    '<tr>' +
                    '<td class="table-cell--codigo">' +
                    escapeHtml(rv.codigo_reserva || '—') +
                    '</td>' +
                    '<td class="table-cell--nombre">' +
                    escapeHtml(formatearNombrePersona(rv.cliente_nombre) || '—') +
                    '</td>' +
                    '<td>' +
                    dniTxt +
                    '</td>' +
                    '<td>' +
                    montoTxt +
                    '</td>' +
                    '<td>' +
                    escapeHtml((rv.metodo_pago || '—').toUpperCase()) +
                    '</td>' +
                    '<td>' +
                    origenCell +
                    '</td>' +
                    '<td class="table-cell--cp-comp">' +
                    compCell +
                    '</td>' +
                    '<td class="table__acciones-iconos table__acciones-iconos--cp">' +
                    '<div class="cp-acciones-inner">' +
                    checkMarca +
                    ' <button type="button" class="btn--icon btn-ver-detalle-cp" data-id="' +
                    rv.id_reserva +
                    '" title="Detalle de la reserva" aria-label="Detalle de la reserva"><i class="fas fa-eye"></i></button>' +
                    '</div></td></tr>'
                );
            })
            .join('');
        actualizarPaginacionPagos(lista.length, inicio, pagina.length, totalPaginas);
    }

    function renderControlPagos() {
        var tbody = document.getElementById('tablaControlPagos');
        if (!tbody) {
            return Promise.resolve();
        }
        pagosPaginaActual = 1;
        tbody.innerHTML = '<tr><td colspan="8">Cargando…</td></tr>';
        return cargarReservasDesdeApi()
            .then(function () {
                pintarTablaControlPagos();
            })
            .catch(function (err) {
                var txt =
                    typeof mensajeErrorRedFetch === 'function' ?
                        mensajeErrorRedFetch(err)
                    :   err.message || 'No se pudo cargar las reservas.';
                tbody.innerHTML =
                    '<tr><td colspan="8">' + escapeHtml(txt) + '</td></tr>';
                actualizarPaginacionPagos(0, 0, 0, 1);
            });
    }

    var elFiltroMetodoControlPagos = document.getElementById('filtroMetodoControlPagos');
    if (elFiltroMetodoControlPagos) {
        elFiltroMetodoControlPagos.addEventListener('change', function () {
            pagosPaginaActual = 1;
            pintarTablaControlPagos();
        });
    }

    var btnPagosPrev = document.getElementById('pagosPaginaPrev');
    if (btnPagosPrev) {
        btnPagosPrev.addEventListener('click', function () {
            if (pagosPaginaActual > 1) {
                pagosPaginaActual -= 1;
                pintarTablaControlPagos();
            }
        });
    }
    var btnPagosNext = document.getElementById('pagosPaginaNext');
    if (btnPagosNext) {
        btnPagosNext.addEventListener('click', function () {
            pagosPaginaActual += 1;
            pintarTablaControlPagos();
        });
    }

    var secControlPagos = document.getElementById('control-pagos');
    if (secControlPagos) {
        secControlPagos.addEventListener('click', function (e) {
            var det = e.target.closest('.btn-ver-detalle-cp');
            if (det && det.dataset.id) {
                mostrarDetalleReserva(parseInt(det.dataset.id, 10));
            }
        });
    }

    // ——— Secciones ———
    function cargarSeccion(sectionId) {
        if (sectionId === 'mis-reservas') {
            var tbody = document.getElementById('tablaMisReservas');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7">Cargando…</td></tr>';
            }
            cargarReservasDesdeApi()
                .then(function () {
                    reservasPaginaActual = 1;
                    renderMisReservas();
                })
                .catch(function (err) {
                    if (tbody) {
                        var txtErr =
                            typeof mensajeErrorRedFetch === 'function' ?
                                mensajeErrorRedFetch(err)
                            :   err.message || 'Error de red';
                        tbody.innerHTML =
                            '<tr><td colspan="7">' + escapeHtml(txtErr) + '</td></tr>';
                    }
                });
        }
        if (sectionId === 'viajes') {
            cargarViajesListadoDesdeApi();
        }
        if (sectionId === 'control-pagos') {
            renderControlPagos();
        }
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            var sectionId = item.dataset.section;
            navItems.forEach(function (n) {
                n.classList.remove('panel__nav-item--active');
            });
            item.classList.add('panel__nav-item--active');
            sections.forEach(function (s) {
                s.classList.remove('section--active');
            });
            document.getElementById(sectionId).classList.add('section--active');
            if (pageTitle) {
                pageTitle.textContent = titulos[sectionId] || 'Panel asesor';
            }
            cargarSeccion(sectionId);
        });
    });

    cargarSeccion('mis-reservas');
});
