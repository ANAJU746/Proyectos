/**
 * Script para configurar un profesor de demostración con contraseña
 * Ejecutar con: node setup-profesor-demo.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setupProfesorDemo() {
  let connection;
  
  try {
    // Crear conexión
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '12345',
      database: 'school_db',
      port: 3306
    });

    console.log('✓ Conectado a la base de datos');


    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'school_db' 
        AND TABLE_NAME = 'profesores' 
        AND COLUMN_NAME = 'password_hash'
    `);

    if (columns.length === 0) {
      console.log('⚠ La columna password_hash no existe. Agregándola...');
      await connection.query(`
        ALTER TABLE profesores 
        ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL AFTER materia
      `);
      console.log('✓ Columna password_hash agregada');
    } else {
      console.log('✓ La columna password_hash ya existe');
    }
 
   
    const profesorDemo = {
      codigo_profesor: 'PROF001',
      nombre: 'Dr. Juan Carlos Pérez Mendoza',
      correo: 'jperez@ejemplo.edu.mx',
      telefono: '(993) 123-4567',
      departamento: 'Ciencias',
      especialidad: 'Matemáticas Aplicadas',
      grado_academico: 'Doctorado',
      materia: 'Cálculo Diferencial',
      estado: 'activo',
      password: 'demo123' // Contraseña de demostración
    };

    // Verificar si el profesor ya existe
    const [existing] = await connection.query(
      'SELECT id, password_hash FROM profesores WHERE codigo_profesor = ?',
      [profesorDemo.codigo_profesor]
    );

    const passwordHash = bcrypt.hashSync(profesorDemo.password, 10);

    if (existing.length > 0) {
      // Actualizar contraseña si el profesor existe
      await connection.query(
        'UPDATE profesores SET password_hash = ? WHERE codigo_profesor = ?',
        [passwordHash, profesorDemo.codigo_profesor]
      );
      console.log('\n✓ Profesor existente actualizado con nueva contraseña');
    } else {
      // Insertar nuevo profesor
      await connection.query(
        `INSERT INTO profesores 
        (codigo_profesor, nombre, correo, telefono, departamento, especialidad, grado_academico, materia, estado, password_hash) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profesorDemo.codigo_profesor,
          profesorDemo.nombre,
          profesorDemo.correo,
          profesorDemo.telefono,
          profesorDemo.departamento,
          profesorDemo.especialidad,
          profesorDemo.grado_academico,
          profesorDemo.materia,
          profesorDemo.estado,
          passwordHash
        ]
      );
      console.log('\n✓ Nuevo profesor insertado');
    }

    console.log('\n========================================');
    console.log('PROFESOR DE DEMOSTRACIÓN CONFIGURADO');
    console.log('========================================');
    console.log('Código: ' + profesorDemo.codigo_profesor);
    console.log('Correo: ' + profesorDemo.correo);
    console.log('Contraseña: ' + profesorDemo.password);
    console.log('========================================');
    console.log('\nPuedes iniciar sesión en:');
    console.log('http://localhost:3000');
    console.log('Selecciona "Maestro" y usa las credenciales anteriores');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexión cerrada');
    }
  }
}

// Ejecutar el script
setupProfesorDemo();
