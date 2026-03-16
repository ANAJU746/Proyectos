// ========================================
// PROTECCIÓN: Solo administradores
// ========================================
(function requireAdmin(){
    try {
        const u = JSON.parse(sessionStorage.getItem('user'));
        if (!u || u.role !== 'admin') {
            window.location.href = '/Pagina1/index.html';
        }
    } catch (_) {
        window.location.href = '/Pagina1/index.html';
    }
})();

// ========================================
// ACTUALIZAR FECHA EN HEADER
// ========================================
function updateDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('es-ES', options);
    const dateEl = document.querySelector('.date');
    if (dateEl) dateEl.textContent = today;
}

updateDate();

// ========================================
// VARIABLES GLOBALES
// ========================================
const modal = document.getElementById('classModal');
const newClassBtn = document.getElementById('newClassBtn');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.querySelector('.cancel-btn');
const classForm = document.getElementById('classForm');
const formMessage = document.getElementById('form-message');

// ========================================
// CARGAR CLASES
// ========================================
async function fetchClases() {
    try {
        const res = await fetch('/api/clases', { cache: 'no-store' });
        if (!res.ok) {
            const txt = await res.text();
            console.error('Respuesta no OK /api/clases:', res.status, txt);
            throw new Error(`Error al cargar clases (HTTP ${res.status})`);
        }
        let clases;
        try {
            clases = await res.json();
        } catch (e) {
            const txt = await res.text();
            console.error('JSON inválido en /api/clases:', txt);
            throw new Error('Respuesta inválida del servidor al cargar clases');
        }
        renderClasesTable(clases);
    } catch (err) {
        console.error('Error fetching clases:', err);
        const tbody = document.getElementById('clases-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">Error al cargar clases. Por favor, intenta de nuevo.<br><small>${err.message}</small></td></tr>`;
        }
        // Reintento rápido por si era un fallo temporal
        setTimeout(() => {
            try { fetchClases(); } catch(_) {}
        }, 1500);
    }
}

function renderClasesTable(clases) {
    const tbody = document.getElementById('clases-tbody');
    if (!tbody) return;
    
    if (!clases || clases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;">No hay clases registradas. Haz clic en "Nueva Clase" para agregar una.</td></tr>`;
        return;
    }
    
    
    tbody.innerHTML = clases.map(clase => {
        const horarioTexto = formatHorarios(clase.horarios);
        return `
            <tr data-id="${clase.id}">
                <td>${escapeHtml(clase.codigo)}</td>
                <td>${escapeHtml(clase.nombre)}</td>
                <td>${escapeHtml(clase.profesor_nombre || 'Sin asignar')}</td>
                <td>${escapeHtml(clase.aula || 'N/A')}</td>
                <td style="font-size: 0.9em;">${horarioTexto}</td>
                <td>${clase.cupo_maximo || 30}</td>
                <td><span class="status active">Activa</span></td>
                <td><div style="display:flex; gap:0.5rem; justify-content: center;">
                    <button class="icon-btn edit-btn" data-id="${clase.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="icon-btn delete-btn" data-id="${clase.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>
        `;
    }).join('');
    
    attachEditButtons();
    attachDeleteButtons();
}

