document.addEventListener('DOMContentLoaded', function() {
    // Manejo de los botones de tipo de usuario
    const userButtons = document.querySelectorAll('.user-btn');
    const loginBtn = document.querySelector('.login-btn');

    function updateLoginButtonColor(userType) {
        if (userType === 'maestro') {
            loginBtn.style.backgroundColor = 'var(--teacher-color)';
            loginBtn.style.setProperty('--hover-color', '#d63384');
        } else {
            loginBtn.style.backgroundColor = 'var(--student-color)';
            loginBtn.style.setProperty('--hover-color', '#357abd');
        }
    }

    userButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remover la clase active de todos los botones
            userButtons.forEach(btn => btn.classList.remove('active'));
            // Agregar la clase active al botón clickeado
            this.classList.add('active');
            // Actualizar color del botón de login
            updateLoginButtonColor(this.dataset.type);
        });
    });

    // Manejo del formulario de login
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const userType = document.querySelector('.user-btn.active').dataset.type;

        // Deshabilitar botón mientras se procesa
        const originalText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = 'Validando...';

        try {
            const resp = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo: userType, username, password })
            });

            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) {
                const msg = (data && data.error) ? data.error : 'No se pudo iniciar sesión';
                alert(msg);
                return;
            }

            // Guardar info mínima de sesión
            sessionStorage.setItem('user', JSON.stringify(data.user));

            // Redirigir según tipo
            if (userType === 'estudiante') {
                window.location.href = '/Pagina2/index.html';
            } else if (userType === 'maestro') {
                window.location.href = '/Pagina5/index.html';
            } else {
                window.location.href = '/Pagina2/index.html';
            }
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
            alert('Error de conexión con el servidor');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    });

    // Efectos visuales en los inputs
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.borderColor = '#4a90e2';
        });

        input.addEventListener('blur', function() {
            this.parentElement.style.borderColor = '#ddd';
        });
    });
    // ---- Animación splash ----
    const splash = document.getElementById('splash-overlay');
    const splashLogo = document.getElementById('splashLogo');
    const headerLogo = document.querySelector('.logo-img');

    function animateSplashToHeader() {
        if (!splash || !splashLogo || !headerLogo) {
            // Si falta algún elemento, simplemente ocultamos el overlay
            if (splash) splash.classList.add('hidden');
            return;
        }

        // Ocultamos el logo del header mientras anima el splash para evitar doble logo visual
        headerLogo.style.opacity = '0';

        // Calcular la posición final del logo en el header (centro del elemento headerLogo)
        const headerRect = headerLogo.getBoundingClientRect();
        const splashRect = splashLogo.getBoundingClientRect();

        const tx = headerRect.left + headerRect.width / 2 - (splashRect.left + splashRect.width / 2);
        const ty = headerRect.top + headerRect.height / 2 - (splashRect.top + splashRect.height / 2);

        // Aplicar variables CSS para la transformación
        splashLogo.style.setProperty('--tx', tx + 'px');
        splashLogo.style.setProperty('--ty', ty + 'px');

        // Forzar reflow y luego agregar la clase para iniciar la transición
        // (se usa requestAnimationFrame para asegurar que el cambio se aplique)
        requestAnimationFrame(() => {
            // Listener de finalización para mayor confiabilidad
            const onTransitionEnd = () => {
                // Mostramos el logo del header y ocultamos el overlay
                headerLogo.style.opacity = '1';
                splash.classList.add('hidden');
                // Retiramos el listener y, opcional, removemos el overlay del DOM
                splashLogo.removeEventListener('transitionend', onTransitionEnd);
                setTimeout(() => {
                    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
                }, 650);
            };
            splashLogo.addEventListener('transitionend', onTransitionEnd, { once: true });

            // Iniciar animación
            splashLogo.classList.add('to-header');

            // Fallback de seguridad por si no dispara transitionend (por ejemplo, navegadores antiguos)
            setTimeout(() => {
                if (!splash.classList.contains('hidden')) {
                    onTransitionEnd();
                }
            }, 1400);
        });
    }

    // Iniciar la animación al cargar con retraso mayor para que el GIF se vea más tiempo
    setTimeout(animateSplashToHeader, 1400);

    // ===== Recuperación de contraseña =====
    const forgotLink = document.getElementById('forgotLink');
    const recoverModal = document.getElementById('recoverModal');
    const recoverClose = document.getElementById('recoverClose');
    const recoverCancel = document.getElementById('recoverCancel');
    const recoverForm = document.getElementById('recoverForm');
    const recoverTipo = document.getElementById('recoverTipo');
    const recoverIdent = document.getElementById('recoverIdent');
    const lblIdent = document.getElementById('lblIdentificacion');
    const recoverCorreo = document.getElementById('recoverCorreo');
    const recoverTel = document.getElementById('recoverTel');
    const recoverNota = document.getElementById('recoverNota');
    const recoverSubmit = document.getElementById('recoverSubmit');

    function currentUserType(){
        const active = document.querySelector('.user-btn.active');
        return active ? active.dataset.type : 'estudiante';
    }
    function setupRecoverForm(){
        const tipo = currentUserType();
        recoverTipo.value = tipo;
        if (tipo === 'maestro'){
            lblIdent.textContent = 'Código del profesor';
            recoverIdent.placeholder = 'Ej: PROF001';
            recoverSubmit.style.backgroundColor = 'var(--teacher-color)';
        } else {
            lblIdent.textContent = 'Matrícula';
            recoverIdent.placeholder = 'Ej: 2023001';
            recoverSubmit.style.backgroundColor = 'var(--student-color)';
        }
        recoverForm.reset();
    }
    function openRecover(){
        setupRecoverForm();
        recoverModal.classList.add('show');
        recoverModal.setAttribute('aria-hidden','false');
        recoverIdent.focus();
    }
    function closeRecover(){
        recoverModal.classList.remove('show');
        recoverModal.setAttribute('aria-hidden','true');
    }
    if (forgotLink){
        forgotLink.addEventListener('click', (e)=>{ e.preventDefault(); openRecover(); });
    }
    if (recoverClose) recoverClose.addEventListener('click', closeRecover);
    if (recoverCancel) recoverCancel.addEventListener('click', closeRecover);
    if (recoverModal){
        recoverModal.addEventListener('click', (e)=>{ if(e.target === recoverModal) closeRecover(); });
    }

    if (recoverForm){
        recoverForm.addEventListener('submit', async (e)=>{
            e.preventDefault();
            const payload = {
                tipo: recoverTipo.value,
                identificacion: recoverIdent.value.trim(),
                correo: recoverCorreo.value.trim(),
                telefono: recoverTel.value.trim(),
                comentario: recoverNota.value.trim()
            };
            if (!payload.identificacion || !payload.correo || !payload.telefono){
                alert('Completa matrícula/código, correo y teléfono.');
                return;
            }
            recoverSubmit.disabled = true;
            const old = recoverSubmit.textContent;
            recoverSubmit.textContent = 'Enviando...';
            try{
                const resp = await fetch('/api/recuperacion',{
                    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
                });
                const data = await resp.json().catch(()=>({}));
                if (!resp.ok || !data.ok){
                    const msg = (data && data.error) ? data.error : 'No se pudo enviar la solicitud';
                    alert(msg);
                    return;
                }
                alert('Solicitud enviada. El administrador te contactará.');
                closeRecover();
            }catch(err){
                console.error('Error al enviar recuperación:', err);
                alert('Error de conexión con el servidor');
            }finally{
                recoverSubmit.disabled = false;
                recoverSubmit.textContent = old;
            }
        });
    }
});