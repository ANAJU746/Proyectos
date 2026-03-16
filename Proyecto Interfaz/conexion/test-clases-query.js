const db = require('./conexion');

async function testClases() {
    try {
        console.log('=== Probando consulta de clases ===');
        const [rows] = await db.query(
          `SELECT 
             c.id, c.nombre, c.codigo, c.profesor_id, c.aula, c.cupo_maximo, c.semestre, c.descripcion, c.estado, c.creado_at, c.actualizado_at,
             p.nombre AS profesor_nombre, p.codigo_profesor,
             GROUP_CONCAT(CONCAT(s.dia, '|', s.inicio, '|', s.fin) SEPARATOR '::') AS horarios_concat
           FROM clases c
           LEFT JOIN profesores p ON c.profesor_id = p.id
           LEFT JOIN class_schedules s ON s.clase_id = c.id
           GROUP BY 
             c.id, c.nombre, c.codigo, c.profesor_id, c.aula, c.cupo_maximo, c.semestre, c.descripcion, c.estado, c.creado_at, c.actualizado_at,
             p.nombre, p.codigo_profesor
           ORDER BY c.nombre ASC`
        );
        
        console.log(`Total de clases: ${rows.length}`);
        if (rows.length > 0) {
            console.log('\nPrimera clase:');
            console.log(JSON.stringify(rows[0], null, 2));
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('SQL State:', err.sqlState);
        console.error('Error Code:', err.code);
        process.exit(1);
    }
}

testClases();
