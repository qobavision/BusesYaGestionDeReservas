// ============================================
// PANEL-CONDUCTOR.JS — Viajes reales del API
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    var usuarioSesion = verificarSesion(['conductor', 3]);
    if (!usuarioSesion) {
        return;
    }

    var viajes = [];
    var viajeSeleccionadoId = null;
    var filtroActivo = 'hoy';

    function headersAuthJSON() {
        return {
            'Content-Type': 'application/json',
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

    function asegurarIdEmpleadoSesion() {
        if (usuarioSesion.id_empleado != null && usuarioSesion.id_empleado !== '') {
            return Promise.resolve(usuarioSesion);
        }
        return fetchApi(urlBackend('/api/auth/me'), { headers: headersAuthJSON() })
            .then(interpretarRespuestaApi)
            .then(function (r) {
                if (r.ok && r.data) {
                    usuarioSesion.id_empleado = r.data.id_empleado;
                    var guardado = JSON.parse(localStorage.getItem('usuario') || '{}');
                    guardado.id_empleado = r.data.id_empleado;
                    localStorage.setItem('usuario', JSON.stringify(guardado));
                }
                return usuarioSesion;
            });
    }

    function claveEstadoInterno(estadoApi) {
        var e = String(estadoApi || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
        if (e === 'en_camino') {
            return 'en_camino';
        }
        if (e === 'finalizado' || e === 'completado') {
            return 'finalizado';
        }
        if (e === 'cancelado' || e === 'cancelada') {
            return 'cancelado';
        }
        return 'pendiente';
    }

    function mapearViajeApi(v) {
        var fechaIso = v.fecha_salida;
        if (fechaIso && typeof fechaIso !== 'string') {
            try {
                fechaIso = new Date(fechaIso).toISOString();
            } catch (e) {
                fechaIso = String(fechaIso);
            }
        }
        var fechaRetIso = v.fecha_retorno;
        if (fechaRetIso && typeof fechaRetIso !== 'string') {
            try {
                fechaRetIso = new Date(fechaRetIso).toISOString();
            } catch (e) {
                fechaRetIso = fechaRetIso ? String(fechaRetIso) : null;
            }
        }
        if (!fechaRetIso) {
            fechaRetIso = null;
        }

        var placa = v.vehiculo_placa ? ' · ' + String(v.vehiculo_placa).trim() : '';
        var vehBase = (v.vehiculo_texto || '').trim() || '—';
        var vehTxt = vehBase === '—' ? '—' : vehBase + placa;

        var tel = (v.cliente_telefono || '').trim();
        if (!tel) {
            tel = '—';
        }

        var estCod = '';
        if (v.estado_codigo && typeof v.estado_codigo === 'string') {
            estCod = String(v.estado_codigo)
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_');
        }
        if (!estCod) {
            estCod = claveEstadoInterno(v.estado);
        }
        if (estCod === 'completado') {
            estCod = 'finalizado';
        }

        return {
            id: v.id_viaje,
            codigo: (v.codigo_viaje || '').trim() || '—',
            reserva: (v.codigo_reserva || '').trim() || '—',
            origen: v.origen || '—',
            destino: v.destino || '—',
            fecha: fechaIso || new Date().toISOString(),
            fecha_retorno: fechaRetIso,
            pasajeros: v.cantidad_pasajeros != null ? v.cantidad_pasajeros : 0,
            vehiculo: vehTxt,
            cliente: v.cliente_nombre || '—',
            telefono: tel,
            estado: estCod,
            _api: v
        };
    }

    function inicioDia(fecha) {
        var d = new Date(fecha);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function esHoy(fechaIso) {
        var f = new Date(fechaIso);
        var hoy = new Date();
        return inicioDia(f).getTime() === inicioDia(hoy).getTime();
    }

    function esManana(fechaIso) {
        var f = new Date(fechaIso);
        var manana = new Date();
        manana.setDate(manana.getDate() + 1);
        return inicioDia(f).getTime() === inicioDia(manana).getTime();
    }

    function esEstaSemana(fechaIso) {
        var f = new Date(fechaIso);
        var hoy = new Date();
        var finSemana = new Date(hoy);
        finSemana.setDate(hoy.getDate() + 7);
        return f >= inicioDia(hoy) && f <= finSemana;
    }

    /** Una línea tipo tarjeta (día + hora legible en PE) */
    function formatearSalidaTarjeta(iso) {
        if (!iso) {
            return '—';
        }
        var d = new Date(iso);
        if (isNaN(d.getTime())) {
            return '—';
        }
        return d.toLocaleString('es-PE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function htmlEstadoTarjeta(estado) {
        var rows = {
            pendiente: { icon: 'fa-hourglass-half', cls: 'viaje-card__estado--pendiente', lab: 'Pendiente' },
            en_camino: { icon: 'fa-route', cls: 'viaje-card__estado--camino', lab: 'En camino' },
            en_camino_recojo: { icon: 'fa-route', cls: 'viaje-card__estado--camino', lab: 'Al recojo' },
            pasajeros_abordo: { icon: 'fa-user-check', cls: 'viaje-card__estado--abordo', lab: 'A bordo' },
            en_destino: { icon: 'fa-flag-checkered', cls: 'viaje-card__estado--destino', lab: 'En destino' },
            finalizado: { icon: 'fa-circle-check', cls: 'viaje-card__estado--fin', lab: 'Finalizado' },
            completado: { icon: 'fa-circle-check', cls: 'viaje-card__estado--fin', lab: 'Finalizado' },
            cancelado: { icon: 'fa-ban', cls: 'viaje-card__estado--cancel', lab: 'Cancelado' }
        };
        var r = rows[estado] || rows.pendiente;
        return (
            '<span class="viaje-card__estado ' +
            r.cls +
            '">' +
            '<i class="fas ' +
            r.icon +
            '" aria-hidden="true"></i>' +
            '<span class="viaje-card__estado-txt">' +
            escapeHtml(r.lab) +
            '</span>' +
            '</span>'
        );
    }

    function claseBordeEstado(estado) {
        var e = String(estado || 'pendiente');
        if (e === 'completado') {
            return 'viaje-card--barra-fin';
        }
        if (e === 'en_camino' || e === 'en_camino_recojo') {
            return 'viaje-card--barra-camino';
        }
        if (e === 'pasajeros_abordo') {
            return 'viaje-card--barra-abordo';
        }
        if (e === 'en_destino') {
            return 'viaje-card--barra-destino';
        }
        if (e === 'finalizado') {
            return 'viaje-card--barra-fin';
        }
        if (e === 'cancelado') {
            return 'viaje-card--barra-cancel';
        }
        return 'viaje-card--barra-pendiente';
    }

    function formatearFechaHoraLineas(iso) {
        if (!iso) {
            return { fecha: '—', hora: '' };
        }
        var d = new Date(iso);
        if (isNaN(d.getTime())) {
            return { fecha: '—', hora: '' };
        }
        return {
            fecha: d.toLocaleDateString('es-PE', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }),
            hora: d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        };
    }

    function textoHeroRecojo(origen) {
        var s = String(origen || '').trim();
        if (!s || s === '—') {
            return '—';
        }
        var guion = s.indexOf(' - ');
        if (guion >= 0) {
            return s.slice(0, guion).trim();
        }
        return s;
    }

    function textoHeroDestino(destino) {
        var s = String(destino || '').trim();
        if (!s || s === '—') {
            return '—';
        }
        var coma = s.indexOf(',');
        if (coma >= 0) {
            return s.slice(0, coma).trim();
        }
        var guion = s.indexOf(' - ');
        if (guion >= 0) {
            return s.slice(0, guion).trim();
        }
        return s;
    }

    var guardandoEstado = false;

    function aplicarViajeDesdeRespuestaApi(item) {
        var mapped = mapearViajeApi(item);
        var ix = viajes.findIndex(function (x) {
            return x.id === mapped.id;
        });
        if (ix >= 0) {
            viajes[ix] = mapped;
        } else {
            viajes.push(mapped);
        }
        return mapped;
    }

    function uiEstadoBotonesCargando(cargando) {
        var wrap = document.getElementById('conductorEstadoBtns');
        if (!wrap) {
            return;
        }
        wrap.querySelectorAll('.conductor-estado-btn').forEach(function (b) {
            b.disabled = !!cargando;
        });
    }

    function actualizarEstadoBotonesVisual(v) {
        var wrap = document.getElementById('conductorEstadoBtns');
        if (!wrap) {
            return;
        }
        var actual = v.estado;
        wrap.querySelectorAll('.conductor-estado-btn').forEach(function (b) {
            var k = b.getAttribute('data-estado');
            b.classList.toggle('conductor-estado-btn--activo', k === actual);
            b.classList.toggle('conductor-ref-estado-card--activo', k === actual);
        });
        var ocultar = actual === 'cancelado';
        wrap.hidden = ocultar;
    }

    function mostrarMsgEstadoConductor(texto, esError) {
        var el = document.getElementById('conductorEstadoMsg');
        if (!el) {
            return;
        }
        if (!texto) {
            el.hidden = true;
            el.textContent = '';
            el.classList.remove('conductor-ref-msg--error');
            return;
        }
        el.hidden = false;
        el.textContent = texto;
        el.classList.toggle('conductor-ref-msg--error', !!esError);
    }

    function obtenerViaje(id) {
        return viajes.find(function (v) {
            return v.id === id;
        });
    }

    function badgeEstado(estado) {
        var map = {
            pendiente: 'badge--pendiente',
            en_camino: 'badge--en-camino',
            en_camino_recojo: 'badge--en-camino',
            pasajeros_abordo: 'badge--abordo',
            en_destino: 'badge--destino',
            finalizado: 'badge--confirmada',
            completado: 'badge--confirmada',
            cancelado: 'badge--pendiente'
        };
        var labels = {
            pendiente: 'Pendiente',
            en_camino: 'En camino',
            en_camino_recojo: 'En camino al recojo',
            pasajeros_abordo: 'Pasajeros a bordo',
            en_destino: 'En destino',
            finalizado: 'Finalizado',
            completado: 'Completado',
            cancelado: 'Cancelado'
        };
        return (
            '<span class="badge ' +
            (map[estado] || 'badge--pendiente') +
            '">' +
            escapeHtml(labels[estado] || estado) +
            '</span>'
        );
    }

    function nombreUsuarioMayusculas(nombre) {
        return String(nombre || 'Conductor')
            .trim()
            .toUpperCase();
    }

    function inicialesDesdeNombreUsuario(nombre) {
        var t = nombreUsuarioMayusculas(nombre);
        if (!t || t === 'CONDUCTOR') {
            return 'CO';
        }
        var sinEsp = t.replace(/\s+/g, '');
        if (sinEsp.length >= 2) {
            return sinEsp.slice(0, 2);
        }
        return sinEsp.slice(0, 1) || 'CO';
    }

    function aplicarPerfilConductor(usuario) {
        var nombreMostrar = nombreUsuarioMayusculas(usuario.nombre_usuario);
        var rolTxt = 'Conductor';
        var iniciales = inicialesDesdeNombreUsuario(usuario.nombre_usuario);

        var elNomSide = document.getElementById('conductorNombreSidebar');
        if (elNomSide) {
            elNomSide.textContent = nombreMostrar;
        }
        var sidebarRole = document.getElementById('sidebarUserRole');
        if (sidebarRole) {
            sidebarRole.textContent = rolTxt;
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
            headerRole.textContent = rolTxt;
        }
        var headerAvatar = document.getElementById('headerUserAvatar');
        if (headerAvatar) {
            headerAvatar.textContent = iniciales;
        }
    }

    var elFecha = document.getElementById('fechaHoy');
    if (elFecha) {
        elFecha.textContent = new Date().toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    var titulos = {
        'mis-viajes': 'Mis viajes',
        'detalle-viaje': 'Detalle del viaje'
    };

    var navItems = document.querySelectorAll('.panel__nav-item');
    var sections = document.querySelectorAll('.section');
    var pageTitle = document.getElementById('pageTitle');

    function irASeccion(sectionId) {
        navItems.forEach(function (n) {
            n.classList.toggle('panel__nav-item--active', n.dataset.section === sectionId);
        });
        sections.forEach(function (s) {
            s.classList.toggle('section--active', s.id === sectionId);
        });
        pageTitle.textContent = titulos[sectionId] || 'Panel conductor';
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            var sectionId = item.dataset.section;
            if (sectionId === 'detalle-viaje' && !viajeSeleccionadoId) {
                alert('Primero selecciona un viaje desde Mis viajes.');
                return;
            }
            irASeccion(sectionId);
        });
    });

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    document.getElementById('btnVolverViajes').addEventListener('click', function () {
        irASeccion('mis-viajes');
    });

    var modalFinalizar = document.getElementById('modalConfirmarFinalizar');

    function cerrarModalFinalizar() {
        if (modalFinalizar) {
            modalFinalizar.hidden = true;
        }
    }

    function abrirModalFinalizar() {
        if (modalFinalizar) {
            modalFinalizar.hidden = false;
        }
    }

    function enviarEstadoConductor(nuevoEstado) {
        if (!viajeSeleccionadoId || guardandoEstado) {
            return;
        }
        var vSel = obtenerViaje(viajeSeleccionadoId);
        if (!vSel || vSel.estado === 'cancelado') {
            return;
        }
        if (vSel.estado === nuevoEstado) {
            return;
        }

        guardandoEstado = true;
        uiEstadoBotonesCargando(true);
        mostrarMsgEstadoConductor('Guardando…', false);

        fetchApi(
            urlBackend(
                '/api/viajes/' + encodeURIComponent(String(viajeSeleccionadoId)) + '/estado-conductor'
            ),
            {
                method: 'PATCH',
                headers: headersAuthJSON(),
                body: JSON.stringify({ estado: nuevoEstado })
            }
        )
            .then(interpretarRespuestaApi)
            .then(function (result) {
                guardandoEstado = false;
                uiEstadoBotonesCargando(false);
                if (!result.ok) {
                    if (result.status === 401) {
                        cerrarSesion();
                        return;
                    }
                    mostrarMsgEstadoConductor(mensajeErrorApi(result.data), true);
                    return;
                }
                var mapped = aplicarViajeDesdeRespuestaApi(result.data);
                mostrarMsgEstadoConductor('', false);
                renderViajes();
                if (viajeSeleccionadoId === mapped.id) {
                    document.getElementById('detEstadoHero').innerHTML = badgeEstado(mapped.estado);
                    actualizarEstadoBotonesVisual(mapped);
                }
            })
            .catch(function (err) {
                guardandoEstado = false;
                uiEstadoBotonesCargando(false);
                var msg =
                    typeof mensajeErrorRedFetch === 'function'
                        ? mensajeErrorRedFetch(err)
                        : 'Error de red';
                mostrarMsgEstadoConductor(msg, true);
            });
    }

    var wrapEstados = document.getElementById('conductorEstadoBtns');
    if (wrapEstados) {
        wrapEstados.addEventListener('click', function (e) {
            var btn = e.target.closest('.conductor-estado-btn');
            if (!btn || guardandoEstado) {
                return;
            }
            var nuevoEstado = btn.getAttribute('data-estado');
            if (!nuevoEstado || !viajeSeleccionadoId) {
                return;
            }
            var vSel = obtenerViaje(viajeSeleccionadoId);
            if (!vSel || vSel.estado === 'cancelado') {
                return;
            }
            if (vSel.estado === nuevoEstado) {
                return;
            }

            if (nuevoEstado === 'finalizado') {
                abrirModalFinalizar();
                return;
            }
            enviarEstadoConductor(nuevoEstado);
        });
    }

    if (modalFinalizar) {
        modalFinalizar.querySelectorAll('[data-conductor-modal-close]').forEach(function (el) {
            el.addEventListener('click', cerrarModalFinalizar);
        });
        var btnNo = document.getElementById('conductorModalFinalizarNo');
        if (btnNo) {
            btnNo.addEventListener('click', cerrarModalFinalizar);
        }
        var btnSi = document.getElementById('conductorModalFinalizarSi');
        if (btnSi) {
            btnSi.addEventListener('click', function () {
                cerrarModalFinalizar();
                enviarEstadoConductor('finalizado');
            });
        }
    }

    function actualizarStats() {
        document.getElementById('statHoy').textContent = String(
            viajes.filter(function (v) {
                return esHoy(v.fecha);
            }).length
        );
        document.getElementById('statManana').textContent = String(
            viajes.filter(function (v) {
                return esManana(v.fecha);
            }).length
        );
        document.getElementById('statSemana').textContent = String(
            viajes.filter(function (v) {
                return esEstaSemana(v.fecha);
            }).length
        );
        document.getElementById('statEnCurso').textContent = String(
            viajes.filter(function (v) {
                return v.estado === 'en_camino';
            }).length
        );
    }

    function filtrarViajes() {
        return viajes
            .filter(function (v) {
                if (filtroActivo === 'hoy') {
                    return esHoy(v.fecha);
                }
                if (filtroActivo === 'manana') {
                    return esManana(v.fecha);
                }
                if (filtroActivo === 'semana') {
                    return esEstaSemana(v.fecha);
                }
                return true;
            })
            .sort(function (a, b) {
                return new Date(a.fecha) - new Date(b.fecha);
            });
    }

    function renderViajes() {
        actualizarStats();
        var lista = filtrarViajes();
        var contenedor = document.getElementById('listaViajes');

        if (!lista.length) {
            contenedor.innerHTML =
                '<div class="panel-empty"><i class="fas fa-calendar-times" aria-hidden="true"></i><p>No hay viajes para este filtro.</p></div>';
            return;
        }

        contenedor.innerHTML = lista
            .map(function (v) {
                var claseHoy = esHoy(v.fecha) ? ' viaje-card--hoy' : '';
                var barra = claseBordeEstado(v.estado);
                var pax = v.pasajeros === 1 ? '1 pax' : String(v.pasajeros) + ' pax';
                return (
                    '<article class="viaje-card ' +
                    barra +
                    claseHoy +
                    '" data-id="' +
                    v.id +
                    '" tabindex="0" role="button">' +
                    '<div class="viaje-card__top">' +
                    '<div class="viaje-card__top-main">' +
                    htmlEstadoTarjeta(v.estado) +
                    '<div class="viaje-card__codigo">' +
                    escapeHtml(v.codigo) +
                    '</div>' +
                    '<div class="viaje-card__ruta-line">' +
                    '<span class="viaje-card__ruta-ch viaje-card__ruta-ch--orig" title="Origen">' +
                    '<i class="fas fa-location-dot" aria-hidden="true"></i></span>' +
                    '<span class="viaje-card__ruta-txt viaje-card__ruta-txt--orig">' +
                    escapeHtml(v.origen) +
                    '</span>' +
                    '<span class="viaje-card__ruta-arrow" aria-hidden="true">→</span>' +
                    '<span class="viaje-card__ruta-ch viaje-card__ruta-ch--dest" title="Destino">' +
                    '<i class="fas fa-location-dot" aria-hidden="true"></i></span>' +
                    '<span class="viaje-card__ruta-txt viaje-card__ruta-txt--dest">' +
                    escapeHtml(v.destino) +
                    '</span>' +
                    '</div>' +
                    '</div>' +
                    '<span class="viaje-card__chev" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>' +
                    '</div>' +
                    '<div class="viaje-card__metrics">' +
                    '<div class="viaje-card__metric">' +
                    '<i class="fas fa-clock viaje-card__metric-ic" aria-hidden="true"></i>' +
                    '<span class="viaje-card__metric-lab">Salida</span>' +
                    '<span class="viaje-card__metric-val">' +
                    escapeHtml(formatearSalidaTarjeta(v.fecha)) +
                    '</span></div>' +
                    '<div class="viaje-card__metric">' +
                    '<i class="fas fa-users viaje-card__metric-ic" aria-hidden="true"></i>' +
                    '<span class="viaje-card__metric-lab">Pasajeros</span>' +
                    '<span class="viaje-card__metric-val">' +
                    escapeHtml(pax) +
                    '</span></div>' +
                    '<div class="viaje-card__metric">' +
                    '<i class="fas fa-bus viaje-card__metric-ic" aria-hidden="true"></i>' +
                    '<span class="viaje-card__metric-lab">Vehículo</span>' +
                    '<span class="viaje-card__metric-val">' +
                    escapeHtml(v.vehiculo) +
                    '</span></div>' +
                    '<div class="viaje-card__metric">' +
                    '<i class="fas fa-user viaje-card__metric-ic" aria-hidden="true"></i>' +
                    '<span class="viaje-card__metric-lab">Cliente</span>' +
                    '<span class="viaje-card__metric-val">' +
                    escapeHtml(v.cliente) +
                    '</span></div>' +
                    '</div>' +
                    '</article>'
                );
            })
            .join('');

        contenedor.querySelectorAll('.viaje-card').forEach(function (card) {
            function abrir() {
                abrirDetalle(parseInt(card.dataset.id, 10));
            }
            card.addEventListener('click', abrir);
            card.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    abrir();
                }
            });
        });
    }

    document.querySelectorAll('.viajes-filtros__btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.viajes-filtros__btn').forEach(function (b) {
                b.classList.remove('viajes-filtros__btn--active');
            });
            btn.classList.add('viajes-filtros__btn--active');
            filtroActivo = btn.dataset.filtro;
            renderViajes();
        });
    });

    function abrirDetalle(id) {
        var v = obtenerViaje(id);
        if (!v) {
            return;
        }

        viajeSeleccionadoId = id;

        document.getElementById('detalleVacio').hidden = true;
        document.getElementById('detalleContenido').hidden = false;

        document.getElementById('detCodigoViajeHero').textContent = v.codigo;
        var wrapReserva = document.getElementById('detReservaHeroWrap');
        if (wrapReserva) {
            if (v.reserva && v.reserva !== '—') {
                wrapReserva.hidden = false;
                document.getElementById('detCodigoReservaHero').textContent = v.reserva;
            } else {
                wrapReserva.hidden = true;
            }
        }
        document.getElementById('detHeroOrigen').textContent = textoHeroRecojo(v.origen);
        document.getElementById('detHeroDestino').textContent = textoHeroDestino(v.destino);
        document.getElementById('detEstadoHero').innerHTML = badgeEstado(v.estado);

        document.getElementById('detClienteNombre').textContent = v.cliente;
        document.getElementById('detTelefono').textContent = v.telefono;
        var linkTel = document.getElementById('detTelefonoLink');
        if (linkTel) {
            linkTel.href =
                v.telefono && v.telefono !== '—'
                    ? 'tel:' + String(v.telefono).replace(/\s/g, '')
                    : '#';
        }
        document.getElementById('detOrigen').textContent = v.origen;
        document.getElementById('detDestino').textContent = v.destino;

        var sal = formatearFechaHoraLineas(v.fecha);
        document.getElementById('detSalidaFecha').textContent = sal.fecha;
        document.getElementById('detSalidaHora').textContent = sal.hora || '—';

        if (v.fecha_retorno) {
            var reg = formatearFechaHoraLineas(v.fecha_retorno);
            document.getElementById('detRegresoFecha').textContent = reg.fecha;
            document.getElementById('detRegresoHora').textContent = reg.hora || '—';
        } else {
            document.getElementById('detRegresoFecha').textContent = '—';
            document.getElementById('detRegresoHora').textContent = '';
        }

        document.getElementById('detPasajeros').textContent =
            String(v.pasajeros) + (v.pasajeros === 1 ? ' pasajero' : ' pasajeros');
        document.getElementById('detVehiculo').textContent = v.vehiculo;

        mostrarMsgEstadoConductor('', false);
        actualizarEstadoBotonesVisual(v);
        if (v.estado === 'cancelado') {
            mostrarMsgEstadoConductor(
                'Este viaje está cancelado. No se puede cambiar el estado.',
                true
            );
        }
        irASeccion('detalle-viaje');
    }

    function cargarViajesDesdeApi() {
        var contenedor = document.getElementById('listaViajes');
        if (!contenedor) {
            return;
        }

        if (usuarioSesion.id_empleado == null || usuarioSesion.id_empleado === '') {
            contenedor.innerHTML =
                '<div class="panel-empty"><i class="fas fa-user-slash" aria-hidden="true"></i><p>Tu usuario no tiene vinculado un empleado conductor. Pide al administrador que vincule tu cuenta (Empleados / Usuarios) y vuelve a iniciar sesión.</p></div>';
            viajes = [];
            actualizarStats();
            return;
        }

        contenedor.innerHTML =
            '<p class="conductor-viajes-cargando">Cargando viajes…</p>';

        fetchApi(urlBackend('/api/viajes/mis-asignados'), { headers: headersAuthJSON() })
            .then(interpretarRespuestaApi)
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 401) {
                        cerrarSesion();
                        return;
                    }
                    contenedor.innerHTML =
                        '<div class="panel-empty"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i><p>' +
                        escapeHtml(mensajeErrorApi(result.data)) +
                        '</p></div>';
                    viajes = [];
                    actualizarStats();
                    return;
                }
                var arr = Array.isArray(result.data) ? result.data : [];
                viajes = arr.map(mapearViajeApi);
                renderViajes();
            })
            .catch(function (err) {
                var msg =
                    typeof mensajeErrorRedFetch === 'function' ?
                        mensajeErrorRedFetch(err)
                    :   'Error de red';
                contenedor.innerHTML =
                    '<div class="panel-empty"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i><p>' +
                    escapeHtml(msg) +
                    '</p></div>';
                viajes = [];
                actualizarStats();
            });
    }

    asegurarIdEmpleadoSesion().then(function () {
        aplicarPerfilConductor(usuarioSesion);
        cargarViajesDesdeApi();
    });
});
