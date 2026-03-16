// Script de prueba para verificar que la edición funciona correctamente
// Abre la consola del navegador (F12) y pega este script

console.log('🧪 Iniciando prueba de edición de estudiantes...\n');

// Verificar que el modal existe
const modal = document.getElementById('studentModal');
if (modal) {
    console.log('✅ Modal encontrado');
} else {
    console.error('❌ Modal no encontrado');
}

// Verificar que los campos del formulario existen
const campos = [
    'matricula', 'nombre', 'curp', 'fecha_nacimiento', 'lugar_nacimiento',
    'correo', 'telefono', 'grado', 'grupo', 'carrera', 'plan_estudios',
    'especialidad', 'tutor', 'promedio', 'estado'
];

console.log('\n📋 Verificando campos del formulario:');
campos.forEach(campo => {
    const elemento = document.getElementById(campo);
    if (elemento) {
        console.log(`  ✅ ${campo}`);
    } else {
        console.error(`  ❌ ${campo} no encontrado`);
    }
});

// Verificar botones de editar
const editButtons = document.querySelectorAll('.edit-btn');
console.log(`\n🔘 Botones de editar encontrados: ${editButtons.length}`);

// Simular clic en el primer botón de editar (si existe)
if (editButtons.length > 0) {
    console.log('\n🖱️ Para probar la edición, haz clic en cualquier botón de editar (ícono de lápiz)');
    console.log('   El modal debería abrirse con la información del estudiante cargada.');
} else {
    console.warn('\n⚠️ No hay estudiantes en la tabla. Agrega uno primero.');
}

// Función para verificar datos cargados
window.verificarDatosCargados = function() {
    console.log('\n🔍 Verificando datos en el formulario:');
    campos.forEach(campo => {
        const elemento = document.getElementById(campo);
        if (elemento) {
            const valor = elemento.value || '(vacío)';
            console.log(`  ${campo}: ${valor}`);
        }
    });
};

console.log('\n📝 INSTRUCCIONES:');
console.log('1. Haz clic en el botón de editar (lápiz) de cualquier estudiante');
console.log('2. El modal se abrirá con los datos del estudiante');
console.log('3. Escribe en la consola: verificarDatosCargados()');
console.log('4. Verás todos los datos que se cargaron en el formulario');
console.log('\n✨ ¡Listo para probar!');
