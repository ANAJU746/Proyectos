// ========================================
// PROTECCIÓN: Solo profesores
// ========================================
(function requireProfesor(){
    try {
        const u = JSON.parse(sessionStorage.getItem('user'));
        if (!u || u.role !== 'maestro') {
            window.location.href = '/Pagina1/index.html';
        }
    } catch (_) {
        window.location.href = '/Pagina1/index.html';
    }
})();

// Panel del Maestro - Conectado a la API
let state = { profesor: null, clases: [], clasesAgrupadas: [], estudiantesClase: [], cargandoEstudiantes: false, preguntas: [], mensajesAdmin: [], vista: 'clases', subVistaMensajes: 'estudiantes' }

// helpers
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8)

// DOM refs
const groupsList = document.getElementById('groupsList')
const groupTitle = document.getElementById('groupTitle')
const panelBody = document.getElementById('panelBody')
const welcomeText = document.getElementById('welcomeText')
const logoutBtn = document.getElementById('logoutBtn')
const downloadPdfBtn = document.getElementById('downloadPdfBtn')
const downloadExcelBtn = document.getElementById('downloadExcelBtn')
// tabs mensajes
const studentMsgsTab = document.getElementById('showStudentMessagesBtn')
const adminMsgsTab = document.getElementById('showAdminMessagesBtn')
const badgeStudent = document.getElementById('badgeStudentMsgs')
const badgeAdmin = document.getElementById('badgeAdminMsgs')
const refreshMessagesBtn = document.getElementById('refreshMessagesBtn')
const teacherAvatar = document.getElementById('teacherAvatar')
const teacherProfileImage = document.getElementById('teacherProfileImage')
const teacherPhotoInput = document.getElementById('teacherPhotoInput')

let activeClaseId = null
let groupsPanelOpen = false

async function init(){
  console.log('🚀 Inicializando panel del profesor...');
  
  // Obtener datos del usuario
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user || !user.id) {
    console.error('❌ No hay usuario en sesión');
    window.location.href = '/Pagina1/index.html';
    return;
  }
  
  console.log('👤 Usuario:', user);
  
  // Cargar datos del profesor
  await loadProfesorData(user.id);

  // Cargar/mostrar foto de perfil del profesor
  setupTeacherPhotoUI(user);
  
  // Actualizar mensaje de bienvenida
  if (state.profesor && welcomeText) {
    welcomeText.textContent = `Bienvenido, ${state.profesor.nombre}`;
  }
  
  renderAll();
  bind();                                                                                                   
}
function setupTeacherPhotoUI(user){
  try {
    // Inicial: preferir foto desde BD (state.profesor.foto_url), si no, sessionStorage
    const u = JSON.parse(sessionStorage.getItem('user')||'{}');
    const dbFoto = (state.profesor && state.profesor.foto_url) ? state.profesor.foto_url : null;
    const ssFoto = (u && u.foto_url) ? u.foto_url : null;
    const baseSrc = dbFoto || ssFoto;
    const src = baseSrc ? (baseSrc + '?t=' + Date.now()) : 'https://via.placeholder.com/120';
    if (teacherProfileImage) teacherProfileImage.src = src;
    // Sync de la imagen lateral si existe
    const sideImg = document.getElementById('teacherProfileImageSide');
    if (sideImg) sideImg.src = baseSrc ? (baseSrc + '?t=' + Date.now()) : 'https://via.placeholder.com/110';

    if (teacherAvatar && teacherPhotoInput) {
      teacherAvatar.addEventListener('click', ()=> teacherPhotoInput.click());
      teacherPhotoInput.addEventListener('change', async (e)=>{
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        // Validaciones
        if (!file.type.startsWith('image/')) {
          alert('Selecciona una imagen válida');
          return;
        }
        const maxMB = 5;
        if (file.size > maxMB*1024*1024) {
          alert('La imagen es muy pesada (máx '+maxMB+' MB)');
          return;
        }
        // Restringir a formatos soportados por el servidor (JPG, PNG, WEBP)
        const allowed = new Set(['image/jpeg','image/jpg','image/png','image/webp']);
        if (!allowed.has(file.type.toLowerCase())) {
          alert('Formato no soportado. Usa JPG, PNG o WEBP.');
          return;
        }
        // Preview local rápida
        const reader = new FileReader();
        reader.onload = () => {
          if (teacherProfileImage) teacherProfileImage.src = reader.result;
        }
        reader.readAsDataURL(file);

        try {
          const ok = await uploadTeacherPhoto(user.id, file);
          if (ok) {
            // Refrescar desde respuesta del servidor actualizada en sessionStorage dentro de upload
            // Sincronizar state.profesor
            if (state.profesor) {
              const curr = JSON.parse(sessionStorage.getItem('user')||'{}');
              if (curr && curr.foto_url) state.profesor.foto_url = curr.foto_url;
            }
          }
        } catch (err) {
          console.error('Error subiendo foto del maestro:', err);
          alert('No se pudo subir la foto: '+ err.message);
        }
      });
    }
  } catch (e) {
    console.warn('No se pudo inicializar UI de foto de maestro', e);
  }
}

