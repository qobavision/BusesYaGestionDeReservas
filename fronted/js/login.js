// ==========================================
// LOGIN — conectado a FastAPI
// ==========================================

document.addEventListener('DOMContentLoaded', function () {

    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleIcon.classList.toggle('fa-eye');
            toggleIcon.classList.toggle('fa-eye-slash');
        });
    }

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const submitBtn = document.getElementById('submitBtn');

    const textoBotonOriginal =
        '<span class="btn__text">Ingresar</span><i class="fas fa-arrow-right btn__icon"></i>';

    function restaurarBoton() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = textoBotonOriginal;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            let isValid = true;

            const emailTrim = emailInput.value.trim();
            const tieneArroba = emailTrim.includes('@');
            const dominioEsBusesyaCorto = /^[^\s@]+@busesya$/i.test(emailTrim);
            const formatoClasico = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const correoOk =
                tieneArroba &&
                (formatoClasico.test(emailTrim) || dominioEsBusesyaCorto);
            if (!correoOk) {
                emailError.textContent =
                    'Correo incorrecto. Ejemplo: tuNombre@busesya o nombre@dominio.com';
                emailError.classList.add('form-group__error--visible');
                emailInput.classList.add('form-group__input--error');
                isValid = false;
            } else {
                emailError.textContent = '';
                emailError.classList.remove('form-group__error--visible');
                emailInput.classList.remove('form-group__input--error');
            }

            if (passwordInput.value.length < 6) {
                passwordError.textContent = 'La contraseña debe tener al menos 6 caracteres';
                passwordError.classList.add('form-group__error--visible');
                passwordInput.classList.add('form-group__input--error');
                isValid = false;
            } else {
                passwordError.textContent = '';
                passwordError.classList.remove('form-group__error--visible');
                passwordInput.classList.remove('form-group__input--error');
            }

            if (!isValid) return;
            if (submitBtn.disabled) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';

            fetchConTimeout(
                urlBackend('/api/auth/login'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: emailInput.value.trim(),
                        password: passwordInput.value
                    })
                },
                45000
            )
                .then(function (response) {
                    return response.text().then(function (texto) {
                        var data = {};
                        if (texto) {
                            try {
                                data = JSON.parse(texto);
                            } catch (ignoreJson) {
                                data = { detail: texto };
                            }
                        }
                        return { ok: response.ok, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        const msg = result.data.detail || 'Error al iniciar sesión';
                        alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
                        restaurarBoton();
                        return;
                    }

                    localStorage.setItem('token', result.data.access_token);
                    localStorage.setItem(
                        'usuario',
                        JSON.stringify({
                            nombre_usuario: result.data.nombre_usuario,
                            rol: result.data.rol,
                            id_rol: result.data.id_rol,
                            id_usuario: result.data.id_usuario,
                            id_empleado:
                                result.data.id_empleado != null ?
                                    result.data.id_empleado
                                :   null
                        })
                    );

                    window.location.href = result.data.panel_url;
                })
                .catch(function (error) {
                    console.error('Error:', error);
                    alert(
                        typeof mensajeErrorRedFetch === 'function' ?
                            mensajeErrorRedFetch(error) :
                            'No se pudo conectar con el servidor. ¿Está corriendo uvicorn en ' +
                                API_URL +
                                '?'
                    );
                    restaurarBoton();
                });
        });

        emailInput.addEventListener('input', function () {
            emailError.textContent = '';
            emailError.classList.remove('form-group__error--visible');
            emailInput.classList.remove('form-group__input--error');
        });

        passwordInput.addEventListener('input', function () {
            passwordError.textContent = '';
            passwordError.classList.remove('form-group__error--visible');
            passwordInput.classList.remove('form-group__input--error');
        });
    }
});
