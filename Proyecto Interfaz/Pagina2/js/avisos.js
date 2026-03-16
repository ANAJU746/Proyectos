// Listado de avisos para estudiante
const API_BASE = '/api';
// Obtener ID real desde sessionStorage; fallback a demo sólo si existe window.ESTUDIANTE_ID
function getEstudianteId() {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (u && u.role === 'estudiante' && u.id) return u.id;
  } catch (_) {}
  return window.ESTUDIANTE_ID || null;
}
const ESTUDIANTE_ID = getEstudianteId();

const listaEl = document.getElementById('lista');
const qEl = document.getElementById('q');
let avisos = [];

function fmtFecha(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function render() {
  const q = (qEl.value || '').toLowerCase();
  const now = new Date();
  const filtered = avisos.filter(a => {
    const hay = `${a.titulo} ${a.contenido}`.toLowerCase();
    return hay.includes(q);
  });
  if (filtered.length === 0) {
    listaEl.innerHTML = '<p class="empty">No hay avisos.</p>';
    return;
  }
  
  listaEl.innerHTML = filtered.map(a => {
    const fechaProg = a.fecha_programada ? new Date(a.fecha_programada) : null;
    const esProgramado = fechaProg && fechaProg > now;
    const estaVigente = !fechaProg || fechaProg <= now;
    const leido = !!a.leido_at;
    
    // Badge según estado
    let badge = '';
    if (esProgramado) {
      badge = '<span class="badge b-prog">⏰ Programado</span>';
    } else if (estaVigente && !leido) {
      badge = '<span class="badge b-new">🔔 Nuevo</span>';
    } else if (leido) {
      badge = '<span class="badge b-read">✓ Leído</span>';
    }
    
    const extra = a.target_type === 'clase' ? (a.clase_nombre ? ` · ${a.clase_nombre}` : '') : (a.target_type === 'general' ? ' · General' : '');
    
    return `<div class="item ${esProgramado ? 'programado' : ''}" data-id="${a.id}">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>${a.titulo.replace(/</g,'&lt;')}</h3>
        ${badge}
      </div>
      <div class="meta">${a.profesor_nombre || 'Profesor'}${extra} · ${fmtFecha(a.creado_at)}${fechaProg ? ' → Vigente desde ' + fmtFecha(a.fecha_programada) : ''}</div>
      <p style="margin:6px 0 0;">${(a.contenido||'').replace(/</g,'&lt;')}</p>
    </div>`;
  }).join('\n');

  // Add click handlers to mark as read
  document.querySelectorAll('.item').forEach(div => {
    div.addEventListener('click', async () => {
      const avisoId = Number(div.getAttribute('data-id'));
      try {
        await fetch(`${API_BASE}/avisos/${avisoId}/leido`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estudiante_id: ESTUDIANTE_ID })
        });
        // Update local state
        const idx = avisos.findIndex(a => a.id === avisoId);
        if (idx >= 0) avisos[idx].leido_at = new Date().toISOString();
        render();
      } catch (err) {
        console.error('Error marcar leído:', err);
      }
    });
  });
}

async function loadAvisos() {
  try {
    if (!ESTUDIANTE_ID) {
      listaEl.innerHTML = '<p class="empty">Inicia sesión como estudiante para ver tus avisos.</p>';
      return;
    }
    const resp = await fetch(`${API_BASE}/estudiantes/${ESTUDIANTE_ID}/avisos`);
    const data = await resp.json();
    if (!data.ok) { listaEl.innerHTML = '<p class="empty">Error al cargar.</p>'; return; }
    avisos = data.avisos || [];
    render();
  } catch (err) {
    console.error('Error load avisos:', err);
    listaEl.innerHTML = '<p class="empty">Error inesperado.</p>';
  }
}

qEl.addEventListener('input', render);
loadAvisos();

// Notificaciones para avisos programados que llegaron a su fecha
function checkNotificaciones() {
  if (!avisos || avisos.length === 0) return;
  const now = new Date();
  const nuevosVigentes = avisos.filter(a => {
    if (!a.fecha_programada) return false;
    const fp = new Date(a.fecha_programada);
    if (fp > now) return false; // aún no vigente
    if (a.leido_at) return false; // ya leído
    // Verificar si hace poco se volvió vigente (últimos 5 minutos)
    const diff = now - fp;
    return diff >= 0 && diff <= 5 * 60 * 1000;
  });
  
  if (nuevosVigentes.length > 0) {
    // Mostrar notificación nativa del navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      nuevosVigentes.forEach(a => {
        new Notification('Nuevo aviso disponible', {
          body: `${a.titulo} - ${a.profesor_nombre || 'Profesor'}`,
          icon: '/imagen/logo.png', // ajusta la ruta si tienes un logo
          badge: '🔔'
        });
      });
    }
    // Mostrar badge visual en la página
    mostrarToast(`${nuevosVigentes.length} aviso(s) programado(s) ahora vigente(s)`);
  }
}

function mostrarToast(mensaje) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#4a90e2;color:#fff;padding:12px 20px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;font-weight:600;animation:slideIn 0.3s ease;';
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Pedir permiso para notificaciones al cargar
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Verificar notificaciones cada 60 segundos
setInterval(checkNotificaciones, 60000);
checkNotificaciones(); // primera verificación inmediata