async function uploadTeacherPhoto(profesorId, file){
  const formData = new FormData();
  formData.append('foto', file);
  const res = await fetch(`/api/profesores/${profesorId}/foto`, { method: 'POST', body: formData });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || ('HTTP '+res.status));
  }
  if (data.foto_url) {
    // Actualizar imagen con cache-bust
    if (teacherProfileImage) teacherProfileImage.src = data.foto_url + '?t=' + Date.now();
    // Persistir en sessionStorage
    try {
      const curr = JSON.parse(sessionStorage.getItem('user')||'{}');
      curr.foto_url = data.foto_url;
      sessionStorage.setItem('user', JSON.stringify(curr));
    } catch (_) {}
  }
  return true;
}

async function loadProfesorData(profesorId) {
  try {
    console.log('📥 Cargando datos del profesor ID:', profesorId);
    
    // Cargar información del profesor
    const profRes = await fetch(`/api/profesores/${profesorId}`);
    if (profRes.ok) {
      state.profesor = await profRes.json();
      console.log('✅ Datos del profesor cargados:', state.profesor);
    }
    
    // Cargar clases del profesor
    const clasesRes = await fetch(`/api/profesores/${profesorId}/clases`);
    if (clasesRes.ok) {
      const data = await clasesRes.json();
      state.clases = data.clases || [];
      console.log('✅ Clases cargadas:', state.clases.length);
      
      // Agrupar clases por nombre (pueden tener múltiples horarios)
      await agruparClases();
    }
  } catch (err) {
    console.error('❌ Error cargando datos del profesor:', err);
  }
}

async function agruparClases() {
  const agrupadas = {};
  state.clases.forEach(clase => {
    if (!agrupadas[clase.nombre]) {
      agrupadas[clase.nombre] = {
        id: clase.id,
        nombre: clase.nombre,
        codigo: clase.codigo,
        aula: clase.aula,
        semestre: clase.semestre,
        cupo_maximo: clase.cupo_maximo || null,
        total_estudiantes: clase.total_estudiantes,
        horarios: []
      };
    }
    if (clase.dia && clase.inicio && clase.fin) {
      agrupadas[clase.nombre].horarios.push({
        dia: clase.dia,
        inicio: clase.inicio,
        fin: clase.fin
      });
    }
  });
  state.clasesAgrupadas = Object.values(agrupadas);
  
  // Cargar conteo de inscritos para cada clase
  await Promise.all(
    state.clasesAgrupadas.map(async (clase) => {
      try {
        const res = await fetch(`/api/clases/${clase.id}/estudiantes`);
        if (res.ok) {
          const data = await res.json();
          clase.inscritos = (data.estudiantes || []).length;
        }
      } catch (err) {
        console.error(`Error cargando inscritos para clase ${clase.id}:`, err);
      }
    })
  );
  
  console.log('📚 Clases agrupadas con conteo de inscritos:', state.clasesAgrupadas);
}

