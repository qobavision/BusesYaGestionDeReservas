// Verificación de sesión en paneles

function verificarSesion(rolesPermitidos) {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    if (rolesPermitidos && rolesPermitidos.length) {
        const rol = (usuario.rol || '').toLowerCase();
        const idRol = usuario.id_rol;
        const permitido = rolesPermitidos.some(function (r) {
            if (typeof r === 'number') return idRol === r;
            return rol === String(r).toLowerCase() || rol.includes(String(r).toLowerCase());
        });

        if (!permitido) {
            alert('No tienes permiso para acceder a este panel.');
            window.location.href = 'login.html';
            return null;
        }
    }

    return usuario;
}

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}
