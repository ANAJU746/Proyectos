// Avisos para maestro (Pagina5)
const API_BASE = '/api';

// Obtener ID del usuario maestro desde sessionStorage
function getProfesorId() {
  try { const u = JSON.parse(sessionStorage.getItem('user')||'{}'); return u?.id || null; } catch(_) { return null; }
}

const PROFESOR_ID = getProfesorId() || 1; // fallback demo

const tituloEl = document.getElementById('titulo');
const contenidoEl = document.getElementById('contenido');
const fechaProgEl = document.getElementById('fecha_programada');
const destinoClasesEl = document.getElementById('destino-clases');
const destinoEstudiantesEl = document.getElementById('destino-estudiantes');
const claseSelectEl = document.getElementById('clase_ids');
const estudianteSelectEl = document.getElementById('estudiante_ids');
const listaAvisosEl = document.getElementById('lista-avisos');

function getTargetType() {
  const radios = document.querySelectorAll('input[name="target"]');
  for (const r of radios) if (r.checked) return r.value;
  return 'general';
}

function toggleDestino() {
  const t = getTargetType();
  destinoClasesEl.classList.toggle('hidden', t !== 'clase');
  destinoEstudiantesEl.classList.toggle('hidden', t !== 'estudiante');
}

document.querySelectorAll('input[name="target"]').forEach(r => r.addEventListener('change', toggleDestino));

function limpiarFormulario() {
  tituloEl.value = '';
  contenidoEl.value = '';
  fechaProgEl.value = '';
  document.querySelector('input[name="target"][value="general"]').checked = true;
  toggleDestino();
}

document.getElementById('btn-limpiar').addEventListener('click', e => { e.preventDefault(); limpiarFormulario(); });

async function cargarClasesProfesor() {
  try {
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/clases`);
    const data = await resp.json();
    if (!data.ok) return;
    claseSelectEl.innerHTML = '';
    const clasesMap = new Map();
    for (const r of data.clases) if (!clasesMap.has(r.id)) clasesMap.set(r.id, r);
    [...clasesMap.values()].forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nombre} (${c.codigo || 'sin código'})`;
      claseSelectEl.appendChild(opt);
    });
  } catch (err) { console.error('Error cargar clases:', err); }
}

async function cargarEstudiantesProfesor() {
  try {
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/clases`);
    const data = await resp.json();
    if (!data.ok) return;
    const claseIds = [...new Set(data.clases.map(c => c.id))];
    const estudiantesMap = new Map();
    for (const cid of claseIds) {
      const r2 = await fetch(`${API_BASE}/clases/${cid}/estudiantes`);
      const d2 = await r2.json();
      if (d2.ok) {
        for (const est of d2.estudiantes) if (!estudiantesMap.has(est.id)) estudiantesMap.set(est.id, est);
      }
    }
    estudianteSelectEl.innerHTML = '';
    [...estudiantesMap.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.nombre} (${e.matricula})`;
      estudianteSelectEl.appendChild(opt);
    });
  } catch (err) { console.error('Error cargar estudiantes:', err); }
}

async function enviarAviso() {
  const target_type = getTargetType();
  const titulo = tituloEl.value.trim();
  const contenido = contenidoEl.value.trim();
  const fecha_programada = fechaProgEl.value ? fechaProgEl.value : null;
  if (!titulo || !contenido) { alert('Título y contenido son requeridos'); return; }
  const body = { profesor_id: PROFESOR_ID, titulo, contenido, target_type, fecha_programada };
  if (target_type === 'clase') {
    const selected = [...claseSelectEl.selectedOptions].map(o => Number(o.value));
    if (selected.length === 0) { alert('Selecciona al menos una clase'); return; }
    body.clase_ids = selected;
  } else if (target_type === 'estudiante') {
    const selected = [...estudianteSelectEl.selectedOptions].map(o => Number(o.value));
    if (selected.length === 0) { alert('Selecciona al menos un estudiante'); return; }
    body.estudiante_ids = selected;
  }
  try {
    const resp = await fetch(`${API_BASE}/avisos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
    if (!data.ok) { alert('Error: ' + (data.error || 'No se pudo crear el aviso')); return; }
    alert('Aviso creado');
    limpiarFormulario();
    cargarAvisosProfesor();
  } catch (err) { console.error('Error enviar aviso:', err); alert('Error al enviar aviso'); }
}

document.getElementById('btn-enviar').addEventListener('click', e => { e.preventDefault(); enviarAviso(); });

function formatoFecha(dtStr) { const d = dtStr ? new Date(dtStr) : null; return d && !isNaN(d.getTime()) ? d.toLocaleString() : (dtStr || ''); }

function badgeEstado(aviso) { return (aviso.fecha_programada && new Date(aviso.fecha_programada) > new Date()) ? '<span class="badge badge-orange">Programado</span>' : '<span class="badge badge-green">Publicado</span>'; }

function badgeTipo(aviso) {
  if (aviso.target_type === 'general') return '<span class="badge badge-gray">General</span>';
  if (aviso.target_type === 'clase') return '<span class="badge badge-gray">Clase</span>';
  if (aviso.target_type === 'estudiante') return '<span class="badge badge-gray">Estudiante</span>';
  return '';
}

// Mostrar modal edición
function abrirModalEdicion(aviso) {
  const modal = document.getElementById('modal-editar-aviso');
  if (!modal) return;
  document.getElementById('edit-aviso-id').value = aviso.id;
  document.getElementById('edit-titulo').value = aviso.titulo || '';
  document.getElementById('edit-contenido').value = aviso.contenido || '';
  const fechaInput = document.getElementById('edit-fecha');
  if (fechaInput) {
    if (aviso.fecha_programada) {
      // Formatear a yyyy-MM-ddTHH:mm para datetime-local
      const d = new Date(aviso.fecha_programada);
      if (!isNaN(d.getTime())) {
        const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
        fechaInput.value = iso;
      } else fechaInput.value = '';
    } else {
      fechaInput.value = '';
    }
  }
  modal.classList.remove('hidden');
}

function cerrarModalEdicion() {
  const modal = document.getElementById('modal-editar-aviso');
  if (modal) modal.classList.add('hidden');
}

async function guardarEdicion() {
  const id = document.getElementById('edit-aviso-id').value;
  const titulo = document.getElementById('edit-titulo').value.trim();
  const contenido = document.getElementById('edit-contenido').value.trim();
  const fecha = document.getElementById('edit-fecha').value.trim();
  if (!id) return alert('ID inválido');
  if (!titulo || !contenido) return alert('Título y contenido son requeridos');
  try {
    const resp = await fetch(`${API_BASE}/avisos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesor_id: PROFESOR_ID, titulo, contenido, fecha_programada: fecha || null })
    });
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Error actualizando aviso');
    cerrarModalEdicion();
    cargarAvisosProfesor();
    alert('Aviso actualizado');
  } catch (err) {
    console.error('Error editar aviso:', err);
    alert('No se pudo editar el aviso');
  }
}

