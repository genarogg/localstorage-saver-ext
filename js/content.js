// Inyecta el selector de estados guardados en la página
function injectSelector() {
    // Obtener configuración
    chrome.storage.local.get('settings', async (result) => {
        const settings = result.settings || {};
        const enableSelector = settings.enableSelector !== false; // true por defecto
        
        if (!enableSelector) return;
        
        // Obtener estados guardados
        chrome.storage.local.get('savedStates', async (storageResult) => {
            const savedStates = storageResult.savedStates || [];
            const currentHost = window.location.hostname;
            const hostStates = savedStates.filter(s => s.host === currentHost).sort((a, b) => b.id - a.id);
            
            if (hostStates.length === 0) return;
            
            // Esperar a que exista body
            while (!document.body) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Evitar duplicados
            if (document.getElementById('ls-saver-container')) return;
            
            // Crear y agregar estilos
            const style = document.createElement('style');
            style.textContent = `
                #ls-saver-container {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 999999 !important;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }
                
                #ls-saver-selector {
                    appearance: none;
                    background: rgba(15, 23, 42, 0.95) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    color: #f8fafc !important;
                    padding: 10px 12px !important;
                    padding-right: 32px !important;
                    border-radius: 8px !important;
                    font-size: 0.85rem !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-backdrop-filter: blur(8px) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 8px center !important;
                    background-size: 16px !important;
                }
                
                #ls-saver-selector:hover {
                    border-color: rgba(255, 255, 255, 0.2) !important;
                    background-color: rgba(15, 23, 42, 0.99) !important;
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
                }
                
                #ls-saver-selector:focus {
                    outline: none !important;
                    border-color: #6366f1 !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                }
            `;
            
            // Crear contenedor
            const container = document.createElement('div');
            container.id = 'ls-saver-container';
            container.innerHTML = `
                <select id="ls-saver-selector">
                    <option value="">⚡ Estados guardados</option>
                    ${hostStates.map(state => `<option value="${state.id}">${state.name}</option>`).join('')}
                </select>
            `;
            
            // Inyectar en el documento
            document.head.appendChild(style);
            document.body.appendChild(container);
            
            // Event listener para restaurar
            const selector = document.getElementById('ls-saver-selector');
            if (selector) {
                selector.addEventListener('change', (e) => {
                    if (!e.target.value) return;
                    
                    const state = hostStates.find(s => s.id === e.target.value);
                    if (state) {
                        for (const [key, value] of Object.entries(state.data)) {
                            localStorage.setItem(key, value);
                        }
                        
                        showToast('✨ Estado restaurado');
                        e.target.value = '';
                        
                        // Recargar si está habilitado
                        if (settings.autoReload) {
                            setTimeout(() => window.location.reload(), 500);
                        }
                    }
                });
            }
            
            function showToast(message) {
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 999999;
                    animation: fadeInOut 2s ease-in-out;
                `;
                toast.textContent = message;
                
                const keyframes = document.createElement('style');
                keyframes.textContent = `
                    @keyframes fadeInOut {
                        0% { opacity: 0; transform: translateY(10px); }
                        10% { opacity: 1; transform: translateY(0); }
                        90% { opacity: 1; transform: translateY(0); }
                        100% { opacity: 0; transform: translateY(10px); }
                    }
                `;
                document.head.appendChild(keyframes);
                document.body.appendChild(toast);
                
                setTimeout(() => toast.remove(), 2000);
            }
        });
    });
}

// Ejecutar cuando el documento esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSelector);
} else {
    injectSelector();
}

