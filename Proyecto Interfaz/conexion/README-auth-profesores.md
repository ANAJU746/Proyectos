# Sistema de Autenticación de Profesores

## Cambios Implementados

Se ha implementado un sistema completo de autenticación con contraseña para profesores, similar al sistema de estudiantes.

### 1. Cambios en la Base de Datos

Se agregó la columna `password_hash` a la tabla `profesores`:

```sql
ALTER TABLE profesores 
ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL AFTER materia;
```

✅ **Esta columna ya fue agregada automáticamente al ejecutar el script de demostración.**

### 2. Nuevos Endpoints en el Servidor

#### **POST /api/profesores/set-password**
Establece la contraseña inicial para un profesor (primera vez).

**Requisitos:**
- `codigo_profesor`: Código del profesor
- `correo`: Correo electrónico del profesor
- `newPassword`: Nueva contraseña

**Ejemplo:**
```json
POST http://localhost:3000/api/profesores/set-password
{
  "codigo_profesor": "PROF001",
  "correo": "jperez@ejemplo.edu.mx",
  "newPassword": "demo123"
}
```

#### **POST /api/profesores/change-password**
Cambia la contraseña de un profesor existente.

**Requisitos:**
- `profesor_id`: ID del profesor
- `currentPassword`: Contraseña actual
- `newPassword`: Nueva contraseña

**Ejemplo:**
```json
POST http://localhost:3000/api/profesores/change-password
{
  "profesor_id": 1,
  "currentPassword": "demo123",
  "newPassword": "nueva123"
}
```

#### **POST /api/login (Actualizado)**
El endpoint de login ahora valida la contraseña de los profesores.

**Para maestros:**
```json
POST http://localhost:3000/api/login
{
  "tipo": "maestro",
  "username": "PROF001",  // o correo
  "password": "demo123"
}
```

### 3. Flujo de Login para Profesores

1. El profesor accede a `http://localhost:3000`
2. Selecciona el botón "Maestro"
3. Ingresa su código de profesor (o correo) y contraseña
4. Si las credenciales son correctas, se redirige a `http://localhost:3000/Pagina5/index.html`
5. En la página 5, el profesor ve:
   - Su nombre y bienvenida
   - Sus clases asignadas
   - Los horarios de cada clase
   - Información del aula
   - Puede exportar sus horarios a PDF

### 4. Profesor de Demostración

Se ha configurado un profesor de prueba con contraseña:

**Credenciales:**
- **Código:** PROF001
- **Correo:** jperez@ejemplo.edu.mx
- **Contraseña:** demo123
- **Nombre:** Dr. Juan Carlos Pérez Mendoza

### 5. Configurar Contraseñas para Profesores Existentes

#### Opción A: Usando el script de Node.js

Ejecutar el script `setup-profesor-demo.js`:

```bash
cd conexion
node setup-profesor-demo.js
```

#### Opción B: Manualmente con SQL y bcrypt

1. Generar el hash de la contraseña usando Node.js:

```javascript
const bcrypt = require('bcryptjs');
const password = 'micontraseña';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

2. Actualizar la base de datos:

```sql
UPDATE profesores 
SET password_hash = '$2a$10$....' 
WHERE codigo_profesor = 'PROF002';
```

#### Opción C: Usando el endpoint set-password

Con Postman o cualquier cliente HTTP:

```json
POST http://localhost:3000/api/profesores/set-password
Content-Type: application/json

{
  "codigo_profesor": "PROF002",
  "correo": "mrodriguez@ejemplo.edu.mx",
  "newPassword": "password123"
}
```

### 6. Seguridad Implementada

✅ **Hashing con bcrypt:** Las contraseñas se almacenan encriptadas con bcrypt (10 rounds)
✅ **Validación en login:** Se verifica el hash de la contraseña antes de permitir el acceso
✅ **Protección de endpoints:** Los endpoints de cambio de contraseña requieren validación
✅ **Verificación de identidad:** set-password requiere código + correo para seguridad
✅ **Sin contraseñas en texto plano:** Nunca se almacenan contraseñas sin encriptar

### 7. Migración de Profesores Existentes

Si ya tienes profesores en la base de datos sin contraseña:

1. La columna `password_hash` será NULL
2. El profesor NO podrá iniciar sesión hasta que se le asigne una contraseña
3. Usar cualquiera de las opciones anteriores para establecer contraseñas

### 8. Estructura de Archivos Modificados

```
conexion/
├── server.js                    # Endpoints de autenticación agregados
├── Sql.sql                      # Esquema actualizado con password_hash
├── setup-profesor-demo.js       # Script de configuración (NUEVO)
└── README-auth-profesores.md    # Este archivo (NUEVO)

Pagina1/
└── js/
    └── script.js                # Redirect corregido: maestro → Pagina5

Pagina5/
└── js/
    └── app.js                   # Carga datos de profesores desde API
```

### 9. Testing

#### Test 1: Login exitoso
1. Ir a `http://localhost:3000`
2. Click en "Maestro"
3. Ingresar: PROF001 / demo123
4. ✅ Debe redirigir a Pagina5 y mostrar clases

#### Test 2: Login fallido
1. Ir a `http://localhost:3000`
2. Click en "Maestro"
3. Ingresar: PROF001 / wrongpassword
4. ✅ Debe mostrar "Credenciales inválidas"

#### Test 3: Profesor sin contraseña
1. Crear profesor sin password_hash
2. Intentar login
3. ✅ Debe permitir login (para compatibilidad)

#### Test 4: Cambiar contraseña
1. Login con PROF001 / demo123
2. Llamar a change-password endpoint
3. Logout e intentar login con nueva contraseña
4. ✅ Debe funcionar

### 10. Próximos Pasos Sugeridos

- [ ] Crear UI para que profesores cambien su propia contraseña
- [ ] Implementar recuperación de contraseña por correo
- [ ] Agregar validación de fortaleza de contraseña
- [ ] Implementar sistema de "Remember Me" con tokens
- [ ] Agregar límite de intentos de login
- [ ] Implementar sesiones con tiempo de expiración

## Soporte

Si encuentras algún problema:
1. Verifica que la columna `password_hash` exista en la tabla `profesores`
2. Asegúrate de que el servidor esté corriendo en puerto 3000
3. Revisa la consola del navegador para errores de JavaScript
4. Verifica las credenciales del profesor en la base de datos
