const db = require('./conexion');

(async()=>{
  try{
    const profesorId = 2;
    const [rows] = await db.query(`
      SELECT pc.id, pc.estudiante_id, e.nombre AS estudiante_nombre,
             pc.clase_id, c.nombre AS clase_nombre,
             pc.mensaje, pc.estado, pc.creado_at,
             pc.respuesta, pc.respuesta_fecha
      FROM preguntas_calificaciones pc
      LEFT JOIN estudiantes e ON e.id = pc.estudiante_id
      LEFT JOIN clases c ON c.id = pc.clase_id
      WHERE (pc.profesor_id = ? OR c.profesor_id = ?)
      ORDER BY pc.creado_at DESC
    `, [profesorId, profesorId]);
    
    console.log('=== RESULTADO CONSULTA PROFESOR ID=' + profesorId + ' ===');
    console.log('Total mensajes encontrados:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  }catch(e){
    console.error('ERROR:', e);
    process.exit(1);
  }
})();
