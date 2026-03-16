-- Insertar profesores de ejemplo
-- Puedes ejecutar este script en MySQL para tener datos de prueba

INSERT INTO profesores (codigo_profesor, nombre, correo, telefono, departamento, especialidad, grado_academico, materia, estado) VALUES
('PROF001', 'Dr. Juan Carlos Pérez Mendoza', 'jperez@ejemplo.edu.mx', '(993) 123-4567', 'Ciencias', 'Matemáticas Aplicadas', 'Doctorado', 'Cálculo Diferencial', 'activo'),
('PROF002', 'Dra. María Elena Rodríguez García', 'mrodriguez@ejemplo.edu.mx', '(993) 234-5678', 'Humanidades', 'Literatura Hispanoamericana', 'Doctorado', 'Literatura Universal', 'activo'),
('PROF003', 'Mtro. Roberto García Hernández', 'rgarcia@ejemplo.edu.mx', '(993) 345-6789', 'Tecnología', 'Sistemas Computacionales', 'Maestría', 'Programación Avanzada', 'activo'),
('PROF004', 'Mtra. Ana Sofía López Torres', 'alopez@ejemplo.edu.mx', '(993) 456-7890', 'Ingeniería', 'Ingeniería Industrial', 'Maestría', 'Procesos Industriales', 'activo'),
('PROF005', 'Dr. Carlos Enrique Martínez Cruz', 'cmartinez@ejemplo.edu.mx', '(993) 567-8901', 'Ciencias', 'Física Teórica', 'Doctorado', 'Física II', 'activo'),
('PROF006', 'Mtra. Laura Patricia Sánchez Díaz', 'lsanchez@ejemplo.edu.mx', '(993) 678-9012', 'Administración', 'Gestión Empresarial', 'Maestría', 'Administración Estratégica', 'activo'),
('PROF007', 'Mtro. José Luis Ramírez Flores', 'jramirez@ejemplo.edu.mx', '(993) 789-0123', 'Tecnología', 'Redes y Telecomunicaciones', 'Maestría', 'Redes de Computadoras', 'inactivo'),
('PROF008', 'Dra. Gabriela Fernández Morales', 'gfernandez@ejemplo.edu.mx', '(993) 890-1234', 'Humanidades', 'Psicología Educativa', 'Doctorado', 'Desarrollo Humano', 'activo');
