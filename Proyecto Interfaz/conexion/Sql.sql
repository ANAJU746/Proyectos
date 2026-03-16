-- Esquema MySQL para el proyecto "Proyecto Interfaz"


DROP DATABASE IF EXISTS school_db;
CREATE DATABASE school_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_db;

-- Tabla: profesores
CREATE TABLE profesores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_profesor VARCHAR(50) DEFAULT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  correo VARCHAR(150) DEFAULT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  departamento VARCHAR(150) DEFAULT NULL,
  especialidad VARCHAR(150) DEFAULT NULL,
  grado_academico VARCHAR(80) DEFAULT NULL,
  materia VARCHAR(150) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  estado ENUM('activo','inactivo') DEFAULT 'activo',
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Si la tabla ya existe, agregar la columna password_hash:
-- ALTER TABLE profesores ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL AFTER materia;

-- Tabla: estudiantes
CREATE TABLE estudiantes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(300) NOT NULL,
  curp VARCHAR(25) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  fecha_nacimiento DATE DEFAULT NULL,
  lugar_nacimiento VARCHAR(200) DEFAULT NULL,
  correo_institucional VARCHAR(200) DEFAULT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  grado VARCHAR(50) DEFAULT NULL,
  grupo VARCHAR(50) DEFAULT NULL,
  carrera VARCHAR(200) DEFAULT NULL,
  plan_estudios VARCHAR(100) DEFAULT NULL,
  especialidad_academica VARCHAR(150) DEFAULT NULL,
  tutor_academico VARCHAR(200) DEFAULT NULL,
  foto_url VARCHAR(500) DEFAULT NULL,
  promedio DECIMAL(5,2) DEFAULT NULL,
  estado ENUM('activo','inactivo') DEFAULT 'activo',
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla: clases
CREATE TABLE clases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  codigo VARCHAR(100) DEFAULT NULL UNIQUE,
  profesor_id INT UNSIGNED DEFAULT NULL,
  aula VARCHAR(100) DEFAULT NULL,
  cupo_maximo INT UNSIGNED DEFAULT NULL,
  semestre VARCHAR(50) DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,
  estado ENUM('activa','inactiva') DEFAULT 'activa',
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clases_profesor FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Tabla: horarios de clase (varias filas por clase para días y horas)
CREATE TABLE class_schedules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clase_id INT UNSIGNED NOT NULL,
  dia ENUM('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado') NOT NULL,
  inicio TIME DEFAULT NULL,
  fin TIME DEFAULT NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_clase FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Tabla: inscripciones (relación estudiante-clase)
CREATE TABLE inscripciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT UNSIGNED NOT NULL,
  clase_id INT UNSIGNED NOT NULL,
  semestre VARCHAR(50) DEFAULT NULL,
  estado ENUM('activa','inactiva') DEFAULT 'activa',
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_insc_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_insc_clase FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_inscripcion (estudiante_id, clase_id)
) ENGINE=InnoDB;

-- Tabla: calificaciones
CREATE TABLE calificaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT UNSIGNED NOT NULL,
  clase_id INT UNSIGNED DEFAULT NULL,
  puntaje DECIMAL(6,2) DEFAULT NULL,
  observacion TEXT DEFAULT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_calif_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_calif_clase FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Tabla: usuarios (opcional para autenticar si se necesitara)
-- Tabla: usuarios (administradores / cuentas de acceso)
CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  nombre_completo VARCHAR(300) DEFAULT NULL,
  email VARCHAR(200) DEFAULT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','profesor','estudiante','user') DEFAULT 'user',
  is_active TINYINT(1) DEFAULT 1,
  ultimo_login TIMESTAMP NULL DEFAULT NULL,
  intentos_fallidos INT UNSIGNED DEFAULT 0,
  bloqueado_hasta TIMESTAMP NULL DEFAULT NULL,
  token_recuperacion VARCHAR(100) DEFAULT NULL,
  token_recuperacion_expira TIMESTAMP NULL DEFAULT NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla: sesiones (para manejar sesiones activas)
CREATE TABLE sesiones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  expira_at TIMESTAMP NOT NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Datos de ejemplo mínimos
INSERT INTO profesores (nombre, correo, telefono, materia) VALUES
('Dr. García', 'garcia@ejemplo.com', '555-0101', 'Matemáticas');

INSERT INTO estudiantes (matricula, nombre, grado, grupo, promedio, estado, curp) VALUES
('A2025001', 'María Pérez', '5to', 'A', 9.2, 'activo', 'ABCD123456HDFRRN01');