function formatHorarios(horarios) {
    if (!horarios || horarios.length === 0) return '<span style="color:#999;">Sin horario</span>';
    const chips = horarios.map(h => {
        const diaCorto = h.dia.slice(0,3);
        const inicio = (h.inicio || '').substring(0,5);
        const fin = (h.fin || '').substring(0,5);
        return `<span class="schedule-chip"><span class="chip-day">${diaCorto}</span><span class="chip-time">${inicio}–${fin}</span></span>`;
    }).join(' ');
    return `<div class="schedule-pills">${chips}</div>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// CATÁLOGOS: Áreas, Materias, Profesores
// ========================================
async function loadAreas() {
    try {
        const res = await fetch('/api/areas');
        if (!res.ok) throw new Error('Error al cargar áreas');
        const payload = await res.json();
        const areas = payload.ok ? payload.areas : (Array.isArray(payload) ? payload : []);
        const areaSelect = document.getElementById('area_id');
        areaSelect.innerHTML = '<option value="">Seleccionar área...</option>';
        areas.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.nombre;
            areaSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading areas:', err);
    }
}

async function loadMateriasByArea() {
    try {
        const areaSel = document.getElementById('area_id');
        const opt = areaSel && areaSel.options[areaSel.selectedIndex];
        const areaNombre = opt ? opt.textContent : '';
        const materiaSelect = document.getElementById('materia_id');
        if (!areaNombre) {
            if (materiaSelect) materiaSelect.innerHTML = '<option value="">Seleccionar materia...</option>';
            return;
        }
        const res = await fetch(`/api/materias-catalogo?area=${encodeURIComponent(areaNombre)}`);
        if (!res.ok) throw new Error('Error al cargar materias');
        const payload = await res.json();
        const materias = payload.ok ? payload.materias : (Array.isArray(payload) ? payload : []);
        materiaSelect.innerHTML = '<option value="">Seleccionar materia...</option>';
        materias.forEach(m => {
            const optM = document.createElement('option');
            optM.value = m.id;
            optM.textContent = m.nombre;
            materiaSelect.appendChild(optM);
        });
    } catch (err) {
        console.error('Error loading materias:', err);
    }
}

async function loadProfesores(filterByAreaNombre) {
    try {
        // TEMPORAL: Mostrar todos los profesores activos sin filtrar por área
        // hasta que se asignen correctamente las materias del catálogo a cada profesor
        const res = await fetch('/api/profesores');
        if (!res.ok) throw new Error('Error al cargar profesores');
        const profesores = await res.json();
        const select = document.getElementById('profesor_id');
        select.innerHTML = '<option value="">Seleccionar profesor...</option>';
        profesores.filter(p => p.estado === 'activo').forEach(prof => {
            const option = document.createElement('option');
            option.value = prof.id;
            const materiaInfo = prof.materia ? ` (${prof.materia})` : '';
            option.textContent = `${prof.nombre}${materiaInfo}`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading profesores:', err);
    }
}

// ========================================
// MODAL: ABRIR/CERRAR
// ========================================
if (newClassBtn) {
    newClassBtn.addEventListener('click', () => {
        openModalForNew();
    });
}

function openModalForNew() {
    const modalHeader = document.querySelector('#classModal .modal-header h3');
    if (modalHeader) modalHeader.textContent = 'Nueva Clase';
    const submitBtn = classForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Guardar Clase';
    classForm.reset();
    document.getElementById('clase_id').value = '';
    resetScheduleInputs();
    hideFormMessage();
    loadAreas();
    const materiaSelect = document.getElementById('materia_id');
    if (materiaSelect) materiaSelect.innerHTML = '<option value="">Seleccionar materia...</option>';
    loadProfesores();
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    classForm.reset();
    resetScheduleInputs();
    hideFormMessage();
}

function resetScheduleInputs() {
    document.querySelectorAll('.schedule-day').forEach(day => {
        const checkbox = day.querySelector('input[type="checkbox"]');
        const timeInputs = day.querySelectorAll('input[type="time"]');
        checkbox.checked = false;
        timeInputs.forEach(input => {
            input.value = '';
            input.disabled = true;
        });
    });
}

if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// ========================================
// HABILITAR/DESHABILITAR HORARIOS
// ========================================
document.querySelectorAll('input[name="dia"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const timeInputs = this.closest('.schedule-day').querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => {
            input.disabled = !this.checked;
            if (!this.checked) input.value = '';
        });
    });
});

// ========================================
// EDITAR CLASE
// ========================================
function attachEditButtons() {
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            await openEditModal(id);
        });
    });
}

async function openEditModal(id) {
    try {
        const res = await fetch(`/api/clases/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar la clase');
        
        const clase = await res.json();
        
        const modalHeader = document.querySelector('#classModal .modal-header h3');
        if (modalHeader) modalHeader.textContent = 'Editar Clase';
        
        const submitBtn = classForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Actualizar Clase';
        
        await loadProfesores();
        
        document.getElementById('clase_id').value = clase.id;
        document.getElementById('codigo').value = clase.codigo || '';
        document.getElementById('profesor_id').value = clase.profesor_id || '';
        document.getElementById('aula').value = clase.aula || '';
        document.getElementById('cupo_maximo').value = clase.cupo_maximo || 30;
        document.getElementById('semestre').value = clase.semestre || '';
        document.getElementById('descripcion').value = clase.descripcion || '';
        
        resetScheduleInputs();
        if (clase.horarios && clase.horarios.length > 0) {
            clase.horarios.forEach(h => {
                const dayDiv = Array.from(document.querySelectorAll('.schedule-day')).find(div => {
                    const checkbox = div.querySelector('input[type="checkbox"]');
                    return checkbox && checkbox.value === h.dia;
                });
                
                if (dayDiv) {
                    const checkbox = dayDiv.querySelector('input[type="checkbox"]');
                    const startInput = dayDiv.querySelector('.time-start');
                    const endInput = dayDiv.querySelector('.time-end');
                    
                    checkbox.checked = true;
                    startInput.disabled = false;
                    endInput.disabled = false;
                    startInput.value = h.inicio.substring(0, 5);
                    endInput.value = h.fin.substring(0, 5);
                }
            });
        }
        
        hideFormMessage();
        modal.style.display = 'block';
    } catch (err) {
        console.error('Error cargando clase:', err);
        alert('Error al cargar los datos de la clase');
    }
}

