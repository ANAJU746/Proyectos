// Script para gestión de avisos del profesor
// Asume que el profesor ya inició sesión y su ID se tiene disponible.
// Para pruebas rápidas puedes fijar un ID estático.

const API_BASE = '/api';
// TODO: Reemplazar con mecanismo real (session/localStorage). Valor de ejemplo:
const PROFESOR_ID = window.PROFESOR_ID || 1;

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

document.querySelectorAll('input[name="target"]').forEach(r => {
  r.addEventListener('change', toggleDestino);
});

function limpiarFormulario() {
  tituloEl.value = '';
  contenidoEl.value = '';
  fechaProgEl.value = '';
  document.querySelector('input[name="target"][value="general"]').checked = true;
  toggleDestino();
}

document.getElementById('btn-limpiar').addEventListener('click', e => {
  e.preventDefault();
  limpiarFormulario();
});

async function cargarClasesProfesor() {
  try {
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/clases`);
    const data = await resp.json();
    if (!data.ok) return;
    claseSelectEl.innerHTML = '';
    // Agrupar por id (consulta trae múltiples filas por horarios)
    const clasesMap = new Map();
    for (const r of data.clases) {
      if (!clasesMap.has(r.id)) {
        clasesMap.set(r.id, r);
      }
    }
    [...clasesMap.values()].forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nombre} (${c.codigo || 'sin código'})`;
      claseSelectEl.appendChild(opt);
    });
  } catch (err) {
    console.error('Error cargar clases:', err);
  }
}

async function cargarEstudiantesProfesor() {
  try {
    // Obtener clases para luego traer estudiantes de cada clase
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/clases`);
    const data = await resp.json();
    if (!data.ok) return;
    const claseIds = [...new Set(data.clases.map(c => c.id))];
    const estudiantesMap = new Map();

    for (const cid of claseIds) {
      const r2 = await fetch(`${API_BASE}/clases/${cid}/estudiantes`);
      const d2 = await r2.json();
      if (d2.ok) {
        for (const est of d2.estudiantes) {
          if (!estudiantesMap.has(est.id)) estudiantesMap.set(est.id, est);
        }
      }
    }

    estudianteSelectEl.innerHTML = '';
    [...estudiantesMap.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.nombre} (${e.matricula})`;
      estudianteSelectEl.appendChild(opt);
    });
  } catch (err) {
    console.error('Error cargar estudiantes:', err);
  }
}

async function enviarAviso() {
  const target_type = getTargetType();
  const titulo = tituloEl.value.trim();
  const contenido = contenidoEl.value.trim();
  const fecha_programada = fechaProgEl.value ? fechaProgEl.value : null;
  if (!titulo || !contenido) {
    alert('Título y contenido son requeridos');
    return;
  }
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
    const resp = await fetch(`${API_BASE}/avisos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!data.ok) {
      alert('Error: ' + (data.error || 'No se pudo crear el aviso'));
      return;
    }
    alert('Aviso creado');
    limpiarFormulario();
    cargarAvisosProfesor();
  } catch (err) {
    console.error('Error enviar aviso:', err);
    alert('Error al enviar aviso');
  }
}

document.getElementById('btn-enviar').addEventListener('click', e => {
  e.preventDefault();
  enviarAviso();
});

function formatoFecha(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return dtStr;
  return d.toLocaleString();
}

function badgeEstado(aviso) {
  if (aviso.fecha_programada && new Date(aviso.fecha_programada) > new Date()) {
    return '<span class="badge badge-orange">Programado</span>';
  }
  return '<span class="badge badge-green">Publicado</span>';
}

function badgeTipo(aviso) {
  if (aviso.target_type === 'general') return '<span class="badge badge-gray">General</span>';
  if (aviso.target_type === 'clase') return '<span class="badge badge-gray">Clase</span>';
  if (aviso.target_type === 'estudiante') return '<span class="badge badge-gray">Estudiante</span>';
  return '';
}

async function cargarAvisosProfesor() {
  try {
    const resp = await fetch(`${API_BASE}/profesores/${PROFESOR_ID}/avisos`);
    const data = await resp.json();
    if (!data.ok) { listaAvisosEl.innerHTML = '<p>Error al cargar avisos</p>'; return; }
    if (!data.avisos || data.avisos.length === 0) {
      listaAvisosEl.innerHTML = '<p style="color:#64748b;">Aún no has creado avisos.</p>';
      return;
    }
    listaAvisosEl.innerHTML = data.avisos.map(a => {
      return `<div class="aviso-item">\n        <div class="aviso-header">\n          <h3 class="aviso-title">${a.titulo.replace(/</g,'&lt;')}</h3>\n          <div>${badgeTipo(a)} ${badgeEstado(a)}</div>\n        </div>\n        <div class="aviso-meta">${formatoFecha(a.creado_at)}${a.fecha_programada? ' · prog: '+formatoFecha(a.fecha_programada):''}</div>\n        <p style="margin:6px 0 4px; line-height:1.4;">${(a.contenido||'').replace(/</g,'&lt;')}</p>\n        <div style="font-size:12px; color:#425469;">Lecturas: ${a.total_lecturas || 0}</div>\n      </div>`;
    }).join('\n');
  } catch (err) {
    console.error('Error cargar avisos profesor:', err);
    listaAvisosEl.innerHTML = '<p>Error inesperado.</p>';
  }
}

// Inicialización
toggleDestino();
cargarClasesProfesor();
cargarEstudiantesProfesor();
cargarAvisosProfesor();