function bind(){
  const exportPdfBtn = document.getElementById('exportPdf');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', onExportPdf);
  
  const showGroupsBtn = document.getElementById('showGroupsBtn');
  if (showGroupsBtn) showGroupsBtn.addEventListener('click', ()=>{
    state.vista = 'clases';
    updateRefreshVisibility();
    toggleGroupsView();
  });
  if (studentMsgsTab) studentMsgsTab.addEventListener('click', async () => {
    state.vista = 'mensajes';
    state.subVistaMensajes = 'estudiantes';
    updateTabsUI();
    updateRefreshVisibility();
    await loadPreguntas();
    renderMessages();
  });
  if (adminMsgsTab) adminMsgsTab.addEventListener('click', async () => {
    state.vista = 'mensajes';
    state.subVistaMensajes = 'admin';
    updateTabsUI();
    updateRefreshVisibility();
    await loadMensajesAdmin();
    renderMessages();
  });
  if (refreshMessagesBtn) refreshMessagesBtn.addEventListener('click', async () => {
    if (state.vista !== 'mensajes') return;
    if (state.subVistaMensajes === 'estudiantes') {
      await loadPreguntas();
    } else {
      await loadMensajesAdmin();
    }
    renderMessages();
  });
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      window.location.href = '/Pagina1/index.html';
    });
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      if (!activeClaseId) return;
      const clase = state.clasesAgrupadas.find(c => c.id === activeClaseId);
      if (!clase) return;
      exportRosterPdf(clase, state.estudiantesClase || []);
    });
  }
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener('click', () => {
      if (!activeClaseId) return;
      const clase = state.clasesAgrupadas.find(c => c.id === activeClaseId);
      if (!clase) return;
      exportRosterExcel(clase, state.estudiantesClase || []);
    });
  }
}

// Las clases son asignadas por el administrador, no se pueden crear/editar desde aquí

// Renderers
function renderAll(){
  if (state.vista === 'mensajes') {
    renderMessages();
  } else {
    renderClases();
    renderPanel();
  }
  updateRefreshVisibility();
  // Mostrar nombre en barra lateral si existe
  const sideName = document.getElementById('teacherNameSide');
  if (sideName && state.profesor && state.profesor.nombre) sideName.textContent = state.profesor.nombre;
}

function renderClases(){
  groupsList.innerHTML = '';
  
  if (!state.clasesAgrupadas || state.clasesAgrupadas.length === 0) {
    groupsList.innerHTML = '<div class="muted" style="padding: 1rem;">No tienes clases asignadas aún. Contacta al administrador.</div>';
    return;
  }
  
  state.clasesAgrupadas.forEach(clase => {
    const container = document.createElement('div');
    container.className = 'accordion-item';
    
    const header = document.createElement('div');
    header.className = 'accordion-header';
    
    // Obtener conteo de inscritos (se carga dinámicamente)
    let inscritosInfo = '';
    if (clase.inscritos !== undefined && clase.cupo_maximo) {
      const color = clase.inscritos >= clase.cupo_maximo ? '#dc3545' : (clase.inscritos >= clase.cupo_maximo * 0.8 ? '#ffc107' : '#28a745');
      inscritosInfo = `<span style="color:${color}; font-weight:600;">${clase.inscritos}/${clase.cupo_maximo} inscritos</span>`;
    } else if (clase.total_estudiantes) {
      inscritosInfo = `${clase.total_estudiantes} estudiantes`;
    } else {
      inscritosInfo = '0 estudiantes';
    }
    
    header.innerHTML = `
      <div>
        <span class="name">${escapeHtml(clase.nombre)}</span>
        <small style="display:block; color:#666; font-size:0.85em;">${escapeHtml(clase.codigo || '')} - ${inscritosInfo}</small>
      </div>
    `;
    
    const body = document.createElement('div');
    body.className = 'accordion-body';
    
    // Mostrar horarios
    if (clase.horarios && clase.horarios.length > 0) {
      let horariosHTML = '<div style="margin-bottom: 0.5rem;"><strong>Horarios:</strong></div><ul style="margin:0; padding-left: 1.5rem;">';
      clase.horarios.forEach(h => {
        horariosHTML += `<li>${escapeHtml(h.dia)}: ${escapeHtml(h.inicio)} - ${escapeHtml(h.fin)}</li>`;
      });
      horariosHTML += '</ul>';
      body.innerHTML = horariosHTML;
    } else {
      body.innerHTML = '<div class="muted">Sin horario asignado</div>';
    }
    
    // Mostrar aula
    if (clase.aula) {
      body.innerHTML += `<div style="margin-top: 0.5rem;"><strong>Aula:</strong> ${escapeHtml(clase.aula)}</div>`;
    }
    
    container.appendChild(header);
    container.appendChild(body);
    
    // evento click
    header.addEventListener('click', () => {
      const open = container.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(x => x.classList.remove('open'));
      if (!open) {
        container.classList.add('open');
        activeClaseId = clase.id;
        renderPanel();
        // Cargar estudiantes de la clase seleccionada
        loadEstudiantesClase(activeClaseId);
      } else {
        container.classList.remove('open');
        activeClaseId = null;
        renderPanel();
      }
    });
    
    groupsList.appendChild(container);
  });
}

