// Requiere sesión de administrador
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

// Actualizar la fecha en tiempo real
function updateDate() {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const today = new Date().toLocaleDateString('es-ES', options);
    document.querySelector('.date').textContent = today;
}

updateDate();

// Modal de nuevo/editar estudiante
const modal = document.getElementById('studentModal');
const newStudentBtn = document.getElementById('newStudentBtn');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.querySelector('.cancel-btn');
const studentForm = document.getElementById('studentForm');
const modalTitle = document.getElementById('modalTitle');

if (newStudentBtn && modal) {
    // Abrir modal para nuevo estudiante
    newStudentBtn.addEventListener('click', () => {
        openModal('new');
    });

    // Cerrar modal
    function closeModal() {
        modal.style.display = 'none';
        if (studentForm) studentForm.reset();
        document.getElementById('editMode').value = 'false';
        document.getElementById('studentId').value = '';
    }

    // Abrir modal (modo: 'new' o 'edit')
    function openModal(mode, studentData = null) {
        modal.style.display = 'block';
        
        if (mode === 'new') {
            modalTitle.textContent = 'Nuevo Estudiante';
            document.getElementById('editMode').value = 'false';
            if (studentForm) studentForm.reset();
        } else if (mode === 'edit' && studentData) {
            modalTitle.textContent = 'Editar Estudiante';
            document.getElementById('editMode').value = 'true';
            document.getElementById('studentId').value = studentData.id || '';
            
            // Función auxiliar para formatear fecha
            function formatDate(dateStr) {
                if (!dateStr) return '';
                // Si ya está en formato YYYY-MM-DD, retornar tal cual
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    return dateStr;
                }
                // Si es un objeto Date o timestamp, convertir
                try {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }
                } catch (e) {
                    console.error('Error formateando fecha:', e);
                }
                return '';
            }
            
            // Llenar el formulario con los datos del estudiante
            document.getElementById('matricula').value = studentData.matricula || '';
            document.getElementById('nombre').value = studentData.nombre || '';
            document.getElementById('curp').value = studentData.curp || '';
            document.getElementById('fecha_nacimiento').value = formatDate(studentData.fecha_nacimiento);
            document.getElementById('lugar_nacimiento').value = studentData.lugar_nacimiento || '';
            document.getElementById('correo').value = studentData.correo_institucional || '';
            document.getElementById('telefono').value = studentData.telefono || '';
            document.getElementById('grado').value = studentData.grado || '';
            document.getElementById('grupo').value = studentData.grupo || '';
            document.getElementById('carrera').value = studentData.carrera || '';
            document.getElementById('plan_estudios').value = studentData.plan_estudios || '';
            document.getElementById('especialidad').value = studentData.especialidad_academica || '';
            document.getElementById('tutor').value = studentData.tutor_academico || '';
            document.getElementById('promedio').value = studentData.promedio || '';
            document.getElementById('estado').value = studentData.estado || 'activo';
            
            // Log para debugging (puedes quitarlo después)
            console.log('Datos cargados en el formulario:', studentData);
        }
    }

    // Hacer la función openModal accesible globalmente
    window.openEditModal = openModal;

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Cerrar modal si se hace clic fuera de él
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Manejar envío del formulario: guardar o actualizar en backend
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isEditMode = document.getElementById('editMode').value === 'true';
            const studentId = document.getElementById('studentId').value;

            // Recopilar todos los datos del formulario
            const payload = {
                matricula: document.getElementById('matricula').value.trim(),
                nombre: document.getElementById('nombre').value.trim(),
                curp: document.getElementById('curp').value.trim() || null,
                fecha_nacimiento: document.getElementById('fecha_nacimiento').value || null,
                lugar_nacimiento: document.getElementById('lugar_nacimiento').value.trim() || null,
                correo_institucional: document.getElementById('correo').value.trim() || null,
                telefono: document.getElementById('telefono').value.trim() || null,
                grado: document.getElementById('grado').value,
                grupo: document.getElementById('grupo').value,
                carrera: document.getElementById('carrera').value.trim() || null,
                plan_estudios: document.getElementById('plan_estudios').value.trim() || null,
                especialidad_academica: document.getElementById('especialidad').value.trim() || null,
                tutor_academico: document.getElementById('tutor').value.trim() || null,
                promedio: document.getElementById('promedio').value ? parseFloat(document.getElementById('promedio').value) : null,
                estado: document.getElementById('estado').value || 'activo'
            };

            if (!payload.matricula || !payload.nombre || !payload.grado || !payload.grupo) {
                alert('Por favor completa los campos obligatorios: matrícula, nombre, grado y grupo');
                return;
            }

            try {
                let res;
                if (isEditMode && studentId) {
                    // Actualizar estudiante existente
                    res = await fetch(`/api/estudiantes/${studentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Crear nuevo estudiante
                    res = await fetch('/api/estudiantes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    alert(data.error || 'No se pudo guardar el estudiante');
                    return;
                }

                alert(isEditMode ? 'Estudiante actualizado exitosamente' : 'Estudiante guardado exitosamente');
                closeModal();
                
                // Recargar la lista de estudiantes
                fetchEstudiantes();
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });
    }
}

// Búsqueda y filtros combinados
const searchInput = document.querySelector('.search-bar input');
const studentsTableBody = document.getElementById('studentsBody') || document.querySelector('.students-table tbody');
const groupFiltersContainer = document.getElementById('groupFilters');
let originalRows = [];
let activeGroup = 'Todos';

function applyFilters() {
    if (!studentsTableBody) return;
    const term = (searchInput?.value || '').toLowerCase();
    const rows = originalRows.length ? originalRows : Array.from(studentsTableBody.rows);
    const filtered = rows.filter(row => {
        const matchesText = row.textContent.toLowerCase().includes(term);
        if (!matchesText) return false;
        if (activeGroup === 'Todos') return true;
        const groupCell = row.cells && row.cells[3] ? row.cells[3].textContent.trim() : '';
        return groupCell === activeGroup;
    });
    studentsTableBody.innerHTML = '';
    filtered.forEach(r => studentsTableBody.appendChild(r.cloneNode(true)));
}

if (searchInput && studentsTableBody) {
    searchInput.addEventListener('input', applyFilters);
}

// Obtener estudiantes desde la API
async function fetchEstudiantes() {
    try {
        const res = await fetch('/api/estudiantes');
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const tbody = document.querySelector('.students-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const gruposSet = new Set(['Todos']);
        data.forEach(e => {
            const tr = document.createElement('tr');
            tr.dataset.studentId = e.id;
            tr.innerHTML = `
                <td>${e.matricula}</td>
                <td>${e.nombre}</td>
                <td>${e.grado || '-'}</td>
                <td>${e.grupo || '-'}</td>
                <td>${e.promedio != null ? e.promedio : '-'}</td>
                <td><span class="status ${e.estado === 'activo' ? 'active' : 'inactive'}">${e.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="icon-btn edit-btn" title="Editar" data-id="${e.id}"><i class="fas fa-edit"></i></button>
                    <button class="icon-btn view-btn" title="Ver detalles" data-id="${e.id}"><i class="fas fa-file-alt"></i></button>
                    <button class="icon-btn delete-btn" title="Eliminar" data-id="${e.id}"><i class="fas fa-trash"></i></button>
                </td>`;
            tbody.appendChild(tr);
            if (e.grupo) gruposSet.add(String(e.grupo));
        });

    // Agregar event listeners a los botones de editar
    // No necesitamos volver a adjuntar listeners si usamos delegación
        
        // Actualizar el array de filas originales para el buscador
        originalRows = Array.from(tbody.rows);

        // Renderizar chips de grupos
        renderGroupChips(Array.from(gruposSet));
        applyFilters();
    } catch (err) {
        console.error('Error al cargar estudiantes:', err);
    }
}

function renderGroupChips(grupos) {
    if (!groupFiltersContainer) return;
    groupFiltersContainer.querySelectorAll('.group-chip').forEach(n => n.remove());
    grupos.forEach(gr => {
        const chip = document.createElement('span');
        chip.className = 'group-chip' + (gr === activeGroup ? ' active' : '');
        chip.textContent = gr;
        chip.addEventListener('click', () => {
            activeGroup = gr;
            groupFiltersContainer.querySelectorAll('.group-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            applyFilters();
        });
        groupFiltersContainer.appendChild(chip);
    });
}

// Adjuntar eventos a botones de editar
function attachEditButtons() {
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = btn.dataset.id;
            if (!studentId) return;
            
            try {
                // Obtener los datos completos del estudiante
                const res = await fetch(`/api/estudiantes/${studentId}`);
                if (!res.ok) {
                    alert('No se pudo obtener la información del estudiante');
                    return;
                }
                const studentData = await res.json();
                
                // Abrir modal en modo edición
                window.openEditModal('edit', studentData);
            } catch (err) {
                console.error('Error al cargar estudiante:', err);
                alert('Error al cargar la información del estudiante');
            }
        });
    });
}

// Adjuntar eventos a botones de eliminar
function attachDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = btn.dataset.id;
            if (!studentId) return;
            
            if (!confirm('¿Estás seguro de que deseas eliminar este estudiante? Esta acción no se puede deshacer.')) {
                return;
            }
            
            try {
                const res = await fetch(`/api/estudiantes/${studentId}`, {
                    method: 'DELETE'
                });
                
                if (!res.ok) {
                    alert('No se pudo eliminar el estudiante');
                    return;
                }
                
                alert('Estudiante eliminado exitosamente');
                fetchEstudiantes();
            } catch (err) {
                console.error('Error al eliminar estudiante:', err);
                alert('Error al eliminar el estudiante');
            }
        });
    });
}

fetchEstudiantes();

// Delegación de eventos para botones dinámicos
if (studentsTableBody) {
    studentsTableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('edit-btn')) {
            if (!id) return;
            try {
                const r = await fetch(`/api/estudiantes/${id}`);
                if (!r.ok) return alert('No se pudo cargar el estudiante');
                const data = await r.json();
                window.openEditModal('edit', data);
            } catch(err){ alert('Error de conexión'); }
        } else if (btn.classList.contains('delete-btn')) {
            if (!id) return;
            if (!confirm('¿Eliminar estudiante?')) return;
            try {
                const r = await fetch(`/api/estudiantes/${id}`, { method: 'DELETE' });
                if (!r.ok) return alert('No se pudo eliminar');
                fetchEstudiantes();
            } catch(err){ alert('Error de conexión'); }
        } else if (btn.classList.contains('view-btn')) {
            if (!id) return;
            abrirModalDocumentos(id);
        }
    });
}

function abrirModalDocumentos(estudianteId){
    const docsModal = document.getElementById('docsModal');
    const docsList = document.getElementById('docsList');
    const closeDocsBtn = document.querySelector('.close-docs-btn');
    if (!docsModal || !docsList) return;
    docsModal.style.display='block';
    docsList.innerHTML='<div class="muted">Cargando documentos...</div>';
    if (closeDocsBtn && !closeDocsBtn.dataset.bound){
        closeDocsBtn.addEventListener('click', ()=> docsModal.style.display='none');
        closeDocsBtn.dataset.bound='1';
    }
    window.addEventListener('click', (ev)=>{ if (ev.target===docsModal) docsModal.style.display='none'; });
    fetch(`/api/estudiantes/${estudianteId}/documentos`).then(r=>r.json()).then(data=>{
        const docs=(data.documentos)||[];
        if(!docs.length){ docsList.innerHTML='<div class="muted">Sin documentos.</div>'; return; }
        docsList.innerHTML='';
        docs.forEach(d=>{
            const nombre = d.nombre_original || (d.archivo_url ? d.archivo_url.split('/').pop() : 'archivo');
            const row=document.createElement('div');
            row.className='document-item d-flex align-items-center p-2';
            row.innerHTML=`<i class="fas fa-file-alt text-primary me-2"></i>
                <div class="flex-grow-1">
                    <div><strong>${d.tipo||'Documento'}</strong></div>
                    <small class="text-muted">${nombre} · ${d.creado_at? new Date(d.creado_at).toLocaleString():''}</small>
                </div>
                <div class="btn-group">
                    <a class="btn btn-sm" href="${d.archivo_url}" target="_blank" title="Ver/Descargar"><i class="fas fa-download"></i></a>
                </div>`;
            docsList.appendChild(row);
        });
    }).catch(()=>{ docsList.innerHTML='<div class="text-danger">Error al cargar documentos</div>'; });
}

// Paginación
const pageNumbers = document.querySelectorAll('.page-number');
pageNumbers.forEach(number => {
    number.addEventListener('click', () => {
        pageNumbers.forEach(num => num.classList.remove('active'));
        number.classList.add('active');
    });
});

// Ver documentos del estudiante
function attachViewButtons(){
    const viewButtons = document.querySelectorAll('.view-btn');
    const docsModal = document.getElementById('docsModal');
    const closeDocsBtn = document.querySelector('.close-docs-btn');
    const docsList = document.getElementById('docsList');
    function close(){ if (docsModal) docsModal.style.display = 'none'; }
    if (closeDocsBtn) closeDocsBtn.addEventListener('click', close);
    window.addEventListener('click', (e) => { if (e.target === docsModal) close(); });
    viewButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!id || !docsModal || !docsList) return;
            docsModal.style.display = 'block';
            docsList.innerHTML = '<div class="muted">Cargando documentos...</div>';
            try {
                const r = await fetch(`/api/estudiantes/${id}/documentos`);
                const data = await r.json().catch(()=>({}));
                const docs = data.documentos || [];
                if (!docs.length) {
                    docsList.innerHTML = '<div class="muted">Sin documentos registrados.</div>';
                } else {
                    docsList.innerHTML = '';
                    docs.forEach(d => {
                        const row = document.createElement('div');
                        row.className = 'document-item d-flex align-items-center p-2';
                        row.innerHTML = `
                          <i class="fas fa-file-alt text-primary me-2"></i>
                          <div class="flex-grow-1">
                            <div><strong>${d.tipo || 'Documento'}</strong></div>
                            <small class="text-muted">${d.creado_at ? new Date(d.creado_at).toLocaleString() : ''}</small>
                          </div>
                          <div class="btn-group">
                            <a class="btn btn-sm" href="${d.archivo_url}" target="_blank" title="Ver/Descargar"><i class="fas fa-download"></i></a>
                          </div>`;
                        docsList.appendChild(row);
                    });
                }
            } catch (e) {
                docsList.innerHTML = '<div class="text-danger">Error al cargar documentos</div>';
            }
        });
    });
}

// --- Overrides para mejorar manejo de respuesta y mostrar nombres de documentos ---
(function overrideStudentsFunctions(){
    try {
        const originalFetch = fetchEstudiantes;
    } catch(_) {}
    // Redefinir fetchEstudiantes con soporte de objeto { ok, estudiantes }
    fetchEstudiantes = async function(){
        try {
            const res = await fetch('/api/estudiantes');
            if (!res.ok) return;
            const raw = await res.json();
            const data = Array.isArray(raw) ? raw : (Array.isArray(raw.estudiantes) ? raw.estudiantes : []);
            const tbody = document.querySelector('.students-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            const gruposSet = new Set(['Todos']);
            data.forEach(e => {
                const tr = document.createElement('tr');
                tr.dataset.studentId = e.id;
                tr.innerHTML = `
                    <td>${e.matricula}</td>
                    <td>${e.nombre}</td>
                    <td>${e.grado || '-'}</td>
                    <td>${e.grupo || '-'}</td>
                    <td>${e.promedio != null ? e.promedio : '-'}</td>
                    <td><span class="status ${e.estado === 'activo' ? 'active' : 'inactive'}">${e.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="icon-btn edit-btn" title="Editar" data-id="${e.id}"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn view-btn" title="Ver documentos" data-id="${e.id}"><i class="fas fa-file-alt"></i></button>
                        <button class="icon-btn delete-btn" title="Eliminar" data-id="${e.id}"><i class="fas fa-trash"></i></button>
                    </td>`;
                tbody.appendChild(tr);
                if (e.grupo) gruposSet.add(String(e.grupo));
            });
            attachEditButtons();
            attachDeleteButtons();
            attachViewButtons();
            originalRows = Array.from(tbody.rows);
            renderGroupChips(Array.from(gruposSet));
            applyFilters();
        } catch(err){ console.error('Error al cargar estudiantes (override):', err); }
    };
    // Redefinir attachViewButtons para mostrar nombre_original
    attachViewButtons = function(){
        const viewButtons = document.querySelectorAll('.view-btn');
        const docsModal = document.getElementById('docsModal');
        const closeDocsBtn = document.querySelector('.close-docs-btn');
        const docsList = document.getElementById('docsList');
        function close(){ if (docsModal) docsModal.style.display = 'none'; }
        if (closeDocsBtn && !closeDocsBtn.dataset.overrideBound){ closeDocsBtn.addEventListener('click', close); closeDocsBtn.dataset.overrideBound='1'; }
        window.addEventListener('click', (e) => { if (e.target === docsModal) close(); });
        viewButtons.forEach(btn => {
            if (btn.dataset.overrideBound) return;
            btn.dataset.overrideBound='1';
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!id || !docsModal || !docsList) return;
                docsModal.style.display = 'block';
                docsList.innerHTML = '<div class="muted">Cargando documentos...</div>';
                try {
                    const r = await fetch(`/api/estudiantes/${id}/documentos`);
                    const data = await r.json().catch(()=>({}));
                    const docs = data.documentos || [];
                    if (!docs.length) {
                        docsList.innerHTML = '<div class="muted">Sin documentos registrados.</div>';
                    } else {
                        docsList.innerHTML = '';
                        docs.forEach(d => {
                            const nombre = d.nombre_original || (d.archivo_url ? d.archivo_url.split('/').pop() : 'archivo');
                            const row = document.createElement('div');
                            row.className = 'document-item d-flex align-items-center p-2';
                            row.innerHTML = `
                                <i class="fas fa-file-alt text-primary me-2"></i>
                                <div class="flex-grow-1">
                                    <div><strong>${d.tipo || 'Documento'}</strong></div>
                                    <small class="text-muted">${nombre} · ${d.creado_at ? new Date(d.creado_at).toLocaleString() : ''}</small>
                                </div>
                                <div class="btn-group">
                                    <a class="btn btn-sm" href="${d.archivo_url}" target="_blank" title="Ver/Descargar"><i class="fas fa-download"></i></a>
                                </div>`;
                            docsList.appendChild(row);
                        });
                    }
                } catch(e){ docsList.innerHTML = '<div class="text-danger">Error al cargar documentos</div>'; }
            });
        });
    };
    // Ejecutar nuevamente para aplicar overrides
    fetchEstudiantes();
})();