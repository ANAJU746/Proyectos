const db = require('./conexion');

async function createTables() {
    try {
        console.log('Creando tabla areas...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS areas (
              id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              nombre VARCHAR(150) NOT NULL UNIQUE,
              descripcion VARCHAR(300) DEFAULT NULL
            ) ENGINE=InnoDB
        `);
        
        console.log('Creando tabla materias_catalogo...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS materias_catalogo (
              id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              nombre VARCHAR(200) NOT NULL,
              codigo VARCHAR(100) DEFAULT NULL UNIQUE,
              area_id INT UNSIGNED NOT NULL,
              descripcion TEXT DEFAULT NULL,
              CONSTRAINT fk_mat_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE RESTRICT ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);
        
        console.log('Insertando áreas...');
        await db.query(`
            INSERT INTO areas (nombre, descripcion) VALUES
            ('Matemáticas', 'Área de cálculo, álgebra y ecuaciones'),
            ('Ciencias Básicas', 'Física, Química y biología básica'),
            ('Computación', 'Programación, bases de datos, redes'),
            ('Ingeniería de Software', 'Procesos, requisitos, pruebas'),
            ('Sistemas', 'Sistemas operativos, arquitectura'),
            ('Inteligencia Artificial', 'IA y aprendizaje automático')
            ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)
        `);
        
        console.log('Insertando materias...');
        await db.query(`
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
            ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), area_id = VALUES(area_id)
        `);
        
        const [areas] = await db.query('SELECT COUNT(*) as total FROM areas');
        const [materias] = await db.query('SELECT COUNT(*) as total FROM materias_catalogo');
        
        console.log('\n✅ Tablas creadas e insertadas correctamente');
        console.log(`Áreas: ${areas[0].total}`);
        console.log(`Materias: ${materias[0].total}`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

createTables();