// alterna la vista de clases: abre o cierra todos los acordeones
function toggleGroupsView(){
  const items = Array.from(document.querySelectorAll('.accordion-item'));
  if (items.length === 0) return;
  
  if (!groupsPanelOpen) {
    // abrir todos y seleccionar la primera
    items.forEach(it => it.classList.add('open'));
    const firstClase = state.clasesAgrupadas[0];
    if (firstClase) activeClaseId = firstClase.id;
    groupsPanelOpen = true;
    document.getElementById('showGroupsBtn').textContent = 'Ocultar clases';
  } else {
    items.forEach(it => it.classList.remove('open'));
    activeClaseId = null;
    groupsPanelOpen = false;
    document.getElementById('showGroupsBtn').textContent = 'Mis Clases';
  }
  renderPanel();
}

// Exportar a PDF (usa jsPDF cargado desde CDN)
function onExportPdf(){
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return alert('jsPDF no cargado');
  
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 40;
  
  const profesorNombre = state.profesor ? state.profesor.nombre : 'Profesor';
  doc.setFontSize(16);
  doc.text(`Clases de ${profesorNombre}`, 40, y);
  y += 30;
  
  if (!state.clasesAgrupadas || state.clasesAgrupadas.length === 0) {
    doc.setFontSize(10);
    doc.text('No hay clases asignadas', 40, y);
  } else {
    state.clasesAgrupadas.forEach(clase => {
      doc.setFontSize(12);
      doc.text(clase.nombre, 40, y);
      y += 18;
      
      doc.setFontSize(10);
      doc.text(`Código: ${clase.codigo || 'N/A'}`, 46, y);
      y += 14;
      doc.text(`Aula: ${clase.aula || 'N/A'}`, 46, y);
      y += 14;
      doc.text(`Estudiantes: ${clase.total_estudiantes || 0}`, 46, y);
      y += 14;
      
      if (clase.horarios && clase.horarios.length > 0) {
        doc.text('Horarios:', 46, y);
        y += 14;
        clase.horarios.forEach(h => {
          doc.text(`  - ${h.dia}: ${h.inicio} - ${h.fin}`, 52, y);
          y += 12;
        });
      }
      
      y += 10;
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
    });
  }
  
  doc.save(`clases-${state.profesor ? state.profesor.codigo_profesor : 'profesor'}.pdf`);
}

