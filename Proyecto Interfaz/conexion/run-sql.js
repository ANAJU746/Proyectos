const db = require('./conexion');
const fs = require('fs');
const path = require('path');

async function runSqlFile() {
    try {
        const sqlPath = path.join(__dirname, 'Sql.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Dividir por declaraciones (muy simple, asumiendo que cada statement termina con ;)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('#'));
        
        console.log(`Ejecutando ${statements.length} declaraciones SQL...`);
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            if (stmt) {
                try {
                    // Skip DROP DATABASE and CREATE DATABASE as pool is already connected
                    if (stmt.toUpperCase().includes('DROP DATABASE') || 
                        (stmt.toUpperCase().includes('CREATE DATABASE') && !stmt.toUpperCase().includes('CREATE DATABASE IF NOT EXISTS'))) {
                        console.log(`Saltando: ${stmt.substring(0, 50)}...`);
                        continue;
                    }
                    if (stmt.toUpperCase().includes('USE SCHOOL_DB')) {
                        continue; // Ya estamos conectados a school_db
                    }
                    await db.query(stmt);
                    if (i % 10 === 0) console.log(`  Procesadas ${i+1} declaraciones...`);
                } catch (err) {
                    // Ignorar errores de "ya existe" o similares
                    if (!err.message.includes('already exists') && 
                        !err.message.includes('Duplicate entry') &&
                        !err.code === 'ER_TABLE_EXISTS_ERROR') {
                        console.warn(`Advertencia en declaración ${i+1}: ${err.message.substring(0, 100)}`);
                    }
                }
            }
        }
        
        console.log('\n✅ Script SQL ejecutado correctamente');
        
        // Verificar tablas creadas
        const [areas] = await db.query('SELECT COUNT(*) as total FROM areas');
        const [materias] = await db.query('SELECT COUNT(*) as total FROM materias_catalogo');
        console.log(`\nÁreas en BD: ${areas[0].total}`);
        console.log(`Materias en BD: ${materias[0].total}`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error ejecutando SQL:', err);
        process.exit(1);
    }
}

runSqlFile();
