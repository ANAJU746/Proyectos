const db = require('./conexion');

async function checkProfesores() {
    try {
        const [rows] = await db.query('SELECT * FROM profesores ORDER BY creado_at DESC');
        
        console.log(`\nTotal de profesores en la base de datos: ${rows.length}\n`);
        
        if (rows.length === 0) {
            console.log('No hay profesores registrados.');
        } else {
            console.log('Lista de profesores:');
            console.log('='.repeat(100));
            rows.forEach((prof, idx) => {
                console.log(`${idx + 1}. ${prof.codigo_profesor} - ${prof.nombre}`);
                console.log(`   Departamento: ${prof.departamento || 'N/A'} | Especialidad: ${prof.especialidad || 'N/A'}`);
                console.log(`   Grado: ${prof.grado_academico || 'N/A'} | Estado: ${prof.estado}`);
                console.log('-'.repeat(100));
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProfesores();
