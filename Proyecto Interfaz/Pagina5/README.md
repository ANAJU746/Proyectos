# Panel del Maestro (SPA estática)

Esta es una pequeña aplicación estática (HTML/CSS/JS) para gestionar grupos, alumnos y asignaciones desde el rol de maestro.

Características:

- Crear/Editar/Eliminar grupos
- Crear/Editar/Eliminar alumnos
- Asignar alumnos a grupos
- Persistencia en localStorage
- Exportar asignaciones a PDF (desde el botón "PDF")

Cómo usar:

1. Abrir `index.html` en el navegador.
2. Crear grupos en la columna "Grupos".
3. Crear alumnos en la columna "Alumnos".
4. Usar "Asignaciones" para emparejar alumno y grupo.
5. Usar el botón "PDF" para descargar un informe de las asignaciones.

Notas y mejoras posibles:

- Agregar backend y autenticación.
- Importación masiva de alumnos por CSV.
- Paginación y filtros avanzados.

Diseño visual:

- La interfaz ha sido rediseñada para un look minimalista pero llamativo: gradientes, sombras suaves y animaciones sutiles.

Prueba rápida del nuevo estilo:

1. Abre `index.html` en un navegador moderno.
2. Verás una columna lateral con los grupos del maestro (acordeón). Haz click para expandir.
3. Selecciona un grupo y añade alumnos con el botón "Agregar alumno" en el panel.
4. Guarda notas y comentarios, luego usa el botón "PDF" para descargar el informe.

