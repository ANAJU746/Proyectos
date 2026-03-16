const db = require('./conexion');

(async()=>{
  try{
    console.log('Agregando columnas faltantes a preguntas_calificaciones...');
    
    // Agregar columna respuesta
    try {
      await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN respuesta TEXT NULL');
      console.log('✅ Columna respuesta agregada');
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Columna respuesta ya existe');
      } else {
        throw e;
      }
    }
    
    // Agregar columna respuesta_fecha
    try {
      await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN respuesta_fecha TIMESTAMP NULL DEFAULT NULL');
      console.log('✅ Columna respuesta_fecha agregada');
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Columna respuesta_fecha ya existe');
      } else {
        throw e;
      }
    }
    
    // Agregar columna respuesta_profesor_id
    try {
      await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN respuesta_profesor_id INT UNSIGNED NULL');
      console.log('✅ Columna respuesta_profesor_id agregada');
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Columna respuesta_profesor_id ya existe');
      } else {
        throw e;
      }
    }
    
    console.log('\n✅ Todas las columnas agregadas exitosamente');
    process.exit(0);
  }catch(e){
    console.error('❌ ERROR:', e);
    process.exit(1);
  }
})();
