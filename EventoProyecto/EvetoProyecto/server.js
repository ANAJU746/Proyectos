const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Servir archivos HTML desde carpeta 'public'
app.use(express.static('public'));

// 🔌 Conexión a PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'EvenetosBase',  // ⚠️ Asegúrate de que esté bien escrito
    password: '1234',
    port: 5432,
});

// 📄 Ruta raíz
app.get('/', (req, res) => {
    res.send('Servidor activo. Usa /registro o /evento con POST.');
});

app.post('/registro', async (req, res) => {
    const { username, password } = req.body;
    try {
        await pool.query(
            'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)',
            [username, password]
        );
        res.status(200).json({ message: 'Usuario registrado con éxito' });
    } catch (err) {
    console.error('❌ ERROR en POST /registro:\n', err.stack);  // muestra TODO el error
    res.status(500).json({ message: 'Error en el servidor' });
}

});


app.listen(8080, () => {
    console.log('Servidor iniciado en http://localhost:8080');
});
