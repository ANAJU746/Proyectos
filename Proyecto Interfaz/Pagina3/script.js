function validateLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('error-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    if (!username || !password) {
        errorMessage.style.color = '#e74c3c';
        errorMessage.textContent = 'Por favor completa todos los campos';
        return false;
    }

    // Deshabilitar botón mientras se procesa
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Validando...';
    errorMessage.textContent = '';

    // Llamar al backend para autenticar admin
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'admin', username, password })
    })
    .then(res => res.json().catch(() => ({})))
    .then(data => {
        if (data && data.ok && data.user) {
            // Login exitoso
            sessionStorage.setItem('user', JSON.stringify(data.user));
            errorMessage.style.color = '#27ae60';
            errorMessage.textContent = 'Inicio de sesión exitoso';
            
            // Redirigir al panel de administración
            setTimeout(() => {
                window.location.href = '/Pagina4/index.html';
            }, 500);
        } else {
            // Login fallido
            errorMessage.style.color = '#e74c3c';
            errorMessage.textContent = data.error || 'Usuario o contraseña incorrectos';
            document.getElementById('password').value = '';
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    })
    .catch(err => {
        console.error('Error de conexión:', err);
        errorMessage.style.color = '#e74c3c';
        errorMessage.textContent = 'Error de conexión con el servidor';
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
    
    return false;
}