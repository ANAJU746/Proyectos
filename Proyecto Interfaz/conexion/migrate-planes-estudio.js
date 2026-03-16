/**
 * Script de migración para agregar tablas y datos de Planes de Estudio
 * Ejecutar con: node migrate-planes-estudio.js
 */

const db = require('./conexion');

async function migratePlanesEstudio() {
  const conn = await db.getConnection();
  
  try {
    console.log('Iniciando migración de Planes de Estudio...');
    
    // 1. Crear tabla planes_estudio
    console.log('\n1. Creando tabla planes_estudio...');
    await conn.query(`
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
      ) ENGINE=InnoDB
    `);
    console.log('✓ Tabla planes_estudio creada');
    
    // 2. Crear tabla plan_estudio_materias
    console.log('\n2. Creando tabla plan_estudio_materias...');
    await conn.query(`
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
      ) ENGINE=InnoDB
    `);
    console.log('✓ Tabla plan_estudio_materias creada');
    
    // 3. Verificar si ya existen planes
    const [existingPlanes] = await conn.query('SELECT COUNT(*) as total FROM planes_estudio');
    
    if (existingPlanes[0].total > 0) {
      console.log('\n⚠ Ya existen planes de estudio. Saltando inserción de datos de ejemplo.');
    } else {
      // 4. Insertar planes de estudio de ejemplo
      console.log('\n3. Insertando planes de estudio de ejemplo...');
      await conn.query(`
        INSERT INTO planes_estudio (nombre, carrera, codigo, duracion_semestres, creditos_totales, descripcion, estado) VALUES
        ('Plan Ingeniería en Sistemas 2024', 'Ingeniería en Sistemas Computacionales', 'ISC-2024', 9, 240, 'Plan de estudios actualizado para la carrera de Ingeniería en Sistemas Computacionales', 'activo'),
        ('Plan Ingeniería Industrial 2024', 'Ingeniería Industrial', 'IND-2024', 9, 235, 'Plan de estudios para Ingeniería Industrial con enfoque en optimización de procesos', 'activo'),
        ('Plan Ingeniería Mecatrónica 2024', 'Ingeniería Mecatrónica', 'MEC-2024', 9, 238, 'Plan de estudios de Ingeniería Mecatrónica con automatización y robótica', 'activo')
      `);
      console.log('✓ Planes de estudio insertados');
      
      // 5. Agregar clases adicionales si no existen
      console.log('\n4. Agregando clases adicionales...');
      
      const clasesAdicionales = [
        ['Cálculo Diferencial', 'CALC-101', 1, 'Fundamentos de cálculo diferencial', '1'],
        ['Álgebra Lineal', 'ALG-102', 1, 'Matrices, vectores y sistemas lineales', '1'],
        ['Química', 'QUIM-103', null, 'Química general básica', '1'],
        ['Fundamentos de Programación', 'PROG-104', null, 'Introducción a la programación', '1'],
        ['Cálculo Integral', 'CALC-201', 1, 'Integrales y sus aplicaciones', '2'],
        ['Ecuaciones Diferenciales', 'CALC-202', null, 'Resolución de ecuaciones diferenciales', '2'],
        ['Física I', 'FIS-203', null, 'Mecánica clásica', '2'],
        ['Estructura de Datos', 'PROG-204', null, 'Listas, árboles, grafos', '2'],
        ['Base de Datos', 'BD-301', null, 'Diseño y gestión de bases de datos', '3'],
        ['Programación Orientada a Objetos', 'POO-302', null, 'Paradigma orientado a objetos', '3'],
        ['Redes de Computadoras', 'RED-303', null, 'Fundamentos de redes', '3'],
        ['Ingeniería de Software', 'IS-401', null, 'Metodologías de desarrollo de software', '4'],
        ['Sistemas Operativos', 'SO-402', null, 'Gestión de procesos y memoria', '4'],
        ['Inteligencia Artificial', 'IA-501', null, 'Algoritmos de IA y machine learning', '5'],
        ['Desarrollo Web', 'WEB-502', null, 'HTML, CSS, JavaScript y frameworks', '5']
      ];
      
      for (const [nombre, codigo, profesor_id, descripcion, semestre] of clasesAdicionales) {
        try {
          await conn.query(`
            INSERT IGNORE INTO clases (nombre, codigo, profesor_id, descripcion, semestre, estado)
            VALUES (?, ?, ?, ?, ?, 'activa')
          `, [nombre, codigo, profesor_id, descripcion, semestre]);
        } catch (err) {
          // Ignorar errores de duplicados
          if (err.code !== 'ER_DUP_ENTRY') {
            console.log(`  ⚠ Error al insertar ${nombre}: ${err.message}`);
          }
        }
      }
      console.log('✓ Clases adicionales agregadas');
      
      // 6. Obtener IDs de clases y planes
      console.log('\n5. Asignando materias a planes de estudio...');
      const [planes] = await conn.query('SELECT id, codigo FROM planes_estudio ORDER BY id');
      const [clases] = await conn.query('SELECT id, codigo FROM clases WHERE codigo IS NOT NULL');
      
      // Crear mapas de código a ID
      const planMap = {};
      planes.forEach(p => { planMap[p.codigo] = p.id; });
      
      const claseMap = {};
      clases.forEach(c => { claseMap[c.codigo] = c.id; });
      
      // Asignar materias al plan de Ingeniería en Sistemas
      if (planMap['ISC-2024']) {
        const asignaciones = [
          // Semestre 1
          [planMap['ISC-2024'], 'CALC-101', 1, 5, 1, 1],
          [planMap['ISC-2024'], 'ALG-102', 1, 5, 1, 2],
          [planMap['ISC-2024'], 'QUIM-103', 1, 4, 1, 3],
          [planMap['ISC-2024'], 'PROG-104', 1, 6, 1, 4],
          // Semestre 2
          [planMap['ISC-2024'], 'CALC-201', 2, 5, 1, 1],
          [planMap['ISC-2024'], 'CALC-202', 2, 5, 1, 2],
          [planMap['ISC-2024'], 'FIS-203', 2, 5, 1, 3],
          [planMap['ISC-2024'], 'PROG-204', 2, 6, 1, 4],
          // Semestre 3
          [planMap['ISC-2024'], 'BD-301', 3, 6, 1, 1],
          [planMap['ISC-2024'], 'POO-302', 3, 6, 1, 2],
          [planMap['ISC-2024'], 'RED-303', 3, 5, 1, 3],
          // Semestre 4
          [planMap['ISC-2024'], 'IS-401', 4, 6, 1, 1],
          [planMap['ISC-2024'], 'SO-402', 4, 5, 1, 2],
          // Semestre 5
          [planMap['ISC-2024'], 'IA-501', 5, 6, 1, 1],
          [planMap['ISC-2024'], 'WEB-502', 5, 6, 1, 2]
        ];
        
        for (const [plan_id, codigo_clase, semestre, creditos, obligatoria, orden] of asignaciones) {
          const clase_id = claseMap[codigo_clase];
          if (clase_id) {
            try {
              await conn.query(`
                INSERT IGNORE INTO plan_estudio_materias 
                (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [plan_id, clase_id, semestre, creditos, obligatoria, orden]);
            } catch (err) {
              // Ignorar duplicados
            }
          }
        }
        console.log('  ✓ Materias asignadas al plan ISC-2024');
      }
      
      // Asignar algunas materias al plan de Ingeniería Industrial
      if (planMap['IND-2024']) {
        const asignaciones = [
          [planMap['IND-2024'], 'CALC-101', 1, 5, 1, 1],
          [planMap['IND-2024'], 'ALG-102', 1, 5, 1, 2],
          [planMap['IND-2024'], 'QUIM-103', 1, 4, 1, 3],
          [planMap['IND-2024'], 'CALC-201', 2, 5, 1, 1],
          [planMap['IND-2024'], 'FIS-203', 2, 5, 1, 2]
        ];
        
        for (const [plan_id, codigo_clase, semestre, creditos, obligatoria, orden] of asignaciones) {
          const clase_id = claseMap[codigo_clase];
          if (clase_id) {
            try {
              await conn.query(`
                INSERT IGNORE INTO plan_estudio_materias 
                (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [plan_id, clase_id, semestre, creditos, obligatoria, orden]);
            } catch (err) {}
          }
        }
        console.log('  ✓ Materias asignadas al plan IND-2024');
      }
      
      // Asignar algunas materias al plan de Ingeniería Mecatrónica
      if (planMap['MEC-2024']) {
        const asignaciones = [
          [planMap['MEC-2024'], 'CALC-101', 1, 5, 1, 1],
          [planMap['MEC-2024'], 'ALG-102', 1, 5, 1, 2],
          [planMap['MEC-2024'], 'PROG-104', 1, 6, 1, 3],
          [planMap['MEC-2024'], 'CALC-201', 2, 5, 1, 1],
          [planMap['MEC-2024'], 'FIS-203', 2, 5, 1, 2],
          [planMap['MEC-2024'], 'PROG-204', 2, 6, 1, 3]
        ];
        
        for (const [plan_id, codigo_clase, semestre, creditos, obligatoria, orden] of asignaciones) {
          const clase_id = claseMap[codigo_clase];
          if (clase_id) {
            try {
              await conn.query(`
                INSERT IGNORE INTO plan_estudio_materias 
                (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [plan_id, clase_id, semestre, creditos, obligatoria, orden]);
            } catch (err) {}
          }
        }
        console.log('  ✓ Materias asignadas al plan MEC-2024');
      }
    }
    
    console.log('\n✅ Migración completada exitosamente!');
    console.log('\nPuedes acceder a Planes de Estudio en:');
    console.log('http://localhost:3000/Pagina4/planes-estudio.html');
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

// Ejecutar migración
migratePlanesEstudio().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