// ========================================
// ELIMINAR CLASE
// ========================================
function attachDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const row = this.closest('tr');
            const nombre = row.querySelector('td:nth-child(2)').textContent;
            
            if (!confirm(`¿Estás seguro de eliminar la clase "${nombre}"?\n\nEsto también eliminará los horarios asignados. Esta acción no se puede deshacer.`)) {
                return;
            }
            
            try {
                const res = await fetch(`/api/clases/${id}`, { method: 'DELETE' });
                const result = await res.json();
                
                if (res.ok && result.ok) {
                    alert('Clase eliminada exitosamente');
                    fetchClases();
                } else {
                    alert(result.error || 'Error al eliminar la clase');
                }
            } catch (err) {
                console.error('Error eliminando clase:', err);
                alert('Error de conexión con el servidor');
            }
        });
    });
}

// ========================================
// ENVIAR FORMULARIO
// ========================================
if (classForm) {
    classForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = classForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
        hideFormMessage();
        
        const horarios = [];
        document.querySelectorAll('.schedule-day').forEach(day => {
            const checkbox = day.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                const timeStart = day.querySelector('.time-start').value;
                const timeEnd = day.querySelector('.time-end').value;
                
                if (!timeStart || !timeEnd) {
                    showFormMessage(`Por favor completa el horario de ${checkbox.value}`, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    return;
                }
                
                horarios.push({
                    dia: checkbox.value,
                    inicio: timeStart + ':00',
                    fin: timeEnd + ':00'
                });
            }
        });
        
        const formData = new FormData(classForm);
        // Obtener nombre de la materia seleccionada
        const materiaSel = document.getElementById('materia_id');
        const materiaOpt = materiaSel && materiaSel.options[materiaSel.selectedIndex];
        const materiaNombre = materiaOpt ? materiaOpt.textContent : '';
        // Validar selección de área y materia
        const areaSel = document.getElementById('area_id');
        const areaOpt = areaSel && areaSel.options[areaSel.selectedIndex];
        const areaNombre = areaOpt ? areaOpt.textContent : '';

        const data = {
            nombre: materiaNombre,
            codigo: formData.get('codigo'),
            profesor_id: formData.get('profesor_id') || null,
            aula: formData.get('aula') || null,
            cupo_maximo: parseInt(formData.get('cupo_maximo')) || 30,
            semestre: formData.get('semestre') || null,
            descripcion: formData.get('descripcion') || null,
            horarios: horarios
        };

        if (!areaNombre || !materiaNombre) {
            showFormMessage('Selecciona Área y Materia para la clase', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        
        if (!data.nombre || !data.codigo) {
            showFormMessage('Por favor completa los campos requeridos (Código y Materia)', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        
        if (!data.profesor_id) {
            showFormMessage('Por favor asigna un profesor a la clase', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        
        try {
            const claseId = document.getElementById('clase_id').value;
            const isEdit = claseId && claseId.trim() !== '';
            
            const url = isEdit ? `/api/clases/${claseId}` : '/api/clases';
            const method = isEdit ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            
            if (res.ok && result.ok) {
                showFormMessage(
                    isEdit ? '¡Clase actualizada! El profesor verá los cambios en su panel.' : '¡Clase guardada! El profesor verá la clase en su panel.', 
                    'success'
                );
                setTimeout(() => {
                    closeModal();
                    fetchClases();
                }, 1500);
            } else {
                showFormMessage(result.error || 'Error al guardar la clase', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (err) {
            console.error('Error:', err);
            showFormMessage('Error de conexión con el servidor', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

function showFormMessage(message, type) {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.style.display = 'block';
    formMessage.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
    formMessage.style.color = type === 'success' ? '#155724' : '#721c24';
    formMessage.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;
}

function hideFormMessage() {
    if (formMessage) {
        formMessage.style.display = 'none';
        formMessage.textContent = '';
    }
}

// ========================================
// BÚSQUEDA DE CLASES
// ========================================
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#clases-tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// ========================================
// DEPENDENCIAS: Área/Materia/Profesor
// ========================================
const areaSelect = document.getElementById('area_id');
if (areaSelect) {
    areaSelect.addEventListener('change', async () => {
        await loadMateriasByArea();
        // TEMPORAL: No filtrar profesores por área hasta que se corrijan las materias
        await loadProfesores();
    });
}

const materiaSelect = document.getElementById('materia_id');
if (materiaSelect) {
    materiaSelect.addEventListener('change', () => {
        // El nombre de la clase se toma del texto de la materia
    });
}

// ========================================
// CARGAR CLASES AL INICIAR
// ========================================
fetchClases();