INSERT INTO clases (nombre, codigo, profesor_id, descripcion) VALUES
('Matemáticas Avanzadas', 'MATH-101', 1, 'Clase de álgebra y cálculo básico');

INSERT INTO class_schedules (clase_id, dia, inicio, fin) VALUES
(1, 'Lunes', '08:00:00', '09:30:00'),
(1, 'Miércoles', '08:00:00', '09:30:00');

INSERT INTO calificaciones (estudiante_id, clase_id, puntaje, observacion) VALUES
(1, 1, 95.00, 'Excelente desempeño');

-- Inscripciones de ejemplo
INSERT INTO inscripciones (estudiante_id, clase_id, semestre, estado) VALUES
(1, 1, 'O2025', 'activa');

-- Usuario administrador de ejemplo (REEMPLAZA password_hash)
-- Genera un hash de contraseña en Node.js con bcrypt y sustituye el campo antes de usar en producción.
INSERT INTO usuarios (username, nombre_completo, email, password_hash, role, is_active) VALUES
('admin', 'Administrador del Sistema', 'admin@ejemplo.com', 'b0alo', 'admin', 1);

-- Tabla: documentos de estudiantes (referencia a archivos locales/URL)
CREATE TABLE documentos_estudiantes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(120) DEFAULT NULL,
  archivo_url VARCHAR(1000) NOT NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_estudiante FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Fin del esquema

-- =====================
-- NUEVA FUNCIONALIDAD: AVISOS
-- =====================
-- Tabla principal de avisos. Un aviso puede ser:
-- target_type = 'general'    -> mensaje general de un profesor a todos sus alumnos (visible para estudiantes inscritos en cualquiera de sus clases activas)
-- target_type = 'clase'      -> mensaje dirigido a una clase específica (clase_id)
-- target_type = 'estudiante' -> mensaje directo a un estudiante (estudiante_id)
-- fecha_programada: si se establece en el futuro, el aviso sólo se mostrará cuando NOW() >= fecha_programada
-- Se permite crear múltiples avisos por lote (uno por clase o estudiante) desde el endpoint para simplificar.

CREATE TABLE IF NOT EXISTS avisos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profesor_id INT UNSIGNED NOT NULL,
  target_type ENUM('estudiante','clase','general') NOT NULL,
  estudiante_id INT UNSIGNED NULL,
  clase_id INT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  contenido TEXT NOT NULL,
  fecha_programada DATETIME NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_av_prof FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_av_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_av_cls FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aviso_lecturas (
  aviso_id INT UNSIGNED NOT NULL,
  estudiante_id INT UNSIGNED NOT NULL,
  leido_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (aviso_id, estudiante_id),
  CONSTRAINT fk_avl_av FOREIGN KEY (aviso_id) REFERENCES avisos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_avl_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================
-- CATALOGO: AREAS Y MATERIAS
-- =====================
-- Áreas académicas para clasificar materias y especialidades de profesores
CREATE TABLE IF NOT EXISTS areas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL UNIQUE,
  descripcion VARCHAR(300) DEFAULT NULL
) ENGINE=InnoDB;

-- Catálogo de materias con asociación a un área
CREATE TABLE IF NOT EXISTS materias_catalogo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  codigo VARCHAR(100) DEFAULT NULL UNIQUE,
  area_id INT UNSIGNED NOT NULL,
  descripcion TEXT DEFAULT NULL,
  CONSTRAINT fk_mat_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Datos base de áreas
