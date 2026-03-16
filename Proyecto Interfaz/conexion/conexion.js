// Conexión centralizada a MySQL usando Promises
// Credenciales: BD school_db, usuario root, password 12345, puerto 3306
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '12345',
  database: 'school_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Probar conexión al cargar el módulo
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('Conectado a MySQL: school_db');
  } catch (err) {
    console.error('Error de conexión a MySQL:', err.message);
  }
})();

module.exports = pool;
