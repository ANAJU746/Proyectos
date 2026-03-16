const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const sharp = require('sharp');
const db = require('./conexion');
const bcrypt = require('bcryptjs');

const app = express();

app.use(express.json());
// Servir el frontend desde la raíz del proyecto
app.use(express.static(path.join(__dirname, '..')));
// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de almacenamiento para documentos de estudiantes
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const estId = String(req.params.id || '').trim();
      const base = path.join(__dirname, 'uploads', 'estudiantes', estId || 'unknown');
      await fsp.mkdir(base, { recursive: true });
      cb(null, base);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const safe = (file.originalname || 'archivo')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 140);
    const ts = Date.now();
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage });

// Redirigir la raíz a Pagina1 con redirect HTTP
app.get('/', (req, res) => {
  res.redirect('/Pagina1/index.html');
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== Avisos (maestro -> estudiantes) =====
// Tablas: avisos y aviso_lecturas (para marcar lectura por estudiante)
async function ensureAvisosTables() {
  // Tabla principal de avisos
  await db.query(`
    CREATE TABLE IF NOT EXISTS avisos (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      profesor_id INT UNSIGNED NOT NULL,
      target_type ENUM('estudiante','clase','general') NOT NULL,
      estudiante_id INT UNSIGNED NULL,
      clase_id INT UNSIGNED NULL,
      titulo VARCHAR(200) NOT NULL,
      contenido TEXT NOT NULL,
      fecha_programada DATETIME NULL,
      creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_av_prof FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_av_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_av_cls FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);
  // Tabla de lecturas por estudiante
  await db.query(`
    CREATE TABLE IF NOT EXISTS aviso_lecturas (
      aviso_id INT UNSIGNED NOT NULL,
      estudiante_id INT UNSIGNED NOT NULL,
      leido_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (aviso_id, estudiante_id),
      CONSTRAINT fk_avl_av FOREIGN KEY (aviso_id) REFERENCES avisos(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_avl_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);
}

// Crear avisos (uno o múltiples objetivos)
// Cuerpo esperado:
// {
//   profesor_id: number (req),
//   titulo: string (req),
//   contenido: string (req),
//   target_type: 'general' | 'clase' | 'estudiante' (req),
//   clase_ids?: number | number[],
//   estudiante_ids?: number | number[],
//   fecha_programada?: string (ISO) | null
// }
app.post('/api/avisos', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureAvisosTables();
    await conn.beginTransaction();

    const { profesor_id, titulo, contenido, target_type, clase_ids, estudiante_ids, fecha_programada } = req.body || {};

    if (!profesor_id || !titulo || !contenido || !target_type) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Faltan campos: profesor_id, titulo, contenido, target_type' });
    }

    const t = String(target_type).toLowerCase();
    if (!['general','clase','estudiante'].includes(t)) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'target_type inválido' });
    }

    const tituloSafe = String(titulo).slice(0, 200);
    const contenidoSafe = String(contenido).slice(0, 5000);
    const fechaProg = fecha_programada ? new Date(fecha_programada) : null;
    const fechaVal = fechaProg && !isNaN(fechaProg.getTime()) ? fechaProg : null;

    const inserted = [];

    if (t === 'general') {
      const [ins] = await conn.query(
        'INSERT INTO avisos (profesor_id, target_type, titulo, contenido, fecha_programada) VALUES (?,?,?,?,?)',
        [profesor_id, 'general', tituloSafe, contenidoSafe, fechaVal]
      );
      inserted.push(ins.insertId);
    } else if (t === 'clase') {
      const cls = Array.isArray(clase_ids) ? clase_ids : (clase_ids != null ? [clase_ids] : []);
      if (cls.length === 0) { await conn.rollback(); return res.status(400).json({ ok:false, error:'clase_ids requerido' }); }
      for (const cid of cls) {
        const [ins] = await conn.query(
          'INSERT INTO avisos (profesor_id, target_type, clase_id, titulo, contenido, fecha_programada) VALUES (?,?,?,?,?,?)',
          [profesor_id, 'clase', cid, tituloSafe, contenidoSafe, fechaVal]
        );
        inserted.push(ins.insertId);
      }
    } else if (t === 'estudiante') {
      const ests = Array.isArray(estudiante_ids) ? estudiante_ids : (estudiante_ids != null ? [estudiante_ids] : []);
      if (ests.length === 0) { await conn.rollback(); return res.status(400).json({ ok:false, error:'estudiante_ids requerido' }); }
      for (const eid of ests) {
        const [ins] = await conn.query(
          'INSERT INTO avisos (profesor_id, target_type, estudiante_id, titulo, contenido, fecha_programada) VALUES (?,?,?,?,?,?)',
          [profesor_id, 'estudiante', eid, tituloSafe, contenidoSafe, fechaVal]
        );
        inserted.push(ins.insertId);
      }
    }

    await conn.commit();
    res.json({ ok: true, ids: inserted });
  } catch (err) {
    await conn.rollback();
    console.error('Error en POST /api/avisos:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// Listar avisos creados por un profesor
app.get('/api/profesores/:id/avisos', async (req, res) => {
  try {
    await ensureAvisosTables();
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM aviso_lecturas l WHERE l.aviso_id = a.id) AS total_lecturas
      FROM avisos a
      WHERE a.profesor_id = ?
      ORDER BY COALESCE(a.fecha_programada, a.creado_at) DESC, a.id DESC
    `, [id]);
    res.json({ ok: true, avisos: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Listar avisos para un estudiante (incluye dirigidos al estudiante, a sus clases y generales de sus profesores)
app.get('/api/estudiantes/:id/avisos', async (req, res) => {
  try {
    await ensureAvisosTables();
    const { id } = req.params;

    console.log(`[DEBUG] Cargando avisos para estudiante ID: ${id}`);

    // Profesores relacionados del estudiante (por clases activas)
    const [profesores] = await db.query(`
      SELECT DISTINCT c.profesor_id
      FROM inscripciones i
      JOIN clases c ON c.id = i.clase_id
      WHERE i.estudiante_id = ? AND i.estado = 'activa' AND c.profesor_id IS NOT NULL
    `, [id]);
    const profIds = profesores.map(r => r.profesor_id);
    console.log(`[DEBUG] Profesores relacionados: ${JSON.stringify(profIds)}`);

    // Clases activas del estudiante
    const [clases] = await db.query(`
      SELECT DISTINCT i.clase_id
      FROM inscripciones i
      WHERE i.estudiante_id = ? AND i.estado = 'activa'
    `, [id]);
    const claseIds = clases.map(r => r.clase_id);
    console.log(`[DEBUG] Clases activas: ${JSON.stringify(claseIds)}`);

    // Construir consulta dinámica
    const where = [];
    const vals = [];
    // individuales
    where.push('(a.target_type = \"estudiante\" AND a.estudiante_id = ?)');
    vals.push(id);
    // por clase
    if (claseIds.length > 0) {
      where.push(`(a.target_type = "clase" AND a.clase_id IN (${claseIds.map(()=>'?').join(',')}))`);
      vals.push(...claseIds);
    }
    // generales por profesor
    if (profIds.length > 0) {
      where.push(`(a.target_type = "general" AND a.profesor_id IN (${profIds.map(()=>'?').join(',')}))`);
      vals.push(...profIds);
    }

    console.log(`[DEBUG] Condiciones WHERE construidas: ${where.length}`);

    if (where.length === 0) {
      console.log('[DEBUG] No hay condiciones, devolviendo vacío');
      return res.json({ ok: true, avisos: [] });
    }

    const sql = `
      SELECT a.id, a.profesor_id, p.nombre AS profesor_nombre, a.target_type, a.estudiante_id, a.clase_id,
             a.titulo, a.contenido,
             a.fecha_programada, a.creado_at,
             c.nombre AS clase_nombre,
             (SELECT leido_at FROM aviso_lecturas l WHERE l.aviso_id = a.id AND l.estudiante_id = ?) AS leido_at
      FROM avisos a
      LEFT JOIN profesores p ON p.id = a.profesor_id
      LEFT JOIN clases c ON c.id = a.clase_id
      WHERE (${where.join(' OR ')})
      ORDER BY COALESCE(a.fecha_programada, a.creado_at) DESC, a.id DESC
    `;

    console.log(`[DEBUG] SQL: ${sql}`);
    console.log(`[DEBUG] Valores: ${JSON.stringify([id, ...vals])}`);

    const [rows] = await db.query(sql, [id, ...vals]);
    console.log(`[DEBUG] Avisos encontrados: ${rows.length}`);
    res.json({ ok: true, avisos: rows });
  } catch (err) {
    console.error('Error al listar avisos estudiante:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Editar un aviso (solo su autor puede editar)
app.patch('/api/avisos/:id', async (req, res) => {
  try {
    await ensureAvisosTables();
    const { id } = req.params;
    const { profesor_id, titulo, contenido, fecha_programada } = req.body || {};

    if (!profesor_id) return res.status(400).json({ ok:false, error:'Falta profesor_id' });

    // Verificar que el aviso exista y pertenezca al profesor
    const [rows] = await db.query('SELECT profesor_id FROM avisos WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok:false, error:'Aviso no encontrado' });
    if (Number(rows[0].profesor_id) !== Number(profesor_id)) {
      return res.status(403).json({ ok:false, error:'No autorizado para editar este aviso' });
    }

    // Preparar campos a actualizar
    const sets = [];
    const vals = [];
    if (typeof titulo === 'string') { sets.push('titulo = ?'); vals.push(titulo.slice(0,200)); }
    if (typeof contenido === 'string') { sets.push('contenido = ?'); vals.push(contenido.slice(0,5000)); }
    if (fecha_programada !== undefined) {
      if (fecha_programada === null || fecha_programada === '') {
        sets.push('fecha_programada = NULL');
      } else {
        const dt = new Date(fecha_programada);
        if (isNaN(dt.getTime())) return res.status(400).json({ ok:false, error:'fecha_programada inválida' });
        sets.push('fecha_programada = ?');
        vals.push(dt);
      }
    }

    if (sets.length === 0) {
      return res.json({ ok:true, updated:false }); // nada que cambiar
    }

    vals.push(id, profesor_id);
    const sql = `UPDATE avisos SET ${sets.join(', ')} WHERE id = ? AND profesor_id = ?`;
    const [result] = await db.query(sql, vals);
    if (result.affectedRows === 0) return res.status(400).json({ ok:false, error:'No se pudo actualizar el aviso' });
    res.json({ ok:true, updated:true });
  } catch (err) {
    console.error('Error en PATCH /api/avisos/:id:', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Marcar un aviso como leído por un estudiante
app.patch('/api/avisos/:id/leido', async (req, res) => {
  try {
    await ensureAvisosTables();
    const { id } = req.params;
    const { estudiante_id } = req.body || {};
    if (!estudiante_id) return res.status(400).json({ ok:false, error:'Falta estudiante_id' });

    // Verificar existencia del aviso
    const [ex] = await db.query('SELECT id FROM avisos WHERE id = ? LIMIT 1', [id]);
    if (!ex || ex.length === 0) return res.status(404).json({ ok:false, error:'Aviso no encontrado' });

    // Insertar si no existe
    await db.query('INSERT IGNORE INTO aviso_lecturas (aviso_id, estudiante_id, leido_at) VALUES (?,?, NOW())', [id, estudiante_id]);
    res.json({ ok:true });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// ===== Mensajes de recuperación (login) =====
// Crea tabla si no existe
async function ensureRecoverTable(){
  await db.query(`
    CREATE TABLE IF NOT EXISTS mensajes_recuperacion (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      tipo ENUM('estudiante','maestro') NOT NULL,
      identificacion VARCHAR(120) NOT NULL,
      correo VARCHAR(200) NOT NULL,
      telefono VARCHAR(50) NOT NULL,
      comentario TEXT NULL,
      estado ENUM('nuevo','atendido') DEFAULT 'nuevo',
      creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
}

// ===== Mensajes Admin -> Profesores =====
async function ensureAdminProfesorMessages(){
  await db.query(`
    CREATE TABLE IF NOT EXISTS mensajes_profesores (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      admin_id INT UNSIGNED DEFAULT NULL,
      profesor_id INT UNSIGNED NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      contenido TEXT NOT NULL,
      leido_at TIMESTAMP NULL DEFAULT NULL,
      creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_mp_prof FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);
}

// Crear mensajes (uno o varios profesores)
app.post('/api/admin/mensajes-profesores', async (req,res)=>{
  try {
    const { admin_id, profesor_ids, titulo, contenido } = req.body || {};
    if (!titulo || !contenido || !profesor_ids || !Array.isArray(profesor_ids) || profesor_ids.length === 0) {
      return res.status(400).json({ ok:false, error:'Faltan campos: titulo, contenido, profesor_ids[]' });
    }
    await ensureAdminProfesorMessages();
    const tituloSafe = String(titulo).slice(0,200);
    const contenidoSafe = String(contenido).slice(0,5000);
    const inserted = [];
    for (const pid of profesor_ids) {
      const [ins] = await db.query(
        'INSERT INTO mensajes_profesores (admin_id, profesor_id, titulo, contenido) VALUES (?,?,?,?)',
        [admin_id || null, pid, tituloSafe, contenidoSafe]
      );
      inserted.push(ins.insertId);
    }
    res.json({ ok:true, ids: inserted });
  } catch (err) {
    console.error('Error en POST /api/admin/mensajes-profesores:', err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Listar mensajes enviados a un profesor por admin
app.get('/api/profesores/:id/mensajes-admin', async (req,res)=>{
  try {
    const { id } = req.params;
    await ensureAdminProfesorMessages();
    const [rows] = await db.query(
      'SELECT id, admin_id, profesor_id, titulo, contenido, leido_at, creado_at FROM mensajes_profesores WHERE profesor_id = ? ORDER BY creado_at DESC',
      [id]
    );
    res.json({ ok:true, mensajes: rows });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Marcar mensaje como leído (profesor)
app.patch('/api/mensajes-profesores/:id/leido', async (req,res)=>{
  try {
    const { id } = req.params;
    const { profesor_id } = req.body || {};
    if (!profesor_id) return res.status(400).json({ ok:false, error:'Falta profesor_id' });
    await ensureAdminProfesorMessages();
    const [rows] = await db.query('SELECT id, profesor_id FROM mensajes_profesores WHERE id = ? LIMIT 1',[id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok:false, error:'Mensaje no encontrado' });
    if (String(rows[0].profesor_id) !== String(profesor_id)) return res.status(403).json({ ok:false, error:'No autorizado' });
    await db.query('UPDATE mensajes_profesores SET leido_at = NOW() WHERE id = ?',[id]);
    res.json({ ok:true });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Recibir solicitud de recuperación
app.post('/api/recuperacion', async (req,res)=>{
  try{
    const { tipo, identificacion, correo, telefono, comentario } = req.body || {};
    const t = (tipo||'').toString().toLowerCase();
    if (!['estudiante','maestro'].includes(t)){
      return res.status(400).json({ ok:false, error:'Tipo inválido' });
    }
    if (!identificacion || !correo || !telefono){
      return res.status(400).json({ ok:false, error:'Faltan campos requeridos' });
    }
    await ensureRecoverTable();
    const idf = String(identificacion).slice(0,120);
    const mail = String(correo).slice(0,200);
    const tel = String(telefono).slice(0,50);
    const com = comentario ? String(comentario).slice(0,2000) : null;
    await db.query(
      'INSERT INTO mensajes_recuperacion (tipo, identificacion, correo, telefono, comentario) VALUES (?,?,?,?,?)',
      [t, idf, mail, tel, com]
    );
    res.json({ ok:true });
  }catch(err){
    console.error('Error en POST /api/recuperacion:', err);
    res.status(500).json({ ok:false, error:'Error interno del servidor' });
  }
});

// Admin: listar mensajes
app.get('/api/admin/mensajes', async (req,res)=>{
  try{
    await ensureRecoverTable();
    const { estado } = req.query;
    let sql = 'SELECT * FROM mensajes_recuperacion';
    const vals = [];
    if (estado && ['nuevo','atendido'].includes(estado)){
      sql += ' WHERE estado = ?';
      vals.push(estado);
    }
    sql += ' ORDER BY creado_at DESC';
    const [rows] = await db.query(sql, vals);
    res.json({ ok:true, mensajes: rows });
  }catch(err){
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Admin: actualizar estado
app.patch('/api/admin/mensajes/:id', async (req,res)=>{
  try{
    const { id } = req.params;
    const { estado } = req.body || {};
    if (!['nuevo','atendido'].includes(estado)){
      return res.status(400).json({ ok:false, error:'Estado inválido' });
    }
    await ensureRecoverTable();
    const [result] = await db.query('UPDATE mensajes_recuperacion SET estado = ? WHERE id = ?', [estado, id]);
    if (result.affectedRows === 0) return res.status(404).json({ ok:false, error:'Mensaje no encontrado' });
    res.json({ ok:true });
  }catch(err){
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Login básico (demo) para estudiante/maestro/admin
// Nota: Por ahora se valida existencia del usuario; si el estudiante tiene CURP registrada y el cliente envía password, se compara con CURP (no recomendado para producción).
app.post('/api/login', async (req, res) => {
  // Debug básico
  console.log('=== DEBUG LOGIN ===');
  console.log('Body recibido:', req.body);
  console.log('Tipo:', req.body?.tipo);
  try {
    const { tipo, username, password } = req.body || {};
    const t = (typeof tipo === 'string' ? tipo.toLowerCase().trim() : tipo);
    // Normalizar alias comunes
    const tipoNorm = (t === 'administrativo' || t === 'administrador') ? 'admin'
                    : (t === 'profesor') ? 'maestro'
                    : t;

    if (!tipoNorm || !username) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: tipo y username' });
    }

    if (tipoNorm === 'estudiante') {
      const [rows] = await db.query(
        `SELECT id, matricula, nombre, curp, correo_institucional, estado, password_hash
         FROM estudiantes
         WHERE (matricula = ? OR correo_institucional = ?) AND estado = 'activo'
         LIMIT 1`,
        [username, username]
      );
      if (!rows || rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Estudiante no encontrado o inactivo' });
      }
      const est = rows[0];
      const hasPassword = !!est.password_hash;
      if (hasPassword) {
        if (!password) {
          return res.status(401).json({ ok: false, error: 'Contraseña requerida' });
        }
        const ok = bcrypt.compareSync(String(password), est.password_hash);
        if (!ok) {
          return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
        }
      }
      return res.json({ ok: true, user: { id: est.id, nombre: est.nombre, matricula: est.matricula, role: 'estudiante', hasPassword } });
    }

    if (tipoNorm === 'maestro') {
      const [rows] = await db.query(
        `SELECT id, codigo_profesor, nombre, correo, estado, password_hash
         FROM profesores
         WHERE (codigo_profesor = ? OR correo = ?) AND estado = 'activo'
         LIMIT 1`,
        [username, username]
      );
      if (!rows || rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Profesor no encontrado o inactivo' });
      }
      const prof = rows[0];
      const hasPassword = !!prof.password_hash;
      
      if (hasPassword) {
        if (!password) {
          return res.status(401).json({ ok: false, error: 'Contraseña requerida' });
        }
        const ok = bcrypt.compareSync(String(password), prof.password_hash);
        if (!ok) {
          return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
        }
      }
      
      return res.json({ ok: true, user: { id: prof.id, nombre: prof.nombre, codigo: prof.codigo_profesor, role: 'maestro', hasPassword } });
    }

    if (tipoNorm === 'admin') {
      const [rows] = await db.query(
        `SELECT id, username, nombre_completo, email, password_hash, role, is_active
         FROM usuarios
         WHERE (username = ? OR email = ?) AND role = 'admin' AND is_active = 1
         LIMIT 1`,
        [username, username]
      );
      if (!rows || rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'Administrador no encontrado o inactivo' });
      }
      const admin = rows[0];
      if (!password) return res.status(401).json({ ok: false, error: 'Contraseña requerida' });
      let ok = false;
      try {
        ok = bcrypt.compareSync(String(password), admin.password_hash);
      } catch (_) {
        ok = false;
      }
      // Permitir modo desarrollo si no es hash válido y coincide texto plano
      if (!ok && admin.password_hash && admin.password_hash.length < 20) {
        ok = String(password) === admin.password_hash;
      }
      if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      return res.json({ ok: true, user: { id: admin.id, nombre: admin.nombre_completo || admin.username, role: 'admin' } });
    }

    console.warn('Tipo de usuario no soportado:', tipo, 'normalizado:', tipoNorm);
    return res.status(400).json({ ok: false, error: 'Tipo de usuario no soportado' });
  } catch (err) {
    console.error('Error en /api/login:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Establecer contraseña inicial (requiere CURP como verificación)
app.post('/api/estudiantes/set-password', async (req, res) => {
  try {
    const { matricula, curp, newPassword } = req.body || {};
    if (!matricula || !curp || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Faltan campos: matricula, curp, newPassword' });
    }
    const [rows] = await db.query(
      `SELECT id, curp, password_hash FROM estudiantes WHERE matricula = ? AND estado = 'activo' LIMIT 1`,
      [matricula]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
    }
    const est = rows[0];
    if (est.password_hash) {
      return res.status(409).json({ ok: false, error: 'La contraseña ya está establecida. Usa cambio de contraseña.' });
    }
    if (!est.curp) {
      return res.status(400).json({ ok: false, error: 'CURP no registrada en el sistema. Contacta al administrador.' });
    }
    if (String(est.curp).toLowerCase() !== String(curp).toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'CURP incorrecta' });
    }
    const hash = bcrypt.hashSync(String(newPassword), 10);
    await db.query(`UPDATE estudiantes SET password_hash = ? WHERE id = ?`, [hash, est.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en set-password:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Cambiar contraseña existente
app.post('/api/estudiantes/change-password', async (req, res) => {
  try {
    const { matricula, currentPassword, newPassword } = req.body || {};
    if (!matricula || !currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Faltan campos: matricula, currentPassword, newPassword' });
    }
    const [rows] = await db.query(
      `SELECT id, password_hash FROM estudiantes WHERE matricula = ? AND estado = 'activo' LIMIT 1`,
      [matricula]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
    }
    const est = rows[0];
    if (!est.password_hash) {
      return res.status(409).json({ ok: false, error: 'No hay contraseña establecida. Usa establecer contraseña.' });
    }
    const ok = bcrypt.compareSync(String(currentPassword), est.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta' });
    }
    const hash = bcrypt.hashSync(String(newPassword), 10);
    await db.query(`UPDATE estudiantes SET password_hash = ? WHERE id = ?`, [hash, est.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en change-password:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Establecer contraseña inicial para profesores (requiere código de profesor como verificación)
app.post('/api/profesores/set-password', async (req, res) => {
  try {
    const { codigo_profesor, correo, newPassword } = req.body || {};
    if (!codigo_profesor || !correo || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Faltan campos: codigo_profesor, correo, newPassword' });
    }
    const [rows] = await db.query(
      `SELECT id, correo, password_hash FROM profesores WHERE codigo_profesor = ? AND estado = 'activo' LIMIT 1`,
      [codigo_profesor]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Profesor no encontrado' });
    }
    const prof = rows[0];
    if (prof.password_hash) {
      return res.status(409).json({ ok: false, error: 'La contraseña ya está establecida. Usa cambio de contraseña.' });
    }
    if (!prof.correo) {
      return res.status(400).json({ ok: false, error: 'Correo no registrado en el sistema. Contacta al administrador.' });
    }
    if (String(prof.correo).toLowerCase() !== String(correo).toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Correo incorrecto' });
    }
    const hash = bcrypt.hashSync(String(newPassword), 10);
    await db.query(`UPDATE profesores SET password_hash = ? WHERE id = ?`, [hash, prof.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en set-password profesor:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Cambiar contraseña existente de profesores
app.post('/api/profesores/change-password', async (req, res) => {
  try {
    const { codigo_profesor, currentPassword, newPassword } = req.body || {};
    if (!codigo_profesor || !currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Faltan campos: codigo_profesor, currentPassword, newPassword' });
    }
    const [rows] = await db.query(
      `SELECT id, password_hash FROM profesores WHERE codigo_profesor = ? AND estado = 'activo' LIMIT 1`,
      [codigo_profesor]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Profesor no encontrado' });
    }
    const prof = rows[0];
    if (!prof.password_hash) {
      return res.status(409).json({ ok: false, error: 'No hay contraseña establecida. Usa establecer contraseña.' });
    }
    const ok = bcrypt.compareSync(String(currentPassword), prof.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta' });
    }
    const hash = bcrypt.hashSync(String(newPassword), 10);
    await db.query(`UPDATE profesores SET password_hash = ? WHERE id = ?`, [hash, prof.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en change-password profesor:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// Estudiantes - CRUD completo
app.get('/api/estudiantes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM estudiantes ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/estudiantes', async (req, res) => {
  try {
    const body = req.body || {};
    // Campos permitidos para inserción
    const allowed = {
      matricula: null,
      nombre: null,
      curp: null,
      password_hash: null,
      fecha_nacimiento: null,
      lugar_nacimiento: null,
      correo_institucional: null,
      telefono: null,
      grado: null,
      grupo: null,
      carrera: null,
      plan_estudios: null,
      especialidad_academica: null,
      tutor_academico: null,
      foto_url: null,
      promedio: null,
      estado: 'activo'
    };

    const data = {};
    for (const k of Object.keys(allowed)) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
        data[k] = body[k];
      } else if (k === 'estado' && !body[k]) {
        data[k] = allowed[k];
      }
    }

    if (!data.matricula || !data.nombre) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos: matricula, nombre' });
    }

    // Construir SQL dinámico seguro
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?');
    const values = fields.map(k => data[k]);
    const sql = `INSERT INTO estudiantes (${fields.join(',')}) VALUES (${placeholders.join(',')})`;

    const [result] = await db.query(sql, values);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'La matrícula o dato único ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Actualizar estudiante
app.put('/api/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    
    // Campos permitidos para actualización (excluimos password_hash por seguridad)
    const allowed = {
      matricula: null,
      nombre: null,
      curp: null,
      fecha_nacimiento: null,
      lugar_nacimiento: null,
      correo_institucional: null,
      telefono: null,
      grado: null,
      grupo: null,
      carrera: null,
      plan_estudios: null,
      especialidad_academica: null,
      tutor_academico: null,
      foto_url: null,
      promedio: null,
      estado: null
    };

    const data = {};
    for (const k of Object.keys(allowed)) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
        data[k] = body[k];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'No hay datos para actualizar' });
    }

    // Construir SQL dinámico seguro
    const fields = Object.keys(data);
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(id);
    const sql = `UPDATE estudiantes SET ${setClause} WHERE id = ?`;

    const [result] = await db.query(sql, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
    }
    
    res.json({ ok: true, message: 'Estudiante actualizado exitosamente' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'La matrícula o dato único ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar estudiante
app.delete('/api/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM estudiantes WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
    }
    
    res.json({ ok: true, message: 'Estudiante eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Profesores
app.get('/api/profesores', async (req, res) => {
  try {
    const { area } = req.query;
    let sql = 'SELECT * FROM profesores';
    const vals = [];
    if (area) {
      // Filtrar por área vía materias_catalogo vinculando por campo materia (nombre/código)
      sql += ` WHERE (
        EXISTS (
          SELECT 1 FROM materias_catalogo mc
          JOIN areas a ON a.id = mc.area_id
          WHERE (
            mc.nombre = profesores.materia OR mc.codigo = profesores.materia
          ) AND a.nombre = ?
        )
      )`;
      vals.push(area);
    }
    sql += ' ORDER BY creado_at DESC';
    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profesores', async (req, res) => {
  try {
    const body = req.body || {};
    // Campos permitidos para inserción
    const allowed = {
      codigo_profesor: null,
      nombre: null,
      correo: null,
      telefono: null,
      departamento: null,
      especialidad: null,
      grado_academico: null,
      materia: null,
      estado: 'activo'
    };

    const data = {};
    for (const k of Object.keys(allowed)) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
        data[k] = body[k];
      } else if (k === 'estado' && !body[k]) {
        data[k] = allowed[k];
      }
    }

    if (!data.codigo_profesor || !data.nombre) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos: codigo_profesor, nombre' });
    }

    // Validación: si materia y especialidad vienen, verificar que la materia pertenezca al área de la especialidad
    if (data.materia && data.especialidad) {
      const [rowsVal] = await db.query(`
        SELECT 1
        FROM materias_catalogo mc
        JOIN areas a ON a.id = mc.area_id
        WHERE (mc.nombre = ? OR mc.codigo = ?) AND a.nombre = ?
        LIMIT 1
      `, [data.materia, data.materia, data.especialidad]);
      if (!rowsVal || rowsVal.length === 0) {
        return res.status(400).json({ ok: false, error: 'La especialidad no corresponde al área de la materia seleccionada' });
      }
    }

    // Construir SQL dinámico seguro
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?');
    const values = fields.map(k => data[k]);
    const sql = `INSERT INTO profesores (${fields.join(',')}) VALUES (${placeholders.join(',')})`;

    const [result] = await db.query(sql, values);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'El código de profesor ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener profesor por ID
app.get('/api/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM profesores WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Profesor no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Actualizar profesor
app.put('/api/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    
    // Campos permitidos para actualización
    const allowed = {
      codigo_profesor: null,
      nombre: null,
      correo: null,
      telefono: null,
      departamento: null,
      especialidad: null,
      grado_academico: null,
      materia: null,
      estado: null
    };

    const data = {};
    for (const k of Object.keys(allowed)) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
        data[k] = body[k];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'No hay datos para actualizar' });
    }

    // Validación de área-materia si ambos presentes
    if (body.materia && body.especialidad) {
      const [rowsVal] = await db.query(`
        SELECT 1
        FROM materias_catalogo mc
        JOIN areas a ON a.id = mc.area_id
        WHERE (mc.nombre = ? OR mc.codigo = ?) AND a.nombre = ?
        LIMIT 1
      `, [body.materia, body.materia, body.especialidad]);
      if (!rowsVal || rowsVal.length === 0) {
        return res.status(400).json({ ok: false, error: 'La especialidad no corresponde al área de la materia seleccionada' });
      }
    }

    // Construir SQL dinámico seguro
    const fields = Object.keys(data);
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(id);
    const sql = `UPDATE profesores SET ${setClause} WHERE id = ?`;

    const [result] = await db.query(sql, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Profesor no encontrado' });
    }
    
    res.json({ ok: true, message: 'Profesor actualizado exitosamente' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'El código de profesor ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== Catálogos de áreas y materias =====
app.get('/api/areas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nombre, descripcion FROM areas ORDER BY nombre');
    res.json({ ok: true, areas: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/materias-catalogo', async (req, res) => {
  try {
    const { area } = req.query;
    let sql = `
      SELECT mc.id, mc.nombre, mc.codigo, mc.descripcion, a.nombre AS area
      FROM materias_catalogo mc
      JOIN areas a ON a.id = mc.area_id`;
    const vals = [];
    if (area) {
      sql += ' WHERE a.nombre = ?';
      vals.push(area);
    }
    sql += ' ORDER BY mc.nombre';
    const [rows] = await db.query(sql, vals);
    res.json({ ok: true, materias: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar profesor
app.delete('/api/profesores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM profesores WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Profesor no encontrado' });
    }
    
    res.json({ ok: true, message: 'Profesor eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener clases del profesor con horarios
app.get('/api/profesores/:id/clases', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT c.id, c.nombre, c.codigo, c.aula, c.semestre,
              s.dia, s.inicio, s.fin,
              (SELECT COUNT(*) FROM inscripciones WHERE clase_id = c.id AND estado = 'activa') as total_estudiantes
       FROM clases c
       LEFT JOIN class_schedules s ON s.clase_id = c.id
       WHERE c.profesor_id = ?
       ORDER BY FIELD(s.dia,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'), s.inicio`,
      [id]
    );
    res.json({ ok: true, clases: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Clases
app.get('/api/clases', async (req, res) => {
  try {
    // Seleccionar columnas explícitas para evitar errores con ONLY_FULL_GROUP_BY
    const [rows] = await db.query(
      `SELECT 
         c.id, c.nombre, c.codigo, c.profesor_id, c.aula, c.cupo_maximo, c.semestre, c.descripcion, c.estado, c.creado_at, c.actualizado_at,
         p.nombre AS profesor_nombre, p.codigo_profesor,
         GROUP_CONCAT(CONCAT(s.dia, '|', s.inicio, '|', s.fin) SEPARATOR '::') AS horarios_concat
       FROM clases c
       LEFT JOIN profesores p ON c.profesor_id = p.id
       LEFT JOIN class_schedules s ON s.clase_id = c.id
       GROUP BY 
         c.id, c.nombre, c.codigo, c.profesor_id, c.aula, c.cupo_maximo, c.semestre, c.descripcion, c.estado, c.creado_at, c.actualizado_at,
         p.nombre, p.codigo_profesor
       ORDER BY c.nombre ASC`
    );

    const clasesConHorarios = rows.map(clase => {
      const horarios = [];
      if (clase.horarios_concat) {
        clase.horarios_concat.split('::').forEach(h => {
          const [dia, inicio, fin] = h.split('|');
          if (dia && inicio && fin) horarios.push({ dia, inicio, fin });
        });
      }
      const { horarios_concat, ...rest } = clase;
      return { ...rest, horarios };
    });

    res.json(clasesConHorarios);
  } catch (err) {
    console.error('Error en GET /api/clases:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener clases disponibles para inscripción (con cupo disponible)
app.get('/api/clases/disponibles', async (req, res) => {
  try {
    const { semestre } = req.query;
    
    if (!semestre) {
      return res.status(400).json({ ok: false, error: 'El parámetro semestre es requerido' });
    }

    // Consulta que obtiene clases con cupo disponible
    // Búsqueda flexible: puede ser coincidencia exacta o parcial
    const [clases] = await db.query(`
      SELECT 
        c.id,
        c.nombre,
        c.codigo,
        c.descripcion,
        c.semestre,
        c.cupo_maximo,
        p.nombre AS profesor_nombre,
        p.materia AS profesor_materia,
        COUNT(i.id) AS inscritos,
        (c.cupo_maximo - COUNT(i.id)) AS cupo_disponible,
        GROUP_CONCAT(
          CONCAT(cs.dia, ' ', TIME_FORMAT(cs.inicio, '%H:%i'), '-', TIME_FORMAT(cs.fin, '%H:%i'))
          ORDER BY FIELD(cs.dia, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Sábado')
          SEPARATOR ', '
        ) AS horario
      FROM clases c
      LEFT JOIN profesores p ON c.profesor_id = p.id
      LEFT JOIN inscripciones i ON c.id = i.clase_id AND i.estado = 'activa'
      LEFT JOIN class_schedules cs ON c.id = cs.clase_id
      WHERE c.semestre LIKE ?
      GROUP BY c.id, c.nombre, c.codigo, c.descripcion, c.semestre, c.cupo_maximo, p.nombre, p.materia
      HAVING cupo_disponible > 0
      ORDER BY c.nombre
    `, [`%${semestre}%`]);

    res.json({ ok: true, clases });
  } catch (err) {
    console.error('Error al obtener clases disponibles:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener clase por ID con horarios
app.get('/api/clases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT c.*, p.nombre as profesor_nombre FROM clases c LEFT JOIN profesores p ON c.profesor_id = p.id WHERE c.id = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Clase no encontrada' });
    }
    
    const clase = rows[0];
    
    // Obtener horarios
    const [schedules] = await db.query(
      'SELECT dia, inicio, fin FROM class_schedules WHERE clase_id = ? ORDER BY FIELD(dia,"Lunes","Martes","Miércoles","Jueves","Viernes","Sábado")',
      [id]
    );
    
    clase.horarios = schedules;
    res.json(clase);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener estudiantes inscritos en una clase
app.get('/api/clases/:id/estudiantes', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT e.id, e.matricula, e.nombre, e.correo_institucional AS correo, e.telefono,
              e.grado, e.grupo, e.carrera, i.semestre, i.estado,
              cal.id AS calificacion_id, cal.puntaje AS puntaje, cal.observacion AS observacion, cal.fecha AS fecha_calificacion
       FROM inscripciones i
       INNER JOIN estudiantes e ON e.id = i.estudiante_id
       LEFT JOIN calificaciones cal ON cal.estudiante_id = e.id AND cal.clase_id = i.clase_id
       WHERE i.clase_id = ? AND i.estado = 'activa'
       ORDER BY e.nombre ASC`,
      [id]
    );
    res.json({ ok: true, estudiantes: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Crear o actualizar calificación (upsert por estudiante y clase)
app.post('/api/calificaciones', async (req, res) => {
  try {
    const { estudiante_id, clase_id, puntaje, observacion } = req.body || {};
    if (!estudiante_id || !clase_id) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: estudiante_id y clase_id' });
    }
    let p = null;
    if (puntaje !== undefined && puntaje !== null && puntaje !== '') {
      p = Number(puntaje);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return res.status(400).json({ ok: false, error: 'El puntaje debe ser un número entre 0 y 100' });
      }
    }
    const obs = observacion != null ? String(observacion).slice(0, 1000) : null;

    // Verificar si ya existe calificación para ese estudiante y clase
    const [ex] = await db.query(
      'SELECT id FROM calificaciones WHERE estudiante_id = ? AND clase_id = ? LIMIT 1',
      [estudiante_id, clase_id]
    );
    if (ex && ex.length > 0) {
      const calId = ex[0].id;
      await db.query(
        'UPDATE calificaciones SET puntaje = ?, observacion = ?, fecha = NOW() WHERE id = ?',
        [p, obs, calId]
      );
      return res.json({ ok: true, calificacion_id: calId, message: 'Calificación actualizada' });
    }
    const [ins] = await db.query(
      'INSERT INTO calificaciones (estudiante_id, clase_id, puntaje, observacion, fecha) VALUES (?,?,?,?, NOW())',
      [estudiante_id, clase_id, p, obs]
    );
    res.json({ ok: true, calificacion_id: ins.insertId, message: 'Calificación registrada' });
  } catch (err) {
    console.error('Error en POST /api/calificaciones:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Crear clase con horarios
app.post('/api/clases', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    const { nombre, codigo, profesor_id, aula, cupo_maximo, semestre, descripcion, horarios } = req.body;
    
    if (!nombre || !codigo) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Campos requeridos: nombre, codigo' });
    }
    
    // Insertar clase
    const [result] = await conn.query(
      `INSERT INTO clases (nombre, codigo, profesor_id, aula, cupo_maximo, semestre, descripcion) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, codigo, profesor_id || null, aula || null, cupo_maximo || 30, semestre || null, descripcion || null]
    );
    
    const claseId = result.insertId;
    
    // Insertar horarios si existen
    if (horarios && Array.isArray(horarios) && horarios.length > 0) {
      for (const h of horarios) {
        if (h.dia && h.inicio && h.fin) {
          await conn.query(
            'INSERT INTO class_schedules (clase_id, dia, inicio, fin) VALUES (?, ?, ?, ?)',
            [claseId, h.dia, h.inicio, h.fin]
          );
        }
      }
    }
    
    await conn.commit();
    res.json({ ok: true, id: claseId });
  } catch (err) {
    await conn.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'El código de clase ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// Actualizar clase con horarios
app.put('/api/clases/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const { nombre, codigo, profesor_id, aula, cupo_maximo, semestre, descripcion, horarios } = req.body;
    
    // Actualizar clase
    const [result] = await conn.query(
      `UPDATE clases SET nombre = ?, codigo = ?, profesor_id = ?, aula = ?, cupo_maximo = ?, semestre = ?, descripcion = ? 
       WHERE id = ?`,
      [nombre, codigo, profesor_id || null, aula || null, cupo_maximo || 30, semestre || null, descripcion || null, id]
    );
    
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Clase no encontrada' });
    }
    
    // Eliminar horarios existentes
    await conn.query('DELETE FROM class_schedules WHERE clase_id = ?', [id]);
    
    // Insertar nuevos horarios
    if (horarios && Array.isArray(horarios) && horarios.length > 0) {
      for (const h of horarios) {
        if (h.dia && h.inicio && h.fin) {
          await conn.query(
            'INSERT INTO class_schedules (clase_id, dia, inicio, fin) VALUES (?, ?, ?, ?)',
            [id, h.dia, h.inicio, h.fin]
          );
        }
      }
    }
    
    await conn.commit();
    res.json({ ok: true, message: 'Clase actualizada exitosamente' });
  } catch (err) {
    await conn.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'El código de clase ya existe' });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// Obtener semestres disponibles
app.get('/api/semestres', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT semestre 
      FROM clases 
      WHERE semestre IS NOT NULL AND semestre != ''
      ORDER BY semestre DESC
    `);
    const semestres = rows.map(r => r.semestre);
    res.json({ ok: true, semestres });
  } catch (err) {
    console.error('Error al obtener semestres:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// (Movida más arriba) Ruta /api/clases/disponibles definida antes de /api/clases/:id para evitar conflictos

// Eliminar clase
app.delete('/api/clases/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    
    // Eliminar horarios primero (foreign key)
    await conn.query('DELETE FROM class_schedules WHERE clase_id = ?', [id]);
    
    // Eliminar clase
    const [result] = await conn.query('DELETE FROM clases WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Clase no encontrada' });
    }
    
    await conn.commit();
    res.json({ ok: true, message: 'Clase eliminada exitosamente' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ----- Endpoints específicos por estudiante -----
// Detalle de estudiante por id (usado tanto por admin como por estudiante)
app.get('/api/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM estudiantes WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
    const e = rows[0];
    // Retornar tanto en formato simple como en el formato esperado por el frontend
    res.json(e);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Materias del estudiante (según clases donde tenga calificaciones registradas) y promedio por materia
app.get('/api/estudiantes/:id/materias', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT c.id as clase_id, c.nombre as materia, IFNULL(p.nombre,'') as profesor,
              ROUND(AVG(cal.puntaje),2) as promedio_materia
       FROM inscripciones i
       JOIN clases c ON i.clase_id = c.id
       LEFT JOIN profesores p ON c.profesor_id = p.id
       LEFT JOIN calificaciones cal ON cal.clase_id = c.id AND cal.estudiante_id = i.estudiante_id
       WHERE i.estudiante_id = ? AND i.estado = 'activa'
       GROUP BY c.id, c.nombre, p.nombre
       ORDER BY c.nombre ASC`,
      [id]
    );
    res.json({ ok: true, materias: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Inscribir estudiante en una clase
app.post('/api/inscripciones', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { estudiante_id, clase_id, semestre } = req.body;

    // Validar parámetros requeridos
    if (!estudiante_id || !clase_id || !semestre) {
      await conn.rollback();
      return res.status(400).json({ 
        ok: false, 
        error: 'Faltan parámetros requeridos: estudiante_id, clase_id, semestre' 
      });
    }

    // Verificar que el estudiante existe
    const [estudiante] = await conn.query('SELECT id FROM estudiantes WHERE id = ?', [estudiante_id]);
    if (estudiante.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
    }

    // Verificar que la clase existe y obtener información
    const [clase] = await conn.query(
      'SELECT id, nombre, semestre, cupo_maximo FROM clases WHERE id = ?', 
      [clase_id]
    );
    if (clase.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Clase no encontrada' });
    }

    // Verificar que el semestre coincide
    if (clase[0].semestre !== semestre) {
      await conn.rollback();
      return res.status(400).json({ 
        ok: false, 
        error: `Esta clase es del semestre ${clase[0].semestre}, no coincide con ${semestre}` 
      });
    }

    // Verificar si ya existe una inscripción para esta clase (activa o inactiva)
    const [yaExiste] = await conn.query(
      'SELECT id, estado FROM inscripciones WHERE estudiante_id = ? AND clase_id = ? LIMIT 1',
      [estudiante_id, clase_id]
    );
    if (yaExiste && yaExiste.length > 0) {
      const ins = yaExiste[0];
      if (ins.estado === 'activa') {
        await conn.rollback();
        return res.status(409).json({ ok: false, error: 'Ya estás inscrito en esta clase' });
      }
      // Si existe como inactiva, reactivar en lugar de insertar (evitar UNIQUE KEY conflict)
      await conn.query('UPDATE inscripciones SET estado = "activa", semestre = ? WHERE id = ?', [semestre, ins.id]);

      // Recalcular cupo tras reactivación
      const [inscritosRe] = await conn.query(
        'SELECT COUNT(*) as total FROM inscripciones WHERE clase_id = ? AND estado = "activa"',
        [clase_id]
      );
      const totalRe = inscritosRe[0].total;
      const cupoRestanteRe = clase[0].cupo_maximo - totalRe;
      await conn.commit();
      return res.json({ ok: true, message: `Inscripción reactivada en ${clase[0].nombre}`, inscripcion_id: ins.id, cupo_restante: cupoRestanteRe });
    }

    // Verificar cupo disponible
    const [inscritos] = await conn.query(
      'SELECT COUNT(*) as total FROM inscripciones WHERE clase_id = ? AND estado = "activa"',
      [clase_id]
    );
    const totalInscritos = inscritos[0].total;
    const cupoDisponible = clase[0].cupo_maximo - totalInscritos;

    if (cupoDisponible <= 0) {
      await conn.rollback();
      return res.status(409).json({ 
        ok: false, 
        error: `No hay cupo disponible. La clase está llena (${totalInscritos}/${clase[0].cupo_maximo})` 
      });
    }

    // Inscribir al estudiante (no existe registro previo)
    const [result] = await conn.query(
      'INSERT INTO inscripciones (estudiante_id, clase_id, semestre, estado) VALUES (?, ?, ?, "activa")',
      [estudiante_id, clase_id, semestre]
    );

    await conn.commit();
    
    res.json({ 
      ok: true, 
      message: `Te has inscrito exitosamente en ${clase[0].nombre}`,
      inscripcion_id: result.insertId,
      cupo_restante: cupoDisponible - 1
    });

  } catch (err) {
    await conn.rollback();
    console.error('Error al inscribir estudiante:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// Cancelar inscripción (marcar como cancelada)
app.delete('/api/inscripciones/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que exista y esté activa
    const [rows] = await db.query('SELECT id, estado FROM inscripciones WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Inscripción no encontrada' });
    }

    if (rows[0].estado !== 'activa') {
      return res.status(409).json({ ok: false, error: 'La inscripción ya no está activa' });
    }

    await db.query('UPDATE inscripciones SET estado = "inactiva" WHERE id = ?', [id]);
    res.json({ ok: true, message: 'Clase quitada (inscripción inactiva)' });

  } catch (err) {
    console.error('Error al cancelar inscripción:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener inscripciones de un estudiante
app.get('/api/estudiantes/:id/inscripciones', async (req, res) => {
  try {
    const { id } = req.params;

    const [inscripciones] = await db.query(`
      SELECT 
        i.id AS inscripcion_id,
        i.semestre,
        i.estado,
        i.creado_at AS fecha_inscripcion,
        c.id AS clase_id,
        c.nombre AS clase_nombre,
        c.codigo AS clase_codigo,
        c.descripcion AS clase_descripcion,
        p.nombre AS profesor_nombre,
        p.materia AS profesor_materia,
        cal.puntaje AS calificacion,
        cal.observacion AS observacion_calificacion,
        GROUP_CONCAT(
          CONCAT(cs.dia, ' ', TIME_FORMAT(cs.inicio, '%H:%i'), '-', TIME_FORMAT(cs.fin, '%H:%i'))
          ORDER BY FIELD(cs.dia, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')
          SEPARATOR ', '
        ) AS horario
      FROM inscripciones i
      INNER JOIN clases c ON i.clase_id = c.id
      LEFT JOIN profesores p ON c.profesor_id = p.id
      LEFT JOIN calificaciones cal ON cal.estudiante_id = i.estudiante_id AND cal.clase_id = c.id
      LEFT JOIN class_schedules cs ON c.id = cs.clase_id
      WHERE i.estudiante_id = ? AND i.estado = 'activa'
      GROUP BY i.id, i.semestre, i.estado, i.creado_at, c.id, c.nombre, c.codigo, c.descripcion, 
               p.nombre, p.materia, cal.puntaje, cal.observacion
      ORDER BY c.nombre
    `, [id]);

    res.json({ ok: true, inscripciones });
  } catch (err) {
    console.error('Error al obtener inscripciones:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Calificaciones detalladas
app.get('/api/estudiantes/:id/calificaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT c.id AS clase_id, c.nombre as materia, IFNULL(p.nombre,'') as profesor,
              cal.id AS calificacion_id, cal.puntaje, cal.observacion, cal.fecha
       FROM calificaciones cal
       LEFT JOIN clases c ON cal.clase_id = c.id
       LEFT JOIN profesores p ON c.profesor_id = p.id
       WHERE cal.estudiante_id = ?
       ORDER BY cal.fecha DESC`,
      [id]
    );
    res.json({ ok: true, calificaciones: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Enviar pregunta sobre calificación (estudiante -> profesor)
app.post('/api/calificaciones/pregunta', async (req, res) => {
  try {
    const { estudiante_id, clase_id, mensaje } = req.body || {};
    if (!estudiante_id || !clase_id || !mensaje) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros requeridos' });
    }

    // Crear/Actualizar esquema si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS preguntas_calificaciones (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        estudiante_id INT UNSIGNED NOT NULL,
        profesor_id INT UNSIGNED DEFAULT NULL,
        clase_id INT UNSIGNED NOT NULL,
        mensaje TEXT NOT NULL,
        estado ENUM('nueva','leida','respondida','cerrada') DEFAULT 'nueva',
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        respuesta TEXT NULL,
        respuesta_fecha TIMESTAMP NULL DEFAULT NULL,
        respuesta_profesor_id INT UNSIGNED NULL,
        CONSTRAINT fk_pc_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_pc_prof FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_pc_clase FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
    // Asegurar columnas nuevas en instalaciones previas
    try { await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN IF NOT EXISTS respuesta TEXT NULL'); } catch(_) {}
    try { await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN IF NOT EXISTS respuesta_fecha TIMESTAMP NULL DEFAULT NULL'); } catch(_) {}
    try { await db.query('ALTER TABLE preguntas_calificaciones ADD COLUMN IF NOT EXISTS respuesta_profesor_id INT UNSIGNED NULL'); } catch(_) {}

    // Obtener profesor de la clase
    const [clase] = await db.query('SELECT profesor_id FROM clases WHERE id = ? LIMIT 1', [clase_id]);
    const profesor_id = (clase && clase[0] && clase[0].profesor_id) || null;

    await db.query(
      'INSERT INTO preguntas_calificaciones (estudiante_id, profesor_id, clase_id, mensaje) VALUES (?,?,?,?)',
      [estudiante_id, profesor_id, clase_id, String(mensaje).slice(0, 3000)]
    );

    res.json({ ok: true, message: 'Tu pregunta fue enviada al profesor' });
  } catch (err) {
    console.error('Error al enviar pregunta:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Listar preguntas para un profesor
app.get('/api/profesores/:id/preguntas-calificaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT pc.id, pc.estudiante_id, e.nombre AS estudiante_nombre,
             pc.clase_id, c.nombre AS clase_nombre,
             pc.mensaje, pc.estado, pc.creado_at,
             pc.respuesta, pc.respuesta_fecha
      FROM preguntas_calificaciones pc
      LEFT JOIN estudiantes e ON e.id = pc.estudiante_id
      LEFT JOIN clases c ON c.id = pc.clase_id
      WHERE (pc.profesor_id = ? OR c.profesor_id = ?)
      ORDER BY pc.creado_at DESC
    `, [id, id]);
    res.json({ ok: true, preguntas: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Responder a una pregunta (profesor -> estudiante)
app.post('/api/preguntas/:id/responder', async (req, res) => {
  try {
    const { id } = req.params;
    const { profesor_id, respuesta } = req.body || {};
    if (!profesor_id || !respuesta) return res.status(400).json({ ok:false, error:'Faltan campos: profesor_id, respuesta' });
    // Verificar que la pregunta exista y pertenezca al profesor
    const [rows] = await db.query('SELECT id, profesor_id FROM preguntas_calificaciones WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok:false, error:'Pregunta no encontrada' });
    if (String(rows[0].profesor_id) !== String(profesor_id)) return res.status(403).json({ ok:false, error:'No autorizado' });
    await db.query(
      'UPDATE preguntas_calificaciones SET respuesta = ?, respuesta_fecha = NOW(), respuesta_profesor_id = ?, estado = "respondida" WHERE id = ?',
      [String(respuesta).slice(0,3000), profesor_id, id]
    );
    res.json({ ok:true });
  } catch (err) {
    console.error('Error en responder pregunta:', err);
    res.status(500).json({ ok:false, error:'Error interno del servidor' });
  }
});

// Editar respuesta de una pregunta (profesor)
app.patch('/api/preguntas/:id/respuesta', async (req, res) => {
  try {
    const { id } = req.params;
    const { profesor_id, respuesta } = req.body || {};
    if (!profesor_id || typeof respuesta !== 'string') {
      return res.status(400).json({ ok:false, error:'Faltan campos: profesor_id, respuesta' });
    }
    // Verificar pregunta y autoría
    const [rows] = await db.query('SELECT profesor_id FROM preguntas_calificaciones WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok:false, error:'Pregunta no encontrada' });
    if (String(rows[0].profesor_id) !== String(profesor_id)) return res.status(403).json({ ok:false, error:'No autorizado' });
    const respSafe = respuesta.slice(0,3000);
    await db.query(
      'UPDATE preguntas_calificaciones SET respuesta = ?, respuesta_fecha = NOW(), respuesta_profesor_id = ?, estado = "respondida" WHERE id = ?',
      [respSafe, profesor_id, id]
    );
    res.json({ ok:true });
  } catch (err) {
    console.error('Error en PATCH /api/preguntas/:id/respuesta:', err);
    res.status(500).json({ ok:false, error:'Error interno del servidor' });
  }
});

// Mensajes/respuestas para un estudiante
app.get('/api/estudiantes/:id/mensajes-respuestas', async (req,res)=>{
  try{
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT pc.id, pc.clase_id, c.nombre AS clase_nombre,
             pc.mensaje AS pregunta, pc.creado_at AS fecha_pregunta,
             pc.respuesta, pc.respuesta_fecha
      FROM preguntas_calificaciones pc
      LEFT JOIN clases c ON c.id = pc.clase_id
      WHERE pc.estudiante_id = ?
      ORDER BY COALESCE(pc.respuesta_fecha, pc.creado_at) DESC
    `,[id]);
    res.json({ ok:true, mensajes: rows });
  }catch(err){
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Horario del estudiante (según clases relacionadas por calificaciones)
app.get('/api/estudiantes/:id/horario', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT i.id AS inscripcion_id, c.id AS clase_id,
              c.nombre as materia, IFNULL(p.nombre,'') as profesor, c.aula,
              s.dia, s.inicio, s.fin
       FROM inscripciones i
       JOIN clases c ON i.clase_id = c.id
       LEFT JOIN profesores p ON c.profesor_id = p.id
       LEFT JOIN class_schedules s ON s.clase_id = c.id
       WHERE i.estudiante_id = ? AND i.estado = 'activa'
       ORDER BY FIELD(s.dia,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'), s.inicio`,
      [id]
    );
    res.json({ ok: true, horario: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Inscripciones del estudiante
app.get('/api/estudiantes/:id/inscripciones', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT i.id, i.semestre, i.estado, c.id as clase_id, c.nombre as materia, c.codigo,
              IFNULL(p.nombre,'') as profesor
       FROM inscripciones i
       JOIN clases c ON i.clase_id = c.id
       LEFT JOIN profesores p ON c.profesor_id = p.id
       WHERE i.estudiante_id = ?
       ORDER BY i.creado_at DESC`,
      [id]
    );
    res.json({ ok: true, inscripciones: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Documentos del estudiante
async function ensureDocumentsTable(){
  await db.query(`
    CREATE TABLE IF NOT EXISTS documentos_estudiantes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      estudiante_id INT UNSIGNED NOT NULL,
      tipo VARCHAR(120) NOT NULL,
      nombre_original VARCHAR(255) NULL,
      archivo_url VARCHAR(500) NOT NULL,
      creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_doc_est FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE ON UPDATE CASCADE,
      INDEX idx_doc_est (estudiante_id)
    ) ENGINE=InnoDB
  `);
  // Asegurar columnas nuevas si tabla existe sin ellas
  try { await db.query('ALTER TABLE documentos_estudiantes ADD COLUMN nombre_original VARCHAR(255) NULL'); } catch(_) {}
}

app.get('/api/estudiantes/:id/documentos', async (req, res) => {
  try {
    await ensureDocumentsTable();
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT id, tipo, COALESCE(nombre_original, SUBSTRING_INDEX(archivo_url,'/',-1)) AS nombre_original, archivo_url, creado_at
       FROM documentos_estudiantes WHERE estudiante_id = ? ORDER BY creado_at DESC`,
      [id]
    );
    res.json({ ok: true, documentos: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Subir documento de estudiante (multipart/form-data)
app.post('/api/estudiantes/:id/documentos', upload.single('file'), async (req, res) => {
  try {
    await ensureDocumentsTable();
    const { id } = req.params;
    const tipo = (req.body?.tipo || 'Documento').toString().slice(0, 120);
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Archivo no recibido' });
    }
    const originalName = (req.file.originalname || 'archivo').slice(0,255);
    const relPath = path.join('/uploads', 'estudiantes', String(id), req.file.filename).replace(/\\/g, '/');
    await db.query(
      `INSERT INTO documentos_estudiantes (estudiante_id, tipo, nombre_original, archivo_url) VALUES (?,?,?,?)`,
      [id, tipo, originalName, relPath]
    );
    res.json({ ok: true, documento: { tipo, nombre_original: originalName, archivo_url: relPath, creado_at: new Date() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Subir foto de perfil del estudiante
app.post('/api/estudiantes/:id/foto', upload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ ok: false, error: 'Archivo de imagen no recibido' });
    const mime = req.file.mimetype || '';
    if (!/^image\//i.test(mime)) {
      // eliminar archivo no imagen
      try { await fsp.unlink(req.file.path); } catch (_) {}
      return res.status(400).json({ ok: false, error: 'Solo se permiten imágenes' });
    }
    
    // Procesar imagen: redimensionar a 512x512 y optimizar
    const outputFilename = `foto_${Date.now()}.jpg`;
    const outputPath = path.join(__dirname, 'uploads', 'estudiantes', String(id), outputFilename);
    await sharp(req.file.path)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    // Eliminar archivo original subido
    try { await fsp.unlink(req.file.path); } catch (_) {}
    
    const relPath = path.join('/uploads', 'estudiantes', String(id), outputFilename).replace(/\\/g, '/');
    await db.query('UPDATE estudiantes SET foto_url = ? WHERE id = ?', [relPath, id]);
    res.json({ ok: true, foto_url: relPath });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Configuración de almacenamiento para foto de administradores
const adminStorage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const userId = String(req.params.id || '').trim();
      const base = path.join(__dirname, 'uploads', 'admin', userId || 'unknown');
      await fsp.mkdir(base, { recursive: true });
      cb(null, base);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const safe = (file.originalname || 'archivo')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 140);
    const ts = Date.now();
    cb(null, `${ts}_${safe}`);
  }
});
const adminUpload = multer({ storage: adminStorage });

// Subir foto de perfil del administrador
app.post('/api/usuarios/:id/foto', adminUpload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ ok: false, error: 'Archivo de imagen no recibido' });
    const mime = req.file.mimetype || '';
    if (!/^image\//i.test(mime)) {
      try { await fsp.unlink(req.file.path); } catch (_) {}
      return res.status(400).json({ ok: false, error: 'Solo se permiten imágenes' });
    }
    
    // Procesar imagen: redimensionar a 512x512 y optimizar
    const outputFilename = `foto_${Date.now()}.jpg`;
    const outputPath = path.join(__dirname, 'uploads', 'admin', String(id), outputFilename);
    await sharp(req.file.path)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    try { await fsp.unlink(req.file.path); } catch (_) {}
    
    const relPath = path.join('/uploads', 'admin', String(id), outputFilename).replace(/\\/g, '/');
    
    // Verificar si la tabla usuarios tiene columna foto_url, si no, agregarla
    try {
      await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [relPath, id]);
    } catch (err) {
      // Si falla por columna inexistente, crear la columna
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await db.query('ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(500) DEFAULT NULL');
        await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [relPath, id]);
      } else {
        throw err;
      }
    }
    
    res.json({ ok: true, foto_url: relPath });
  } catch (err) {
    console.error('Error al subir foto admin:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Configuración de almacenamiento para foto de profesores
const profStorage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const profId = String(req.params.id || '').trim();
      const base = path.join(__dirname, 'uploads', 'profesores', profId || 'unknown');
      await fsp.mkdir(base, { recursive: true });
      cb(null, base);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const safe = (file.originalname || 'archivo')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 140);
    const ts = Date.now();
    cb(null, `${ts}_${safe}`);
  }
});
const profUpload = multer({ storage: profStorage });

// Subir foto de perfil del profesor
app.post('/api/profesores/:id/foto', profUpload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ ok: false, error: 'Archivo de imagen no recibido' });
    const mime = req.file.mimetype || '';
    if (!/^image\//i.test(mime)) {
      try { await fsp.unlink(req.file.path); } catch (_) {}
      return res.status(400).json({ ok: false, error: 'Solo se permiten imágenes' });
    }
    // Restringir a formatos soportados por sharp en este entorno
    const allowed = new Set(['image/jpeg','image/jpg','image/png','image/webp']);
    if (!allowed.has(mime.toLowerCase())) {
      try { await fsp.unlink(req.file.path); } catch (_) {}
      return res.status(415).json({ ok: false, error: 'Formato de imagen no soportado. Usa JPG, PNG o WEBP.' });
    }

    // Procesar imagen a 512x512
    const outputFilename = `foto_${Date.now()}.jpg`;
    const outputPath = path.join(__dirname, 'uploads', 'profesores', String(id), outputFilename);
    await sharp(req.file.path)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    try { await fsp.unlink(req.file.path); } catch (_) {}

    const relPath = path.join('/uploads', 'profesores', String(id), outputFilename).replace(/\\/g, '/');

    // Actualizar columna foto_url; crear si no existe
    try {
      await db.query('UPDATE profesores SET foto_url = ? WHERE id = ?', [relPath, id]);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await db.query('ALTER TABLE profesores ADD COLUMN foto_url VARCHAR(500) DEFAULT NULL');
        await db.query('UPDATE profesores SET foto_url = ? WHERE id = ?', [relPath, id]);
      } else {
        throw err;
      }
    }

    res.json({ ok: true, foto_url: relPath });
  } catch (err) {
    console.error('Error al subir foto profesor:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener usuario admin por ID (para mostrar datos en dashboard)
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT id, username, nombre_completo, email, foto_url, role, is_active FROM usuarios WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }
    res.json({ ok: true, usuario: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Estadísticas para el dashboard del admin
app.get('/api/admin/estadisticas', async (req, res) => {
  try {
    const [estudiantes] = await db.query('SELECT COUNT(*) as total FROM estudiantes WHERE estado = "activo"');
    const [profesores] = await db.query('SELECT COUNT(*) as total FROM profesores WHERE estado = "activo"');
    const [clases] = await db.query('SELECT COUNT(*) as total FROM clases WHERE estado = "activa"');
    const [inscripciones] = await db.query('SELECT COUNT(*) as total FROM inscripciones WHERE estado = "activa"');
    const [promedioGeneral] = await db.query('SELECT AVG(promedio) as promedio FROM estudiantes WHERE promedio IS NOT NULL AND estado = "activo"');
    
    // Últimas inscripciones
    const [ultimasInscripciones] = await db.query(`
      SELECT i.creado_at, e.nombre as estudiante, c.nombre as clase
      FROM inscripciones i
      JOIN estudiantes e ON e.id = i.estudiante_id
      JOIN clases c ON c.id = i.clase_id
      WHERE i.estado = 'activa'
      ORDER BY i.creado_at DESC
      LIMIT 5
    `);
    
    res.json({
      ok: true,
      estadisticas: {
        total_estudiantes: estudiantes[0].total || 0,
        total_profesores: profesores[0].total || 0,
        total_clases: clases[0].total || 0,
        total_inscripciones: inscripciones[0].total || 0,
        promedio_general: promedioGeneral[0].promedio ? Number(promedioGeneral[0].promedio).toFixed(2) : '0.00',
        ultimas_inscripciones: ultimasInscripciones || []
      }
    });
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== PLANES DE ESTUDIO =====

// Obtener todos los planes de estudio
app.get('/api/planes-estudio', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, nombre, carrera, codigo, duracion_semestres, creditos_totales, 
             descripcion, estado, creado_at, actualizado_at
      FROM planes_estudio
      ORDER BY creado_at DESC
    `);
    res.json({ success: true, planes: rows });
  } catch (err) {
    console.error('Error al obtener planes de estudio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obtener un plan de estudio por ID
app.get('/api/planes-estudio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT id, nombre, carrera, codigo, duracion_semestres, creditos_totales,
             descripcion, estado, creado_at, actualizado_at
      FROM planes_estudio
      WHERE id = ?
      LIMIT 1
    `, [id]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan de estudio no encontrado' });
    }
    
    res.json({ success: true, plan: rows[0] });
  } catch (err) {
    console.error('Error al obtener plan de estudio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Crear nuevo plan de estudio
app.post('/api/planes-estudio', async (req, res) => {
  try {
    const { nombre, carrera, codigo, duracion_semestres, creditos_totales, descripcion, estado } = req.body;
    
    if (!nombre || !carrera) {
      return res.status(400).json({ 
        success: false, 
        message: 'Campos requeridos: nombre, carrera' 
      });
    }
    
    const [result] = await db.query(`
      INSERT INTO planes_estudio (nombre, carrera, codigo, duracion_semestres, creditos_totales, descripcion, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre,
      carrera,
      codigo || null,
      duracion_semestres || 9,
      creditos_totales || null,
      descripcion || null,
      estado || 'activo'
    ]);
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'El código de plan de estudio ya existe' 
      });
    }
    console.error('Error al crear plan de estudio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Actualizar plan de estudio
app.put('/api/planes-estudio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, carrera, codigo, duracion_semestres, creditos_totales, descripcion, estado } = req.body;
    
    const [result] = await db.query(`
      UPDATE planes_estudio
      SET nombre = ?, carrera = ?, codigo = ?, duracion_semestres = ?,
          creditos_totales = ?, descripcion = ?, estado = ?
      WHERE id = ?
    `, [
      nombre,
      carrera,
      codigo || null,
      duracion_semestres || 9,
      creditos_totales || null,
      descripcion || null,
      estado || 'activo',
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan de estudio no encontrado' 
      });
    }
    
    res.json({ success: true, message: 'Plan actualizado correctamente' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'El código de plan de estudio ya existe' 
      });
    }
    console.error('Error al actualizar plan de estudio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Eliminar plan de estudio
app.delete('/api/planes-estudio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await db.query('DELETE FROM planes_estudio WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan de estudio no encontrado' 
      });
    }
    
    res.json({ success: true, message: 'Plan eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar plan de estudio:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obtener materias de un plan de estudio
app.get('/api/planes-estudio/:id/materias', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query(`
      SELECT pem.id, pem.plan_estudio_id, pem.clase_id, pem.semestre,
             pem.creditos, pem.es_obligatoria, pem.orden,
             c.nombre AS clase_nombre, c.codigo AS clase_codigo, c.descripcion AS clase_descripcion
      FROM plan_estudio_materias pem
      INNER JOIN clases c ON c.id = pem.clase_id
      WHERE pem.plan_estudio_id = ?
      ORDER BY pem.semestre ASC, pem.orden ASC, c.nombre ASC
    `, [id]);
    
    res.json({ success: true, materias: rows });
  } catch (err) {
    console.error('Error al obtener materias del plan:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obtener una relación plan-materia por ID
app.get('/api/plan-materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query(`
      SELECT pem.id, pem.plan_estudio_id, pem.clase_id, pem.semestre,
             pem.creditos, pem.es_obligatoria, pem.orden,
             c.nombre AS clase_nombre, c.codigo AS clase_codigo
      FROM plan_estudio_materias pem
      INNER JOIN clases c ON c.id = pem.clase_id
      WHERE pem.id = ?
      LIMIT 1
    `, [id]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relación plan-materia no encontrada' 
      });
    }
    
    res.json({ success: true, materia: rows[0] });
  } catch (err) {
    console.error('Error al obtener relación plan-materia:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Agregar materia a un plan de estudio
app.post('/api/plan-materias', async (req, res) => {
  try {
    const { plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden } = req.body;
    
    if (!plan_estudio_id || !clase_id || !semestre) {
      return res.status(400).json({ 
        success: false, 
        message: 'Campos requeridos: plan_estudio_id, clase_id, semestre' 
      });
    }
    
    const [result] = await db.query(`
      INSERT INTO plan_estudio_materias (plan_estudio_id, clase_id, semestre, creditos, es_obligatoria, orden)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      plan_estudio_id,
      clase_id,
      semestre,
      creditos || 3,
      es_obligatoria !== undefined ? es_obligatoria : 1,
      orden || 0
    ]);
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Esta materia ya está agregada a este plan de estudio' 
      });
    }
    console.error('Error al agregar materia al plan:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Actualizar relación plan-materia
app.put('/api/plan-materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clase_id, semestre, creditos, es_obligatoria, orden } = req.body;
    
    const [result] = await db.query(`
      UPDATE plan_estudio_materias
      SET clase_id = ?, semestre = ?, creditos = ?, es_obligatoria = ?, orden = ?
      WHERE id = ?
    `, [
      clase_id,
      semestre,
      creditos || 3,
      es_obligatoria !== undefined ? es_obligatoria : 1,
      orden || 0,
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relación plan-materia no encontrada' 
      });
    }
    
    res.json({ success: true, message: 'Materia actualizada correctamente' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Esta materia ya está en este plan de estudio' 
      });
    }
    console.error('Error al actualizar materia del plan:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Eliminar materia de un plan de estudio
app.delete('/api/plan-materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await db.query('DELETE FROM plan_estudio_materias WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relación plan-materia no encontrada' 
      });
    }
    
    res.json({ success: true, message: 'Materia eliminada del plan correctamente' });
  } catch (err) {
    console.error('Error al eliminar materia del plan:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));