function renderPanel(){
  // mostrar información de la clase seleccionada
  if (!activeClaseId) {
    groupTitle.textContent = 'Selecciona una clase';
    panelBody.innerHTML = '<p class="muted">Selecciona una clase en la columna izquierda para ver los detalles y estudiantes inscritos.</p>';
    if (downloadPdfBtn) downloadPdfBtn.disabled = true;
    if (downloadExcelBtn) downloadExcelBtn.disabled = true;
    return;
  }
  
  const clase = state.clasesAgrupadas.find(c => c.id === activeClaseId);
  if (!clase) {
    groupTitle.textContent = 'Clase no encontrada';
    panelBody.innerHTML = '<p class="muted">No se encontró la clase seleccionada.</p>';
    if (downloadPdfBtn) downloadPdfBtn.disabled = true;
    if (downloadExcelBtn) downloadExcelBtn.disabled = true;
    return;
  }
  
  groupTitle.textContent = clase.nombre;
  if (downloadPdfBtn) downloadPdfBtn.disabled = false;
  if (downloadExcelBtn) downloadExcelBtn.disabled = false;
  
  let html = '';
  html += `<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
    <div><strong>${escapeHtml(clase.nombre)}</strong></div>
    <div class="muted" style="margin-top: 0.25rem;">Código: ${escapeHtml(clase.codigo || 'N/A')} | Aula: ${escapeHtml(clase.aula || 'N/A')}</div>
    <div class="muted">Estudiantes inscritos: ${clase.total_estudiantes || 0}</div>
  </div>`;
  
  // Mostrar horarios
  if (clase.horarios && clase.horarios.length > 0) {
    html += '<div style="margin-bottom: 1rem;"><strong>Horarios:</strong><ul style="margin: 0.5rem 0; padding-left: 1.5rem;">';
    clase.horarios.forEach(h => {
      html += `<li>${escapeHtml(h.dia)}: ${escapeHtml(h.inicio)} - ${escapeHtml(h.fin)}</li>`;
    });
    html += '</ul></div>';
  }
  
  html += '<div class="muted" style="margin-top: 1rem; padding: 1rem; background: #e3f2fd; border-radius: 4px;">';
  html += '<i class="fas fa-info-circle"></i> Los horarios son asignados por el administrador. Para modificarlos, contacta al área administrativa.';
  html += '</div>';
  
  // Roster de estudiantes
  html += '<hr style="margin:1rem 0;">';
  html += '<h3 style="margin:0 0 .5rem 0;">Estudiantes inscritos</h3>';
  if (state.cargandoEstudiantes) {
    html += '<div class="muted">Cargando estudiantes...</div>';
  } else if (!state.estudiantesClase || state.estudiantesClase.length === 0) {
    html += '<div class="muted">No hay estudiantes inscritos.</div>';
  } else {
    html += '<div class="table-wrap" style="overflow:auto;">';
    html += '<table class="table" style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">#</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Matrícula</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Nombre</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Correo</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Teléfono</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Grado</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Grupo</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Carrera</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd; width:110px;">Calificación</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Observación</th>'+
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Acciones</th>'+
      '</tr></thead><tbody>';
    state.estudiantesClase.forEach((al, idx) => {
      const puntajeVal = (al.puntaje != null && al.puntaje !== '') ? String(al.puntaje) : '';
      const obsVal = al.observacion ? String(al.observacion) : '';
      html += `<tr>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${idx+1}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.matricula||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.nombre||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.correo||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.telefono||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.grado||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.grupo||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(al.carrera||'')}</td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0; width:110px;"><input type="number" min="0" max="100" step="0.01" value="${escapeAttr(puntajeVal)}" data-estudiante="${al.id}" class="score-input" style="width:100%; padding:4px 6px;"></td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;"><input type="text" value="${escapeAttr(obsVal)}" data-estudiante="${al.id}" class="obs-input" style="width:100%; padding:4px 6px;"></td>`+
        `<td style="padding:6px; border-bottom:1px solid #f0f0f0;"><button class="saveScoreBtn" data-estudiante="${al.id}">Guardar</button></td>`+
        `</tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  panelBody.innerHTML = html;

  // Enlazar eventos Guardar calificación
  if (activeClaseId && state.estudiantesClase && state.estudiantesClase.length > 0) {
    panelBody.querySelectorAll('.saveScoreBtn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const estId = Number(btn.getAttribute('data-estudiante'));
        const scoreInput = panelBody.querySelector(`.score-input[data-estudiante="${estId}"]`);
        const obsInput = panelBody.querySelector(`.obs-input[data-estudiante="${estId}"]`);
        const puntaje = scoreInput ? scoreInput.value : '';
        const observacion = obsInput ? obsInput.value : '';
        try {
          const ok = await saveGrade(estId, activeClaseId, puntaje, observacion);
          if (ok) {
            btn.textContent = 'Guardado';
            setTimeout(()=>{ btn.textContent = 'Guardar'; }, 1200);
          }
        } catch (err) {
          alert('No se pudo guardar: ' + err.message);
        }
      });
    });
  }
}

async function loadPreguntas(){
  try {
    const user = JSON.parse(sessionStorage.getItem('user')||'{}');
    if (!user || !user.id) return;
    const res = await fetch(`/api/profesores/${user.id}/preguntas-calificaciones`);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    state.preguntas = data.preguntas || [];
  } catch (e) {
    console.error('Error cargando preguntas:', e);
    state.preguntas = [];
  }
}

function renderMessages(){
  if (state.subVistaMensajes === 'estudiantes') {
    groupTitle.textContent = 'Mensajes de estudiantes';
    let html = '';
    html += '<div class="muted" style="margin-bottom: 8px;">Mensajes enviados por estudiantes acerca de calificaciones.</div>';
    html += '<div class="table-wrap" style="overflow:auto;">';
    html += '<table class="table" style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Fecha</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Clase</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Estudiante</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Mensaje</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Respuesta</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Acciones</th>'+
            '</tr></thead><tbody>';
    if (!state.preguntas || state.preguntas.length === 0) {
      html += '<tr><td colspan="6" class="muted" style="padding:10px;">No hay mensajes.</td></tr>';
    } else {
      state.preguntas.forEach(p => {
        const f = p.creado_at ? new Date(p.creado_at).toLocaleString() : '';
        const resp = p.respuesta ? escapeHtml(p.respuesta) + (p.respuesta_fecha ? `<div class="muted" style="font-size:.85em;">${new Date(p.respuesta_fecha).toLocaleString()}</div>` : '') : '<em class="muted">Sin respuesta</em>';
        const canReply = !p.respuesta;
        const replyBtn = canReply ? `<button class="saveScoreBtn replyBtn" data-id="${p.id}">Responder</button>` : '';
        const editBtn = p.respuesta ? `<button class="saveScoreBtn editReplyBtn" data-id="${p.id}">Editar</button>` : '';
        html += '<tr>'+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(f)}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(p.clase_nombre||'')}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(p.estudiante_nombre||'')}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; max-width:420px;">${escapeHtml(p.mensaje||'')}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; max-width:420px;">${resp}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; display:flex; gap:6px; flex-wrap:wrap;">${replyBtn} ${editBtn}</td>`+
          '</tr>';
      });
    }
    html += '</tbody></table></div>';
    panelBody.innerHTML = html;
    // Bind reply buttons
    panelBody.querySelectorAll('.replyBtn').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-id');
        const respuesta = prompt('Escribe tu respuesta para el estudiante:');
        if (!respuesta) return;
        try{
          const user = JSON.parse(sessionStorage.getItem('user')||'{}');
          const resp = await fetch(`/api/preguntas/${id}/responder`,{
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profesor_id: user.id, respuesta })
          });
          const data = await resp.json().catch(()=>({}));
          if (!resp.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar respuesta');
          await loadPreguntas();
          renderMessages();
          alert('Respuesta enviada al estudiante');
        }catch(err){ alert('Error: '+err.message); }
      });
    });
    // Bind edit buttons
    panelBody.querySelectorAll('.editReplyBtn').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-id');
        const row = state.preguntas.find(x => String(x.id) === String(id));
        const current = row && row.respuesta ? row.respuesta : '';
        const respuesta = prompt('Edita tu respuesta para el estudiante:', current);
        if (respuesta == null) return; // cancelado
        try{
          const user = JSON.parse(sessionStorage.getItem('user')||'{}');
          const resp = await fetch(`/api/preguntas/${id}/respuesta`,{
            method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profesor_id: user.id, respuesta })
          });
          const data = await resp.json().catch(()=>({}));
          if (!resp.ok || !data.ok) throw new Error(data.error || 'No se pudo editar la respuesta');
          await loadPreguntas();
          renderMessages();
          alert('Respuesta actualizada');
        }catch(err){ alert('Error: '+err.message); }
      });
    });
  } else {
    groupTitle.textContent = 'Mensajes de administración';
    let html = '';
    html += '<div class="muted" style="margin-bottom: 8px;">Comunicados enviados por el administrador.</div>';
    html += '<div class="table-wrap" style="overflow:auto;">';
    html += '<table class="table" style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Fecha</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Título</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Contenido</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Estado</th>'+
            '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Acciones</th>'+
            '</tr></thead><tbody>';
    if (!state.mensajesAdmin || state.mensajesAdmin.length === 0) {
      html += '<tr><td colspan="5" class="muted" style="padding:10px;">No hay mensajes de administración.</td></tr>';
    } else {
      state.mensajesAdmin.forEach(m => {
        const f = m.creado_at ? new Date(m.creado_at).toLocaleString() : '';
        const isLeido = !!m.leido_at;
        const estado = isLeido ? `<span style="color:#16a34a;font-weight:600;">Leído</span>` : `<span style="color:#dc2626;font-weight:600;">Nuevo</span>`;
        const leerBtn = !isLeido ? `<button class="saveScoreBtn leerAdminMsgBtn" data-id="${m.id}">Marcar leído</button>` : '';
        html += '<tr>'+`
          <td style="padding:6px; border-bottom:1px solid #f0f0f0;">${escapeHtml(f)}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; max-width:240px;">${escapeHtml(m.titulo||'')}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; max-width:420px;">${escapeHtml(m.contenido||'')}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0;">${estado}</td>`+
          `<td style="padding:6px; border-bottom:1px solid #f0f0f0; display:flex; gap:6px; flex-wrap:wrap;">${leerBtn}</td>`+
        '</tr>';
      });
    }
    html += '</tbody></table></div>';
    panelBody.innerHTML = html;
    panelBody.querySelectorAll('.leerAdminMsgBtn').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-id');
        try {
          const user = JSON.parse(sessionStorage.getItem('user')||'{}');
          const resp = await fetch(`/api/mensajes-profesores/${id}/leido`, { 
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ profesor_id: user.id })
          });
          const data = await resp.json().catch(()=>({}));
          if (!resp.ok || !data.ok) throw new Error(data.error || 'No se pudo marcar como leído');
          await loadMensajesAdmin();
          renderMessages();
        } catch(err){ alert('Error: '+err.message); }
      });
    });
  }
  updateUnreadBadges();
}

