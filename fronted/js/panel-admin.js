// ============================================
// PANEL-ADMIN.JS - Panel del Administrador
// ============================================

document.addEventListener('DOMContentLoaded', function () {

    const usuarioSesionAdmin = verificarSesion(['admin', 'administrador', 1]);
    if (!usuarioSesionAdmin) return;

    var idUsuarioEnSesion =
        usuarioSesionAdmin &&
        usuarioSesionAdmin.id_usuario != null &&
        usuarioSesionAdmin.id_usuario !== ''
            ? Number(usuarioSesionAdmin.id_usuario)
            : null;

    function rotuloRolSesionAdmin(rol) {
        var r = String(rol || '').toLowerCase();
        if (r.indexOf('admin') >= 0) {
            return 'Administrador';
        }
        if (r.indexOf('asesor') >= 0) {
            return 'Asesor de ventas';
        }
        if (r.indexOf('conductor') >= 0) {
            return 'Conductor';
        }
        return 'Usuario';
    }

    function nombreUsuarioMayusculas(nombre) {
        return String(nombre || 'Administrador')
            .trim()
            .toUpperCase();
    }

    function inicialesDesdeNombreUsuario(nombre) {
        var t = nombreUsuarioMayusculas(nombre);
        if (!t || t === 'ADMINISTRADOR') {
            return 'AD';
        }
        var sinEsp = t.replace(/\s+/g, '');
        if (sinEsp.length >= 2) {
            return sinEsp.slice(0, 2);
        }
        return sinEsp.slice(0, 1) || 'AD';
    }

    function aplicarPerfilUsuarioEnPanel(usuario) {
        var nombreMostrar = nombreUsuarioMayusculas(usuario.nombre_usuario);
        var rolMostrar = rotuloRolSesionAdmin(usuario.rol);
        var iniciales = inicialesDesdeNombreUsuario(usuario.nombre_usuario);

        var adminNombre = document.getElementById('adminNombre');
        if (adminNombre) {
            adminNombre.textContent = nombreMostrar;
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

    aplicarPerfilUsuarioEnPanel(usuarioSesionAdmin);

    function headersAuthJSON() {
        return {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem('token')
        };
    }

    function headersAuthBearer() {
        return {
            Authorization: 'Bearer ' + localStorage.getItem('token')
        };
    }


    function fetchApi(url, options, timeoutMs) {
        return fetchConTimeout(url, options || {}, timeoutMs || 20000);
    }

    function mensajeErrorApi(data) {
        if (!data || data.detail === undefined || data.detail === null) {
            return 'No se pudo completar la operación.';
        }
        if (typeof data.detail === 'string') {
            var det = data.detail.trim();
            if (det === 'Not Found') {
                var saludEj = (typeof API_URL !== 'undefined' && API_URL) ?
                    String(API_URL).replace(/\/+$/, '') + '/salud' :
                    '/salud';
                return (
                    'HTTP 404: ese puerto no expone esta ruta. Abre en el navegador ' +
                    saludEj +
                    ' y comprueba que salga hay_panel_reservas: true (y rutas con /reservas/admin). ' +
                    'Si solo ves {\"estado\":\"ok\"} u otro JSON distinto, hay otro programa en el puerto 8000 o estás ejecutando un backend viejo. ' +
                    'Cierra todo lo que use el 8000 y arranca solo desde la carpeta backend: run_api.bat o .venv\\Scripts\\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8000. ' +
                    'API_URL en config.js = ' +
                    (typeof API_URL !== 'undefined' ? API_URL : '(no definido)') +
                    '; refresca el panel con Ctrl+F5.'
                );
            }
            return data.detail;
        }
        if (Array.isArray(data.detail)) {
            return data.detail
                .map(function (item) {
                    const loc =
                        item.loc && typeof item.loc.join === 'function'
                            ? item.loc.join('.')
                            : '';
                    const msg = item.msg || '';
                    return loc ? '(' + loc + ') ' + msg : msg || JSON.stringify(item);
                })
                .join('\n');
        }
        return JSON.stringify(data.detail);
    }

    /** Lee body como texto y parsea JSON si aplica (evita .json() ante HTML de error 500). */
    function interpretarRespuestaApi(response) {
        return response.text().then(function (texto) {
            var data = {};
            if (texto) {
                try {
                    data = JSON.parse(texto);
                } catch (ignoreErr) {
                    data = {
                        detail:
                            (texto.length > 400 ? texto.slice(0, 400) + '…' : texto) ||
                            'El servidor respondió sin JSON (HTTP ' +
                                response.status +
                                ').'
                    };
                }
            } else if (!response.ok) {
                var txtSt = (
                    typeof response.statusText === 'string' ?
                        response.statusText.trim() :
                        ''
                );
                data = {
                    detail:
                        txtSt ||
                        (response.status === 404 ?
                            'Not Found' :
                            'Error HTTP ' + response.status)
                };
            }
            return {
                ok: response.ok,
                status: response.status,
                data: data
            };
        });
    }

    /** Si /salud no trae hay_panel_reservas, el 8000 no es esta API (otro proceso o código viejo). */
    function mostrarBannerSiBackendIncorrecto() {
        fetchApi(urlBackend('/salud'), { cache: 'no-store' }, 8000)
            .then(interpretarRespuestaApi)
            .then(function (res) {
                if (!res.ok || !res.data) {
                    return;
                }
                if (res.data.hay_panel_reservas === true) {
                    return;
                }
                var base =
                    typeof API_URL !== 'undefined' && API_URL ?
                        String(API_URL).replace(/\/+$/, '') :
                        '';
                var bar = document.createElement('div');
                bar.setAttribute('role', 'alert');
                bar.style.cssText =
                    'box-sizing:border-box;width:100%;padding:12px 16px;margin:0 0 12px 0;' +
                    'background:#3d2419;color:#fde8d8;font-size:14px;line-height:1.45;' +
                    'border-bottom:2px solid #c45c3a;font-family:inherit;';
                bar.innerHTML =
                    '<strong>Backend incorrecto en el puerto.</strong> En <code style="background:#2a1812;padding:2px 6px;border-radius:4px">' +
                    escapeHtml(base + '/salud') +
                    '</code> debe aparecer <code style="background:#2a1812;padding:2px 6px;border-radius:4px">hay_panel_reservas: true</code>. ' +
                    'Si no, cierra procesos en el puerto 8000 y vuelve a iniciar desde la carpeta <strong>backend</strong> con ' +
                    '<code style="background:#2a1812;padding:2px 6px;border-radius:4px">run_api.bat</code> o ' +
                    '<code style="background:#2a1812;padding:2px 6px;border-radius:4px">.venv\\Scripts\\uvicorn.exe</code> del proyecto.';
                var panel = document.querySelector('.panel');
                if (panel && panel.parentNode) {
                    panel.parentNode.insertBefore(bar, panel);
                }
            })
            .catch(function () {
                /* Sin red: no molestar */
            });
    }

    var abortControladorDashboard = null;
    var idCargaDashboard = 0;

    mostrarBannerSiBackendIncorrecto();

    setTimeout(function () {
        try {
            cargarDatos('dashboard');
        } catch (errDashIni) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('Panel admin — dashboard inicial:', errDashIni);
            }
        }
    }, 150);

    function badgeEstadoVehiculo(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'disponible') return 'badge badge--confirmada';
        if (e === 'reservado') return 'badge badge--asignada';
        if (e === 'mantenimiento') return 'badge badge--cancelada';
        return 'badge';
    }

    function etiquetaEstadoVehiculo(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'disponible') return 'Disponible';
        if (e === 'reservado') return 'Reservado';
        if (e === 'mantenimiento') return 'Mantenimiento';
        return estado || '—';
    }

    var cacheListaVehiculos = [];
    var vehiculosPaginaActual = 1;
    var VEHICULOS_POR_PAGINA = 5;

    function claseEstadoPillVehiculo(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'disponible') {
            return 'estado-pill estado-pill--activo';
        }
        if (e === 'reservado') {
            return 'estado-pill estado-pill--reservado';
        }
        if (e === 'mantenimiento') {
            return 'estado-pill estado-pill--inactivo';
        }
        return 'estado-pill';
    }

    function claseBadgeTipoVehiculo(tipo) {
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
        if (t === 'longibus' || t === 'omnibus' || t === 'ómnibus') {
            return 'badge-tipo badge-tipo--omnibus';
        }
        return 'badge-tipo';
    }

    function actualizarStatsVehiculos() {
        var lista = cacheListaVehiculos;
        var setNum = function (id, n) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = String(n);
            }
        };
        setNum('statVehTotal', lista.length);
        setNum(
            'statVehDisponibles',
            lista.filter(function (v) {
                return (v.estado || '').toLowerCase() === 'disponible';
            }).length
        );
        setNum(
            'statVehReservados',
            lista.filter(function (v) {
                return (v.estado || '').toLowerCase() === 'reservado';
            }).length
        );
        setNum(
            'statVehMantenimiento',
            lista.filter(function (v) {
                return (v.estado || '').toLowerCase() === 'mantenimiento';
            }).length
        );
    }

    function actualizarPaginacionVehiculos(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('vehiculosPaginacionInfo');
        var label = document.getElementById('vehiculosPaginaLabel');
        var btnPrev = document.getElementById('vehiculosPaginaPrev');
        var btnNext = document.getElementById('vehiculosPaginaNext');

        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 vehículos';
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

        var desde = inicioIdx + 1;
        var hasta = inicioIdx + cantEnPagina;
        if (info) {
            info.textContent =
                'Mostrando ' +
                desde +
                ' a ' +
                hasta +
                ' de ' +
                totalFiltrados +
                ' vehículos';
        }
        if (label) {
            label.textContent = String(vehiculosPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = vehiculosPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = vehiculosPaginaActual >= totalPaginas;
        }
    }

    function vehiculoCoincideFiltro(v, textoBusqueda, estadoFiltro, tipoFiltro) {
        var estado = (v.estado || '').toLowerCase();
        if (estadoFiltro && estado !== estadoFiltro.toLowerCase()) {
            return false;
        }
        var tipo = (v.tipo || '').trim();
        if (tipoFiltro) {
            var tf = tipoFiltro.toLowerCase();
            var tv = tipo.toLowerCase();
            var coincide =
                tv === tf ||
                (tf === 'omnibus' &&
                    (tv === 'ómnibus' || tv === 'longibus'));
            if (!coincide) {
                return false;
            }
        }
        var q = (textoBusqueda || '').trim().toLowerCase();
        if (!q) {
            return true;
        }
        var campos = [
            v.placa,
            v.tipo,
            v.marca,
            v.modelo,
            v.capacidad != null ? String(v.capacidad) : '',
            v.anio_fabricacion != null ? String(v.anio_fabricacion) : '',
            v.estado,
            etiquetaEstadoVehiculo(v.estado)
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function htmlFilaVehiculo(v) {
        var placaTxt = escapeHtml((v.placa || '—').toString().toUpperCase());
        var tipoRaw = (v.tipo || '').trim();
        var tipoTxt =
            tipoRaw.toLowerCase() === 'longibus'
                ? escapeHtml('Omnibus')
                : escapeHtml(tipoRaw || '—');
        var tipoClase = v.tipo ? claseBadgeTipoVehiculo(v.tipo) : '';
        var tipoHtml = tipoClase
            ? '<span class="' + tipoClase + '">' + tipoTxt + '</span>'
            : tipoTxt;
        var estClase = claseEstadoPillVehiculo(v.estado);
        var estTxt = escapeHtml(etiquetaEstadoVehiculo(v.estado));
        return (
            '<tr>' +
            '<td class="table-cell--placa">' +
            placaTxt +
            '</td>' +
            '<td>' +
            tipoHtml +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(v.marca || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(v.modelo || '—') +
            '</td>' +
            '<td>' +
            (v.capacidad != null ? escapeHtml(String(v.capacidad)) : '—') +
            '</td>' +
            '<td>' +
            (v.anio_fabricacion != null ? escapeHtml(String(v.anio_fabricacion)) : '—') +
            '</td>' +
            '<td><span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estTxt +
            '</span></td>' +
            '<td class="table__acciones-iconos">' +
            '<button type="button" class="btn--icon btn-vehiculo-editar" data-id="' +
            v.id_vehiculo +
            '" title="Editar" aria-label="Editar vehículo"><i class="fas fa-pen-to-square"></i></button>' +
            '<button type="button" class="btn--icon btn-vehiculo-eliminar" data-id="' +
            v.id_vehiculo +
            '" data-placa="' +
            escaparParaAtributoHtml(v.placa) +
            '" title="Eliminar" aria-label="Eliminar vehículo"><i class="fas fa-trash-can"></i></button>' +
            '</td>' +
            '</tr>'
        );
    }

    function renderTablaVehiculos() {
        var tbody = document.getElementById('tablaVehiculos');
        if (!tbody) {
            return;
        }
        var inputBuscar = document.getElementById('buscarVehiculo');
        var selEstado = document.getElementById('filtroEstadoVehiculo');
        var selTipo = document.getElementById('filtroTipoVehiculo');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var estadoF = selEstado ? selEstado.value : '';
        var tipoF = selTipo ? selTipo.value : '';

        actualizarStatsVehiculos();

        if (!cacheListaVehiculos.length) {
            tbody.innerHTML =
                '<tr><td colspan="8">No hay vehículos registrados.</td></tr>';
            actualizarPaginacionVehiculos(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheListaVehiculos.filter(function (v) {
            return vehiculoCoincideFiltro(v, texto, estadoF, tipoF);
        });

        if (!filtrados.length) {
            tbody.innerHTML =
                '<tr><td colspan="8">No hay vehículos que coincidan con la búsqueda.</td></tr>';
            actualizarPaginacionVehiculos(0, 0, 0, 1);
            return;
        }

        var totalPaginas = Math.max(
            1,
            Math.ceil(filtrados.length / VEHICULOS_POR_PAGINA)
        );
        if (vehiculosPaginaActual > totalPaginas) {
            vehiculosPaginaActual = totalPaginas;
        }
        if (vehiculosPaginaActual < 1) {
            vehiculosPaginaActual = 1;
        }

        var inicio = (vehiculosPaginaActual - 1) * VEHICULOS_POR_PAGINA;
        var pagina = filtrados.slice(inicio, inicio + VEHICULOS_POR_PAGINA);

        tbody.innerHTML = pagina.map(htmlFilaVehiculo).join('');
        actualizarPaginacionVehiculos(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var inputBuscarVehiculo = document.getElementById('buscarVehiculo');
    if (inputBuscarVehiculo) {
        inputBuscarVehiculo.addEventListener('input', function () {
            vehiculosPaginaActual = 1;
            renderTablaVehiculos();
        });
    }
    var filtroEstadoVehiculo = document.getElementById('filtroEstadoVehiculo');
    if (filtroEstadoVehiculo) {
        filtroEstadoVehiculo.addEventListener('change', function () {
            vehiculosPaginaActual = 1;
            renderTablaVehiculos();
        });
    }
    var filtroTipoVehiculo = document.getElementById('filtroTipoVehiculo');
    if (filtroTipoVehiculo) {
        filtroTipoVehiculo.addEventListener('change', function () {
            vehiculosPaginaActual = 1;
            renderTablaVehiculos();
        });
    }
    var btnVehPrev = document.getElementById('vehiculosPaginaPrev');
    if (btnVehPrev) {
        btnVehPrev.addEventListener('click', function () {
            if (vehiculosPaginaActual > 1) {
                vehiculosPaginaActual -= 1;
                renderTablaVehiculos();
            }
        });
    }
    var btnVehNext = document.getElementById('vehiculosPaginaNext');
    if (btnVehNext) {
        btnVehNext.addEventListener('click', function () {
            vehiculosPaginaActual += 1;
            renderTablaVehiculos();
        });
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

    function escapeHtml(valor) {
        if (valor === undefined || valor === null) {
            return '';
        }
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function badgeClaseEstadoReserva(estadoSlug) {
        var e = (estadoSlug || 'pendiente').toLowerCase();
        if (e === 'confirmada') {
            return 'badge badge--confirmada';
        }
        if (e === 'cancelada') {
            return 'badge badge--cancelada';
        }
        return 'badge badge--pendiente';
    }

    function etiquetaEstadoReservaHumana(estadoSlug) {
        var e = (estadoSlug || 'pendiente').toLowerCase();
        if (e === 'confirmada') {
            return 'Confirmada';
        }
        if (e === 'cancelada') {
            return 'Cancelada';
        }
        return 'Pendiente';
    }

    function badgeClaseEstadoViaje(estadoSlug) {
        var e = (estadoSlug || '').toLowerCase().replace(/\s+/g, '_');
        if (e === 'finalizado' || e === 'completado') {
            return 'badge badge--confirmada';
        }
        if (e === 'en_camino' || e === 'en camino') {
            return 'badge badge--asignada';
        }
        if (e === 'cancelado' || e === 'cancelada') {
            return 'badge badge--cancelada';
        }
        return 'badge badge--pendiente';
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


    function normalizarClaveEstadoViaje(estado) {
        return (estado || '').toLowerCase().replace(/\s+/g, '_');
    }

    function claseEstadoPillReserva(estado) {
        var e = (estado || 'pendiente').toLowerCase();
        if (e === 'confirmada') {
            return 'estado-pill estado-pill--activo';
        }
        if (e === 'cancelada') {
            return 'estado-pill estado-pill--inactivo';
        }
        return 'estado-pill estado-pill--pendiente';
    }

    function claseEstadoPillViaje(estado) {
        var e = normalizarClaveEstadoViaje(estado);
        if (e === 'finalizado' || e === 'completado') {
            return 'estado-pill estado-pill--activo';
        }
        if (e === 'en_camino') {
            return 'estado-pill estado-pill--reservado';
        }
        return 'estado-pill estado-pill--pendiente';
    }

    function claseBadgeRolUsuario(nombreRol) {
        var n = (nombreRol || '').toLowerCase();
        if (n.indexOf('admin') >= 0) {
            return 'badge-cargo badge-cargo--admin';
        }
        if (n.indexOf('asesor') >= 0) {
            return 'badge-cargo badge-cargo--asesor';
        }
        if (n.indexOf('conductor') >= 0) {
            return 'badge-cargo badge-cargo--conductor';
        }
        return 'badge-cargo';
    }

    function htmlFilaActividadDashboard(act) {
        var est = (act.estado_clave || act.estado || 'pendiente').toLowerCase();
        var esViaje = (act.tipo || '').toLowerCase() === 'viaje';
        var estClase = esViaje ? claseEstadoPillViaje(est) : claseEstadoPillReserva(est);
        var estTxt = act.estado || (esViaje
            ? etiquetaEstadoViajeHumano(est)
            : etiquetaEstadoReservaHumana(est));
        return (
            '<tr>' +
            '<td class="table-cell--codigo">' +
            escapeHtml(act.codigo || '—') +
            '</td>' +
            '<td class="table-cell--nombre">' +
            escapeHtml(act.cliente_nombre || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(act.origen || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(act.destino || '—') +
            '</td>' +
            '<td>' +
            escapeHtml(formatearIsoEnTexto(act.fecha_salida)) +
            '</td>' +
            '<td><span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            escapeHtml(estTxt) +
            '</span></td>' +
            '</tr>'
        );
    }

    var cacheActividadDashboard = [];
    var dashboardActividadPaginaActual = 1;
    var DASHBOARD_ACTIVIDAD_POR_PAGINA = 5;

    function actualizarPaginacionActividadDashboard(
        totalFiltrados,
        inicioIdx,
        cantEnPagina,
        totalPaginas
    ) {
        var info = document.getElementById('dashboardActividadPaginacionInfo');
        var label = document.getElementById('dashboardActividadPaginaLabel');
        var btnPrev = document.getElementById('dashboardActividadPaginaPrev');
        var btnNext = document.getElementById('dashboardActividadPaginaNext');

        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 actividades';
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
                ' actividades';
        }
        if (label) {
            label.textContent = String(dashboardActividadPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = dashboardActividadPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = dashboardActividadPaginaActual >= totalPaginas;
        }
    }

    function renderActividadDashboard() {
        var tbodySr = document.getElementById('tablaUltimasReservas');
        if (!tbodySr) {
            return;
        }

        if (!cacheActividadDashboard.length) {
            tbodySr.innerHTML =
                '<tr><td colspan="6">Aún no hay actividad registrada.</td></tr>';
            actualizarPaginacionActividadDashboard(0, 0, 0, 1);
            return;
        }

        var total = cacheActividadDashboard.length;
        var totalPaginas = Math.max(
            1,
            Math.ceil(total / DASHBOARD_ACTIVIDAD_POR_PAGINA)
        );
        if (dashboardActividadPaginaActual > totalPaginas) {
            dashboardActividadPaginaActual = totalPaginas;
        }
        if (dashboardActividadPaginaActual < 1) {
            dashboardActividadPaginaActual = 1;
        }

        var inicio = (dashboardActividadPaginaActual - 1) * DASHBOARD_ACTIVIDAD_POR_PAGINA;
        var pagina = cacheActividadDashboard.slice(
            inicio,
            inicio + DASHBOARD_ACTIVIDAD_POR_PAGINA
        );

        tbodySr.innerHTML = pagina.map(htmlFilaActividadDashboard).join('');
        actualizarPaginacionActividadDashboard(
            total,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var btnDashActPrev = document.getElementById('dashboardActividadPaginaPrev');
    if (btnDashActPrev) {
        btnDashActPrev.addEventListener('click', function () {
            if (dashboardActividadPaginaActual > 1) {
                dashboardActividadPaginaActual -= 1;
                renderActividadDashboard();
            }
        });
    }
    var btnDashActNext = document.getElementById('dashboardActividadPaginaNext');
    if (btnDashActNext) {
        btnDashActNext.addEventListener('click', function () {
            dashboardActividadPaginaActual += 1;
            renderActividadDashboard();
        });
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

    var cacheListaReservas = [];
    var reservasPaginaActual = 1;
    var RESERVAS_POR_PAGINA = 5;

    function actualizarStatsReservas() {
        var lista = cacheListaReservas;
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
    }

    function actualizarPaginacionReservas(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('reservasPaginacionInfo');
        var label = document.getElementById('reservasPaginaLabel');
        var btnPrev = document.getElementById('reservasPaginaPrev');
        var btnNext = document.getElementById('reservasPaginaNext');
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

    function reservaCoincideFiltro(rv, textoBusqueda, estadoFiltro) {
        var estado = (rv.estado || 'pendiente').toLowerCase();
        if (estadoFiltro && estado !== estadoFiltro.toLowerCase()) {
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
            etiquetaEstadoReservaHumana(rv.estado)
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function htmlFilaReservaAdmin(rv) {
        var est = (rv.estado || 'pendiente').toLowerCase();
        var codDat = escaparParaAtributoHtml(rv.codigo_reserva || '');
        var estClase = claseEstadoPillReserva(est);
        var estTxt = escapeHtml(etiquetaEstadoReservaHumana(est));
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
        return (
            '<tr>' +
            '<td class="table-cell--codigo">' +
            escapeHtml(rv.codigo_reserva || '—') +
            '</td>' +
            '<td class="table-cell--nombre">' +
            escapeHtml(formatearNombrePersona(rv.cliente_nombre) || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(rv.cliente_dni || '—') +
            '</td>' +
            telTd +
            '<td class="table-cell--muted">' +
            escapeHtml(rv.origen || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(rv.destino || '—') +
            '</td>' +
            '<td>' +
            escapeHtml(rv.cantidad_pasajeros != null ? String(rv.cantidad_pasajeros) : '—') +
            '</td>' +
            '<td class="table-cell--monto">' +
            escapeHtml(formatearSolesPEN(rv.precio_total)) +
            '</td>' +
            '<td><span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estTxt +
            '</span></td>' +
            '<td class="table__acciones-iconos">' +
            '<button type="button" class="btn--icon btn-reserva-editar" data-id="' +
            rv.id_reserva +
            '" title="Editar" aria-label="Editar reserva"><i class="fas fa-pen-to-square"></i></button>' +
            '<button type="button" class="btn--icon btn-reserva-eliminar" data-id="' +
            rv.id_reserva +
            '" data-codigo="' +
            codDat +
            '" title="Eliminar" aria-label="Eliminar reserva"><i class="fas fa-trash-can"></i></button>' +
            '</td>' +
            '</tr>'
        );
    }

    function renderTablaReservas() {
        var tbodyR = document.getElementById('tablaReservas');
        if (!tbodyR) {
            return;
        }
        var inputBuscar = document.getElementById('buscarReservaAdmin');
        var selEstado = document.getElementById('filtroEstadoReserva');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var estadoF = selEstado ? selEstado.value : '';

        actualizarStatsReservas();

        if (!cacheListaReservas.length) {
            tbodyR.innerHTML =
                '<tr><td colspan="10">No hay reservas registradas.</td></tr>';
            actualizarPaginacionReservas(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheListaReservas.filter(function (rv) {
            return reservaCoincideFiltro(rv, texto, estadoF);
        });

        if (!filtrados.length) {
            tbodyR.innerHTML =
                '<tr><td colspan="10">No hay reservas que coincidan con la búsqueda.</td></tr>';
            actualizarPaginacionReservas(0, 0, 0, 1);
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
        tbodyR.innerHTML = pagina.map(htmlFilaReservaAdmin).join('');
        actualizarPaginacionReservas(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var inputBuscarReservaAdmin = document.getElementById('buscarReservaAdmin');
    if (inputBuscarReservaAdmin) {
        inputBuscarReservaAdmin.addEventListener('input', function () {
            reservasPaginaActual = 1;
            renderTablaReservas();
        });
    }
    var filtroEstadoReservaEl = document.getElementById('filtroEstadoReserva');
    if (filtroEstadoReservaEl) {
        filtroEstadoReservaEl.addEventListener('change', function () {
            reservasPaginaActual = 1;
            renderTablaReservas();
        });
    }
    var btnResPrev = document.getElementById('reservasPaginaPrev');
    if (btnResPrev) {
        btnResPrev.addEventListener('click', function () {
            if (reservasPaginaActual > 1) {
                reservasPaginaActual -= 1;
                renderTablaReservas();
            }
        });
    }
    var btnResNext = document.getElementById('reservasPaginaNext');
    if (btnResNext) {
        btnResNext.addEventListener('click', function () {
            reservasPaginaActual += 1;
            renderTablaReservas();
        });
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
        document.getElementById('reservaEditId').value = String(r.id_reserva);
        var titCli = document.getElementById('reservaModalTituloCliente');
        if (titCli) {
            titCli.textContent = tituloEditarReservaCliente(
                r.cliente_nombre,
                r.cliente_dni,
                r.cliente_telefono
            );
        }

        document.getElementById('reservaEditPasajeros').value =
            r.cantidad_pasajeros != null ? String(r.cantidad_pasajeros) : '1';

        document.getElementById('reservaEditOrigen').value = r.origen || '';
        document.getElementById('reservaEditDestino').value = r.destino || '';

        document.getElementById('reservaEditFechaPartida').value = isoParaDatetimeLocal(
            r.fecha_partida
        );

        var retIso = r.fecha_retorno;
        document.getElementById('reservaHadRetornoInicial').value = retIso ? '1' : '';

        document.getElementById('reservaEditFechaRetorno').value = retIso
            ? isoParaDatetimeLocal(retIso)
            : '';

        var st = (r.estado || 'pendiente').toLowerCase();
        if (!['pendiente', 'confirmada', 'cancelada'].includes(st)) {
            st = 'pendiente';
        }
        document.getElementById('reservaEditEstado').value = st;

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
            precIni.value =
                pnGuardado != null && pnGuardado > 0 ? String(pnGuardado) : '';
        }
        if (precInp) {
            precInp.value =
                pnGuardado != null && pnGuardado > 0 ? String(pnGuardado) : '';
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
        document.getElementById('eliminarReservaId').value = String(idRes);
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

    function refrescarTrasCambioReservaAdmin() {
        var secR = document.getElementById('reservas');
        if (secR && secR.classList.contains('section--active')) {
            cargarDatos('reservas');
        }
        var secD = document.getElementById('dashboard');
        if (secD && secD.classList.contains('section--active')) {
            cargarDatos('dashboard');
        }
    }

    document.getElementById('tablaReservas').addEventListener('click', function (e) {
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

    document.getElementById('btnGuardarReservaEditar').addEventListener('click', function () {
        var hid = document.getElementById('reservaEditId');
        var idRes = hid && hid.value ? hid.value.trim() : '';
        if (!idRes) return;

        var form = document.getElementById('formReservaEditar');
        limpiarErrorReservaFormulario();
        if (!form) {
            return;
        }
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var pas = parseInt(document.getElementById('reservaEditPasajeros').value, 10);
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
                pintarErrorReserva('Monto no válido (número mayor o igual a 0).');
                return;
            }
            cuerpo.precio_total = montoRes;
        }

        var teniaIni = document.getElementById('reservaHadRetornoInicial').value === '1';
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
                refrescarTrasCambioReservaAdmin();
            })
            .catch(function () {
                pintarErrorReserva('No se pudo conectar con el servidor.');
            })
            .finally(function () {
                btnGr.disabled = false;
                btnGr.textContent = txtOg;
            });
    });

    document.getElementById('btnConfirmEliminarReserva').addEventListener('click', function () {
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
                    if (hid) hid.value = '';
                    refrescarTrasCambioReservaAdmin();
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

    var btnNuevaReservaAdm = document.getElementById('btnNuevaReservaAdmin');
    if (btnNuevaReservaAdm) {
        btnNuevaReservaAdm.addEventListener('click', function () {
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
                    mostrarModalReservaCreadaExito(cod);
                    if (document.getElementById('reservas').classList.contains('section--active')) {
                        cargarDatos('reservas');
                    }
                    if (document.getElementById('dashboard').classList.contains('section--active')) {
                        cargarDatos('dashboard');
                    }
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

    var cacheListaUsuarios = [];
    var usuariosPaginaActual = 1;
    var USUARIOS_POR_PAGINA = 5;

    /** Prioridad de listado: administradores, asesores, conductores, otros. */
    function prioridadRolUsuarioOrden(nombreRolBd) {
        var n = (nombreRolBd || '').toLowerCase();
        if (n.indexOf('admin') >= 0) {
            return 0;
        }
        if (n.indexOf('asesor') >= 0) {
            return 1;
        }
        if (n.indexOf('conductor') >= 0) {
            return 2;
        }
        return 3;
    }

    /** Clave para filtro por rol (misma lógica que el orden). */
    function categoriaRolUsuarioFiltro(nombreRolBd) {
        var n = (nombreRolBd || '').toLowerCase();
        if (n.indexOf('admin') >= 0) {
            return 'admin';
        }
        if (n.indexOf('asesor') >= 0) {
            return 'asesor';
        }
        if (n.indexOf('conductor') >= 0) {
            return 'conductor';
        }
        return 'otro';
    }

    function ordenarUsuariosPanel(lista) {
        return lista.slice().sort(function (a, b) {
            var pa = prioridadRolUsuarioOrden(a.nombre_rol);
            var pb = prioridadRolUsuarioOrden(b.nombre_rol);
            if (pa !== pb) {
                return pa - pb;
            }
            var na = String(a.nombre_usuario || '').toLowerCase();
            var nb = String(b.nombre_usuario || '').toLowerCase();
            if (na < nb) {
                return -1;
            }
            if (na > nb) {
                return 1;
            }
            return (Number(a.id_usuario) || 0) - (Number(b.id_usuario) || 0);
        });
    }

    function usuarioCoincideFiltro(u, textoBusqueda, estadoFiltro, rolFiltro) {
        if (rolFiltro && categoriaRolUsuarioFiltro(u.nombre_rol) !== rolFiltro) {
            return false;
        }
        var activo = u.estado === true;
        if (estadoFiltro === 'activo' && !activo) {
            return false;
        }
        if (estadoFiltro === 'inactivo' && activo) {
            return false;
        }
        var q = (textoBusqueda || '').trim().toLowerCase();
        if (!q) {
            return true;
        }
        var campos = [
            u.nombre_usuario,
            u.correo,
            u.nombre_rol,
            rotuloRolPanel(u.nombre_rol),
            u.nombre_empleado
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function actualizarPaginacionUsuarios(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('usuariosPaginacionInfo');
        var label = document.getElementById('usuariosPaginaLabel');
        var btnPrev = document.getElementById('usuariosPaginaPrev');
        var btnNext = document.getElementById('usuariosPaginaNext');
        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 usuarios';
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
                ' usuarios';
        }
        if (label) {
            label.textContent = String(usuariosPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = usuariosPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = usuariosPaginaActual >= totalPaginas;
        }
    }

    function htmlFilaUsuario(u) {
        var activo = u.estado === true;
        var estClase = activo ? 'estado-pill estado-pill--activo' : 'estado-pill estado-pill--inactivo';
        var estTxt = etiquetaEstadoEmpleado(u.estado);
        var rolClase = claseBadgeRolUsuario(u.nombre_rol);
        var rolTxt = escapeHtml(rotuloRolPanel(u.nombre_rol));
        var mismoSesion =
            idUsuarioEnSesion != null && Number(u.id_usuario) === idUsuarioEnSesion;
        var loginEscAttr = escaparParaAtributoHtml(u.nombre_usuario || '');
        var btnElim = mismoSesion
            ? '<button type="button" class="btn--icon btn-usuario-eliminar" disabled title="No puedes eliminar tu propia cuenta" aria-label="Eliminar usuario no disponible" style="opacity:0.35;cursor:not-allowed"><i class="fas fa-trash-can"></i></button>'
            : '<button type="button" class="btn--icon btn-usuario-eliminar" data-id="' +
              u.id_usuario +
              '" data-login="' +
              loginEscAttr +
              '" title="Eliminar" aria-label="Eliminar usuario"><i class="fas fa-trash-can"></i></button>';
        return (
            '<tr>' +
            '<td class="table-cell--codigo">' +
            escapeHtml(String(u.nombre_usuario || '').trim() || '—') +
            '</td>' +
            '<td class="table-cell--muted">' +
            escapeHtml(String(u.correo || '')) +
            '</td>' +
            '<td><span class="' +
            rolClase +
            '">' +
            rolTxt +
            '</span></td>' +
            '<td class="table-cell--nombre">' +
            escapeHtml(u.nombre_empleado || '—') +
            '</td>' +
            '<td><span class="' +
            estClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estTxt +
            '</span></td>' +
            '<td class="table__acciones-iconos">' +
            '<button type="button" class="btn--icon btn-usuario-editar" data-id="' +
            u.id_usuario +
            '" title="Editar" aria-label="Editar usuario"><i class="fas fa-pen-to-square"></i></button>' +
            btnElim +
            '</td>' +
            '</tr>'
        );
    }

    function renderTablaUsuarios() {
        var tbodyUsuario = document.getElementById('tablaUsuarios');
        if (!tbodyUsuario) {
            return;
        }
        var inputBuscar = document.getElementById('buscarUsuarioAdmin');
        var selEstado = document.getElementById('filtroEstadoUsuario');
        var selRol = document.getElementById('filtroRolUsuario');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var estadoF = selEstado ? selEstado.value : '';
        var rolF = selRol ? selRol.value : '';

        if (!cacheListaUsuarios.length) {
            tbodyUsuario.innerHTML = '<tr><td colspan="6">Ningún usuario registrado.</td></tr>';
            actualizarPaginacionUsuarios(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheListaUsuarios.filter(function (u) {
            return usuarioCoincideFiltro(u, texto, estadoF, rolF);
        });

        filtrados = ordenarUsuariosPanel(filtrados);

        if (!filtrados.length) {
            tbodyUsuario.innerHTML =
                '<tr><td colspan="6">No hay usuarios que coincidan con la búsqueda.</td></tr>';
            actualizarPaginacionUsuarios(0, 0, 0, 1);
            return;
        }

        var totalPaginas = Math.max(1, Math.ceil(filtrados.length / USUARIOS_POR_PAGINA));
        if (usuariosPaginaActual > totalPaginas) {
            usuariosPaginaActual = totalPaginas;
        }
        if (usuariosPaginaActual < 1) {
            usuariosPaginaActual = 1;
        }
        var inicio = (usuariosPaginaActual - 1) * USUARIOS_POR_PAGINA;
        var pagina = filtrados.slice(inicio, inicio + USUARIOS_POR_PAGINA);
        tbodyUsuario.innerHTML = pagina.map(htmlFilaUsuario).join('');
        actualizarPaginacionUsuarios(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var inputBuscarUsuarioAdmin = document.getElementById('buscarUsuarioAdmin');
    if (inputBuscarUsuarioAdmin) {
        inputBuscarUsuarioAdmin.addEventListener('input', function () {
            usuariosPaginaActual = 1;
            renderTablaUsuarios();
        });
    }
    var filtroEstadoUsuario = document.getElementById('filtroEstadoUsuario');
    if (filtroEstadoUsuario) {
        filtroEstadoUsuario.addEventListener('change', function () {
            usuariosPaginaActual = 1;
            renderTablaUsuarios();
        });
    }
    var filtroRolUsuario = document.getElementById('filtroRolUsuario');
    if (filtroRolUsuario) {
        filtroRolUsuario.addEventListener('change', function () {
            usuariosPaginaActual = 1;
            renderTablaUsuarios();
        });
    }
    var btnUsrPrev = document.getElementById('usuariosPaginaPrev');
    if (btnUsrPrev) {
        btnUsrPrev.addEventListener('click', function () {
            if (usuariosPaginaActual > 1) {
                usuariosPaginaActual -= 1;
                renderTablaUsuarios();
            }
        });
    }
    var btnUsrNext = document.getElementById('usuariosPaginaNext');
    if (btnUsrNext) {
        btnUsrNext.addEventListener('click', function () {
            usuariosPaginaActual += 1;
            renderTablaUsuarios();
        });
    }

    function abrirConfirmEliminarVehiculo(id, placa) {
        var ocultoId = document.getElementById('eliminarVehiculoId');
        if (ocultoId) ocultoId.value = String(id);
        var p = document.getElementById('eliminarVehiculoMensaje');
        var placaTxt = placa ? String(placa).trim() : '';
        if (p) {
            if (placaTxt) {
                p.textContent =
                    '¿Estás seguro de que quieres eliminar el vehículo con placa ' +
                    placaTxt +
                    '?';
            } else {
                p.textContent = '¿Estás seguro de que quieres eliminar este vehículo?';
            }
        }
        abrirModal('modalConfirmEliminarVehiculo');
    }

    var CAPACIDAD_POR_TIPO = {
        Minivan: 10,
        Van: 20,
        Coaster: 30,
        Omnibus: 50
    };

    function limpiarErroresFormVehiculo() {
        var placaErr = document.getElementById('vehiculoPlacaError');
        var formErr = document.getElementById('vehiculoFormError');
        var placaInp = document.getElementById('vehiculoPlaca');
        if (placaErr) {
            placaErr.textContent = '';
            placaErr.classList.remove('form-group__error--visible');
        }
        if (formErr) {
            formErr.textContent = '';
            formErr.classList.remove('form-group__error--visible');
        }
        if (placaInp) {
            placaInp.classList.remove('form-group__input--error');
        }
    }

    function actualizarCapacidadPorTipo() {
        var sel = document.getElementById('vehiculoTipo');
        var cap = document.getElementById('vehiculoCapacidad');
        if (!sel || !cap) return;
        var t = sel.value;
        if (t && CAPACIDAD_POR_TIPO[t] !== undefined) {
            cap.value = String(CAPACIDAD_POR_TIPO[t]);
        } else {
            cap.value = '';
        }
    }

    var vehiculoTipoSelect = document.getElementById('vehiculoTipo');
    var vehiculoAnioInput = document.getElementById('vehiculoAnio');
    if (vehiculoAnioInput) {
        var y = new Date().getFullYear();
        vehiculoAnioInput.min = 1970;
        vehiculoAnioInput.max = y + 1;
    }
    if (vehiculoTipoSelect) {
        vehiculoTipoSelect.addEventListener('change', actualizarCapacidadPorTipo);
    }

    function prepararModalNuevoVehiculo() {
        limpiarErroresFormVehiculo();
        var editId = document.getElementById('vehiculoEditId');
        if (editId) editId.value = '';
        var titulo = document.getElementById('vehiculoModalTitulo');
        if (titulo) titulo.textContent = 'Nuevo vehículo';
        var form = document.getElementById('formVehiculo');
        if (form) form.reset();
        actualizarCapacidadPorTipo();
        var estadoEl = document.getElementById('vehiculoEstado');
        if (estadoEl) estadoEl.value = 'disponible';
    }

    function rellenarFormularioVehiculo(v) {
        var editId = document.getElementById('vehiculoEditId');
        if (editId) editId.value = v.id_vehiculo;
        var titulo = document.getElementById('vehiculoModalTitulo');
        if (titulo) titulo.textContent = 'Editar vehículo';
        document.getElementById('vehiculoPlaca').value = v.placa || '';
        var tipoForm = v.tipo || '';
        var tl = tipoForm.toLowerCase();
        if (tl === 'longibus') {
            tipoForm = 'Omnibus';
        }
        document.getElementById('vehiculoTipo').value = tipoForm;
        document.getElementById('vehiculoCapacidad').value =
            v.capacidad != null ? String(v.capacidad) : '';
        document.getElementById('vehiculoMarca').value = v.marca || '';
        document.getElementById('vehiculoModelo').value = v.modelo || '';
        document.getElementById('vehiculoAnio').value =
            v.anio_fabricacion != null ? String(v.anio_fabricacion) : '';
        document.getElementById('vehiculoEstado').value =
            (v.estado || 'disponible').toLowerCase();
        limpiarErroresFormVehiculo();
    }

    var ROTULO_CARGO_EMPLEADO = {
        administrador: 'Administrador',
        asesor_ventas: 'Asesor de ventas',
        conductor: 'Conductor'
    };

    function rotuloCargoEmp(cargoSlug) {
        return cargoSlug && ROTULO_CARGO_EMPLEADO[cargoSlug]
            ? ROTULO_CARGO_EMPLEADO[cargoSlug]
            : cargoSlug || '—';
    }

    function badgeEstadoEmpleado(estadoBool) {
        return estadoBool ? 'badge badge--confirmada' : 'badge badge--cancelada';
    }

    function etiquetaEstadoEmpleado(estadoBool) {
        return estadoBool ? 'Activo' : 'Inactivo';
    }

    var cacheListaEmpleados = [];
    var empleadosPaginaActual = 1;
    var EMPLEADOS_POR_PAGINA = 5;

    function nombreCompletoEmpleado(emp) {
        return ((emp.nombre || '') + ' ' + (emp.apellido || '')).trim();
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

    function claseBadgeCargoEmpleado(cargo) {
        var c = (cargo || '').toLowerCase();
        if (c === 'administrador') {
            return 'badge-cargo badge-cargo--admin';
        }
        if (c === 'asesor_ventas') {
            return 'badge-cargo badge-cargo--asesor';
        }
        if (c === 'conductor') {
            return 'badge-cargo badge-cargo--conductor';
        }
        return 'badge-cargo';
    }

    function actualizarStatsEmpleados() {
        var lista = cacheListaEmpleados;
        var setNum = function (id, n) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = String(n);
            }
        };
        setNum('statEmpTotal', lista.length);
        setNum(
            'statEmpAdmin',
            lista.filter(function (e) {
                return (e.cargo || '').toLowerCase() === 'administrador';
            }).length
        );
        setNum(
            'statEmpAsesor',
            lista.filter(function (e) {
                return (e.cargo || '').toLowerCase() === 'asesor_ventas';
            }).length
        );
        setNum(
            'statEmpConductores',
            lista.filter(function (e) {
                return (e.cargo || '').toLowerCase() === 'conductor' && e.estado === true;
            }).length
        );
    }

    function actualizarPaginacionEmpleados(totalFiltrados, inicioIdx, cantEnPagina, totalPaginas) {
        var info = document.getElementById('empleadosPaginacionInfo');
        var label = document.getElementById('empleadosPaginaLabel');
        var btnPrev = document.getElementById('empleadosPaginaPrev');
        var btnNext = document.getElementById('empleadosPaginaNext');

        if (!totalFiltrados) {
            if (info) {
                info.textContent = 'Mostrando 0 empleados';
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

        var desde = inicioIdx + 1;
        var hasta = inicioIdx + cantEnPagina;
        if (info) {
            info.textContent =
                'Mostrando ' +
                desde +
                ' a ' +
                hasta +
                ' de ' +
                totalFiltrados +
                ' empleados';
        }
        if (label) {
            label.textContent = String(empleadosPaginaActual);
        }
        if (btnPrev) {
            btnPrev.disabled = empleadosPaginaActual <= 1;
        }
        if (btnNext) {
            btnNext.disabled = empleadosPaginaActual >= totalPaginas;
        }
    }

    function empleadoCoincideFiltro(emp, textoBusqueda, cargoFiltro) {
        var cargo = (emp.cargo || '').toLowerCase();
        if (cargoFiltro && cargo !== cargoFiltro.toLowerCase()) {
            return false;
        }
        var q = (textoBusqueda || '').trim().toLowerCase();
        if (!q) {
            return true;
        }
        var campos = [
            emp.nombre,
            emp.apellido,
            emp.dni,
            emp.telefono,
            emp.email,
            emp.cargo,
            rotuloCargoEmp(emp.cargo),
            emp.licencia,
            nombreCompletoEmpleado(emp)
        ];
        return campos.some(function (c) {
            return String(c || '')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function htmlFilaEmpleado(emp) {
        var esCond = emp.cargo === 'conductor';
        var licTxt = esCond
            ? escapeHtml(
                  emp.licencia && String(emp.licencia).trim() !== ''
                      ? String(emp.licencia).trim()
                      : '—'
              )
            : '—';
        var activo = emp.estado === true;
        var estadoClase = activo ? 'estado-pill estado-pill--activo' : 'estado-pill estado-pill--inactivo';
        var estadoTxt = etiquetaEstadoEmpleado(emp.estado);
        var nomData = escaparParaAtributoHtml((emp.nombre || '').trim());
        var apeData = escaparParaAtributoHtml((emp.apellido || '').trim());
        var nombreTxt = escapeHtml(formatearNombrePersona(emp.nombre) || '—');
        var apellidoTxt = escapeHtml(formatearNombrePersona(emp.apellido) || '—');
        return (
            '<tr>' +
            '<td class="table-cell--nombre">' +
            nombreTxt +
            '</td>' +
            '<td class="table-cell--apellido">' +
            apellidoTxt +
            '</td>' +
            '<td>' +
            escapeHtml(String(emp.dni || '')) +
            '</td>' +
            '<td>' +
            escapeHtml(String(emp.telefono || '')) +
            '</td>' +
            '<td><span class="' +
            claseBadgeCargoEmpleado(emp.cargo) +
            '">' +
            escapeHtml(rotuloCargoEmp(emp.cargo)) +
            '</span></td>' +
            '<td>' +
            licTxt +
            '</td>' +
            '<td><span class="' +
            estadoClase +
            '"><span class="estado-pill__dot" aria-hidden="true"></span>' +
            estadoTxt +
            '</span></td>' +
            '<td class="table__acciones-iconos">' +
            '<button type="button" class="btn--icon btn-empleado-editar" data-id="' +
            emp.id_empleado +
            '" title="Editar" aria-label="Editar empleado"><i class="fas fa-pen-to-square"></i></button>' +
            '<button type="button" class="btn--icon btn-empleado-eliminar" data-id="' +
            emp.id_empleado +
            '" data-nombre="' +
            nomData +
            '" data-apellido="' +
            apeData +
            '" title="Eliminar" aria-label="Eliminar empleado"><i class="fas fa-trash-can"></i></button>' +
            '</td>' +
            '</tr>'
        );
    }

    function renderTablaEmpleados() {
        var tbodyEmp = document.getElementById('tablaEmpleados');
        if (!tbodyEmp) {
            return;
        }
        var inputBuscar = document.getElementById('buscarEmpleado');
        var selCargo = document.getElementById('filtroCargoEmpleado');
        var texto = inputBuscar ? inputBuscar.value.trim() : '';
        var cargoF = selCargo ? selCargo.value : '';

        actualizarStatsEmpleados();

        if (!cacheListaEmpleados.length) {
            tbodyEmp.innerHTML =
                '<tr><td colspan="8">Ningún empleado registrado.</td></tr>';
            actualizarPaginacionEmpleados(0, 0, 0, 1);
            return;
        }

        var filtrados = cacheListaEmpleados.filter(function (emp) {
            return empleadoCoincideFiltro(emp, texto, cargoF);
        });

        if (!filtrados.length) {
            tbodyEmp.innerHTML =
                '<tr><td colspan="8">No hay empleados que coincidan con la búsqueda.</td></tr>';
            actualizarPaginacionEmpleados(0, 0, 0, 1);
            return;
        }

        var totalPaginas = Math.max(
            1,
            Math.ceil(filtrados.length / EMPLEADOS_POR_PAGINA)
        );
        if (empleadosPaginaActual > totalPaginas) {
            empleadosPaginaActual = totalPaginas;
        }
        if (empleadosPaginaActual < 1) {
            empleadosPaginaActual = 1;
        }

        var inicio = (empleadosPaginaActual - 1) * EMPLEADOS_POR_PAGINA;
        var pagina = filtrados.slice(inicio, inicio + EMPLEADOS_POR_PAGINA);

        tbodyEmp.innerHTML = pagina.map(htmlFilaEmpleado).join('');
        actualizarPaginacionEmpleados(
            filtrados.length,
            inicio,
            pagina.length,
            totalPaginas
        );
    }

    var inputBuscarEmpleado = document.getElementById('buscarEmpleado');
    if (inputBuscarEmpleado) {
        inputBuscarEmpleado.addEventListener('input', function () {
            empleadosPaginaActual = 1;
            renderTablaEmpleados();
        });
    }
    var filtroCargoEmpleado = document.getElementById('filtroCargoEmpleado');
    if (filtroCargoEmpleado) {
        filtroCargoEmpleado.addEventListener('change', function () {
            empleadosPaginaActual = 1;
            renderTablaEmpleados();
        });
    }
    var btnEmpPrev = document.getElementById('empleadosPaginaPrev');
    if (btnEmpPrev) {
        btnEmpPrev.addEventListener('click', function () {
            if (empleadosPaginaActual > 1) {
                empleadosPaginaActual -= 1;
                renderTablaEmpleados();
            }
        });
    }
    var btnEmpNext = document.getElementById('empleadosPaginaNext');
    if (btnEmpNext) {
        btnEmpNext.addEventListener('click', function () {
            empleadosPaginaActual += 1;
            renderTablaEmpleados();
        });
    }

    function limpiarErroresFormEmpleado() {
        var dn = document.getElementById('empleadoDniError');
        var fe = document.getElementById('empleadoFormError');
        var di = document.getElementById('empleadoDni');
        if (dn) {
            dn.textContent = '';
            dn.classList.remove('form-group__error--visible');
        }
        if (fe) {
            fe.textContent = '';
            fe.classList.remove('form-group__error--visible');
        }
        if (di) {
            di.classList.remove('form-group__input--error');
        }
    }

    function validarDniEmpleadoValor(valor) {
        var dni = (valor || '').trim();
        if (!dni) {
            return 'El DNI es obligatorio.';
        }
        if (!/^\d+$/.test(dni)) {
            return 'El DNI solo debe contener números.';
        }
        if (dni.length !== 8) {
            return 'El DNI debe tener 8 dígitos.';
        }
        return null;
    }

    function validarTelefonoEmpValor(valor) {
        var t = (valor || '').trim();
        if (!t) {
            return 'El teléfono es obligatorio.';
        }
        if (!/^\d{9}$/.test(t)) {
            return 'El teléfono debe tener 9 dígitos.';
        }
        return null;
    }

    function formatoLicenciaConductorValido(valor) {
        return /^[A-Z]{2}-\d{4}$/.test((valor || '').trim());
    }

    /** Dos letras (mayúsc.) + guión + cuatro dígitos; fuerza formato al escribir. */
    function normalizarLicenciaAlEscribir(elLic) {
        if (!elLic) {
            return;
        }
        var raw = elLic.value.toUpperCase();
        var letters = '';
        var digits = '';
        for (var i = 0; i < raw.length; i++) {
            var c = raw.charAt(i);
            if (/[A-Z]/.test(c) && letters.length < 2 && digits.length === 0) {
                letters += c;
                continue;
            }
            if (/\d/.test(c) && letters.length === 2 && digits.length < 4) {
                digits += c;
            }
        }
        elLic.value = digits.length > 0 ? letters + '-' + digits : letters;
    }

    function configurarLicenciaPorCargoEmp() {
        var cargo = document.getElementById('empleadoCargo');
        var grp = document.getElementById('empleadoGrupoLicencia');
        var lic = document.getElementById('empleadoLicencia');
        if (!cargo || !grp || !lic) {
            return;
        }
        var esCond = cargo.value === 'conductor';
        grp.hidden = !esCond;
        lic.required = esCond;
        if (!esCond) {
            lic.value = '';
        }
    }

    var emCargoSelGlobal = document.getElementById('empleadoCargo');
    if (emCargoSelGlobal) {
        emCargoSelGlobal.addEventListener('change', configurarLicenciaPorCargoEmp);
    }

    var empDniErr = document.getElementById('empleadoDniError');
    var empDni = document.getElementById('empleadoDni');
    if (empDni && empDniErr) {
        empDni.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 8);
            if (!this.value || validarDniEmpleadoValor(this.value) === null) {
                empDniErr.textContent = '';
                empDniErr.classList.remove('form-group__error--visible');
                this.classList.remove('form-group__input--error');
            }
        });
        empDni.addEventListener('blur', function () {
            var mensaje = validarDniEmpleadoValor(this.value);
            if (mensaje) {
                empDniErr.textContent = mensaje;
                empDniErr.classList.add('form-group__error--visible');
                this.classList.add('form-group__input--error');
            }
        });
    }

    var empTel = document.getElementById('empleadoTelefono');
    if (empTel) {
        empTel.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 9);
        });
    }

    var empLicInp = document.getElementById('empleadoLicencia');
    if (empLicInp) {
        empLicInp.addEventListener('input', function () {
            normalizarLicenciaAlEscribir(this);
        });
    }

    function prepararModalNuevoEmpleado() {
        limpiarErroresFormEmpleado();
        var hid = document.getElementById('empleadoEditId');
        if (hid) {
            hid.value = '';
        }
        var tit = document.getElementById('empleadoModalTitulo');
        if (tit) {
            tit.textContent = 'Nuevo empleado';
        }
        var f = document.getElementById('formEmpleado');
        if (f) {
            f.reset();
        }
        var car = document.getElementById('empleadoCargo');
        if (car) {
            car.value = 'administrador';
        }
        var estEl = document.getElementById('empleadoEstado');
        if (estEl) {
            estEl.value = 'true';
        }
        configurarLicenciaPorCargoEmp();
    }

    function rellenarFormularioEmpleado(emp) {
        document.getElementById('empleadoEditId').value = emp.id_empleado;
        document.getElementById('empleadoModalTitulo').textContent = 'Editar empleado';
        document.getElementById('empleadoNombre').value = emp.nombre || '';
        document.getElementById('empleadoApellido').value = emp.apellido || '';
        document.getElementById('empleadoDni').value = emp.dni || '';
        document.getElementById('empleadoTelefono').value = emp.telefono || '';
        document.getElementById('empleadoCargo').value = emp.cargo || 'administrador';
        var licCampo = document.getElementById('empleadoLicencia');
        licCampo.value = emp.licencia || '';
        normalizarLicenciaAlEscribir(licCampo);
        document.getElementById('empleadoEstado').value = emp.estado ? 'true' : 'false';
        limpiarErroresFormEmpleado();
        configurarLicenciaPorCargoEmp();
    }

    function abrirConfirmEliminarEmpleado(idEmp, nombre, apellido) {
        var ocultoId = document.getElementById('eliminarEmpleadoId');
        if (ocultoId) {
            ocultoId.value = String(idEmp);
        }
        var n = (nombre || '').trim();
        var a = (apellido || '').trim();
        var txt = (n + ' ' + a).trim();
        var p = document.getElementById('eliminarEmpleadoMensaje');
        if (p) {
            p.textContent =
                txt.length > 0
                    ? '¿Estás seguro de que quieres eliminar a ' + txt + '?'
                    : '¿Estás seguro de que quieres eliminar a este empleado?';
        }
        abrirModal('modalConfirmEliminarEmpleado');
    }

    function rotuloRolPanel(nombreRolBd) {
        var n = (nombreRolBd || '').toLowerCase().trim();
        if (n === 'admin' || n === 'administrador') {
            return 'Administrador';
        }
        if (n === 'asesor' || n === 'asesor de ventas') {
            return 'Asesor de ventas';
        }
        if (n === 'conductor') {
            return 'Conductor';
        }
        return nombreRolBd ? String(nombreRolBd) : '—';
    }

    function limpiarErrorUsuarioFormulario() {
        var ef = document.getElementById('usuarioFormError');
        if (ef) {
            ef.textContent = '';
            ef.classList.remove('form-group__error--visible');
        }
    }

    function mensajeValidacionCorreoUsuario(correoBruto) {
        var correoTrim = (correoBruto || '').trim();
        if (!correoTrim) {
            return 'Correo obligatorio.';
        }
        var ar = correoTrim.indexOf('@');
        if (ar < 0) {
            return 'Correo incorrecto. Ejemplo: diego@busesya';
        }
        var local = correoTrim.slice(0, ar).trim();
        var dominio = correoTrim.slice(ar + 1).trim();
        if (!local || !dominio) {
            return 'Correo incorrecto. Ejemplo: diego@busesya';
        }
        var domL = dominio.toLowerCase();
        if (domL.indexOf('.') === -1 && domL !== 'busesya') {
            return 'Correo incorrecto. Ejemplo: diego@busesya (o usar dominio con punto).';
        }
        return null;
    }

    function poblarSelectRolesUsuario(selRol, idPreSeleccionar) {
        if (!selRol) {
            return Promise.resolve();
        }
        selRol.innerHTML = '<option value="">Cargando roles…</option>';
        selRol.disabled = true;
        return fetchApi(urlBackend('/api/roles'), { headers: headersAuthJSON() })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                selRol.disabled = false;
                if (result.status === 401) {
                    cerrarSesion();
                    return;
                }
                selRol.innerHTML = '<option value="">Seleccionar rol…</option>';
                if (!result.ok) {
                    selRol.innerHTML +=
                        '<option value="" disabled>' +
                        escapeHtml(mensajeErrorApi(result.data)) +
                        '</option>';
                    return;
                }
                var listaRol = Array.isArray(result.data) ? result.data : [];
                listaRol = listaRol.slice().sort(function (a, b) {
                    return (a.id_rol || 0) - (b.id_rol || 0);
                });
                listaRol.forEach(function (rol) {
                    selRol.innerHTML +=
                        '<option value="' +
                        rol.id_rol +
                        '">' +
                        escapeHtml(rotuloRolPanel(rol.nombre_rol)) +
                        '</option>';
                });
                if (
                    idPreSeleccionar != null &&
                    idPreSeleccionar !== '' &&
                    !Number.isNaN(Number(idPreSeleccionar))
                ) {
                    selRol.value = String(idPreSeleccionar);
                }
            })
            .catch(function () {
                selRol.disabled = false;
                selRol.innerHTML = '<option value="">Sin conexión — roles</option>';
            });
    }

    function poblarSelectEmpleadosSinCuenta(selEmp) {
        if (!selEmp) {
            return Promise.resolve();
        }
        selEmp.innerHTML = '<option value="">Cargando…</option>';
        selEmp.disabled = true;
        return fetchApi(urlBackend('/api/empleados?solo_sin_cuenta_sistema=true'), {
            headers: headersAuthJSON()
        })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                selEmp.disabled = false;
                if (result.status === 401) {
                    cerrarSesion();
                    return;
                }
                selEmp.innerHTML = '<option value="">Seleccionar…</option>';
                if (!result.ok) {
                    selEmp.innerHTML =
                        '<option value="">' +
                        escapeHtml(mensajeErrorApi(result.data)) +
                        '</option>';
                    return;
                }
                var listaEmp = Array.isArray(result.data) ? result.data : [];
                if (!listaEmp.length) {
                    selEmp.innerHTML +=
                        '<option value="" disabled>No hay empleados sin cuenta. Créalos antes en Empleados.</option>';
                } else {
                    listaEmp.forEach(function (emp) {
                        var txt = (
                            (emp.nombre || '').trim() +
                            ' ' +
                            (emp.apellido || '').trim() +
                            ' · ' +
                            rotuloCargoEmp(emp.cargo)
                        ).trim();
                        selEmp.innerHTML +=
                            '<option value="' +
                            emp.id_empleado +
                            '">' +
                            escapeHtml(txt) +
                            '</option>';
                    });
                }
            })
            .catch(function () {
                selEmp.disabled = false;
                selEmp.innerHTML = '<option value="">Sin conexión — empleados</option>';
            });
    }

    function cargarOpcionesModalUsuarioCreacion() {
        var selEmp = document.getElementById('usuarioEmpleado');
        var selRol = document.getElementById('usuarioIdRol');
        return Promise.all([
            poblarSelectEmpleadosSinCuenta(selEmp),
            poblarSelectRolesUsuario(selRol)
        ]);
    }

    function setBloqueEmpleadoUsuarioModalVisible(visible) {
        var bloCre = document.getElementById('usuarioBloqueEmpCreacion');
        if (!bloCre) return;
        if (visible) {
            bloCre.removeAttribute('hidden');
            bloCre.style.display = '';
        } else {
            bloCre.setAttribute('hidden', '');
            bloCre.style.display = 'none';
        }
    }

    function prepararModalNuevoUsuario() {
        limpiarErrorUsuarioFormulario();
        var hidEd = document.getElementById('usuarioEditId');
        if (hidEd) {
            hidEd.value = '';
        }
        var titUsuario = document.getElementById('usuarioModalTitulo');
        if (titUsuario) {
            titUsuario.textContent = 'Nuevo usuario del sistema';
        }
        setBloqueEmpleadoUsuarioModalVisible(true);
        var selEmpuesto = document.getElementById('usuarioEmpleado');
        if (selEmpuesto) selEmpuesto.required = true;

        var lp = document.getElementById('usuarioLabelPassword');
        if (lp) lp.textContent = 'Contraseña inicial';

        var formU = document.getElementById('formUsuario');
        if (formU) {
            formU.reset();
        }
        var pass = document.getElementById('usuarioPassword');
        pass.value = '';
        pass.required = true;
        pass.setAttribute('minlength', '6');
        pass.removeAttribute('placeholder');

        var grupoEstUsuario = document.getElementById('usuarioGrupoEstado');
        if (grupoEstUsuario) {
            grupoEstUsuario.setAttribute('hidden', '');
        }

        cargarOpcionesModalUsuarioCreacion();
    }

    function aplicarEstadoUsuarioEnModal(datosUsuario) {
        var selEst = document.getElementById('usuarioEstado');
        if (!selEst) {
            return;
        }
        var activo = datosUsuario.estado !== false;
        selEst.value = activo ? 'true' : 'false';
        var mismoSesion =
            idUsuarioEnSesion != null &&
            Number(datosUsuario.id_usuario) === idUsuarioEnSesion;
        if (mismoSesion) {
            selEst.value = 'true';
            selEst.disabled = true;
        } else {
            selEst.disabled = false;
        }
    }

    function rellenarUsuarioParaEdicion(datosUsuario) {
        limpiarErrorUsuarioFormulario();
        document.getElementById('usuarioEditId').value = String(datosUsuario.id_usuario);

        document.getElementById('usuarioModalTitulo').textContent = 'EDITAR USUARIO';

        setBloqueEmpleadoUsuarioModalVisible(false);

        document.getElementById('usuarioEmpleado').required = false;

        document.getElementById('usuarioNombre').value = datosUsuario.nombre_usuario || '';
        document.getElementById('usuarioCorreo').value = datosUsuario.correo || '';

        document.getElementById('usuarioPassword').value = '';
        document.getElementById('usuarioPassword').removeAttribute('required');
        document.getElementById('usuarioPassword').removeAttribute('minlength');
        document.getElementById('usuarioPassword').placeholder = 'Vacío si no cambia';

        var lpEd = document.getElementById('usuarioLabelPassword');
        if (lpEd) lpEd.textContent = 'Contraseña (opcional)';

        poblarSelectRolesUsuario(document.getElementById('usuarioIdRol'), datosUsuario.id_rol);

        var grupoEstUsuario = document.getElementById('usuarioGrupoEstado');
        if (grupoEstUsuario) {
            grupoEstUsuario.removeAttribute('hidden');
        }
        aplicarEstadoUsuarioEnModal(datosUsuario);
    }

    function abrirConfirmEliminarUsuario(idUsu, textoLogin) {
        var hid = document.getElementById('eliminarUsuarioId');
        if (hid) {
            hid.value = String(idUsu);
        }
        var p = document.getElementById('eliminarUsuarioMensaje');
        var t = (textoLogin || '').trim();
        if (p) {
            p.textContent =
                t.length > 0
                    ? '¿Eliminar el usuario «' + t + '» y quitarle el acceso?'
                    : '¿Eliminar este usuario del sistema?';
        }
        abrirModal('modalConfirmEliminarUsuario');
    }

    // ============================================
    // NAVEGACIÓN ENTRE SECCIONES
    // ============================================
    const navItems = document.querySelectorAll('.panel__nav-item');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('pageTitle');

    const titulos = {
        dashboard: 'Dashboard',
        reservas: 'Reservas',
        vehiculos: 'Vehículos',
        empleados: 'Empleados',
        usuarios: 'Usuarios del Sistema'
    };

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.dataset.section;

            // Activar nav
            navItems.forEach(n => n.classList.remove('panel__nav-item--active'));
            this.classList.add('panel__nav-item--active');

            // Mostrar sección
            sections.forEach(s => s.classList.remove('section--active'));
            document.getElementById(sectionId).classList.add('section--active');

            // Cambiar título
            pageTitle.textContent = titulos[sectionId] || 'Panel';

            // Cargar datos
            cargarDatos(sectionId);
        });
    });

    // ============================================
    // CERRAR SESIÓN
    // ============================================
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // ============================================
    // MODALES
    // ============================================
    function abrirModal(id) {
        document.getElementById(id).classList.add('modal-panel--active');
    }

    function cerrarModal(id) {
        document.getElementById(id).classList.remove('modal-panel--active');
    }

    function mostrarModalReservaCreadaExito(codigoReserva) {
        var pMsg = document.getElementById('reservaCreadaExitoMensaje');
        var pCod = document.getElementById('reservaCreadaExitoCodigo');
        if (!pMsg || !pCod) {
            return;
        }
        var cod = (codigoReserva || '').trim();
        if (cod) {
            pMsg.textContent =
                'La reserva quedó registrada en el sistema. Puedes anotar o compartir el código con el cliente.';
            pCod.textContent = cod;
            pCod.hidden = false;
        } else {
            pMsg.textContent = 'La reserva quedó registrada correctamente.';
            pCod.textContent = '';
            pCod.hidden = true;
        }
        abrirModal('modalReservaCreadaExito');
    }

    // Botones abrir modal
    document.getElementById('btnNuevoVehiculo').addEventListener('click', function () {
        prepararModalNuevoVehiculo();
        abrirModal('modalVehiculo');
    });
    document.getElementById('btnNuevoEmpleado').addEventListener('click', function () {
        prepararModalNuevoEmpleado();
        abrirModal('modalEmpleado');
    });
    document.getElementById('btnNuevoUsuario').addEventListener('click', function () {
        prepararModalNuevoUsuario();
        abrirModal('modalUsuario');
    });

    // Botones cerrar modal
    document.querySelectorAll('.modal-panel__close, [data-modal]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const modalId = this.dataset.modal || this.closest('.modal-panel').id;
            cerrarModal(modalId);
        });
    });

    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.modal-panel').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this) cerrarModal(this.id);
        });
    });

    // ============================================
    // GUARDAR VEHÍCULO
    // ============================================
    document.getElementById('btnGuardarVehiculo').addEventListener('click', function () {
        var form = document.getElementById('formVehiculo');
        var btn = this;
        limpiarErroresFormVehiculo();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var tipo = document.getElementById('vehiculoTipo').value;
        if (!tipo) {
            var fe0 = document.getElementById('vehiculoFormError');
            if (fe0) {
                fe0.textContent = 'Selecciona el tipo de bus.';
                fe0.classList.add('form-group__error--visible');
            }
            return;
        }

        var capacidad = parseInt(document.getElementById('vehiculoCapacidad').value, 10);
        var anio = parseInt(document.getElementById('vehiculoAnio').value, 10);
        var modeloVal = document.getElementById('vehiculoModelo').value.trim();

        var payload = {
            placa: document.getElementById('vehiculoPlaca').value.trim(),
            tipo: tipo,
            marca: document.getElementById('vehiculoMarca').value.trim(),
            modelo: modeloVal || null,
            capacidad: capacidad,
            anio_fabricacion: anio,
            estado: document.getElementById('vehiculoEstado').value || 'disponible'
        };

        var editId = document.getElementById('vehiculoEditId');
        var esEdicion = editId && editId.value;

        var textoBtn = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Guardando…';

        var peticion;
        if (esEdicion) {
            peticion = fetchApi(urlBackend('/api/vehiculos/' + encodeURIComponent(editId.value)), {
                method: 'PATCH',
                headers: headersAuthJSON(),
                body: JSON.stringify(payload)
            });
        } else {
            peticion = fetchApi(urlBackend('/api/vehiculos'), {
                method: 'POST',
                headers: headersAuthJSON(),
                body: JSON.stringify(payload)
            });
        }

        peticion
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, status: response.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        alert('Sesión expirada. Vuelve a iniciar sesión.');
                        cerrarSesion();
                        return;
                    }
                    var msg = mensajeErrorApi(result.data);
                    var formErrEl = document.getElementById('vehiculoFormError');
                    if (/placa/i.test(msg)) {
                        var pe = document.getElementById('vehiculoPlacaError');
                        if (pe) {
                            pe.textContent = msg;
                            pe.classList.add('form-group__error--visible');
                        }
                        var placaInp = document.getElementById('vehiculoPlaca');
                        if (placaInp) placaInp.classList.add('form-group__input--error');
                    } else if (formErrEl) {
                        formErrEl.textContent = msg;
                        formErrEl.classList.add('form-group__error--visible');
                    }
                    return;
                }
                cerrarModal('modalVehiculo');
                form.reset();
                if (document.getElementById('vehiculoEditId')) {
                    document.getElementById('vehiculoEditId').value = '';
                }
                if (document.getElementById('vehiculoModalTitulo')) {
                    document.getElementById('vehiculoModalTitulo').textContent = 'Nuevo vehículo';
                }
                actualizarCapacidadPorTipo();
                if (document.getElementById('vehiculos').classList.contains('section--active')) {
                    cargarDatos('vehiculos');
                }
            })
            .catch(function () {
                var fe = document.getElementById('vehiculoFormError');
                if (fe) {
                    fe.textContent = 'No se pudo conectar con el servidor.';
                    fe.classList.add('form-group__error--visible');
                }
            })
            .finally(function () {
                btn.disabled = false;
                btn.textContent = textoBtn;
            });
    });

    document.getElementById('tablaVehiculos').addEventListener('click', function (e) {
        var editar = e.target.closest('.btn-vehiculo-editar');
        var elim = e.target.closest('.btn-vehiculo-eliminar');
        if (editar && editar.dataset.id) {
            var idEd = editar.dataset.id;
            limpiarErroresFormVehiculo();
            fetchApi(urlBackend('/api/vehiculos/' + encodeURIComponent(idEd)), {
                headers: headersAuthJSON()
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, status: response.status, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            cerrarSesion();
                            return;
                        }
                        alert(mensajeErrorApi(result.data));
                        return;
                    }
                    rellenarFormularioVehiculo(result.data);
                    abrirModal('modalVehiculo');
                })
                .catch(function () {
                    alert('No se pudo cargar el vehículo.');
                });
            return;
        }
        if (elim && elim.dataset.id) {
            abrirConfirmEliminarVehiculo(elim.dataset.id, elim.dataset.placa);
        }
    });

    document.getElementById('btnConfirmEliminarVehiculo').addEventListener('click', function () {
        var oculto = document.getElementById('eliminarVehiculoId');
        var idElim = oculto && oculto.value;
        var btnConfirm = this;
        if (!idElim) {
            cerrarModal('modalConfirmEliminarVehiculo');
            return;
        }
        btnConfirm.disabled = true;
        fetchApi(urlBackend('/api/vehiculos/' + encodeURIComponent(idElim)), {
            method: 'DELETE',
            headers: headersAuthJSON()
        })
            .then(function (response) {
                if (response.status === 401) {
                    cerrarModal('modalConfirmEliminarVehiculo');
                    cerrarSesion();
                    return Promise.resolve();
                }
                if (response.status === 204) {
                    cerrarModal('modalConfirmEliminarVehiculo');
                    if (oculto) oculto.value = '';
                    if (document.getElementById('vehiculos').classList.contains('section--active')) {
                        cargarDatos('vehiculos');
                    }
                    return Promise.resolve();
                }
                return response.json().then(function (data) {
                    if (!response.ok) {
                        cerrarModal('modalConfirmEliminarVehiculo');
                        alert(mensajeErrorApi(data));
                    }
                });
            })
            .catch(function () {
                cerrarModal('modalConfirmEliminarVehiculo');
                alert('No se pudo conectar con el servidor.');
            })
            .finally(function () {
                btnConfirm.disabled = false;
            });
    });

    // ============================================
    // GUARDAR EMPLEADO
    // ============================================
    document.getElementById('btnGuardarEmpleado').addEventListener('click', function () {
        var form = document.getElementById('formEmpleado');
        var btn = this;
        limpiarErroresFormEmpleado();
        configurarLicenciaPorCargoEmp();

        var dniImp = document.getElementById('empleadoDni');
        var errDniTxt = validarDniEmpleadoValor(dniImp ? dniImp.value : '');
        if (errDniTxt) {
            var dne = document.getElementById('empleadoDniError');
            if (dne) {
                dne.textContent = errDniTxt;
                dne.classList.add('form-group__error--visible');
            }
            if (dniImp) dniImp.classList.add('form-group__input--error');
            if (dniImp) dniImp.focus();
            return;
        }

        var telImp = document.getElementById('empleadoTelefono');
        var errTelTxt = validarTelefonoEmpValor(telImp ? telImp.value : '');
        if (errTelTxt) {
            var fe = document.getElementById('empleadoFormError');
            if (fe) {
                fe.textContent = errTelTxt;
                fe.classList.add('form-group__error--visible');
            }
            if (telImp) telImp.focus();
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var cargo = document.getElementById('empleadoCargo').value;
        var licVal =
            cargo === 'conductor'
                ? document.getElementById('empleadoLicencia').value.trim()
                : null;
        if (cargo === 'conductor' && !formatoLicenciaConductorValido(licVal)) {
            var feLic = document.getElementById('empleadoFormError');
            if (feLic) {
                feLic.textContent =
                    'La licencia debe ser dos letras mayúsculas, guión y cuatro números (ej. AB-0000).';
                feLic.classList.add('form-group__error--visible');
            }
            document.getElementById('empleadoLicencia').focus();
            return;
        }

        var payload = {
            nombre: document.getElementById('empleadoNombre').value.trim(),
            apellido: document.getElementById('empleadoApellido').value.trim(),
            dni: document.getElementById('empleadoDni').value.trim(),
            telefono: document.getElementById('empleadoTelefono').value.trim(),
            email: null,
            cargo: cargo,
            licencia: licVal,
            estado: document.getElementById('empleadoEstado').value === 'true'
        };

        var editHidden = document.getElementById('empleadoEditId');
        var esEdicionEmp = editHidden && editHidden.value;

        var textoBtnEmp = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Guardando…';

        var promesaEmp;
        if (esEdicionEmp) {
            promesaEmp = fetch(
                urlBackend('/api/empleados/' + encodeURIComponent(editHidden.value)),
                {
                    method: 'PATCH',
                    headers: headersAuthJSON(),
                    body: JSON.stringify(payload)
                }
            );
        } else {
            promesaEmp = fetchApi(urlBackend('/api/empleados'), {
                method: 'POST',
                headers: headersAuthJSON(),
                body: JSON.stringify(payload)
            });
        }

        promesaEmp
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, status: response.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        alert('Sesión expirada. Vuelve a iniciar sesión.');
                        cerrarSesion();
                        return;
                    }
                    var msg = mensajeErrorApi(result.data);
                    var fe = document.getElementById('empleadoFormError');
                    if (/dni/i.test(msg) || /DNI/i.test(msg)) {
                        var dnE = document.getElementById('empleadoDniError');
                        if (dnE) {
                            dnE.textContent = msg;
                            dnE.classList.add('form-group__error--visible');
                        }
                        document.getElementById('empleadoDni').classList.add(
                            'form-group__input--error'
                        );
                    } else if (fe) {
                        fe.textContent = msg;
                        fe.classList.add('form-group__error--visible');
                    }
                    return;
                }
                cerrarModal('modalEmpleado');
                form.reset();
                if (editHidden) editHidden.value = '';
                var titMp = document.getElementById('empleadoModalTitulo');
                if (titMp) titMp.textContent = 'Nuevo empleado';
                limpiarErroresFormEmpleado();
                configurarLicenciaPorCargoEmp();
                if (document.getElementById('empleados').classList.contains('section--active')) {
                    cargarDatos('empleados');
                }
            })
            .catch(function () {
                var feConn = document.getElementById('empleadoFormError');
                if (feConn) {
                    feConn.textContent = 'No se pudo conectar con el servidor.';
                    feConn.classList.add('form-group__error--visible');
                }
            })
            .finally(function () {
                btn.disabled = false;
                btn.textContent = textoBtnEmp;
            });
    });

    document.getElementById('tablaEmpleados').addEventListener('click', function (e) {
        var ed = e.target.closest('.btn-empleado-editar');
        var elimEm = e.target.closest('.btn-empleado-eliminar');
        if (ed && ed.dataset.id) {
            limpiarErroresFormEmpleado();
            fetchApi(urlBackend('/api/empleados/' + encodeURIComponent(ed.dataset.id)), {
                headers: headersAuthJSON()
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, status: response.status, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            cerrarSesion();
                            return;
                        }
                        alert(mensajeErrorApi(result.data));
                        return;
                    }
                    rellenarFormularioEmpleado(result.data);
                    abrirModal('modalEmpleado');
                })
                .catch(function () {
                    alert('No se pudo cargar el empleado.');
                });
            return;
        }
        if (elimEm && elimEm.dataset.id) {
            abrirConfirmEliminarEmpleado(
                elimEm.dataset.id,
                elimEm.dataset.nombre || '',
                elimEm.dataset.apellido || ''
            );
        }
    });

    document.getElementById('btnConfirmEliminarEmpleado').addEventListener('click', function () {
        var ocultoEmp = document.getElementById('eliminarEmpleadoId');
        var idElimEmp = ocultoEmp && ocultoEmp.value;
        var btnCx = this;
        if (!idElimEmp) {
            cerrarModal('modalConfirmEliminarEmpleado');
            return;
        }
        btnCx.disabled = true;
        fetchApi(urlBackend('/api/empleados/' + encodeURIComponent(idElimEmp)), {
            method: 'DELETE',
            headers: headersAuthJSON()
        })
            .then(function (response) {
                if (response.status === 401) {
                    cerrarModal('modalConfirmEliminarEmpleado');
                    cerrarSesion();
                    return Promise.resolve();
                }
                if (response.status === 204) {
                    cerrarModal('modalConfirmEliminarEmpleado');
                    if (ocultoEmp) ocultoEmp.value = '';
                    if (document.getElementById('empleados').classList.contains('section--active')) {
                        cargarDatos('empleados');
                    }
                    return Promise.resolve();
                }
                return response.json().then(function (data) {
                    if (!response.ok) {
                        cerrarModal('modalConfirmEliminarEmpleado');
                        alert(mensajeErrorApi(data));
                    }
                });
            })
            .catch(function () {
                cerrarModal('modalConfirmEliminarEmpleado');
                alert('No se pudo conectar con el servidor.');
            })
            .finally(function () {
                btnCx.disabled = false;
            });
    });

    // ============================================
    // GUARDAR USUARIO
    // ============================================
    document.getElementById('btnGuardarUsuario').addEventListener('click', function () {
        var form = document.getElementById('formUsuario');
        var boton = this;
        limpiarErrorUsuarioFormulario();

        var mueErr = document.getElementById('usuarioFormError');
        function pintar(msg) {
            if (mueErr) {
                mueErr.textContent = msg;
                mueErr.classList.add('form-group__error--visible');
            }
        }

        var idEditOculto = (
            document.getElementById('usuarioEditId') &&
            document.getElementById('usuarioEditId').value.trim()
        ) || '';
        var esEdicion = idEditOculto.length > 0;

        var nombreUsuarioVal = document.getElementById('usuarioNombre').value.trim();
        if (!nombreUsuarioVal) {
            pintar('Escribe el nombre de usuario.');
            return;
        }

        var correoVal = document.getElementById('usuarioCorreo').value.trim();
        var corrMsgCliente = mensajeValidacionCorreoUsuario(correoVal);
        if (corrMsgCliente) {
            pintar(corrMsgCliente);
            document.getElementById('usuarioCorreo').focus();
            return;
        }

        var idRolStr = document.getElementById('usuarioIdRol').value;
        if (!idRolStr) {
            pintar('Selecciona un rol.');
            return;
        }
        var idRolNum = parseInt(idRolStr, 10);
        if (!idRolNum) {
            pintar('Rol no válido.');
            return;
        }

        var selEmpleadoEl = document.getElementById('usuarioEmpleado');
        var idEmpStr = '';
        if (!esEdicion) {
            idEmpStr = selEmpleadoEl ? selEmpleadoEl.value : '';
            if (!idEmpStr) {
                pintar('Selecciona un empleado de la lista.');
                return;
            }
        }

        var passRaw = document.getElementById('usuarioPassword').value;
        if (!esEdicion) {
            if (!passRaw || passRaw.length < 6) {
                pintar('La contraseña debe tener al menos 6 caracteres.');
                document.getElementById('usuarioPassword').focus();
                return;
            }
        } else if (passRaw && passRaw.trim().length < 6) {
            pintar('Si cambias contraseña, debe tener al menos 6 caracteres.');
            document.getElementById('usuarioPassword').focus();
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var url = '';
        var metodo = '';
        var cuerpo = null;

        if (esEdicion) {
            metodo = 'PATCH';
            url = urlBackend('/api/usuarios/' + encodeURIComponent(idEditOculto));
            var selEstadoUsuario = document.getElementById('usuarioEstado');
            var estadoUsuarioVal =
                selEstadoUsuario && selEstadoUsuario.value === 'false' ? false : true;
            cuerpo = {
                nombre_usuario: nombreUsuarioVal,
                correo: correoVal,
                id_rol: idRolNum,
                estado: estadoUsuarioVal
            };
            if (
                idUsuarioEnSesion != null &&
                Number(idEditOculto) === idUsuarioEnSesion &&
                estadoUsuarioVal === false
            ) {
                pintar('No puedes desactivar tu propia cuenta.');
                return;
            }
            if (passRaw && passRaw.trim().length >= 6) {
                cuerpo.password = passRaw;
            }
        } else {
            metodo = 'POST';
            url = urlBackend('/api/usuarios');
            cuerpo = {
                id_empleado: parseInt(idEmpStr, 10),
                nombre_usuario: nombreUsuarioVal,
                correo: correoVal,
                password: passRaw,
                id_rol: idRolNum
            };
        }

        var textoBotonGu = boton.textContent;
        boton.disabled = true;
        boton.textContent = 'Guardando…';

        fetch(url, {
            method: metodo,
            headers: headersAuthJSON(),
            body: JSON.stringify(cuerpo)
        })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        alert('Sesión expirada. Vuelve a iniciar sesión.');
                        cerrarSesion();
                        return;
                    }
                    var textoApi = mensajeErrorApi(result.data);
                    var extra =
                        /correo|email/i.test(textoApi) ?
                            '' :
                            (result.status === 422 ?
                                '\nEjemplo correo válido: diego@busesya' :
                                '');
                    pintar(textoApi + extra);
                    return;
                }
                cerrarModal('modalUsuario');
                form.reset();
                if (document.getElementById('usuarios').classList.contains('section--active')) {
                    cargarDatos('usuarios');
                }
            })
            .catch(function () {
                pintar('No se pudo conectar con el servidor.');
            })
            .finally(function () {
                boton.disabled = false;
                boton.textContent = textoBotonGu;
            });
    });

    document.getElementById('tablaUsuarios').addEventListener('click', function (e) {
        var btEd = e.target.closest('.btn-usuario-editar');
        var btElim = e.target.closest('.btn-usuario-eliminar');
        if (btEd && btEd.dataset.id) {
            limpiarErrorUsuarioFormulario();
            fetchApi(urlBackend('/api/usuarios/' + encodeURIComponent(btEd.dataset.id)), {
                headers: headersAuthJSON()
            })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            cerrarSesion();
                            return;
                        }
                        alert(mensajeErrorApi(result.data));
                        return;
                    }
                    rellenarUsuarioParaEdicion(result.data);
                    abrirModal('modalUsuario');
                })
                .catch(function () {
                    alert('No se pudo cargar el usuario.');
                });
            return;
        }
        if (btElim && btElim.dataset.id) {
            abrirConfirmEliminarUsuario(
                btElim.dataset.id,
                btElim.dataset.login || ''
            );
        }
    });

    document.getElementById('btnConfirmEliminarUsuario').addEventListener('click', function () {
        var hid = document.getElementById('eliminarUsuarioId');
        var idDel = hid && hid.value;
        var btnConf = this;
        if (!idDel) {
            cerrarModal('modalConfirmEliminarUsuario');
            return;
        }
        btnConf.disabled = true;
        fetchApi(urlBackend('/api/usuarios/' + encodeURIComponent(idDel)), {
            method: 'DELETE',
            headers: headersAuthJSON()
        })
            .then(function (response) {
                if (response.status === 401) {
                    cerrarModal('modalConfirmEliminarUsuario');
                    cerrarSesion();
                    return Promise.resolve();
                }
                if (response.status === 204) {
                    cerrarModal('modalConfirmEliminarUsuario');
                    if (hid) hid.value = '';
                    if (document.getElementById('usuarios').classList.contains('section--active')) {
                        cargarDatos('usuarios');
                    }
                    return Promise.resolve();
                }
                return interpretarRespuestaApi(response).then(function (r) {
                    cerrarModal('modalConfirmEliminarUsuario');
                    alert(mensajeErrorApi(r.data));
                });
            })
            .catch(function () {
                cerrarModal('modalConfirmEliminarUsuario');
                alert('No se pudo conectar con el servidor.');
            })
            .finally(function () {
                btnConf.disabled = false;
            });
    });

    // ============================================
    // CARGAR DATOS (simulado)
    // ============================================
    function cargarDatos(seccion) {
        // TODO: Reemplazar con fetch real a FastAPI

        if (seccion === 'dashboard') {
            if (abortControladorDashboard) {
                abortControladorDashboard.abort();
            }
            abortControladorDashboard =
                typeof AbortController !== 'undefined' ? new AbortController() : null;
            var idPeticionDashboard = ++idCargaDashboard;

            var mesLbl = document.getElementById('dashboardMesLabel');
            if (mesLbl) {
                mesLbl.textContent =
                    new Date().toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    });
            }

            var idsDash = [
                'statReservasHoy',
                'statReservasMes',
                'statPendientes',
                'statConfirmadas',
                'statIngresosMes',
                'statViajesActivos',
                'statViajesCompletados',
                'statVehiculosDisponibles'
            ];
            idsDash.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) {
                    el.textContent = '—';
                }
            });

            var tbodySr = document.getElementById('tablaUltimasReservas');
            if (tbodySr) {
                tbodySr.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
            }

            var optsDash = { headers: headersAuthJSON() };
            if (abortControladorDashboard) {
                optsDash.signal = abortControladorDashboard.signal;
            }

            fetchApi(urlBackend('/api/admin/dashboard'), optsDash, 45000)
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (idPeticionDashboard !== idCargaDashboard) {
                        return;
                    }
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        idsDash.forEach(function (id) {
                            var el = document.getElementById(id);
                            if (el) {
                                el.textContent = '—';
                            }
                        });
                        if (tbodySr) {
                            tbodySr.innerHTML =
                            '<tr><td colspan="6">' +
                            escapeHtml(mensajeErrorApi(result.data)) +
                            '</td></tr>';
                        }
                        return;
                    }
                    var d = result.data || {};
                    var setNum = function (id, v) {
                        var el = document.getElementById(id);
                        if (el) {
                            el.textContent =
                                v !== undefined && v !== null && !isNaN(Number(v)) ?
                                    String(Number(v)) :
                                    '0';
                        }
                    };
                    setNum('statReservasHoy', d.reservas_hoy);
                    setNum('statReservasMes', d.reservas_mes);
                    setNum('statPendientes', d.reservas_pendientes);
                    setNum('statConfirmadas', d.reservas_confirmadas);
                    var ingEl = document.getElementById('statIngresosMes');
                    if (ingEl) {
                        ingEl.textContent = formatearSolesPEN(d.ingresos_mes_soles);
                    }
                    setNum('statViajesActivos', d.viajes_activos);
                    setNum('statViajesCompletados', d.viajes_completados);
                    setNum('statVehiculosDisponibles', d.vehiculos_disponibles);

                    cacheActividadDashboard = Array.isArray(d.actividad_reciente)
                        ? d.actividad_reciente
                        : [];
                    dashboardActividadPaginaActual = 1;
                    renderActividadDashboard();
                })
                .catch(function (errFetch) {
                    if (errFetch && errFetch.name === 'AbortError') {
                        return;
                    }
                    if (idPeticionDashboard !== idCargaDashboard) {
                        return;
                    }
                    if (typeof console !== 'undefined' && console.error) {
                        console.error('Dashboard resumen:', errFetch);
                    }
                    idsDash.forEach(function (id) {
                        var el = document.getElementById(id);
                        if (el) {
                            el.textContent = '—';
                        }
                    });
                    if (tbodySr) {
                        var msgRed =
                            typeof mensajeErrorRedFetch === 'function' ?
                                mensajeErrorRedFetch(errFetch) :
                                'No se pudo cargar el resumen.';
                        tbodySr.innerHTML =
                            '<tr><td colspan="6">' +
                            escapeHtml(msgRed) +
                            '</td></tr>';
                    }
                });
        }

        if (seccion === 'vehiculos') {
            var tbodyVeh = document.getElementById('tablaVehiculos');
            tbodyVeh.innerHTML = '<tr><td colspan="8">Cargando…</td></tr>';

            fetchApi(urlBackend('/api/vehiculos'), { headers: headersAuthJSON() })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        tbodyVeh.innerHTML =
                            '<tr><td colspan="8">' + mensajeErrorApi(result.data) + '</td></tr>';
                        return;
                    }
                    cacheListaVehiculos = Array.isArray(result.data) ? result.data : [];
                    vehiculosPaginaActual = 1;
                    renderTablaVehiculos();
                })
                .catch(function (errFetch) {
                    var msgRed =
                        typeof mensajeErrorRedFetch === 'function' ?
                            mensajeErrorRedFetch(errFetch) :
                            'No se pudo conectar con el servidor.';
                    tbodyVeh.innerHTML =
                        '<tr><td colspan="8">' + escapeHtml(msgRed) + '</td></tr>';
                });
        }

        if (seccion === 'empleados') {
            var tbodyEmp = document.getElementById('tablaEmpleados');
            tbodyEmp.innerHTML = '<tr><td colspan="8">Cargando…</td></tr>';

            fetchApi(urlBackend('/api/empleados'), { headers: headersAuthJSON() })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        tbodyEmp.innerHTML =
                            '<tr><td colspan="8">' +
                            escapeHtml(mensajeErrorApi(result.data)) +
                            '</td></tr>';
                        return;
                    }
                    cacheListaEmpleados = Array.isArray(result.data) ? result.data : [];
                    empleadosPaginaActual = 1;
                    renderTablaEmpleados();
                })
                .catch(function (errFetch) {
                    var msgRed =
                        typeof mensajeErrorRedFetch === 'function' ?
                            mensajeErrorRedFetch(errFetch) :
                            'No se pudo conectar con el servidor.';
                    tbodyEmp.innerHTML =
                        '<tr><td colspan="8">' + escapeHtml(msgRed) + '</td></tr>';
                });
        }

        if (seccion === 'reservas') {
            var tbodyRes = document.getElementById('tablaReservas');
            if (tbodyRes) {
                tbodyRes.innerHTML = '<tr><td colspan="10">Cargando…</td></tr>';
            }
            reservasPaginaActual = 1;
            fetchApi(urlBackend('/api/reservas/admin'), { headers: headersAuthJSON() })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        if (tbodyRes) {
                            tbodyRes.innerHTML =
                                '<tr><td colspan="10">' +
                                escapeHtml(mensajeErrorApi(result.data)) +
                                '</td></tr>';
                        }
                        return;
                    }
                    cacheListaReservas = Array.isArray(result.data) ? result.data : [];
                    renderTablaReservas();
                })
                .catch(function (errFetch) {
                    var msgRed =
                        typeof mensajeErrorRedFetch === 'function' ?
                            mensajeErrorRedFetch(errFetch) :
                            'No se pudo conectar con el servidor.';
                    if (tbodyRes) {
                        tbodyRes.innerHTML =
                            '<tr><td colspan="10">' + escapeHtml(msgRed) + '</td></tr>';
                    }
                });
        }

        if (seccion === 'usuarios') {
            var tbodyUsuario = document.getElementById('tablaUsuarios');
            tbodyUsuario.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';

            fetchApi(urlBackend('/api/usuarios'), { headers: headersAuthJSON() })
                .then(interpretarRespuestaApi)
                .then(function (result) {
                    if (!result.ok) {
                        if (result.status === 401) {
                            alert('Sesión expirada. Vuelve a iniciar sesión.');
                            cerrarSesion();
                            return;
                        }
                        tbodyUsuario.innerHTML =
                            '<tr><td colspan="6">' +
                            escapeHtml(mensajeErrorApi(result.data)) +
                            '</td></tr>';
                        return;
                    }
                    cacheListaUsuarios = Array.isArray(result.data) ? result.data : [];
                    usuariosPaginaActual = 1;
                    renderTablaUsuarios();
                })
                .catch(function (errFetch) {
                    var msgRed =
                        typeof mensajeErrorRedFetch === 'function' ?
                            mensajeErrorRedFetch(errFetch) :
                            'No se pudo conectar con el servidor.';
                    tbodyUsuario.innerHTML =
                        '<tr><td colspan="6">' + escapeHtml(msgRed) + '</td></tr>';
                });
        }
    }

});
