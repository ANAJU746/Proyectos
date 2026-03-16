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
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const today = new Date().toLocaleDateString('es-ES', options);
    const dateEl = document.querySelector('.date');
    if (dateEl) dateEl.textContent = today;
}

updateDate();

// ========================================
// OBTENER Y RENDERIZAR PROFESORES
// ========================================
async function fetchProfesores() {
    try {
        const res = await fetch('/api/profesores');
        if (!res.ok) {
            throw new Error('Error al cargar profesores');
        }
        const profesores = await res.json();
        renderProfesoresTable(profesores);
    } catch (err) {
        console.error('Error fetching profesores:', err);
        const tbody = document.getElementById('profesores-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        Error al cargar profesores. Por favor, intenta de nuevo.
                    </td>
                </tr>
            `;
        }
    }
}

function renderProfesoresTable(profesores) {
    const tbody = document.getElementById('profesores-tbody');
    if (!tbody) return;
    
    if (!profesores || profesores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    No hay profesores registrados. Haz clic en "Nuevo Profesor" para agregar uno.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = profesores.map(prof => `
        <tr data-id="${prof.id}">
            <td>${escapeHtml(prof.codigo_profesor || 'N/A')}</td>
            <td>${escapeHtml(prof.nombre)}</td>
            <td>${escapeHtml(prof.correo || 'N/A')}</td>
            <td>${escapeHtml(prof.departamento || 'N/A')}</td>
            <td>${escapeHtml(prof.especialidad || 'N/A')}</td>
            <td>${escapeHtml(prof.grado_academico || 'N/A')}</td>
            <td>
                <span class="status ${prof.estado === 'activo' ? 'active' : 'inactive'}">
                    ${prof.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <div style="display:flex; gap:0.5rem; justify-content: center;">
                    <button class="icon-btn edit-btn" data-id="${prof.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete-btn" data-id="${prof.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Agregar event listeners para botones de editar y eliminar
    attachEditButtons();
    attachDeleteButtons();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// EDITAR PROFESOR
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
        const res = await fetch(`/api/profesores/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el profesor');
        
        const profesor = await res.json();
        
        // Cambiar título del modal
        const modalHeader = document.querySelector('#teacherModal .modal-header h3');
        if (modalHeader) modalHeader.textContent = 'Editar Profesor';
        
        // Llenar el formulario
        document.getElementById('profesor_id').value = profesor.id;
        document.getElementById('codigo_profesor').value = profesor.codigo_profesor || '';
        document.getElementById('nombre').value = profesor.nombre || '';
        document.getElementById('correo').value = profesor.correo || '';
        document.getElementById('telefono').value = profesor.telefono || '';
        document.getElementById('departamento').value = profesor.departamento || '';
        // Cargar áreas y materias para selects dependientes
        await cargarAreasYMaterias();
        document.getElementById('area').value = profesor.especialidad || '';
        document.getElementById('grado_academico').value = profesor.grado_academico || '';
        await cargarMateriasPorArea(profesor.especialidad || '');
        document.getElementById('materia').value = profesor.materia || '';
        document.getElementById('estado').value = profesor.estado || 'activo';
        
        // Cambiar texto del botón
        const submitBtn = teacherForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Actualizar Profesor';
        
        // Mostrar modal
        modal.style.display = 'block';
    } catch (err) {
        console.error('Error cargando profesor:', err);
        alert('Error al cargar los datos del profesor');
    }
}

// ========================================
// ELIMINAR PROFESOR
// ========================================
function attachDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const row = this.closest('tr');
            const nombre = row.querySelector('td:nth-child(2)').textContent;
            
            if (!confirm(`¿Estás seguro de eliminar al profesor "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
                return;
            }
            
            try {
                const res = await fetch(`/api/profesores/${id}`, {
                    method: 'DELETE'
                });
                
                const result = await res.json();
                
                if (res.ok && result.ok) {
                    alert('Profesor eliminado exitosamente');
                    fetchProfesores(); // Recargar tabla
                } else {
                    alert(result.error || 'Error al eliminar el profesor');
                }
            } catch (err) {
                console.error('Error eliminando profesor:', err);
                alert('Error de conexión con el servidor');
            }
        });
    });
}

// ========================================
// MODAL PARA NUEVO PROFESOR
// ========================================
const modal = document.getElementById('teacherModal');
const newTeacherBtn = document.getElementById('newTeacherBtn');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.querySelector('.cancel-btn');
const teacherForm = document.getElementById('teacherForm');
const formMessage = document.getElementById('form-message');

