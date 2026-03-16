// Inicialización de componentes Bootstrap
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar todos los tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    // Manejador para el botón de clases en línea
    // Abrir Microsoft Teams (web) al pulsar "Clases en Línea"
    const onlineClassesBtn = document.querySelector('.online-classes-btn');
    if (onlineClassesBtn) {
        const TEAMS_URL = 'https://teams.microsoft.com/'; // Cambia aquí si deseas un enlace específico de tu institución o clase
        onlineClassesBtn.addEventListener('click', function() {
            // Abre en una nueva pestaña la plataforma de Teams
            const w = window.open(TEAMS_URL, '_blank');
            if (w) { try { w.opener = null; } catch (_) {} }
        });
    }

    // Actualizar la hora en tiempo real (solo si el elemento existe)
    function updateTime() {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            timeEl.textContent = timeString;
        }
    }

    // Actualizar cada segundo (solo si el elemento existe)
    if (document.getElementById('current-time')) {
        setInterval(updateTime, 1000);
        updateTime(); // Llamada inicial
    }

    // Funciones auxiliares (definir primero para poder usarlas)
    async function fetchJSON(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value ?? '-';
    }

    // Cargar usuario de sesión y poblar datos
    let user = null;
    try {
        user = JSON.parse(sessionStorage.getItem('user'));
    } catch {}

    if (!user || user.role !== 'estudiante') {
        // Si no hay usuario, redirigir al login
        window.location.href = '/Pagina1/index.html';
        return;
    }

    const nameEl = document.getElementById('student-name');
    const matEl = document.getElementById('student-matricula');
    
    // Cargar datos actualizados del estudiante desde la BD
    (async () => {
        try {
            console.log('🔍 Cargando datos del estudiante ID:', user.id);
            const estudianteData = await fetchJSON(`/api/estudiantes/${user.id}`);
            console.log('📦 Datos recibidos de la API:', estudianteData);
            
            const estudiante = estudianteData.estudiante || estudianteData;
            console.log('👤 Datos del estudiante procesados:', estudiante);
            
            // Actualizar nombre, matrícula y foto con datos de la BD
            if (nameEl) {
                nameEl.textContent = estudiante.nombre || user.nombre || 'Estudiante';
                console.log('✅ Nombre actualizado en vista:', nameEl.textContent);
            }
            const photoDash = document.getElementById('student-photo');
            if (photoDash) {
                photoDash.src = estudiante.foto_url || 'https://via.placeholder.com/150';
            }
            
            // Actualizar también el objeto de sesión
            user.nombre = estudiante.nombre;
            user.matricula = estudiante.matricula;
            user.foto_url = estudiante.foto_url;
            console.log('💾 Sesión actualizada con nuevos datos');
        } catch (err) {
            console.error('❌ Error al cargar datos del estudiante:', err);
            if (nameEl && user.nombre) nameEl.textContent = user.nombre;
            if (matEl && user.matricula) matEl.textContent = user.matricula;
        }
    })();

    // Detectar página actual
    const pathname = location.pathname;

    // Dashboard index.html
    if (pathname.endsWith('/Pagina2/index.html') || pathname.endsWith('/Pagina2/')) {
        console.log('📊 Cargando dashboard...');
        // Materias + promedio y créditos dinámicos con calificaciones reales
        (async () => {
            try {
                console.log('🔄 Consultando materias, datos del estudiante y calificaciones...');
                const [materiasResponse, detalle, califsResp] = await Promise.all([
                    fetchJSON(`/api/estudiantes/${user.id}/materias`),
                    fetchJSON(`/api/estudiantes/${user.id}`),
                    fetchJSON(`/api/estudiantes/${user.id}/calificaciones`)
                ]);

                console.log('📚 Respuesta de materias:', materiasResponse);
                console.log('👤 Respuesta de detalle estudiante:', detalle);
                console.log('📝 Respuesta de calificaciones:', califsResp);

                const materias = materiasResponse.materias || [];
                // Promedio general - detalle ahora es directamente el estudiante
                const estudiante = detalle.estudiante || detalle;
                console.log('📊 Datos del estudiante para dashboard:', {
                    nombre: estudiante.nombre,
                    matricula: estudiante.matricula,
                    promedio: estudiante.promedio,
                    grado: estudiante.grado,
                    grupo: estudiante.grupo
                });
                
                // Promedio general dinámico a partir de calificaciones (puntaje)
                // Supuesto: cada clase se cuenta una vez; si hay varias entradas por clase, se toma la primera encontrada.
                const califs = (califsResp && (califsResp.calificaciones || califsResp)) || [];
                const mapaUnicos = new Map();
                for (let i = 0; i < califs.length; i++) {
                    const c = califs[i] || {};
                    const punt = typeof c.puntaje === 'number' ? c.puntaje : Number.isFinite(Number(c.puntaje)) ? Number(c.puntaje) : null;
                    if (punt == null) continue; // ignorar sin puntaje válido
                    const key = c.clase_id != null ? `clase:${c.clase_id}` : `materia:${c.materia || i}`;
                    if (!mapaUnicos.has(key)) {
                        mapaUnicos.set(key, { puntaje: punt, materia: c.materia, clase_id: c.clase_id });
                    }
                }
                const regs = Array.from(mapaUnicos.values());
                if (regs.length > 0) {
                    const suma = regs.reduce((acc, r) => acc + (typeof r.puntaje === 'number' ? r.puntaje : 0), 0);
                    const promedio = suma / regs.length;
                    setText('promedio-general', promedio.toFixed(2));
                    console.log('✅ Promedio dinámico mostrado:', promedio.toFixed(2), 'con', regs.length, 'materias evaluadas');
                } else {
                    setText('promedio-general', '-');
                    console.log('ℹ️ Sin calificaciones válidas para promedio');
                }

                // Créditos dinámicos: cada materia evaluada vale 5 créditos. Máximo total: 290.
                const creditos = regs.length * 5;
                setText('creditos-text', `${creditos} / 290`);
                console.log('🎓 Créditos calculados:', creditos, '/ 290');

                // Render de materias actuales
                const tbody = document.getElementById('materias-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    (materias || []).forEach(m => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${m.materia || '-'}</td>
                            <td>${m.profesor || '-'}</td>
                            <td>${m.promedio_materia != null ? `<strong>${m.promedio_materia}</strong>` : '-'}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error('Error cargando dashboard:', e);
            }
        })();
    }

    // Información personal
    if (pathname.endsWith('/Pagina2/informacion-personal.html')) {
        (async () => {
            try {
                const [det, docs] = await Promise.all([
                    fetchJSON(`/api/estudiantes/${user.id}`),
                    fetchJSON(`/api/estudiantes/${user.id}/documentos`)
                ]);
                // El endpoint ahora devuelve directamente el estudiante
                const e = det.estudiante || det || {};

                // Perfil
                const foto = document.getElementById('perfil-foto');
                if (foto) foto.src = e.foto_url || 'https://via.placeholder.com/200';
                setText('perfil-nombre', e.nombre || user.nombre || '-');
                setText('perfil-matricula', e.matricula || user.matricula || '-');
                setText('perfil-grado', e.grado || '-');
                setText('perfil-promedio', e.promedio != null ? Number(e.promedio).toFixed(2) : '-');

                // Datos personales
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('dp-nombre', e.nombre);
                setVal('dp-curp', e.curp);
                setVal('dp-fecha-nac', e.fecha_nacimiento || '');
                setVal('dp-lugar-nac', e.lugar_nacimiento);
                setVal('dp-correo', e.correo_institucional);
                setVal('dp-telefono', e.telefono);

                // Académico
                setVal('ac-carrera', e.carrera);
                setVal('ac-plan', e.plan_estudios);
                setVal('ac-especialidad', e.especialidad_academica);
                setVal('ac-tutor', e.tutor_academico);

                // Documentos
                const container = document.getElementById('docs-container');
                if (container) {
                    container.innerHTML = '';
                    (docs.documentos || []).forEach(d => {
                        const div = document.createElement('div');
                        div.className = 'document-item d-flex justify-content-between align-items-center';
                        div.innerHTML = `
                            <div>
                                <i class="fas fa-file-alt text-primary"></i>
                                <span class="ms-2">${d.tipo || 'Documento'}</span>
                            </div>
                            <a class="btn btn-sm btn-outline-primary" target="_blank" href="${d.archivo_url}">Ver</a>
                        `;
                        container.appendChild(div);
                    });
                    if (!docs.documentos || docs.documentos.length === 0) {
                        container.innerHTML = '<em class="text-muted">Sin documentos</em>';
                    }
                }
            } catch (e) {
                console.error('Error cargando información personal:', e);
            }
        })();
    }

    // Calificaciones
    if (pathname.endsWith('/Pagina2/calificaciones.html')) {
        (async () => {
            try {
                const data = await fetchJSON(`/api/estudiantes/${user.id}/calificaciones`);
                const califs = data.calificaciones || [];
                const tbody = document.querySelector('#grades-table tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                    califs.forEach((g, idx) => {
                        const tr = document.createElement('tr');
                        const id = 'g' + idx;
                        tr.innerHTML = `
                            <td>${g.materia || '-'}</td>
                            <td>${g.profesor || '-'}</td>
                            <td class="text-center"><strong>${g.puntaje != null ? g.puntaje : '-'}</strong></td>
                            <td class="observacion-cell">${g.observacion ? escapeHtml(g.observacion) : '<em class="text-muted">Sin observaciones</em>'}</td>
                            <td class="text-center d-flex gap-2 justify-content-center">
                                <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${id}" data-materia="${escapeHtml(g.materia || '-')}"><i class="fas fa-sticky-note"></i> Nota</button>
                                <button class="btn btn-sm btn-outline-primary btn-message" data-clase-id="${g.clase_id || ''}" data-materia="${escapeHtml(g.materia || '-')}"><i class="fas fa-envelope"></i> Mensaje</button>
                            </td>`;
                        tbody.appendChild(tr);
                    });

                    // Botón Nota (local)
                    document.querySelectorAll('.btn-edit').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const id = this.getAttribute('data-id');
                            const materia = this.getAttribute('data-materia');
                            const saved = JSON.parse(localStorage.getItem('observaciones') || '{}');
                            document.getElementById('modal-materia').value = materia;
                            document.getElementById('modal-observacion').value = saved[id] || '';
                            document.getElementById('modal-save').setAttribute('data-id', id);
                            var modal = new bootstrap.Modal(document.getElementById('obsModal'));
                            modal.show();
                        });
                    });

                    // Botón Mensaje -> abrir modal
                    document.querySelectorAll('.btn-message').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const claseId = this.getAttribute('data-clase-id');
                            const materia = this.getAttribute('data-materia') || '';
                            document.getElementById('q-clase-id').value = claseId || '';
                            document.getElementById('q-materia').value = materia;
                            document.getElementById('q-mensaje').value = '';
                            var modal = new bootstrap.Modal(document.getElementById('questionModal'));
                            modal.show();
                        });
                    });

                    // Enviar mensaje al profesor
                    const qBtn = document.getElementById('question-send');
                    if (qBtn && !qBtn.dataset.hooked) {
                        qBtn.dataset.hooked = '1';
                        qBtn.addEventListener('click', async function() {
                            const claseId = document.getElementById('q-clase-id').value;
                            const mensaje = document.getElementById('q-mensaje').value.trim();
                            if (!claseId) return alert('No se encontró la clase de la calificación.');
                            if (!mensaje) return alert('Escribe un mensaje.');
                            try {
                                const resp = await fetch('/api/calificaciones/pregunta', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ estudiante_id: user.id, clase_id: Number(claseId), mensaje })
                                });
                                const out = await resp.json().catch(()=>({}));
                                if (!resp.ok || !out.ok) throw new Error(out.error || 'No se pudo enviar el mensaje');
                                showToast('Mensaje enviado al profesor');
                                const modalEl = document.getElementById('questionModal');
                                const modal = bootstrap.Modal.getInstance(modalEl);
                                modal && modal.hide();
                            } catch (err) {
                                alert('Error al enviar mensaje: ' + err.message);
                            }
                        });
                    }

                    // Descargar PDF
                    const btnPdf = document.getElementById('download-pdf');
                    if (btnPdf) {
                        btnPdf.addEventListener('click', function() {
                            try {
                                // jsPDF v2 UMD
                                const { jsPDF } = window.jspdf || {};
                                if (!jsPDF || !window.jspdf || !('autoTable' in (window.jspdf || {}))) {
                                    // algunos bundles exponen autoTable en prototipo, verificamos método
                                }
                                const doc = new jsPDF('p', 'pt');
                                doc.setFontSize(14);
                                doc.text('Calificaciones', 40, 40);
                                const rows = califs.map(g => [
                                    g.materia || '-',
                                    g.profesor || '-',
                                    g.puntaje != null ? String(g.puntaje) : '-',
                                    g.observacion ? String(g.observacion) : ''
                                ]);
                                if (doc.autoTable) {
                                    doc.autoTable({
                                        head: [['Materia', 'Profesor', 'Puntaje', 'Observación']],
                                        body: rows,
                                        startY: 60,
                                        styles: { fontSize: 10, cellPadding: 6 }
                                    });
                                }
                                doc.save('calificaciones.pdf');
                            } catch (e) {
                                alert('No se pudo generar el PDF: ' + e.message);
                            }
                        });
                    }
                }

                // Cargar respuestas de profesores a preguntas de calificaciones
                try {
                    const resResp = await fetchJSON(`/api/estudiantes/${user.id}/mensajes-respuestas`);
                    const respuestas = resResp.mensajes || [];
                    const tbodyR = document.querySelector('#replies-table tbody');
                    const noR = document.getElementById('no-replies');
                    if (tbodyR) {
                        tbodyR.innerHTML = '';
                        if (respuestas.length === 0) {
                            if (noR) noR.style.display = 'block';
                        } else {
                            if (noR) noR.style.display = 'none';
                            respuestas.forEach(r => {
                                const tr = document.createElement('tr');
                                const fecha = r.respuesta_fecha ? new Date(r.respuesta_fecha).toLocaleString() : (r.fecha_pregunta ? new Date(r.fecha_pregunta).toLocaleString() : '');
                                tr.innerHTML = `
                                    <td>${escapeHtml(fecha)}</td>
                                    <td>${escapeHtml(r.clase_nombre || r.materia || '')}</td>
                                    <td style="max-width:360px;">${r.pregunta ? escapeHtml(r.pregunta) : '<em class="text-muted">(sin texto)</em>'}</td>
                                    <td style="max-width:360px;">${r.respuesta ? escapeHtml(r.respuesta) : '<em class="text-muted">Sin respuesta</em>'}</td>
                                `;
                                tbodyR.appendChild(tr);
                            });
                        }
                    }
                } catch (e) {
                    console.warn('No se pudieron cargar respuestas:', e);
                }
            } catch (e) {
                console.error('Error cargando calificaciones:', e);
            }
        })();
    }

    // Horario
    if (pathname.endsWith('/Pagina2/horario.html')) {
        (async () => {
            try {
                const data = await fetchJSON(`/api/estudiantes/${user.id}/horario`);
                const tbody = document.getElementById('horario-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    // Agrupar por hora (inicio-fin) para filas y por día para columnas
                    // Para simplificar, listamos una fila por registro
                    (data.horario || []).forEach(h => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="text-center hora">${h.inicio?.slice(0,5)} - ${h.fin?.slice(0,5)}</td>
                            <td colspan="5" class="horario-cell">
                                <div class="materia">${h.materia || '-'}</div>
                                <div class="profesor">${h.profesor || ''} • ${h.dia || ''}</div>
                                <div class="aula">${h.aula || ''}</div>
                            </td>`;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error('Error cargando horario:', e);
            }
        })();
    }

    // Documentos (página dedicada)
    if (pathname.endsWith('/Pagina2/documentos.html')) {
        (async () => {
            try {
                const data = await fetchJSON(`/api/estudiantes/${user.id}/documentos`);
                const cont = document.getElementById('docs-dinamicos');
                if (cont) {
                    cont.innerHTML = '';
                    (data.documentos || []).forEach(d => {
                        const item = document.createElement('div');
                        item.className = 'document-item d-flex align-items-center p-3 border-bottom';
                        item.innerHTML = `
                            <i class="fas fa-file-alt text-primary fa-2x me-3"></i>
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${d.tipo || 'Documento'}</h6>
                                <small class="text-muted">${d.creado_at ? new Date(d.creado_at).toLocaleString() : ''}</small>
                            </div>
                            <div class="btn-group">
                                <a class="btn btn-outline-primary btn-sm" href="${d.archivo_url}" target="_blank"><i class="fas fa-download"></i></a>
                                <a class="btn btn-outline-secondary btn-sm" href="${d.archivo_url}" target="_blank"><i class="fas fa-eye"></i></a>
                            </div>`;
                        cont.appendChild(item);
                    });
                    if (!data.documentos || data.documentos.length === 0) {
                        cont.innerHTML = '<div class="text-center text-muted p-4">Sin documentos registrados.</div>';
                    }
                }
            } catch (e) {
                console.error('Error cargando documentos:', e);
            }
        })();
    }

    // La subida de foto ahora se maneja con preview y ajuste en los modales incrustados en index.html e informacion-personal.html

    // Mostrar banner si no tiene contraseña
    const banner = document.getElementById('set-password-banner');
    if (banner && user.hasPassword === false) {
        banner.style.display = 'block';
    }

    // Al abrir el modal, elegir formulario según tenga contraseña
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        passwordModal.addEventListener('show.bs.modal', function () {
            const formSet = document.getElementById('form-set-password');
            const formChange = document.getElementById('form-change-password');
            const hasPwd = !!user.hasPassword;
            if (formSet && formChange) {
                formSet.style.display = hasPwd ? 'none' : 'block';
                formChange.style.display = hasPwd ? 'block' : 'none';
            }
        });
    }

    // Establecer contraseña
    const formSet = document.getElementById('form-set-password');
    if (formSet) {
        formSet.addEventListener('submit', async function(e) {
            e.preventDefault();
            const curp = document.getElementById('curp').value.trim();
            const p1 = document.getElementById('newPassword1').value;
            const p2 = document.getElementById('newPassword2').value;
            if (p1.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');
            if (p1 !== p2) return alert('Las contraseñas no coinciden');
            try {
                const resp = await fetch('/api/estudiantes/set-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matricula: user.matricula, curp, newPassword: p1 })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.ok) {
                    return alert(data.error || 'No se pudo establecer la contraseña');
                }
                user.hasPassword = true;
                sessionStorage.setItem('user', JSON.stringify(user));
                if (banner) banner.style.display = 'none';
                showToast('Contraseña establecida');
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(passwordModal);
                modal && modal.hide();
            } catch (err) {
                alert('Error de conexión con el servidor');
            }
        });
    }

    // Cambiar contraseña
    const formChange = document.getElementById('form-change-password');
    if (formChange) {
        formChange.addEventListener('submit', async function(e) {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const p1 = document.getElementById('newPassword3').value;
            const p2 = document.getElementById('newPassword4').value;
            if (p1.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');
            if (p1 !== p2) return alert('Las contraseñas no coinciden');
            try {
                const resp = await fetch('/api/estudiantes/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matricula: user.matricula, currentPassword, newPassword: p1 })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.ok) {
                    return alert(data.error || 'No se pudo cambiar la contraseña');
                }
                showToast('Contraseña actualizada');
                const modal = bootstrap.Modal.getInstance(passwordModal);
                modal && modal.hide();
            } catch (err) {
                alert('Error de conexión con el servidor');
            }
        });
    }
});

// Función para mostrar/ocultar el menú en dispositivos móviles
const navbarToggler = document.querySelector('.navbar-toggler');
if (navbarToggler) {
    navbarToggler.addEventListener('click', function() {
        const navbarCollapse = document.querySelector('.navbar-collapse');
        if (navbarCollapse) {
            navbarCollapse.classList.toggle('show');
        }
    });
}

// Función utilitaria para mostrar toasts sencillos
function showToast(message, timeout = 3306) {
    // Crear contenedor si no existe
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '2000';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-bg-primary border-0 show';
    toast.role = 'alert';
    toast.ariaLive = 'assertive';
    toast.ariaAtomic = 'true';
    toast.style.minWidth = '200px';
    toast.style.marginTop = '8px';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
        </div>`;

    container.appendChild(toast);

    // Cerrar al pulsar cerrar
    toast.querySelector('.btn-close').addEventListener('click', function() {
        toast.remove();
    });

    // Auto cerrar
    setTimeout(() => {
        toast.remove();
    }, timeout);
}

// Utilidad para escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>\"']/g, function(m) { return map[m]; });
}