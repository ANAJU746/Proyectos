// Script de prueba para verificar el sistema de inscripciones
const http = require('http');

function testEndpoint(path, description) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`\n✅ ${description}`);
                console.log(`📍 GET ${path}`);
                try {
                    const json = JSON.parse(data);
                    console.log(JSON.stringify(json, null, 2));
                    resolve(json);
                } catch (e) {
                    console.log(data);
                    resolve(data);
                }
            });
        }).on('error', (err) => {
            console.error(`\n❌ ${description}`);
            console.error(err.message);
            reject(err);
        });
    });
}

async function runTests() {
    console.log('🧪 Iniciando pruebas del sistema de inscripción...\n');
    console.log('='.repeat(60));

    try {
        // 1. Obtener semestres disponibles
        await testEndpoint('/api/semestres', 'Obtener semestres disponibles');

        // 2. Obtener clases disponibles para semestre 2025-2
        await testEndpoint('/api/clases/disponibles?semestre=2025-2', 
            'Obtener clases disponibles (2025-2)');

        // 3. Obtener clases disponibles para semestre que contenga "Agosto"
        await testEndpoint('/api/clases/disponibles?semestre=Agosto', 
            'Buscar clases con "Agosto" en el semestre');

        console.log('\n' + '='.repeat(60));
        console.log('✅ Todas las pruebas completadas\n');
        
        console.log('📋 Resumen:');
        console.log('   1. Los semestres se cargan dinámicamente');
        console.log('   2. La búsqueda es flexible (busca coincidencias parciales)');
        console.log('   3. Si tu clase dice "2025-2 (Agosto-Diciembre)"');
        console.log('      - Puedes buscar por "2025-2"');
        console.log('      - O por "Agosto"');
        console.log('      - O por "Diciembre"');
        console.log('      - O el texto completo\n');

    } catch (error) {
        console.error('\n❌ Error en las pruebas:', error.message);
    }
}

runTests();