async function loadMensajesAdmin(){
  try {
    const user = JSON.parse(sessionStorage.getItem('user')||'{}');
    if (!user || !user.id) return;
    const res = await fetch(`/api/profesores/${user.id}/mensajes-admin`);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    state.mensajesAdmin = data.mensajes || [];
  } catch (e) {
    console.error('Error cargando mensajes admin:', e);
    state.mensajesAdmin = [];
  }
}

function updateUnreadBadges(){
  // Estudiantes: preguntas sin respuesta
  const pendientes = (state.preguntas||[]).filter(p=>!p.respuesta).length;
  if (badgeStudent){
    if (pendientes>0){ badgeStudent.style.display='inline-flex'; badgeStudent.textContent=pendientes; }
    else { badgeStudent.style.display='none'; }
  }
  // Admin: mensajes sin leido_at
  const nuevosAdmin = (state.mensajesAdmin||[]).filter(m=>!m.leido_at).length;
  if (badgeAdmin){
    if (nuevosAdmin>0){ badgeAdmin.style.display='inline-flex'; badgeAdmin.textContent=nuevosAdmin; }
    else { badgeAdmin.style.display='none'; }
  }
}

function updateTabsUI(){
  if (studentMsgsTab) studentMsgsTab.classList.toggle('active', state.subVistaMensajes==='estudiantes');
  if (adminMsgsTab) adminMsgsTab.classList.toggle('active', state.subVistaMensajes==='admin');
}

