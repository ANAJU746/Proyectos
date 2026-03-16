# School Admin - Backend (Node.js + MySQL)

Conexión centralizada a MySQL en la carpeta `conexion/`. El servidor Express solo importa esa conexión.

Archivos relevantes:
- `Pagina4/server.js` — servidor Express con endpoints básicos.
- `conexion/conexion.js` — conexión MySQL (pool) con `mysql2/promise` y credenciales.
- `conexion/Sql.sql` — script SQL para crear la BD `school_db` y tablas.

Credenciales usadas (desarrollo):
- host: `localhost`
- puerto: `3306`
- usuario: `root`
- contraseña: `12345`
- base de datos: `school_db`

## Preparación

1) Instala dependencias en `Pagina4`:

```powershell
cmd /c "cd /d "c:\Users\anat1\OneDrive - Instituto Tecnológico de Villahermosa\Tareas 5to semeste\Ingenieria de Software\Proyecto Interfaz\Pagina4" && npm install"
```

2) Crea la base de datos con MySQL Workbench o CLI usando `conexion/Sql.sql`:

```powershell
# (opcional) con CLI, ajusta la ruta si cambia
cmd /c "mysql -u root -p12345 < "c:\Users\anat1\OneDrive - Instituto Tecnológico de Villahermosa\Tareas 5to semeste\Ingenieria de Software\Proyecto Interfaz\conexion\Sql.sql""
```

> Nota: El script ya usa `CREATE DATABASE school_db; USE school_db;`.

## Iniciar el servidor

```powershell
cmd /c "cd /d "c:\Users\anat1\OneDrive - Instituto Tecnológico de Villahermosa\Tareas 5to semeste\Ingenieria de Software\Proyecto Interfaz\Pagina4" && npm start"
```

El servidor quedará en `http://localhost:3000`.

## Endpoints
- GET `/api/health`
- GET `/api/estudiantes`
- POST `/api/estudiantes`
- GET `/api/profesores`
- GET `/api/clases`

## Notas
- Todos los detalles de conexión están solo en `conexion/conexion.js`.
- Si cambian las credenciales, edita ese archivo; no es necesario tocar `server.js`.
- El backend sirve archivos estáticos desde su carpeta actual (`app.use(express.static('.'))`). Para producción, separa frontend/backend o usa un proxy inverso.
