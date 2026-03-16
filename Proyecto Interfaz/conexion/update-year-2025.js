const db = require('./conexion');

async function actualizarAnio() {
  try {
    console.log('Actualizando planes de estudio a 2025...');
    
    await db.query(`
      UPDATE planes_estudio 
      SET nombre = REPLACE(nombre, '2024', '2025'),
          codigo = REPLACE(codigo, '2024', '2025')
      WHERE codigo LIKE '%2024%'
    `);
    
    console.log('✅ Planes de estudio actualizados a 2025');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

actualizarAnio();
