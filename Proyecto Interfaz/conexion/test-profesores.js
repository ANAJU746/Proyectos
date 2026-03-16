const db = require('./conexion');

async function testProfesores() {
    try {
        console.log('=== Profesores en la BD ===');
        const [profesores] = await db.query('SELECT id, nombre, especialidad, materia, estado FROM profesores');
        console.log(`Total: ${profesores.length}`);
        console.log(JSON.stringify(profesores, null, 2));
        
        console.log('\n=== Probando filtro por área (Matemáticas) ===');
        const [filtered] = await db.query(`
            SELECT p.* FROM profesores p
            WHERE EXISTS (
                SELECT 1 FROM materias_catalogo mc
                JOIN areas a ON a.id = mc.area_id
                WHERE (mc.nombre = p.materia OR mc.codigo = p.materia)
                AND a.nombre = ?
            )
        `, ['Matemáticas']);
        console.log(`Profesores de Matemáticas: ${filtered.length}`);
        console.log(JSON.stringify(filtered, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testProfesores();
