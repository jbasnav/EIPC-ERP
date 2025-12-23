// Global variables
let currentView = 'inicio';

// ============================================
// COMPRAS DASHBOARD STATE (declared early to avoid initialization errors)
// ============================================
let comprasMensualesChartInstance = null;
let comprasAnualChartInstance = null;
let comprasState = {
    year: new Date().getFullYear(),
    tipos: [],
    familias: [],
    subfamilias: [],
    data: null
};

// Global State
let appData = {
    raw: [],
    articulos: [],
    analysis: null,
    lastUpdate: null,
    sort: { col: 'numero orden', dir: 'desc' },
    filters: {},
    pagination: {
        currentPage: 1,
        pageSize: 50,
        totalFiltered: 0
    },
    articulosPagination: {
        currentPage: 1,
        pageSize: 50,
        totalFiltered: 0,
        allData: []
    },
    rutasPagination: {
        currentPage: 1,
        pageSize: 50,
        totalFiltered: 0,
        allData: []
    },
    rutas: {
        data: [],
        allData: [], // Store all fetched data for client-side filtering
        articulo: '',
        ruta: 'PR',
        tipos: []
    },
    articuloDetalle: null,
    currentUser: null,  // Track logged-in user: { id, name, initials }
    bonosPagination: {
        currentPage: 1,
        pageSize: 50,
        totalFiltered: 0,
        totalPages: 1,
        sortBy: 'fecha',
        sortOrder: 'DESC'
    },
    utillajesPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    utillajesSort: {
        col: 'codigo utillaje',
        dir: 'asc'
    },
    proveedoresPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    incidenciasPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    materialesPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    normasPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    clientesPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    operariosPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    operacionesPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    codigosRechazoPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    centrosPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    },
    activosPagination: {
        currentPage: 1,
        pageSize: 50,
        allData: []
    }
};

// Charts Instances
let charts = {};

// DOM Elements
const elements = {
    loading: document.getElementById('loadingOverlay'),
    views: document.querySelectorAll('.view-section'),
    navItems: document.querySelectorAll('.nav-item'),
    lastUpdate: document.getElementById('lastUpdate'),
    connectionStatus: document.getElementById('connectionStatus'),
    pageTitle: document.getElementById('pageTitle'),
    themeToggle: document.getElementById('themeToggle'),
    refreshBtn: document.getElementById('refreshBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupLoginEventListeners();  // Setup login-related events first
    setupEventListeners();

    // Check if user is already logged in
    if (checkUserSession()) {
        // User is logged in, proceed with app initialization
        initializeApp();
    }
    // If not logged in, login screen is already visible

    if (typeof Chart !== 'undefined') {
        Chart.defaults.animation.duration = 750;
    }
});

// Initialize app after successful login
function initializeApp() {
    fetchAllData();
    loadOperariosSecciones();
    loadOperacionesSecciones();
    loadActivosZonas();
    switchView('inicio');
}

// Switch between views
async function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

    // Show selected view
    const selectedView = document.getElementById(`${viewName}View`);
    if (selectedView) {
        selectedView.classList.add('active');

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (navItem) navItem.classList.add('active');

        // Update header based on view - COMPLETELY RECONSTRUCT HEADER TO ENSURE VISIBILITY
        const headerTitleContainer = document.querySelector('.header-title');
        if (headerTitleContainer) {
            console.log('Updating header for view:', viewName);
            if (viewName === 'otd') {
                headerTitleContainer.innerHTML = `
                    <h1 id="pageTitle" style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                        <i class="ri-truck-line" style="color: #4f46e5; margin-right: 0.5rem;"></i>OTD - On Time Delivery
                    </h1>
                    <p id="pageSubtitle" style="margin: 0; color: #64748b; font-size: 0.875rem; display: block;">
                        Gestión y análisis de entregas a tiempo
                    </p>
                `;
            } else if (viewName === 'capa-charge') {
                headerTitleContainer.innerHTML = `
                    <h1 id="pageTitle" style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                        <i class="ri-bar-chart-grouped-line" style="color: #4f46e5; margin-right: 0.5rem;"></i>Capa Charge
                    </h1>
                    <p id="pageSubtitle" style="margin: 0; color: #64748b; font-size: 0.875rem; display: block;">
                        Gestión y análisis de capacidad de carga comercial
                    </p>
                `;
            } else {
                // Default behavior
                const niceName = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-', ' ');
                headerTitleContainer.innerHTML = `
                    <h1 id="pageTitle" style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">${niceName}</h1>
                    <p id="pageSubtitle" style="display: none;"></p>
                `;
            }
        } else {
            console.error('Header Title Container not found');
        }

        // Perform view-specific data loading
        if (viewName === 'orders') {
            if (appData.raw.length === 0) {
                await fetchAllData();
            } else {
                // If data exists but wasn't analyzed (e.g. page reload), analyze it
                if (appData.analysis.uniqueOrders === 0) analyzeData();
                updateUI();
            }
        } else if (viewName === 'articulos') {
            if (!appData.articulos || appData.articulos.length === 0) {
                await fetchAllData(); // fetches articulos too
            } else {
                renderArticulosTable(appData.articulos);
            }
            // Ensure filter options are loaded
            if (appData.articulosFilterData) {
                updateArticulosFilterOptions();
                // updateArticulosTipoFilter(appData.articulosFilterData.tipos);
            }
        } else if (viewName === 'rutas') {
            // Load filters if needed
            loadRutasFiltros();
            loadFasesSelect();
        } else if (viewName === 'operarios') {
            loadOperariosSecciones();
            fetchOperarios();
        } else if (viewName === 'operaciones') {
            loadOperacionesSecciones();
            fetchOperaciones();
        } else if (viewName === 'activos') {
            fetchActivos();
        } else if (viewName === 'equipos') {
            fetchEquipos();
        } else if (viewName === 'codigos-rechazo') {
            loadCodigosRechazoSecciones();
            fetchCodigosRechazo();
        } else if (viewName === 'materiales') {
            fetchMateriales();
        } else if (viewName === 'clientes') {
            fetchClientes();
        } else if (viewName === 'incidencias') {
            loadIncidenciasFilters();
            fetchIncidencias();
        } else if (viewName === 'ausencias') {
            fetchAusencias();
        } else if (viewName === 'utillajes') {
            fetchUtillajesFiltros();
            fetchUtillajes();
        } else if (viewName === 'ensayos-vt') {
            fetchEnsayosVt();
        } else if (viewName === 'ensayos-pt') {
            fetchEnsayosPt();
        } else if (viewName === 'ensayos-rt') {
            fetchEnsayosRt();
        } else if (viewName === 'ensayos-dureza') {
            fetchEnsayosDureza();
        } else if (viewName === 'ensayos-traccion') {
            fetchEnsayosTraccion();
        } else if (viewName === 'ensayos-metalografia') {
            fetchEnsayosMetalografia();
        } else if (viewName === 'dashboard') {
            analyzeData();
            updateUI();
        } else if (viewName === 'personal-dashboard') {
            fetchPersonalDashboard();
        } else if (viewName === 'inicio') {
            fetchDashboardGeneral();
        } else if (viewName === 'compras-dashboard') {
            fetchComprasDashboard();
        } else if (viewName === 'comercial-dashboard') {
            fetchComercialDashboard();
        } else if (viewName === 'otd') {
            fetchOTD();
        } else if (viewName === 'capa-charge') {
            fetchCapaCharge();
        }
    }
}

// Event Listeners
function setupEventListeners() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.refreshBtn.addEventListener('click', fetchAllData);

    // Dashboard year filter
    document.getElementById('dashboardYearFilter')?.addEventListener('change', () => {
        analyzeData();
        updateUI();
    });

    // Familia Filter - cascades to subfamilia and articulo
    document.getElementById('familiaFilter')?.addEventListener('change', (e) => {
        appData.filters['familia'] = e.target.value;
        appData.filters['subfamilia'] = '';
        appData.filters['articulo'] = '';
        appData.filters['sequence'] = '';
        appData.filters['hasReprocess'] = '';
        document.getElementById('subfamiliaFilter').value = '';
        document.getElementById('articuloFilter').value = '';
        document.getElementById('sequenceFilterSelect').value = '';
        document.getElementById('reprocessFilter').value = '';

        updateSubfamiliaFilter();
        updateArticuloFilterByFilters();

        appData.pagination.currentPage = 1;
        filterOrders();
    });

    // Subfamilia Filter - cascades to articulo
    document.getElementById('subfamiliaFilter')?.addEventListener('change', (e) => {
        appData.filters['subfamilia'] = e.target.value;
        appData.filters['articulo'] = '';
        appData.filters['sequence'] = '';
        appData.filters['hasReprocess'] = '';
        document.getElementById('articuloFilter').value = '';
        document.getElementById('sequenceFilterSelect').value = '';
        document.getElementById('reprocessFilter').value = '';

        updateArticuloFilterByFilters();

        appData.pagination.currentPage = 1;
        filterOrders();
    });

    // Orden Filter (text input with debounce)
    let ordenTimeout;
    document.getElementById('ordenFilter')?.addEventListener('input', (e) => {
        clearTimeout(ordenTimeout);
        ordenTimeout = setTimeout(() => {
            appData.filters['orden'] = e.target.value.trim();
            appData.pagination.currentPage = 1;
            filterOrders();
        }, 300);
    });

    // Articulo Filter
    document.getElementById('articuloFilter')?.addEventListener('change', (e) => {
        appData.filters['articulo'] = e.target.value;
        appData.filters['sequence'] = '';
        appData.filters['hasReprocess'] = '';
        document.getElementById('sequenceFilterSelect').value = '';
        document.getElementById('reprocessFilter').value = '';
        appData.pagination.currentPage = 1;
        filterOrders();
    });

    document.getElementById('reprocessFilter')?.addEventListener('change', (e) => {
        appData.filters['hasReprocess'] = e.target.value;
        appData.pagination.currentPage = 1;
        filterOrders();
    });

    document.getElementById('sequenceFilterSelect')?.addEventListener('change', (e) => {
        appData.filters['sequence'] = e.target.value;
        appData.pagination.currentPage = 1;
        filterOrders();
    });

    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (appData.pagination.currentPage > 1) {
            appData.pagination.currentPage--;
            filterOrders();
        }
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.pagination.totalFiltered / appData.pagination.pageSize);
        if (appData.pagination.currentPage < totalPages) {
            appData.pagination.currentPage++;
            filterOrders();
        }
    });

    // Generic sorting for Orders Table
    document.querySelectorAll('#ordersTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (appData.sort.col === col) {
                appData.sort.dir = appData.sort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                appData.sort.col = col;
                appData.sort.dir = 'asc';
            }
            updateSortIcons();
            filterOrders();
        });
    });

    // Utillajes Sorting
    document.querySelectorAll('#utillajesTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (!col) return;

            console.log('Sorting utillajes by:', col);

            // Initialize sort state for utillajes if not exists
            if (!appData.utillajesSort) appData.utillajesSort = { col: 'codigo utillaje', dir: 'asc' };

            if (appData.utillajesSort.col === col) {
                appData.utillajesSort.dir = appData.utillajesSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                appData.utillajesSort.col = col;
                appData.utillajesSort.dir = 'asc';
            }

            // Update icons
            document.querySelectorAll('#utillajesTable th.sortable i').forEach(i => i.className = 'ri-arrow-up-down-line sort-icon');
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = appData.utillajesSort.dir === 'asc' ? 'ri-arrow-up-line sort-icon' : 'ri-arrow-down-line sort-icon';
            }

            // For utillajes, we prefer server-side sorting to ensure accuracy with pagination
            fetchUtillajes();
        });
    });

    document.getElementById('trendChartType')?.addEventListener('change', () => {
        updateCharts(appData.analysis);
    });

    // Rutas event listeners
    document.getElementById('buscarRutasBtn')?.addEventListener('click', () => {
        fetchRutas();
    });

    // Allow Enter key to search in rutas
    document.getElementById('rutasArticuloFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchRutas();
        }
    });

    // Ensayos Listeners
    document.getElementById('buscarEnsayosVtBtn')?.addEventListener('click', fetchEnsayosVt);
    document.getElementById('buscarEnsayosPtBtn')?.addEventListener('click', fetchEnsayosPt);
    document.getElementById('buscarEnsayosRtBtn')?.addEventListener('click', fetchEnsayosRt);
    document.getElementById('buscarEnsayosDurezaBtn')?.addEventListener('click', fetchEnsayosDureza);
    document.getElementById('buscarEnsayosTraccionBtn')?.addEventListener('click', fetchEnsayosTraccion);
    document.getElementById('buscarEnsayosMetalografiaBtn')?.addEventListener('click', fetchEnsayosMetalografia);

    // Maestros Listeners
    document.getElementById('buscarOperariosBtn')?.addEventListener('click', fetchOperarios);
    document.getElementById('buscarOperacionesBtn')?.addEventListener('click', fetchOperaciones);
    document.getElementById('buscarActivosBtn')?.addEventListener('click', fetchActivos);
    document.getElementById('buscarEquiposBtn')?.addEventListener('click', fetchEquipos);
    document.getElementById('buscarArticulosBtn')?.addEventListener('click', fetchArticulosForTable);

    // When article is entered, clear the operation
    document.getElementById('rutasArticuloFilter')?.addEventListener('input', (e) => {
        if (e.target.value.trim()) {
            document.getElementById('rutasOperacionFilter').value = '';
        }
    });

    document.getElementById('rutasRutaFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchRutas();
        }
    });

    // When operation is selected, clear the article input and reload fases
    document.getElementById('rutasOperacionFilter')?.addEventListener('change', (e) => {
        if (e.target.value) {
            document.getElementById('rutasArticuloFilter').value = '';
        }
        loadFasesSelect();
    });

    // Secondary filters for Rutas - use client-side filtering
    document.getElementById('rutasTipoFilter')?.addEventListener('change', () => {
        appData.rutasPagination.currentPage = 1;
        filterRutasClientSide();
    });

    // Rutas Fase Filter
    document.getElementById('rutasFaseFilter')?.addEventListener('change', () => {
        appData.rutasPagination.currentPage = 1;
        filterRutasClientSide();
    });

    // Rutas Control Filter
    document.getElementById('rutasControlFilter')?.addEventListener('change', () => {
        appData.rutasPagination.currentPage = 1;
        filterRutasClientSide();
    });

    // Rutas Familia Filter - triggers server-side filtering
    document.getElementById('rutasFamiliaFilter')?.addEventListener('change', () => {
        appData.rutasPagination.currentPage = 1;
        fetchRutas();
    });

    // Rutas Clasificacion Filter - triggers server-side filtering
    document.getElementById('rutasClasificacionFilter')?.addEventListener('change', () => {
        appData.rutasPagination.currentPage = 1;
        fetchRutas();
    });

    // Articulos event listeners
    document.getElementById('buscarArticulosBtn')?.addEventListener('click', () => {
        fetchArticulosForTable();
    });

    document.getElementById('articulosTipoFilter')?.addEventListener('change', (e) => {
        // Reset dependent filters when tipo changes
        document.getElementById('articulosFamiliaFilter').innerHTML = '<option value="">Todas</option>';
        document.getElementById('articulosSubfamiliaFilter').innerHTML = '<option value="">Todas</option>';
        document.getElementById('articulosClienteFilter').value = '';  // Input field, not select
        document.getElementById('articulosMaterialFilter').innerHTML = '<option value="">Todos</option>';

        // Show/hide secondary filters row (Cliente and Material) based on tipo
        const secondaryFilters = document.getElementById('articulosSecondaryFilters');
        if (secondaryFilters) {
            if (e.target.value === '02') {
                secondaryFilters.style.display = 'flex';
            } else {
                secondaryFilters.style.display = 'none';
            }
        }

        // Update filter options for the new tipo
        updateArticulosFilterOptions();
    });

    document.getElementById('articulosFamiliaFilter')?.addEventListener('change', () => {
        // Reset subfamilia and material when familia changes
        document.getElementById('articulosSubfamiliaFilter').value = '';
        document.getElementById('articulosMaterialFilter').value = '';
        // Fetch updated filter options
        updateArticulosFilterOptions();
    });

    document.getElementById('articulosSubfamiliaFilter')?.addEventListener('change', () => {
        // Update material options when subfamilia changes
        updateArticulosFilterOptions();
    });

    // Cliente filter - when changed, reset material and update options
    document.getElementById('articulosClienteFilter')?.addEventListener('change', () => {
        document.getElementById('articulosMaterialFilter').value = '';
        updateArticulosFilterOptions();
    });

    // Articulos pagination event listeners
    document.getElementById('articulosPrevPageBtn')?.addEventListener('click', () => {
        if (appData.articulosPagination.currentPage > 1) {
            appData.articulosPagination.currentPage--;
            renderArticulosTablePage();
        }
    });

    document.getElementById('articulosNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.articulosPagination.totalFiltered / appData.articulosPagination.pageSize);
        if (appData.articulosPagination.currentPage < totalPages) {
            appData.articulosPagination.currentPage++;
            renderArticulosTablePage();
        }
    });

    // Rutas pagination event listeners
    document.getElementById('rutasPrevPageBtn')?.addEventListener('click', () => {
        if (appData.rutasPagination.currentPage > 1) {
            appData.rutasPagination.currentPage--;
            renderRutasTablePage();
        }
    });

    document.getElementById('rutasNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.rutasPagination.totalFiltered / appData.rutasPagination.pageSize);
        if (appData.rutasPagination.currentPage < totalPages) {
            appData.rutasPagination.currentPage++;
            renderRutasTablePage();
        }
    });

    // Modal close handlers
    document.getElementById('closeArticuloModal')?.addEventListener('click', closeArticuloModal);
    document.getElementById('articuloModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'articuloModal') closeArticuloModal();
    });

    // Operarios event listeners
    document.getElementById('buscarOperariosBtn')?.addEventListener('click', () => {
        fetchOperarios();
    });

    document.getElementById('operariosSeccionFilter')?.addEventListener('change', () => {
        fetchOperarios();
    });

    document.getElementById('operariosActivoFilter')?.addEventListener('change', () => {
        fetchOperarios();
    });

    document.getElementById('operariosACalculoFilter')?.addEventListener('change', () => {
        fetchOperarios();
    });

    // Operaciones event listeners
    document.getElementById('buscarOperacionesBtn')?.addEventListener('click', () => {
        fetchOperaciones();
    });

    // When operacion dropdown changes, reset seccion filter
    document.getElementById('operacionesCodigoFilter')?.addEventListener('change', () => {
        document.getElementById('operacionesSeccionFilter').value = '';
        fetchOperaciones();
    });

    // Activos event listeners
    document.getElementById('buscarActivosBtn')?.addEventListener('click', () => {
        fetchActivos();
    });

    document.getElementById('activosCodigoFilter')?.addEventListener('change', () => {
        fetchActivos();
    });

    // Equipos event listeners
    document.getElementById('buscarEquiposBtn')?.addEventListener('click', () => {
        fetchEquipos();
    });

    document.getElementById('equiposRefFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchEquipos();
        }
    });

    // Codigos Rechazo Listeners
    document.getElementById('buscarCodigosRechazoBtn')?.addEventListener('click', fetchCodigosRechazo);
    document.getElementById('codigosRechazoSeccionFilter')?.addEventListener('change', fetchCodigosRechazo);
    document.getElementById('codigosRechazoControlFilter')?.addEventListener('change', fetchCodigosRechazo);
    document.getElementById('codigosRechazoCodigoFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchCodigosRechazo();
    });

    // Materiales Listeners
    document.getElementById('buscarMaterialesBtn')?.addEventListener('click', fetchMateriales);
    document.getElementById('materialesCodigoFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchMateriales();
    });

    // Clientes Listeners
    document.getElementById('buscarClientesBtn')?.addEventListener('click', fetchClientes);
    document.getElementById('clienteFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchClientes();
    });

    // Clientes Pagination
    document.getElementById('clientesPrevPageBtn')?.addEventListener('click', () => {
        if (appData.clientesPagination.currentPage > 1) {
            appData.clientesPagination.currentPage--;
            renderClientesTablePage();
        }
    });
    document.getElementById('clientesNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.clientesPagination.allData.length / appData.clientesPagination.pageSize);
        if (appData.clientesPagination.currentPage < totalPages) {
            appData.clientesPagination.currentPage++;
            renderClientesTablePage();
        }
    });

    // Operarios Pagination
    document.getElementById('operariosPrevPageBtn')?.addEventListener('click', () => {
        if (appData.operariosPagination.currentPage > 1) {
            appData.operariosPagination.currentPage--;
            renderOperariosTablePage();
        }
    });
    document.getElementById('operariosNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.operariosPagination.allData.length / appData.operariosPagination.pageSize);
        if (appData.operariosPagination.currentPage < totalPages) {
            appData.operariosPagination.currentPage++;
            renderOperariosTablePage();
        }
    });

    // Operaciones Pagination
    document.getElementById('operacionesPrevPageBtn')?.addEventListener('click', () => {
        if (appData.operacionesPagination.currentPage > 1) {
            appData.operacionesPagination.currentPage--;
            renderOperacionesTablePage();
        }
    });
    document.getElementById('operacionesNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.operacionesPagination.allData.length / appData.operacionesPagination.pageSize);
        if (appData.operacionesPagination.currentPage < totalPages) {
            appData.operacionesPagination.currentPage++;
            renderOperacionesTablePage();
        }
    });

    // Codigos Rechazo Pagination
    document.getElementById('codigosRechazoPrevPageBtn')?.addEventListener('click', () => {
        if (appData.codigosRechazoPagination.currentPage > 1) {
            appData.codigosRechazoPagination.currentPage--;
            renderCodigosRechazoTablePage();
        }
    });
    document.getElementById('codigosRechazoNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.codigosRechazoPagination.allData.length / appData.codigosRechazoPagination.pageSize);
        if (appData.codigosRechazoPagination.currentPage < totalPages) {
            appData.codigosRechazoPagination.currentPage++;
            renderCodigosRechazoTablePage();
        }
    });

    // Centros Pagination
    document.getElementById('centrosPrevPageBtn')?.addEventListener('click', () => {
        if (appData.centrosPagination.currentPage > 1) {
            appData.centrosPagination.currentPage--;
            renderCentrosTablePage();
        }
    });
    document.getElementById('centrosNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.centrosPagination.allData.length / appData.centrosPagination.pageSize);
        if (appData.centrosPagination.currentPage < totalPages) {
            appData.centrosPagination.currentPage++;
            renderCentrosTablePage();
        }
    });

    // Activos Pagination
    document.getElementById('activosPrevPageBtn')?.addEventListener('click', () => {
        if (appData.activosPagination.currentPage > 1) {
            appData.activosPagination.currentPage--;
            renderActivosTablePage();
        }
    });
    document.getElementById('activosNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.activosPagination.allData.length / appData.activosPagination.pageSize);
        if (appData.activosPagination.currentPage < totalPages) {
            appData.activosPagination.currentPage++;
            renderActivosTablePage();
        }
    });

    // Materiales Pagination
    document.getElementById('materialesPrevPageBtn')?.addEventListener('click', () => {
        if (appData.materialesPagination.currentPage > 1) {
            appData.materialesPagination.currentPage--;
            renderMaterialesTablePage();
        }
    });
    document.getElementById('materialesNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(appData.materialesPagination.allData.length / appData.materialesPagination.pageSize);
        if (appData.materialesPagination.currentPage < totalPages) {
            appData.materialesPagination.currentPage++;
            renderMaterialesTablePage();
        }
    });

    // Utillajes Listeners
    document.getElementById('utillajesSearchBtn')?.addEventListener('click', fetchUtillajes);
    document.getElementById('utillajesTipoFilter')?.addEventListener('change', fetchUtillajes);
    document.getElementById('utillajesFamiliaFilter')?.addEventListener('change', fetchUtillajes);
    document.getElementById('utillajesSituacionFilter')?.addEventListener('change', fetchUtillajes);
    document.getElementById('utillajesActivoFilter')?.addEventListener('change', fetchUtillajes);

    // Allow Enter key in utillajes inputs
    ['utillajesCodigoFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchUtillajes();
        });
    });
}

// Fetch all data (tratamientos + articulos tipo 02)
async function fetchAllData() {
    showLoading(true);
    try {
        const [tratamientosRes, articulosRes] = await Promise.all([
            fetch('http://localhost:3001/api/tratamientos'),
            fetch('http://localhost:3001/api/articulos')
        ]);

        const tratamientosData = await tratamientosRes.json();
        const articulosData = await articulosRes.json();

        if (tratamientosData.success) {
            appData.raw = tratamientosData.data;
        }

        if (articulosData.success) {
            appData.articulos = articulosData.data;
            appData.articulosMap = {};
            articulosData.data.forEach(art => {
                appData.articulosMap[art['codigo articulo']] = art;
            });

            // Initialize articulos table filter data if available
            if (articulosData.tipos) {
                appData.articulosFilterData = {
                    tipos: articulosData.tipos || [],
                    familias: articulosData.familias || [],
                    subfamilias: articulosData.subfamilias || [],
                    materiales: articulosData.materiales || []
                };

                // Update filter dropdowns
                updateArticulosTipoFilter(articulosData.tipos || []);
                updateArticulosFamiliaFilter(articulosData.familias || []);
                updateArticulosMaterialFilter(articulosData.materiales || []);
            }
        }

        appData.lastUpdate = new Date();
        updateConnectionStatus(true);

        updateFamiliaFilter();
        updateSubfamiliaFilter();

        analyzeData();
        updateUI();

    } catch (error) {
        console.error('Error fetching data:', error);
        updateConnectionStatus(false);
        alert('Error conectando al servidor. Asegurate de que el backend este corriendo.');
    } finally {
        showLoading(false);
    }
}

// Fetch Rutas data
async function fetchRutas() {
    const articuloInput = document.getElementById('rutasArticuloFilter');
    const operacionInput = document.getElementById('rutasOperacionFilter');
    const rutaInput = document.getElementById('rutasRutaFilter');
    const tbody = document.getElementById('rutasTableBody');
    const infoDiv = document.getElementById('rutasInfo');
    const countSpan = document.getElementById('rutasResultCount');
    const secondaryFilters = document.getElementById('rutasSecondaryFilters');

    const articulo = articuloInput?.value.trim() || '';
    const operacion = operacionInput?.value || '';  // Now a simple select
    const ruta = rutaInput?.value.trim() || '';

    // Reset secondary filters (but not Fase which is in primary)
    const tipoFilter = document.getElementById('rutasTipoFilter');
    const controlFilter = document.getElementById('rutasControlFilter');
    if (tipoFilter) tipoFilter.value = '';
    if (controlFilter) controlFilter.value = '';

    if (!articulo && !operacion) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-alert-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; color: #f97316;"></i>
                    Por favor, introduce un codigo de articulo u operacion
                </td>
            </tr>
        `;
        infoDiv.style.display = 'none';
        secondaryFilters.style.display = 'none';
        return;
    }

    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Buscando rutas...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        const faseFilter = document.getElementById('rutasFaseFilter')?.value || '';
        const familiaFilter = document.getElementById('rutasFamiliaFilter')?.value || '';
        const clasificacionFilter = document.getElementById('rutasClasificacionFilter')?.value || '';
        if (articulo) params.append('articulo', articulo);
        if (operacion) params.append('operacion', operacion);
        if (faseFilter) params.append('fase', faseFilter);
        if (ruta) params.append('ruta', ruta);
        if (familiaFilter) params.append('familia', familiaFilter);
        if (clasificacionFilter) params.append('clasificacion', clasificacionFilter);

        let url = `http://localhost:3001/api/rutas?${params.toString()}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            appData.rutas.allData = data.data; // Store all data for client-side filtering
            appData.rutas.data = data.data;
            appData.rutas.articulo = articulo;
            appData.rutas.ruta = ruta;
            appData.rutas.tipos = data.tipos || [];
            appData.rutas.fases = data.fases || [];
            appData.rutas.familias = data.familias || [];
            appData.rutas.clasificaciones = data.clasificaciones || [];

            // Populate tipo dropdown
            const tipoSelect = document.getElementById('rutasTipoFilter');
            tipoSelect.innerHTML = '<option value="">Todos</option>';
            appData.rutas.tipos.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                tipoSelect.appendChild(option);
            });

            // Populate fase dropdown
            const faseSelect = document.getElementById('rutasFaseFilter');
            const currentFase = faseSelect?.value || '';
            faseSelect.innerHTML = '<option value="">Todas</option>';
            appData.rutas.fases.forEach(fase => {
                const option = document.createElement('option');
                option.value = fase;
                option.textContent = fase;
                if (fase === currentFase) option.selected = true;
                faseSelect.appendChild(option);
            });

            // Populate familia dropdown
            const familiaSelect = document.getElementById('rutasFamiliaFilter');
            const currentFamilia = familiaSelect?.value || '';
            familiaSelect.innerHTML = '<option value="">Todas</option>';
            appData.rutas.familias.forEach(fam => {
                const option = document.createElement('option');
                option.value = fam['codigo familia'];
                option.textContent = fam['denominacion familia'] ? `${fam['codigo familia']} - ${fam['denominacion familia']}` : fam['codigo familia'];
                if (fam['codigo familia'] === currentFamilia) option.selected = true;
                familiaSelect.appendChild(option);
            });

            // Populate clasificacion dropdown
            const clasificacionSelect = document.getElementById('rutasClasificacionFilter');
            const currentClasif = clasificacionSelect?.value || '';
            clasificacionSelect.innerHTML = '<option value="">Todas</option>';
            appData.rutas.clasificaciones.forEach(clasif => {
                const option = document.createElement('option');
                option.value = clasif;
                option.textContent = clasif;
                if (clasif === currentClasif) option.selected = true;
                clasificacionSelect.appendChild(option);
            });

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-file-unknow-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron rutas para los filtros aplicados
                        </td>
                    </tr>
                `;
                infoDiv.style.display = 'flex';
                countSpan.textContent = '0 registros encontrados';
                secondaryFilters.style.display = 'none';

                // Hide total time if no results
                document.getElementById('rutasTiempoTotalInfo').style.display = 'none';
                renderRutasTop10(data.top10Articulos || []);
                renderRutasTop10Operaciones(data.top10Operaciones || []);
            } else {
                renderRutasTable(data.data);
                infoDiv.style.display = 'flex';
                countSpan.textContent = `${data.data.length} registros encontrados`;
                secondaryFilters.style.display = 'flex';

                // Display total time if available
                const tiempoTotalInfo = document.getElementById('rutasTiempoTotalInfo');
                const tiempoTotalSpan = document.getElementById('rutasTiempoTotal');
                if (data.tiempoTotal != null && data.tiempoTotal > 0) {
                    const tiempo = parseFloat(String(data.tiempoTotal).replace(',', '.')); // Ensure it is a number
                    // Force European format (dot for thousands, comma for decimals): de-DE does this reliably
                    const formatoTiempo = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tiempo);
                    const horas = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tiempo / 60);

                    // Note: 'min' text is removed from HTML, so we include it here
                    tiempoTotalSpan.textContent = `${formatoTiempo} min (${horas} h)`;
                    tiempoTotalInfo.style.display = 'inline';
                } else {
                    tiempoTotalInfo.style.display = 'none';
                }

                renderRutasTop10(data.top10Articulos || []);
                renderRutasTop10Operaciones(data.top10Operaciones || []);
            }
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Error desconocido'}
                    </td>
                </tr>
            `;
            infoDiv.style.display = 'none';
            secondaryFilters.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching rutas:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexion. Verifica que el servidor este corriendo.
                </td>
            </tr>
        `;
        infoDiv.style.display = 'none';
        secondaryFilters.style.display = 'none';
    }
}

// Render current page of rutas table
function renderRutasTablePage() {
    const tbody = document.getElementById('rutasTableBody');
    if (!tbody) return;

    const { currentPage, pageSize, allData, totalFiltered } = appData.rutasPagination;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);
    const pageData = allData.slice(startIndex, endIndex);

    // Update pagination info
    const paginationInfo = document.getElementById('rutasPaginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalFiltered}`;
    }

    // Enable/disable pagination buttons
    const prevBtn = document.getElementById('rutasPrevPageBtn');
    const nextBtn = document.getElementById('rutasNextPageBtn');
    const totalPages = Math.ceil(totalFiltered / pageSize);

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    tbody.innerHTML = pageData.map(ruta => {
        // Build description: Operacion Code + Description (sin Fase, que ahora es columna separada)
        let descContent = `
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
                <div><strong>${ruta['codigo operacion'] || '-'}</strong></div>
                ${ruta.descripcion ? `<div style="font-size: 0.7rem; color: var(--text-muted); text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${ruta.descripcion}">${ruta.descripcion}</div>` : ''}
                ${ruta.descripcion2 ? `<div style="font-size: 0.7rem; color: #10b981; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${ruta.descripcion2}">${ruta.descripcion2}</div>` : ''}
            </div>
        `;

        // Format tiempo (round to 2 decimals if it's a number)
        let tiempoValue = '-';
        let tiempoBadge = false;
        const tiempoRaw = parseFloat(ruta['tiempo ejecucion unitario']);
        if (ruta['tiempo ejecucion unitario'] != null && ruta['tiempo ejecucion unitario'] !== '') {
            const formatted = isNaN(tiempoRaw) ? '-' : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tiempoRaw);
            // Si el tiempo es 0 o menor, mostrar como badge naranja
            if (!isNaN(tiempoRaw) && tiempoRaw <= 0) {
                tiempoValue = `<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316; font-weight: 600;">${formatted}</span>`;
                tiempoBadge = true;
            } else {
                tiempoValue = formatted;
            }
        }

        // Tipo badge: I = azul, E = naranja, otros = morado
        let tipoBadge = '-';
        const tipo = ruta.tipo || '';
        if (tipo === 'I') {
            tipoBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-weight: 600;">I</span>`;
        } else if (tipo === 'E') {
            tipoBadge = `<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316; font-weight: 600;">E</span>`;
        } else if (tipo) {
            tipoBadge = `<span class="badge" style="background: rgba(79, 70, 229, 0.1); color: var(--primary);">${tipo}</span>`;
        }

        return `
            <tr>
                <td style="text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ruta['cod de articulo'] || ''}">${ruta['cod de articulo'] || '-'}</td>
                <td style="text-align: center;"><strong>${ruta.secuencia || '-'}</strong></td>
                <td style="text-align: left;">${descContent}</td>
                <td style="text-align: left; font-size: 0.85rem;">${ruta.fase || '-'}</td>
                <td style="text-align: center;">${tipoBadge}</td>
                <td style="text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ruta.centro || ''} ${ruta.centroDescripcion || ''}">
                    <div>${ruta.centro || '-'}</div>
                    ${ruta.centroDescripcion ? `<div style="font-size: 0.65rem; color: var(--text-muted);">${ruta.centroDescripcion}</div>` : ''}
                </td>
                <td style="text-align: right;">${tiempoValue}</td>
                <td style="text-align: center;">
                    ${ruta.ControlProduccion
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
                : '<span style="color: #ef4444;"><i class="ri-close-circle-line"></i> No</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Render TOP 10 Rutas by Time
function renderRutasTop10(data) {
    const container = document.getElementById('rutasTop10Body');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">No hay datos</div>';
        return;
    }

    container.innerHTML = data.map((item, index) => {
        const tiempo = item.tiempoTotalArticulo != null ? item.tiempoTotalArticulo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' min' : '-';
        const medalColor = index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#cd7f32' : 'var(--text-muted)';

        return `
            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border);" 
                 onclick="document.getElementById('rutasArticuloFilter').value='${item.articulo}'; fetchRutas();"
                 onmouseover="this.style.background='var(--bg-body)'" onmouseout="this.style.background='transparent'">
                <span style="font-weight: 700; color: ${medalColor}; min-width: 18px; text-align: center; font-size: 0.75rem;">${index + 1}</span>
                <div style="flex: 1; min-width: 0; overflow: hidden;">
                    <div style="font-weight: 500; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.articulo || '-'}</div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.denominacion || ''}">${item.denominacion || '-'}</div>
                </div>
                <span style="font-weight: 600; color: var(--success); font-size: 0.7rem; white-space: nowrap;">${tiempo}</span>
            </div>
        `;
    }).join('');
}

// Render TOP 10 Rutas by Number of Operations
function renderRutasTop10Operaciones(data) {
    const container = document.getElementById('rutasTop10OperacionesBody');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">No hay datos</div>';
        return;
    }

    container.innerHTML = data.map((item, index) => {
        const medalColor = index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#cd7f32' : 'var(--text-muted)';
        const rutaLabel = item.ruta ? ` (${item.ruta})` : '';

        return `
            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border);" 
                 onclick="document.getElementById('rutasArticuloFilter').value='${item.articulo}'; fetchRutas();"
                 onmouseover="this.style.background='var(--bg-body)'" onmouseout="this.style.background='transparent'">
                <span style="font-weight: 700; color: ${medalColor}; min-width: 18px; text-align: center; font-size: 0.75rem;">${index + 1}</span>
                <div style="flex: 1; min-width: 0; overflow: hidden;">
                    <div style="font-weight: 500; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.articulo}${rutaLabel}</div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.denominacion || ''}">${item.denominacion || '-'}</div>
                </div>
                <span style="font-weight: 600; color: var(--primary); font-size: 0.7rem; white-space: nowrap;">${item.numOperaciones} ops</span>
            </div>
        `;
    }).join('');
}

// Load TOP 10 lists for Rutas view on entry (without requiring article filter)
async function loadRutasTop10() {
    try {
        // Call the rutas API to get just the TOP 10 data
        const response = await fetch('http://localhost:3001/api/rutas?ruta=PR');
        const data = await response.json();

        if (data.success) {
            renderRutasTop10(data.top10Articulos || []);
            renderRutasTop10Operaciones(data.top10Operaciones || []);
        }
    } catch (error) {
        console.error('Error loading Rutas TOP 10:', error);
    }
}

// Load TOP 10 list for Estructuras view on entry
async function loadEstructurasTop10() {
    const container = document.getElementById('estructurasTop10Body');
    if (!container) return;

    try {
        const response = await fetch('http://localhost:3001/api/estructuras?page=1&pageSize=1');
        const data = await response.json();

        if (data.success && data.top10Articulos) {
            renderEstructurasTop10(data.top10Articulos);
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">No hay datos</div>';
        }
    } catch (error) {
        console.error('Error loading Estructuras TOP 10:', error);
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">Error al cargar</div>';
    }
}

// Client-side filtering for Rutas (after initial search)
function filterRutasClientSide() {
    const tipoFilter = document.getElementById('rutasTipoFilter')?.value || '';
    const faseFilter = document.getElementById('rutasFaseFilter')?.value || '';
    const controlFilter = document.getElementById('rutasControlFilter')?.value || '';
    const countSpan = document.getElementById('rutasResultCount');

    let filtered = [...appData.rutas.allData];

    if (tipoFilter) {
        filtered = filtered.filter(r => r.tipo === tipoFilter);
    }

    if (faseFilter) {
        filtered = filtered.filter(r => r.fase === faseFilter);
    }

    if (controlFilter !== '') {
        const wantsControl = controlFilter === 'true';
        filtered = filtered.filter(r => Boolean(r.ControlProduccion) === wantsControl);
    }

    appData.rutas.data = filtered;
    renderRutasTable(filtered);
    countSpan.textContent = `${filtered.length} registros encontrados`;
}

// Render Rutas Table (with pagination)
function renderRutasTable(rutas) {
    const tbody = document.getElementById('rutasTableBody');
    const paginationBar = document.getElementById('rutasPaginationBar');

    if (rutas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-file-unknow-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron rutas con los filtros aplicados
                </td>
            </tr>
        `;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Store all data for pagination
    appData.rutasPagination.allData = rutas;
    appData.rutasPagination.totalFiltered = rutas.length;
    appData.rutasPagination.currentPage = 1;

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';

    // Render first page
    renderRutasTablePage();
}



