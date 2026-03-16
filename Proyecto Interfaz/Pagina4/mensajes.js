document.addEventListener('DOMContentLoaded',()=>{
  const filtro = document.getElementById('filtroEstado');
  const tbody = document.getElementById('tbodyMensajes');
  const refrescarBtn = document.getElementById('refrescarBtn');

  async function cargar(){
    try{
      const q = filtro.value ? ('?estado='+encodeURIComponent(filtro.value)) : '';
      const resp = await fetch('/api/admin/mensajes'+q);
      const data = await resp.json();
      if (!resp.ok || !data.ok){
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem;">No se pudo cargar</td></tr>`;
        return;
      }
      if (!data.mensajes || data.mensajes.length===0){
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem;">Sin mensajes</td></tr>`;
        return;
      }
      tbody.innerHTML = data.mensajes.map(m=>{
        const badge = m.estado === 'nuevo' ? '<span class="status active">Nuevo</span>' : '<span class="status inactive">Atendido</span>';
        return `<tr>
          <td>${m.id}</td>
          <td>${m.tipo}</td>
          <td>${m.identificacion}</td>
          <td>${m.correo}</td>
          <td>${m.telefono}</td>
          <td>${m.comentario? String(m.comentario).replace(/[<>&]/g,'') : ''}</td>
          <td>${badge}</td>
          <td>${new Date(m.creado_at).toLocaleString()}</td>
          <td>
            ${m.estado==='nuevo' ? `<button class="icon-btn" data-id="${m.id}" data-next="atendido" title="Marcar atendido"><i class="fas fa-check"></i></button>` : `<button class="icon-btn" data-id="${m.id}" data-next="nuevo" title="Marcar nuevo"><i class="fas fa-undo"></i></button>`}
          </td>
        </tr>`
      }).join('');
    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem;">Error</td></tr>`;
    }
  }

  tbody.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button.icon-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const next = btn.getAttribute('data-next');
    try{
      const resp = await fetch('/api/admin/mensajes/'+id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ estado: next }) });
      if (!resp.ok){ alert('No se pudo actualizar'); return; }
      await cargar();
    }catch(err){ alert('Error de red'); }
  });

  filtro.addEventListener('change', cargar);
  if (refrescarBtn) refrescarBtn.addEventListener('click', cargar);

  cargar();
});
