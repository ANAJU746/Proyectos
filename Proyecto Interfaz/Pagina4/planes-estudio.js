const API_URL = 'http://localhost:3000';

let planesData = [];
let todasLasClases = [];
let planActual = null;
let semestreActualEtiqueta = '';

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarPlanes();
    cargarTodasLasClases();
    cargarSemestreActual();
    configurarEventos();
});

function configurarEventos() {
    // Botones principales
    document.getElementById('btnNuevoPlan').addEventListener('click', abrirModalNuevoPlan);
    document.getElementById('closePlanModal').addEventListener('click', cerrarModalPlan);
    document.getElementById('btnCancelarPlan').addEventListener('click', cerrarModalPlan);
    document.getElementById('formPlan').addEventListener('submit', guardarPlan);
    
    // Búsqueda
    document.getElementById('searchPlan').addEventListener('input', filtrarPlanes);
    
    // Modal materias
    document.getElementById('closeMateriasModal').addEventListener('click', cerrarModalMaterias);
    document.getElementById('btnAgregarMateria').addEventListener('click', abrirModalAgregarMateria);
    document.getElementById('filtroSemestre').addEventListener('change', filtrarMateriasPorSemestre);
    
    // Modal agregar materia
    document.getElementById('closeAgregarMateriaModal').addEventListener('click', cerrarModalAgregarMateria);
    document.getElementById('btnCancelarMateria').addEventListener('click', cerrarModalAgregarMateria);
    document.getElementById('formAgregarMateria').addEventListener('submit', guardarMateria);
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// ==================== FUNCIONES DE CARGA ====================

async function cargarPlanes() {
    try {
        const response = await fetch(`${API_URL}/api/planes-estudio`);
        const data = await response.json();
        
        if (data.success) {
            planesData = data.planes;
            renderizarPlanes(planesData);
        } else {
            mostrarError('Error al cargar los planes de estudio');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al cargar los planes');
    }
}

async function cargarTodasLasClases() {
    try {
        const response = await fetch(`${API_URL}/api/clases`);
        const data = await response.json();
        
        if (data.success) {
            todasLasClases = data.clases;
        }
    } catch (error) {
        console.error('Error al cargar clases:', error);
    }
}

async function cargarSemestreActual() {
    try {
        const resp = await fetch(`${API_URL}/api/semestres`);
        const data = await resp.json();
        if (data.success && Array.isArray(data.semestres) && data.semestres.length) {
            const sem = (data.semestres.find(s => s.activo) || data.semestres[data.semestres.length - 1]);
            semestreActualEtiqueta = formatearSemestre(sem.nombre || sem.semestre || '');
        }
    } catch (err) {
        console.error('Error al cargar semestres:', err);
    }
}

function formatearSemestre(texto) {
    if (!texto || typeof texto !== 'string') return '';
    const t = texto.trim();
    const parenMatch = t.match(/^(\d{4})-([12])\s*\(([^)]+)\)/);
    if (parenMatch) {
        const year = parenMatch[1];
        const rango = parenMatch[3].replace(/\s*-\s*/g, ' - ');
        return `${year} ${rango}`;
    }
    const codeMatch = t.match(/^[OP](\d{4})$/i);
    if (codeMatch) {
        const year = codeMatch[1];
        const pref = t[0].toUpperCase() === 'O' ? 'Agosto - Diciembre' : 'Enero - Junio';
        return `${year} ${pref}`;
    }
    const yearText = t.match(/^(\d{4})\s+(.+)$/);
    if (yearText) {
        const year = yearText[1];
        const rest = yearText[2].replace(/\s*-\s*/g, ' - ');
        return `${year} ${rest}`;
    }
    if (/^\d+$/.test(t)) return '';
    return t;
}

// ==================== RENDERIZADO ====================

function renderizarPlanes(planes) {
    const tbody = document.getElementById('planesTableBody');
    
    if (!planes || planes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.3;"></i>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">No hay planes de estudio registrados</p>
                    <button class="action-btn" onclick="abrirModalNuevoPlan()" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> Crear primer plan
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = planes.map(plan => `
        <tr>
            <td><span class="plan-codigo">${plan.codigo || '-'}</span></td>
            <td><strong style="color: var(--primary-color);">${plan.nombre}</strong></td>
            <td>${plan.carrera}</td>
            <td><span class="badge badge-info">${plan.duracion_semestres} semestres</span></td>
            <td>${plan.creditos_totales ? `<strong>${plan.creditos_totales}</strong> créditos` : '-'}</td>
            <td>
                <span class="status-badge ${plan.estado === 'activo' ? 'status-active' : 'status-inactive'}">
                    ${plan.estado}
                </span>
            </td>
            <td class="actions">
                <button class="action-icon view-icon" onclick="verMaterias(${plan.id})" title="Ver materias">
                    <i class="fas fa-list"></i>
                </button>
                <button class="action-icon edit-icon" onclick="editarPlan(${plan.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-icon delete-icon" onclick="eliminarPlan(${plan.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== MODALES - PLAN ====================

function abrirModalNuevoPlan() {
    document.getElementById('modalPlanTitulo').textContent = 'Nuevo Plan de Estudio';
    document.getElementById('formPlan').reset();
    document.getElementById('planId').value = '';
    document.getElementById('planEstado').value = 'activo';
    document.getElementById('modalPlan').style.display = 'block';
}

function cerrarModalPlan() {
    document.getElementById('modalPlan').style.display = 'none';
}

async function editarPlan(id) {
    try {
        const response = await fetch(`${API_URL}/api/planes-estudio/${id}`);
        const data = await response.json();
        
        if (data.success && data.plan) {
            const plan = data.plan;
            document.getElementById('modalPlanTitulo').textContent = 'Editar Plan de Estudio';
            document.getElementById('planId').value = plan.id;
            document.getElementById('planNombre').value = plan.nombre;
            document.getElementById('planCarrera').value = plan.carrera;
            document.getElementById('planCodigo').value = plan.codigo || '';
            document.getElementById('planSemestres').value = plan.duracion_semestres;
            document.getElementById('planCreditos').value = plan.creditos_totales || '';
            document.getElementById('planEstado').value = plan.estado;
            document.getElementById('planDescripcion').value = plan.descripcion || '';
            document.getElementById('modalPlan').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar los datos del plan');
    }
}

async function guardarPlan(e) {
    e.preventDefault();
    
    const id = document.getElementById('planId').value;
    const planData = {
        nombre: document.getElementById('planNombre').value,
        carrera: document.getElementById('planCarrera').value,
        codigo: document.getElementById('planCodigo').value || null,
        duracion_semestres: parseInt(document.getElementById('planSemestres').value),
        creditos_totales: parseInt(document.getElementById('planCreditos').value) || null,
        estado: document.getElementById('planEstado').value,
        descripcion: document.getElementById('planDescripcion').value || null
    };
    
    try {
        const url = id ? `${API_URL}/api/planes-estudio/${id}` : `${API_URL}/api/planes-estudio`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(planData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito(id ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
            cerrarModalPlan();
            cargarPlanes();
        } else {
            mostrarError(data.message || 'Error al guardar el plan');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al guardar');
    }
}

async function eliminarPlan(id) {
    if (!confirm('¿Está seguro de eliminar este plan de estudio?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/planes-estudio/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito('Plan eliminado correctamente');
            cargarPlanes();
        } else {
            mostrarError(data.message || 'Error al eliminar el plan');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al eliminar');
    }
}

// ==================== MODALES - MATERIAS ====================

async function verMaterias(planId) {
    planActual = planId;
    const plan = planesData.find(p => p.id === planId);
    
    if (!plan) return;
    
    const tituloBase = `Materias - ${plan.nombre}`;
    const titulo = semestreActualEtiqueta ? `${tituloBase} (Semestre ${semestreActualEtiqueta})` : tituloBase;
    document.getElementById('modalMateriasTitulo').textContent = titulo;
    document.getElementById('materiaPlanId').value = planId;
    
    // Llenar filtro de semestres
    const filtroSemestre = document.getElementById('filtroSemestre');
    filtroSemestre.innerHTML = '<option value="">Todos</option>';
    for (let i = 1; i <= plan.duracion_semestres; i++) {
        filtroSemestre.innerHTML += `<option value="${i}">Semestre ${i}</option>`;
    }
    
    await cargarMateriasPlan(planId);
    document.getElementById('modalMaterias').style.display = 'block';
}

function cerrarModalMaterias() {
    document.getElementById('modalMaterias').style.display = 'none';
    planActual = null;
}

async function cargarMateriasPlan(planId) {
    try {
        const response = await fetch(`${API_URL}/api/planes-estudio/${planId}/materias`);
        const data = await response.json();
        
        if (data.success) {
            renderizarMaterias(data.materias);
        } else {
            mostrarError('Error al cargar las materias del plan');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al cargar las materias');
    }
}

function renderizarMaterias(materias) {
    const tbody = document.getElementById('materiasTableBody');
    
    if (!materias || materias.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-book-open" style="font-size: 2.5rem; color: var(--text-secondary); opacity: 0.3;"></i>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">No hay materias asignadas a este plan</p>
                    <button class="action-btn" onclick="abrirModalAgregarMateria()" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> Agregar primera materia
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = materias.map(m => `
        <tr>
            <td><strong style="color: var(--text-color);">${m.clase_nombre}</strong></td>
            <td><code style="background: rgba(74,144,226,0.1); padding: 4px 8px; border-radius: 4px; color: var(--primary-color);">${m.clase_codigo || '-'}</code></td>
            <td><span class="badge badge-info">Semestre ${m.semestre}</span></td>
            <td><strong>${m.creditos}</strong> créditos</td>
            <td>
                <span class="badge ${m.es_obligatoria ? 'badge-success' : 'badge-warning'}">
                    ${m.es_obligatoria ? '<i class="fas fa-check-circle"></i> Obligatoria' : '<i class="fas fa-star"></i> Optativa'}
                </span>
            </td>
            <td>${m.orden}</td>
            <td class="actions">
                <button class="action-icon edit-icon" onclick="editarMateriaPlan(${m.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-icon delete-icon" onclick="eliminarMateriaPlan(${m.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarMateriasPorSemestre() {
    const semestre = document.getElementById('filtroSemestre').value;
    if (!planActual) return;
    
    cargarMateriasPlan(planActual);
}

// ==================== MODALES - AGREGAR/EDITAR MATERIA ====================

function abrirModalAgregarMateria() {
    document.getElementById('modalAgregarMateriaTitulo').textContent = 'Agregar Materia al Plan';
    document.getElementById('formAgregarMateria').reset();
    document.getElementById('materiaRelacionId').value = '';
    document.getElementById('materiaPlanId').value = planActual;
    
    // Llenar select de clases
    const selectClase = document.getElementById('materiaClaseId');
    selectClase.innerHTML = '<option value="">Seleccione una materia...</option>';
    todasLasClases.forEach(clase => {
        selectClase.innerHTML += `<option value="${clase.id}">${clase.nombre} (${clase.codigo || 'Sin código'})</option>`;
    });
    
    document.getElementById('modalAgregarMateria').style.display = 'block';
}

function cerrarModalAgregarMateria() {
    document.getElementById('modalAgregarMateria').style.display = 'none';
}

async function editarMateriaPlan(relacionId) {
    try {
        const response = await fetch(`${API_URL}/api/plan-materias/${relacionId}`);
        const data = await response.json();
        
        if (data.success && data.materia) {
            const m = data.materia;
            document.getElementById('modalAgregarMateriaTitulo').textContent = 'Editar Materia del Plan';
            document.getElementById('materiaRelacionId').value = m.id;
            document.getElementById('materiaPlanId').value = m.plan_estudio_id;
            
            // Llenar select de clases
            const selectClase = document.getElementById('materiaClaseId');
            selectClase.innerHTML = '<option value="">Seleccione una materia...</option>';
            todasLasClases.forEach(clase => {
                selectClase.innerHTML += `<option value="${clase.id}" ${clase.id === m.clase_id ? 'selected' : ''}>${clase.nombre} (${clase.codigo || 'Sin código'})</option>`;
            });
            
            document.getElementById('materiaSemestre').value = m.semestre;
            document.getElementById('materiaCreditos').value = m.creditos;
            document.getElementById('materiaObligatoria').value = m.es_obligatoria;
            document.getElementById('materiaOrden').value = m.orden;
            
            document.getElementById('modalAgregarMateria').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar los datos de la materia');
    }
}

async function guardarMateria(e) {
    e.preventDefault();
    
    const relacionId = document.getElementById('materiaRelacionId').value;
    const materiaData = {
        plan_estudio_id: parseInt(document.getElementById('materiaPlanId').value),
        clase_id: parseInt(document.getElementById('materiaClaseId').value),
        semestre: parseInt(document.getElementById('materiaSemestre').value),
        creditos: parseInt(document.getElementById('materiaCreditos').value),
        es_obligatoria: parseInt(document.getElementById('materiaObligatoria').value),
        orden: parseInt(document.getElementById('materiaOrden').value)
    };
    
    try {
        const url = relacionId ? `${API_URL}/api/plan-materias/${relacionId}` : `${API_URL}/api/plan-materias`;
        const method = relacionId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materiaData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito(relacionId ? 'Materia actualizada correctamente' : 'Materia agregada correctamente');
            cerrarModalAgregarMateria();
            cargarMateriasPlan(planActual);
        } else {
            mostrarError(data.message || 'Error al guardar la materia');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al guardar');
    }
}

async function eliminarMateriaPlan(relacionId) {
    if (!confirm('¿Está seguro de eliminar esta materia del plan?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/plan-materias/${relacionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarExito('Materia eliminada del plan correctamente');
            cargarMateriasPlan(planActual);
        } else {
            mostrarError(data.message || 'Error al eliminar la materia');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión al eliminar');
    }
}

// ==================== BÚSQUEDA Y FILTROS ====================

function filtrarPlanes() {
    const searchTerm = document.getElementById('searchPlan').value.toLowerCase();
    const planesFiltrados = planesData.filter(plan => 
        plan.nombre.toLowerCase().includes(searchTerm) ||
        plan.carrera.toLowerCase().includes(searchTerm) ||
        (plan.codigo && plan.codigo.toLowerCase().includes(searchTerm))
    );
    renderizarPlanes(planesFiltrados);
}

// ==================== UTILIDADES ====================

function mostrarExito(mensaje) {
    alert(mensaje);
}

function mostrarError(mensaje) {
    alert(mensaje);
}
