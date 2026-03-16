const express = require('express');
const db = require('../conexion/conexion');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Estudiantes - CRUD completo
app.get('/api/estudiantes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM estudiantes ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/estudiantes/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM estudiantes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/estudiantes', async (req, res) => {
  try {
    const { 
      matricula, nombre, curp, fecha_nacimiento, lugar_nacimiento,
      correo_institucional, telefono, grado, grupo, carrera, 
      plan_estudios, especialidad_academica, tutor_academico,
      promedio, estado 
    } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO estudiantes (
        matricula, nombre, curp, fecha_nacimiento, lugar_nacimiento,
        correo_institucional, telefono, grado, grupo, carrera,
        plan_estudios, especialidad_academica, tutor_academico,
        promedio, estado
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        matricula, nombre, curp, fecha_nacimiento, lugar_nacimiento,
        correo_institucional, telefono, grado, grupo, carrera,
        plan_estudios, especialidad_academica, tutor_academico,
        promedio, estado || 'activo'
      ]
    );
    
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/estudiantes/:id', async (req, res) => {
  try {
    const { 
      matricula, nombre, curp, fecha_nacimiento, lugar_nacimiento,
      correo_institucional, telefono, grado, grupo, carrera, 
      plan_estudios, especialidad_academica, tutor_academico,
      promedio, estado 
    } = req.body;
    
    const [result] = await db.query(
      `UPDATE estudiantes SET 
        matricula = ?, nombre = ?, curp = ?, fecha_nacimiento = ?, 
        lugar_nacimiento = ?, correo_institucional = ?, telefono = ?,
        grado = ?, grupo = ?, carrera = ?, plan_estudios = ?,
        especialidad_academica = ?, tutor_academico = ?, promedio = ?,
        estado = ?
      WHERE id = ?`,
      [
        matricula, nombre, curp, fecha_nacimiento, lugar_nacimiento,
        correo_institucional, telefono, grado, grupo, carrera,
        plan_estudios, especialidad_academica, tutor_academico,
        promedio, estado, req.params.id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    res.json({ ok: true, message: 'Estudiante actualizado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/estudiantes/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM estudiantes WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    
    res.json({ ok: true, message: 'Estudiante eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profesores
app.get('/api/profesores', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM profesores');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clases
app.get('/api/clases', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT c.*, p.nombre as profesor_nombre FROM clases c LEFT JOIN profesores p ON c.profesor_id = p.id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));