// Load operaciones into select dropdown (optionally filtered by fase)
async function loadOperacionesSelect(fase = '') {
    const select = document.getElementById('rutasOperacionFilter');
    if (!select) return;

    try {
        let url = 'http://localhost:3001/api/operaciones';
        if (fase) {
            url += `?fase=${encodeURIComponent(fase)}`;
        }
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.operacionesList) {
            select.innerHTML = '<option value="">Todas</option>';
            data.operacionesList.forEach(op => {
                const option = document.createElement('option');
                option.value = op.codigo;
                option.textContent = `${op.codigo} - ${op.descripcion || ''}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading operaciones select:', error);
    }
}

// Load fases into select dropdown
async function loadFasesSelect() {
    const select = document.getElementById('rutasFaseFilter');
    const operacionSelect = document.getElementById('rutasOperacionFilter');
    const articuloInput = document.getElementById('rutasArticuloFilter');
    if (!select) return;

    const operacion = operacionSelect?.value || '';
    const articulo = articuloInput?.value.trim() || '';

    // Don't load fases if operacion is selected and no articulo
    if (operacion && !articulo) {
        select.innerHTML = '<option value="">Todas</option>';
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/fases');
        const data = await response.json();

        if (data.success && data.fases) {
            select.innerHTML = '<option value="">Todas</option>';
            data.fases.forEach(fase => {
                const option = document.createElement('option');
                option.value = fase;
                option.textContent = fase;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading fases select:', error);
    }
}

// Load rutas filter options (familia and clasificacion) at startup
async function loadRutasFiltros() {
    const familiaSelect = document.getElementById('rutasFamiliaFilter');
    const clasificacionSelect = document.getElementById('rutasClasificacionFilter');

    if (!familiaSelect && !clasificacionSelect) return;

    try {
        const response = await fetch('http://localhost:3001/api/rutas-filtros');
        const data = await response.json();

        if (data.success) {
            // Populate familia dropdown
            if (familiaSelect) {
                familiaSelect.innerHTML = '<option value="">Todas</option>';
                data.familias.forEach(fam => {
                    const option = document.createElement('option');
                    option.value = fam['codigo familia'];
                    option.textContent = fam['denominacion familia']
                        ? `${fam['codigo familia']} - ${fam['denominacion familia']}`
                        : fam['codigo familia'];
                    familiaSelect.appendChild(option);
                });
            }

            // Populate clasificacion dropdown
            if (clasificacionSelect) {
                clasificacionSelect.innerHTML = '<option value="">Todas</option>';
                data.clasificaciones.forEach(clasif => {
                    const option = document.createElement('option');
                    option.value = clasif;
                    option.textContent = clasif;
                    clasificacionSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading rutas filter options:', error);
    }
}

// Fetch Articulos for Table View
async function fetchArticulosForTable() {
    const tipoSelect = document.getElementById('articulosTipoFilter');
    const familiaSelect = document.getElementById('articulosFamiliaFilter');
    const subfamiliaSelect = document.getElementById('articulosSubfamiliaFilter');
    const clienteSelect = document.getElementById('articulosClienteFilter');
    const materialSelect = document.getElementById('articulosMaterialFilter');
    const tbody = document.getElementById('articulosTableBody');
    const infoDiv = document.getElementById('articulosInfo');
    const countSpan = document.getElementById('articulosResultCount');

    const tipo = tipoSelect?.value || '02';
    const familia = familiaSelect?.value || '';
    const subfamilia = subfamiliaSelect?.value || '';
    // Extract cliente code from datalist text (format: "CODE - Name")
    const clienteText = clienteSelect?.value || '';
    const cliente = appData.clientesMap?.[clienteText] || (clienteText.includes(' - ') ? clienteText.split(' - ')[0] : clienteText);
    const material = materialSelect?.value || '';

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                Cargando articulos...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (tipo) params.append('tipo', tipo);
        if (familia) params.append('familia', familia);
        if (subfamilia) params.append('subfamilia', subfamilia);
        if (cliente) params.append('cliente', cliente);
        if (material) params.append('material', material);

        const response = await fetch(`http://localhost:3001/api/articulos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Store data and filter options
            appData.articulosTableData = data.data;
            appData.articulosFilterData = {
                tipos: data.tipos || [],
                clientes: data.clientes || [],
                familias: data.familias || [],
                subfamilias: data.subfamilias || [],
                materiales: data.materiales || []
            };

            // Update filter dropdowns
            updateArticulosTipoFilter(data.tipos || []);
            updateArticulosFamiliaFilter(data.familias || []);
            updateArticulosSubfamiliaFilter(data.subfamilias || []);
            updateArticulosClienteFilter(data.clientes || []);
            updateArticulosMaterialFilter(data.materiales || []);

            renderArticulosTable(data.data);
            infoDiv.style.display = 'flex';
            countSpan.textContent = `${data.count} registros encontrados`;
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        Error: ${data.error || 'No se pudieron cargar los articulos'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching articulos:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexion: ${error.message}
                </td>
            </tr>
        `;
    }
}

// Update Tipo filter dropdown
function updateArticulosTipoFilter(tipos) {
    const select = document.getElementById('articulosTipoFilter');
    if (!select || tipos.length === 0) return;

    const currentValue = select.value;
    select.innerHTML = '';
    tipos.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo['codigo tipo'];
        option.textContent = `${tipo['codigo tipo']} - ${tipo['denominacion tipo'] || ''}`;
        // Select current value if exists, otherwise default to '02'
        if (tipo['codigo tipo'] === currentValue || (!currentValue && tipo['codigo tipo'] === '02')) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Update Familia filter dropdown
function updateArticulosFamiliaFilter(familias) {
    const select = document.getElementById('articulosFamiliaFilter');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    familias.forEach(familia => {
        const option = document.createElement('option');
        option.value = familia['codigo familia'];
        option.textContent = `${familia['codigo familia']} - ${familia['denominacion familia'] || ''}`;
        if (familia['codigo familia'] === currentValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Update Subfamilia filter dropdown
function updateArticulosSubfamiliaFilter(subfamilias) {
    const select = document.getElementById('articulosSubfamiliaFilter');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Todas</option>';

    if (subfamilias) {
        subfamilias.forEach(subfamilia => {
            const option = document.createElement('option');
            option.value = subfamilia['codigo subfamilia'];
            option.textContent = `${subfamilia['codigo subfamilia']} - ${subfamilia['denominacion subfamilia'] || ''}`;
            if (subfamilia['codigo subfamilia'] === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
}

// Fetch updated filter options without reloading table
async function updateArticulosFilterOptions() {
    const tipoSelect = document.getElementById('articulosTipoFilter');
    const familiaSelect = document.getElementById('articulosFamiliaFilter');
    const subfamiliaSelect = document.getElementById('articulosSubfamiliaFilter');
    const clienteSelect = document.getElementById('articulosClienteFilter');

    const tipo = tipoSelect?.value || '02';
    const familia = familiaSelect?.value || '';
    const subfamilia = subfamiliaSelect?.value || '';
    // Extract cliente code from datalist text (format: "CODE - Name")
    const clienteText = clienteSelect?.value || '';
    const cliente = appData.clientesMap?.[clienteText] || (clienteText.includes(' - ') ? clienteText.split(' - ')[0] : clienteText);

    try {
        const params = new URLSearchParams();
        if (tipo) params.append('tipo', tipo);
        if (familia) params.append('familia', familia);
        if (subfamilia) params.append('subfamilia', subfamilia);
        if (cliente) params.append('cliente', cliente);
        // Don't include material in filter options fetch

        const response = await fetch(`http://localhost:3001/api/articulos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Update all dependent filters
            updateArticulosFamiliaFilter(data.familias || []);
            updateArticulosSubfamiliaFilter(data.subfamilias || []);
            updateArticulosClienteFilter(data.clientes || []);
            updateArticulosMaterialFilter(data.materiales || []);
        }
    } catch (error) {
        console.error('Error updating filter options:', error);
    }
}

// Update Cliente filter datalist (for autocomplete search)
function updateArticulosClienteFilter(clientes) {
    const datalist = document.getElementById('clientesDatalist');
    if (!datalist) return;

    // Store clientes map for lookup
    appData.clientesMap = {};
    clientes.forEach(cliente => {
        const displayText = `${cliente['codigo cliente']} - ${cliente['nombre empresa'] || ''}`;
        appData.clientesMap[displayText] = cliente['codigo cliente'];
    });

    datalist.innerHTML = '';
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = `${cliente['codigo cliente']} - ${cliente['nombre empresa'] || ''}`;
        datalist.appendChild(option);
    });
}

// Update Material filter dropdown
function updateArticulosMaterialFilter(materiales) {
    const select = document.getElementById('articulosMaterialFilter');
    if (!select) return;

    select.innerHTML = '<option value="">Todos</option>';
    materiales.forEach(mat => {
        const option = document.createElement('option');
        option.value = mat;
        option.textContent = mat;
        select.appendChild(option);
    });
}

// Render Articulos Table (with pagination)
function renderArticulosTable(articulos) {
    const tbody = document.getElementById('articulosTableBody');
    const paginationBar = document.getElementById('articulosPaginationBar');
    if (!tbody) return;

    if (!articulos || articulos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-file-list-2-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron articulos
                </td>
            </tr>
        `;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Store all data for pagination
    appData.articulosPagination.allData = articulos;
    appData.articulosPagination.totalFiltered = articulos.length;
    appData.articulosPagination.currentPage = 1;

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';

    // Render first page
    renderArticulosTablePage();
}

// Render current page of articulos table
function renderArticulosTablePage() {
    const tbody = document.getElementById('articulosTableBody');
    if (!tbody) return;

    const { currentPage, pageSize, allData, totalFiltered } = appData.articulosPagination;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);
    const pageData = allData.slice(startIndex, endIndex);

    // Update pagination info
    const paginationInfo = document.getElementById('articulosPaginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalFiltered}`;
    }

    // Enable/disable pagination buttons
    const prevBtn = document.getElementById('articulosPrevPageBtn');
    const nextBtn = document.getElementById('articulosNextPageBtn');
    const totalPages = Math.ceil(totalFiltered / pageSize);

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    tbody.innerHTML = pageData.map(art => `
        <tr>
            <td>
                <a href="#" class="articulo-link" data-codigo="${art['codigo articulo']}" 
                   style="color: var(--primary); font-weight: 600; text-decoration: none; cursor: pointer;">
                    ${art['codigo articulo'] || '-'}
                </a>
            </td>
            <td>${art['denominacion articulo'] || '-'}</td>
            <td>${art['denominacion familia'] || art['codigo familia'] || '-'}</td>
            <td>${art['denominacion subfamilia'] || art['codigo subfamilia'] || '-'}</td>
            <td>${art['material'] || '-'}</td>
        </tr>
    `).join('');

    // Add click event listeners to article links
    tbody.querySelectorAll('.articulo-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const codigo = e.target.dataset.codigo;
            showArticuloModal(codigo);
        });
    });
}

// Show Articulo Detail Modal
async function showArticuloModal(codigo) {
    const modal = document.getElementById('articuloModal');
    if (!modal) return;

    // Show modal with loading state
    modal.style.display = 'flex';
    document.getElementById('modalArticuloCodigo').textContent = codigo;
    document.getElementById('modalArticuloDenominacion').textContent = 'Cargando...';

    try {
        const response = await fetch(`http://localhost:3001/api/articulo-detalle?articulo=${encodeURIComponent(codigo)}`);
        const data = await response.json();

        if (data.success && data.data) {
            const art = data.data;
            const getValue = (obj, ...keys) => {
                for (const key of keys) {
                    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
                }
                return '-';
            };

            document.getElementById('modalArticuloCodigo').textContent = getValue(art, 'codigo articulo');
            document.getElementById('modalArticuloDenominacion').textContent = getValue(art, 'denominacion articulo');
            document.getElementById('modalArticuloClase').textContent = getValue(art, 'Clase', 'clase', 'CLASE');
            document.getElementById('modalArticuloGrado').textContent = getValue(art, 'Grado', 'grado', 'GRADO');
            document.getElementById('modalArticuloZona').textContent = getValue(art, 'ZonaDesignada', 'zona designada', 'Zona Designada');
            document.getElementById('modalArticuloNorma').textContent = getValue(art, 'norma', 'Norma', 'NORMA');
            document.getElementById('modalArticuloMaterial').textContent = getValue(art, 'material', 'Material', 'MATERIAL');
            document.getElementById('modalArticuloEspecificacion').textContent = getValue(art, 'Codigo EAN13', 'CodigoEAN13', 'codigo ean13');
        } else {
            document.getElementById('modalArticuloDenominacion').textContent = 'Art\u00EDculo no encontrado';
        }
    } catch (error) {
        console.error('Error fetching articulo detalle:', error);
        document.getElementById('modalArticuloDenominacion').textContent = 'Error al cargar datos';
    }
}

// Close Articulo Modal
function closeArticuloModal() {
    const modal = document.getElementById('articuloModal');
    if (modal) modal.style.display = 'none';
}


// Fetch Operarios data
async function fetchOperarios() {
    const seccionSelect = document.getElementById('operariosSeccionFilter');
    const activoSelect = document.getElementById('operariosActivoFilter');
    const aCalculoSelect = document.getElementById('operariosACalculoFilter');
    const tbody = document.getElementById('operariosTableBody');
    const infoDiv = document.getElementById('operariosInfo');
    const countSpan = document.getElementById('operariosResultCount');

    const seccion = seccionSelect?.value || '';
    const activo = activoSelect?.value || '';
    const aCalculo = aCalculoSelect?.value || '';

    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Buscando operarios...
            </td>
        </tr>
    `;

    try {
        let url = 'http://localhost:3001/api/operarios?';
        const params = [];
        if (seccion) params.push(`seccion=${encodeURIComponent(seccion)}`);
        if (activo !== '') params.push(`activo=${encodeURIComponent(activo)}`);
        if (aCalculo !== '') params.push(`aCalculo=${encodeURIComponent(aCalculo)}`);
        url += params.join('&');

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            appData.operariosData = data.data; // Store for sorting

            // Populate secciones dropdown if not yet populated
            if (data.secciones && data.secciones.length > 0) {
                const currentSeccion = seccionSelect.value;
                const hasOptions = seccionSelect.options.length > 1;
                if (!hasOptions) {
                    data.secciones.forEach(s => {
                        const option = document.createElement('option');
                        option.value = s.codigo;
                        option.textContent = s.denominacion ? `${s.codigo} - ${s.denominacion}` : s.codigo;
                        seccionSelect.appendChild(option);
                    });
                    if (currentSeccion) seccionSelect.value = currentSeccion;
                }
            }

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-file-unknow-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron operarios con los filtros aplicados
                        </td>
                    </tr>
                `;
                infoDiv.style.display = 'flex';
                countSpan.textContent = '0 registros encontrados';
                document.getElementById('operariosPaginationBar').style.display = 'none';
            } else {
                // Store data for pagination
                appData.operariosPagination.allData = data.data;
                appData.operariosPagination.currentPage = 1;

                infoDiv.style.display = 'flex';
                countSpan.textContent = `${data.data.length} registros encontrados`;
                renderOperariosTablePage();
            }
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Error desconocido'}
                    </td>
                </tr>
            `;
            infoDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching operarios:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexion. Verifica que el servidor este corriendo.
                </td>
            </tr>
        `;
        infoDiv.style.display = 'none';
    }
}

// Render Operarios Table
function renderOperariosTable(operarios) {
    const tbody = document.getElementById('operariosTableBody');

    // Store operarios data for modal access
    window.operariosData = {};
    operarios.forEach(op => {
        window.operariosData[op.operario] = op;
    });

    tbody.innerHTML = operarios.map(op => {
        const fechaAlta = op['fecha alta'] ? new Date(op['fecha alta']).toLocaleDateString() : '-';

        return `
            <tr>
                <td>
                    <a href="#" class="operario-link" onclick="showOperarioModal('${op.operario}'); return false;" 
                       style="color: var(--primary); text-decoration: none; font-weight: 600; cursor: pointer;">
                        ${op.operario || '-'}
                    </a>
                </td>
                <td>${op.nombre || '-'}</td>
                <td>${fechaAlta}</td>
                <td>
                    ${op.activo
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> S\u00ED</span>'
                : '<span style="color: var(--text-muted);"><i class="ri-close-circle-line"></i> No</span>'}
                </td>
                <td>
                    ${op['a calculo']
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> S\u00ED</span>'
                : '<span style="color: var(--text-muted);"><i class="ri-close-circle-line"></i> No</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Show Operario Modal
function showOperarioModal(operarioId) {
    const op = window.operariosData[operarioId];
    if (!op) return;

    const fechaAlta = op['fecha alta'] ? new Date(op['fecha alta']).toLocaleDateString() : '-';

    // Remove existing modal if any
    const existingModal = document.getElementById('operarioModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'operarioModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeOperarioModal()" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        ">
            <div class="modal-content" onclick="event.stopPropagation()" style="
                background: var(--bg-card);
                border-radius: 12px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow: auto;
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
                    padding: 1.5rem 2rem;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">Ficha de Operario</h3>
                        <p style="margin: 0.25rem 0 0 0; opacity: 0.9; font-size: 0.875rem;">C\u00F3digo: ${op.operario}</p>
                    </div>
                    <button onclick="closeOperarioModal()" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.25rem;
                    ">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div style="padding: 2rem;">
                    <div style="display: grid; gap: 1.25rem;">
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 500;">C\u00F3digo Operario</label>
                            <div style="font-size: 1.125rem; font-weight: 500; color: var(--text-main); padding: 0.5rem; background: var(--bg-main); border-radius: 6px;">${op.operario || '-'}</div>
                        </div>
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 500;">Nombre</label>
                            <div style="font-size: 1.125rem; font-weight: 500; color: var(--text-main); padding: 0.5rem; background: var(--bg-main); border-radius: 6px;">${op.nombre || '-'}</div>
                        </div>
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 500;">Fecha de Alta</label>
                            <div style="font-size: 1.125rem; font-weight: 500; color: var(--text-main); padding: 0.5rem; background: var(--bg-main); border-radius: 6px;">${fechaAlta}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 500;">Activo</label>
                                <div style="font-size: 1.125rem; font-weight: 500; padding: 0.5rem; background: var(--bg-main); border-radius: 6px;">
                                    ${op.activo
            ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> S\u00ED</span>'
            : '<span style="color: #ef4444;"><i class="ri-close-circle-fill"></i> No</span>'}
                                </div>
                            </div>
                            <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 500;">A C\u00E1lculo</label>
                                <div style="font-size: 1.125rem; font-weight: 500; padding: 0.5rem; background: var(--bg-main); border-radius: 6px;">
                                    ${op['a calculo']
            ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> S\u00ED</span>'
            : '<span style="color: #ef4444;"><i class="ri-close-circle-fill"></i> No</span>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Close Operario Modal
function closeOperarioModal() {
    const modal = document.getElementById('operarioModal');
    if (modal) modal.remove();
}

// Load Operarios Secciones dropdown on startup
async function loadOperariosSecciones() {
    const seccionSelect = document.getElementById('operariosSeccionFilter');
    if (!seccionSelect) return;

    try {
        const response = await fetch('http://localhost:3001/api/operarios?');
        const data = await response.json();

        if (data.success && data.secciones && data.secciones.length > 0) {
            // Clear existing options except first
            seccionSelect.innerHTML = '<option value="">Todas</option>';
            data.secciones.forEach(s => {
                const option = document.createElement('option');
                option.value = s.codigo;
                option.textContent = s.denominacion ? `${s.codigo} - ${s.denominacion}` : s.codigo;
                seccionSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading secciones:', error);
    }
}

// Load Operaciones Secciones dropdown on startup
async function loadOperacionesSecciones() {
    const seccionSelect = document.getElementById('operacionesSeccionFilter');
    const operacionSelect = document.getElementById('operacionesCodigoFilter');
    if (!seccionSelect && !operacionSelect) return;

    try {
        const response = await fetch('http://localhost:3001/api/operaciones?');
        const data = await response.json();

        if (data.success) {
            // Populate secciones dropdown
            if (seccionSelect && data.secciones && data.secciones.length > 0) {
                seccionSelect.innerHTML = '<option value="">Todas</option>';
                data.secciones.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.codigo;
                    option.textContent = s.denominacion ? `${s.codigo} - ${s.denominacion}` : s.codigo;
                    seccionSelect.appendChild(option);
                });
            }

            // Populate operaciones dropdown
            if (operacionSelect && data.operacionesList && data.operacionesList.length > 0) {
                operacionSelect.innerHTML = '<option value="">Todas</option>';
                data.operacionesList.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.codigo;
                    option.textContent = op.descripcion ? `${op.codigo} - ${op.descripcion}` : op.codigo;
                    operacionSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading operaciones secciones:', error);
    }
}

// Fetch Operaciones
async function fetchOperaciones() {
    const operacion = document.getElementById('operacionesCodigoFilter')?.value || '';
    const seccion = document.getElementById('operacionesSeccionFilter')?.value || '';
    const activo = document.getElementById('operacionesActivoFilter')?.value || '';
    const computoOEE = document.getElementById('operacionesComputoFilter')?.value || '';

    try {
        const params = new URLSearchParams();
        if (operacion) params.append('operacion', operacion);
        if (seccion) params.append('seccion', seccion);
        if (activo) params.append('activo', activo);
        if (computoOEE) params.append('computoOEE', computoOEE);

        const response = await fetch(`http://localhost:3001/api/operaciones?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            appData.operacionesData = data.data; // Store for sorting

            if (data.data.length === 0) {
                document.getElementById('operacionesTableBody').innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron operaciones
                        </td>
                    </tr>
                `;
                document.getElementById('operacionesPaginationBar').style.display = 'none';
            } else {
                // Store data for pagination
                appData.operacionesPagination.allData = data.data;
                appData.operacionesPagination.currentPage = 1;
                renderOperacionesTablePage();
            }

            document.getElementById('operacionesInfo').style.display = 'flex';
            document.getElementById('operacionesResultCount').textContent = `${data.count} registros encontrados`;
        } else {
            console.error('Error fetching operaciones:', data.error);
        }
    } catch (error) {
        console.error('Error fetching operaciones:', error);
    }
}

// Render Operaciones Table
function renderOperacionesTable(operaciones) {
    const tbody = document.getElementById('operacionesTableBody');
    if (!tbody) return;

    if (!operaciones || operaciones.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-tools-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron operaciones
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = operaciones.map(op => {
        const rutasCount = op.rutasCount || 0;
        const descripcion = (op['descripcion 1'] || '').replace(/'/g, "\\'");
        const rutasLink = rutasCount > 0
            ? `<a href="#" onclick="showOperacionRutasModal('${op['codigo operacion']}', '${descripcion}'); return false;" 
                 style="display: inline-block; background: rgba(79, 70, 229, 0.1); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 0.85rem;" 
                 title="Ver artículos que usan esta operación">${rutasCount}</a>`
            : `<span style="display: inline-block; background: rgba(156, 163, 175, 0.1); color: var(--text-muted); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">0</span>`;

        return `
        <tr>
            <td>${op['codigo operacion'] || '-'}</td>
            <td>${op['descripcion 1'] || '-'}</td>
            <td title="${op['seccionDescripcion'] || ''}">${op['seccion'] || '-'}</td>
            <td style="text-align: center;">${rutasLink}</td>
            <td>
                ${op['activo']
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> SÍ</span>'
                : '<span style="color: #ef4444;"><i class="ri-close-circle-line"></i> No</span>'}
            </td>
            <td>${op['grupo operaciones'] || '-'}</td>
            <td>${op['PlazoStandard'] || '-'}</td>
            <td style="cursor: pointer;" 
                onclick="toggleComputoOEE('${op['codigo operacion']}', ${op['ComputoOEE'] || 0})"
                title="Click para cambiar">
                ${op['ComputoOEE'] === 1
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> SÍ</span>'
                : '<span style="color: #ef4444;"><i class="ri-close-circle-line"></i> No</span>'}
            </td>
        </tr>
    `;
    }).join('');
}

// Show modal with articles using an operation
async function showOperacionRutasModal(codigoOperacion, descripcion) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('operacionRutasModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'operacionRutasModal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div class="modal-content" style="background: var(--bg-card); border-radius: 12px; box-shadow: var(--shadow-lg); width: 550px; max-width: 90%; max-height: 80vh; overflow: hidden; position: relative;">
                <div style="background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); padding: 1rem 1.5rem; color: white; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div style="flex: 1; min-width: 0;">
                        <h3 id="operacionRutasModalTitle" style="margin: 0; font-size: 1rem; font-weight: 600;">Artículos que usan operación</h3>
                        <p id="operacionRutasModalSubtitle" style="margin: 0.25rem 0 0 0; font-size: 0.8rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></p>
                    </div>
                    <button onclick="closeOperacionRutasModal()" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; padding: 0; flex-shrink: 0;">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div id="operacionRutasModalBody" style="padding: 1rem; overflow-y: auto; max-height: 60vh;">
                    <div class="spinner" style="margin: 2rem auto;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeOperacionRutasModal();
        });
    }

    // Show modal with loading
    const title = document.getElementById('operacionRutasModalTitle');
    const subtitle = document.getElementById('operacionRutasModalSubtitle');
    const body = document.getElementById('operacionRutasModalBody');
    title.textContent = `Artículos que usan: ${codigoOperacion}`;
    subtitle.textContent = descripcion || '';
    subtitle.title = descripcion || '';
    body.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`http://localhost:3001/api/operaciones/${encodeURIComponent(codigoOperacion)}/rutas`);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            body.innerHTML = `
    <p style="margin: 0 0 1rem 1rem; color: var(--text-muted); font-size: 0.85rem;">${data.count} artículos encontrados</p>
    <div style="width: 100%; overflow: hidden;"> 
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; box-sizing: border-box;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border);">
                    <th style="width: 7%; text-align: left; padding: 0.4rem 0.5rem 0.4rem 1rem; font-size: 0.8rem; color: var(--text-muted); box-sizing: border-box;">Artículo</th>
                    <th style="width: 93%; text-align: left; padding: 0.4rem 0; font-size: 0.8rem; color: var(--text-muted); box-sizing: border-box;">Denominación</th>
                </tr>
            </thead>
            <tbody>
                ${data.data.map(item => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="width: 15%; text-align: left; padding: 0.4rem 0.5rem 0.4rem 1rem; font-weight: 500; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${item.articulo || '-'}</td>
                        <td style="width: 85%; text-align: left; padding: 0.4rem 0; color: var(--text-muted); font-size: 0.8rem; box-sizing: border-box; word-break: break-word;">${item.denominacion || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
`;
        } else if (data.success) {
            body.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay artículos usando esta operación</p>';
        } else {
            body.innerHTML = `<p style="text-align: center; padding: 2rem; color: #ef4444;">Error: ${data.error}</p>`;
        }
    } catch (error) {
        body.innerHTML = `<p style="text-align: center; padding: 2rem; color: #ef4444;">Error de conexión</p>`;
    }
}

// Close operation routes modal
function closeOperacionRutasModal() {
    const modal = document.getElementById('operacionRutasModal');
    if (modal) modal.style.display = 'none';
}

// Toggle ComputoOEE value
async function toggleComputoOEE(codigoOperacion, currentValue) {
    const newValue = currentValue === 1 ? 0 : 1;

    // Check if user is logged in
    if (!appData.currentUser || !appData.currentUser.id) {
        alert('Debes iniciar sesión para editar ComputoOEE');
        return;
    }

    console.log('[toggleComputoOEE] Intentando cambiar:', {
        codigo: codigoOperacion,
        valorActual: currentValue,
        nuevoValor: newValue,
        usuario: appData.currentUser.nombre_completo,
        rol: appData.currentUser.rol
    });

    try {
        const url = `http://localhost:3001/api/operaciones/${encodeURIComponent(codigoOperacion)}/computo-oee`;
        console.log('[toggleComputoOEE] URL:', url);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                computoOEE: newValue,
                userId: appData.currentUser.id
            })
        });

        console.log('[toggleComputoOEE] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            console.error('[toggle ComputoOEE] Error response:', errorData);

            // Show specific error message
            if (response.status === 403) {
                alert('❌ ' + errorData.error + '\n\nTu rol: ' + (appData.currentUser.rol || 'sin rol'));
            } else {
                alert('Error al actualizar: ' + errorData.error);
            }
            return;
        }

        const data = await response.json();
        console.log('[toggleComputoOEE] Response data:', data);

        if (data.success) {
            // Update the value in the stored data
            const opIndex = appData.operacionesData.findIndex(op => op['codigo operacion'] === codigoOperacion);
            if (opIndex !== -1) {
                appData.operacionesData[opIndex]['ComputoOEE'] = newValue;
            }

            // Re-render the table
            renderOperacionesTable(appData.operacionesData);

            console.log('[toggleComputoOEE] ✓ Actualizado correctamente');
        } else {
            console.error('[toggleComputoOEE] Error:', data.error);
            alert('Error al actualizar: ' + data.error);
        }
    } catch (error) {
        console.error('[toggleComputoOEE] Error completo:', error);
        alert('Error de conexión al actualizar.\n\nAsegúrate de que el servidor esté corriendo.\n\nDetalles: ' + error.message);
    }
}

// Load Activos and Zonas dropdowns on startup
async function loadActivosZonas() {
    const activoSelect = document.getElementById('activosCodigoFilter');
    const zonaSelect = document.getElementById('activosZonaFilter');
    if (!activoSelect && !zonaSelect) return;

    try {
        const response = await fetch('http://localhost:3001/api/activos?');
        const data = await response.json();

        if (data.success) {
            // Populate activos dropdown
            if (activoSelect && data.activosList && data.activosList.length > 0) {
                activoSelect.innerHTML = '<option value="">Todos</option>';
                data.activosList.forEach(a => {
                    const option = document.createElement('option');
                    option.value = a.codigo;
                    option.textContent = a.denominacion ? `${a.codigo} - ${a.denominacion}` : a.codigo;
                    activoSelect.appendChild(option);
                });
            }

            // Populate zonas dropdown
            if (zonaSelect && data.zonas && data.zonas.length > 0) {
                zonaSelect.innerHTML = '<option value="">Todas</option>';
                data.zonas.forEach(z => {
                    const option = document.createElement('option');
                    option.value = z.codigo;
                    option.textContent = z.denominacion ? `${z.codigo} - ${z.denominacion}` : z.codigo;
                    zonaSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading activos zonas:', error);
    }
}

// Fetch Activos
async function fetchActivos() {
    const activo = document.getElementById('activosCodigoFilter')?.value || '';
    const zona = document.getElementById('activosZonaFilter')?.value || '';

    try {
        const params = new URLSearchParams();
        if (activo) params.append('activo', activo);
        if (zona) params.append('zona', zona);

        const response = await fetch(`http://localhost:3001/api/activos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            appData.activosData = data.data; // Store for sorting

            if (data.data.length === 0) {
                document.getElementById('activosTableBody').innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron activos
                        </td>
                    </tr>
                `;
                document.getElementById('activosPaginationBar').style.display = 'none';
            } else {
                // Store data for pagination
                appData.activosPagination.allData = data.data;
                appData.activosPagination.currentPage = 1;
                renderActivosTablePage();
            }

            document.getElementById('activosInfo').style.display = 'flex';
            document.getElementById('activosResultCount').textContent = `${data.count} registros encontrados`;

            // Populate zonas if not already done
            if (data.zonas && data.zonas.length > 0) {
                const zonaSelect = document.getElementById('activosZonaFilter');
                if (zonaSelect && zonaSelect.options.length <= 1) {
                    data.zonas.forEach(z => {
                        const option = document.createElement('option');
                        option.value = z.codigo;
                        option.textContent = z.denominacion ? `${z.codigo} - ${z.denominacion}` : z.codigo;
                        zonaSelect.appendChild(option);
                    });
                }
            }
        } else {
            console.error('Error fetching activos:', data.error);
        }
    } catch (error) {
        console.error('Error fetching activos:', error);
    }
}

// Render Activos Table
function renderActivosTable(activos) {
    const tbody = document.getElementById('activosTableBody');
    if (!tbody) return;

    if (!activos || activos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-device-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron activos
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = activos.map(act => `
        <tr>
            <td>${act['codigo activo'] || '-'}</td>
            <td>${act['denominacion activo'] || '-'}</td>
            <td>${act['denominacion zona'] || act['codigo zona'] || '-'}</td>
        </tr>
    `).join('');
}

// Global state for Equipos
const equiposState = {
    page: 1,
    pageSize: 50,
    sortBy: 'N REF',
    sortOrder: 'ASC',
    totalRecords: 0,
    totalPages: 0,
    filters: {
        equipo: '',
        empresa: '',
        area: '',
        subarea: ''
    }
};

// Fetch Equipos
async function fetchEquipos(page = 1) {
    equiposState.page = page;

    // Get filter values
    equiposState.filters.equipo = document.getElementById('equiposRefFilter')?.value || '';
    equiposState.filters.empresa = document.getElementById('equiposEmpresaFilter')?.value || '';
    equiposState.filters.area = document.getElementById('equiposAreaFilter')?.value || '';
    equiposState.filters.subarea = document.getElementById('equiposSubareaFilter')?.value || '';
    equiposState.filters.retirado = document.getElementById('equiposRetiradoFilter')?.value || '';

    const tbody = document.getElementById('equiposTableBody');
    // Show loading
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                    Cargando equipos...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams();
        if (equiposState.filters.equipo) params.append('equipo', equiposState.filters.equipo);
        if (equiposState.filters.empresa) params.append('empresa', equiposState.filters.empresa);
        if (equiposState.filters.area) params.append('area', equiposState.filters.area);
        if (equiposState.filters.subarea) params.append('subarea', equiposState.filters.subarea);
        if (equiposState.filters.retirado) params.append('retirado', equiposState.filters.retirado);

        params.append('page', equiposState.page);
        params.append('pageSize', equiposState.pageSize);
        params.append('sortBy', equiposState.sortBy);
        params.append('sortOrder', equiposState.sortOrder);

        const response = await fetch(`http://localhost:3001/api/equipos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            equiposState.totalRecords = data.total;
            equiposState.totalPages = data.totalPages;

            console.log(`[App] Fetched equipos: ${data.data.length} records (Page ${equiposState.page}, Size ${equiposState.pageSize})`);

            // Client-side safeguard to ensure we don't show more than pageSize
            const recordsToShow = data.data.slice(0, equiposState.pageSize);
            renderEquiposTable(recordsToShow);

            updateEquiposPaginationUI();

            document.getElementById('equiposInfo').style.display = 'flex';
            document.getElementById('equiposResultCount').textContent = `${data.total} registros encontrados`;

            populateEquiposFilters(data);
            updateEquiposSortIcons();

        } else {
            console.error('Error fetching equipos:', data.error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">Error al cargar equipos</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching equipos:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">Error de conexion</td></tr>`;
    }
}

// Populate Filters
function populateEquiposFilters(data) {
    const empresaSelect = document.getElementById('equiposEmpresaFilter');
    const areaSelect = document.getElementById('equiposAreaFilter');
    const subareaSelect = document.getElementById('equiposSubareaFilter');

    if (empresaSelect && data.empresas) {
        const current = empresaSelect.value;
        empresaSelect.innerHTML = '<option value="">Todas</option>';
        data.empresas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e;
            opt.textContent = e;
            empresaSelect.appendChild(opt);
        });
        empresaSelect.value = current;
    }

    if (areaSelect && data.areas) {
        const current = areaSelect.value;
        areaSelect.innerHTML = '<option value="">Todas</option>';
        data.areas.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            areaSelect.appendChild(opt);
        });
        areaSelect.value = current;
    }

    if (subareaSelect && data.subareas) {
        const current = subareaSelect.value;
        subareaSelect.innerHTML = '<option value="">Todas</option>';
        data.subareas.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            subareaSelect.appendChild(opt);
        });
        subareaSelect.value = current;
    }
}

// Render Equipos Table
function renderEquiposTable(equipos) {
    const tbody = document.getElementById('equiposTableBody');
    if (!tbody) return;

    if (!equipos || equipos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-cpu-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron equipos
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = equipos.map(eq => `
        <tr>
            <td><strong>${eq['N REF'] || '-'}</strong></td>
            <td>${eq['NOMBRE INSTRUMENTO'] || '-'}</td>
            <td>${eq['EMPRESA'] || '-'}</td>
            <td>${eq['PERIODICIDAD'] || '-'}</td>
            <td>${eq['ORGANISMO EXTERIOR DE CALIBRACION'] || '-'}</td>
            <td>${eq['AREA'] || '-'}</td>
            <td>${eq['Subarea'] || '-'}</td>
            <td>${eq['NEC'] || '-'}</td>
        </tr>
    `).join('');
}

function updateEquiposPaginationUI() {
    // Update pagination bar visibility
    const paginationBar = document.getElementById('equiposPaginationBar');
    if (paginationBar) {
        paginationBar.style.display = equiposState.totalRecords > 0 ? 'flex' : 'none';
        console.log(`[App] Pagination UI: Page ${equiposState.page} of ${equiposState.totalPages} (Total: ${equiposState.totalRecords})`);
    }

    const currentStart = ((equiposState.page - 1) * equiposState.pageSize) + 1;
    const currentEnd = Math.min(equiposState.page * equiposState.pageSize, equiposState.totalRecords);

    const infoText = `Mostrando ${currentStart}-${currentEnd} de ${equiposState.totalRecords}`;

    const infoEl = document.getElementById('equiposPaginationInfo');
    if (infoEl) infoEl.textContent = infoText;

    const prevBtn = document.getElementById('equiposPrevPageBtn');
    const nextBtn = document.getElementById('equiposNextPageBtn');

    if (prevBtn) {
        prevBtn.disabled = equiposState.page <= 1;
        prevBtn.style.opacity = equiposState.page <= 1 ? '0.5' : '1';
        // Remove old listeners to avoid duplicates if any
        const newPrev = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        newPrev.addEventListener('click', () => {
            console.log('Prev clicked', equiposState.page);
            if (equiposState.page > 1) fetchEquipos(equiposState.page - 1);
        });
    }

    if (nextBtn) {
        nextBtn.disabled = equiposState.page >= equiposState.totalPages;
        nextBtn.style.opacity = equiposState.page >= equiposState.totalPages ? '0.5' : '1';
        // Remove old listeners to avoid duplicates if any
        const newNext = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        newNext.addEventListener('click', () => {
            console.log('Next clicked', equiposState.page);
            if (equiposState.page < equiposState.totalPages) fetchEquipos(equiposState.page + 1);
        });
    }
}

function handleEquiposSort(column) {
    if (equiposState.sortBy === column) {
        equiposState.sortOrder = equiposState.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
        equiposState.sortBy = column;
        equiposState.sortOrder = 'ASC';
    }
    fetchEquipos(1);
}

function updateEquiposSortIcons() {
    const headers = document.querySelectorAll('th.sortable-equipos');
    headers.forEach(th => {
        const icon = th.querySelector('i');
        if (!icon) return;

        // Reset
        icon.className = 'ri-arrow-up-down-line';
        icon.style.color = 'var(--text-muted)';

        // Active
        if (th.dataset.sort === equiposState.sortBy) {
            icon.className = equiposState.sortOrder === 'ASC' ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
            icon.style.color = 'var(--primary)';
        }
    });
}

// Add Event Listeners for Equipos
document.addEventListener('DOMContentLoaded', () => {
    // Filter listeners
    document.getElementById('equiposRefFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchEquipos(1);
    });
    document.getElementById('equiposEmpresaFilter')?.addEventListener('change', () => fetchEquipos(1));
    document.getElementById('equiposAreaFilter')?.addEventListener('change', () => fetchEquipos(1));
    document.getElementById('equiposSubareaFilter')?.addEventListener('change', () => fetchEquipos(1));
    document.getElementById('equiposRetiradoFilter')?.addEventListener('change', () => fetchEquipos(1));

    // Sort listeners
    document.querySelectorAll('th.sortable-equipos').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            if (sortKey) handleEquiposSort(sortKey);
        });
    });

    // Pagination listeners - REMOVED here, handled in updateEquiposPaginationUI to ensure fresh state access

    // Print/PDF listener
    document.getElementById('imprimirEquiposBtn')?.addEventListener('click', () => {
        window.print();
    });
});