async function cargarAvisosProfesor() {
  try {
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/avisos`);
    const data = await resp.json();
    if (!data.ok) { listaAvisosEl.innerHTML = '<p>Error al cargar avisos</p>'; return; }
    if (!data.avisos || data.avisos.length === 0) { listaAvisosEl.innerHTML = '<p class="muted">Aún no has creado avisos.</p>'; return; }
    const filtroActivo = document.querySelector('.chip.active')?.dataset.filter || 'todos';
    const now = new Date();
    const avisosFiltrados = data.avisos.filter(a => {
      const prog = a.fecha_programada && new Date(a.fecha_programada) > now;
      if (filtroActivo === 'programado') return prog;
      if (filtroActivo === 'publicado') return !prog;
      return true;
    });
    listaAvisosEl.innerHTML = avisosFiltrados.map(a => `
      <div class="aviso-item" data-id="${a.id}">
        <div class="aviso-header">
          <h3 class="aviso-title">${(a.titulo||'').replace(/</g,'&lt;')}</h3>
          <div>${badgeTipo(a)} ${badgeEstado(a)}</div>
        </div>
        <div class="aviso-meta">${formatoFecha(a.creado_at)}${a.fecha_programada? ' · prog: '+formatoFecha(a.fecha_programada):''}</div>
        <p style="margin:6px 0 8px; line-height:1.4;">${(a.contenido||'').replace(/</g,'&lt;')}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="font-size:12px; color:#425469;">Lecturas: ${a.total_lecturas || 0}</div>
          <button class="btn btn-light btn-editar-aviso" data-id="${a.id}" style="background:#e8f1fa; color:#132739; padding:6px 10px; font-size:11px; border-radius:8px; border:0; cursor:pointer;">
            <i class="fas fa-edit"></i> Editar
          </button>
        </div>
      </div>
    `).join('');
    // Asociar eventos editar
    listaAvisosEl.querySelectorAll('.btn-editar-aviso').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const aviso = avisosFiltrados.find(x => String(x.id) === String(id));
        if (aviso) abrirModalEdicion(aviso);
      });
    });
  } catch (err) { console.error('Error cargar avisos profesor:', err); listaAvisosEl.innerHTML = '<p>Error inesperado.</p>'; }
}

// Filtro chips
Array.from(document.querySelectorAll('.chip')).forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    cargarAvisosProfesor();
  });
});

// Preselección de clase por query param
(function presetClaseFromQuery(){
  const params = new URLSearchParams(location.search);
  const claseId = params.get('clase');
  if (!claseId) return;
  document.querySelector('input[name="target"][value="clase"]').checked = true;
  toggleDestino();
  // Esperar a que carguen clases y seleccionar
  const sel = () => {
    const opt = [...claseSelectEl.options].find(o => String(o.value) === String(claseId));
    if (opt) opt.selected = true;
  };
  setTimeout(sel, 500);
})();

// Init
toggleDestino();
Promise.all([cargarClasesProfesor(), cargarEstudiantesProfesor()]).then(cargarAvisosProfesor);

// Eventos modal edición
document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModalEdicion);
document.getElementById('btn-cancelar-edicion')?.addEventListener('click', cerrarModalEdicion);
document.getElementById('btn-guardar-edicion')?.addEventListener('click', e => { e.preventDefault(); guardarEdicion(); });
// Cerrar al hacer clic fuera del cuadro (overlay)
document.getElementById('modal-editar-aviso')?.addEventListener('click', (e)=>{
  if (e.target && e.target.id === 'modal-editar-aviso') cerrarModalEdicion();
});
