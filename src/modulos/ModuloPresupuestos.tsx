// src/modulos/ModuloPresupuestos.tsx
import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { aplicarRedondeo } from '../estilosTema';

interface PropsPresupuestos {
  user: any;
  tenantId: string;
  esSucursalExterna: boolean;
  sucursalAsociada: any;
  nombreNegocioActivo: string;
  direccionNegocioActivo: string;
  whatsappNegocioActivo: string;
  misProductos: any[];
  misPresupuestos: any[];
  config: any;
  setPestaña: (p: string) => void;
}

export const ModuloPresupuestos: React.FC<PropsPresupuestos> = ({
  user,
  tenantId,
  esSucursalExterna,
  sucursalAsociada,
  nombreNegocioActivo,
  direccionNegocioActivo,
  whatsappNegocioActivo,
  misProductos,
  misPresupuestos,
  config,
  setPestaña
}) => {
  const [presCliente, setPresCliente] = useState('');
  const [presTel, setPresTel] = useState('');
  const [presEquipo, setPresEquipo] = useState('');
  const [presValidez, setPresValidez] = useState('7');
  const [presNotas, setPresNotas] = useState('Incluye mano de obra y garantía escrita.');
  const [itemsPresupuesto, setItemsPresupuesto] = useState<any[]>([]);
  const [itemManualDesc, setItemManualDesc] = useState('');
  const [itemManualPrecio, setItemManualPrecio] = useState('');
  const [busquedaProdPres, setBusquedaProdPres] = useState('');

  const agregarProductoAPresupuesto = (p: any) => {
    const existe = itemsPresupuesto.find(i => i.nombre === p.nombre);
    if (existe) {
      setItemsPresupuesto(itemsPresupuesto.map(i => i.nombre === p.nombre ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setItemsPresupuesto([...itemsPresupuesto, { idProd: p.id, nombre: p.nombre, cantidad: 1, precio: Number(p.precio) }]);
    }
  };

  const agregarItemManualPresupuesto = () => {
    if (!itemManualDesc || !itemManualPrecio) return alert('Completa descripción y precio del servicio/repuesto.');
    setItemsPresupuesto([...itemsPresupuesto, { idProd: null, nombre: itemManualDesc, cantidad: 1, precio: Number(itemManualPrecio) }]);
    setItemManualDesc('');
    setItemManualPrecio('');
  };

  const totalListaPresupuesto = itemsPresupuesto.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const totalEfectivoPresupuesto = aplicarRedondeo(totalListaPresupuesto * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
  const totalTarjetaPresupuesto = aplicarRedondeo(totalListaPresupuesto * (1 + Number(config.recargoTarjetaPorcentaje || 0) / 100), config.redondeoPrecios);

  const guardarPresupuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsPresupuesto.length === 0) return alert('Agrega al menos un artículo o mano de obra al presupuesto.');
    const numPres = Math.random().toString(36).substring(2, 7).toUpperCase();
    await addDoc(collection(db, 'presupuestos'), {
      ownerId: tenantId,
      numero: numPres,
      cliente: presCliente,
      telefono: presTel,
      equipo: presEquipo,
      validezDias: Number(presValidez) || 7,
      notas: presNotas,
      items: itemsPresupuesto,
      totalLista: totalListaPresupuesto,
      totalEfectivo: totalEfectivoPresupuesto,
      totalTarjeta: totalTarjetaPresupuesto,
      estado: 'pendiente',
      fecha: serverTimestamp(),
      fechaTexto: new Date().toLocaleDateString()
    });
    setPresCliente(''); setPresTel(''); setPresEquipo(''); setItemsPresupuesto([]);
    alert(`📄 Presupuesto #${numPres} generado y guardado.`);
  };

  const enviarPresupuestoWhatsApp = (pr: any) => {
    let msg = `Hola *${pr.cliente}*, te enviamos el presupuesto *#${pr.numero}* de *${nombreNegocioActivo}*:\n`;
    if (pr.equipo) msg += `📱 *Equipo / Ref:* ${pr.equipo}\n`;
    msg += `\n📋 *DETALLE DE COTIZACIÓN:*\n`;
    pr.items?.forEach((it: any) => {
      msg += `▪️ ${it.cantidad}x ${it.nombre}: $${(it.precio * it.cantidad).toLocaleString()}\n`;
    });
    msg += `\n💰 *VALORES SEGÚN MEDIO DE PAGO:*\n`;
    msg += `💵 *Efectivo (-${config.descuentoEfectivoPorcentaje}%):* $${pr.totalEfectivo?.toLocaleString()}\n`;
    msg += `🏦 *Precio de Lista (Transf./MP):* $${pr.totalLista?.toLocaleString()}\n`;
    msg += `💳 *Tarjeta (+${config.recargoTarjetaPorcentaje}%):* $${pr.totalTarjeta?.toLocaleString()}\n`;
    msg += `\n⏳ *Validez del presupuesto:* ${pr.validezDias} días.\n📝 ${pr.notas || ''}`;
    window.open(`https://wa.me/549${(pr.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirPresupuestoPDF = (pr: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Presupuesto #${pr.numero} - ${nombreNegocioActivo}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; max-width: 780px; margin: 0 auto; padding: 30px; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #007aff; padding-bottom: 15px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f2f2f7; padding: 10px; text-align: left; border-bottom: 2px solid #ccc; font-size: 13px; }
            td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
            .totales { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 20px; }
            .box-tot { border: 1px solid #ccc; border-radius: 10px; padding: 12px; text-align: center; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0; color:#007aff;">${nombreNegocioActivo}</h1>
              <div style="font-size:13px; color:#555;">📍 ${direccionNegocioActivo} | 📱 WhatsApp: ${whatsappNegocioActivo}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px; font-weight:bold; color:#555;">PRESUPUESTO OFICIAL</div>
              <div style="font-size:24px; font-weight:900;">#${pr.numero}</div>
              <div style="font-size:12px;">Fecha: ${pr.fechaTexto} (Válido por ${pr.validezDias} días)</div>
            </div>
          </div>
          <div style="background:#f8f9fa; padding:12px 16px; border-radius:8px; margin-bottom:15px;">
            <b>Cliente:</b> ${pr.cliente} | <b>Teléfono:</b> ${pr.telefono || '-'} | <b>Equipo / Referencia:</b> ${pr.equipo || 'Varios'}
          </div>
          <table>
            <thead><tr><th>Cant.</th><th>Descripción de Repuesto / Mano de Obra</th><th style="text-align:right;">Unitario (Lista)</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>
              ${pr.items?.map((it: any) => `
                <tr>
                  <td><b>${it.cantidad}</b></td>
                  <td>${it.nombre}</td>
                  <td style="text-align:right;">$${it.precio?.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:bold;">$${(it.precio * it.cantidad).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totales">
            <div class="box-tot" style="border-color:#28cd41; background:#f0fff4;">
              <div style="font-size:11px; font-weight:bold; color:#198754;">PAGO EN EFECTIVO (-${config.descuentoEfectivoPorcentaje}%)</div>
              <div style="font-size:22px; font-weight:900; color:#198754; margin-top:4px;">$${pr.totalEfectivo?.toLocaleString()}</div>
            </div>
            <div class="box-tot" style="border-color:#007aff;">
              <div style="font-size:11px; font-weight:bold; color:#007aff;">PRECIO DE LISTA (TRANSF. / MP)</div>
              <div style="font-size:22px; font-weight:900; color:#007aff; margin-top:4px;">$${pr.totalLista?.toLocaleString()}</div>
            </div>
            <div class="box-tot">
              <div style="font-size:11px; font-weight:bold; color:#666;">TARJETA / CUOTAS (+${config.recargoTarjetaPorcentaje}%)</div>
              <div style="font-size:22px; font-weight:900; color:#333; margin-top:4px;">$${pr.totalTarjeta?.toLocaleString()}</div>
            </div>
          </div>
          <p style="margin-top:25px; font-size:12px; color:#555; border-top:1px dashed #ccc; padding-top:10px;">
            <b>Observaciones:</b> ${pr.notas || 'Precios sujetos a disponibilidad de stock.'}
          </p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    v.document.close();
  };

  const convertirPresupuestoEnOrden = async (pr: any) => {
    if (!window.confirm(`¿Convertir el presupuesto #${pr.numero} de ${pr.cliente} en una Orden de Taller activa?`)) return;
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resumenTrabajos = pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(' + ');
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: tenantId,
      tallerOrigen: esSucursalExterna ? sucursalAsociada.nombre : 'Mostrador Propio',
      cliente: { nombre: pr.cliente, telefono: pr.telefono || '', dni: '' },
      equipo: { marca: pr.equipo || 'Equipo', modelo: '', imei: '', contrasena: '', condicionVisual: 'Según Presupuesto #' + pr.numero, checklist: [] },
      fallaDeclarada: resumenTrabajos,
      tecnicoAsignado: '',
      costoReparacion: pr.totalLista?.toString() || '',
      seña: 0,
      estado: 'ingresado',
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: `Creado desde Presupuesto Aprobado #${pr.numero}` }]
    });
    await updateDoc(doc(db, 'presupuestos', pr.id), { estado: 'aprobado' });
    alert(`✅ Convertido en Orden de Taller #${cod}.`);
    setPestaña('taller');
  };

  return (
    <div>
      <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>📄 Generador de Presupuestos y Cotizaciones // {nombreNegocioActivo}</h2>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
        <div className="neon-card" style={{ flex: '1 1 420px' }}>
          <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>1. Agregar Repuestos o Mano de Obra</h3>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', marginBottom: '16px' }}>
            <label className="label-neon">🛠️ Agregar Mano de Obra / Servicio o Repuesto Manual</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="Ej: Cambio de Módulo + Hidrogel" value={itemManualDesc} onChange={e => setItemManualDesc(e.target.value)} style={{ flex: 2 }} />
              <input type="number" className="neon-input" placeholder="Precio Lista $" value={itemManualPrecio} onChange={e => setItemManualPrecio(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={agregarItemManualPresupuesto} className="neon-btn neon-btn-fillCyan">+ Añadir</button>
            </div>
          </div>

          <label className="label-neon">📦 O Seleccionar Artículo desde Mi Stock (Propios y Proveedores)</label>
          <input type="text" className="neon-input" placeholder="🔍 Buscar artículo en mi inventario..." value={busquedaProdPres} onChange={e => setBusquedaProdPres(e.target.value)} style={{ marginBottom: '10px' }} />
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            <table className="neon-table">
              <thead><tr><th>Artículo</th><th>Precio Lista</th><th>Sumar</th></tr></thead>
              <tbody>
                {misProductos.filter(p => p.nombre.toLowerCase().includes(busquedaProdPres.toLowerCase())).slice(0, 12).map(p => (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b> <small style={{ color: 'var(--text-muted)' }}>(Stock: {p.stock})</small></td>
                    <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                    <td><button type="button" onClick={() => agregarProductoAPresupuesto(p)} className="neon-btn">+ Cotizar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={guardarPresupuesto} className="neon-card neon-card-green" style={{ flex: '1 1 420px' }}>
          <h3 className="glow-text-green" style={{ marginTop: 0 }}>2. Datos del Cliente y Totales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div><label className="label-neon">Nombre del Cliente</label><input type="text" className="neon-input" required value={presCliente} onChange={e => setPresCliente(e.target.value)} placeholder="Ej: Juan Pérez" /></div>
            <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={presTel} onChange={e => setPresTel(e.target.value)} placeholder="2262..." /></div>
            <div><label className="label-neon">Equipo / Modelo</label><input type="text" className="neon-input" value={presEquipo} onChange={e => setPresEquipo(e.target.value)} placeholder="Ej: Moto G84 5G" /></div>
            <div><label className="label-neon">Validez (Días)</label><input type="number" className="neon-input" value={presValidez} onChange={e => setPresValidez(e.target.value)} /></div>
          </div>

          <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid rgba(128,128,128,0.15)' }}>
            {itemsPresupuesto.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                <div><b>{it.cantidad}x</b> {it.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <b className="glow-text-cyan">${(it.precio * it.cantidad).toLocaleString()}</b>
                  <button type="button" onClick={() => setItemsPresupuesto(itemsPresupuesto.filter((_, i) => i !== idx))} className="neon-btn neon-btn-red" style={{ padding: '3px 8px' }}>✕</button>
                </div>
              </div>
            ))}
            {itemsPresupuesto.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aún no agregaste ítems al presupuesto.</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '12px', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💵 EFECTIVO (-{config.descuentoEfectivoPorcentaje}%)</span>
              <b className="glow-text-green" style={{ fontSize: '18px' }}>${totalEfectivoPresupuesto.toLocaleString()}</b>
            </div>
            <div style={{ borderLeft: '1px solid rgba(128,128,128,0.2)', borderRight: '1px solid rgba(128,128,128,0.2)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>📋 PRECIO DE LISTA</span>
              <b className="glow-text-cyan" style={{ fontSize: '18px' }}>${totalListaPresupuesto.toLocaleString()}</b>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💳 TARJETA (+{config.recargoTarjetaPorcentaje}%)</span>
              <b className="glow-text-pink" style={{ fontSize: '18px' }}>${totalTarjetaPresupuesto.toLocaleString()}</b>
            </div>
          </div>

          <input type="text" className="neon-input" value={presNotas} onChange={e => setPresNotas(e.target.value)} placeholder="Notas al pie..." style={{ marginBottom: '12px' }} />

          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
            💾 Guardar Presupuesto Oficial
          </button>
        </form>
      </div>

      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>📋 Historial de Presupuestos Emitidos</h3>
        <table className="neon-table">
          <thead>
            <tr>
              <th>N° / Fecha</th>
              <th>Cliente & Equipo</th>
              <th>Detalle Cotizado</th>
              <th>Efectivo</th>
              <th>Precio Lista</th>
              <th>Tarjeta</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {misPresupuestos.map(pr => (
              <tr key={pr.id}>
                <td><b className="glow-text-cyan">#{pr.numero}</b><br /><small style={{ color: 'var(--text-muted)' }}>{pr.fechaTexto}</small></td>
                <td><b>{pr.cliente}</b><br /><small style={{ color: 'var(--text-muted)' }}>{pr.equipo || '-'} | 📱 {pr.telefono}</small></td>
                <td style={{ fontSize: '13px' }}>{pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', ')}</td>
                <td className="glow-text-green" style={{ fontWeight: 'bold' }}>${pr.totalEfectivo?.toLocaleString()}</td>
                <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${pr.totalLista?.toLocaleString()}</td>
                <td className="glow-text-pink" style={{ fontWeight: 'bold' }}>${pr.totalTarjeta?.toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => enviarPresupuestoWhatsApp(pr)} className="neon-btn neon-btn-green">💬 WhatsApp</button>
                    <button onClick={() => imprimirPresupuestoPDF(pr)} className="neon-btn">🖨️ PDF</button>
                    <button onClick={() => convertirPresupuestoEnOrden(pr)} className="neon-btn neon-btn-purple">🛠️ Hacer Orden</button>
                    <button onClick={() => deleteDoc(doc(db, 'presupuestos', pr.id))} className="neon-btn neon-btn-red">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {misPresupuestos.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay presupuestos guardados todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};