// Update Familia filter dropdown
function updateFamiliaFilter() {
    const select = document.getElementById('familiaFilter');
    if (!select || !appData.articulos.length) return;

    const familias = {};
    appData.articulos.forEach(art => {
        const codigo = art['codigo familia'];
        const desc = art['denominacion familia'];
        if (codigo && !familias[codigo]) {
            familias[codigo] = desc || codigo;
        }
    });

    select.innerHTML = '<option value="">Todas las Familias</option>';
    Object.entries(familias)
        .sort(([, a], [, b]) => (a || '').localeCompare(b || ''))
        .forEach(([codigo, desc]) => {
            const option = document.createElement('option');
            option.value = codigo;
            // Format: [codigo familia]-[denominacion familia]
            option.textContent = desc ? `${codigo}-${desc}` : codigo;
            select.appendChild(option);
        });
}

// Update Subfamilia filter based on selected Familia
function updateSubfamiliaFilter() {
    const select = document.getElementById('subfamiliaFilter');
    if (!select) return;

    const familiaFilter = appData.filters['familia'];

    const subfamilias = {};
    appData.articulos.forEach(art => {
        if (familiaFilter && art['codigo familia'] !== familiaFilter) return;

        const codigo = art['codigo subfamilia'];
        const desc = art['denominacion subfamilia'];
        if (codigo && !subfamilias[codigo]) {
            subfamilias[codigo] = desc || codigo;
        }
    });

    select.innerHTML = '<option value="">Todas las Subfamilias</option>';
    Object.entries(subfamilias)
        .sort(([, a], [, b]) => (a || '').localeCompare(b || ''))
        .forEach(([codigo, desc]) => {
            const option = document.createElement('option');
            option.value = codigo;
            option.textContent = desc ? `${codigo} - ${desc}` : codigo;
            select.appendChild(option);
        });
}

// Update Articulo filter based on Familia/Subfamilia
function updateArticuloFilterByFilters() {
    const select = document.getElementById('articuloFilter');
    if (!select) return;

    const familiaFilter = appData.filters['familia'];
    const subfamiliaFilter = appData.filters['subfamilia'];

    // Count orders per articulo (filtered by familia/subfamilia)
    const articuloCounts = {};
    appData.analysis?.orders.forEach(order => {
        const art = appData.articulosMap[order.articulo];
        if (!art) return; // Solo mostrar articulos tipo 02 (los que estan en el mapa)
        if (familiaFilter && art['codigo familia'] !== familiaFilter) return;
        if (subfamiliaFilter && art['codigo subfamilia'] !== subfamiliaFilter) return;
        articuloCounts[order.articulo] = (articuloCounts[order.articulo] || 0) + 1;
    });

    select.innerHTML = '<option value="">Todos</option>';
    Object.keys(articuloCounts)
        .sort()
        .forEach(art => {
            const option = document.createElement('option');
            option.value = art;
            option.textContent = `${art} (${articuloCounts[art]})`;
            select.appendChild(option);
        });
}

function buildSequenceString(row) {
    // La secuencia se basa en si existe TRATAMIENTO, no en piezas
    const parts = [];
    if (row.Tratamiento_T4) parts.push('T4');
    if (row.Tratamiento_T6) parts.push('T6');
    if (row.Tratamiento_T4R1) parts.push('T4R1');
    if (row.Tratamiento_T6R1) parts.push('T6R1');
    if (row.Tratamiento_T4R2) parts.push('T4R2');
    if (row.Tratamiento_T6R2) parts.push('T6R2');
    if (row.Tratamiento_T4R3) parts.push('T4R3');
    if (row.Tratamiento_T6R3) parts.push('T6R3');
    return parts.join('->');
}

function getMonthKey(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function analyzeData() {
    let data = appData.raw;

    // Apply year filter if selected
    const yearFilter = document.getElementById('dashboardYearFilter')?.value;
    if (yearFilter) {
        data = data.filter(row => {
            // Look for year in any available date field
            const dates = [
                row.Fecha_T4, row.Fecha_T6,
                row.Fecha_T4R1, row.Fecha_T6R1,
                row.Fecha_T4R2, row.Fecha_T6R2
            ].filter(d => d); // Remove null/undefined

            if (dates.length === 0) return false;

            // Check if any date matches the selected year
            return dates.some(fecha => {
                let year;

                if (fecha instanceof Date) {
                    year = String(fecha.getFullYear());
                } else {
                    const fechaStr = String(fecha).trim();

                    if (fechaStr.includes('/')) {
                        const parts = fechaStr.split('/');
                        year = parts[2];
                    } else if (fechaStr.includes('-')) {
                        const parts = fechaStr.split('-');
                        year = parts[0].length === 4 ? parts[0] : parts[2];
                    }
                }

                return year === yearFilter;
            });
        });
        console.log(`Year filter ${yearFilter}: ${data.length} records found from ${appData.raw.length} total`);
    }

    const analysis = {
        totalT4: 0,
        totalT6: 0,
        reprocessCount: 0,
        orders: [],
        sequences: {},
        articulos: {},
        monthlyTreatments: {},
        treatmentCounts: {
            T4: 0, T6: 0, T4R1: 0, T6R1: 0, T4R2: 0, T6R2: 0, T4R3: 0, T6R3: 0
        },
        articleReprocesses: {}
    };

    data.forEach(row => {
        // Solo procesar articulos tipo 02 (los que estan en el mapa)
        const artInfo = appData.articulosMap?.[row.articulo];
        if (!artInfo) return;

        const dateT4 = parseDate(row.Fecha_T4);
        const dateT6 = parseDate(row.Fecha_T6);

        const t4 = row.Piezas_T4 || 0;
        const t6 = row.Piezas_T6 || 0;

        analysis.totalT4 += t4;
        analysis.totalT6 += t6;

        if (t4 > 0) analysis.treatmentCounts.T4++;
        if (t6 > 0) analysis.treatmentCounts.T6++;
        if ((row.Piezas_T4R1 || 0) > 0) analysis.treatmentCounts.T4R1++;
        if ((row.Piezas_T6R1 || 0) > 0) analysis.treatmentCounts.T6R1++;
        if ((row.Piezas_T4R2 || 0) > 0) analysis.treatmentCounts.T4R2++;
        if ((row.Piezas_T6R2 || 0) > 0) analysis.treatmentCounts.T6R2++;
        if ((row.Piezas_T4R3 || 0) > 0) analysis.treatmentCounts.T4R3++;
        if ((row.Piezas_T6R3 || 0) > 0) analysis.treatmentCounts.T6R3++;

        const monthKey = getMonthKey(dateT4 || dateT6);
        if (monthKey) {
            if (!analysis.monthlyTreatments[monthKey]) {
                analysis.monthlyTreatments[monthKey] = { t4: 0, t6: 0, total: 0 };
            }
            if (t4 > 0) {
                analysis.monthlyTreatments[monthKey].t4++;
                analysis.monthlyTreatments[monthKey].total++;
            }
            if (t6 > 0) {
                analysis.monthlyTreatments[monthKey].t6++;
                analysis.monthlyTreatments[monthKey].total++;
            }
        }

        if (row.articulo) {
            analysis.articulos[row.articulo] = (analysis.articulos[row.articulo] || 0) + 1;
        }

        const seqString = buildSequenceString(row);

        const hasReprocess = (row.Piezas_T4R1 || 0) > 0 ||
            (row.Piezas_T6R1 || 0) > 0 ||
            (row.Piezas_T4R2 || 0) > 0 ||
            (row.Piezas_T6R2 || 0) > 0 ||
            (row.Piezas_T4R3 || 0) > 0 ||
            (row.Piezas_T6R3 || 0) > 0;

        if (hasReprocess) {
            analysis.reprocessCount++;
            if (row.articulo) {
                if (!analysis.articleReprocesses[row.articulo]) {
                    analysis.articleReprocesses[row.articulo] = {
                        total: 0, T4R1: 0, T6R1: 0, T4R2: 0, T6R2: 0, T4R3: 0, T6R3: 0
                    };
                }
                analysis.articleReprocesses[row.articulo].total++;
                if ((row.Piezas_T4R1 || 0) > 0) analysis.articleReprocesses[row.articulo].T4R1++;
                if ((row.Piezas_T6R1 || 0) > 0) analysis.articleReprocesses[row.articulo].T6R1++;
                if ((row.Piezas_T4R2 || 0) > 0) analysis.articleReprocesses[row.articulo].T4R2++;
                if ((row.Piezas_T6R2 || 0) > 0) analysis.articleReprocesses[row.articulo].T6R2++;
                if ((row.Piezas_T4R3 || 0) > 0) analysis.articleReprocesses[row.articulo].T4R3++;
                if ((row.Piezas_T6R3 || 0) > 0) analysis.articleReprocesses[row.articulo].T6R3++;
            }
        }

        if (seqString) {
            analysis.sequences[seqString] = (analysis.sequences[seqString] || 0) + 1;
        }

        analysis.orders.push({
            ...row,
            sequence: seqString,
            hasReprocess,
            dateObj: dateT4 || dateT6,
            familia: artInfo['codigo familia'] || null,
            subfamilia: artInfo['codigo subfamilia'] || null
        });
    });

    appData.analysis = analysis;
}

function updateUI() {
    const { analysis } = appData;
    if (!analysis) return;

    updateKPIs(analysis);
    updateCharts(analysis);
    updateArticuloFilterByFilters();
    updateSequenceFilter(analysis.sequences);

    appData.pagination.currentPage = 1;
    filterOrders();

    elements.lastUpdate.textContent = appData.lastUpdate.toLocaleTimeString();
}

function updateSequenceFilter(sequences) {
    const select = document.getElementById('sequenceFilterSelect');
    if (!select) return;

    const currentVal = appData.filters['sequence'] || '';
    select.innerHTML = '<option value="">Todas</option>';

    Object.entries(sequences)
        .sort(([, a], [, b]) => b - a)
        .forEach(([seq, count]) => {
            const option = document.createElement('option');
            option.value = seq;
            option.textContent = `${seq.replace(/->/g, ' -> ')} (${count})`;
            if (seq === currentVal) option.selected = true;
            select.appendChild(option);
        });
}

function updateKPIs(analysis) {
    // Count number of treatments (orders) for each type
    const t4Count = analysis.orders.filter(order => {
        // An order has T4 if it has any T4 treatment (including reprocesos)
        return order.Tratamiento_T4 || order.Tratamiento_T4R || order.Tratamiento_T4R2 || order.Tratamiento_T4R3;
    }).length;

    const t6Count = analysis.orders.filter(order => {
        // An order has T6 if it has any T6 treatment (including reprocesos)
        return order.Tratamiento_T6 || order.Tratamiento_T6R || order.Tratamiento_T6R2 || order.Tratamiento_T6R3;
    }).length;

    // Update T4 KPIs
    animateValue('kpiT4Count', t4Count);
    document.getElementById('kpiT4').textContent = `${analysis.totalT4.toLocaleString()} piezas`;

    // Update T6 KPIs
    animateValue('kpiT6Count', t6Count);
    document.getElementById('kpiT6').textContent = `${analysis.totalT6.toLocaleString()} piezas`;

    const totalOrders = analysis.orders.length;
    const reprocessRate = totalOrders > 0 ? ((analysis.reprocessCount / totalOrders) * 100).toFixed(1) : '0.0';
    const efficiency = (100 - parseFloat(reprocessRate)).toFixed(1);

    animateValue('kpiReprocessCount', analysis.reprocessCount);
    document.getElementById('kpiReprocess').textContent = `${reprocessRate}% del total`;
    document.getElementById('kpiEfficiency').textContent = `${efficiency}%`;
}

function updateCharts(analysis) {
    const colors = {
        primary: '#4f46e5',
        t4: '#3b82f6',
        t6: '#8b5cf6'
    };

    const trendType = document.getElementById('trendChartType')?.value || 'all';
    const sortedMonths = Object.keys(analysis.monthlyTreatments).sort().slice(-12);

    const monthLabels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
    });

    let trendDatasets = [];
    if (trendType === 'all') {
        trendDatasets = [
            {
                label: 'Tratamientos T4',
                data: sortedMonths.map(m => analysis.monthlyTreatments[m].t4),
                borderColor: colors.t4,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Tratamientos T6',
                data: sortedMonths.map(m => analysis.monthlyTreatments[m].t6),
                borderColor: colors.t6,
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }
        ];
    } else if (trendType === 't4') {
        trendDatasets = [{
            label: 'Tratamientos T4',
            data: sortedMonths.map(m => analysis.monthlyTreatments[m].t4),
            borderColor: colors.t4,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }];
    } else {
        trendDatasets = [{
            label: 'Tratamientos T6',
            data: sortedMonths.map(m => analysis.monthlyTreatments[m].t6),
            borderColor: colors.t6,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true
        }];
    }

    createChart('productionTrendChart', 'line', {
        labels: monthLabels,
        datasets: trendDatasets
    }, {
        plugins: { legend: { display: trendType === 'all' } }
    });

    createChart('distributionChart', 'doughnut', {
        labels: ['T4', 'T6'],
        datasets: [{
            data: [analysis.totalT4, analysis.totalT6],
            backgroundColor: [colors.t4, colors.t6]
        }]
    });

    const treatmentLabels = ['T4', 'T6', 'T4R1', 'T6R1', 'T4R2', 'T6R2', 'T4R3', 'T6R3'];
    const treatmentData = treatmentLabels.map(label => analysis.treatmentCounts[label]);
    const treatmentColors = [
        colors.t4, colors.t6, '#f97316', '#ec4899', '#14b8a6', '#a855f7', '#eab308', '#06b6d4'
    ];

    createChart('treatmentCountsChart', 'bar', {
        labels: treatmentLabels,
        datasets: [{
            label: 'N de Tratamientos',
            data: treatmentData,
            backgroundColor: treatmentColors,
            borderRadius: 6
        }]
    });

    const topSequences = Object.entries(analysis.sequences)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    createChart('sequencesChart', 'bar', {
        labels: topSequences.map(([seq]) => seq.replace(/->/g, ' -> ')),
        datasets: [{
            label: 'Frecuencia',
            data: topSequences.map(([, count]) => count),
            backgroundColor: colors.primary,
            borderRadius: 6
        }]
    }, { indexAxis: 'y' });

    const topArticleReprocesses = Object.entries(analysis.articleReprocesses)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 10);

    createChart('reprocessByArticleChart', 'bar', {
        labels: topArticleReprocesses.map(([art]) => art),
        datasets: [
            { label: 'T4R1', data: topArticleReprocesses.map(([, d]) => d.T4R1), backgroundColor: '#f97316', borderRadius: 4 },
            { label: 'T6R1', data: topArticleReprocesses.map(([, d]) => d.T6R1), backgroundColor: '#ec4899', borderRadius: 4 },
            { label: 'T4R2', data: topArticleReprocesses.map(([, d]) => d.T4R2), backgroundColor: '#14b8a6', borderRadius: 4 },
            { label: 'T6R2', data: topArticleReprocesses.map(([, d]) => d.T6R2), backgroundColor: '#a855f7', borderRadius: 4 },
            { label: 'T4R3', data: topArticleReprocesses.map(([, d]) => d.T4R3), backgroundColor: '#eab308', borderRadius: 4 },
            { label: 'T6R3', data: topArticleReprocesses.map(([, d]) => d.T6R3), backgroundColor: '#06b6d4', borderRadius: 4 }
        ]
    }, {
        indexAxis: 'y',
        scales: { x: { stacked: true }, y: { stacked: true } },
        plugins: { legend: { display: true } }
    });
}

function renderTreatmentCell(tratamiento, piezas, fecha) {
    // Mostrar contenido si hay tratamiento (coincide con la secuencia)
    if (!tratamiento) {
        return '<td><span style="color: var(--text-muted);">-</span></td>';
    }

    const hasPiezas = piezas && piezas > 0;
    let content = '<div class="cell-stacked">';

    // Si no tiene piezas, anadir indicador de advertencia
    if (!hasPiezas) {
        content += `<div style="display: flex; align-items: center; gap: 4px;">`;
        content += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f97316; flex-shrink: 0;" title="Sin piezas"></span>`;
        content += `<strong>${tratamiento}</strong>`;
        content += `</div>`;
    } else {
        content += `<strong>${tratamiento}</strong>`;
        content += `<small>Pzs: ${piezas}</small>`;
    }

    if (fecha) content += `<small>${formatDate(fecha)}</small>`;
    content += '</div>';
    return `<td>${content}</td>`;
}

function renderTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    const sortedOrders = [...orders];
    const { col, dir } = appData.sort;

    sortedOrders.sort((a, b) => {
        let valA = a[col] ?? a.Numero_Orden ?? '';
        let valB = b[col] ?? b.Numero_Orden ?? '';

        if (col.includes('Fecha')) {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            // keep as is
        } else {
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
        }

        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = sortedOrders.map(order => {
        const displaySequence = order.sequence ? order.sequence.replace(/->/g, ' -> ') : '-';
        return `
            <tr>
                <td><strong>${order['numero orden'] ?? order.Numero_Orden}</strong></td>
                <td>${order.articulo || '-'}</td>
                <td>${order.Colada || '-'}</td>
                <td>${displaySequence}</td>
                ${renderTreatmentCell(order.Tratamiento_T4, order.Piezas_T4, order.Fecha_T4)}
                ${renderTreatmentCell(order.Tratamiento_T6, order.Piezas_T6, order.Fecha_T6)}
                ${renderTreatmentCell(order.Tratamiento_T4R1, order.Piezas_T4R1, order.Fecha_T4R1)}
                ${renderTreatmentCell(order.Tratamiento_T6R1, order.Piezas_T6R1, order.Fecha_T6R1)}
                ${renderTreatmentCell(order.Tratamiento_T4R2, order.Piezas_T4R2, order.Fecha_T4R2)}
                ${renderTreatmentCell(order.Tratamiento_T6R2, order.Piezas_T6R2, order.Fecha_T6R2)}
                ${renderTreatmentCell(order.Tratamiento_T4R3, order.Piezas_T4R3, order.Fecha_T4R3)}
                ${renderTreatmentCell(order.Tratamiento_T6R3, order.Piezas_T6R3, order.Fecha_T6R3)}
                <td>
                    <span class="badge ${order.hasReprocess ? 'reprocess' : 'clean'}">
                        ${order.hasReprocess ? 'Reproceso' : 'OK'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function updateSortIcons() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === appData.sort.col) {
            th.classList.add(`sort-${appData.sort.dir}`);
        }
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
}

function filterOrders() {
    const filtered = appData.analysis.orders.filter(order => {
        // Familia filter
        const familiaFilter = appData.filters['familia'];
        if (familiaFilter && order.familia !== familiaFilter) return false;

        // Subfamilia filter
        const subfamiliaFilter = appData.filters['subfamilia'];
        if (subfamiliaFilter && order.subfamilia !== subfamiliaFilter) return false;

        // Orden filter (partial match)
        const ordenFilter = appData.filters['orden'];
        if (ordenFilter) {
            const ordenValue = (order['numero orden'] ?? order.Numero_Orden ?? '').toString();
            if (!ordenValue.toLowerCase().includes(ordenFilter.toLowerCase())) return false;
        }

        const articuloFilter = appData.filters['articulo'];
        if (articuloFilter && order.articulo !== articuloFilter) return false;

        const reprocessFilter = appData.filters['hasReprocess'];
        if (reprocessFilter) {
            const wantsReprocess = reprocessFilter === 'true';
            if (order.hasReprocess !== wantsReprocess) return false;
        }

        // Filtro de secuencia - COINCIDENCIA EXACTA
        const sequenceFilter = appData.filters['sequence'];
        if (sequenceFilter) {
            const orderSeq = (order.sequence || '').trim();
            const filterSeq = sequenceFilter.trim();
            // Si no coincide EXACTAMENTE, filtrar fuera
            if (orderSeq !== filterSeq) {
                return false;
            }
        }

        return true;
    });

    appData.pagination.totalFiltered = filtered.length;
    const { currentPage, pageSize, totalFiltered } = appData.pagination;
    const totalPages = Math.ceil(totalFiltered / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);

    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = totalFiltered === 0
            ? 'No hay registros'
            : `Mostrando ${startIndex + 1}-${endIndex} de ${totalFiltered} registros`;
    }

    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderTable(filtered.slice(startIndex, endIndex));
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr);
}

function createChart(id, type, data, options = {}) {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: type === 'doughnut' || options.plugins?.legend?.display }
            },
            ...options
        }
    });
}

function switchView(viewName) {
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    elements.views.forEach(view => view.classList.remove('active'));

    // Map view names to view IDs
    const viewMap = {
        'inicio': 'inicioView',
        'maestros': 'maestrosView',
        'dashboard': 'dashboardView',
        'orders': 'ordersView',
        'rutas': 'rutasView',
        'articulos': 'articulosView',
        'operarios': 'operariosView',
        'operaciones': 'operacionesView',
        'activos': 'activosView',
        'equipos': 'equiposView',
        'ensayos-vt': 'ensayosVtView',
        'ensayos-pt': 'ensayosPtView',
        'ensayos-rt': 'ensayosRtView',
        'ensayos-dureza': 'ensayosDurezaView',
        'ensayos-traccion': 'ensayosTraccionView',
        'ensayos-metalografia': 'ensayosMetalografiaView',
        'ensayos-dashboard': 'ensayosDashboardView',
        'bonos': 'bonosView',
        'personal-dashboard': 'personal-dashboardView',
        'calidad-rechazos': 'calidadRechazosView',
        'centros': 'centrosView',
        'proveedores': 'proveedoresView',
        'clientes': 'clientesView',
        'normas': 'normasView',
        'especificaciones': 'especificacionesView',
        'otd': 'otdView',
        'comercial-dashboard': 'comercial-dashboardView',
        'compras-dashboard': 'compras-dashboardView',
        'oee': 'oeeView',
        'codigos-rechazo': 'codigos-rechazoView',
        'incidencias': 'incidenciasView',
        'ausencias': 'ausenciasView',
        'secciones': 'seccionesView',
        'estructuras': 'estructurasView',
        'capa-charge': 'capaChargeView',
        'materiales': 'materialesView',
        'utillajes': 'utillajesView'
    };

    const targetView = viewMap[viewName] || 'inicioView';
    document.getElementById(targetView)?.classList.add('active');

    // Load filter options when entering articulos view
    if (viewName === 'articulos') {
        updateArticulosFilterOptions();
    }

    // Load operaciones datalist when entering rutas view
    if (viewName === 'rutas') {
        loadOperacionesSelect();
        loadFasesSelect();
        loadRutasFiltros();  // Load familia and clasificacion filters
        loadRutasTop10();    // Load TOP 10 lists immediately
    } else if (viewName === 'estructuras') {
        loadEstructurasTop10();  // Load TOP 10 immediately
    } else if (viewName === 'ensayos-dashboard') {
        fetchEnsayosDashboard();
    } else if (viewName === 'ensayos-vt') {
        fetchEnsayosVt();
    } else if (viewName === 'ensayos-pt') {
        fetchEnsayosPt();
    } else if (viewName === 'ensayos-rt') {
        fetchEnsayosRt();
    } else if (viewName === 'ensayos-dureza') {
        fetchEnsayosDureza();
    } else if (viewName === 'ensayos-traccion') {
        fetchEnsayosTraccion();
    } else if (viewName === 'ensayos-metalografia') {
        fetchEnsayosMetalografia();
    } else if (viewName === 'operarios') {
        fetchOperarios();
    } else if (viewName === 'operaciones') {
        fetchOperaciones();
    } else if (viewName === 'activos') {
        fetchActivos();
    } else if (viewName === 'equipos') {
        fetchEquipos();
    } else if (viewName === 'bonos') {
        fetchBonos();
    } else if (viewName === 'personal-dashboard') {
        fetchPersonalDashboard();
    } else if (viewName === 'calidad-rechazos') {
        fetchCalidadRechazos();
    } else if (viewName === 'centros') {
        fetchCentros();
    } else if (viewName === 'proveedores') {
        fetchProveedores();
    } else if (viewName === 'clientes') {
        fetchClientes();
    } else if (viewName === 'normas') {
        fetchNormas();
    } else if (viewName === 'especificaciones') {
        fetchEspecificaciones();
    } else if (viewName === 'otd') {
        fetchOTDData();
    } else if (viewName === 'comercial-dashboard') {
        fetchComercialDashboard();
    } else if (viewName === 'compras-dashboard') {
        fetchComprasDashboard();
    } else if (viewName === 'oee') {
        fetchOEEDashboard();
    } else if (viewName === 'codigos-rechazo') {
        fetchCodigosRechazo();
    } else if (viewName === 'incidencias') {
        fetchIncidencias();
    } else if (viewName === 'ausencias') {
        fetchAusencias();
    } else if (viewName === 'secciones') {
        fetchSecciones();
    } else if (viewName === 'materiales') {
        fetchMateriales();
    } else if (viewName === 'utillajes') {
        fetchUtillajes();
    }

    // Update page title based on view
    const titleMap = {
        'inicio': 'Dashboard General',
        'maestros': 'Dashboard Maestros',
        'dashboard': 'Dashboard HeatTreat',
        'orders': 'Listado de \u00D3rdenes',
        'rutas': 'Gesti\u00F3n de Rutas',
        'articulos': 'Maestro de Art\u00EDculos',
        'operarios': 'Gesti\u00F3n de Operarios',
        'operaciones': 'Gesti\u00F3n de Operaciones',
        'activos': 'Gesti\u00F3n de Activos',
        'equipos': '',
        'ensayos-vt': 'Informes VT',
        'ensayos-pt': 'Informes PT',
        'ensayos-rt': 'Informes RT',
        'ensayos-dureza': 'Informes Dureza',
        'ensayos-traccion': 'Informes Tracci\u00F3n',
        'ensayos-metalografia': 'Informes Metalograf\u00EDa',
        'ensayos-dashboard': 'Dashboard Ensayos',
        'bonos': 'Bonos de Producci\u00F3n',
        'personal-dashboard': 'Dashboard Personal',
        'calidad-rechazos': 'Dashboard Rechazos',
        'centros': 'Gestion de Centros',
        'proveedores': 'Maestro de Proveedores',
        'clientes': 'Maestro de Clientes',
        'normas': 'Catalogo de Normas',
        'especificaciones': 'Especificaciones de Compra',
        'otd': 'OTD - Customer Service',
        'comercial-dashboard': 'Dashboard Comercial',
        'compras-dashboard': 'Dashboard Compras',
        'oee': 'OEE Dashboard',
        'codigos-rechazo': 'Códigos de Rechazo',
        'incidencias': 'Gestión de Incidencias',
        'ausencias': 'Maestro de Ausencias',
        'secciones': 'Maestro de Secciones',
        'estructuras': 'Estructuras de Artículos',
        'capa-charge': 'Capa Charge',
        'materiales': 'Maestro de Materiales',
        'utillajes': 'Maestro de Utillajes'
    };

    // Icon map for each view
    const iconMap = {
        'inicio': 'ri-dashboard-line',
        'maestros': 'ri-database-2-line',
        'dashboard': 'ri-fire-line',
        'orders': 'ri-file-list-3-line',
        'rutas': 'ri-route-line',
        'articulos': 'ri-box-3-line',
        'operarios': 'ri-user-line',
        'operaciones': 'ri-tools-line',
        'activos': 'ri-building-line',
        'equipos': 'ri-cpu-line',
        'ensayos-vt': 'ri-eye-line',
        'ensayos-pt': 'ri-drop-line',
        'ensayos-rt': 'ri-contrast-2-line',
        'ensayos-dureza': 'ri-hammer-line',
        'ensayos-traccion': 'ri-arrow-left-right-line',
        'ensayos-metalografia': 'ri-microscope-line',
        'ensayos-dashboard': 'ri-flask-line',
        'bonos': 'ri-bank-card-line',
        'personal-dashboard': 'ri-team-line',
        'calidad-rechazos': 'ri-error-warning-line',
        'centros': 'ri-building-2-line',
        'proveedores': 'ri-truck-line',
        'clientes': 'ri-user-star-line',
        'normas': 'ri-book-2-line',
        'especificaciones': 'ri-file-text-line',
        'otd': 'ri-truck-line',
        'comercial-dashboard': 'ri-store-line',
        'compras-dashboard': 'ri-shopping-cart-line',
        'oee': 'ri-bar-chart-grouped-line',
        'codigos-rechazo': 'ri-close-circle-line',
        'incidencias': 'ri-alarm-warning-line',
        'ausencias': 'ri-calendar-event-line',
        'secciones': 'ri-layout-grid-line',
        'estructuras': 'ri-node-tree',
        'capa-charge': 'ri-battery-charge-line',
        'materiales': 'ri-copper-coin-line',
        'utillajes': 'ri-tools-fill'
    };

    const title = titleMap[viewName] || 'Dashboard General';
    const icon = iconMap[viewName] || 'ri-dashboard-line';
    elements.pageTitle.innerHTML = `<i class="${icon}" style="font-size: 1.5rem; color: var(--text-main);"></i> ${title}`;
}

function showLoading(show) {
    elements.loading.style.display = show ? 'flex' : 'none';
}

function updateConnectionStatus(online) {
    const el = elements.connectionStatus;
    if (online) {
        el.classList.remove('offline');
        el.classList.add('online');
        el.querySelector('.status-text').textContent = 'Conectado a SQL';
    } else {
        el.classList.remove('online');
        el.classList.add('offline');
        el.querySelector('.status-text').textContent = 'Desconectado';
    }
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    const start = 0;
    const duration = 1000;
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function updateLogoForTheme(theme) {
    const logoImg = document.querySelector('.logo-image');
    if (logoImg) {
        logoImg.src = theme === 'light' ? 'logo_light.png' : 'logo.png';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateLogoForTheme(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateLogoForTheme(next);
}

// --- Collapsible Menu Logic (Accordion) ---
document.querySelectorAll('.nav-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.parentElement;
        const isActive = section.classList.contains('active');

        // Close all sections
        document.querySelectorAll('.nav-section').forEach(s => {
            s.classList.remove('active');
        });

        // Toggle clicked section (if it wasn't active, open it)
        if (!isActive) {
            section.classList.add('active');

            // If header has data-view, switch to that view
            if (header.dataset.view) {
                switchView(header.dataset.view);
            }
        }
    });
});

// --- Sorting Logic ---
document.querySelectorAll('th.sortable-op, th.sortable-act, th.sortable-operarios, th.sortable-articulos, th.sortable-rutas').forEach(th => {
    th.addEventListener('click', () => {
        const tableId = th.closest('table').id;
        const sortKey = th.dataset.sort;
        const isAsc = th.classList.contains('sort-asc');

        // Reset other headers
        th.closest('tr').querySelectorAll('th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });

        // Toggle sort
        th.classList.toggle('sort-asc', !isAsc);
        th.classList.toggle('sort-desc', isAsc);

        // Sort data
        let data = [];
        if (tableId === 'operacionesTable') data = appData.operacionesData;
        else if (tableId === 'activosTable') data = appData.activosData;
        else if (tableId === 'operariosTable') data = appData.operariosData;
        else if (tableId === 'articulosTable') data = appData.articulosTableData;
        else if (tableId === 'rutasTable') data = appData.rutas.data;

        if (data && data.length > 0) {
            const sortedData = [...data].sort((a, b) => {
                let valA = a[sortKey] || '';
                let valB = b[sortKey] || '';

                // Handle specific fields mapping if needed
                if (tableId === 'operacionesTable') {
                    if (sortKey === 'codigo') valA = a['codigo operacion'];
                    if (sortKey === 'descripcion') valA = a['descripcion 1'];
                    if (sortKey === 'seccion') valA = a['seccion'] || '';
                    if (sortKey === 'rutas') valA = a['rutasCount'] || 0;
                    if (sortKey === 'activo') valA = a['activo'];
                    if (sortKey === 'grupo') valA = a['grupo operaciones'];
                    if (sortKey === 'plazo') valA = a['PlazoStandard'];
                    if (sortKey === 'computo') valA = a['ComputoOEE'];

                    if (sortKey === 'codigo') valB = b['codigo operacion'];
                    if (sortKey === 'descripcion') valB = b['descripcion 1'];
                    if (sortKey === 'seccion') valB = b['seccion'] || '';
                    if (sortKey === 'rutas') valB = b['rutasCount'] || 0;
                    if (sortKey === 'activo') valB = b['activo'];
                    if (sortKey === 'grupo') valB = b['grupo operaciones'];
                    if (sortKey === 'plazo') valB = b['PlazoStandard'];
                    if (sortKey === 'computo') valB = b['ComputoOEE'];
                } else if (tableId === 'activosTable') {
                    if (sortKey === 'codigo') valA = a['codigo activo'];
                    if (sortKey === 'denominacion') valA = a['denominacion activo'];
                    if (sortKey === 'zona') valA = a['denominacion zona'] || a['codigo zona'];

                    if (sortKey === 'codigo') valB = b['codigo activo'];
                    if (sortKey === 'denominacion') valB = b['denominacion activo'];
                    if (sortKey === 'zona') valB = b['denominacion zona'] || b['codigo zona'];
                } else if (tableId === 'operariosTable') {
                    if (sortKey === 'operario') valA = a['operario'];
                    if (sortKey === 'nombre') valA = a['nombre'];
                    if (sortKey === 'fechaAlta') valA = a['fecha alta'];
                    if (sortKey === 'activo') valA = a['activo'];
                    if (sortKey === 'aCalculo') valA = a['a calculo'];

                    if (sortKey === 'operario') valB = b['operario'];
                    if (sortKey === 'nombre') valB = b['nombre'];
                    if (sortKey === 'fechaAlta') valB = b['fecha alta'];
                    if (sortKey === 'activo') valB = b['activo'];
                    if (sortKey === 'aCalculo') valB = b['a calculo'];
                } else if (tableId === 'articulosTable') {
                    if (sortKey === 'codigo') valA = a['codigo articulo'];
                    if (sortKey === 'denominacion') valA = a['denominacion articulo'];
                    if (sortKey === 'familia') valA = a['denominacion familia'] || a['codigo familia'];
                    if (sortKey === 'subfamilia') valA = a['denominacion subfamilia'] || a['codigo subfamilia'];
                    if (sortKey === 'material') valA = a['material'];

                    if (sortKey === 'codigo') valB = b['codigo articulo'];
                    if (sortKey === 'denominacion') valB = b['denominacion articulo'];
                    if (sortKey === 'familia') valB = b['denominacion familia'] || b['codigo familia'];
                    if (sortKey === 'subfamilia') valB = b['denominacion subfamilia'] || b['codigo subfamilia'];
                    if (sortKey === 'material') valB = b['material'];
                } else if (tableId === 'rutasTable') {
                    if (sortKey === 'secuencia') valA = a['secuencia'];
                    if (sortKey === 'codigo') valA = a['codigo operacion'];
                    if (sortKey === 'descripcion') valA = a['descripcion'];
                    if (sortKey === 'fase') valA = a['fase'];
                    if (sortKey === 'tipo') valA = a['tipo'];
                    if (sortKey === 'centro') valA = a['centro'];
                    if (sortKey === 'tiempo') valA = parseFloat(a['tiempo ejecucion unitario']) || 0;
                    if (sortKey === 'control') valA = a['ControlProduccion'];

                    if (sortKey === 'secuencia') valB = b['secuencia'];
                    if (sortKey === 'codigo') valB = b['codigo operacion'];
                    if (sortKey === 'descripcion') valB = b['descripcion'];
                    if (sortKey === 'fase') valB = b['fase'];
                    if (sortKey === 'tipo') valB = b['tipo'];
                    if (sortKey === 'centro') valB = b['centro'];
                    if (sortKey === 'tiempo') valB = parseFloat(b['tiempo ejecucion unitario']) || 0;
                    if (sortKey === 'control') valB = b['ControlProduccion'];
                }

                if (valA < valB) return isAsc ? 1 : -1;
                if (valA > valB) return isAsc ? -1 : 1;
                return 0;
            });

            if (tableId === 'operacionesTable') renderOperacionesTable(sortedData);
            else if (tableId === 'activosTable') renderActivosTable(sortedData);
            else if (tableId === 'operariosTable') renderOperariosTable(sortedData);
            else if (tableId === 'articulosTable') renderArticulosTable(sortedData);
            else if (tableId === 'rutasTable') renderRutasTable(sortedData);
        }
    });
});

// ============================================
// LOGIN SYSTEM FUNCTIONS
// ============================================

// Load users from database and populate dropdown
// Load users from database and populate dropdown
async function loadUsersFromDB() {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) {
        console.error('User select element not found');
        return;
    }

    console.log('Initiating loadUsersFromDB...');

    try {
        // Add a timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        console.log('Fetching /api/users...');
        const response = await fetch('/api/users', { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log('Response received:', response.status);
        const data = await response.json();
        console.log('Data received:', data);

        if (data.success && data.users) {
            userSelect.innerHTML = '<option value="">Seleccione un usuario</option>';
            data.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.nombre_completo;
                userSelect.appendChild(option);
            });
        } else {
            console.warn('Data success is false or users missing');
            userSelect.innerHTML = '<option value="">Error al cargar usuarios</option>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        if (error.name === 'AbortError') {
            userSelect.innerHTML = '<option value="">Tiempo de espera agotado</option>';
        } else {
            userSelect.innerHTML = '<option value="">Error de conexi\u00F3n</option>';
        }
    }
}

// Setup login-related event listeners
function setupLoginEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (togglePassword) {
        togglePassword.addEventListener('click', togglePasswordVisibility);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Load users when login screen is shown
    loadUsersFromDB();
}

// Check if user session exists in localStorage
function checkUserSession() {
    const savedUser = localStorage.getItem('eipc_user');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            if (userData && userData.id && userData.name) {
                appData.currentUser = userData;
                updateUserDisplay();
                hideLoginScreen();
                return true;
            }
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('eipc_user');
        }
    }
    // Load users for the dropdown when user is not logged in
    loadUsersFromDB();
    return false;
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const userSelect = document.getElementById('userSelect');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.querySelector('.login-btn');

    const userId = userSelect.value;
    const password = passwordInput.value;

    if (!userId) {
        alert('Por favor, seleccione un usuario');
        return;
    }

    if (!password) {
        alert('Por favor, introduzca su contrasena');
        return;
    }

    // Disable button during login
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: userId, password: password })
        });

        const data = await response.json();

        if (data.success && data.user) {
            appData.currentUser = data.user;

            // Save to localStorage
            localStorage.setItem('eipc_user', JSON.stringify(appData.currentUser));

            // Update UI
            updateUserDisplay();
            hideLoginScreen();

            // Initialize the app
            initializeApp();
        } else {
            alert(data.error || 'Credenciales invalidas');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error de conexion. Por favor, intentelo de nuevo.');
    } finally {
        // Re-enable button
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar sesion';
        }
    }
}

// Handle logout
function handleLogout() {
    // Clear user data
    appData.currentUser = null;
    localStorage.removeItem('eipc_user');

    // Reset form
    const userSelect = document.getElementById('userSelect');
    const passwordInput = document.getElementById('passwordInput');
    if (userSelect) userSelect.value = '';
    if (passwordInput) passwordInput.value = '';

    // Show login screen and reload users
    showLoginScreen();
    loadUsersFromDB();
}

// Update user display in header
function updateUserDisplay() {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (appData.currentUser) {
        if (userAvatar) userAvatar.textContent = appData.currentUser.initials;
        if (userName) userName.textContent = appData.currentUser.name;
    }
}

// Show login screen
function showLoginScreen() {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.classList.remove('hidden');
    }
}

// Hide login screen
function hideLoginScreen() {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.classList.add('hidden');
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleBtn = document.getElementById('togglePassword');

    if (passwordInput && toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            if (icon) icon.className = 'ri-eye-off-line';
        } else {
            passwordInput.type = 'password';
            if (icon) icon.className = 'ri-eye-line';
        }
    }
}

// --- ENSAYOS LOGIC ---

async function fetchEnsayosData(type, tableId, renderRow) {
    showLoading(true);
    try {
        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        const artInput = document.getElementById(`ensayos${typeCap}ArticuloFilter`);
        const tratInput = document.getElementById(`ensayos${typeCap}TratamientoFilter`);

        const params = new URLSearchParams();
        if (artInput && artInput.value) params.append('articulo', artInput.value);
        if (tratInput && tratInput.value) params.append('tratamiento', tratInput.value);

        const response = await fetch(`/api/ensayos/${type}?${params.toString()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        const tbody = document.getElementById(tableId);
        if (!tbody) return;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem;">No hay registros</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(renderRow).join('');
        const countEl = document.getElementById(`ensayos${type.charAt(0).toUpperCase() + type.slice(1)}ResultCount`);
        if (countEl) countEl.textContent = `${data.length} registros encontrados`;
    } catch (error) {
        console.error(`Error fetching ensayos ${type}:`, error);
        // alert(`Error al cargar datos de ${type}`); // Silent fail or toast better
    } finally {
        showLoading(false);
    }
}

// RT specific state
let ensayosRtState = { page: 1, pageSize: 50, sortColumn: 'Fecha', sortOrder: 'DESC' };
// VT specific state
let ensayosVtState = { page: 1, pageSize: 50, sortColumn: 'Fecha', sortOrder: 'DESC' };
// PT specific state
let ensayosPtState = { page: 1, pageSize: 50, sortColumn: 'Fecha', sortOrder: 'DESC' };

// Global Sort Handler
window.handleEnsayosSort = function (type, column) {
    let state;
    if (type === 'rt') state = ensayosRtState;
    else if (type === 'vt') state = ensayosVtState;
    else if (type === 'pt') state = ensayosPtState;

    if (state.sortColumn === column) {
        state.sortOrder = state.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
        state.sortColumn = column;
        state.sortOrder = 'ASC';
    }
    state.page = 1;
    fetchEnsayosPaginated(type, state);
};

function updateEnsayosSortIcons(type, column, order) {
    const tableId = `ensayos${type.charAt(0).toUpperCase() + type.slice(1)}Table`;
    const icons = document.querySelectorAll(`#${tableId} .sort-icon`);
    icons.forEach(icon => {
        icon.className = 'ri-arrow-up-down-line sort-icon';
        icon.style.color = 'var(--text-muted)';
    });

    const activeIcon = document.getElementById(`sort-${type}-${column}`);
    if (activeIcon) {
        activeIcon.className = order === 'ASC' ? 'ri-arrow-up-line sort-icon' : 'ri-arrow-down-line sort-icon';
        activeIcon.style.color = 'var(--primary)';
    }
}

// Helper for Ensayos Pagination Fetch
async function fetchEnsayosPaginated(type, state) {
    showLoading(true);
    const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
    try {
        const artInput = document.getElementById(`ensayos${typeCap}ArticuloFilter`);
        const tratInput = document.getElementById(`ensayos${typeCap}TratamientoFilter`);

        const params = new URLSearchParams();
        if (artInput && artInput.value) params.append('articulo', artInput.value);
        if (tratInput && tratInput.value) params.append('tratamiento', tratInput.value);
        params.append('page', state.page);
        params.append('pageSize', state.pageSize);
        if (state.sortColumn) {
            params.append('sortBy', state.sortColumn);
            params.append('sortOrder', state.sortOrder);
        }

        const response = await fetch(`/api/ensayos/${type}?${params.toString()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();

        // Update treatment dropdown locally
        if (tratInput && tratInput.tagName === 'SELECT' && result.tratamientos) {
            const currentValue = tratInput.value;
            tratInput.innerHTML = '<option value="">Todos</option>' +
                result.tratamientos.map(t => `<option value="${t}">${t}</option>`).join('');
            tratInput.value = currentValue;
        }

        // Render table
        const tbody = document.getElementById(`ensayos${typeCap}TableBody`);
        if (!tbody) return;

        tbody.innerHTML = '';
        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No hay registros</td></tr>';
        } else {
            tbody.innerHTML = result.data.map(item => `
                <tr>
                    <td>${formatDate(item.Fecha)}</td>
                    <td>${item.Referencia || ''}</td>
                    <td>${item.Informe || ''}</td>
                    <td>${item.Colada || ''}</td>
                    <td>${item.Lingote || ''}</td>
                    <td>${item.Tratamiento || ''}</td>
                    <td>${item.Inspector || ''}</td>
                </tr>
            `).join('');
        }

        // Update pagination info
        const countEl = document.getElementById(`ensayos${typeCap}ResultCount`);
        const pageInfo = document.getElementById(`ensayos${typeCap}PageInfo`);
        const prevBtn = document.getElementById(`ensayos${typeCap}PrevBtn`);
        const nextBtn = document.getElementById(`ensayos${typeCap}NextBtn`);

        if (countEl) countEl.textContent = `${result.total} registros encontrados`;
        if (pageInfo) pageInfo.textContent = `Pagina ${result.page} de ${result.totalPages}`;
        if (prevBtn) {
            prevBtn.disabled = result.page <= 1;
            prevBtn.style.opacity = result.page <= 1 ? '0.5' : '1';
        }
        if (nextBtn) {
            nextBtn.disabled = result.page >= result.totalPages;
            nextBtn.style.opacity = result.page >= result.totalPages ? '0.5' : '1';
        }

        // Update Icons
        updateEnsayosSortIcons(type, state.sortColumn, state.sortOrder);

    } catch (error) {
        console.error(`Error fetching ensayos ${type}:`, error);
    } finally {
        showLoading(false);
    }
}

// RT Functions
async function fetchEnsayosRt(page = 1) {
    ensayosRtState.page = page;
    await fetchEnsayosPaginated('rt', ensayosRtState);
}
document.getElementById('ensayosRtPrevBtn')?.addEventListener('click', () => {
    if (ensayosRtState.page > 1) fetchEnsayosRt(ensayosRtState.page - 1);
});
document.getElementById('ensayosRtNextBtn')?.addEventListener('click', () => {
    fetchEnsayosRt(ensayosRtState.page + 1);
});

// VT Functions
async function fetchEnsayosVt(page = 1) {
    ensayosVtState.page = page;
    await fetchEnsayosPaginated('vt', ensayosVtState);
}
document.getElementById('ensayosVtPrevBtn')?.addEventListener('click', () => {
    if (ensayosVtState.page > 1) fetchEnsayosVt(ensayosVtState.page - 1);
});
document.getElementById('ensayosVtNextBtn')?.addEventListener('click', () => {
    fetchEnsayosVt(ensayosVtState.page + 1);
});

// PT Functions
async function fetchEnsayosPt(page = 1) {
    ensayosPtState.page = page;
    await fetchEnsayosPaginated('pt', ensayosPtState);
}
document.getElementById('ensayosPtPrevBtn')?.addEventListener('click', () => {
    if (ensayosPtState.page > 1) fetchEnsayosPt(ensayosPtState.page - 1);
});
document.getElementById('ensayosPtNextBtn')?.addEventListener('click', () => {
    fetchEnsayosPt(ensayosPtState.page + 1);
});

// Search/Load Buttons
document.getElementById('buscarEnsayosRtBtn')?.addEventListener('click', () => fetchEnsayosRt(1));
document.getElementById('buscarEnsayosVtBtn')?.addEventListener('click', () => fetchEnsayosVt(1));
document.getElementById('buscarEnsayosPtBtn')?.addEventListener('click', () => fetchEnsayosPt(1));

function fetchEnsayosDureza() {
    fetchEnsayosData('dureza', 'ensayosDurezaTableBody', item => `
        <tr>
            <td>${formatDate(item.Fecha)}</td>
            <td>${item.Referencia || item.Articulo || ''}</td>
            <td>${item.Tratamiento || ''}</td>
            <td>${item.Valor || ''}</td>
            <td>${item.Unidad || ''}</td>
        </tr>
    `);
}

function fetchEnsayosTraccion() {
    fetchEnsayosData('traccion', 'ensayosTraccionTableBody', item => `
        <tr>
            <td>${formatDate(item.Fecha)}</td>
            <td>${item.Referencia || item.Articulo || ''}</td>
            <td>${item.Tratamiento || ''}</td>
            <td>${item.Rm || ''}</td>
            <td>${item.Rp02 || ''}</td>
            <td>${item.A || ''}%</td>
        </tr>
    `);
}

function fetchEnsayosMetalografia() {
    fetchEnsayosData('metalografia', 'ensayosMetalografiaTableBody', item => `
        <tr>
            <td>${formatDate(item.Fecha)}</td>
            <td>${item.Referencia || item.Articulo || ''}</td>
            <td>${item.Tratamiento || ''}</td>
            <td>${item.Observaciones || ''}</td>
        </tr>
    `);
}

// --- DASHBOARD ENSAYOS LOGIC ---
let ensayosTrendChartInstance = null;
let ensayosDistChartInstance = null;
let ensayosInspectorChartInstance = null;

async function fetchEnsayosDashboard() {
    const yearSelect = document.getElementById('ensayosDashboardYear');
    const monthSelect = document.getElementById('ensayosDashboardMonth');
    const year = yearSelect ? yearSelect.value : new Date().getFullYear();
    const month = monthSelect ? monthSelect.value : '';

    try {
        let url = `/api/ensayos/dashboard?year=${year}`;
        if (month) url += `&month=${month}`;
        const response = await fetch(url);
        const data = await response.json();

        // KPIs
        let total = 0;
        let rt = 0, pt = 0, vt = 0;
        if (data.counts) {
            data.counts.forEach(c => {
                total += c.Total;
                if (c.Type === 'RT') rt = c.Total;
                if (c.Type === 'PT') pt = c.Total;
                if (c.Type === 'VT') vt = c.Total;
            });
        }

        const kpiTotal = document.getElementById('kpiTotalEnsayos');
        if (kpiTotal) kpiTotal.innerText = total;
        document.getElementById('kpiTotalRt').innerText = rt;
        document.getElementById('kpiTotalPt').innerText = pt;
        document.getElementById('kpiTotalVt').innerText = vt;

        // Charts
        renderEnsayosTrendChart(data.trend);
        renderEnsayosDistChart(data.counts);
        renderEnsayosInspectorChart(data.inspectors);
        renderEnsayosArticlesTable(data.articles);

    } catch (e) { console.error(e); }
}

function renderEnsayosTrendChart(data) {
    const ctx = document.getElementById('ensayosTrendChart');
    if (!ctx) return;

    if (ensayosTrendChartInstance) ensayosTrendChartInstance.destroy();

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const datasets = [
        { label: 'RT', data: new Array(12).fill(0), borderColor: '#FF6B6B', backgroundColor: '#FF6B6B', tension: 0.4 },
        { label: 'PT', data: new Array(12).fill(0), borderColor: '#4facfe', backgroundColor: '#4facfe', tension: 0.4 },
        { label: 'VT', data: new Array(12).fill(0), borderColor: '#43e97b', backgroundColor: '#43e97b', tension: 0.4 }
    ];

    if (data) {
        data.forEach(d => {
            const mIndex = d.Month - 1;
            const ds = datasets.find(set => set.label === d.Type);
            if (ds && mIndex >= 0 && mIndex < 12) ds.data[mIndex] = d.Total;
        });
    }

    ensayosTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: months, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false } }
    });
}

function renderEnsayosDistChart(data) {
    const ctx = document.getElementById('ensayosDistChart');
    if (!ctx) return;
    if (ensayosDistChartInstance) ensayosDistChartInstance.destroy();

    const labels = ['RT', 'PT', 'VT'];
    const values = [0, 0, 0];

    if (data) {
        data.forEach(d => {
            if (d.Type === 'RT') values[0] = d.Total;
            if (d.Type === 'PT') values[1] = d.Total;
            if (d.Type === 'VT') values[2] = d.Total;
        });
    }

    ensayosDistChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#FF6B6B', '#4facfe', '#43e97b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderEnsayosInspectorChart(data) {
    const ctx = document.getElementById('ensayosInspectorChart');
    if (!ctx) return;
    if (ensayosInspectorChartInstance) ensayosInspectorChartInstance.destroy();

    // Group data by inspector
    const inspectorMap = {};
    if (data) {
        data.forEach(d => {
            if (!inspectorMap[d.Inspector]) {
                inspectorMap[d.Inspector] = { VT: 0, RT: 0, PT: 0 };
            }
            inspectorMap[d.Inspector][d.Type] = d.Total;
        });
    }

    // Sort by total count descending
    const inspectors = Object.keys(inspectorMap).sort((a, b) => {
        const totalA = inspectorMap[a].VT + inspectorMap[a].RT + inspectorMap[a].PT;
        const totalB = inspectorMap[b].VT + inspectorMap[b].RT + inspectorMap[b].PT;
        return totalB - totalA;
    });

    // Take top 10
    const top10 = inspectors.slice(0, 10);
    const vtData = top10.map(insp => inspectorMap[insp].VT);
    const rtData = top10.map(insp => inspectorMap[insp].RT);
    const ptData = top10.map(insp => inspectorMap[insp].PT);

    ensayosInspectorChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10,
            datasets: [
                {
                    label: 'VT',
                    data: vtData,
                    backgroundColor: '#43e97b',
                    borderRadius: 4
                },
                {
                    label: 'RT',
                    data: rtData,
                    backgroundColor: '#FF6B6B',
                    borderRadius: 4
                },
                {
                    label: 'PT',
                    data: ptData,
                    backgroundColor: '#4facfe',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

function renderEnsayosArticlesTable(data) {
    const tbody = document.querySelector('#ensayosTopArticlesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (data) {
        data.forEach(d => {
            tbody.innerHTML += `
                <tr>
                    <td>${d.Articulo}</td>
                    <td style="font-weight: 600; text-align: center;">${d.Total}</td>
                    <td style="text-align: center; color: var(--success); font-weight: 500;">${d.VT || 0}</td>
                    <td style="text-align: center; color: var(--info); font-weight: 500;">${d.PT || 0}</td>
                    <td style="text-align: center; color: var(--danger); font-weight: 500;">${d.RT || 0}</td>
                </tr>`;
        });
    }
}

// Event Listeners for Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Initial listeners
    const refreshBtn = document.getElementById('refreshEnsayosDashboard');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchEnsayosDashboard);

    const yearSelect = document.getElementById('ensayosDashboardYear');
    if (yearSelect) yearSelect.addEventListener('change', fetchEnsayosDashboard);

    const monthSelect = document.getElementById('ensayosDashboardMonth');
    if (monthSelect) monthSelect.addEventListener('change', fetchEnsayosDashboard);

    const exportBtn = document.getElementById('exportEnsayosPdf');
    if (exportBtn) exportBtn.addEventListener('click', exportEnsayosToPdf);

    const dashLink = document.querySelector('a[data-view="ensayos-dashboard"]');
    if (dashLink) {
        dashLink.addEventListener('click', () => {
            fetchEnsayosDashboard();
        });
    }
});

// Since DOMContentLoaded might have run, attach immediately if elements exist
if (document.getElementById('refreshEnsayosDashboard')) document.getElementById('refreshEnsayosDashboard').addEventListener('click', fetchEnsayosDashboard);
if (document.getElementById('ensayosDashboardYear')) document.getElementById('ensayosDashboardYear').addEventListener('change', fetchEnsayosDashboard);
if (document.getElementById('ensayosDashboardMonth')) document.getElementById('ensayosDashboardMonth').addEventListener('change', fetchEnsayosDashboard);
if (document.getElementById('exportEnsayosPdf')) document.getElementById('exportEnsayosPdf').addEventListener('click', exportEnsayosToPdf);
const dashLinkImmediate = document.querySelector('a[data-view="ensayos-dashboard"]');
if (dashLinkImmediate) dashLinkImmediate.addEventListener('click', () => fetchEnsayosDashboard());

// PDF Export function for Ensayos Dashboard
function exportEnsayosToPdf() {
    const printWindow = window.open('', '_blank');
    const yearSelect = document.getElementById('ensayosDashboardYear');
    const monthSelect = document.getElementById('ensayosDashboardMonth');

    const year = yearSelect?.value || new Date().getFullYear();
    const monthValue = monthSelect?.value;
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const month = monthValue ? monthNames[parseInt(monthValue)] : 'Todos';

    // Get KPI values
    const kpiTotal = document.getElementById('kpiTotalEnsayos')?.innerText || '0';
    const kpiRt = document.getElementById('kpiTotalRt')?.innerText || '0';
    const kpiPt = document.getElementById('kpiTotalPt')?.innerText || '0';
    const kpiVt = document.getElementById('kpiTotalVt')?.innerText || '0';

    // Get chart images
    const trendChart = document.getElementById('ensayosTrendChart');
    const distChart = document.getElementById('ensayosDistChart');
    const inspectorChart = document.getElementById('ensayosInspectorChart');

    const trendChartImg = trendChart ? trendChart.toDataURL('image/png') : '';
    const distChartImg = distChart ? distChart.toDataURL('image/png') : '';
    const inspectorChartImg = inspectorChart ? inspectorChart.toDataURL('image/png') : '';

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard Ensayos - ${year} ${month}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h1 { color: #1f2937; font-size: 24px; margin-bottom: 5px; }
                .subtitle { color: #6b7280; margin-bottom: 20px; }
                .kpi-row { display: flex; gap: 20px; margin-bottom: 30px; }
                .kpi-box { flex: 1; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
                .kpi-value { font-size: 24px; font-weight: bold; color: #1f2937; }
                .kpi-label { font-size: 12px; color: #6b7280; }
                .chart-section { margin-bottom: 30px; page-break-inside: avoid; }
                .chart-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                img { max-width: 100%; height: auto; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>Dashboard de Ensayos</h1>
            <p class="subtitle">Ano: ${year} | Mes: ${month}</p>
            
            <div class="kpi-row">
                <div class="kpi-box">
                    <div class="kpi-value">${kpiTotal}</div>
                    <div class="kpi-label">Total Informes</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiRt}</div>
                    <div class="kpi-label">Informes RT</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiPt}</div>
                    <div class="kpi-label">Informes PT</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiVt}</div>
                    <div class="kpi-label">Informes VT</div>
                </div>
            </div>

            ${trendChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Evolucion Mensual</div>
                <img src="${trendChartImg}" />
            </div>` : ''}

            ${distChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Distribucion por Tipo</div>
                <img src="${distChartImg}" />
            </div>` : ''}

            ${inspectorChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Top Inspectores</div>
                <img src="${inspectorChartImg}" />
            </div>` : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.print();
    };
}


// ============================================
// PERSONAL DASHBOARD LOGIC
// ============================================

let personalHorasEvolucionChart = null;
let personalHorasSeccionChart = null;
let personalEvolucionData = [];
let personalEvolutionMode = 'trabajo'; // 'trabajo' or 'ausencia'
let personalSelectedSeccion = '';

async function fetchPersonalDashboard() {
    console.log('[APP] fetchPersonalDashboard called');

    const yearSelect = document.getElementById('personalDashboardYear');
    const monthSelect = document.getElementById('personalDashboardMonth');
    const seccionSelect = document.getElementById('personalDashboardSeccion');

    const year = yearSelect?.value || new Date().getFullYear();
    const month = monthSelect?.value || '';
    const seccion = seccionSelect?.value || '';

    try {
        const params = new URLSearchParams();
        params.append('year', year);
        if (month) params.append('month', month);
        if (seccion) params.append('seccion', seccion);

        const response = await fetch(`/api/personal-dashboard?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Update KPIs
            document.getElementById('personalKpiEmpleados').textContent = data.kpis.totalEmpleados;
            document.getElementById('personalKpiHorasMes').textContent = parseFloat(data.kpis.horasMes).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('personalKpiHorasTrabajo').textContent = parseFloat(data.kpis.horasTrabajo).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('personalKpiHorasAusencia').textContent = parseFloat(data.kpis.horasAusencia).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('personalKpiOutliers').textContent = parseInt(data.kpis.outliersCount).toLocaleString('es-ES');
            document.getElementById('personalKpiMedia').textContent = parseFloat(data.kpis.mediaHoras).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';

            // Populate section dropdown if empty
            if (seccionSelect && seccionSelect.options.length <= 1 && data.allSecciones) {
                data.allSecciones.forEach(sec => {
                    const option = document.createElement('option');
                    option.value = sec;
                    option.textContent = sec;
                    seccionSelect.appendChild(option);
                });
            }

            // Render section table with percentage and periodo indicator
            const tbody = document.getElementById('personalSeccionesBody');
            if (tbody && data.secciones.length > 0) {
                // Determine periodo label based on month filter
                const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const periodoLabel = month ? monthNames[parseInt(month)] : 'Ano ' + year;

                tbody.innerHTML = data.secciones.map(sec => {
                    const horasAusencia = parseFloat(sec.horasAusencia || 0);
                    const totalHoras = parseFloat(sec.totalHoras || 0);
                    const horasTrabajo = parseFloat(sec.horasTrabajo || 0);
                    const porcentaje = totalHoras > 0 ? ((horasAusencia / totalHoras) * 100) : 0;

                    return `
                    <tr>
                        <td>${sec.NombreSeccion || 'Sin seccion'}</td>
                        <td style="text-align: center;"><span style="background: var(--primary); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${periodoLabel}</span></td>
                        <td style="text-align: center;">${sec.empleados}</td>
                        <td style="text-align: center;">${horasTrabajo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="text-align: center;">${horasAusencia.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="text-align: center; color: ${porcentaje > 5 ? '#ef4444' : '#22c55e'};">${porcentaje.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                        <td style="text-align: center; font-weight: 600;">${totalHoras.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    `;
                }).join('');
            } else if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No hay datos</td></tr>';
            }

            // Store evolution data and selected section for toggle re-rendering
            personalEvolucionData = data.evolucion || [];
            personalSelectedSeccion = seccion;

            // Render Evolution Chart
            renderPersonalEvolutionChart();
            const ctxSec = document.getElementById('personalHorasSeccionChart')?.getContext('2d');
            if (ctxSec && data.secciones.length > 0) {
                if (personalHorasSeccionChart) personalHorasSeccionChart.destroy();

                const topSecciones = data.secciones.slice(0, 6);
                personalHorasSeccionChart = new Chart(ctxSec, {
                    type: 'doughnut',
                    data: {
                        labels: topSecciones.map(s => s.NombreSeccion || 'N/A'),
                        datasets: [{
                            data: topSecciones.map(s => s.totalHoras),
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'right' } }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error fetching personal dashboard:', error);
    }
}

// Render Personal Evolution Chart with mode support
function renderPersonalEvolutionChart() {
    const ctxEvol = document.getElementById('personalHorasEvolucionChart')?.getContext('2d');
    if (!ctxEvol || personalEvolucionData.length === 0) return;

    if (personalHorasEvolucionChart) personalHorasEvolucionChart.destroy();

    const monthNames = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const colorsLine = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f472b6', '#22d3ee', '#a3e635', '#fb923c'];

    // Filter by selected section if any
    let filteredData = personalEvolucionData;
    if (personalSelectedSeccion) {
        filteredData = personalEvolucionData.filter(e => e.seccion === personalSelectedSeccion);
    }

    const meses = [...new Set(filteredData.map(e => e.Mes))].sort((a, b) => a - b);
    const secciones = [...new Set(filteredData.map(e => e.seccion))].filter(s => s);
    const labels = meses.map(m => monthNames[m]);

    let datasets = [];
    let yAxisLabel = '';

    if (personalEvolutionMode === 'combinado') {
        // Combinado mode: show both trabajo and ausencia
        yAxisLabel = 'Horas';

        secciones.slice(0, 5).forEach((sec, idx) => {
            const trabajoData = meses.map(m => {
                const found = filteredData.find(e => e.Mes === m && e.seccion === sec);
                return found ? parseFloat(found.horasTrabajo || 0) : 0;
            });
            const ausenciaData = meses.map(m => {
                const found = filteredData.find(e => e.Mes === m && e.seccion === sec);
                return found ? parseFloat(found.horasAusencia || 0) : 0;
            });

            datasets.push({
                label: sec + ' (Trabajo)',
                data: trabajoData,
                borderColor: colorsLine[idx % colorsLine.length],
                backgroundColor: colorsLine[idx % colorsLine.length] + '20',
                fill: false,
                tension: 0.3,
                borderWidth: 2
            });
            datasets.push({
                label: sec + ' (Ausencia)',
                data: ausenciaData,
                borderColor: colorsLine[idx % colorsLine.length],
                backgroundColor: colorsLine[idx % colorsLine.length] + '40',
                borderDash: [5, 5],
                fill: false,
                tension: 0.3,
                borderWidth: 2
            });
        });
    } else {
        // Single mode: trabajo or ausencia
        const dataField = personalEvolutionMode === 'trabajo' ? 'horasTrabajo' : 'horasAusencia';
        yAxisLabel = personalEvolutionMode === 'trabajo' ? 'Horas Trabajo' : 'Horas Ausencia';

        datasets = secciones.slice(0, 10).map((sec, idx) => {
            const secData = meses.map(m => {
                const found = filteredData.find(e => e.Mes === m && e.seccion === sec);
                return found ? parseFloat(found[dataField] || 0) : 0;
            });
            return {
                label: sec,
                data: secData,
                borderColor: colorsLine[idx % colorsLine.length],
                backgroundColor: colorsLine[idx % colorsLine.length] + '20',
                fill: false,
                tension: 0.3,
                borderWidth: 2
            };
        });
    }

    personalHorasEvolucionChart = new Chart(ctxEvol, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: yAxisLabel }
                }
            }
        }
    });
}

// Set evolution chart mode (trabajo, ausencia, or combinado)
function setPersonalEvolutionMode(mode) {
    personalEvolutionMode = mode;

    // Update button styles
    const trabajoBtn = document.getElementById('personalEvolutionTrabajo');
    const ausenciaBtn = document.getElementById('personalEvolutionAusencia');
    const combinadoBtn = document.getElementById('personalEvolutionCombinado');

    // Reset all buttons
    [trabajoBtn, ausenciaBtn, combinadoBtn].forEach(btn => {
        if (btn) {
            btn.style.background = 'var(--bg-card)';
            btn.style.color = 'var(--text-main)';
            btn.style.borderColor = 'var(--border)';
        }
    });

    // Highlight active button
    const activeBtn = mode === 'trabajo' ? trabajoBtn : mode === 'ausencia' ? ausenciaBtn : combinadoBtn;
    if (activeBtn) {
        activeBtn.style.background = 'var(--primary)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'var(--primary)';
    }

    // Re-render chart
    renderPersonalEvolutionChart();
}

// Export Personal Dashboard to PDF
function exportPersonalToPdf() {
    const printWindow = window.open('', '_blank');
    const yearSelect = document.getElementById('personalDashboardYear');
    const monthSelect = document.getElementById('personalDashboardMonth');

    const year = yearSelect?.value || new Date().getFullYear();
    const monthValue = monthSelect?.value;
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const month = monthValue ? monthNames[parseInt(monthValue)] : 'Todos';

    // Get KPI values
    const kpiEmpleados = document.getElementById('personalKpiEmpleados')?.innerText || '0';
    const kpiHorasMes = document.getElementById('personalKpiHorasMes')?.innerText || '0';
    const kpiOutliers = document.getElementById('personalKpiOutliers')?.innerText || '0';
    const kpiMedia = document.getElementById('personalKpiMedia')?.innerText || '0';

    // Get chart images
    const evolChart = document.getElementById('personalHorasEvolucionChart');
    const secChart = document.getElementById('personalHorasSeccionChart');

    const evolChartImg = evolChart ? evolChart.toDataURL('image/png') : '';
    const secChartImg = secChart ? secChart.toDataURL('image/png') : '';

    // Get table content
    const tableBody = document.getElementById('personalSeccionesBody');
    let tableRows = '';
    if (tableBody) {
        tableBody.querySelectorAll('tr').forEach(row => {
            tableRows += '<tr>' + row.innerHTML + '</tr>';
        });
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard Personal - ${year} ${month}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h1 { color: #1f2937; font-size: 24px; margin-bottom: 5px; }
                .subtitle { color: #6b7280; margin-bottom: 20px; }
                .kpi-row { display: flex; gap: 20px; margin-bottom: 30px; }
                .kpi-box { flex: 1; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
                .kpi-value { font-size: 24px; font-weight: bold; color: #1f2937; }
                .kpi-label { font-size: 12px; color: #6b7280; }
                .chart-section { margin-bottom: 30px; page-break-inside: avoid; }
                .chart-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                img { max-width: 100%; height: auto; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background: #f3f4f6; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>Dashboard de Personal</h1>
            <p class="subtitle">Ano: ${year} | Mes: ${month}</p>
            
            <div class="kpi-row">
                <div class="kpi-box">
                    <div class="kpi-value">${kpiEmpleados}</div>
                    <div class="kpi-label">Total Empleados</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiHorasMes}</div>
                    <div class="kpi-label">Horas Mes</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiOutliers}</div>
                    <div class="kpi-label">Outliers</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiMedia}</div>
                    <div class="kpi-label">Media Horas</div>
                </div>
            </div>

            ${evolChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Evolucion de Horas</div>
                <img src="${evolChartImg}" />
            </div>` : ''}

            ${secChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Horas por Seccion</div>
                <img src="${secChartImg}" />
            </div>` : ''}

            <div class="chart-section">
                <div class="chart-title">Resumen por Seccion</div>
                <table>
                    <thead>
                        <tr>
                            <th>Seccion</th>
                            <th>Periodo</th>
                            <th>Empleados</th>
                            <th>Horas Trabajo</th>
                            <th>Horas Ausencia</th>
                            <th>% Ausencia</th>
                            <th>Total Horas</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.print();
    };
}

// Hook into Personal Dashboard navigation
document.addEventListener('DOMContentLoaded', () => {
    const personalHeader = document.getElementById('personalHeader');
    if (personalHeader) {
        personalHeader.addEventListener('click', () => {
            fetchPersonalDashboard();
        });
    }

    // Dashboard filter listeners
    document.getElementById('personalDashboardYear')?.addEventListener('change', fetchPersonalDashboard);
    document.getElementById('personalDashboardMonth')?.addEventListener('change', fetchPersonalDashboard);
    document.getElementById('personalDashboardSeccion')?.addEventListener('change', fetchPersonalDashboard);
    document.getElementById('personalDashboardRefresh')?.addEventListener('click', fetchPersonalDashboard);

    // Print button
    document.getElementById('exportPersonalPdf')?.addEventListener('click', exportPersonalToPdf);

    // Evolution chart toggle listeners
    document.getElementById('personalEvolutionTrabajo')?.addEventListener('click', () => setPersonalEvolutionMode('trabajo'));
    document.getElementById('personalEvolutionAusencia')?.addEventListener('click', () => setPersonalEvolutionMode('ausencia'));
    document.getElementById('personalEvolutionCombinado')?.addEventListener('click', () => setPersonalEvolutionMode('combinado'));
});

// ============================================
// BONOS LOGIC
// ============================================

async function fetchBonos(page = 1) {
    console.log('[APP] fetchBonos called, page:', page);
    const nombreInput = document.getElementById('bonosNombreFilter');
    const fechaDesdeInput = document.getElementById('bonosFechaDesdeFilter');
    const fechaHastaInput = document.getElementById('bonosFechaHastaFilter');
    const seccionSelect = document.getElementById('bonosSeccionFilter');
    const tbody = document.getElementById('bonosTableBody');
    const countSpan = document.getElementById('bonosResultCount');
    const pageInfo = document.getElementById('bonosPageInfo');
    const prevBtn = document.getElementById('bonosPrevBtn');
    const nextBtn = document.getElementById('bonosNextBtn');

    const outliersCheckbox = document.getElementById('bonosOutliersFilter');

    // Name filter interaction: If name is selected, clear date filters
    if (nombreInput && nombreInput.value && nombreInput.value !== '') {
        if (fechaDesdeInput) {
            fechaDesdeInput.value = '';
            fechaDesdeInput.disabled = true;
            fechaDesdeInput.style.opacity = '0.5';
            fechaDesdeInput.style.cursor = 'not-allowed';
        }
        if (fechaHastaInput) {
            fechaHastaInput.value = '';
            fechaHastaInput.disabled = true;
            fechaHastaInput.style.opacity = '0.5';
            fechaHastaInput.style.cursor = 'not-allowed';
        }
    } else {
        if (fechaDesdeInput) {
            fechaDesdeInput.disabled = false;
            fechaDesdeInput.style.opacity = '1';
            fechaDesdeInput.style.cursor = 'default';
        }
        if (fechaHastaInput) {
            fechaHastaInput.disabled = false;
            fechaHastaInput.style.opacity = '1';
            fechaHastaInput.style.cursor = 'default';
        }
        // Set default date to today if not set AND no name selected
        if (fechaDesdeInput && !fechaDesdeInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            fechaDesdeInput.value = `${yyyy}-${mm}-${dd}`;
            if (fechaHastaInput) fechaHastaInput.value = `${yyyy}-${mm}-${dd}`;
        }
    }

    // Show loading
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                    Cargando datos de bonos...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams();
        if (nombreInput?.value) params.append('nombre', nombreInput.value);
        if (fechaDesdeInput?.value) params.append('fechaDesde', fechaDesdeInput.value);
        if (fechaHastaInput?.value) params.append('fechaHasta', fechaHastaInput.value);
        if (seccionSelect?.value) params.append('seccion', seccionSelect.value);
        if (outliersCheckbox?.checked) params.append('outliers', 'true');

        // Add pagination and sort params
        params.append('page', page);
        params.append('pageSize', appData.bonosPagination.pageSize);
        params.append('sortBy', appData.bonosPagination.sortBy);
        params.append('sortOrder', appData.bonosPagination.sortOrder);

        const response = await fetch(`http://localhost:3001/api/bonos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Update state
            appData.bonosPagination.currentPage = data.page;
            appData.bonosPagination.totalFiltered = data.total;
            appData.bonosPagination.totalPages = data.totalPages;

            // Update sections dropdown if needed
            if (seccionSelect && seccionSelect.options.length <= 1 && data.secciones) {
                const currentVal = seccionSelect.value;
                seccionSelect.innerHTML = '<option value="">Todas</option>';
                data.secciones.forEach(sec => {
                    const option = document.createElement('option');
                    option.value = sec;
                    option.textContent = sec;
                    seccionSelect.appendChild(option);
                });
                seccionSelect.value = currentVal;
            }

            // Update names select if needed
            const namesSelect = document.getElementById('bonosNombreFilter');
            if (namesSelect && namesSelect.options.length <= 1 && data.nombres) {
                const currentVal = namesSelect.value;
                // Keep the first option (Todos) and append new ones
                // Clear existing options except first
                while (namesSelect.options.length > 1) {
                    namesSelect.remove(1);
                }

                data.nombres.forEach(nombre => {
                    const option = document.createElement('option');
                    option.value = nombre;
                    option.textContent = nombre;
                    namesSelect.appendChild(option);
                });
                namesSelect.value = currentVal;
            }

            if (data.data.length === 0) {
                if (tbody) tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron registros
                        </td>
                    </tr>
                `;
                if (countSpan) countSpan.textContent = '0 registros encontrados';
                if (pageInfo) pageInfo.textContent = '';
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
            } else {
                renderBonosTable(data.data);
                if (countSpan) countSpan.textContent = `${data.total} registros encontrados`;

                // Update pagination UI
                if (pageInfo) pageInfo.textContent = `Pagina ${data.page} de ${data.totalPages}`;

                if (prevBtn) {
                    prevBtn.disabled = data.page <= 1;
                    prevBtn.style.opacity = data.page <= 1 ? '0.5' : '1';
                }

                if (nextBtn) {
                    nextBtn.disabled = data.page >= data.totalPages;
                    nextBtn.style.opacity = data.page >= data.totalPages ? '0.5' : '1';
                }
            }
        } else {
            console.error('Error fetching bonos:', data.error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: ${data.error}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching bonos:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error de conexion</td></tr>`;
    }
}

function handleBonosSort(column) {
    console.log('[APP] Sorting by', column);
    if (appData.bonosPagination.sortBy === column) {
        appData.bonosPagination.sortOrder = appData.bonosPagination.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
        appData.bonosPagination.sortBy = column;
        appData.bonosPagination.sortOrder = 'ASC'; // Default to ASC for new column
    }
    fetchBonos(1); // Reset to page 1 on sort
}
window.handleBonosSort = handleBonosSort;

function renderBonosTable(data) {
    const tbody = document.getElementById('bonosTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        const total = parseFloat(item.TotalHoras) || 0;
        let color = '';
        if (total < 7.75) color = '#ef4444'; // Red-ish
        else if (total > 8.25) color = '#f59e0b'; // Yellow/Orange-ish
        else color = '#22c55e'; // Green-ish (Success)

        // Format fecha for display
        let fechaDisplay = '-';
        if (item.fecha) {
            const fecha = new Date(item.fecha);
            fechaDisplay = fecha.toLocaleDateString('es-ES');
        }

        return `
        <tr>
            <td>${item.Operario || ''}</td>
            <td>${fechaDisplay}</td>
            <td>${item.Nombre || ''}</td>
            <td>${item.Seccion || ''}</td>
            <td>${item.NombreSeccion || ''}</td>
            <td style="text-align: center;">${item.HorasTrabajo || 0}</td>
            <td style="text-align: center;">${item.HorasAusencia || 0}</td>
            <td style="text-align: center; font-weight: bold; color: ${color};">${item.TotalHoras || 0}</td>
        </tr>
        `;
    }).join('');
}

// Add listeners for Bonos
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buscarBonosBtn')?.addEventListener('click', () => fetchBonos(1));
    document.getElementById('bonosFechaDesdeFilter')?.addEventListener('change', () => fetchBonos(1));
    document.getElementById('bonosFechaHastaFilter')?.addEventListener('change', () => fetchBonos(1));
    document.getElementById('bonosSeccionFilter')?.addEventListener('change', () => fetchBonos(1));
    document.getElementById('bonosNombreFilter')?.addEventListener('change', () => fetchBonos(1));
    document.getElementById('bonosOutliersFilter')?.addEventListener('change', () => fetchBonos(1));

    // Print button handler
    document.getElementById('printBonosBtn')?.addEventListener('click', printBonos);

    document.getElementById('bonosPrevBtn')?.addEventListener('click', () => {
        if (appData.bonosPagination.currentPage > 1) {
            fetchBonos(appData.bonosPagination.currentPage - 1);
        }
    });

    document.getElementById('bonosNextBtn')?.addEventListener('click', () => {
        if (appData.bonosPagination.currentPage < appData.bonosPagination.totalPages) {
            fetchBonos(appData.bonosPagination.currentPage + 1);
        }
    });

    // Hook into navigation
    const bonosLink = document.querySelector('a[data-view="bonos"]');
    if (bonosLink) {
        bonosLink.addEventListener('click', () => {
            fetchBonos(1);
        });
    }
});

// Print Bonos function
function printBonos() {
    const table = document.getElementById('bonosTable');
    if (!table) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bonos de Produccion</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
                .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
                td { padding: 8px; border: 1px solid #ddd; }
                tr:nth-child(even) { background: #f9f9f9; }
                @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            </style>
        </head>
        <body>
            <h1>Bonos de Produccion</h1>
            <p class="subtitle">Impreso: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}</p>
            ${table.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.print();
    };
}

if (document.getElementById('buscarBonosBtn')) {
    document.getElementById('buscarBonosBtn').addEventListener('click', fetchBonos);
    const bonosLink = document.querySelector('a[data-view="bonos"]');
    if (bonosLink) {
        bonosLink.addEventListener('click', () => {
            fetchBonos();
        });
    }
}

// ============================================
// RESIZABLE TABLE COLUMNS
// ============================================

function makeTableResizable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // Add resizable class
    table.classList.add('resizable-table');

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    const headers = headerRow.querySelectorAll('th');

    headers.forEach((th, index) => {
        // Skip the last column (no resize needed on right edge)
        if (index === headers.length - 1) return;

        // Create resize handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        th.appendChild(handle);

        let startX, startWidth, thElement;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            thElement = th;
            startX = e.pageX;
            startWidth = th.offsetWidth;

            handle.classList.add('resizing');
            th.classList.add('resizing');
            document.body.classList.add('resizing-column');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!thElement) return;
            const newWidth = startWidth + (e.pageX - startX);
            if (newWidth >= 50) { // Minimum width
                thElement.style.width = newWidth + 'px';
                thElement.style.minWidth = newWidth + 'px';
            }
        }

        function onMouseUp() {
            if (thElement) {
                thElement.classList.remove('resizing');
            }
            handle.classList.remove('resizing');
            document.body.classList.remove('resizing-column');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            thElement = null;
        }
    });
}

// Initialize resizable columns for Bonos table when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization slightly to ensure table is rendered
    setTimeout(() => {
        makeTableResizable('bonosTable');
    }, 500);
});

// ============================================
// PROVEEDORES LOGIC
// ============================================

async function fetchProveedores() {
    const proveedorInput = document.getElementById('proveedorFilter');
    const tbody = document.getElementById('proveedoresTableBody');
    const countSpan = document.getElementById('proveedoresResultCount');
    const infoDiv = document.getElementById('proveedoresInfo');

    // Show loading
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                    Cargando proveedores...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams();
        if (proveedorInput?.value) params.append('proveedor', proveedorInput.value);

        const response = await fetch(`http://localhost:3001/api/proveedores?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            if (countSpan) countSpan.textContent = `${data.count} registros encontrados`;
            if (infoDiv) infoDiv.style.display = 'flex';
            // Store data and reset pagination
            appData.proveedoresPagination.allData = data.data || [];
            appData.proveedoresPagination.currentPage = 1;
            renderProveedoresTablePage();
        } else {
            console.error('Error fetching proveedores:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error al cargar proveedores</td></tr>`;
            }
        }
    } catch (error) {
        console.error('Error fetching proveedores:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error de conexion</td></tr>`;
        }
    }
}

function renderProveedoresTable(proveedores) {
    const tbody = document.getElementById('proveedoresTableBody');
    if (!tbody) return;

    if (!proveedores || proveedores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron proveedores</td></tr>`;
        return;
    }

    tbody.innerHTML = proveedores.map(p => `
        <tr>
            <td><strong>${p['codigo proveedor'] || '-'}</strong></td>
            <td>${p['denominacion proveedor'] || '-'}</td>
            <td>${p.email || '-'}</td>
            <td>${p.telefono1 || '-'}</td>
            <td>${p.telefono2 || '-'}</td>
        </tr>
    `).join('');
}

// Render Proveedores Table with Pagination
function renderProveedoresTablePage() {
    const tbody = document.getElementById('proveedoresTableBody');
    const paginationBar = document.getElementById('proveedoresPaginationBar');
    const paginationInfo = document.getElementById('proveedoresPaginationInfo');
    const prevBtn = document.getElementById('proveedoresPrevPageBtn');
    const nextBtn = document.getElementById('proveedoresNextPageBtn');

    if (!tbody) return;

    const allData = appData.proveedoresPagination?.allData || [];
    const pageSize = appData.proveedoresPagination?.pageSize || 50;
    const currentPage = appData.proveedoresPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron proveedores</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderProveedoresTable(pageData);
}

// Event listeners for Proveedores
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buscarProveedoresBtn')?.addEventListener('click', fetchProveedores);
    document.getElementById('proveedorFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchProveedores();
    });

    // Pagination buttons
    document.getElementById('proveedoresPrevPageBtn')?.addEventListener('click', () => {
        if (appData.proveedoresPagination.currentPage > 1) {
            appData.proveedoresPagination.currentPage--;
            renderProveedoresTablePage();
        }
    });
    document.getElementById('proveedoresNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil((appData.proveedoresPagination.allData?.length || 0) / appData.proveedoresPagination.pageSize);
        if (appData.proveedoresPagination.currentPage < totalPages) {
            appData.proveedoresPagination.currentPage++;
            renderProveedoresTablePage();
        }
    });
});

// ============================================
// UTILLAJES LOGIC (Updated)
// ============================================

// Utillajes logic is now part of the main app initialization
// Initialized in global appData at the top of the file

// Fetch Utillajes Filters (Tipos, Familias, Situaciones)
async function fetchUtillajesFiltros() {
    console.log('>>> fetchUtillajesFiltros CALLED');
    const tipoSelect = document.getElementById('utillajesTipoFilter');
    const familiaSelect = document.getElementById('utillajesFamiliaFilter');
    const situacionSelect = document.getElementById('utillajesSituacionFilter');

    if (!tipoSelect || !familiaSelect || !situacionSelect) {
        console.error('Missing dropdown elements!');
        return;
    }

    try {
        console.log('[UTILLAJES] Fetching filters from http://localhost:3001/api/utillajes-filtros');
        const response = await fetch('http://localhost:3001/api/utillajes-filtros');
        const data = await response.json();
        console.log('[UTILLAJES] Filters received:', data);

        if (data.success) {
            // Populate Tipos
            tipoSelect.innerHTML = '<option value="">Todos</option>';
            if (data.tipos) {
                data.tipos.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t['codigo tipo'];
                    option.textContent = `${t['codigo tipo']} - ${t['denominacion tipo'] || ''}`;
                    tipoSelect.appendChild(option);
                });
            }

            // Populate Familias
            familiaSelect.innerHTML = '<option value="">Todas</option>';
            if (data.familias) {
                data.familias.forEach(f => {
                    const option = document.createElement('option');
                    option.value = f['codigo familia'];
                    option.textContent = `${f['codigo familia']} - ${f['denominacion familia'] || ''}`;
                    familiaSelect.appendChild(option);
                });
            }

            // Populate Situaciones
            situacionSelect.innerHTML = '<option value="">Todas</option>';
            if (data.situaciones) {
                data.situaciones.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s['codigo situacion'];
                    option.textContent = `${s['codigo situacion']} - ${s['denominacion situacion utillaje'] || s['codigo situacion']}`;
                    situacionSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error fetching utillajes filters:', error);
    }
}

// Fetch Utillajes
async function fetchUtillajes() {
    console.log('>>> fetchUtillajes CALLED');
    const codigoInput = document.getElementById('utillajesCodigoFilter');
    const tipoSelect = document.getElementById('utillajesTipoFilter');
    const familiaSelect = document.getElementById('utillajesFamiliaFilter');
    const situacionSelect = document.getElementById('utillajesSituacionFilter');
    const activoSelect = document.getElementById('utillajesActivoFilter');
    const tbody = document.getElementById('utillajesTableBody');
    const infoDiv = document.getElementById('utillajesInfo');
    const countSpan = document.getElementById('utillajesResultCount');

    const codigo = codigoInput?.value || '';
    const tipo = tipoSelect?.value || '';
    const familia = familiaSelect?.value || '';
    const situacion = situacionSelect?.value || '';
    const activo = activoSelect?.value || '';

    // Show loading
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                    Cargando utillajes...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams();
        if (codigo) params.append('codigo', codigo);
        if (tipo) params.append('tipo', tipo);
        if (familia) params.append('familia', familia);
        if (situacion) params.append('situacion', situacion);
        if (activo !== '') params.append('activo', activo);

        // Add sorting parameters
        if (appData.utillajesSort) {
            params.append('sortBy', appData.utillajesSort.col);
            params.append('sortDir', appData.utillajesSort.dir);
        }

        const url = `http://localhost:3001/api/utillajes?${params.toString()}`;
        console.log('[UTILLAJES] Fetching data from:', url);

        const response = await fetch(url);
        const data = await response.json();
        console.log('[UTILLAJES] Data received:', data);

        if (data.success) {
            console.log('[UTILLAJES] Setting allData with', data.data?.length, 'records');
            appData.utillajesPagination.allData = data.data || [];
            appData.utillajesPagination.currentPage = 1;
            renderUtillajesTablePage();
            if (infoDiv) infoDiv.style.display = 'flex';
            if (countSpan) countSpan.textContent = `${data.count} registros encontrados (TOP 1000)`;
        } else {
            console.error('API Error:', data.error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Error: ${data.error}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching utillajes:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Error de conexión</td></tr>`;
    }
}

// Render Utillajes Table Page (with pagination)
function renderUtillajesTablePage() {
    console.log('renderUtillajesTablePage called');
    const tbody = document.getElementById('utillajesTableBody');
    const paginationBar = document.getElementById('utillajesPaginationBar');
    const paginationInfo = document.getElementById('utillajesPaginationInfo');
    const prevBtn = document.getElementById('utillajesPrevPageBtn');
    const nextBtn = document.getElementById('utillajesNextPageBtn');

    if (!tbody) {
        console.error('tbody not found!');
        return;
    }

    const allData = appData.utillajesPagination?.allData || [];
    const pageSize = appData.utillajesPagination?.pageSize || 50;
    const currentPage = appData.utillajesPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    console.log('Pagination state:', { allDataLength: allData.length, pageSize, currentPage, totalPages });

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    console.log('Page data:', { start, end, pageDataLength: pageData.length });

    if (allData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-tools-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron utillajes
                </td>
            </tr>
        `;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = allData.length > 0 ? 'flex' : 'none';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    tbody.innerHTML = pageData.map(u => {
        const descSituacion = u['descripcion situacion'] || u['situacion'] || '-';
        const descFamilia = u['descripcion familia'] || u['familia'] || '-';
        const descTipo = u['descripcion tipo'] || u['tipo utillaje'] || '-';

        return `
        <tr>
            <td style="font-weight: 600; color: var(--primary);">${u['codigo utillaje'] || '-'}</td>
            <td>
                <div style="font-weight: 500;">${u['tipo utillaje'] || '-'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${descTipo}</div>
            </td>
            <td>
                <div style="font-weight: 500;">${u['familia'] || '-'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${descFamilia}</div>
            </td>
            <td>
                <div style="font-weight: 500;">${u['situacion'] || '-'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${descSituacion}</div>
            </td>
            <td>
                ${u['activo'] === -1 || u['activo'] === 1 || u['activo'] === true
                ? '<span style="color: #10b981;"><i class="ri-checkbox-circle-fill"></i> SÍ</span>'
                : '<span style="color: var(--text-muted);"><i class="ri-close-circle-line"></i> No</span>'}
            </td>
            <td>${u['estanteria'] || '-'}</td>
        </tr>
    `;
    }).join('');
}

// Utillajes pagination event handlers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('utillajesPrevPageBtn')?.addEventListener('click', () => {
        if (appData.utillajesPagination.currentPage > 1) {
            appData.utillajesPagination.currentPage--;
            renderUtillajesTablePage();
        }
    });
    document.getElementById('utillajesNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil((appData.utillajesPagination.allData?.length || 0) / appData.utillajesPagination.pageSize);
        if (appData.utillajesPagination.currentPage < totalPages) {
            appData.utillajesPagination.currentPage++;
            renderUtillajesTablePage();
        }
    });

    // Utillajes search button and input handlers
    document.getElementById('utillajesSearchBtn')?.addEventListener('click', fetchUtillajes);
    document.getElementById('utillajesCodigoFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchUtillajes();
    });

    // Utillajes sorting handlers
    document.querySelectorAll('#utillajesTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortBy = th.getAttribute('data-sort');
            if (!sortBy) return;

            // Toggle direction if same column, else default to asc
            if (appData.utillajesSort.col === sortBy) {
                appData.utillajesSort.dir = appData.utillajesSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                appData.utillajesSort.col = sortBy;
                appData.utillajesSort.dir = 'asc';
            }

            // Update sort icons
            document.querySelectorAll('#utillajesTable th.sortable i').forEach(icon => {
                icon.className = 'ri-arrow-up-down-line sort-icon';
            });
            const icon = th.querySelector('i');
            if (icon) {
                icon.className = appData.utillajesSort.dir === 'asc'
                    ? 'ri-arrow-up-line sort-icon'
                    : 'ri-arrow-down-line sort-icon';
            }

            // Re-fetch with new sort
            fetchUtillajes();
        });
    });
});

