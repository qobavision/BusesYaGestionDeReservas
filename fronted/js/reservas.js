// ==========================================
// RESERVAS FORM & MODAL TRACKING
// ==========================================

const CATALOGO_VEHICULOS = [
    { tipo: 'Minivan', capacidad: 10 },
    { tipo: 'Van', capacidad: 20 },
    { tipo: 'Coaster', capacidad: 30 },
    { tipo: 'Omnibus', capacidad: 50 }
];

const MAX_PASAJEROS_RESERVA = 50;

function sugerirVehiculoLocal(cantidad) {
    if (!cantidad || cantidad < 1) {
        return null;
    }
    for (let i = 0; i < CATALOGO_VEHICULOS.length; i++) {
        if (CATALOGO_VEHICULOS[i].capacidad >= cantidad) {
            return CATALOGO_VEHICULOS[i];
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', function () {

    const fechaPartida = document.getElementById('fechaPartida');
    const fechaRetorno = document.getElementById('fechaRetorno');
    const pasajerosInput = document.getElementById('pasajeros');
    const vehiculoPlaceholder = document.getElementById('vehiculoSugeridoPlaceholder');
    const vehiculoTexto = document.getElementById('vehiculoSugeridoTexto');
    const vehiculoError = document.getElementById('vehiculoSugeridoError');
    let vehiculoAsignadoValido = false;

    function fechaMinimaLocal() {
        const ahora = new Date();
        ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
        return ahora.toISOString().slice(0, 16);
    }

    function actualizarMinimosFecha() {
        const minimo = fechaMinimaLocal();
        if (fechaPartida) {
            fechaPartida.min = minimo;
        }
        if (fechaRetorno) {
            const minRetorno = (fechaPartida && fechaPartida.value) ? fechaPartida.value : minimo;
            fechaRetorno.min = minRetorno;
        }
    }

    actualizarMinimosFecha();

    if (fechaPartida) {
        fechaPartida.addEventListener('change', actualizarMinimosFecha);
        fechaPartida.addEventListener('input', actualizarMinimosFecha);
    }

    function actualizarVehiculoSugerido() {
        if (!pasajerosInput) {
            return;
        }

        const cantidad = parseInt(pasajerosInput.value, 10);

        if (!cantidad || cantidad < 1) {
            vehiculoAsignadoValido = false;
            if (vehiculoPlaceholder) vehiculoPlaceholder.hidden = false;
            if (vehiculoTexto) vehiculoTexto.hidden = true;
            if (vehiculoError) vehiculoError.hidden = true;
            return;
        }

        if (cantidad > MAX_PASAJEROS_RESERVA) {
            vehiculoAsignadoValido = false;
            if (vehiculoPlaceholder) vehiculoPlaceholder.hidden = true;
            if (vehiculoTexto) vehiculoTexto.hidden = true;
            if (vehiculoError) {
                vehiculoError.hidden = false;
                vehiculoError.textContent =
                    'Máximo ' + MAX_PASAJEROS_RESERVA +
                    ' pasajeros por reserva. Contáctanos para grupos más grandes.';
            }
            return;
        }

        const sugerido = sugerirVehiculoLocal(cantidad);
        if (!sugerido) {
            vehiculoAsignadoValido = false;
            return;
        }

        vehiculoAsignadoValido = true;
        if (vehiculoPlaceholder) vehiculoPlaceholder.hidden = true;
        if (vehiculoError) vehiculoError.hidden = true;
        if (vehiculoTexto) {
            vehiculoTexto.hidden = false;
            vehiculoTexto.innerHTML =
                '<span class="vehiculo-sugerido__nombre">' + sugerido.tipo +
                '</span> · Capacidad: ' + sugerido.capacidad + ' pasajeros';
        }
    }

    if (pasajerosInput) {
        pasajerosInput.addEventListener('input', actualizarVehiculoSugerido);
        pasajerosInput.addEventListener('change', actualizarVehiculoSugerido);
    }

    const reservaForm = document.getElementById('reservaForm');
    const dniInput = document.getElementById('dni');
    const dniError = document.getElementById('dniError');
    const trackingDniInput = document.getElementById('trackingDni');
    const trackingDniError = document.getElementById('trackingDniError');
    const metodoPago = document.getElementById('metodoPago');
    const paymentItems = document.querySelectorAll('.payment-methods__item');

    const btnTracking = document.getElementById('btnTracking');
    const modal = document.getElementById('trackingModal');
    const closeModal = document.getElementById('closeModal');
    const btnCancel = document.getElementById('btnCancel');
    const btnBuscar = document.getElementById('btnBuscar');

    const exitoModal = document.getElementById('exitoModal');
    const closeExitoModal = document.getElementById('closeExitoModal');
    const btnCerrarExito = document.getElementById('btnCerrarExito');
    const exitoCodigo = document.getElementById('exitoCodigo');
    const exitoMensaje = document.getElementById('exitoMensaje');

    // --- Método de Pago ---
    function resaltarMetodoPago(metodo) {
        paymentItems.forEach(function (item) {
            item.classList.toggle('payment-methods__item--active', item.dataset.method === metodo);
        });
    }

    if (metodoPago) {
        metodoPago.addEventListener('change', function () {
            resaltarMetodoPago(this.value);
        });
    }

    paymentItems.forEach(function (item) {
        item.addEventListener('click', function () {
            if (!metodoPago) return;
            metodoPago.value = item.dataset.method;
            resaltarMetodoPago(item.dataset.method);
        });
    });

    // --- Modal Tracking ---
    function abrirModal() {
        modal.classList.add('modal--active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    const trackingResultados = document.getElementById('trackingResultados');
    const trackingMensaje = document.getElementById('trackingMensaje');

    function cerrarModal() {
        modal.classList.remove('modal--active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('trackingForm').reset();
        limpiarErrorCampo(trackingDniInput, trackingDniError);
        if (trackingResultados) {
            trackingResultados.hidden = true;
            trackingResultados.innerHTML = '';
        }
        if (trackingMensaje) {
            trackingMensaje.hidden = true;
            trackingMensaje.textContent = '';
        }
    }

    function resetearFormularioReserva() {
        if (!reservaForm) return;
        reservaForm.reset();
        actualizarMinimosFecha();
        actualizarVehiculoSugerido();
        resaltarMetodoPago('');
        if (metodoPago) {
            metodoPago.value = '';
        }
    }

    function cerrarModalExito() {
        if (!exitoModal) return;
        exitoModal.classList.remove('modal--active');
        exitoModal.style.display = 'none';
        if (!modal || !modal.classList.contains('modal--active')) {
            document.body.style.overflow = '';
        }
        resetearFormularioReserva();
    }

    function mostrarModalExito(codigoReserva) {
        if (!exitoModal) return;
        if (exitoCodigo) {
            exitoCodigo.textContent = codigoReserva || '—';
        }
        if (exitoMensaje) {
            exitoMensaje.textContent = 'Reserva registrada correctamente.';
        }
        exitoModal.classList.add('modal--active');
        exitoModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function etiquetaEstado(estado) {
        const mapa = {
            pendiente: 'Pendiente',
            confirmado: 'Confirmado',
            verificado: 'Verificado',
            cancelado: 'Cancelado',
            en_camino: 'En camino',
            completado: 'Completado'
        };
        return mapa[(estado || '').toLowerCase()] || (estado || 'Pendiente');
    }

    function crearTarjetaReserva(reserva) {
        const fechaSalida = reserva.fecha_salida
            ? reserva.fecha_salida + (reserva.hora_salida ? ' ' + reserva.hora_salida : '')
            : 'Por confirmar';
        const vehiculo = reserva.vehiculo_tipo
            ? reserva.vehiculo_tipo + (reserva.vehiculo_capacidad ? ' (hasta ' + reserva.vehiculo_capacidad + ' pax)' : '')
            : '-';

        return (
            '<article class="tracking-card">' +
            '<div class="tracking-card__header">' +
            '<strong class="tracking-card__codigo">' + reserva.codigo_reserva + '</strong>' +
            '<span class="tracking-card__estado tracking-card__estado--' + (reserva.estado || 'pendiente') + '">' +
            etiquetaEstado(reserva.estado) +
            '</span>' +
            '</div>' +
            '<ul class="tracking-card__lista">' +
            '<li><span>Origen:</span> ' + (reserva.origen || '-') + '</li>' +
            '<li><span>Destino:</span> ' + (reserva.destino || '-') + '</li>' +
            '<li><span>Salida:</span> ' + fechaSalida + '</li>' +
            '<li><span>Pasajeros:</span> ' + reserva.cantidad_pasajeros + '</li>' +
            '<li><span>Vehículo sugerido:</span> ' + vehiculo + '</li>' +
            '</ul>' +
            '</article>'
        );
    }

    function mostrarResultadosConsulta(reservas) {
        if (!trackingResultados || !trackingMensaje) return;

        trackingMensaje.hidden = true;
        trackingResultados.hidden = false;
        trackingResultados.innerHTML = reservas.map(crearTarjetaReserva).join('');
    }

    function mostrarMensajeConsulta(texto, esError) {
        if (!trackingMensaje || !trackingResultados) return;
        trackingResultados.hidden = true;
        trackingResultados.innerHTML = '';
        trackingMensaje.hidden = false;
        trackingMensaje.textContent = texto;
        trackingMensaje.classList.toggle('tracking-mensaje--error', !!esError);
    }

    if (btnTracking) {
        btnTracking.addEventListener('click', abrirModal);
    }

    if (closeModal) {
        closeModal.addEventListener('click', cerrarModal);
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', cerrarModal);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                cerrarModal();
            }
        });
    }

    if (closeExitoModal) {
        closeExitoModal.addEventListener('click', cerrarModalExito);
    }

    if (btnCerrarExito) {
        btnCerrarExito.addEventListener('click', cerrarModalExito);
    }

    if (exitoModal) {
        exitoModal.addEventListener('click', function (e) {
            if (e.target === exitoModal) {
                cerrarModalExito();
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (exitoModal && exitoModal.classList.contains('modal--active')) {
            cerrarModalExito();
            return;
        }
        if (modal && modal.classList.contains('modal--active')) {
            cerrarModal();
        }
    });

    function marcarErrorCampo(input, errorEl, mensaje) {
        if (errorEl) {
            errorEl.textContent = mensaje;
            errorEl.classList.add('form-group__error--visible');
        }
        if (input) {
            input.classList.add('form-group__input--error');
        }
    }

    function limpiarErrorCampo(input, errorEl) {
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('form-group__error--visible');
        }
        if (input) {
            input.classList.remove('form-group__input--error');
        }
    }

    function validarDni(valor) {
        const dni = (valor || '').trim();
        if (!dni) {
            return 'El DNI es obligatorio.';
        }
        if (!/^\d+$/.test(dni)) {
            return 'El DNI solo debe contener números.';
        }
        if (dni.length !== 8) {
            return 'El DNI debe tener 8 dígitos. Verifica la cantidad ingresada.';
        }
        return null;
    }

    function configurarValidacionDni(input, errorEl) {
        if (!input) return;

        input.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 8);
            const mensaje = validarDni(this.value);
            if (!this.value || !mensaje) {
                limpiarErrorCampo(input, errorEl);
            } else if (this.value.length > 0 && this.value.length < 8) {
                marcarErrorCampo(input, errorEl, mensaje);
            }
        });

        input.addEventListener('blur', function () {
            const mensaje = validarDni(this.value);
            if (mensaje) {
                marcarErrorCampo(input, errorEl, mensaje);
            } else {
                limpiarErrorCampo(input, errorEl);
            }
        });
    }

    configurarValidacionDni(dniInput, dniError);
    configurarValidacionDni(trackingDniInput, trackingDniError);

    function mensajeErrorApi(data) {
        if (!data || !data.detail) {
            return 'No se pudo completar la operación.';
        }
        if (typeof data.detail === 'string') {
            return data.detail;
        }
        if (Array.isArray(data.detail)) {
            return data.detail.map(function (item) {
                return item.msg || JSON.stringify(item);
            }).join('\n');
        }
        return JSON.stringify(data.detail);
    }

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function () {
            const dni = trackingDniInput ? trackingDniInput.value.trim() : '';
            const codigo = document.getElementById('trackingCodigo').value.trim();
            const errorDniConsulta = validarDni(dni);

            if (errorDniConsulta) {
                marcarErrorCampo(trackingDniInput, trackingDniError, errorDniConsulta);
                if (trackingDniInput) trackingDniInput.focus();
                return;
            }

            limpiarErrorCampo(trackingDniInput, trackingDniError);

            let url = urlBackend('/api/reservas/consultar?dni=' + encodeURIComponent(dni));
            if (codigo) {
                url += '&codigo_reserva=' + encodeURIComponent(codigo);
            }

            btnBuscar.disabled = true;
            const textoBuscar = btnBuscar.textContent;
            btnBuscar.textContent = 'Buscando...';

            fetch(url)
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        mostrarMensajeConsulta(mensajeErrorApi(result.data), true);
                        return;
                    }

                    if (!result.data.length) {
                        mostrarMensajeConsulta('No se encontraron reservas con esos datos.', true);
                        return;
                    }

                    mostrarResultadosConsulta(result.data);
                })
                .catch(function () {
                    mostrarMensajeConsulta('No se pudo conectar con el servidor. ¿Está corriendo uvicorn?', true);
                })
                .finally(function () {
                    btnBuscar.disabled = false;
                    btnBuscar.textContent = textoBuscar;
                });
        });
    }

    function validarFechasFormulario() {
        const minimo = fechaMinimaLocal();

        if (fechaPartida && fechaPartida.value && fechaPartida.value < minimo) {
            alert('La fecha de partida no puede ser anterior a la actual.');
            return false;
        }

        if (fechaRetorno && fechaRetorno.value) {
            const minRetorno = fechaPartida && fechaPartida.value ? fechaPartida.value : minimo;
            if (fechaRetorno.value < minRetorno) {
                alert('La fecha de retorno debe ser igual o posterior a la fecha de partida.');
                return false;
            }
        }

        return true;
    }

    // --- Submit Formulario Reserva ---
    if (reservaForm) {
        reservaForm.addEventListener('submit', function (e) {
            e.preventDefault();

            if (!validarFechasFormulario()) {
                return;
            }

            actualizarVehiculoSugerido();
            if (!vehiculoAsignadoValido) {
                alert('Ingresa una cantidad válida de pasajeros (1 a ' + MAX_PASAJEROS_RESERVA + ').');
                return;
            }

            if (metodoPago && !metodoPago.value) {
                alert('Selecciona un método de pago.');
                return;
            }

            const errorDni = validarDni(dniInput ? dniInput.value : '');
            if (errorDni) {
                marcarErrorCampo(dniInput, dniError, errorDni);
                if (dniInput) dniInput.focus();
                return;
            }
            limpiarErrorCampo(dniInput, dniError);

            const submitBtn = reservaForm.querySelector('button[type="submit"]');
            const textoOriginal = submitBtn ? submitBtn.innerHTML : '';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            }

            const formData = new FormData(reservaForm);

            fetch(urlBackend('/api/reservas'), {
                method: 'POST',
                body: formData
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        alert(mensajeErrorApi(result.data));
                        return;
                    }

                    mostrarModalExito(result.data.codigo_reserva);
                })
                .catch(function () {
                    alert('No se pudo conectar con el servidor. ¿Está corriendo uvicorn en ' + API_URL + '?');
                })
                .finally(function () {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginal;
                    }
                });
        });
    }

});
