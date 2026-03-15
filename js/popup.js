document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const saveBtn = document.getElementById('save-selected-btn');
    const selectAllCb = document.getElementById('select-all');
    const stateNameInput = document.getElementById('state-name');
    
    const currentKeysList = document.getElementById('current-keys-list');
    const savedStatesList = document.getElementById('saved-states-list');
    const toastEl = document.getElementById('toast');
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const savedHeader = document.getElementById('saved-header');
    
    let currentHost = '';
    let currentLocalStorage = {};

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            
            if (btn.dataset.tab === 'saved') {
                loadSavedStates();
            } else {
                loadCurrentKeys();
            }
        });
    });

    // Helper functions
    function showToast(message, type = 'success') {
        toastEl.textContent = message;
        toastEl.className = `toast ${type}`;
        setTimeout(() => toastEl.classList.add('hidden'), 3000);
    }

    // --- Current Tab Logic ---
    async function loadCurrentKeys() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || tab.url.startsWith('chrome://')) {
            currentKeysList.innerHTML = '<li class="empty-state"><div class="empty-state-icon">🌐</div>No disponible en esta página.</li>';
            return;
        }

        const url = new URL(tab.url);
        currentHost = url.hostname;

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const data = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        data[key] = localStorage.getItem(key);
                    }
                    return data;
                }
            });

            currentLocalStorage = results[0]?.result || {};
            renderCurrentKeys();
        } catch (e) {
            console.error('Error inyectando script:', e);
            currentKeysList.innerHTML = '<li class="empty-state">Error al leer localStorage. Asegúrate de que la página haya cargado.</li>';
        }
    }

    function renderCurrentKeys() {
        const keys = Object.keys(currentLocalStorage);
        
        if (keys.length === 0) {
            currentKeysList.innerHTML = '<li class="empty-state"><div class="empty-state-icon">📭</div>El localStorage está vacío.</li>';
            updateSaveButton();
            return;
        }

        currentKeysList.innerHTML = '';
        keys.forEach(key => {
            const li = document.createElement('li');
            li.className = 'key-item';
            
            const value = currentLocalStorage[key] || '';
            const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;

            li.innerHTML = `
                <input type="checkbox" class="key-checkbox" value="${escapeHtml(key)}">
                <div class="key-content">
                    <div class="key-name">${escapeHtml(key)}</div>
                    <div class="key-value" title="${escapeHtml(value)}">${escapeHtml(displayValue)}</div>
                </div>
            `;
            currentKeysList.appendChild(li);
        });

        // Add listeners to new checkboxes
        document.querySelectorAll('.key-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSaveButton);
            cb.addEventListener('change', (e) => {
                const item = e.target.closest('.key-item');
                if (e.target.checked) item.classList.add('selected');
                else item.classList.remove('selected');
            });
        });
        
        selectAllCb.checked = false;
        updateSaveButton();
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function updateSaveButton() {
        const checked = document.querySelectorAll('.key-checkbox:checked').length;
        const hasName = stateNameInput.value.trim().length > 0;
        saveBtn.disabled = checked === 0 || !hasName;
    }

    stateNameInput.addEventListener('input', updateSaveButton);
    
    refreshBtn.addEventListener('click', () => {
        currentKeysList.innerHTML = '<li class="empty-state"><div class="loader"></div>Buscando...</li>';
        loadCurrentKeys();
    });

    selectAllCb.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.key-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const item = cb.closest('.key-item');
            if (e.target.checked) item.classList.add('selected');
            else item.classList.remove('selected');
        });
        updateSaveButton();
    });

    saveBtn.addEventListener('click', async () => {
        const selectedKeys = Array.from(document.querySelectorAll('.key-checkbox:checked')).map(cb => cb.value);
        const stateName = stateNameInput.value.trim();
        
        if (selectedKeys.length === 0 || !stateName) return;

        const stateData = {};
        selectedKeys.forEach(key => {
            stateData[key] = currentLocalStorage[key];
        });

        const newState = {
            id: Date.now().toString(),
            name: stateName,
            host: currentHost,
            date: new Date().toLocaleString(),
            data: stateData,
            keysCount: selectedKeys.length
        };

        const { savedStates = [] } = await chrome.storage.local.get('savedStates');
        savedStates.push(newState);
        
        await chrome.storage.local.set({ savedStates });
        
        showToast('Estado guardado con éxito');
        stateNameInput.value = '';
        updateSaveButton();
        
        selectAllCb.checked = false;
        document.querySelectorAll('.key-checkbox').forEach(cb => {
            cb.checked = false;
            cb.closest('.key-item').classList.remove('selected');
        });
    });

    // --- Saved Tab Logic ---
    async function loadSavedStates() {
        const { savedStates = [] } = await chrome.storage.local.get('savedStates');
        
        let host = currentHost;
        if (!host) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                host = new URL(tab.url).hostname;
            }
        }

        const hostStates = savedStates.filter(s => s.host === host);

        if (hostStates.length === 0) {
            savedStatesList.innerHTML = `<li class="empty-state"><div class="empty-state-icon">📂</div>No hay estados guardados para ${host || 'este sitio'}.</li>`;
            if (savedHeader) savedHeader.style.display = 'none';
            return;
        }

        if (savedHeader) savedHeader.style.display = 'flex';
        hostStates.sort((a, b) => b.id - a.id);

        savedStatesList.innerHTML = '';
        hostStates.forEach(state => {
            const li = document.createElement('li');
            li.className = 'state-item';
            
            li.innerHTML = `
                <div class="state-content">
                    <div class="state-name">${escapeHtml(state.name)}</div>
                    <div class="state-meta">
                        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${state.keysCount} var</span>
                        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${escapeHtml(state.date)}</span>
                    </div>
                </div>
                <div class="state-actions">
                    <button class="btn success action-restore" data-id="${state.id}" title="Restaurar a la página">Aplicar</button>
                    <button class="btn danger action-delete icon-btn" data-id="${state.id}" title="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
            `;
            savedStatesList.appendChild(li);
        });

        document.querySelectorAll('.action-restore').forEach(btn => {
            btn.addEventListener('click', (e) => restoreState(e.currentTarget.dataset.id));
        });
        
        document.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteState(e.currentTarget.dataset.id));
        });
    }

    async function restoreState(id) {
        const { savedStates = [] } = await chrome.storage.local.get('savedStates');
        const state = savedStates.find(s => s.id === id);
        
        if (!state) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || tab.url.startsWith('chrome://')) {
            showToast('No se puede restaurar aquí', 'danger');
            return;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (data) => {
                    for (const [key, value] of Object.entries(data)) {
                        localStorage.setItem(key, value);
                    }
                },
                args: [state.data]
            });
            showToast('Estado restaurado!');
        } catch(e) {
            console.error('Restore error:', e);
            showToast('Error al restaurar', 'danger');
        }
    }

    async function deleteState(id) {
        const { savedStates = [] } = await chrome.storage.local.get('savedStates');
        const state = savedStates.find(s => s.id === id);
        
        if (!confirm(`¿Estás seguro de eliminar el estado "${state ? state.name : ''}"?`)) return;
        
        const newStates = savedStates.filter(s => s.id !== id);
        await chrome.storage.local.set({ savedStates: newStates });
        
        loadSavedStates();
        showToast('Estado eliminado');
    }

    // Init
    loadCurrentKeys();
    
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', async () => {
            let host = currentHost;
            if (!host) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && !tab.url.startsWith('chrome://')) {
                    host = new URL(tab.url).hostname;
                }
            }
            
            if (!confirm(`¿Estás seguro de que quieres eliminar todos los estados de ${host}?`)) return;
            
            const { savedStates = [] } = await chrome.storage.local.get('savedStates');
            const newStates = savedStates.filter(s => s.host !== host);
            await chrome.storage.local.set({ savedStates: newStates });
            
            loadSavedStates();
            showToast('Todos los estados eliminados');
        });
    }
});