// Event listeners for Clientes (function may not exist yet)
// document.addEventListener('DOMContentLoaded', () => {
//     document.getElementById('buscarClientesBtn')?.addEventListener('click', fetchClientes);
//     document.getElementById('clienteFilter')?.addEventListener('keypress', (e) => {
//         if (e.key === 'Enter') fetchClientes();
//     });
// });

// ============================================
// NORMAS LOGIC
// ============================================

async function fetchNormas() {
    const tipoSelect = document.getElementById('normasTipoFilter');
    const clienteInput = document.getElementById('normasClienteFilter');
    const controlSelect = document.getElementById('normasControlFilter');
    const tbody = document.getElementById('normasTableBody');
    const countSpan = document.getElementById('normasResultCount');
    const infoDiv = document.getElementById('normasInfo');

    // Show loading
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                    Cargando normas...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams();
        if (tipoSelect?.value) params.append('tipoNorma', tipoSelect.value);
        if (clienteInput?.value) params.append('normaCliente', clienteInput.value);
        if (controlSelect?.value) params.append('control', controlSelect.value);

        const response = await fetch(`http://localhost:3001/api/normas?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            if (countSpan) countSpan.textContent = `${data.count} registros encontrados`;
            if (infoDiv) infoDiv.style.display = 'flex';

            // Populate filter dropdowns
            if (tipoSelect && tipoSelect.options.length <= 1 && data.tipoNormas) {
                data.tipoNormas.forEach(tipo => {
                    const option = document.createElement('option');
                    option.value = tipo;
                    option.textContent = tipo;
                    tipoSelect.appendChild(option);
                });
            }

            if (controlSelect && controlSelect.options.length <= 1 && data.controles) {
                data.controles.forEach(ctrl => {
                    const option = document.createElement('option');
                    option.value = ctrl;
                    option.textContent = ctrl;
                    controlSelect.appendChild(option);
                });
            }

            // Store data and reset pagination
            appData.normasPagination.allData = data.data || [];
            appData.normasPagination.currentPage = 1;
            renderNormasTablePage();
        } else {
            console.error('Error fetching normas:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error al cargar normas</td></tr>`;
            }
        }
    } catch (error) {
        console.error('Error fetching normas:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error de conexion</td></tr>`;
        }
    }
}

function renderNormasTable(normas) {
    const tbody = document.getElementById('normasTableBody');
    if (!tbody) return;

    if (!normas || normas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron normas</td></tr>`;
        return;
    }

    tbody.innerHTML = normas.map(n => {
        // Estado: 1 or -1 = Activo, 0 or null = Obsoleto
        const estadoValue = n.Estado;
        const isActivo = estadoValue === -1 || estadoValue === 1 || estadoValue === '-1' || estadoValue === '1';
        const estadoText = isActivo ? 'Activo' : 'Obsoleto';
        const estadoClass = isActivo
            ? 'style="color: var(--success); font-weight: 500;"'
            : 'style="color: var(--danger); font-weight: 500;"';

        // Format date
        let fechaDisplay = '-';
        if (n['Fecha Norma']) {
            const fecha = new Date(n['Fecha Norma']);
            fechaDisplay = fecha.toLocaleDateString('es-ES');
        }

        return `
        <tr>
            <td><strong>${n['Tipo/Referencia'] || '-'}</strong></td>
            <td>${n['Edicion'] || '-'}</td>
            <td>${fechaDisplay}</td>
            <td ${estadoClass}>${estadoText}</td>
            <td>${n['Designacion'] || '-'}</td>
        </tr>
        `;
    }).join('');
}

// Event listeners for Normas
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buscarNormasBtn')?.addEventListener('click', fetchNormas);
    document.getElementById('normasClienteFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchNormas();
    });
});

// ============================================
// CALIDAD RECHAZOS DASHBOARD LOGIC
// ============================================

let calidadPieChartInstance = null;
let calidadArticulosChartInstance = null;
let calidadEvolutionChartInstance = null;
let calidadEvolutionData = [];

async function fetchCalidadRechazos() {
    console.log('[APP] fetchCalidadRechazos called');

    const yearSelect = document.getElementById('calidadYearFilter');
    const monthSelect = document.getElementById('calidadMonthFilter');
    const seccionSelect = document.getElementById('calidadSeccionFilter');
    const tipoSeccionSelect = document.getElementById('calidadTipoSeccionFilter');

    const year = yearSelect?.value || new Date().getFullYear();
    // Permitir mes vacío para "Todos" - no forzar mes actual
    const month = monthSelect?.value ?? '';
    const seccion = seccionSelect?.value || '';
    const tipoSeccion = tipoSeccionSelect?.value || 'causa';

    try {
        const params = new URLSearchParams();
        params.append('year', year);
        // Solo añadir mes si tiene valor (no es "Todos")
        if (month !== '' && month !== 'todos') {
            params.append('month', month);
        }
        if (seccion) params.append('seccion', seccion);
        params.append('tipoSeccion', tipoSeccion);

        const response = await fetch(`/api/calidad-dashboard?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Update KPIs
            const kpiPiezas = document.getElementById('calidadKpiPiezas');
            const kpiImporte = document.getElementById('calidadKpiImporte');
            const kpiCausas = document.getElementById('calidadKpiCausas');
            const kpiArticulos = document.getElementById('calidadKpiArticulos');
            const kpiPorcentaje = document.getElementById('calidadKpiPorcentaje');
            const kpiProducidas = document.getElementById('calidadKpiProducidas');

            if (kpiPiezas) kpiPiezas.innerText = parseInt(data.kpis.totalPiezas || 0).toLocaleString('es-ES');

            // Importe en formato K (miles)
            if (kpiImporte) {
                const importe = parseFloat(data.kpis.totalImporte || 0);
                if (importe >= 1000) {
                    kpiImporte.innerText = (importe / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K €';
                } else {
                    kpiImporte.innerText = importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
                }
            }
            if (kpiCausas) kpiCausas.innerText = data.kpis.totalCausas || 0;
            if (kpiArticulos) kpiArticulos.innerText = data.kpis.totalArticulos || 0;

            // Nuevos KPIs
            console.log('[CALIDAD] KPIs received:', data.kpis);
            if (kpiPorcentaje) {
                const porcentaje = parseFloat(data.kpis.porcentajeRechazo) || 0;
                kpiPorcentaje.innerText = porcentaje.toFixed(2) + ' %';
            }
            if (kpiProducidas) {
                const producidas = parseInt(data.kpis.totalProducidas) || 0;
                console.log('[CALIDAD] Producidas value:', producidas);
                kpiProducidas.innerText = producidas.toLocaleString('es-ES');
            }

            // Render causes table
            renderCalidadCausasTable(data.causes);

            // Render pie chart
            renderCalidadPieChart(data.causes);

            // Render articles table
            renderCalidadArticulosTable(data.articles);

            // Render articles chart
            renderCalidadArticulosChart(data.articles);

            // Update sections dropdown if available
            if (data.secciones && seccionSelect) {
                const currentVal = seccionSelect.value;
                seccionSelect.innerHTML = '<option value="">Todas</option>';
                data.secciones.forEach(sec => {
                    const option = document.createElement('option');
                    option.value = sec;
                    option.textContent = sec;
                    if (sec === currentVal) option.selected = true;
                    seccionSelect.appendChild(option);
                });
            }

            // Update years dropdown if available
            if (data.years && yearSelect) {
                const currentYear = yearSelect.value;
                yearSelect.innerHTML = '';
                data.years.forEach(y => {
                    const option = document.createElement('option');
                    option.value = y;
                    option.textContent = y;
                    if (String(y) === String(currentYear)) option.selected = true;
                    yearSelect.appendChild(option);
                });
            }

            // NO sobreescribir el mes seleccionado - mantener la selección del usuario

            // Render evolution chart
            calidadEvolutionData = data.evolution || [];
            renderCalidadEvolutionChart(calidadEvolutionData, 'importe');

        } else {
            console.error('Error fetching calidad dashboard:', data.error);
        }
    } catch (error) {
        console.error('Error fetching calidad dashboard:', error);
    }
}

function renderCalidadCausasTable(causes) {
    const tbody = document.getElementById('calidadCausasBody');
    if (!tbody) return;

    if (!causes || causes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted);">
                    No hay datos para el periodo seleccionado
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = causes.map(c => `
        <tr>
            <td><strong>${c.causaRechazo || '-'}</strong></td>
            <td>${c.descripcionCausa || '-'}</td>
            <td style="text-align: center;">${parseInt(c.PiezasRc || 0).toLocaleString('es-ES')}</td>
            <td style="text-align: right; font-weight: 500; color: var(--danger);">${parseFloat(c.ImporteRcPvpOp || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
        </tr>
    `).join('');
}

function renderCalidadPieChart(causes) {
    const ctx = document.getElementById('calidadPieChart');
    if (!ctx) return;

    if (calidadPieChartInstance) calidadPieChartInstance.destroy();

    if (!causes || causes.length === 0) {
        return;
    }

    // Take top 6 causes, group rest as "Otros"
    const top6 = causes.slice(0, 6);
    const rest = causes.slice(6);
    const otrosImporte = rest.reduce((sum, c) => sum + parseFloat(c.ImporteRcPvpOp || 0), 0);

    const labels = top6.map(c => c.causaRechazo || 'Sin codigo');
    const data = top6.map(c => parseFloat(c.ImporteRcPvpOp || 0));

    if (otrosImporte > 0) {
        labels.push('Otros');
        data.push(otrosImporte);
    }

    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#64748b'
    ];

    calidadPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right'
                }
            }
        }
    });
}

function renderCalidadArticulosTable(articles) {
    const tbody = document.getElementById('calidadArticulosBody');
    if (!tbody) return;

    if (!articles || articles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; color: var(--text-muted);">
                    No hay datos
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = articles.map(a => `
        <tr>
            <td><strong>${a.codigoArticulo || '-'}</strong></td>
            <td style="text-align: right; font-weight: 500; color: var(--danger);">${parseFloat(a.ImporteRcPvpOp || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
        </tr>
    `).join('');
}

function renderCalidadArticulosChart(articles) {
    const ctx = document.getElementById('calidadArticulosChart');
    if (!ctx) return;

    if (calidadArticulosChartInstance) calidadArticulosChartInstance.destroy();

    if (!articles || articles.length === 0) {
        return;
    }

    const labels = articles.map(a => a.codigoArticulo || '-');
    const data = articles.map(a => parseFloat(a.ImporteRcPvpOp || 0));

    calidadArticulosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Importe EUR',
                data: data,
                backgroundColor: '#ef4444',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value.toLocaleString('es-ES');
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Event Listeners for Calidad Dashboard
// Solo el botón Actualizar refresca los datos
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshCalidadDashboard');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchCalidadRechazos);
});

// Immediate attachment in case DOMContentLoaded already fired
if (document.getElementById('refreshCalidadDashboard')) {
    document.getElementById('refreshCalidadDashboard').addEventListener('click', fetchCalidadRechazos);
}

// Evolution chart rendering function
function renderCalidadEvolutionChart(evolution, metric = 'importe') {
    const ctx = document.getElementById('calidadEvolutionChart');
    if (!ctx) return;

    if (calidadEvolutionChartInstance) calidadEvolutionChartInstance.destroy();

    if (!evolution || evolution.length === 0) {
        return;
    }

    // Get unique sections and months
    const secciones = [...new Set(evolution.map(e => e.Seccion))];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Generate colors for sections
    const sectionColors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
        '#8b5cf6', '#ec4899', '#14b8a6', '#64748b', '#f43f5e'
    ];

    // Prepare datasets
    const datasets = secciones.map((seccion, index) => {
        const dataByMonth = new Array(12).fill(0);
        evolution.filter(e => e.Seccion === seccion).forEach(e => {
            const monthIndex = e.Mes - 1;
            if (metric === 'importe') {
                dataByMonth[monthIndex] = parseFloat(e.ImporteRcPvpOp || 0);
            } else {
                dataByMonth[monthIndex] = parseInt(e.PiezasRc || 0);
            }
        });

        return {
            label: seccion,
            data: dataByMonth,
            borderColor: sectionColors[index % sectionColors.length],
            backgroundColor: sectionColors[index % sectionColors.length] + '20',
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    calidadEvolutionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (metric === 'importe') {
                                return value.toLocaleString('es-ES') + ' EUR';
                            }
                            return value.toLocaleString('es-ES');
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let value = context.raw;
                            if (metric === 'importe') {
                                return context.dataset.label + ': ' + value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
                            }
                            return context.dataset.label + ': ' + value.toLocaleString('es-ES') + ' pzs';
                        }
                    }
                }
            }
        }
    });
}

// Toggle buttons for evolution chart
function setEvolutionChartMode(mode) {
    const importeBtn = document.getElementById('calidadEvolutionImporte');
    const piezasBtn = document.getElementById('calidadEvolutionPiezas');

    if (mode === 'importe') {
        if (importeBtn) {
            importeBtn.style.background = 'var(--primary)';
            importeBtn.style.color = 'white';
            importeBtn.style.borderColor = 'var(--primary)';
        }
        if (piezasBtn) {
            piezasBtn.style.background = 'var(--bg-card)';
            piezasBtn.style.color = 'var(--text-main)';
            piezasBtn.style.borderColor = 'var(--border)';
        }
    } else {
        if (piezasBtn) {
            piezasBtn.style.background = 'var(--primary)';
            piezasBtn.style.color = 'white';
            piezasBtn.style.borderColor = 'var(--primary)';
        }
        if (importeBtn) {
            importeBtn.style.background = 'var(--bg-card)';
            importeBtn.style.color = 'var(--text-main)';
            importeBtn.style.borderColor = 'var(--border)';
        }
    }

    renderCalidadEvolutionChart(calidadEvolutionData, mode);
}

