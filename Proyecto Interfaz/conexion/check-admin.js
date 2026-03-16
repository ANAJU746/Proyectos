const db = require('./conexion');

async function checkAdmin() {
    try {
        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE username = ?',
            ['admin']
        );
        
        console.log('Usuario admin encontrado:');
        console.log(rows);
        
        if (rows.length === 0) {
            console.log('\n⚠️ No se encontró el usuario admin en la base de datos');
        } else {
            const admin = rows[0];
            console.log('\n✓ Usuario encontrado');
            console.log('  - username:', admin.username);
            console.log('  - role:', admin.role);
            console.log('  - is_active:', admin.is_active);
            console.log('  - password_hash:', admin.password_hash);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdmin();
