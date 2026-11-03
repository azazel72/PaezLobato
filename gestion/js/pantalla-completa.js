'use strict';

(() => {
    const button = document.getElementById('toggle-fullscreen');
    const icon = button.querySelector('i');

    function updateButton() {
        const expanded = !!document.fullscreenElement;
        const label = expanded ? 'Restaurar vista' : 'Maximizar vista';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(expanded));
        icon.className = expanded ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen';
    }

    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {
            notify('No se pudo cambiar la pantalla completa en este navegador.', true);
        } finally {
            button.disabled = false;
            updateButton();
        }
    });

    document.addEventListener('fullscreenchange', updateButton);
    updateButton();
})();