// PDF Export function
function exportCalidadToPdf() {
    const dashboardElement = document.getElementById('calidadRechazosView');
    if (!dashboardElement) return;

    // Use browser print functionality
    const printWindow = window.open('', '_blank');
    const yearSelect = document.getElementById('calidadYearFilter');
    const monthSelect = document.getElementById('calidadMonthFilter');
    const seccionSelect = document.getElementById('calidadSeccionFilter');

    const year = yearSelect?.value || new Date().getFullYear();
    const monthValue = monthSelect?.value;
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const month = monthValue ? monthNames[parseInt(monthValue)] : 'Todos';
    const seccion = seccionSelect?.value || 'Todas';

    // Get KPI values
    const kpiPiezas = document.getElementById('calidadKpiPiezas')?.innerText || '0';
    const kpiImporte = document.getElementById('calidadKpiImporte')?.innerText || '0 EUR';
    const kpiCausas = document.getElementById('calidadKpiCausas')?.innerText || '0';
    const kpiArticulos = document.getElementById('calidadKpiArticulos')?.innerText || '0';

    // Get chart images
    const pieChart = document.getElementById('calidadPieChart');
    const articulosChart = document.getElementById('calidadArticulosChart');
    const evolutionChart = document.getElementById('calidadEvolutionChart');

    const pieChartImg = pieChart ? pieChart.toDataURL('image/png') : '';
    const articulosChartImg = articulosChart ? articulosChart.toDataURL('image/png') : '';
    const evolutionChartImg = evolutionChart ? evolutionChart.toDataURL('image/png') : '';

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard Rechazos - ${year} ${month}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h1 { color: #1f2937; font-size: 24px; margin-bottom: 5px; }
                .subtitle { color: #6b7280; margin-bottom: 20px; }
                .kpi-row { display: flex; gap: 20px; margin-bottom: 30px; }
                .kpi-box { flex: 1; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
                .kpi-value { font-size: 24px; font-weight: bold; color: #1f2937; }
                .kpi-label { font-size: 12px; color: #6b7280; }
                .chart-section { margin-bottom: 30px; page-break-inside: avoid; }
                .chart-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                img { max-width: 100%; height: auto; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>Dashboard de Rechazos</h1>
            <p class="subtitle">Ano: ${year} | Mes: ${month} | Seccion: ${seccion}</p>
            
            <div class="kpi-row">
                <div class="kpi-box">
                    <div class="kpi-value">${kpiPiezas}</div>
                    <div class="kpi-label">Piezas Rechazadas</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiImporte}</div>
                    <div class="kpi-label">Importe Total</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiCausas}</div>
                    <div class="kpi-label">Causas Diferentes</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-value">${kpiArticulos}</div>
                    <div class="kpi-label">Articulos Afectados</div>
                </div>
            </div>

            ${pieChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Distribucion por Causa</div>
                <img src="${pieChartImg}" />
            </div>` : ''}

            ${articulosChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Importe por Articulo</div>
                <img src="${articulosChartImg}" />
            </div>` : ''}

            ${evolutionChartImg ? `
            <div class="chart-section">
                <div class="chart-title">Evolucion Mensual por Seccion</div>
                <img src="${evolutionChartImg}" />
            </div>` : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.print();
    };
}

// Event listeners for evolution chart toggle buttons
document.addEventListener('DOMContentLoaded', () => {
    const importeBtn = document.getElementById('calidadEvolutionImporte');
    const piezasBtn = document.getElementById('calidadEvolutionPiezas');
    const exportBtn = document.getElementById('exportCalidadPdf');

    if (importeBtn) importeBtn.addEventListener('click', () => setEvolutionChartMode('importe'));
    if (piezasBtn) piezasBtn.addEventListener('click', () => setEvolutionChartMode('piezas'));
    if (exportBtn) exportBtn.addEventListener('click', exportCalidadToPdf);
});

// Immediate attachment
if (document.getElementById('calidadEvolutionImporte')) {
    document.getElementById('calidadEvolutionImporte').addEventListener('click', () => setEvolutionChartMode('importe'));
}
if (document.getElementById('calidadEvolutionPiezas')) {
    document.getElementById('calidadEvolutionPiezas').addEventListener('click', () => setEvolutionChartMode('piezas'));
}
if (document.getElementById('exportCalidadPdf')) {
    document.getElementById('exportCalidadPdf').addEventListener('click', exportCalidadToPdf);
}

// ============================================
// CENTROS (MAQUINAS) LOGIC
// ============================================

let centrosData = [];

async function fetchCentros() {
    console.log('[CENTROS] fetchCentros called');
    const seccion = document.getElementById('centrosSeccionFilter')?.value || '';
    const tipo = document.getElementById('centrosTipoFilter')?.value || '';
    const estado = document.getElementById('centrosEstadoFilter')?.value || '';

    try {
        const params = new URLSearchParams();
        if (seccion) params.append('seccion', seccion);
        if (tipo) params.append('tipo', tipo);
        if (estado) params.append('estado', estado);

        console.log('[CENTROS] Fetching /api/centros?', params.toString());
        const response = await fetch(`/api/centros?${params.toString()}`);
        const data = await response.json();
        console.log('[CENTROS] Response:', data);

        if (data.success) {
            centrosData = data.data;

            if (data.data.length === 0) {
                document.getElementById('centrosTableBody').innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron centros
                        </td>
                    </tr>
                `;
                document.getElementById('centrosPaginationBar').style.display = 'none';
            } else {
                // Store data for pagination
                appData.centrosPagination.allData = data.data;
                appData.centrosPagination.currentPage = 1;
                renderCentrosTablePage();
            }

            document.getElementById('centrosInfo').style.display = 'flex';
            document.getElementById('centrosResultCount').textContent = `${data.count} registros encontrados`;

            // Populate filter dropdowns
            const seccionSelect = document.getElementById('centrosSeccionFilter');
            if (seccionSelect && data.secciones) {
                const currentVal = seccionSelect.value;
                seccionSelect.innerHTML = '<option value="">Todas</option>';
                data.secciones.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s;
                    option.textContent = s;
                    if (s === currentVal) option.selected = true;
                    seccionSelect.appendChild(option);
                });
            }

            const tipoSelect = document.getElementById('centrosTipoFilter');
            if (tipoSelect && data.tipos) {
                const currentVal = tipoSelect.value;
                tipoSelect.innerHTML = '<option value="">Todos</option>';
                data.tipos.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t;
                    option.textContent = t;
                    if (t === currentVal) option.selected = true;
                    tipoSelect.appendChild(option);
                });
            }

            const estadoSelect = document.getElementById('centrosEstadoFilter');
            if (estadoSelect && estadoSelect.options.length <= 1) {
                // Create fixed options for Si/No instead of using raw values
                estadoSelect.innerHTML = '<option value="">Todos</option>';
                const siOption = document.createElement('option');
                siOption.value = 'si';
                siOption.textContent = 'Si';
                estadoSelect.appendChild(siOption);

                const noOption = document.createElement('option');
                noOption.value = 'no';
                noOption.textContent = 'No';
                estadoSelect.appendChild(noOption);
            }

        } else {
            console.error('Error fetching centros:', data.error);
        }
    } catch (error) {
        console.error('Error fetching centros:', error);
    }
}

function renderCentrosTable(centros) {
    const tbody = document.getElementById('centrosTableBody');
    if (!tbody) return;

    if (!centros || centros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-building-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No se encontraron centros
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = centros.map(c => {
        // Estado: -1 or 1 = Si (active), 0 or null = No (inactive)
        const estadoValue = c.estado;
        const isActive = estadoValue === -1 || estadoValue === 1 || estadoValue === '-1' || estadoValue === '1';
        const estadoText = isActive ? 'Si' : 'No';
        const estadoClass = isActive
            ? 'style="color: var(--success); font-weight: 500;"'
            : 'style="color: var(--danger); font-weight: 500;"';

        return `
        <tr>
            <td><strong>${c.codMaquina || '-'}</strong></td>
            <td>${c.descripcion || '-'}</td>
            <td>${c.tipo || '-'}</td>
            <td>${c.seccion || '-'}</td>
            <td ${estadoClass}>${estadoText}</td>
        </tr>
        `;
    }).join('');
}

// Event listeners for Centros
document.addEventListener('DOMContentLoaded', () => {
    const buscarBtn = document.getElementById('buscarCentrosBtn');
    if (buscarBtn) buscarBtn.addEventListener('click', fetchCentros);

    const seccionFilter = document.getElementById('centrosSeccionFilter');
    if (seccionFilter) seccionFilter.addEventListener('change', fetchCentros);

    const tipoFilter = document.getElementById('centrosTipoFilter');
    if (tipoFilter) tipoFilter.addEventListener('change', fetchCentros);

    const estadoFilter = document.getElementById('centrosEstadoFilter');
    if (estadoFilter) estadoFilter.addEventListener('change', fetchCentros);
});

// Immediate attachment
if (document.getElementById('buscarCentrosBtn')) {
    document.getElementById('buscarCentrosBtn').addEventListener('click', fetchCentros);
}

// ============================================
// OTD (ON-TIME DELIVERY) DASHBOARD LOGIC
// ============================================

let otdCumplimientoChartInstance = null;
let otdState = {
    ano: new Date().getFullYear(),
    cliente: '',
    familia: '',
    articulo: '',
    page: 1,
    pageSize: 50,
    sortBy: 'fechaAlbaran',
    sortOrder: 'DESC',
    monthlyData: [],
    rechazosData: null,
    filterMonth: null,
    filterStatus: null
};

// Expose to window for inline onclick handlers
window.handleOTDMetricClick = function (monthNum, field) {
    console.log(`[OTD] Metric clicked: Month ${monthNum}, Field ${field}`);

    // Map field to status
    let status = null;
    if (field === 'lineasATiempo') status = 'a_tiempo';
    else if (field === 'lineasRetrasadas') status = 'retrasado';
    else if (field === 'lineasEntregadas') status = null; // All
    else return; // Ignore clicks on other rows like % or delay days for status filtering (only month?)

    // Update state
    otdState.filterMonth = monthNum;
    otdState.filterStatus = status;
    otdState.page = 1;

    console.log('[OTD] Updated state from click:', { month: otdState.filterMonth, status: otdState.filterStatus });

    // Refresh detail table
    fetchOTDDetalle();

    // Re-render metrics table to show selection
    renderOTDMetricsTable(otdState.monthlyData, otdState.totals || {});
}

async function fetchOTDData() {
    console.log('[OTD] fetchOTDData called');

    const anoSelect = document.getElementById('otdAnoFilter');
    const clienteSelect = document.getElementById('otdClienteFilter');
    const otdArticuloFilter = document.getElementById('otdArticuloFilter');

    // Helper to update selected text for family
    window.updateOTDFamiliaSelectedText = function () {
        const container = document.getElementById('otdFamiliaOptions');
        if (!container) return;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        const textSpan = document.getElementById('otdFamiliaSelectedText');

        if (checkboxes.length === 0) {
            textSpan.textContent = "Todas";
        } else if (checkboxes.length === 1) {
            textSpan.textContent = checkboxes[0].dataset.label || checkboxes[0].value;
        } else {
            textSpan.textContent = `${checkboxes.length} seleccionadas`;
        }
    }

    otdState.ano = anoSelect?.value || new Date().getFullYear();
    otdState.cliente = clienteSelect?.value || '';
    // otdState.familia is updated by checkbox logic or manually if needed
    // Default empty if not set
    if (typeof otdState.familia === 'undefined') otdState.familia = '';
    otdState.articulo = otdArticuloFilter?.value || '';

    // Reset interactive filters when main context changes
    otdState.filterMonth = null;
    otdState.filterStatus = null;

    try {
        // Fetch main statistics
        const params = new URLSearchParams();
        params.append('ano', otdState.ano);
        if (otdState.cliente) params.append('cliente', otdState.cliente);
        if (otdState.familia) params.append('familia', otdState.familia);
        if (otdState.articulo) params.append('articulo', otdState.articulo);

        const response = await fetch(`/api/otd-estadisticas?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            otdState.monthlyData = data.monthlyMetrics;
            otdState.totals = data.totals;

            // Populate filters if first load
            if (anoSelect && data.filters.years) {
                const currentAno = anoSelect.value;
                anoSelect.innerHTML = '';
                data.filters.years.forEach(y => {
                    const option = document.createElement('option');
                    option.value = y;
                    option.textContent = y;
                    if (String(y) === String(currentAno || data.selectedFilters.ano)) option.selected = true;
                    anoSelect.appendChild(option);
                });
            }

            if (clienteSelect && data.filters.clientes && clienteSelect.options.length <= 1) {
                clienteSelect.innerHTML = '<option value="">Todos</option>';
                data.filters.clientes.forEach(c => {
                    const option = document.createElement('option');
                    // Value is name because backend filters by name
                    option.value = c.nombre;
                    // Format: [codigo cliente] - [nombre empresa]
                    const displayText = `${c.codigo} - ${c.nombre}`;
                    option.textContent = displayText.length > 60 ? displayText.substring(0, 60) + '...' : displayText;
                    clienteSelect.appendChild(option);
                });
            }

            if (data.filters.familias && document.getElementById('otdFamiliaOptions') && document.getElementById('otdFamiliaOptions').children.length <= 1) {
                const container = document.getElementById('otdFamiliaOptions');
                container.innerHTML = '';

                // Add "Select All" or just list items? Let's list items.
                // Maybe a clear/all button?
                // Let's just list items for now. If user selects none, it means "All".

                data.filters.familias.forEach(f => {
                    const div = document.createElement('div');
                    div.style.padding = '0.25rem 0.5rem';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '0.5rem';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = f.codigo;
                    // Check if previously selected (if refreshing params)
                    if (otdState.familia) {
                        const selected = otdState.familia.split(',');
                        if (selected.includes(f.codigo)) checkbox.checked = true;
                    }
                    checkbox.dataset.label = f.denominacion ? `${f.codigo}-${f.denominacion}` : f.codigo;
                    checkbox.style.cursor = 'pointer';

                    // Add change listener to update text and maybe fetch? 
                    // To avoid too many fetches, maybe only fetch when dropdown closes or "Buscar" button?
                    // Currently "Buscar" button exists (#buscarOtdBtn). User can use that.
                    // But existing code for select used 'change'.
                    // Let's rely on "Buscar" button for refreshing data now that we have multi-select.
                    // OR trigger fetch on every checkbox change? Might be spammy. 
                    // Let's update the "Selected Text" on change.

                    checkbox.addEventListener('change', () => {
                        updateOTDFamiliaSelectedText();
                        // Gather selected families and update state
                        const container = document.getElementById('otdFamiliaOptions');
                        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
                        const selected = Array.from(checkboxes).map(cb => cb.value);
                        otdState.familia = selected.join(',');
                        otdState.page = 1;
                        fetchOTDData();
                    });

                    const label = document.createElement('label');
                    label.textContent = f.denominacion ? `${f.codigo}-${f.denominacion}` : f.codigo;
                    label.style.fontSize = '0.8rem';
                    label.style.cursor = 'pointer';
                    label.onclick = () => checkbox.click(); // Label click toggles checkbox

                    div.appendChild(checkbox);
                    div.appendChild(label);
                    container.appendChild(div);
                });
                updateOTDFamiliaSelectedText(); // Initialize text
            }

            // Render metrics table
            renderOTDMetricsTable(data.monthlyMetrics, data.totals);

            // Render cumplimiento chart
            renderOTDCumplimientoChart(data.monthlyMetrics, data.totals);

            // Render top articles table
            renderOTDArticulosTable(data.topArticles);
        } else {
            console.error('Error fetching OTD data:', data.error);
        }

        // Fetch rechazos data
        await fetchOTDRechazos();

        // Fetch detail data
        await fetchOTDDetalle();

    } catch (error) {
        console.error('Error fetching OTD data:', error);
    }
}

async function fetchOTDRechazos() {
    try {
        const params = new URLSearchParams();
        params.append('ano', otdState.ano);
        if (otdState.cliente) params.append('cliente', otdState.cliente);
        if (otdState.familia) params.append('familia', otdState.familia);
        if (otdState.articulo) params.append('articulo', otdState.articulo);

        const response = await fetch(`/api/otd-rechazos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            otdState.rechazosData = data;
            renderOTDPiezasTable(otdState.monthlyData, data);
            renderOTDRechazadosTable(data.topRechazados);
        }
    } catch (error) {
        console.error('Error fetching OTD rechazos:', error);
    }
}

async function fetchOTDDetalle() {
    try {
        const params = new URLSearchParams();
        params.append('ano', otdState.ano);
        if (otdState.cliente) params.append('cliente', otdState.cliente);
        if (otdState.familia) params.append('familia', otdState.familia);
        if (otdState.articulo) params.append('articulo', otdState.articulo);

        if (otdState.filterMonth) params.append('month', otdState.filterMonth);
        if (otdState.filterStatus) params.append('estado', otdState.filterStatus);

        params.append('page', otdState.page);
        params.append('pageSize', otdState.pageSize);
        params.append('sortBy', otdState.sortBy);
        params.append('sortOrder', otdState.sortOrder);



        console.log('[OTD] Fetching details with params:', params.toString());

        const response = await fetch(`/api/otd-detalle?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            renderOTDDetalleTable(data.data);
            document.getElementById('otdPaginationInfo').textContent =
                `Mostrando ${(data.page - 1) * data.pageSize + 1}-${Math.min(data.page * data.pageSize, data.total)} de ${data.total}`;

            // Update pagination buttons
            document.getElementById('otdPrevPage').disabled = data.page <= 1;
            document.getElementById('otdNextPage').disabled = data.page >= data.totalPages;
        }
    } catch (error) {
        console.error('Error fetching OTD detalle:', error);
    }
}

function renderOTDMetricsTable(monthlyData, totals) {
    const tbody = document.getElementById('otdMetricsBody');
    if (!tbody) return;

    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Create lookup by month number
    const lookup = {};
    monthlyData.forEach(m => {
        lookup[m.mesNumero] = m;
    });

    // Build rows
    const rows = [
        { tipo: 'Lineas entregadas', field: 'lineasEntregadas', total: totals.lineasEntregadas },
        { tipo: 'Total lineas a tiempo', field: 'lineasATiempo', total: totals.lineasATiempo },
        { tipo: 'Total lineas retrasadas (+1 dia)', field: 'lineasRetrasadas', total: totals.lineasRetrasadas, isNegative: true },
        { tipo: '% cumplimiento entregas', field: 'cumplimiento', isPercent: true, total: totals.cumplimiento + ' %' },
        { tipo: 'Dias retraso', field: 'diasRetraso', total: totals.diasRetraso }
    ];

    tbody.innerHTML = rows.map((row, rowIdx) => {
        const cells = meses.map((mes, idx) => {
            const monthNum = idx + 1;
            const monthData = lookup[monthNum];
            let value = '';

            if (monthData) {
                if (row.isPercent) {
                    const lineasEntregadas = monthData.lineasEntregadas || 0;
                    const lineasATiempo = monthData.lineasATiempo || 0;
                    value = lineasEntregadas > 0
                        ? (lineasATiempo / lineasEntregadas * 100).toFixed(1) + ' %'
                        : '';
                } else {
                    value = monthData[row.field] != null ? Math.round(monthData[row.field]) : '';
                }
            }

            const style = row.isPercent ? 'font-weight: 500;' : (row.isNegative ? 'color: #dc2626;' : '');

            // Check if selected
            let isSelected = false;
            let currentStatus = null;
            if (row.field === 'lineasATiempo') currentStatus = 'a_tiempo';
            else if (row.field === 'lineasRetrasadas') currentStatus = 'retrasado';
            else if (row.field === 'lineasEntregadas') currentStatus = null;
            else currentStatus = 'ignore';

            if (otdState.filterMonth === monthNum &&
                (otdState.filterStatus === currentStatus || (otdState.filterStatus === null && row.field === 'lineasEntregadas'))) {
                // Only highlight if it's a clickable row and matches status
                if (currentStatus !== 'ignore') isSelected = true;
            }

            const bgStyle = isSelected ? 'background-color: #0078d4; color: white; font-weight: 600; border: 2px solid #005a9e;' : '';
            const cursorStyle = (['lineasEntregadas', 'lineasATiempo', 'lineasRetrasadas'].includes(row.field))
                ? 'cursor: pointer;' : '';

            const clickHandler = (['lineasEntregadas', 'lineasATiempo', 'lineasRetrasadas'].includes(row.field))
                ? `onclick="handleOTDMetricClick(${monthNum}, '${row.field}')"`
                : '';

            return `<td ${clickHandler} style="padding: 0.5rem; text-align: center; border: 1px solid var(--border); ${style} ${bgStyle} ${cursorStyle}">${value}</td>`;
        }).join('');

        const totalStyle = row.isNegative ? 'background: #fca5a5; font-weight: 600; color: #991b1b;' : 'background: #86efac; font-weight: 600; color: #166534;';
        const borderTop = rowIdx === 0 ? '' : '';

        return `
            <tr style="${borderTop}">
                <td style="padding: 0.5rem 0.75rem; text-align: left; border: 1px solid var(--border); font-weight: 500;">${row.tipo}</td>
                ${cells}
                <td style="padding: 0.5rem; text-align: center; border: 1px solid var(--border); ${totalStyle}">${row.total}</td>
            </tr>
        `;
    }).join('');
}

function renderOTDPiezasTable(monthlyData, rechazosData) {
    const tbody = document.getElementById('otdPiezasBody');
    if (!tbody) return;

    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Create lookups
    const deliveryLookup = {};
    monthlyData.forEach(m => {
        deliveryLookup[m.mesNumero] = m;
    });

    const rechazosLookup = {};
    if (rechazosData && rechazosData.monthlyRechazos) {
        rechazosData.monthlyRechazos.forEach(m => {
            rechazosLookup[m.mesNumero] = m;
        });
    }

    // Build rows
    const rows = [
        {
            tipo: 'PZAS entregadas',
            getValue: (idx) => {
                const m = deliveryLookup[idx + 1];
                return m ? Math.round(m.pzasEntregadas || 0).toLocaleString() : '';
            },
            total: rechazosData?.totals?.pzasEntregadas ? Math.round(rechazosData.totals.pzasEntregadas).toLocaleString() : '0'
        },
        {
            tipo: 'PZAS RECHAZADAS CLIENTE',
            getValue: (idx) => {
                const m = rechazosLookup[idx + 1];
                return m ? Math.round(m.pzasRechazadas || 0).toLocaleString() : '';
            },
            total: rechazosData?.totals?.pzasRechazadas ? Math.round(rechazosData.totals.pzasRechazadas).toLocaleString() : '0',
            isNegative: true
        },
        {
            tipo: '% rechazo cliente',
            getValue: (idx) => {
                const m = rechazosLookup[idx + 1];
                if (m && m.pzasEntregadas > 0) {
                    return ((m.pzasRechazadas / m.pzasEntregadas) * 100).toFixed(1) + ' %';
                }
                return '';
            },
            total: rechazosData?.totals?.porcentajeRechazo ? rechazosData.totals.porcentajeRechazo + ' %' : '0.0 %'
        }
    ];

    tbody.innerHTML = rows.map(row => {
        const cells = meses.map((mes, idx) => {
            const value = row.getValue(idx);
            const style = row.isNegative && value ? 'color: #dc2626;' : '';
            return `<td style="padding: 0.5rem; text-align: center; border: 1px solid var(--border); ${style}">${value}</td>`;
        }).join('');

        const totalStyle = row.isNegative ? 'background: #fca5a5; font-weight: 600; color: #991b1b;' : 'background: #86efac; font-weight: 600; color: #166534;';

        return `
            <tr>
                <td style="padding: 0.5rem 0.75rem; text-align: left; border: 1px solid var(--border); font-weight: 500;">${row.tipo}</td>
                ${cells}
                <td style="padding: 0.5rem; text-align: center; border: 1px solid var(--border); ${totalStyle}">${row.total}</td>
            </tr>
        `;
    }).join('');
}

function renderOTDCumplimientoChart(monthlyData, totals) {
    const ctx = document.getElementById('otdCumplimientoChart');
    if (!ctx) return;

    if (otdCumplimientoChartInstance) otdCumplimientoChartInstance.destroy();

    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Create lookup and calculate cumplimiento by month
    const data = meses.map((mes, idx) => {
        const monthData = monthlyData.find(m => m.mesNumero === idx + 1);
        if (monthData && monthData.lineasEntregadas > 0) {
            return (monthData.lineasATiempo / monthData.lineasEntregadas * 100);
        }
        return null;
    });

    otdCumplimientoChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: '% Cumplimiento',
                data: data,
                borderColor: '#0078d4',
                backgroundColor: 'rgba(0, 120, 212, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function (value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.raw != null ? context.raw.toFixed(1) + '%' : '';
                        }
                    }
                }
            }
        }
    });
}

function renderOTDArticulosTable(articles) {
    const tbody = document.getElementById('otdArticulosBody');
    if (!tbody) return;

    if (!articles || articles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 1rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = articles.map(a => `
        <tr>
            <td style="padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border);">${a.articulo || '-'}</td>
            <td style="padding: 0.4rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border);">${(a.cantidad || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderOTDRechazadosTable(rechazados) {
    const tbody = document.getElementById('otdRechazadosBody');
    if (!tbody) return;

    if (!rechazados || rechazados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 1rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = rechazados.map(a => `
        <tr>
            <td style="padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border);">${a.articulo || '-'}</td>
            <td style="padding: 0.4rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border); color: #dc2626;">${(a.cantidadRechazada || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderOTDDetalleTable(data) {
    const tbody = document.getElementById('otdDetalleBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    // Helper function to format numbers with thousands separator (Spanish format: dot)
    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('es-ES');
    };

    tbody.innerHTML = data.map((item, idx) => {
        const fechaAlbaranFormatted = item.fechaAlbaran
            ? new Date(item.fechaAlbaran).toLocaleDateString('es-ES')
            : '-';
        const fechaEntregaFormatted = item.fechaEntrega
            ? new Date(item.fechaEntrega).toLocaleDateString('es-ES')
            : '-';
        const diasRetraso = item.diferenciaDias || 0;
        const diasRetrasoStyle = diasRetraso > 0 ? 'color: #dc2626; font-weight: 500;' : 'color: #16a34a;';

        return `
            <tr>
                <td style="padding: 0.4rem; text-align: center; border: 1px solid var(--border);">${idx + 1}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border);">${item.numAlbaran ? formatNumber(item.numAlbaran) : '-'}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border);">${item.articulo || '-'}</td>
                <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border);">${formatNumber(item.cantidadPedida)}</td>
                <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border);">${formatNumber(item.cantidadServida)}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border);">${fechaAlbaranFormatted}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border);">${fechaEntregaFormatted}</td>
                <td style="padding: 0.4rem; text-align: center; border: 1px solid var(--border); ${diasRetrasoStyle}">${diasRetraso}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border);">${item.cliente || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Event listeners for OTD
document.addEventListener('DOMContentLoaded', () => {
    const anoFilter = document.getElementById('otdAnoFilter');
    if (anoFilter) anoFilter.addEventListener('change', () => {
        otdState.page = 1;
        fetchOTDData();
    });

    const clienteFilter = document.getElementById('otdClienteFilter');
    if (clienteFilter) clienteFilter.addEventListener('change', () => {
        otdState.page = 1;
        fetchOTDData();
    });

    // Custom Dropdown Logic for Familia
    const familiaSelected = document.getElementById('otdFamiliaSelected');
    const familiaOptions = document.getElementById('otdFamiliaOptions');

    if (familiaSelected && familiaOptions) {
        familiaSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = familiaOptions.style.display === 'none';
            familiaOptions.style.display = isHidden ? 'block' : 'none';
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!familiaSelected.contains(e.target) && !familiaOptions.contains(e.target)) {
                familiaOptions.style.display = 'none';
            }
        });

        // Prevent closing when clicking inside options
        familiaOptions.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    const buscarBtn = document.getElementById('buscarOtdBtn');
    if (buscarBtn) {
        buscarBtn.addEventListener('click', () => {
            // Gather selected families
            const container = document.getElementById('otdFamiliaOptions');
            const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
            const selected = Array.from(checkboxes).map(cb => cb.value);
            otdState.familia = selected.join(',');

            otdState.page = 1;
            fetchOTDData();
        });
    }

    const articuloFilter = document.getElementById('otdArticuloFilter');
    if (articuloFilter) {
        articuloFilter.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                otdState.page = 1;
                fetchOTDData();
            }
        });
    }

    const prevPage = document.getElementById('otdPrevPage');
    if (prevPage) prevPage.addEventListener('click', () => {
        if (otdState.page > 1) {
            otdState.page--;
            fetchOTDDetalle();
        }
    });

    const nextPage = document.getElementById('otdNextPage');
    if (nextPage) nextPage.addEventListener('click', () => {
        otdState.page++;
        fetchOTDDetalle();
    });

    // Column sorting for Detalle table
    const detalleTable = document.getElementById('otdDetalleTable');
    if (detalleTable) {
        detalleTable.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.getAttribute('data-sort');
                if (otdState.sortBy === sortField) {
                    otdState.sortOrder = otdState.sortOrder === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    otdState.sortBy = sortField;
                    otdState.sortOrder = 'DESC';
                }
                otdState.page = 1;
                fetchOTDDetalle();
            });
        });
    }
});

// Immediate attachment for OTD event listeners
if (document.getElementById('otdAnoFilter')) {
    document.getElementById('otdAnoFilter').addEventListener('change', () => {
        otdState.page = 1;
        fetchOTDData();
    });
}
if (document.getElementById('otdClienteFilter')) {
    document.getElementById('otdClienteFilter').addEventListener('change', () => {
        otdState.page = 1;
        fetchOTDData();
    });
}
if (document.getElementById('otdFamiliaFilter')) {
    document.getElementById('otdFamiliaFilter').addEventListener('change', () => {
        otdState.page = 1;
        fetchOTDData();
    });
}
if (document.getElementById('otdArticuloFilter')) {
    document.getElementById('otdArticuloFilter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            otdState.page = 1;
            fetchOTDData();
        }
    });
}
if (document.getElementById('otdPrevPage')) {
    document.getElementById('otdPrevPage').addEventListener('click', () => {
        if (otdState.page > 1) {
            otdState.page--;
            fetchOTDDetalle();
        }
    });
}
if (document.getElementById('otdNextPage')) {
    document.getElementById('otdNextPage').addEventListener('click', () => {
        otdState.page++;
        fetchOTDDetalle();
    });
}

// ============================================
// CAPACIDAD PRODUCTIVA (CAPA CHARGE) LOGIC
// ============================================

let capacidadSeccionesChartInstance = null;
let capacidadState = {
    ano: new Date().getFullYear(),
    seccion: '',
    diasMax: 365,
    diasDisponibles: 250
};

// Initialize Capacidad Productiva
async function fetchCapaCharge() {
    console.log('[CAPACIDAD] fetchCapaCharge called');

    // Load configuration first
    await loadCapacidadConfiguracion();

    // Load filters
    await loadCapacidadFiltros();

    // Then load data
    await fetchCapacidadData();
}

// Load configuration from database
async function loadCapacidadConfiguracion() {
    console.log('[CAPACIDAD] Loading configuration');
    try {
        const yearSelect = document.getElementById('capacidadYearFilter');
        const year = yearSelect?.value || new Date().getFullYear();

        const response = await fetch(`/api/capacidad/configuracion?ano=${year}`);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            const config = data.data[0];
            const diasMaxInput = document.getElementById('capacidadDiasMax');
            const diasDispInput = document.getElementById('capacidadDiasDisponibles');

            if (diasMaxInput) diasMaxInput.value = config.dias_max || 365;
            if (diasDispInput) diasDispInput.value = config.dias_disponibles || 250;

            capacidadState.diasMax = config.dias_max || 365;
            capacidadState.diasDisponibles = config.dias_disponibles || 250;
        }
    } catch (err) {
        console.error('[CAPACIDAD] Error loading configuration:', err);
    }
}

// Save configuration
async function guardarCapacidadConfiguracion() {
    console.log('[CAPACIDAD] Saving configuration');

    const yearSelect = document.getElementById('capacidadYearFilter');
    const diasMaxInput = document.getElementById('capacidadDiasMax');
    const diasDispInput = document.getElementById('capacidadDiasDisponibles');

    const ano = parseInt(yearSelect?.value) || new Date().getFullYear();
    const diasMax = parseInt(diasMaxInput?.value) || 365;
    const diasDisp = parseInt(diasDispInput?.value) || 250;

    // Pedir confirmación al usuario con modal estilizado
    const confirmado = await showConfirmModal(
        'Guardar Configuración',
        `¿Guardar configuración para el año <strong>${ano}</strong>?<br><br>
        <span style="color: var(--primary);">Días Máx:</span> ${diasMax}<br>
        <span style="color: var(--primary);">Días Disponibles:</span> ${diasDisp}`
    );

    if (!confirmado) {
        return; // Si el usuario cancela, no hacer nada
    }

    const body = {
        ano: ano,
        dias_max: diasMax,
        dias_disponibles: diasDisp
    };

    try {
        const response = await fetch('/api/capacidad/configuracion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (data.success) {
            // Mostrar mensaje de éxito
            showNotification('Configuración guardada correctamente para el año ' + ano, 'success');
            // Refresh data
            await fetchCapacidadData();
        } else {
            showNotification('Error al guardar configuración: ' + (data.error || 'Error desconocido'), 'error');
        }
    } catch (err) {
        console.error('[CAPACIDAD] Error saving configuration:', err);
        showNotification('Error al guardar configuración: ' + err.message, 'error');
    }
}

// Modal de confirmación estilizado
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.id = 'confirmModalOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000; backdrop-filter: blur(4px);
        `;

        // Crear modal
        overlay.innerHTML = `
            <div style="
                background: var(--bg-card, #fff); border-radius: 12px; padding: 1.5rem;
                max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: modalSlideIn 0.2s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary, #667eea), #764ba2); display: flex; align-items: center; justify-content: center;">
                        <i class="ri-question-line" style="color: white; font-size: 1.25rem;"></i>
                    </div>
                    <h3 style="margin: 0; font-size: 1.1rem;">${title}</h3>
                </div>
                <p style="margin: 0 0 1.5rem 0; color: var(--text-main, #333); line-height: 1.6;">${message}</p>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button id="confirmModalCancel" style="
                        padding: 0.5rem 1.25rem; border-radius: 6px; border: 1px solid var(--border, #ddd);
                        background: transparent; color: var(--text-main, #333); cursor: pointer; font-weight: 500;
                    ">Cancelar</button>
                    <button id="confirmModalOk" style="
                        padding: 0.5rem 1.25rem; border-radius: 6px; border: none;
                        background: linear-gradient(135deg, var(--primary, #667eea), #764ba2);
                        color: white; cursor: pointer; font-weight: 500;
                    ">Confirmar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Event listeners
        document.getElementById('confirmModalOk').onclick = () => {
            overlay.remove();
            resolve(true);
        };
        document.getElementById('confirmModalCancel').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        };
    });
}

// Notificación estilizada (toast)
function showNotification(message, type = 'info') {
    // Eliminar notificación anterior si existe
    const existing = document.getElementById('appNotification');
    if (existing) existing.remove();

    const colors = {
        success: { bg: 'linear-gradient(135deg, #10b981, #059669)', icon: 'ri-checkbox-circle-line' },
        error: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: 'ri-error-warning-line' },
        info: { bg: 'linear-gradient(135deg, #667eea, #764ba2)', icon: 'ri-information-line' },
        warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: 'ri-alert-line' }
    };

    const config = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.id = 'appNotification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        background: var(--bg-card, #fff); border-radius: 10px; padding: 1rem 1.25rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 0.75rem;
        max-width: 400px; animation: notificationSlideIn 0.3s ease-out;
        border-left: 4px solid transparent; border-image: ${config.bg} 1;
    `;

    notification.innerHTML = `
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${config.bg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="${config.icon}" style="color: white; font-size: 1.1rem;"></i>
        </div>
        <p style="margin: 0; color: var(--text-main, #333); flex: 1; line-height: 1.4;">${message}</p>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted, #888);">
            <i class="ri-close-line" style="font-size: 1.25rem;"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'notificationSlideOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Añadir estilos de animación si no existen
if (!document.getElementById('notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.9) translateY(-20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes notificationSlideIn {
            from { opacity: 0; transform: translateX(100px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes notificationSlideOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100px); }
        }
    `;
    document.head.appendChild(style);
}

// Load filters - Ahora carga secciones de forma más robusta
async function loadCapacidadFiltros() {
    console.log('[CAPACIDAD] Loading filters - START');
    try {
        // Cargar datos principales
        const response = await fetch('/api/capacidad/datos?ano=' + (new Date().getFullYear()));
        const data = await response.json();
        console.log('[CAPACIDAD] Response received, success:', data.success, 'filtros:', !!data.filtros);

        if (data.success && data.filtros) {
            // Populate year filter
            const yearSelect = document.getElementById('capacidadYearFilter');
            if (yearSelect && data.filtros.years && data.filtros.years.length > 0) {
                const currentValue = yearSelect.value;
                yearSelect.innerHTML = '';
                data.filtros.years.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    if (String(year) === String(currentValue) || year === capacidadState.ano) option.selected = true;
                    yearSelect.appendChild(option);
                });
            }

            // Populate seccion filter
            const seccionSelect = document.getElementById('capacidadSeccionFilter');
            if (seccionSelect) {
                seccionSelect.innerHTML = '<option value="">Todas</option>';

                // Primero intentar usar secciones del filtro (viene de MAESTRO SECCIONES)
                if (data.filtros.secciones && data.filtros.secciones.length > 0) {
                    console.log('[CAPACIDAD] Using filtros.secciones:', data.filtros.secciones.length);
                    data.filtros.secciones.forEach(s => {
                        const option = document.createElement('option');
                        option.value = s.codigo;
                        option.textContent = s.denominacion || s.codigo;
                        seccionSelect.appendChild(option);
                    });
                } else if (data.detalleSecciones && data.detalleSecciones.length > 0) {
                    // Fallback a secciones del detalle
                    console.log('[CAPACIDAD] Using detalleSecciones:', data.detalleSecciones.length);
                    data.detalleSecciones.forEach(s => {
                        const option = document.createElement('option');
                        option.value = s.seccion;
                        option.textContent = s.seccionNombre || s.seccion;
                        seccionSelect.appendChild(option);
                    });
                } else {
                    console.log('[CAPACIDAD] No secciones found in response');
                }

                console.log('[CAPACIDAD] Secciones loaded:', seccionSelect.options.length - 1);
            }
        }
    } catch (err) {
        console.error('[CAPACIDAD] Error loading filters:', err);
    }
}


// Fetch main Capacidad data
async function fetchCapacidadData() {
    console.log('[CAPACIDAD] Fetching data');

    const yearSelect = document.getElementById('capacidadYearFilter');
    const seccionSelect = document.getElementById('capacidadSeccionFilter');

    capacidadState.ano = parseInt(yearSelect?.value) || new Date().getFullYear();
    capacidadState.seccion = seccionSelect?.value || '';

    try {
        const params = new URLSearchParams();
        params.append('ano', capacidadState.ano);
        if (capacidadState.seccion) params.append('seccion', capacidadState.seccion);

        const response = await fetch(`/api/capacidad/datos?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Update config display
            const diasMaxInput = document.getElementById('capacidadDiasMax');
            const diasDispInput = document.getElementById('capacidadDiasDisponibles');
            if (diasMaxInput) diasMaxInput.value = data.configuracion.diasMax;
            if (diasDispInput) diasDispInput.value = data.configuracion.diasDisponibles;

            // Poblar filtro de secciones si está vacío
            const seccionSelectEl = document.getElementById('capacidadSeccionFilter');
            if (seccionSelectEl && seccionSelectEl.options.length <= 1) {
                if (data.filtros && data.filtros.secciones && data.filtros.secciones.length > 0) {
                    console.log('[CAPACIDAD] Poblando secciones:', data.filtros.secciones.length);
                    data.filtros.secciones.forEach(s => {
                        const option = document.createElement('option');
                        option.value = s.codigo;
                        option.textContent = s.denominacion || s.codigo;
                        seccionSelectEl.appendChild(option);
                    });
                }
            }

            // Render info bar
            renderCapacidadInfoBar(data.configuracion, data.kpis);

            // Render KPIs
            renderCapacidadKPIs(data.kpis);

            // Render chart
            renderCapacidadSeccionesChart(data.detalleSecciones);

            // Render detail table
            renderCapacidadDetalleTable(data.detalleSecciones);
        }
    } catch (err) {
        console.error('[CAPACIDAD] Error fetching data:', err);
    }
}

// Render info bar
function renderCapacidadInfoBar(config, kpis) {
    const diasLab = document.getElementById('capacidadDiasLaborables');
    const horasConv = document.getElementById('capacidadHorasConvenio');
    const plantillaTotal = document.getElementById('capacidadPlantillaTotal');

    if (diasLab) diasLab.textContent = new Intl.NumberFormat('es-ES').format(config.diasLaborables || 0);
    if (horasConv) horasConv.textContent = new Intl.NumberFormat('es-ES').format(config.horasConvenio || 0) + ' h';
    if (plantillaTotal) plantillaTotal.textContent = new Intl.NumberFormat('es-ES').format(kpis.totalPlantilla || 0);
}

// Render Capacidad KPIs
function renderCapacidadKPIs(kpis) {
    console.log('[CAPACIDAD] Rendering KPIs:', kpis);

    const formatHours = (value) => {
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value || 0) + ' h';
    };

    const formatPercent = (value) => {
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value || 0) + ' %';
    };

    // Capacidad Demostrada
    const kpiDemostrada = document.getElementById('capacidadKpiDemostrada');
    if (kpiDemostrada) kpiDemostrada.textContent = formatHours(kpis.capacidadDemostrada);

    // Capacidad Máxima
    const kpiMaxima = document.getElementById('capacidadKpiMaxima');
    if (kpiMaxima) kpiMaxima.textContent = formatHours(kpis.capacidadMaxima);

    // Capacidad Instalación
    const kpiInstalacion = document.getElementById('capacidadKpiInstalacion');
    if (kpiInstalacion) kpiInstalacion.textContent = formatHours(kpis.capacidadInstalacion);

    // OEE Promedio
    const kpiOee = document.getElementById('capacidadKpiOee');
    if (kpiOee) kpiOee.textContent = formatPercent(kpis.avgOee);

    // Absentismo
    const kpiAbsentismo = document.getElementById('capacidadKpiAbsentismo');
    if (kpiAbsentismo) kpiAbsentismo.textContent = formatPercent(kpis.avgAbsentismo);

    // Rechazo
    const kpiRechazo = document.getElementById('capacidadKpiRechazo');
    if (kpiRechazo) kpiRechazo.textContent = formatPercent(kpis.avgRechazo);

    // Utilización (Demostrada / Máxima)
    const utilizacion = kpis.capacidadMaxima > 0
        ? (kpis.capacidadDemostrada / kpis.capacidadMaxima) * 100
        : 0;
    const kpiUtilizacion = document.getElementById('capacidadKpiUtilizacion');
    if (kpiUtilizacion) kpiUtilizacion.textContent = formatPercent(utilizacion);
}

// Render Secciones Chart (grouped bar)
function renderCapacidadSeccionesChart(data) {
    console.log('[CAPACIDAD] Rendering secciones chart:', data);

    const ctx = document.getElementById('capacidadSeccionesChart');
    if (!ctx) return;

    // Destroy previous instance
    if (capacidadSeccionesChartInstance) {
        capacidadSeccionesChartInstance.destroy();
    }

    if (!data || data.length === 0) {
        ctx.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 350px; color: var(--text-muted);">Sin datos disponibles</div>';
        return;
    }

    const labels = data.map(d => d.seccionNombre || d.seccion);
    const capacidadDemostrada = data.map(d => d.capacidadDemostrada);
    const capacidadMaxima = data.map(d => d.capacidadMaxima);
    const capacidadInstalacion = data.map(d => d.capacidadInstalacion);

    capacidadSeccionesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cap. Demostrada',
                    data: capacidadDemostrada,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Cap. Máxima',
                    data: capacidadMaxima,
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'Cap. Instalación',
                    data: capacidadInstalacion,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ${new Intl.NumberFormat('es-ES').format(value)} h`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Horas'
                    },
                    ticks: {
                        callback: function (value) {
                            return new Intl.NumberFormat('es-ES', { notation: 'compact' }).format(value);
                        }
                    }
                }
            }
        }
    });
}

// Render detail table
function renderCapacidadDetalleTable(data) {
    console.log('[CAPACIDAD] Rendering detail table, records:', data?.length);

    const tbody = document.getElementById('capacidadTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-inbox-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    No hay datos de capacidad disponibles
                </td>
            </tr>
        `;
        return;
    }

    const formatNumber = (value) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
    const formatPercent = (value) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0) + '%';

    // Get color for percentage values
    const getPercentColor = (value, isNegative = false) => {
        if (isNegative) {
            if (value > 10) return 'color: #dc2626;'; // Red for high absentism/rejection
            if (value > 5) return 'color: #f59e0b;'; // Orange
            return 'color: #10b981;'; // Green for low values
        } else {
            if (value < 50) return 'color: #dc2626;'; // Red for low OEE
            if (value < 70) return 'color: #f59e0b;'; // Orange
            return 'color: #10b981;'; // Green for high OEE
        }
    };

    tbody.innerHTML = data.map((row, idx) => {
        const bgColor = idx % 2 === 0 ? '' : 'background: rgba(0,0,0,0.02);';
        return `
            <tr style="${bgColor}">
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                    <div style="font-weight: 600;">${row.seccionNombre || row.seccion}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${row.seccion}</div>
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: center; font-weight: 600;">
                    ${row.plantilla}
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: center; font-weight: 500; ${getPercentColor(row.oee)}">
                    ${formatPercent(row.oee)}
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: center; font-weight: 500; ${getPercentColor(row.absentismo, true)}">
                    ${formatPercent(row.absentismo)}
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: center; font-weight: 500; ${getPercentColor(row.rechazo, true)}">
                    ${formatPercent(row.rechazo)}
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: right; font-weight: 600; color: #10b981;">
                    ${formatNumber(row.capacidadDemostrada)} h
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: right; font-weight: 600; color: #f59e0b;">
                    ${formatNumber(row.capacidadMaxima)} h
                </td>
                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: right; font-weight: 600; color: #6366f1;">
                    ${formatNumber(row.capacidadInstalacion)} h
                </td>
            </tr>
        `;
    }).join('');

    // Add totals row
    const totals = {
        plantilla: data.reduce((sum, r) => sum + r.plantilla, 0),
        capacidadDemostrada: data.reduce((sum, r) => sum + r.capacidadDemostrada, 0),
        capacidadMaxima: data.reduce((sum, r) => sum + r.capacidadMaxima, 0),
        capacidadInstalacion: data.reduce((sum, r) => sum + r.capacidadInstalacion, 0)
    };

    tbody.innerHTML += `
        <tr style="background: var(--bg-secondary); font-weight: 700;">
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary);">TOTAL</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: center;">${totals.plantilla}</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: center;">-</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: center;">-</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: center;">-</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: right; color: #10b981;">${formatNumber(totals.capacidadDemostrada)} h</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: right; color: #f59e0b;">${formatNumber(totals.capacidadMaxima)} h</td>
            <td style="padding: 0.75rem; border-top: 2px solid var(--primary); text-align: right; color: #6366f1;">${formatNumber(totals.capacidadInstalacion)} h</td>
        </tr>
    `;
}

// Setup Capacidad event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Calculate button
    const buscarBtn = document.getElementById('buscarCapacidadBtn');
    if (buscarBtn) {
        buscarBtn.addEventListener('click', fetchCapacidadData);
    }

    // Save config button
    const guardarBtn = document.getElementById('guardarConfigCapacidadBtn');
    if (guardarBtn) {
        guardarBtn.addEventListener('click', guardarCapacidadConfiguracion);
    }

    // Year filter change - reload config and data
    const yearFilter = document.getElementById('capacidadYearFilter');
    if (yearFilter) {
        yearFilter.addEventListener('change', async () => {
            await loadCapacidadConfiguracion();
            await fetchCapacidadData();
        });
    }

    // Section filter change
    const seccionFilter = document.getElementById('capacidadSeccionFilter');
    if (seccionFilter) {
        seccionFilter.addEventListener('change', fetchCapacidadData);
    }
});


// ============================================
// COMERCIAL DASHBOARD LOGIC
// ============================================

let comercialVentasChartInstance = null;
let comercialAnualChartInstance = null;
let comercialState = {
    year: new Date().getFullYear(),
    tipos: [],
    familias: [],
    subfamilias: [],
    data: null
};

// Get checked values from checkbox container
function getComercialCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Populate checkbox container
function populateComercialCheckboxes(containerId, options, selectedValues, emptyMessage = 'Sin opciones') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!options || options.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted);">${emptyMessage}</span>`;
        return;
    }

    container.innerHTML = options.map(opt => {
        const codigo = opt.codigo || opt;
        const denominacion = opt.denominacion || '';
        const label = denominacion ? `${codigo} - ${denominacion}` : codigo;
        const checked = selectedValues.includes(codigo) ? 'checked' : '';
        return `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.2rem 0;">
                <input type="checkbox" value="${codigo}" ${checked} onchange="fetchComercialDashboard()" style="cursor: pointer;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${label}">${label}</span>
            </label>
        `;
    }).join('');
}

