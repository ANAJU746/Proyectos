// Archivo compartido entre todas las páginas del panel de administrador
// Maneja el perfil, foto y datos del admin en todas las vistas

(function() {
    'use strict';

    // Verificar sesión de administrador
    function requireAdmin() {
        try {
            const u = JSON.parse(sessionStorage.getItem('user'));
            if (!u || u.role !== 'admin') {
                window.location.href = '/Pagina1/index.html';
                return null;
            }
            return u;
        } catch (_) {
            window.location.href = '/Pagina1/index.html';
            return null;
        }
    }

    // Cargar datos del perfil del administrador
    async function loadAdminProfile() {
        try {
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            if (!user || !user.id) return;

            const res = await fetch(`/api/usuarios/${user.id}`);
            const data = await res.json();

            if (data.ok && data.usuario) {
                const admin = data.usuario;
                
                // Actualizar nombre en sidebar
                const nameEl = document.getElementById('adminName');
                if (nameEl) {
                    nameEl.textContent = admin.nombre_completo || admin.username || 'Administrador';
                }

                // Actualizar foto en sidebar
                const imgEl = document.getElementById('adminProfileImage');
                if (imgEl) {
                    if (admin.foto_url) {
                        imgEl.src = admin.foto_url;
                    } else {
                        imgEl.src = 'https://via.placeholder.com/110/1e3a5f/ffffff?text=' + 
                                   (admin.nombre_completo ? admin.nombre_completo.charAt(0).toUpperCase() : 'A');
                    }
                }

                // Guardar datos actualizados en sessionStorage
                const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
                currentUser.nombre = admin.nombre_completo || admin.username;
                currentUser.foto_url = admin.foto_url;
                sessionStorage.setItem('user', JSON.stringify(currentUser));
            }
        } catch (err) {
            console.error('Error cargando perfil admin:', err);
        }
    }

    // Subir foto del administrador
    async function uploadAdminPhoto(file) {
        try {
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            if (!user || !user.id) {
                alert('No se encontró la sesión del usuario');
                return false;
            }

            const formData = new FormData();
            formData.append('foto', file);

            const res = await fetch(`/api/usuarios/${user.id}/foto`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!data.ok) {
                throw new Error(data.error || 'Error al subir la foto');
            }

            // Actualizar la imagen localmente
            if (data.foto_url) {
                const imgEl = document.getElementById('adminProfileImage');
                if (imgEl) {
                    imgEl.src = data.foto_url + '?t=' + Date.now(); // Cache bust
                }

                // Actualizar sessionStorage
                const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
                currentUser.foto_url = data.foto_url;
                sessionStorage.setItem('user', JSON.stringify(currentUser));
            }

            return true;
        } catch (err) {
            console.error('Error al subir foto:', err);
            alert('Error al subir la foto: ' + err.message);
            return false;
        }
    }

    // Configurar el evento de cambio de foto
    function setupPhotoUpload() {
        const profileImageContainer = document.getElementById('profileImageContainer');
        const fotoInput = document.getElementById('fotoInput');

        if (profileImageContainer && fotoInput) {
            profileImageContainer.addEventListener('click', () => {
                fotoInput.click();
            });

            fotoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validar tipo de archivo
                if (!file.type.startsWith('image/')) {
                    alert('Por favor selecciona un archivo de imagen válido');
                    return;
                }

                // Validar tamaño (máx 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('La imagen es muy grande. Por favor selecciona una imagen menor a 5MB');
                    return;
                }

                // Preview local inmediato
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const imgEl = document.getElementById('adminProfileImage');
                    if (imgEl) {
                        imgEl.src = ev.target.result;
                    }
                };
                reader.readAsDataURL(file);

                // Subir al servidor
                const success = await uploadAdminPhoto(file);
                if (success) {
                    // Mostrar mensaje de éxito (opcional)
                    console.log('Foto actualizada correctamente');
                }
            });
        }
    }

    // Marcar el enlace activo en la navegación
    function setActiveNavLink() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('nav a');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPage = link.getAttribute('href') || '';
            
            // Comparar la página actual con el href del enlace
            if (linkPage === currentPage || 
                (currentPage === 'index.html' && (linkPage === '#dashboard' || linkPage === 'index.html'))) {
                link.classList.add('active');
            }
        });
    }

    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        // Verificar sesión
        const user = requireAdmin();
        if (!user) return;

        // Cargar perfil
        loadAdminProfile();

        // Configurar cambio de foto
        setupPhotoUpload();

        // Marcar enlace activo
        setActiveNavLink();

        // Actualizar fecha
        const dateEl = document.querySelector('.date');
        if (dateEl) {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const today = new Date().toLocaleDateString('es-ES', options);
            dateEl.textContent = today;
        }

        // Configurar botón de cerrar sesión si existe
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    sessionStorage.removeItem('user');
                    // Si existiera un endpoint /api/logout se podría llamar aquí
                } catch (_) {}
                window.location.href = '/Pagina1/index.html';
            });
        }
    });

    // Exportar funciones para uso externo si es necesario
    window.AdminShared = {
        loadAdminProfile,
        uploadAdminPhoto,
        requireAdmin
    };
})();
