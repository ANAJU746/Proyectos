/**
 * Migración: Agregar columna 'semestre' a la tabla 'clases' si no existe
 * Ejecutar con: node migrate-add-semestre-clases.js
 */

const mysql = require('mysql2/promise');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '12345',
      database: 'school_db',
      port: 3306
    });
    console.log('Conectado a MySQL: school_db');

    // Verificar existencia de la columna 'semestre' en la tabla 'clases'
    const [rows] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'school_db'
        AND TABLE_NAME = 'clases'
        AND COLUMN_NAME = 'semestre'
    `);

    if (rows.length > 0) {
      console.log("La columna 'semestre' ya existe en 'clases'. Nada que hacer.");
      return;
    }

    console.log("Agregando columna 'semestre' a la tabla 'clases'...");
    await conn.query(`
      ALTER TABLE clases
      ADD COLUMN semestre VARCHAR(50) DEFAULT NULL AFTER cupo_maximo
    `);
    console.log("✓ Columna 'semestre' agregada exitosamente.");
  } catch (err) {
    console.error('Error en la migración:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log('Conexión cerrada.');
    }
  }
}

run();
