const db = require('./conexion');

async function testAreas() {
    try {
        console.log('=== Probando áreas ===');
        const [areas] = await db.query('SELECT * FROM areas');
        console.log(`Total de áreas: ${areas.length}`);
        console.log(JSON.stringify(areas, null, 2));
        
        console.log('\n=== Probando materias_catalogo ===');
        const [materias] = await db.query('SELECT * FROM materias_catalogo LIMIT 5');
        console.log(`Total de materias (primeras 5): ${materias.length}`);
        console.log(JSON.stringify(materias, null, 2));
        
        console.log('\n=== Probando clases ===');
        const [clases] = await db.query('SELECT id, nombre, codigo FROM clases LIMIT 5');
        console.log(`Total de clases (primeras 5): ${clases.length}`);
        console.log(JSON.stringify(clases, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testAreas();