async function fetchComercialDashboard(year = null) {
    console.log('[COMERCIAL] fetchComercialDashboard called');

    const yearSelect = document.getElementById('comercialYearFilter');
    comercialState.year = year || yearSelect?.value || new Date().getFullYear();

    // Get selected filters from checkboxes
    comercialState.tipos = getComercialCheckedValues('comercialTipoContainer');
    comercialState.familias = getComercialCheckedValues('comercialFamiliaContainer');
    comercialState.subfamilias = getComercialCheckedValues('comercialSubfamiliaContainer');

    try {
        let url = `/api/comercial/dashboard?year=${comercialState.year}`;
        if (comercialState.tipos.length > 0) {
            url += `&tipos=${comercialState.tipos.join(',')}`;
        }
        if (comercialState.familias.length > 0) {
            url += `&familias=${comercialState.familias.join(',')}`;
        }
        if (comercialState.subfamilias.length > 0) {
            url += `&subfamilias=${comercialState.subfamilias.join(',')}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            comercialState.data = data;

            // Populate year filter if needed
            if (yearSelect && data.anosDisponibles) {
                const currentVal = yearSelect.value;
                yearSelect.innerHTML = '';
                data.anosDisponibles.forEach(y => {
                    const option = document.createElement('option');
                    option.value = y;
                    option.textContent = y;
                    if (String(y) === String(currentVal || comercialState.year)) option.selected = true;
                    yearSelect.appendChild(option);
                });
            }

            // Populate filter checkboxes (cascading)
            if (data.filtros) {
                populateComercialCheckboxes('comercialTipoContainer', data.filtros.tipos, comercialState.tipos);
                populateComercialCheckboxes('comercialFamiliaContainer', data.filtros.familias, comercialState.familias, 'Selecciona un Tipo');
                populateComercialCheckboxes('comercialSubfamiliaContainer', data.filtros.subfamilias, comercialState.subfamilias, 'Selecciona una Familia');
            }

            // Render all components
            renderComercialKPIs(data.kpis);
            initComercialVentasChart(data.ventasMensuales);
            initComercialAnualChart(data.totalesAnuales);
            renderTopClientesTable(data.topClientes);
            renderTopArticulosTable(data.topArticulos);
            renderTopTiposTable(data.topTipos);
            renderTopFamiliasTable(data.topFamilias);
            // Pass filtered types to chart init to decide on breakdown
            initComercialVentasChart(data.ventasMensuales, comercialState.tipos);
        } else {
            console.error('Error fetching comercial dashboard:', data.error);
        }
    } catch (error) {
        console.error('Error fetching comercial dashboard:', error);
    }
}

function renderComercialKPIs(kpis) {
    const formatEuro = (val) => {
        if (val >= 1000000) {
            return (val / 1000000).toFixed(2) + ' M EUR';
        } else if (val >= 1000) {
            return (val / 1000).toFixed(1) + ' K EUR';
        }
        return val.toFixed(2) + ' EUR';
    };

    const ventasEl = document.getElementById('comercialKpiVentas');
    if (ventasEl) ventasEl.textContent = formatEuro(kpis.ventasTotales || 0);

    const facturasEl = document.getElementById('comercialKpiFacturas');
    if (facturasEl) facturasEl.textContent = (kpis.numFacturas || 0).toLocaleString('es-ES');

    const clientesEl = document.getElementById('comercialKpiClientes');
    if (clientesEl) clientesEl.textContent = (kpis.numClientes || 0).toLocaleString('es-ES');

    const ticketEl = document.getElementById('comercialKpiTicket');
    if (ticketEl) ticketEl.textContent = formatEuro(kpis.ticketMedio || 0);
}

function initComercialVentasChart(ventasMensuales, selectedTypes) {
    const ctx = document.getElementById('comercialVentasMensualesChart');
    if (!ctx) return;

    if (comercialVentasChartInstance) comercialVentasChartInstance.destroy();

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Check if we should breakdown by Family (User requirement: Type is '02')
    // selectedTypes is an array of strings, e.g. ['02']
    const showBreakdown = selectedTypes && selectedTypes.includes('02');

    let datasets = [];

    if (showBreakdown) {
        // Group by 001, 002, 003, 004, Other
        const familiesOfInterest = ['001', '002', '003', '004'];
        const familyColors = {
            '001': 'rgba(255, 99, 132, 1)', // Red
            '002': 'rgba(54, 162, 235, 1)', // Blue
            '003': 'rgba(255, 206, 86, 1)', // Yellow
            '004': 'rgba(75, 192, 192, 1)', // Green
            'OTROS': 'rgba(153, 102, 255, 1)' // Purple
        };

        // Initialize data structure: { '001': [0,0...], '002': ... }
        const seriesData = {};
        [...familiesOfInterest, 'OTROS'].forEach(fam => {
            seriesData[fam] = new Array(12).fill(0);
        });

        // Total for the bar chart
        const totalData = new Array(12).fill(0);

        ventasMensuales.forEach(m => {
            const monthIdx = m.mes - 1; // 0-11
            if (monthIdx >= 0 && monthIdx < 12) {
                // Ensure family code is a clean string with 3 digits if numeric
                // The server now does LTRIM(RTRIM()), but let's be safe
                let fam = String(m.codigoFamilia || '').trim();

                // If fam is "1", pad it to "001" to match familiesOfInterest
                if (fam.length < 3 && !isNaN(fam)) {
                    fam = fam.padStart(3, '0');
                }

                if (!familiesOfInterest.includes(fam)) {
                    fam = 'OTROS';
                }
                const val = m.ventasEuro || 0;
                seriesData[fam][monthIdx] += val;
                totalData[monthIdx] += val;
            }
        });

        // 1. Bar dataset for Total
        datasets.push({
            type: 'bar',
            label: 'Total',
            data: totalData,
            backgroundColor: 'rgba(102, 126, 234, 0.4)', // lighter blue bar
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 1,
            borderRadius: 4,
            order: 2
        });

        // 2. Line datasets for Families
        familiesOfInterest.forEach(fam => {
            datasets.push({
                type: 'line',
                label: `Familia ${fam}`,
                data: seriesData[fam],
                borderColor: familyColors[fam], // Solid line color
                backgroundColor: familyColors[fam],
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.1, // Slight curve
                order: 1 // Draw lines on top of bars
            });
        });

        // Optional: Add "Resto" as a line too?
        // datasets.push({
        //     type: 'line',
        //     label: 'Resto Familias',
        //     data: seriesData['OTROS'],
        //     borderColor: familyColors['OTROS'],
        //     borderWidth: 2,
        //     pointRadius: 3,
        //     order: 1
        // });

    } else {
        // Standard view: Aggregate total per month
        const monthlyData = new Array(12).fill(0);
        ventasMensuales.forEach(m => {
            const monthIdx = m.mes - 1;
            if (monthIdx >= 0 && monthIdx < 12) {
                monthlyData[monthIdx] += (m.ventasEuro || 0);
            }
        });

        datasets = [{
            type: 'bar',
            label: 'Ventas Totales (EUR)',
            data: monthlyData,
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: 50
        }];
    }

    comercialVentasChartInstance = new Chart(ctx, {
        data: {
            labels: meses,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    stacked: false // Don't stack the combo chart
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: showBreakdown, // Show legend only if broken down
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.raw || 0;
                            return (context.dataset.label || '') + ': ' + val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                        }
                    }
                }
            }
        }
    });
}


function renderTopTiposTable(topTipos) {
    const tbody = document.getElementById('comercialTopTiposBody');
    if (!tbody) return;

    if (!topTipos || topTipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topTipos.map((t, idx) => {
        const cod = t.codigo || '-';
        const den = t.denominacion || '-';
        const denTrunc = den.length > 25 ? den.substring(0, 25) + '...' : den;
        const ventas = (t.ventasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem;">${cod}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${den}">${denTrunc}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${ventas}</td>
            </tr>
        `;
    }).join('');
}

function renderTopFamiliasTable(topFamilias) {
    const tbody = document.getElementById('comercialTopFamiliasBody');
    if (!tbody) return;

    if (!topFamilias || topFamilias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topFamilias.map((f, idx) => {
        const cod = f.codigo || '-';
        const den = f.denominacion || '-';
        const denTrunc = den.length > 25 ? den.substring(0, 25) + '...' : den;
        const ventas = (f.ventasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem;">${cod}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${den}">${denTrunc}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${ventas}</td>
            </tr>
        `;
    }).join('');
}

function initComercialAnualChart(totalesAnuales) {
    const ctx = document.getElementById('comercialEvolucionAnualChart');
    if (!ctx) return;

    if (comercialAnualChartInstance) comercialAnualChartInstance.destroy();

    if (!totalesAnuales || totalesAnuales.length === 0) return;

    // Take last 5 years and reverse for chronological order
    const datos = totalesAnuales.slice(0, 5).reverse();
    const labels = datos.map(d => d.anio);
    const values = datos.map(d => d.ventasTotales || 0);

    comercialAnualChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas Totales (EUR)',
                data: values,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.6)',
                    'rgba(118, 75, 162, 0.6)',
                    'rgba(240, 147, 251, 0.6)',
                    'rgba(79, 172, 254, 0.6)',
                    'rgba(67, 233, 123, 0.6)'
                ],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(118, 75, 162, 1)',
                    'rgba(240, 147, 251, 1)',
                    'rgba(79, 172, 254, 1)',
                    'rgba(67, 233, 123, 1)'
                ],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(0) + 'K';
                            }
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.raw || 0;
                            return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// OEE DASHBOARD LOGIC
// ============================================

let oeeTrendChartInstance = null;
let oeeBreakdownChartInstance = null;

async function fetchOEEDashboard() {
    try {
        const year = document.getElementById('oeeYearFilter')?.value || new Date().getFullYear();
        const month = document.getElementById('oeeMonthFilter')?.value || '';
        const seccion = document.getElementById('oeeSeccionFilter')?.value || '';
        const familia = document.getElementById('oeeFamiliaFilter')?.value || '';

        console.log('[OEE] Fetching dashboard...', { year, month, seccion, familia });

        const response = await fetch(`/api/produccion/oee?year=${year}&month=${month}&seccion=${seccion}&familia=${familia}`);
        const data = await response.json();

        console.log('[OEE] API Response:', data.success ? 'Success' : 'Error', 'Operations:', data.operations?.length || 0);

        if (data.success) {
            renderOEEKPIs(data.kpis);
            initOEECharts(data.trend, data.kpis);
            renderOEEOperationsTable(data.operations);

            // Populate year filter if available
            const yearSelect = document.getElementById('oeeYearFilter');
            if (yearSelect && data.filters?.years && data.filters.years.length > 0) {
                const currentVal = yearSelect.value;
                yearSelect.innerHTML = data.filters.years.map(y =>
                    `<option value="${y}" ${String(y) === String(currentVal) ? 'selected' : ''}>${y}</option>`
                ).join('');
            }

            // Populate section filter - preserve current selection using data attributes
            const seccionSelect = document.getElementById('oeeSeccionFilter');
            if (seccionSelect && data.filters?.secciones) {
                // Store current value before repopulating
                const currentVal = seccion || seccionSelect.value;
                let options = '<option value="">Todas las Secciones</option>';
                data.filters.secciones.forEach(s => {
                    const selected = s.codigo === currentVal ? 'selected' : '';
                    const label = s.denominacion ? `${s.codigo} - ${s.denominacion}` : s.codigo;
                    options += `<option value="${s.codigo}" ${selected}>${label}</option>`;
                });
                seccionSelect.innerHTML = options;
                // Restore the value explicitly
                if (currentVal) seccionSelect.value = currentVal;
            }

            // Populate familia filter - preserve current selection
            const familiaSelect = document.getElementById('oeeFamiliaFilter');
            if (familiaSelect && data.filters?.familias) {
                // Store current value before repopulating
                const currentVal = familia || familiaSelect.value;
                let options = '<option value="">Todas las Familias</option>';
                data.filters.familias.forEach(f => {
                    const selected = f.codigo === currentVal ? 'selected' : '';
                    const label = f.denominacion ? `${f.codigo} - ${f.denominacion}` : f.codigo;
                    options += `<option value="${f.codigo}" ${selected}>${label}</option>`;
                });
                familiaSelect.innerHTML = options;
                // Restore the value explicitly
                if (currentVal) familiaSelect.value = currentVal;
            }
        } else {
            console.error('Error fetching OEE data:', data.error, data.details);
        }

    } catch (error) {
        console.error('Error fetching OEE dashboard:', error);
    }
}



function renderOEEKPIs(kpis) {
    if (!kpis) return;

    // Main KPIs
    const oeeGlobal = document.getElementById('kpiOeeGlobal');
    if (oeeGlobal) oeeGlobal.textContent = (kpis.oee || 0).toFixed(1) + '%';

    const availability = document.getElementById('kpiAvailability');
    if (availability) availability.textContent = (kpis.oeed || 0).toFixed(1) + '%';

    const performance = document.getElementById('kpiPerformance');
    if (performance) performance.textContent = (kpis.oeer || 0).toFixed(1) + '%';

    const quality = document.getElementById('kpiQuality');
    if (quality) quality.textContent = (kpis.oeeq || 0).toFixed(1) + '%';

    // Secondary KPIs
    const piezasOk = document.getElementById('kpiPiezasOk');
    if (piezasOk) piezasOk.textContent = (kpis.totalPiezasOk || 0).toLocaleString('es-ES');

    const piezasRc = document.getElementById('kpiPiezasRc');
    if (piezasRc) piezasRc.textContent = (kpis.totalPiezasRc || 0).toLocaleString('es-ES');

    const horasTeoricas = document.getElementById('kpiHorasTeoricas');
    if (horasTeoricas) horasTeoricas.textContent = (kpis.totalHorasTeoricas || 0).toFixed(1) + 'h';

    const horasDisponibles = document.getElementById('kpiHorasDisponibles');
    if (horasDisponibles) horasDisponibles.textContent = (kpis.totalHorasDisponibles || 0).toFixed(1) + 'h';

    const horasPlanificadas = document.getElementById('kpiHorasPlanificadas');
    if (horasPlanificadas) horasPlanificadas.textContent = (kpis.totalHorasPlanificadas || 0).toFixed(1) + 'h';
}

function initOEECharts(trendData, breakdownData) {
    // 1. OEE Trend Line Chart
    const ctxTrend = document.getElementById('oeeTrendChart');
    if (ctxTrend) {
        if (oeeTrendChartInstance) oeeTrendChartInstance.destroy();

        const labels = trendData && trendData.length > 0 ? trendData.map(d => d.monthName) : ['Sin datos'];
        const oeeValues = trendData && trendData.length > 0 ? trendData.map(d => d.oee) : [0];
        const oeedValues = trendData && trendData.length > 0 ? trendData.map(d => d.oeed) : [0];
        const oeerValues = trendData && trendData.length > 0 ? trendData.map(d => d.oeer) : [0];
        const oeeqValues = trendData && trendData.length > 0 ? trendData.map(d => d.oeeq) : [0];

        oeeTrendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'OEE %',
                        data: oeeValues,
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'OEED %',
                        data: oeedValues,
                        borderColor: 'rgba(72, 187, 120, 0.8)',
                        borderWidth: 1,
                        fill: false,
                        tension: 0.4,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'OEER %',
                        data: oeerValues,
                        borderColor: 'rgba(237, 137, 54, 0.8)',
                        borderWidth: 1,
                        fill: false,
                        tension: 0.4,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'OEEQ %',
                        data: oeeqValues,
                        borderColor: 'rgba(245, 101, 101, 0.8)',
                        borderWidth: 1,
                        fill: false,
                        tension: 0.4,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 150  // Increased to 150 to accommodate values over 100%
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // 2. Breakdown Bar Chart
    const ctxBreakdown = document.getElementById('oeeBreakdownChart');
    if (ctxBreakdown) {
        if (oeeBreakdownChartInstance) oeeBreakdownChartInstance.destroy();

        oeeBreakdownChartInstance = new Chart(ctxBreakdown, {
            type: 'bar',
            data: {
                labels: ['Disponibilidad (OEED)', 'Rendimiento (OEER)', 'Calidad (OEEQ)'],
                datasets: [{
                    label: 'Factor %',
                    data: [
                        breakdownData?.oeed || 0,
                        breakdownData?.oeer || 0,
                        breakdownData?.oeeq || 0
                    ],
                    backgroundColor: [
                        'rgba(72, 187, 120, 0.7)', // Green
                        'rgba(237, 137, 54, 0.7)', // Orange
                        'rgba(245, 101, 101, 0.7)' // Red
                    ],
                    borderRadius: 4,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 120
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}


function renderOEEOperationsTable(operations) {
    console.log('[OEE] renderOEEOperationsTable called with', operations?.length || 0, 'operations');
    const tbody = document.getElementById('oeeOperationsTableBody');
    console.log('[OEE] tbody element found:', tbody ? 'YES' : 'NO');
    if (!tbody) {
        console.error('[OEE] ERROR: oeeOperationsTableBody element not found!');
        return;
    }

    if (!operations || operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:1rem;">Sin datos para los filtros seleccionados</td></tr>';
        return;
    }

    tbody.innerHTML = operations.map(op => {
        const oeeClass = op.oee >= 85 ? 'text-success' : (op.oee >= 65 ? 'text-warning' : 'text-danger');
        const oeedClass = op.oeed >= 90 ? 'text-success' : (op.oeed >= 75 ? 'text-warning' : 'text-danger');
        const oeerClass = op.oeer >= 95 ? 'text-success' : (op.oeer >= 80 ? 'text-warning' : 'text-danger');
        const oeeqClass = op.oeeq >= 99 ? 'text-success' : (op.oeeq >= 95 ? 'text-warning' : 'text-danger');

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.75rem 0.5rem; font-weight: 500; white-space: nowrap; width: 60px;">${op.codigoOperacion}</td>
                <td style="padding: 0.75rem 1rem; width: 450px; max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${op.descripcion}">${op.descripcion || '-'}</td>
                <td style="padding: 0.75rem 1rem; text-align: right; border-left: 2px solid rgba(67, 233, 123, 0.3); white-space: nowrap; width: 100px;">${(op.piezasOk || 0).toLocaleString('es-ES')}</td>
                <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap; width: 100px;">${(op.piezasRc || 0).toLocaleString('es-ES')}</td>
                <td style="padding: 0.75rem 1rem; text-align: right; border-left: 2px solid rgba(251, 191, 36, 0.3); white-space: nowrap; width: 110px;">${(op.horasTeoricas || 0).toFixed(1)}</td>
                <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap; width: 90px;">${(op.horasDisponibles || 0).toFixed(1)}</td>
                <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap; width: 90px;">${(op.horasPlanificadas || 0).toFixed(1)}</td>
                <td class="${oeedClass}" style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; border-left: 2px solid rgba(139, 92, 246, 0.3); white-space: nowrap; width: 90px;">${(op.oeed || 0).toFixed(1)}%</td>
                <td class="${oeerClass}" style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; white-space: nowrap; width: 90px;">${(op.oeer || 0).toFixed(1)}%</td>
                <td class="${oeeqClass}" style="padding: 0.75rem 1rem; text-align: center; font-weight: 500; white-space: nowrap; width: 90px;">${(op.oeeq || 0).toFixed(1)}%</td>
                <td class="${oeeClass}" style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; white-space: nowrap; width: 90px;">${(op.oee || 0).toFixed(1)}%</td>
            </tr>
        `;
    }).join('');

    console.log('[OEE] Table rendered with', operations.length, 'rows');

    // Check if the view is visible
    const oeeView = document.getElementById('oeeView');
    console.log('[OEE] oeeView element:', oeeView ? 'Found' : 'Not found');
    console.log('[OEE] oeeView has active class:', oeeView?.classList.contains('active'));
    console.log('[OEE] oeeView display style:', oeeView?.style.display);
    console.log('[OEE] oeeView computed display:', window.getComputedStyle(oeeView).display);
}

// Event Listeners for OEE Filters
document.addEventListener('DOMContentLoaded', () => {
    ['oeeYearFilter', 'oeeMonthFilter', 'oeeSeccionFilter', 'oeeFamiliaFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => fetchOEEDashboard());
        }
    });
});

// Clear all comercial filters
function clearComercialFilters() {
    // Clear all checkboxes in containers
    const containers = ['comercialTipoContainer', 'comercialFamiliaContainer', 'comercialSubfamiliaContainer'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
        }
    });

    // Reset state
    comercialState.tipos = [];
    comercialState.familias = [];
    comercialState.subfamilias = [];

    // Refresh data
    fetchComercialDashboard();
}

// Event listeners for Comercial Dashboard
document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('comercialYearFilter');
    if (yearFilter) {
        yearFilter.addEventListener('change', () => {
            fetchComercialDashboard(yearFilter.value);
        });
    }
});

function renderTopClientesTable(topClientes) {
    const tbody = document.getElementById('comercialTopClientesBody');
    if (!tbody) return;

    if (!topClientes || topClientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topClientes.map((c, idx) => {
        const nombre = c.nombreCliente || c.cliente || '-';
        const nombreTruncado = nombre.length > 25 ? nombre.substring(0, 25) + '...' : nombre;
        const ventasFormatted = (c.ventasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${nombre}">${nombreTruncado}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${ventasFormatted}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; color: var(--text-muted);">${c.numFacturas || 0}</td>
            </tr>
        `;
    }).join('');
}

function renderTopArticulosTable(topArticulos) {
    const tbody = document.getElementById('comercialTopArticulosBody');
    if (!tbody) return;

    if (!topArticulos || topArticulos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topArticulos.map((a, idx) => {
        const articulo = a.articulo || '-';
        const cliente = a.cliente || '-';
        const clienteTruncado = cliente.length > 20 ? cliente.substring(0, 20) + '...' : cliente;
        const ventasFormatted = (a.ventasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem; font-weight: 500;">${articulo}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${cliente}">${clienteTruncado}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${ventasFormatted}</td>
            </tr>
        `;
    }).join('');
}

// Event listeners for Comercial Dashboard
document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('comercialYearFilter');
    if (yearFilter) {
        yearFilter.addEventListener('change', () => {
            fetchComercialDashboard(yearFilter.value);
        });
    }

    // Click on COMERCIAL header loads the dashboard
    const comercialHeader = document.getElementById('comercialHeader');
    if (comercialHeader) {
        comercialHeader.addEventListener('click', () => {
            // Wait a bit for the view to be shown
            setTimeout(() => {
                if (!comercialState.data) {
                    fetchComercialDashboard();
                }
            }, 100);
        });
    }
});

// Immediate attachment
if (document.getElementById('comercialYearFilter')) {
    document.getElementById('comercialYearFilter').addEventListener('change', function () {
        fetchComercialDashboard(this.value);
    });
}

// Immediate attachment for comercialHeader
if (document.getElementById('comercialHeader')) {
    document.getElementById('comercialHeader').addEventListener('click', function () {
        setTimeout(() => {
            if (!comercialState.data) {
                fetchComercialDashboard();
            }
        }, 100);
    });
}

// ============================================
// COMPRAS DASHBOARD LOGIC
// ============================================
// Note: comprasState is declared at the top of the file

// Colors for families (Dynamic but consistent based on family name)
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

async function fetchComprasDashboard(year = null) {
    console.log('[COMPRAS] fetchComprasDashboard called');

    const yearSelect = document.getElementById('comprasYearFilter');
    comprasState.year = year || yearSelect?.value || new Date().getFullYear();

    // Get selected filters from checkboxes
    comprasState.tipos = getComprasCheckedValues('comprasTipoContainer');
    comprasState.familias = getComprasCheckedValues('comprasFamiliaContainer');
    comprasState.subfamilias = getComprasCheckedValues('comprasSubfamiliaContainer');

    try {
        let url = `/api/compras/dashboard?year=${comprasState.year}`;
        if (comprasState.tipos.length > 0) {
            url += `&tipos=${comprasState.tipos.join(',')}`;
        }
        if (comprasState.familias.length > 0) {
            url += `&familias=${comprasState.familias.join(',')}`;
        }
        if (comprasState.subfamilias.length > 0) {
            url += `&subfamilias=${comprasState.subfamilias.join(',')}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            comprasState.data = data;

            // Populate year filter if needed
            if (yearSelect && data.anosDisponibles) {
                const currentVal = yearSelect.value;
                yearSelect.innerHTML = '';
                data.anosDisponibles.forEach(y => {
                    const option = document.createElement('option');
                    option.value = y;
                    option.textContent = y;
                    if (String(y) === String(currentVal || comprasState.year)) option.selected = true;
                    yearSelect.appendChild(option);
                });
            }

            // Populate filter checkboxes (cascading)
            if (data.filtros) {
                populateComprasCheckboxes('comprasTipoContainer', data.filtros.tipos, comprasState.tipos);
                populateComprasCheckboxes('comprasFamiliaContainer', data.filtros.familias, comprasState.familias, 'Selecciona un Tipo');
                populateComprasCheckboxes('comprasSubfamiliaContainer', data.filtros.subfamilias, comprasState.subfamilias, 'Selecciona una Familia');
            }

            // Render all components
            renderComprasKPIs(data.kpis);
            initComprasMensualesChart(data.comprasMensuales);
            initComprasAnualChart(data.totalesAnuales);
            renderTopProveedoresTable(data.topProveedores);
            renderComprasTopArticulosTable(data.topArticulos);
            renderComprasTopTiposTable(data.topTipos);
            renderComprasTopFamiliasTable(data.topFamilias);
        } else {
            console.error('Error fetching compras dashboard:', data.error);
        }
    } catch (error) {
        console.error('Error fetching compras dashboard:', error);
    }
}

// Get checked values from checkbox container
function getComprasCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Populate checkbox container
function populateComprasCheckboxes(containerId, options, selectedValues, emptyMessage = 'Sin opciones') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!options || options.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted);">${emptyMessage}</span>`;
        return;
    }

    container.innerHTML = options.map(opt => {
        const codigo = opt.codigo || opt;
        const denominacion = opt.denominacion || '';
        const label = denominacion ? `${codigo} - ${denominacion}` : codigo;
        const checked = selectedValues.includes(codigo) ? 'checked' : '';
        return `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.2rem 0;">
                <input type="checkbox" value="${codigo}" ${checked} onchange="fetchComprasDashboard()" style="cursor: pointer;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${label}">${label}</span>
            </label>
        `;
    }).join('');
}

function renderComprasKPIs(kpis) {
    const formatEuro = (val) => {
        if (val >= 1000000) {
            return (val / 1000000).toFixed(2) + ' M EUR';
        } else if (val >= 1000) {
            return (val / 1000).toFixed(1) + ' K EUR';
        }
        return val.toFixed(2) + ' EUR';
    };

    const kpiTotal = document.getElementById('comprasKpiTotal');
    const kpiFacturas = document.getElementById('comprasKpiFacturas');
    const kpiProveedores = document.getElementById('comprasKpiProveedores');
    const kpiTicket = document.getElementById('comprasKpiTicket');

    if (kpiTotal) kpiTotal.textContent = formatEuro(kpis.comprasTotales || 0);
    if (kpiFacturas) kpiFacturas.textContent = (kpis.numFacturas || 0).toLocaleString();
    if (kpiProveedores) kpiProveedores.textContent = (kpis.numProveedores || 0).toLocaleString();
    if (kpiTicket) kpiTicket.textContent = formatEuro(kpis.ticketMedio || 0);
}

function initComprasMensualesChart(dataInfo) {
    const ctx = document.getElementById('comprasMensualesChart');
    if (!ctx) return;

    if (comprasMensualesChartInstance) comprasMensualesChartInstance.destroy();

    if (!dataInfo || dataInfo.length === 0) return;

    // Process data for stacked bars: grouping by Month and Family
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const families = [...new Set(dataInfo.map(d => d.familia))];

    // Colors for families (Dynamic but consistent based on family name)
    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    const datasets = families.map((fam) => {
        return {
            label: fam,
            data: months.map((m, mIdx) => {
                const monthNum = mIdx + 1;
                // Find entry for this month and family
                const entry = dataInfo.find(d => d.mes === monthNum && d.familia === fam);
                return entry ? entry.comprasEuro : 0;
            }),
            backgroundColor: stringToColor(fam),
            borderWidth: 1
        };
    });

    comprasMensualesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.substring(0, 3)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                            else if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.raw || 0;
                            return `${context.dataset.label}: ${val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`;
                        }
                    }
                }
            }
        }
    });
}

function initComprasAnualChart(totalesAnuales) {
    const ctx = document.getElementById('comprasAnualChart');
    if (!ctx) return;

    if (comprasAnualChartInstance) comprasAnualChartInstance.destroy();

    if (!totalesAnuales || totalesAnuales.length === 0) return;

    const datos = totalesAnuales.slice(0, 5).reverse();
    const labels = datos.map(d => d.anio);
    const values = datos.map(d => d.comprasTotales || 0);

    comprasAnualChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Compras Totales (EUR)',
                data: values,
                backgroundColor: [
                    'rgba(240, 147, 251, 0.6)',
                    'rgba(245, 87, 108, 0.6)',
                    'rgba(102, 126, 234, 0.6)',
                    'rgba(79, 172, 254, 0.6)',
                    'rgba(67, 233, 123, 0.6)'
                ],
                borderColor: [
                    'rgba(240, 147, 251, 1)',
                    'rgba(245, 87, 108, 1)',
                    'rgba(102, 126, 234, 1)',
                    'rgba(79, 172, 254, 1)',
                    'rgba(67, 233, 123, 1)'
                ],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                            else if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const val = context.raw || 0;
                            return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                        }
                    }
                }
            }
        }
    });
}

function renderTopProveedoresTable(topProveedores) {
    const tbody = document.getElementById('comprasTopProveedoresBody');
    if (!tbody) return;

    if (!topProveedores || topProveedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topProveedores.map((p, idx) => {
        const codigo = p.codigoProveedor || '-';
        const nombre = p.nombreProveedor || 'Sin Nombre';
        const comprasFormatted = (p.comprasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border); font-size: 0.7rem;">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem;">${codigo}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${nombre}">${nombre}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${comprasFormatted}</td>
            </tr>
        `;
    }).join('');
}

function renderComprasTopArticulosTable(topArticulos) {
    const tbody = document.getElementById('comprasTopArticulosBody');
    if (!tbody) return;

    if (!topArticulos || topArticulos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = topArticulos.map((a, idx) => {
        const articulo = a.articulo || '-';
        const denominacion = a.denominacion || 'Sin Denominacion';
        const denominacionTruncada = denominacion.length > 30 ? denominacion.substring(0, 30) + '...' : denominacion;
        const comprasFormatted = (a.comprasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border); font-size: 0.7rem;">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary); width: 30px;">${idx + 1}</td>
                <td style="padding: 0.3rem 0.25rem; font-weight: 600;">${articulo}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${denominacion}">${denominacionTruncada}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: 500;">${comprasFormatted}</td>
            </tr>
        `;
    }).join('');
}

function renderComprasTopTiposTable(data) {
    console.log('[DEBUG] Rendering Top Tipos:', data);
    const tbody = document.getElementById('comprasTopTiposBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const codigo = item.codigo || '-';
        const denominacion = item.denominacion || 'Sin Denominacion';
        const trunc = denominacion.length > 30 ? denominacion.substring(0, 30) + '...' : denominacion;
        const total = (item.comprasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border); font-size: 0.7rem;">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${index + 1}</td>
                <td style="padding: 0.3rem 0.25rem;">${codigo}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${denominacion}">${trunc}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: bold;">${total}</td>
            </tr>
        `;
    }).join('');
}

function renderComprasTopFamiliasTable(data) {
    console.log('[DEBUG] Rendering Top Familias:', data);
    const tbody = document.getElementById('comprasTopFamiliasBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const codigo = item.codigo || '-';
        const denominacion = item.denominacion || 'Sin Denominacion';
        const trunc = denominacion.length > 30 ? denominacion.substring(0, 30) + '...' : denominacion;
        const total = (item.comprasEuro || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return `
            <tr style="border-bottom: 1px solid var(--border); font-size: 0.7rem;">
                <td style="padding: 0.3rem 0.25rem; text-align: center; font-weight: 600; color: var(--primary);">${index + 1}</td>
                <td style="padding: 0.3rem 0.25rem;">${codigo}</td>
                <td style="padding: 0.3rem 0.25rem;" title="${denominacion}">${trunc}</td>
                <td style="padding: 0.3rem 0.25rem; text-align: right; font-weight: bold;">${total}</td>
            </tr>
        `;
    }).join('');
}

// Event listeners for Compras Dashboard
document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('comprasYearFilter');
    if (yearFilter) {
        yearFilter.addEventListener('change', () => {
            fetchComprasDashboard(yearFilter.value);
        });
    }
});

// Clear all compras filters
function clearComprasFilters() {
    // Clear all checkboxes in containers
    const containers = ['comprasTipoContainer', 'comprasFamiliaContainer', 'comprasSubfamiliaContainer'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
        }
    });

    // Reset state
    comprasState.tipos = [];
    comprasState.familias = [];
    comprasState.subfamilias = [];

    // Refresh data
    fetchComprasDashboard();
}

// =====================================================
// ESPECIFICACIONES SECTION
// =====================================================

let especificacionesState = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    total: 0
};

async function fetchEspecificaciones() {
    try {
        const nec = document.getElementById('especificacionesNecFilter')?.value || '';
        const estado = document.getElementById('especificacionesEstadoFilter')?.value || '';
        const ambito = document.getElementById('especificacionesAmbitoFilter')?.value || '';
        const tipo = document.getElementById('especificacionesTipoFilter')?.value || '';

        const params = new URLSearchParams({
            page: especificacionesState.page,
            pageSize: especificacionesState.pageSize
        });

        if (nec) params.append('nec', nec);
        if (estado !== '') params.append('estado', estado);
        if (ambito) params.append('ambito', ambito);
        if (tipo) params.append('tipo', tipo);

        const response = await fetch(`http://localhost:3001/api/especificaciones?${params}`);
        const data = await response.json();

        if (data.success) {
            renderEspecificacionesTable(data.data);
            especificacionesState.total = data.total;
            especificacionesState.totalPages = data.totalPages;
            updateEspecificacionesPagination();
            populateEspecificacionesFilters(data.filtros);

            // Show info bar
            const infoDiv = document.getElementById('especificacionesInfo');
            const countSpan = document.getElementById('especificacionesResultCount');
            if (infoDiv) infoDiv.style.display = 'flex';
            if (countSpan) countSpan.textContent = `${data.total} registros encontrados`;
        } else {
            console.error('Error fetching especificaciones:', data.error);
        }
    } catch (error) {
        console.error('Error fetching especificaciones:', error);
        document.getElementById('especificacionesTableBody').innerHTML = `
            <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
                Error al cargar datos
            </td></tr>
        `;
    }
}

function renderEspecificacionesTable(data) {
    const tbody = document.getElementById('especificacionesTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                No se encontraron especificaciones
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(item => {
        const fecha = item.Fecha ? new Date(item.Fecha).toLocaleDateString('es-ES') : '-';
        const estadoText = item.Estado === -1 ? 'Si' : 'No';
        const estadoColor = item.Estado === -1 ? 'var(--success)' : 'var(--danger)';

        return `
            <tr style="border-bottom: 1px solid var(--border);" data-id="${item.IdEspecificacion}">
                <td style="padding: 0.75rem;">${item.NEC || '-'}</td>
                <td style="padding: 0.75rem; text-align: center;">${(item.Revision !== null && item.Revision !== undefined) ? item.Revision : '-'}</td>
                <td style="padding: 0.75rem; max-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.Nombre || '-'}">${item.Nombre || '-'}</td>
                <td style="padding: 0.75rem; text-align: center;">${fecha}</td>
                <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${estadoColor}; font-weight: 600;">${estadoText}</span>
                </td>
                <td style="padding: 0.75rem;">${item.tipoDescripcion || item.tipoCodigo || '-'}</td>
                <td style="padding: 0.75rem;">${item.ambitoDescripcion || item.ambitoCodigo || '-'}</td>
            </tr>
        `;
    }).join('');

    // Setup sorting if not already setup
    const tableHeader = document.querySelector('#especificacionesTable thead');
    if (tableHeader && !tableHeader.dataset.sortInitialized) {
        tableHeader.dataset.sortInitialized = 'true';
        tableHeader.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortKey = th.dataset.sort;
                let direction = th.dataset.sortDirection === 'asc' ? 'desc' : 'asc';

                // Reset other headers
                tableHeader.querySelectorAll('th').forEach(header => {
                    header.dataset.sortDirection = '';
                    header.innerText = header.innerText.replace(' ▲', '').replace(' ▼', '').replace(' ↕', '') + ' ↕';
                });

                // Update current header
                th.dataset.sortDirection = direction;
                th.innerText = th.innerText.slice(0, -2) + (direction === 'asc' ? ' ▲' : ' ▼');

                // Sort data
                especificacionesData.sort((a, b) => {
                    let valA = a[sortKey];
                    let valB = b[sortKey];

                    // Handle potential nulls
                    if (valA == null) valA = '';
                    if (valB == null) valB = '';

                    // Special handling for numeric/date if needed, but string comparison often works for simple displays
                    // For dates like 'DD/MM/YYYY' simple string sort fails, but let's see if we can parse or use raw if available.
                    // The API returns 'Fecha' likely as ISO or date object. The render converts it. 
                    // Ideally we sort by the raw value. assuming 'item.Fecha' is the raw string from SQL.

                    if (valA < valB) return direction === 'asc' ? -1 : 1;
                    if (valA > valB) return direction === 'asc' ? 1 : -1;
                    return 0;
                });

                renderEspecificacionesTable(especificacionesData);
            });
        });
    }
}

function populateEspecificacionesFilters(filtros) {
    if (!filtros) return;

    // Populate mbitos
    const ambitoSelect = document.getElementById('especificacionesAmbitoFilter');
    if (ambitoSelect && filtros.ambitos) {
        const currentValue = ambitoSelect.value;
        ambitoSelect.innerHTML = '<option value="">Todos</option>' +
            filtros.ambitos.map(a => `<option value="${a.codigo}">${a.descripcion || a.codigo}</option>`).join('');
        ambitoSelect.value = currentValue;
    }

    // Populate Tipos
    const tipoSelect = document.getElementById('especificacionesTipoFilter');
    if (tipoSelect && filtros.tipos) {
        const currentValue = tipoSelect.value;
        tipoSelect.innerHTML = '<option value="">Todos</option>' +
            filtros.tipos.map(t => `<option value="${t.codigo}">${t.descripcion || t.codigo}</option>`).join('');
        tipoSelect.value = currentValue;
    }
}

function updateEspecificacionesPagination() {
    const paginationBar = document.getElementById('especificacionesPaginationBar');
    const info = document.getElementById('especificacionesPaginationInfoTop');
    const prevBtn = document.getElementById('especificacionesPrevPageTop');
    const nextBtn = document.getElementById('especificacionesNextPageTop');

    // Show/hide pagination bar
    if (paginationBar) {
        paginationBar.style.display = especificacionesState.total > 0 ? 'flex' : 'none';
    }

    if (info) {
        const start = (especificacionesState.page - 1) * especificacionesState.pageSize + 1;
        const end = Math.min(especificacionesState.page * especificacionesState.pageSize, especificacionesState.total);
        info.textContent = especificacionesState.total === 0
            ? 'No hay registros'
            : `Mostrando ${start}-${end} de ${especificacionesState.total} registros`;
    }

    if (prevBtn) {
        prevBtn.disabled = especificacionesState.page <= 1;
        prevBtn.style.opacity = especificacionesState.page <= 1 ? '0.5' : '1';
    }

    if (nextBtn) {
        nextBtn.disabled = especificacionesState.page >= especificacionesState.totalPages;
        nextBtn.style.opacity = especificacionesState.page >= especificacionesState.totalPages ? '0.5' : '1';
    }
}

