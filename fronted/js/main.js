// ==========================================
// GLOBAL SCRIPTS (Header, Menú Móvil)
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.header__menu-toggle');
    const nav = document.querySelector('.nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('nav--open');
            menuToggle.classList.toggle('header__menu-toggle--active');
        });
    }
});