if (newTeacherBtn && modal) {
    newTeacherBtn.addEventListener('click', () => {
        // Resetear el modal para nuevo profesor
        const modalHeader = document.querySelector('#teacherModal .modal-header h3');
        if (modalHeader) modalHeader.textContent = 'Nuevo Profesor';
        
        const submitBtn = teacherForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Guardar Profesor';
        
        modal.style.display = 'block';
        if (teacherForm) teacherForm.reset();
        document.getElementById('profesor_id').value = ''; // Limpiar ID
        hideFormMessage();
        cargarAreasYMaterias();
    });

    function closeModal() {
        modal.style.display = 'none';
        if (teacherForm) teacherForm.reset();
        hideFormMessage();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // ========================================
    // ENVIAR FORMULARIO
    // ========================================
    if (teacherForm) {
        teacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = teacherForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';
            hideFormMessage();
            
            // Recopilar datos del formulario
            const formData = new FormData(teacherForm);
            const data = {};
            formData.forEach((value, key) => {
                if (value.trim() !== '') {
                    data[key] = value.trim();
                }
            });

            // Mapear selects al modelo esperado por backend
            if (data.area) {
                data.especialidad = data.area; // usar nombre del área como especialidad
                delete data.area;
            }
            
            // Validar campos requeridos
            if (!data.codigo_profesor || !data.nombre) {
                showFormMessage('Por favor completa los campos requeridos (Código y Nombre)', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
            
            try {
                const profesorId = document.getElementById('profesor_id').value;
                const isEdit = profesorId && profesorId.trim() !== '';
                
                const url = isEdit ? `/api/profesores/${profesorId}` : '/api/profesores';
                const method = isEdit ? 'PUT' : 'POST';
                
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok && result.ok) {
                    showFormMessage(isEdit ? '¡Profesor actualizado exitosamente!' : '¡Profesor guardado exitosamente!', 'success');
                    setTimeout(() => {
                        closeModal();
                        fetchProfesores(); // Recargar la tabla
                    }, 1500);
                } else {
                    showFormMessage(result.error || 'Error al guardar el profesor', 'error');
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
// BÚSQUEDA DE PROFESORES
// ========================================
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#profesores-tbody tr');
        
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
// PAGINACIÓN (placeholder)
// ========================================
const pageNumbers = document.querySelectorAll('.page-number');
pageNumbers.forEach(number => {
    number.addEventListener('click', () => {
        pageNumbers.forEach(num => num.classList.remove('active'));
        number.classList.add('active');
    });
});

// ========================================
// CARGAR PROFESORES AL INICIAR
// ========================================
fetchProfesores();

// ====== ÁREAS Y MATERIAS (Selects dependientes) ======
async function cargarAreasYMaterias(){
    try {
        const res = await fetch('/api/areas');
        const data = await res.json();
        const selArea = document.getElementById('area');
        if (selArea && data.ok && Array.isArray(data.areas)){
            selArea.innerHTML = '<option value="">Selecciona un área...</option>';
            data.areas.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.nombre;
                opt.textContent = a.nombre;
                selArea.appendChild(opt);
            });
            selArea.onchange = async function(){
                await cargarMateriasPorArea(this.value);
            };
        }
    } catch(err){ console.error('Error cargando áreas:', err); }
}

async function cargarMateriasPorArea(areaNombre){
    try {
        const res = await fetch('/api/materias-catalogo?area=' + encodeURIComponent(areaNombre||''));
        const data = await res.json();
        const selMat = document.getElementById('materia');
        if (selMat){
            selMat.innerHTML = '<option value="">Selecciona materia según área...</option>';
            if (data.ok && Array.isArray(data.materias)){
                data.materias.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.nombre; // usamos nombre como valor
                    opt.textContent = `${m.nombre} (${m.codigo||'s/c'})`;
                    selMat.appendChild(opt);
                });
            }
        }
    } catch(err){ console.error('Error cargando materias:', err); }
}

// ========================================
// ENVÍO DE MENSAJES A PROFESORES (ADMIN)
// ========================================
const sendMsgBtn = document.getElementById('sendMessageTeachersBtn');
const msgModal = document.getElementById('adminTeachersMessageModal');
const closeMsgBtn = document.getElementById('closeAdminTeachersMsg');
const cancelMsgBtn = document.getElementById('cancelAdminTeachersMsg');
const msgForm = document.getElementById('adminTeachersMsgForm');
const profesoresChecksWrap = document.getElementById('profesoresChecks');
const loadingProfesSel = document.getElementById('loadingProfesSel');
const feedbackEl = document.getElementById('adminTeachersMsgFeedback');

function toggleMsgModal(show){
    if (!msgModal) return;
    msgModal.style.display = show ? 'block' : 'none';
    if (show) { loadProfesSeleccion(); }
    if (!show && msgForm) msgForm.reset();
    if (feedbackEl){ feedbackEl.style.display='none'; feedbackEl.textContent=''; }
}

sendMsgBtn && sendMsgBtn.addEventListener('click', ()=> toggleMsgModal(true));
closeMsgBtn && closeMsgBtn.addEventListener('click', ()=> toggleMsgModal(false));
cancelMsgBtn && cancelMsgBtn.addEventListener('click', ()=> toggleMsgModal(false));
window.addEventListener('click', e=>{ if(e.target===msgModal) toggleMsgModal(false); });

// Mostrar/ocultar selección manual
msgForm && msgForm.querySelectorAll('input[name="destinoProf"]').forEach(radio => {
    radio.addEventListener('change', ()=>{
        const cont = document.getElementById('profesoresSeleccion');
        if (!cont) return;
        const val = msgForm.querySelector('input[name="destinoProf"]:checked').value;
        cont.style.display = val === 'seleccion' ? 'block' : 'none';
    });
});

async function loadProfesSeleccion(){
    try {
        if (!loadingProfesSel || !profesoresChecksWrap) return;
        loadingProfesSel.style.display = 'block';
        profesoresChecksWrap.style.display = 'none';
        const res = await fetch('/api/profesores');
        if (!res.ok) throw new Error('HTTP '+res.status);
        const list = await res.json();
        profesoresChecksWrap.innerHTML = '';
        if (!Array.isArray(list) || list.length===0){
            profesoresChecksWrap.innerHTML = '<div class="muted">No hay profesores activos.</div>';
        } else {
            list.forEach(p => {
                const id = p.id;
                const div = document.createElement('div');
                div.style.marginBottom = '4px';
                div.innerHTML = `<label style="font-size:.85rem; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" class="prof-check" value="${id}">
                    <span>${escapeHtml(p.nombre)} (${escapeHtml(p.codigo_profesor||'')})</span>
                </label>`;
                profesoresChecksWrap.appendChild(div);
            });
        }
        loadingProfesSel.style.display = 'none';
        profesoresChecksWrap.style.display = 'block';
    } catch (err) {
        console.error('Error cargando profesores selección:', err);
        if (loadingProfesSel) loadingProfesSel.textContent = 'Error cargando profesores';
    }
}

msgForm && msgForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const titulo = document.getElementById('msgTitulo').value.trim();
    const contenido = document.getElementById('msgContenido').value.trim();
    const destino = msgForm.querySelector('input[name="destinoProf"]:checked').value;
    if (!titulo || !contenido){
        showFeedback('Completa título y contenido', false); return;
    }
    let profesor_ids = [];
    if (destino === 'todos') {
        // obtener todos los profesores (reutilizar fetch ya hecho si se desea)
        try {
            const res = await fetch('/api/profesores');
            const all = await res.json();
            profesor_ids = Array.isArray(all) ? all.map(p=>p.id) : [];
        } catch(_) { showFeedback('No se pudo cargar lista de profesores', false); return; }
    } else {
        profesor_ids = Array.from(document.querySelectorAll('.prof-check:checked')).map(ch => Number(ch.value));
        if (profesor_ids.length === 0){ showFeedback('Selecciona al menos un profesor', false); return; }
    }
    try {
        // admin_id opcional: tomar de sesión si existe
        let admin_id = null;
        try { const u = JSON.parse(sessionStorage.getItem('user')||'{}'); if (u && u.id) admin_id = u.id; } catch(_) {}
        const resp = await fetch('/api/admin/mensajes-profesores', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ admin_id, profesor_ids, titulo, contenido })
        });
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Error al enviar');
        showFeedback('Mensaje enviado correctamente', true);
        msgForm.reset();
        // Ocultar selección si se vuelve a abrir
        const cont = document.getElementById('profesoresSeleccion'); if (cont) cont.style.display='none';
        setTimeout(()=> toggleMsgModal(false), 1200);
    } catch (err) {
        console.error('Error enviando mensaje a profesores:', err);
        showFeedback(err.message || 'Error al enviar', false);
    }
});

function showFeedback(msg, ok){
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.style.display = 'block';
    feedbackEl.style.background = ok ? '#e3fcef' : '#fdecea';
    feedbackEl.style.color = ok ? '#055d20' : '#611a15';
    feedbackEl.style.border = '1px solid '+ (ok ? '#b7e4c7' : '#f5c2c0');
}