INSERT INTO areas (nombre, descripcion) VALUES
('Matemáticas', 'Área de cálculo, álgebra y ecuaciones'),
('Ciencias Básicas', 'Física, Química y biología básica'),
('Computación', 'Programación, bases de datos, redes'),
('Ingeniería de Software', 'Procesos, requisitos, pruebas'),
('Sistemas', 'Sistemas operativos, arquitectura'),
('Inteligencia Artificial', 'IA y aprendizaje automático')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- Materias del catálogo asociadas a áreas
INSERT INTO materias_catalogo (nombre, codigo, area_id, descripcion)
SELECT 'Cálculo Diferencial','CALC-101', a.id, 'Fundamentos de cálculo diferencial' FROM areas a WHERE a.nombre='Matemáticas'
UNION ALL SELECT 'Álgebra Lineal','ALG-102', a.id, 'Matrices y sistemas' FROM areas a WHERE a.nombre='Matemáticas'
UNION ALL SELECT 'Química','QUIM-103', a.id, 'Química general' FROM areas a WHERE a.nombre='Ciencias Básicas'
UNION ALL SELECT 'Fundamentos de Programación','PROG-104', a.id, 'Introducción a la programación' FROM areas a WHERE a.nombre='Computación'
UNION ALL SELECT 'Cálculo Integral','CALC-201', a.id, 'Integrales' FROM areas a WHERE a.nombre='Matemáticas'
UNION ALL SELECT 'Ecuaciones Diferenciales','CALC-202', a.id, 'Ecuaciones diferenciales' FROM areas a WHERE a.nombre='Matemáticas'
UNION ALL SELECT 'Física I','FIS-203', a.id, 'Mecánica clásica' FROM areas a WHERE a.nombre='Ciencias Básicas'
UNION ALL SELECT 'Estructura de Datos','PROG-204', a.id, 'Listas, árboles, grafos' FROM areas a WHERE a.nombre='Computación'
UNION ALL SELECT 'Base de Datos','BD-301', a.id, 'Diseño y gestión de BD' FROM areas a WHERE a.nombre='Computación'
UNION ALL SELECT 'POO','POO-302', a.id, 'Orientado a objetos' FROM areas a WHERE a.nombre='Computación'
UNION ALL SELECT 'Redes de Computadoras','RED-303', a.id, 'Fundamentos de redes' FROM areas a WHERE a.nombre='Computación'
UNION ALL SELECT 'Ingeniería de Software','IS-401', a.id, 'Procesos de software' FROM areas a WHERE a.nombre='Ingeniería de Software'
UNION ALL SELECT 'Sistemas Operativos','SO-402', a.id, 'Procesos y memoria' FROM areas a WHERE a.nombre='Sistemas'
UNION ALL SELECT 'Inteligencia Artificial','IA-501', a.id, 'Algoritmos de IA' FROM areas a WHERE a.nombre='Inteligencia Artificial'
UNION ALL SELECT 'Desarrollo Web','WEB-502', a.id, 'Frontend y backend web' FROM areas a WHERE a.nombre='Computación'
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), area_id = VALUES(area_id);

-- =====================
-- FUNCIONALIDAD: PLANES DE ESTUDIO
-- =====================
-- Tabla principal de planes de estudio. Un plan de estudio define un conjunto de materias
-- organizadas por semestre que un estudiante debe cursar en su carrera.

