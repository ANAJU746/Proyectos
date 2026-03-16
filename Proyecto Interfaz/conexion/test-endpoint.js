const fetch = require('node-fetch');

async function testEndpoint() {
    try {
        console.log('Probando GET /api/clases...\n');
        const res = await fetch('http://localhost:3000/api/clases');
        console.log(`Status: ${res.status}`);
        console.log(`OK: ${res.ok}`);
        
        const clases = await res.json();
        console.log(`\nTotal clases recibidas: ${clases.length}`);
        
        if (clases.length > 0) {
            console.log('\n=== Primera clase ===');
            console.log(JSON.stringify(clases[0], null, 2));
            
            console.log('\n=== Verificando horarios ===');
            console.log(`Tipo de horarios: ${typeof clases[0].horarios}`);
            console.log(`Es array: ${Array.isArray(clases[0].horarios)}`);
            console.log(`Horarios:`, clases[0].horarios);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

testEndpoint();
