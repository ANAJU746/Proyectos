// La verificación de admin ahora se hace en shared-admin.js

// Manejo de navegación en el sidebar: soporta enlaces internos (hash) y externos (.html)
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        const href = this.getAttribute('href') || '';

        // Si es un enlace interno por hash, manejar en-page
        if (href.startsWith('#')) {
            e.preventDefault();

            // Remover clase active de todos los enlaces y marcar este
            document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');

            // Si existe la sección en la página, mostrarla
            const sectionId = href.substring(1);
            const section = document.getElementById(sectionId);
            if (section) {
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                section.classList.add('active');
            }

            // Actualizar el título del header
            const sectionTitle = this.textContent.trim();
            const header = document.querySelector('header h2');
            if (header) header.textContent = sectionTitle;
        } else {
            // Enlaces externos (.html o rutas relativas) deben funcionar normalmente.
            // Marcar active para dar feedback visual antes de la navegación.
            document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            // No prevenir la acción por defecto: el navegador abrirá la página.
        }
    });
});

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

// Animación suave para las tarjetas al cargar
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
    
    // Cargar estadísticas reales (loadAdminProfile ya se maneja en shared-admin.js)
    loadDashboardStats();

    // (Admin) No mostrar secciones de horario/grupos/mis clases en este dashboard
});

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/admin/estadisticas');
        const data = await res.json();
        
        if (!data.ok) {
            throw new Error(data.error || 'Error al cargar estadísticas');
        }
        
        const stats = data.estadisticas;
        
    // Actualizar números en las tarjetas con animación
    animateCount(document.getElementById('totalEstudiantes'), stats.total_estudiantes || 0);
    animateCount(document.getElementById('totalProfesores'), stats.total_profesores || 0);
    animateCount(document.getElementById('totalClases'), stats.total_clases || 0);
    animateCount(document.getElementById('promedioGeneral'), parseFloat(stats.promedio_general || 0).toFixed(2), true);

    // Progresos relativos
    const v1 = stats.total_estudiantes || 0;
    const v2 = stats.total_profesores || 0;
    const v3 = stats.total_clases || 0;
    const vmax = Math.max(1, v1, v2, v3);
    setProgress('estudiantesBar', Math.round((v1 / vmax) * 100));
    setProgress('profesoresBar', Math.round((v2 / vmax) * 100));
    setProgress('clasesBar', Math.round((v3 / vmax) * 100));
    const promedioPct = Math.min(100, Math.max(0, (parseFloat(stats.promedio_general || 0) / 10) * 100));
    setProgress('promedioBar', Math.round(promedioPct));
        
        // Actualizar trends (opcional, por ahora mostramos datos actuales)
        const cards = document.querySelectorAll('.card .trend');
        if (cards[0]) cards[0].textContent = `${stats.total_estudiantes} activos`;
        if (cards[1]) cards[1].textContent = `${stats.total_profesores} activos`;
        if (cards[2]) cards[2].textContent = `${stats.total_clases} disponibles`;
        if (cards[3]) cards[3].textContent = `Promedio del sistema`;
        
        // Actividad reciente (últimas inscripciones)
        const actividadDiv = document.getElementById('actividadReciente');
        if (actividadDiv && stats.ultimas_inscripciones && stats.ultimas_inscripciones.length > 0) {
            actividadDiv.innerHTML = '';
            stats.ultimas_inscripciones.forEach(ins => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'activity-item';
                
                const time = new Date(ins.creado_at);
                const timeStr = time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const dateStr = time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                
                itemDiv.innerHTML = `
                    <span class="time">${dateStr} ${timeStr}</span>
                    <p>Nueva inscripción: ${ins.estudiante || 'Estudiante'} en ${ins.clase || 'Clase'}</p>
                `;
                actividadDiv.appendChild(itemDiv);
            });
        } else if (actividadDiv) {
            actividadDiv.innerHTML = '<div class="activity-item"><span class="time">--</span><p>No hay actividad reciente</p></div>';
        }
        
    } catch (err) {
        console.error('Error al cargar estadísticas:', err);
        document.querySelectorAll('.card .trend').forEach(t => t.textContent = 'Error al cargar');
    }
}

function animateCount(el, value, isDecimal = false) {
    if (!el) return;
    const target = parseFloat(value) || 0;
    const duration = 800;
    const start = performance.now();
    const from = parseFloat(el.textContent) || 0;
    const diff = target - from;
    function step(ts) {
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const current = from + diff * eased;
        el.textContent = isDecimal ? current.toFixed(2) : Math.round(current);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function setProgress(barId, percent) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const p = Math.max(0, Math.min(100, percent));
    // pequeña animación diferida
    setTimeout(() => { bar.style.width = p + '%'; }, 50);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