function updateRefreshVisibility(){
  if (!refreshMessagesBtn) return;
  refreshMessagesBtn.style.display = (state.vista === 'mensajes') ? 'inline-flex' : 'none';
}

// Polling para nuevos mensajes admin cada 60s cuando se está en cualquier vista (ligero)
setInterval(async ()=>{
  const user = JSON.parse(sessionStorage.getItem('user')||'{}');
  if (!user || !user.id) return;
  await loadMensajesAdmin();
  if (state.subVistaMensajes==='admin' && state.vista==='mensajes') {
    renderMessages();
  } else {
    updateUnreadBadges();
  }
}, 60000);

function escapeHtml(s){
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(s){
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Iniciar aplicación
init();

// ========= Funciones nuevas para roster =========
async function loadEstudiantesClase(claseId){
  try {
    state.cargandoEstudiantes = true;
    renderPanel();
    const res = await fetch(`/api/clases/${claseId}/estudiantes`);
    if (res.ok) {
      const data = await res.json();
      state.estudiantesClase = data.estudiantes || [];
    } else {
      state.estudiantesClase = [];
    }
  } catch (e) {
    console.error('Error cargando estudiantes:', e);
    state.estudiantesClase = [];
  } finally {
    state.cargandoEstudiantes = false;
    renderPanel();
  }
}

async function saveGrade(estudianteId, claseId, puntaje, observacion){
  const body = { estudiante_id: Number(estudianteId), clase_id: Number(claseId) };
  if (puntaje !== '' && puntaje !== null && puntaje !== undefined) body.puntaje = Number(puntaje);
  if (observacion !== '' && observacion !== null && observacion !== undefined) body.observacion = String(observacion);
  const res = await fetch('/api/calificaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const out = await res.json().catch(()=>({}));
  if (!res.ok || !out.ok) throw new Error(out.error || 'Error al guardar calificación');
  // refrescar datos del estudiante en la lista
  await loadEstudiantesClase(claseId);
  return true;
}

function exportRosterPdf(clase, estudiantes){
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return alert('jsPDF no cargado');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const profesorNombre = state.profesor ? state.profesor.nombre : '';
  const title = `Lista de alumnos - ${clase.nombre}`;
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.text(`Profesor: ${profesorNombre}`, 40, 58);
  doc.text(`Código: ${clase.codigo || ''}   Aula: ${clase.aula || ''}   Estudiantes: ${estudiantes.length}`, 40, 72);

  const headers = [['#','Matrícula','Nombre','Correo','Teléfono','Grado','Grupo','Carrera']];
  const rows = estudiantes.map((al, idx) => [
    String(idx+1),
    al.matricula||'',
    al.nombre||'',
    al.correo||'',
    al.telefono||'',
    al.grado||'',
    al.grupo||'',
    al.carrera||''
  ]);

  if (doc.autoTable) {
    doc.autoTable({
      startY: 90,
      head: headers,
      body: rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [25,118,210] },
      margin: { left: 40, right: 40 }
    });
  } else {
    // Fallback simple si no está autotable
    let y = 90;
    doc.setFontSize(9);
    rows.forEach(r => {
      doc.text(r.join(' | '), 40, y);
      y += 12;
    });
  }

  const file = `lista-${(clase.codigo||clase.nombre||'clase').replace(/\s+/g,'_')}.pdf`;
  doc.save(file);
}

function exportRosterExcel(clase, estudiantes){
  if (!window.XLSX) return alert('Librería XLSX no cargada');
  const data = estudiantes.map((al, idx) => ({
    '#': idx+1,
    'Matrícula': al.matricula||'',
    'Nombre': al.nombre||'',
    'Correo': al.correo||'',
    'Teléfono': al.telefono||'',
    'Grado': al.grado||'',
    'Grupo': al.grupo||'',
    'Carrera': al.carrera||''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
  const file = `lista-${(clase.codigo||clase.nombre||'clase').replace(/\s+/g,'_')}.xlsx`;
  XLSX.writeFile(wb, file);
}