CREATE TABLE IF NOT EXISTS planes_estudio (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  carrera VARCHAR(200) NOT NULL,
  codigo VARCHAR(100) DEFAULT NULL UNIQUE,
  duracion_semestres INT UNSIGNED DEFAULT 6,
  creditos_totales INT UNSIGNED DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,
  estado ENUM('activo','inactivo') DEFAULT 'activo',
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de relación entre planes de estudio y clases (materias)
-- Define qué materias pertenecen a cada plan de estudio y en qué semestre se cursan
CREATE TABLE IF NOT EXISTS plan_estudio_materias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_estudio_id INT UNSIGNED NOT NULL,
  clase_id INT UNSIGNED NOT NULL,
  semestre INT UNSIGNED NOT NULL,
  creditos INT UNSIGNED DEFAULT 3,
  es_obligatoria TINYINT(1) DEFAULT 1,
  orden INT UNSIGNED DEFAULT 0,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pem_plan FOREIGN KEY (plan_estudio_id) REFERENCES planes_estudio(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pem_clase FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_plan_clase (plan_estudio_id, clase_id)
) ENGINE=InnoDB;

-- Datos de ejemplo de planes de estudio
INSERT INTO planes_estudio (nombre, carrera, codigo, duracion_semestres, creditos_totales, descripcion, estado) VALUES
('Plan Ingeniería en Sistemas 2024', 'Ingeniería en Sistemas Computacionales', 'ISC-2024', 9, 240, 'Plan de estudios actualizado para la carrera de Ingeniería en Sistemas Computacionales', 'activo'),
('Plan Ingeniería Industrial 2024', 'Ingeniería Industrial', 'IND-2024', 9, 235, 'Plan de estudios para Ingeniería Industrial con enfoque en optimización de procesos', 'activo'),
('Plan Ingeniería Mecatrónica 2024', 'Ingeniería Mecatrónica', 'MEC-2024', 9, 238, 'Plan de estudios de Ingeniería Mecatrónica con automatización y robótica', 'activo');

-- Agregar más clases de ejemplo para tener un catálogo completo
INSERT INTO clases (nombre, codigo, profesor_id, descripcion, semestre, estado) VALUES
('Cálculo Diferencial', 'CALC-101', 1, 'Fundamentos de cálculo diferencial', '1', 'activa'),
('Álgebra Lineal', 'ALG-102', 1, 'Matrices, vectores y sistemas lineales', '1', 'activa'),
('Química', 'QUIM-103', NULL, 'Química general básica', '1', 'activa'),
('Fundamentos de Programación', 'PROG-104', NULL, 'Introducción a la programación', '1', 'activa'),
('Cálculo Integral', 'CALC-201', 1, 'Integrales y sus aplicaciones', '2', 'activa'),
('Ecuaciones Diferenciales', 'CALC-202', NULL, 'Resolución de ecuaciones diferenciales', '2', 'activa'),
('Física I', 'FIS-203', NULL, 'Mecánica clásica', '2', 'activa'),
('Estructura de Datos', 'PROG-204', NULL, 'Listas, árboles, grafos', '2', 'activa'),
('Base de Datos', 'BD-301', NULL, 'Diseño y gestión de bases de datos', '3', 'activa'),
('Programación Orientada a Objetos', 'POO-302', NULL, 'Paradigma orientado a objetos', '3', 'activa'),
('Redes de Computadoras', 'RED-303', NULL, 'Fundamentos de redes', '3', 'activa'),
('Ingeniería de Software', 'IS-401', NULL, 'Metodologías de desarrollo de software', '4', 'activa'),
('Sistemas Operativos', 'SO-402', NULL, 'Gestión de procesos y memoria', '4', 'activa'),
('Inteligencia Artificial', 'IA-501', NULL, 'Algoritmos de IA y machine learning', '5', 'activa'),
('Desarrollo Web', 'WEB-502', NULL, 'HTML, CSS, JavaScript y frameworks', '5', 'activa');

-- Asignar materias al plan de Ingeniería en Sistemas
INSERT INTO plan_estudio_materias (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden) VALUES
-- Semestre 1
(1, 2, 1, 5, 1, 1),  -- Cálculo Diferencial
(1, 3, 1, 5, 1, 2),  -- Álgebra Lineal
(1, 4, 1, 4, 1, 3),  -- Química
(1, 5, 1, 6, 1, 4),  -- Fundamentos de Programación
-- Semestre 2
(1, 6, 2, 5, 1, 1),  -- Cálculo Integral
(1, 7, 2, 5, 1, 2),  -- Ecuaciones Diferenciales
(1, 8, 2, 5, 1, 3),  -- Física I
(1, 9, 2, 6, 1, 4),  -- Estructura de Datos
-- Semestre 3
(1, 10, 3, 6, 1, 1), -- Base de Datos
(1, 11, 3, 6, 1, 2), -- Programación Orientada a Objetos
(1, 12, 3, 5, 1, 3), -- Redes de Computadoras
-- Semestre 4
(1, 13, 4, 6, 1, 1), -- Ingeniería de Software
(1, 14, 4, 5, 1, 2), -- Sistemas Operativos
-- Semestre 5
(1, 15, 5, 6, 1, 1), -- Inteligencia Artificial
(1, 16, 5, 6, 1, 2); -- Desarrollo Web

-- Asignar algunas materias al plan de Ingeniería Industrial
INSERT INTO plan_estudio_materias (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden) VALUES
(2, 2, 1, 5, 1, 1),  -- Cálculo Diferencial
(2, 3, 1, 5, 1, 2),  -- Álgebra Lineal
(2, 4, 1, 4, 1, 3),  -- Química
(2, 6, 2, 5, 1, 1),  -- Cálculo Integral
(2, 8, 2, 5, 1, 2);  -- Física I

-- Asignar algunas materias al plan de Ingeniería Mecatrónica
INSERT INTO plan_estudio_materias (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden) VALUES
(3, 2, 1, 5, 1, 1),  -- Cálculo Diferencial
(3, 3, 1, 5, 1, 2),  -- Álgebra Lineal
(3, 5, 1, 6, 1, 3),  -- Fundamentos de Programación
(3, 6, 2, 5, 1, 1),  -- Cálculo Integral
(3, 8, 2, 5, 1, 2),  -- Física I
(3, 9, 2, 6, 1, 3);  -- Estructura de Datos
