✅ Proyecto: EvetoProyecto

📦 Estructura:
- public/ → Contiene todos los archivos HTML, imágenes y scripts del frontend
- server.js → Servidor Express que conecta con PostgreSQL

🚀 Instrucciones para ejecutar:

1. Asegúrate de tener Node.js y PostgreSQL instalados.
2. Abre la terminal en la carpeta del proyecto.
3. Ejecuta: npm install
4. Luego: node server.js
5. Abre el navegador en: http://localhost:8080/register.html

⚙️ Base de datos:
- Nombre: EvenetosBase
- Tabla esperada: usuarios(username, password_hash)
- Puerto: 5432
- Usuario: postgres
- Contraseña: 1234

✉️ Soporte de rutas:
- POST /registro
- POST /evento