// Event listeners for Especificaciones
document.addEventListener('DOMContentLoaded', () => {
    // Search button
    document.getElementById('especificacionesBuscarBtn')?.addEventListener('click', () => {
        especificacionesState.page = 1;
        fetchEspecificaciones();
    });

    // Clear button
    document.getElementById('especificacionesLimpiarBtn')?.addEventListener('click', () => {
        document.getElementById('especificacionesNecFilter').value = '';
        document.getElementById('especificacionesEstadoFilter').value = '';
        document.getElementById('especificacionesAmbitoFilter').value = '';
        document.getElementById('especificacionesTipoFilter').value = '';
        especificacionesState.page = 1;
        fetchEspecificaciones();
    });

    // Pagination
    document.getElementById('especificacionesPrevPageTop')?.addEventListener('click', () => {
        if (especificacionesState.page > 1) {
            especificacionesState.page--;
            fetchEspecificaciones();
        }
    });

    document.getElementById('especificacionesNextPageTop')?.addEventListener('click', () => {
        if (especificacionesState.page < especificacionesState.totalPages) {
            especificacionesState.page++;
            fetchEspecificaciones();
        }
    });

    // Enter key on NEC input
    document.getElementById('especificacionesNecFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            especificacionesState.page = 1;
            fetchEspecificaciones();
        }
    });
});


// ==========================================
// LOGIN FUNCTIONALITY
// ==========================================

async function loadUsers() {
    console.log('[LOGIN] Loading users...');
    try {
        const response = await fetch('/api/users');
        const result = await response.json();
        console.log('[LOGIN] Users response:', result);

        const userSelect = document.getElementById('userSelect');
        if (!userSelect) {
            console.error('[LOGIN] #userSelect not found!');
            return;
        }

        userSelect.innerHTML = '<option value="">Seleccionar usuario...</option>';

        if (result.success && result.data) {
            result.data.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.nombre_completo;
                userSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('[LOGIN] Error loading users:', error);
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">Error cargando usuarios</option>';
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const userSelect = document.getElementById('userSelect');
    const passwordInput = document.getElementById('passwordInput');

    if (!userSelect.value || !passwordInput.value) {
        alert('Por favor complete todos los campos');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userSelect.value,
                password: passwordInput.value
            })
        });

        const result = await response.json();

        if (result.success) {
            // Save user data to localStorage and appData
            const userData = {
                id: result.user.id,
                username: result.user.username,
                nombre_completo: result.user.nombre_completo,
                iniciales: result.user.iniciales,
                rol: result.user.rol || 'operario'
            };

            localStorage.setItem('eipc_user', JSON.stringify(userData));
            appData.currentUser = userData;

            // Hide overlay
            document.getElementById('loginOverlay').style.display = 'none';

            // Initialize app data
            initializeApp();

            // Update user info
            document.getElementById('userName').textContent = result.user.nombre_completo;
            const avatar = document.getElementById('userAvatar');
            if (avatar) avatar.textContent = result.user.iniciales || 'U';

            console.log('[LOGIN] Login successful - User:', userData.nombre_completo, 'Role:', userData.rol);
        } else {
            alert('Login fallido: ' + (result.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('[LOGIN] Login error:', error);
        alert('Error al intentar iniciar sesion');
    }
}

// Initialize Login
document.addEventListener('DOMContentLoaded', () => {
    console.log('[LOGIN] DOMContentLoaded - Initializing login...');
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.style.display = 'flex'; // Ensure it's visible on load
        loadUsers();
    } else {
        console.error('[LOGIN] #loginOverlay not found!');
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.querySelector('i').classList.toggle('ri-eye-line');
            togglePassword.querySelector('i').classList.toggle('ri-eye-off-line');
        });
    }
});
console.log('[LOGIN] Login script loaded');

// Expose functions globally for inline handlers
window.toggleComputoOEE = toggleComputoOEE;

// Helper functions (restored)
function showLoading(show) {
    if (elements.loading) {
        elements.loading.style.display = show ? 'flex' : 'none';
    }
}

function updateConnectionStatus(connected) {
    if (elements.connectionStatus) {
        elements.connectionStatus.className = connected ? 'status-indicator online' : 'status-indicator offline';
        elements.connectionStatus.title = connected ? 'Conectado' : 'Desconectado';
    }
}

function checkUserSession() {
    const userJson = localStorage.getItem('eipc_user');
    if (userJson) {
        try {
            appData.currentUser = JSON.parse(userJson);

            // Update UI
            if (document.getElementById('userName'))
                document.getElementById('userName').textContent = appData.currentUser.nombre_completo;

            const avatar = document.getElementById('userAvatar');
            if (avatar) avatar.textContent = appData.currentUser.iniciales || 'U';

            // Hide login overlay immediately
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';

            return true;
        } catch (e) {
            console.error('Error parsing user session', e);
            localStorage.removeItem('eipc_user');
        }
    }
    return false;
}

function setupLoginEventListeners() {
    // Only basic setup needed as handleLogin is bound in DOMContentLoaded
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');
    if (togglePassword && passwordInput) {
        togglePassword.onclick = () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePassword.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'ri-eye-line' : 'ri-eye-off-line';
            }
        };
    }
}

// Codigos Rechazo Functions
async function fetchCodigosRechazo() {
    const codigoFilter = document.getElementById('codigosRechazoCodigoFilter');
    const seccionFilter = document.getElementById('codigosRechazoSeccionFilter');
    const controlFilter = document.getElementById('codigosRechazoControlFilter');
    const tbody = document.getElementById('codigosRechazoTableBody');
    const infoDiv = document.getElementById('codigosRechazoInfo');
    const countSpan = document.getElementById('codigosRechazoResultCount');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (codigoFilter?.value) params.append('codigo', codigoFilter.value);
        if (seccionFilter?.value) params.append('seccion', seccionFilter.value);
        if (controlFilter?.value) params.append('controlProduccion', controlFilter.value);

        const response = await fetch(`http://localhost:3001/api/codigos-rechazo?${params.toString()}`);
        const data = await response.json();

        if (data.success) {

            // Populate sections dropdown if needed (or update it)
            // We only update if it's empty or we want to ensure we have all options
            // But usually we want to keep the selected one. 
            // If the user selected a section, it will be in the list returned?
            // The API returns all distinct sections associated with rejections.
            if (seccionFilter && seccionFilter.options.length <= 1 && data.secciones) {
                const currentVal = seccionFilter.value;
                seccionFilter.innerHTML = '<option value="">Todas</option>';
                data.secciones.forEach(sec => {
                    const option = document.createElement('option');
                    option.value = sec.codigo;
                    option.textContent = sec.nombre || sec.codigo;
                    if (sec.codigo == currentVal) option.selected = true;
                    seccionFilter.appendChild(option);
                });
            }

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron códigos de rechazo
                        </td>
                    </tr>
                `;
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = '0 registros encontrados';
                document.getElementById('codigosRechazoPaginationBar').style.display = 'none';
            } else {
                // Store data for pagination
                appData.codigosRechazoPagination.allData = data.data;
                appData.codigosRechazoPagination.currentPage = 1;

                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = `${data.data.length} registros encontrados`;
                renderCodigosRechazoTablePage();
            }

        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching codigos rechazo:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
    }
}

function renderCodigosRechazoTable(data) {
    const tbody = document.getElementById('codigosRechazoTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        const controlBadge = item.control_produccion
            ? '<span style="color: #10b981; font-weight: 500;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
            : '<span style="color: #ef4444; font-weight: 500;"><i class="ri-close-circle-line"></i> No</span>';

        return `
            <tr>
                <td><strong>${item.codigo || '-'}</strong></td>
                <td>${item.descripcion || '-'}</td>
                <td><span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">${item.seccion_nombre || item.seccion_codigo || '-'}</span></td>
                <td>${controlBadge}</td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// INCIDENCIAS SECTION
// =====================================================

// Fetch Incidencias from API
async function fetchIncidencias() {
    const seccionFilter = document.getElementById('incidenciasSeccionFilter');
    const actividadFilter = document.getElementById('incidenciasActividadFilter');
    const activoFilter = document.getElementById('incidenciasActivoFilter');
    const tipoVinculacionFilter = document.getElementById('incidenciasTipoVinculacionFilter');
    const tbody = document.getElementById('incidenciasTableBody');
    const infoDiv = document.getElementById('incidenciasInfo');
    const countSpan = document.getElementById('incidenciasResultCount');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (seccionFilter?.value) params.append('seccion', seccionFilter.value);
        if (actividadFilter?.value) params.append('actividadAsignada', actividadFilter.value);
        if (activoFilter?.value) params.append('activo', activoFilter.value);
        if (tipoVinculacionFilter?.value) params.append('tipoVinculacion', tipoVinculacionFilter.value);

        const response = await fetch(`http://localhost:3001/api/incidencias?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Populate filter dropdowns if they are empty
            populateIncidenciasFilters(data.filtros);

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron incidencias
                        </td>
                    </tr>
                `;
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = '0 registros encontrados';
            } else {
                // Store data and reset pagination
                appData.incidenciasPagination.allData = data.data || [];
                appData.incidenciasPagination.currentPage = 1;
                renderIncidenciasTablePage();
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = `${data.data.length} registros encontrados`;
            }

        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching incidencias:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
    }
}

// Render Incidencias Table
function renderIncidenciasTable(data) {
    const tbody = document.getElementById('incidenciasTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        // Format boolean fields
        const remuneradaBadge = item.remunerada
            ? '<span style="color: #10b981; font-weight: 500;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
            : '<span style="color: #ef4444; font-weight: 500;"><i class="ri-close-circle-line"></i> No</span>';

        const aPrimaBadge = item['a prima']
            ? '<span style="color: #10b981; font-weight: 500;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
            : '<span style="color: #ef4444; font-weight: 500;"><i class="ri-close-circle-line"></i> No</span>';

        const activoBadge = item.activo
            ? '<span style="color: #10b981; font-weight: 500;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
            : '<span style="color: #ef4444; font-weight: 500;"><i class="ri-close-circle-line"></i> No</span>';

        return `
            <tr>
                <td><strong>${item.incidencia || '-'}</strong></td>
                <td>${item.descripcion || '-'}</td>
                <td style="text-align: center;">${remuneradaBadge}</td>
                <td style="text-align: center;">${aPrimaBadge}</td>
                <td>${item['actividad asignada'] || '-'}</td>
                <td><span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">${item.seccion_nombre || item.seccion || '-'}</span></td>
                <td style="text-align: center;">${activoBadge}</td>
                <td>${item.tipo_vinculacion || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Populate Incidencias Filter Dropdowns
function populateIncidenciasFilters(filtros) {
    if (!filtros) return;

    // Populate secciones dropdown
    const seccionSelect = document.getElementById('incidenciasSeccionFilter');
    if (seccionSelect && filtros.secciones && seccionSelect.options.length <= 1) {
        const currentVal = seccionSelect.value;
        seccionSelect.innerHTML = '<option value="">Todas</option>';
        filtros.secciones.forEach(sec => {
            const option = document.createElement('option');
            option.value = sec.codigo;
            option.textContent = sec.nombre || sec.codigo;
            if (sec.codigo === currentVal) option.selected = true;
            seccionSelect.appendChild(option);
        });
    }

    // Populate actividades dropdown
    const actividadSelect = document.getElementById('incidenciasActividadFilter');
    if (actividadSelect && filtros.actividades && actividadSelect.options.length <= 1) {
        const currentVal = actividadSelect.value;
        actividadSelect.innerHTML = '<option value="">Todas</option>';
        filtros.actividades.forEach(act => {
            const option = document.createElement('option');
            option.value = act;
            option.textContent = act;
            if (act === currentVal) option.selected = true;
            actividadSelect.appendChild(option);
        });
    }

    // Populate tipos de vinculación dropdown
    const tipoVinculacionSelect = document.getElementById('incidenciasTipoVinculacionFilter');
    if (tipoVinculacionSelect && filtros.tiposVinculacion && tipoVinculacionSelect.options.length <= 1) {
        const currentVal = tipoVinculacionSelect.value;
        tipoVinculacionSelect.innerHTML = '<option value="">Todos</option>';
        filtros.tiposVinculacion.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            if (tipo === currentVal) option.selected = true;
            tipoVinculacionSelect.appendChild(option);
        });
    }
}

// Event Listeners for Incidencias
document.addEventListener('DOMContentLoaded', () => {
    // Search button
    document.getElementById('buscarIncidenciasBtn')?.addEventListener('click', fetchIncidencias);

    // Filter change listeners - auto fetch on change
    document.getElementById('incidenciasSeccionFilter')?.addEventListener('change', fetchIncidencias);
    document.getElementById('incidenciasActividadFilter')?.addEventListener('change', fetchIncidencias);
    document.getElementById('incidenciasActivoFilter')?.addEventListener('change', fetchIncidencias);
    document.getElementById('incidenciasTipoVinculacionFilter')?.addEventListener('change', fetchIncidencias);
});

// =====================================================
// AUSENCIAS SECTION
// =====================================================

// Fetch Ausencias from API
async function fetchAusencias() {
    const codigoFilter = document.getElementById('ausenciasCodigoFilter');
    const denominacionFilter = document.getElementById('ausenciasDenominacionFilter');
    const absentismoFilter = document.getElementById('ausenciasAbsentismoFilter');
    const tbody = document.getElementById('ausenciasTableBody');
    const infoDiv = document.getElementById('ausenciasInfo');
    const countSpan = document.getElementById('ausenciasResultCount');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (codigoFilter?.value) params.append('codigo', codigoFilter.value);
        if (denominacionFilter?.value) params.append('denominacion', denominacionFilter.value);
        if (absentismoFilter?.value) params.append('absentismo', absentismoFilter.value);

        const response = await fetch(`http://localhost:3001/api/ausencias?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron ausencias
                        </td>
                    </tr>
                `;
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = '0 registros encontrados';
            } else {
                renderAusenciasTable(data.data);
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = `${data.data.length} registros encontrados`;
            }

        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching ausencias:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
    }
}

// Render Ausencias Table
function renderAusenciasTable(data) {
    const tbody = document.getElementById('ausenciasTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        // Format absentismo field (Sí/No based on true/-1 vs false/0/null)
        const absentismoBadge = (item.absentismo === -1 || item.absentismo === true)
            ? '<span style="color: #10b981; font-weight: 500;"><i class="ri-checkbox-circle-fill"></i> Sí</span>'
            : '<span style="color: #ef4444; font-weight: 500;"><i class="ri-close-circle-line"></i> No</span>';

        return `
            <tr>
                <td><strong>${item.Codigo || '-'}</strong></td>
                <td>${item.Denominacion || '-'}</td>
                <td style="text-align: center;">${absentismoBadge}</td>
            </tr>
        `;
    }).join('');
}

// Event Listeners for Ausencias
document.addEventListener('DOMContentLoaded', () => {
    // Search button
    document.getElementById('buscarAusenciasBtn')?.addEventListener('click', fetchAusencias);

    // Enter key on input filters
    document.getElementById('ausenciasCodigoFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchAusencias();
    });
    document.getElementById('ausenciasDenominacionFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchAusencias();
    });

    // Filter change listener for dropdown
    document.getElementById('ausenciasAbsentismoFilter')?.addEventListener('change', fetchAusencias);
});

// =====================================================
// SECCIONES SECTION
// =====================================================

// Fetch Secciones from API
async function fetchSecciones() {
    const codigoFilter = document.getElementById('seccionesCodigoFilter');
    const denominacionFilter = document.getElementById('seccionesDenominacionFilter');
    const tbody = document.getElementById('seccionesTableBody');
    const infoDiv = document.getElementById('seccionesInfo');
    const countSpan = document.getElementById('seccionesResultCount');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (codigoFilter?.value) params.append('seccion', codigoFilter.value);
        if (denominacionFilter?.value) params.append('denominacion', denominacionFilter.value);

        const response = await fetch(`http://localhost:3001/api/secciones?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron secciones
                        </td>
                    </tr>
                `;
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = '0 registros encontrados';
            } else {
                renderSeccionesTable(data.data);
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = `${data.data.length} registros encontrados`;
            }
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="2" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching secciones:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
    }
}

// Render Secciones Table
function renderSeccionesTable(data) {
    const tbody = document.getElementById('seccionesTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        return `
            <tr>
                <td><strong>${item.seccion || '-'}</strong></td>
                <td>${item.denominacion || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Event Listeners for Secciones
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buscarSeccionesBtn')?.addEventListener('click', fetchSecciones);

    document.getElementById('seccionesCodigoFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchSecciones();
    });
    document.getElementById('seccionesDenominacionFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchSecciones();
    });
});

// =====================================================
// ESTRUCTURAS SECTION
// =====================================================

// State for Estructuras pagination
const estructurasState = {
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0
};

// Fetch Estructuras from API with pagination
async function fetchEstructuras(page = 1) {
    const articuloFilter = document.getElementById('estructurasArticuloFilter');
    const componenteFilter = document.getElementById('estructurasComponenteFilter');
    const operacionFilter = document.getElementById('estructurasOperacionFilter');
    const tbody = document.getElementById('estructurasTableBody');
    const infoDiv = document.getElementById('estructurasInfo');
    const countSpan = document.getElementById('estructurasResultCount');
    const paginationBar = document.getElementById('estructurasPaginationBar');
    const costeTotalInfo = document.getElementById('estructurasCosteTotalInfo');
    const costeTotalSpan = document.getElementById('estructurasCosteTotal');

    if (!tbody) return;

    // Require article filter before loading data
    if (!articuloFilter?.value?.trim()) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Introduce un código de artículo y pulsa Buscar
                </td>
            </tr>
        `;
        if (infoDiv) infoDiv.style.display = 'none';
        if (paginationBar) paginationBar.style.display = 'none';
        if (costeTotalInfo) costeTotalInfo.style.display = 'none';
        return;
    }

    estructurasState.page = page;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        if (articuloFilter?.value) params.append('articulo', articuloFilter.value);
        if (componenteFilter?.value) params.append('componente', componenteFilter.value);
        if (operacionFilter?.value) params.append('operacion', operacionFilter.value);
        params.append('page', page);
        params.append('pageSize', estructurasState.pageSize);

        const response = await fetch(`http://localhost:3001/api/estructuras?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            estructurasState.total = data.total;
            estructurasState.totalPages = data.totalPages;

            // Render TOP 10
            renderEstructurasTop10(data.top10Articulos);

            // Show coste total if filtering by article
            if (data.costeTotal !== null && articuloFilter?.value) {
                if (costeTotalInfo) costeTotalInfo.style.display = 'inline';
                if (costeTotalSpan) costeTotalSpan.textContent = data.costeTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
            } else {
                if (costeTotalInfo) costeTotalInfo.style.display = 'none';
            }

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron estructuras
                        </td>
                    </tr>
                `;
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = '0 registros encontrados';
                if (paginationBar) paginationBar.style.display = 'none';
            } else {
                renderEstructurasTable(data.data);
                if (infoDiv) infoDiv.style.display = 'flex';
                if (countSpan) countSpan.textContent = `${data.total} registros encontrados`;
                updateEstructurasPagination();
            }
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
            if (paginationBar) paginationBar.style.display = 'none';
            if (costeTotalInfo) costeTotalInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching estructuras:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
        if (paginationBar) paginationBar.style.display = 'none';
        if (costeTotalInfo) costeTotalInfo.style.display = 'none';
    }
}

// Render Estructuras Table
function renderEstructurasTable(data) {
    const tbody = document.getElementById('estructurasTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        const cantidad = item.cantidad != null ? item.cantidad.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-';
        const precio = item.precioUltimo != null ? item.precioUltimo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' €' : '-';
        const coste = item.coste != null ? item.coste.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-';
        const codArticulo = item['cod de articulo'] || '-';

        return `
            <tr>
                <td style="text-align: center;">${item.ID || '-'}</td>
                <td><strong style="cursor: pointer; color: var(--primary); text-decoration: underline;" onclick="mostrarImagenArticulo('${codArticulo}')">${codArticulo}</strong></td>
                <td>
                    <div><strong>${item.componente || '-'}</strong></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.componenteDescripcion || ''}</div>
                </td>
                <td>
                    <div><strong>${item.operacion != null ? item.operacion : '-'}</strong></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.operacionDescripcion || ''}</div>
                </td>
                <td style="text-align: center;">${item.OperacionInventario != null ? item.OperacionInventario : '-'}</td>
                <td style="text-align: right;">${cantidad}</td>
                <td style="text-align: right;">${precio}</td>
                <td style="text-align: right; font-weight: 600; color: var(--primary);">${coste}</td>
            </tr>
        `;
    }).join('');
}

// Mostrar imagen de artículo en modal
async function mostrarImagenArticulo(articulo) {
    const modal = document.getElementById('articuloImagenModal');
    const titulo = document.getElementById('articuloImagenTitulo');
    const content = document.getElementById('articuloImagenContent');

    if (!modal || !content) return;

    // Mostrar modal con loading
    modal.style.display = 'flex';
    titulo.textContent = `Artículo: ${articulo}`;
    content.innerHTML = '<div class="spinner" style="margin: 3rem auto;"></div>';

    // Usar el endpoint que sirve la imagen directamente
    const imgUrl = `http://localhost:3001/api/articulo-imagen-file/${encodeURIComponent(articulo)}`;

    content.innerHTML = `
        <img src="${imgUrl}" 
             alt="${articulo}" 
             style="max-width: 100%; max-height: 70vh; border-radius: 8px;"
             onload="this.style.opacity='1';"
             onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding: 3rem; color: var(--text-muted);\\'>No se encontró imagen para este artículo</div>';">
    `;
}

// Cerrar modal de imagen
function cerrarModalImagen() {
    const modal = document.getElementById('articuloImagenModal');
    if (modal) modal.style.display = 'none';
}

// Cerrar modal con tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalImagen();
});

// Render TOP 10 Articles by Cost
function renderEstructurasTop10(data) {
    const container = document.getElementById('estructurasTop10Body');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">No hay datos</div>';
        return;
    }

    container.innerHTML = data.map((item, index) => {
        const coste = item.costeTotalArticulo != null ? item.costeTotalArticulo.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€' : '-';
        const medalColor = index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#cd7f32' : 'var(--text-muted)';

        return `
            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border);" 
                 onclick="document.getElementById('estructurasArticuloFilter').value='${item.articulo}'; estructurasState.page = 1; fetchEstructuras(1);"
                 onmouseover="this.style.background='var(--bg-body)'" onmouseout="this.style.background='transparent'">
                <span style="font-weight: 700; color: ${medalColor}; min-width: 18px; text-align: center; font-size: 0.75rem;">${index + 1}</span>
                <div style="flex: 1; min-width: 0; overflow: hidden;">
                    <div style="font-weight: 500; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.articulo || '-'}</div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.denominacion || ''}">${item.denominacion || '-'}</div>
                </div>
                <span style="font-weight: 600; color: var(--success); font-size: 0.7rem; white-space: nowrap;">${coste}</span>
            </div>
        `;
    }).join('');
}

// Update pagination controls
function updateEstructurasPagination() {
    const { page, pageSize, total, totalPages } = estructurasState;
    const paginationBar = document.getElementById('estructurasPaginationBar');
    const paginationInfo = document.getElementById('estructurasPaginationInfo');
    const prevBtn = document.getElementById('estructurasPrevBtn');
    const nextBtn = document.getElementById('estructurasNextBtn');

    if (!paginationBar) return;

    if (total > pageSize) {
        paginationBar.style.display = 'flex';

        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, total);
        if (paginationInfo) paginationInfo.textContent = `Mostrando ${start}-${end} de ${total}`;

        if (prevBtn) {
            prevBtn.disabled = page <= 1;
            prevBtn.style.opacity = page <= 1 ? '0.5' : '1';
        }

        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
            nextBtn.style.opacity = page >= totalPages ? '0.5' : '1';
        }
    } else {
        paginationBar.style.display = 'none';
    }
}

// Event Listeners for Estructuras
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('buscarEstructurasBtn')?.addEventListener('click', () => {
        estructurasState.page = 1;
        fetchEstructuras(1);
    });

    // When article filter changes, load the component and operation dropdowns
    document.getElementById('estructurasArticuloFilter')?.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            estructurasState.page = 1;
            await loadEstructurasFiltros();
            fetchEstructuras(1);
        }
    });

    // Also load filters when user leaves the field
    document.getElementById('estructurasArticuloFilter')?.addEventListener('blur', async () => {
        await loadEstructurasFiltros();
    });

    // Pagination buttons
    document.getElementById('estructurasPrevBtn')?.addEventListener('click', () => {
        if (estructurasState.page > 1) {
            fetchEstructuras(estructurasState.page - 1);
        }
    });

    document.getElementById('estructurasNextBtn')?.addEventListener('click', () => {
        if (estructurasState.page < estructurasState.totalPages) {
            fetchEstructuras(estructurasState.page + 1);
        }
    });
});

// Function to load Estructuras filter dropdowns based on selected article
async function loadEstructurasFiltros() {
    const articuloFilter = document.getElementById('estructurasArticuloFilter');
    const componenteSelect = document.getElementById('estructurasComponenteFilter');
    const operacionSelect = document.getElementById('estructurasOperacionFilter');

    const articulo = articuloFilter?.value?.trim() || '';

    if (!articulo) {
        // Clear dropdowns if no article
        if (componenteSelect) componenteSelect.innerHTML = '<option value="">Todos</option>';
        if (operacionSelect) operacionSelect.innerHTML = '<option value="">Todas</option>';
        return;
    }

    try {
        const response = await fetch(`http://localhost:3001/api/estructuras-filtros?articulo=${encodeURIComponent(articulo)}`);
        const data = await response.json();

        if (data.success) {
            // Populate Componentes
            if (componenteSelect) {
                const currentComponente = componenteSelect.value;
                componenteSelect.innerHTML = '<option value="">Todos</option>';
                data.componentes.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.codigo;
                    option.textContent = c.descripcion ? `${c.codigo} - ${c.descripcion}` : c.codigo;
                    if (c.codigo === currentComponente) option.selected = true;
                    componenteSelect.appendChild(option);
                });
            }

            // Populate Operaciones
            if (operacionSelect) {
                const currentOperacion = operacionSelect.value;
                operacionSelect.innerHTML = '<option value="">Todas</option>';
                data.operaciones.forEach(o => {
                    const option = document.createElement('option');
                    option.value = o.codigo;
                    option.textContent = o.descripcion ? `${o.codigo} - ${o.descripcion}` : o.codigo;
                    if (o.codigo === currentOperacion) option.selected = true;
                    operacionSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading estructuras filtros:', error);
    }
}



// ============================================
// MATERIALES DASHBOARD LOGIC
// ============================================

// Fetch Materiales from API
async function fetchMateriales() {
    const codigoFilter = document.getElementById('materialesCodigoFilter');
    const tbody = document.getElementById('materialesTableBody');
    const infoDiv = document.getElementById('materialesInfo');
    const countSpan = document.getElementById('materialesResultCount');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 30px; height: 30px;"></div>
                Cargando materiales...
            </td>
        </tr>
    `;

    try {
        const codigo = codigoFilter?.value.trim() || '';

        const params = new URLSearchParams();
        if (codigo) params.append('codigo', codigo);

        const response = await fetch(`http://localhost:3001/api/materiales?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="ri-search-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No se encontraron materiales${codigo ? ' con ese criterio' : ''}
                        </td>
                    </tr>
                `;
            } else {
                // Store data and reset pagination
                appData.materialesPagination.allData = data.data || [];
                appData.materialesPagination.currentPage = 1;
                renderMaterialesTablePage();
            }

            if (infoDiv) infoDiv.style.display = 'flex';
            if (countSpan) countSpan.textContent = `${data.count} registros encontrados`;
        } else {
            console.error('Error fetching materiales:', data.error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="2" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                        Error: ${data.error || 'Desconocido'}
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching materiales:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; padding: 2rem; color: #ef4444;">
                    <i class="ri-wifi-off-line" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error de conexión
                </td>
            </tr>
        `;
    }
}

// Render Materiales Table
function renderMaterialesTable(materiales) {
    const tbody = document.getElementById('materialesTableBody');
    if (!tbody) return;

    tbody.innerHTML = materiales.map(mat => `
        <tr>
            <td style="font-weight: 600;">${mat.codigo || '-'}</td>
            <td>${mat.descripcion || '-'}</td>
        </tr>
    `).join('');
}

// ============================================
// PAGINATION FUNCTIONS FOR ADDITIONAL SECTIONS
// ============================================

// Render Incidencias Table with Pagination
function renderIncidenciasTablePage() {
    const tbody = document.getElementById('incidenciasTableBody');
    const paginationBar = document.getElementById('incidenciasPaginationBar');
    const paginationInfo = document.getElementById('incidenciasPaginationInfo');
    const prevBtn = document.getElementById('incidenciasPrevPageBtn');
    const nextBtn = document.getElementById('incidenciasNextPageBtn');

    if (!tbody) return;

    const allData = appData.incidenciasPagination?.allData || [];
    const pageSize = appData.incidenciasPagination?.pageSize || 50;
    const currentPage = appData.incidenciasPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No se encontraron incidencias</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderIncidenciasTable(pageData);
}

// Render Materiales Table with Pagination
function renderMaterialesTablePage() {
    const tbody = document.getElementById('materialesTableBody');
    const paginationBar = document.getElementById('materialesPaginationBar');
    const paginationInfo = document.getElementById('materialesPaginationInfo');
    const prevBtn = document.getElementById('materialesPrevPageBtn');
    const nextBtn = document.getElementById('materialesNextPageBtn');

    if (!tbody) return;

    const allData = appData.materialesPagination?.allData || [];
    const pageSize = appData.materialesPagination?.pageSize || 50;
    const currentPage = appData.materialesPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No se encontraron materiales</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderMaterialesTable(pageData);
}

// Render Normas Table with Pagination
function renderNormasTablePage() {
    const tbody = document.getElementById('normasTableBody');
    const paginationBar = document.getElementById('normasPaginationBar');
    const paginationInfo = document.getElementById('normasPaginationInfo');
    const prevBtn = document.getElementById('normasPrevPageBtn');
    const nextBtn = document.getElementById('normasNextPageBtn');

    if (!tbody) return;

    const allData = appData.normasPagination?.allData || [];
    const pageSize = appData.normasPagination?.pageSize || 50;
    const currentPage = appData.normasPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No se encontraron normas</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderNormasTable(pageData);
}

// Event Listeners for Pagination Buttons (Incidencias, Materiales, Normas)
document.addEventListener('DOMContentLoaded', () => {
    // Incidencias pagination
    document.getElementById('incidenciasPrevPageBtn')?.addEventListener('click', () => {
        if (appData.incidenciasPagination.currentPage > 1) {
            appData.incidenciasPagination.currentPage--;
            renderIncidenciasTablePage();
        }
    });
    document.getElementById('incidenciasNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil((appData.incidenciasPagination.allData?.length || 0) / appData.incidenciasPagination.pageSize);
        if (appData.incidenciasPagination.currentPage < totalPages) {
            appData.incidenciasPagination.currentPage++;
            renderIncidenciasTablePage();
        }
    });

    // Materiales pagination
    document.getElementById('materialesPrevPageBtn')?.addEventListener('click', () => {
        if (appData.materialesPagination.currentPage > 1) {
            appData.materialesPagination.currentPage--;
            renderMaterialesTablePage();
        }
    });
    document.getElementById('materialesNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil((appData.materialesPagination.allData?.length || 0) / appData.materialesPagination.pageSize);
        if (appData.materialesPagination.currentPage < totalPages) {
            appData.materialesPagination.currentPage++;
            renderMaterialesTablePage();
        }
    });

    // Normas pagination
    document.getElementById('normasPrevPageBtn')?.addEventListener('click', () => {
        if (appData.normasPagination.currentPage > 1) {
            appData.normasPagination.currentPage--;
            renderNormasTablePage();
        }
    });
    document.getElementById('normasNextPageBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil((appData.normasPagination.allData?.length || 0) / appData.normasPagination.pageSize);
        if (appData.normasPagination.currentPage < totalPages) {
            appData.normasPagination.currentPage++;
            renderNormasTablePage();
        }
    });
});

// ============================================
// CLIENTES LOGIC
// ============================================

// Fetch Clientes from API
async function fetchClientes() {
    const clienteInput = document.getElementById('clienteFilter');
    const tbody = document.getElementById('clientesTableBody');
    const countSpan = document.getElementById('clientesResultCount');
    const infoDiv = document.getElementById('clientesInfo');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 0.5rem;"></div>
                Cargando clientes...
            </td>
        </tr>
    `;
    infoDiv.style.display = 'none';

    try {
        const params = new URLSearchParams();
        if (clienteInput?.value) params.append('cliente', clienteInput.value);

        const response = await fetch(`http://localhost:3001/api/clientes-maestro?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            // Store all data for pagination
            appData.clientesPagination.allData = data.data || [];
            appData.clientesPagination.currentPage = 1;

            if (countSpan) countSpan.textContent = `${data.count || data.data.length} registros encontrados`;
            if (infoDiv) infoDiv.style.display = 'flex';

            renderClientesTablePage();
        } else {
            console.error('Error fetching clientes:', data.error);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error al cargar clientes</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching clientes:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error de conexión</td></tr>`;
    }
}

// Render Clientes Table
function renderClientesTable(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    if (!clientes || clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron clientes</td></tr>`;
        return;
    }

    tbody.innerHTML = clientes.map(c => `
        <tr>
            <td><strong>${c['codigo cliente'] || '-'}</strong></td>
            <td>${c['nombre empresa'] || '-'}</td>
            <td>${c.Email || '-'}</td>
            <td>${c.telefono || '-'}</td>
            <td>${c['Codigo Estado'] || '-'}</td>
        </tr>
    `).join('');
}

// Render Clientes Table with Pagination
function renderClientesTablePage() {
    const tbody = document.getElementById('clientesTableBody');
    const paginationBar = document.getElementById('clientesPaginationBar');
    const paginationInfo = document.getElementById('clientesPaginationInfo');
    const prevBtn = document.getElementById('clientesPrevPageBtn');
    const nextBtn = document.getElementById('clientesNextPageBtn');

    if (!tbody) return;

    const allData = appData.clientesPagination?.allData || [];
    const pageSize = appData.clientesPagination?.pageSize || 50;
    const currentPage = appData.clientesPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron clientes</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderClientesTable(pageData);
}

// ============================================
// PAGINATION FUNCTIONS FOR MAESTROS SECTIONS
// ============================================

// Render Operarios Table with Pagination
function renderOperariosTablePage() {
    const tbody = document.getElementById('operariosTableBody');
    const paginationBar = document.getElementById('operariosPaginationBar');
    const paginationInfo = document.getElementById('operariosPaginationInfo');
    const prevBtn = document.getElementById('operariosPrevPageBtn');
    const nextBtn = document.getElementById('operariosNextPageBtn');

    if (!tbody) return;

    const allData = appData.operariosPagination?.allData || [];
    const pageSize = appData.operariosPagination?.pageSize || 50;
    const currentPage = appData.operariosPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron operarios</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderOperariosTable(pageData);
}

// Render Operaciones Table with Pagination
function renderOperacionesTablePage() {
    const tbody = document.getElementById('operacionesTableBody');
    const paginationBar = document.getElementById('operacionesPaginationBar');
    const paginationInfo = document.getElementById('operacionesPaginationInfo');
    const prevBtn = document.getElementById('operacionesPrevPageBtn');
    const nextBtn = document.getElementById('operacionesNextPageBtn');

    if (!tbody) return;

    const allData = appData.operacionesPagination?.allData || [];
    const pageSize = appData.operacionesPagination?.pageSize || 50;
    const currentPage = appData.operacionesPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron operaciones</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderOperacionesTable(pageData);
}

// Render Codigos Rechazo Table with Pagination
function renderCodigosRechazoTablePage() {
    const tbody = document.getElementById('codigosRechazoTableBody');
    const paginationBar = document.getElementById('codigosRechazoPaginationBar');
    const paginationInfo = document.getElementById('codigosRechazoPaginationInfo');
    const prevBtn = document.getElementById('codigosRechazoPrevPageBtn');
    const nextBtn = document.getElementById('codigosRechazoNextPageBtn');

    if (!tbody) return;

    const allData = appData.codigosRechazoPagination?.allData || [];
    const pageSize = appData.codigosRechazoPagination?.pageSize || 50;
    const currentPage = appData.codigosRechazoPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No se encontraron códigos de rechazo</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderCodigosRechazoTable(pageData);
}

// Render Centros Table with Pagination
function renderCentrosTablePage() {
    const tbody = document.getElementById('centrosTableBody');
    const paginationBar = document.getElementById('centrosPaginationBar');
    const paginationInfo = document.getElementById('centrosPaginationInfo');
    const prevBtn = document.getElementById('centrosPrevPageBtn');
    const nextBtn = document.getElementById('centrosNextPageBtn');

    if (!tbody) return;

    const allData = appData.centrosPagination?.allData || [];
    const pageSize = appData.centrosPagination?.pageSize || 50;
    const currentPage = appData.centrosPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se encontraron centros</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderCentrosTable(pageData);
}

// Render Activos Table with Pagination
function renderActivosTablePage() {
    const tbody = document.getElementById('activosTableBody');
    const paginationBar = document.getElementById('activosPaginationBar');
    const paginationInfo = document.getElementById('activosPaginationInfo');
    const prevBtn = document.getElementById('activosPrevPageBtn');
    const nextBtn = document.getElementById('activosNextPageBtn');

    if (!tbody) return;

    const allData = appData.activosPagination?.allData || [];
    const pageSize = appData.activosPagination?.pageSize || 50;
    const currentPage = appData.activosPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No se encontraron activos</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderActivosTable(pageData);
}

// Render Materiales Table with Pagination
function renderMaterialesTablePage() {
    const tbody = document.getElementById('materialesTableBody');
    const paginationBar = document.getElementById('materialesPaginationBar');
    const paginationInfo = document.getElementById('materialesPaginationInfo');
    const prevBtn = document.getElementById('materialesPrevPageBtn');
    const nextBtn = document.getElementById('materialesNextPageBtn');

    if (!tbody) return;

    const allData = appData.materialesPagination?.allData || [];
    const pageSize = appData.materialesPagination?.pageSize || 50;
    const currentPage = appData.materialesPagination?.currentPage || 1;
    const totalPages = Math.ceil(allData.length / pageSize);

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, allData.length);
    const pageData = allData.slice(start, end);

    if (allData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No se encontraron materiales</td></tr>`;
        if (paginationBar) paginationBar.style.display = 'none';
        return;
    }

    // Show pagination bar
    if (paginationBar) paginationBar.style.display = 'flex';
    if (paginationInfo) paginationInfo.textContent = `Mostrando ${start + 1}-${end} de ${allData.length}`;
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }

    renderMaterialesTable(pageData);
}
