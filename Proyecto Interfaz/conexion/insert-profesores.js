const db = require('./conexion');

const profesores = [
    {
        codigo_profesor: 'PROF001',
        nombre: 'Dr. Juan Carlos Pérez Mendoza',
        correo: 'jperez@ejemplo.edu.mx',
        telefono: '(993) 123-4567',
        departamento: 'Ciencias',
        especialidad: 'Matemáticas Aplicadas',
        grado_academico: 'Doctorado',
        materia: 'Cálculo Diferencial',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF002',
        nombre: 'Dra. María Elena Rodríguez García',
        correo: 'mrodriguez@ejemplo.edu.mx',
        telefono: '(993) 234-5678',
        departamento: 'Humanidades',
        especialidad: 'Literatura Hispanoamericana',
        grado_academico: 'Doctorado',
        materia: 'Literatura Universal',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF003',
        nombre: 'Mtro. Roberto García Hernández',
        correo: 'rgarcia@ejemplo.edu.mx',
        telefono: '(993) 345-6789',
        departamento: 'Tecnología',
        especialidad: 'Sistemas Computacionales',
        grado_academico: 'Maestría',
        materia: 'Programación Avanzada',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF004',
        nombre: 'Mtra. Ana Sofía López Torres',
        correo: 'alopez@ejemplo.edu.mx',
        telefono: '(993) 456-7890',
        departamento: 'Ingeniería',
        especialidad: 'Ingeniería Industrial',
        grado_academico: 'Maestría',
        materia: 'Procesos Industriales',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF005',
        nombre: 'Dr. Carlos Enrique Martínez Cruz',
        correo: 'cmartinez@ejemplo.edu.mx',
        telefono: '(993) 567-8901',
        departamento: 'Ciencias',
        especialidad: 'Física Teórica',
        grado_academico: 'Doctorado',
        materia: 'Física II',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF006',
        nombre: 'Mtra. Laura Patricia Sánchez Díaz',
        correo: 'lsanchez@ejemplo.edu.mx',
        telefono: '(993) 678-9012',
        departamento: 'Administración',
        especialidad: 'Gestión Empresarial',
        grado_academico: 'Maestría',
        materia: 'Administración Estratégica',
        estado: 'activo'
    },
    {
        codigo_profesor: 'PROF007',
        nombre: 'Mtro. José Luis Ramírez Flores',
        correo: 'jramirez@ejemplo.edu.mx',
        telefono: '(993) 789-0123',
        departamento: 'Tecnología',
        especialidad: 'Redes y Telecomunicaciones',
        grado_academico: 'Maestría',
        materia: 'Redes de Computadoras',
        estado: 'inactivo'
    },
    {
        codigo_profesor: 'PROF008',
        nombre: 'Dra. Gabriela Fernández Morales',
        correo: 'gfernandez@ejemplo.edu.mx',
        telefono: '(993) 890-1234',
        departamento: 'Humanidades',
        especialidad: 'Psicología Educativa',
        grado_academico: 'Doctorado',
        materia: 'Desarrollo Humano',
        estado: 'activo'
    }
];

async function insertProfesores() {
    console.log('Insertando profesores de ejemplo...\n');
    
    for (const prof of profesores) {
        try {
            const fields = Object.keys(prof);
            const placeholders = fields.map(() => '?');
            const values = fields.map(k => prof[k]);
            const sql = `INSERT INTO profesores (${fields.join(',')}) VALUES (${placeholders.join(',')})`;
            
            const [result] = await db.query(sql, values);
            console.log(`✓ Profesor insertado: ${prof.nombre} (ID: ${result.insertId})`);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log(`⚠ Ya existe: ${prof.nombre} (${prof.codigo_profesor})`);
            } else {
                console.error(`✗ Error insertando ${prof.nombre}:`, err.message);
            }
        }
    }
    
    console.log('\n¡Proceso completado!');
    process.exit(0);
}

insertProfesores();
