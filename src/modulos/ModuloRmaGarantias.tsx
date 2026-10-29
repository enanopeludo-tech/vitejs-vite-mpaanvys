// src/modulos/ModuloRmaGarantias.tsx
import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface PropsRma {
  user: any;
  tenantId: string;
  esSucursalExterna: boolean;
  sucursalAsociada?: any;
  nombreNegocioActivo: string;
  direccionNegocioActivo: string;
  whatsappNegocioActivo: string;
  misOrdenesTaller: any[];
  misProductos: any[];
  rmas: any[];
  config: any;
  setPestaña: (p: string) => void;
}

export const ModuloRmaGarantias: React.FC<PropsRma> = ({
  user,
  tenantId,
  esSucursalExterna,
  nombreNegocioActivo,
  direccionNegocioActivo,
  whatsappNegocioActivo,
  misOrdenesTaller,
  misProductos,
  rmas,
  config,
  setPestaña
}) => {
  // Pestañas internas del módulo RMA
  const [vistaRma, setVistaRma] = useState<'verificador' | 'proveedores' | 'clientes'>('verificador');

  // Buscador de órdenes para verificar vigencia de garantía
  const [busquedaOrdenGarantia, setBusquedaOrdenGarantia] = useState('');

  // Estados Formulario RMA (Edición y Alta)
  const [idRmaEditando, setIdRmaEditando] = useState<string | null>(null);
  const [rmaTipo, setRmaTipo] = useState<'proveedor' | 'cliente'>('proveedor');
  const [rmaProducto, setRmaProducto] = useState('');
  const [rmaEntidad, setRmaEntidad] = useState('');
  const [rmaTelefonoEntidad, setRmaTelefonoEntidad] = useState('');
  const [rmaOrdenVinculada, setRmaOrdenVinculada] = useState('');
  const [rmaMotivo, setRmaMotivo] = useState('');
  const [rmaCondicionFisica, setRmaCondicionFisica] = useState('Sello y film intactos, sin rotura ni sulfato');
  const [rmaComisionista, setRmaComisionista] = useState('');
  const [rmaMoneda, setRmaMoneda] = useState<'ARS' | 'USD'>('USD');
  const [rmaMonto, setRmaMonto] = useState('');
  const [rmaCostoFleteIdaVuelta, setRmaCostoFleteIdaVuelta] = useState('0');
  const [filtroEstadoRma, setFiltroEstadoRma] = useState('todos');

  const diasGarantiaOficial = Number(config.garantiaDiasDefault || 30);
  const dolarHoy = Number(config.cotizacionDolar || 1200);

  const opcionesComisionistas = (config.comisionistasLista || "Comisionista Mar del Plata:4500, Comisionista CABA:7500, Sin Flete:0")
    .split(',')
    .map((item: string) => {
      const partes = item.split(':');
      return { nombre: partes[0]?.trim() || 'Comisionista', costo: Number(partes[1]) || 0 };
    });

  // Filtrar RMAs propios del local activo
  const misRmas = rmas.filter(r => !esSucursalExterna || r.ownerId === tenantId);
  const rmasProveedores = misRmas.filter(r => r.tipo === 'proveedor');
  const rmasClientes = misRmas.filter(r => r.tipo === 'cliente');

  // KPIs Financieros de RMA
  const capitalEnReclamoArs = rmasProveedores
    .filter(r => r.estado === 'pendiente' || r.estado === 'enviado_comisionista')
    .reduce((acc, r) => acc + Number(r.montoArs || r.monto || 0), 0);

  const capitalRecuperadoArs = rmasProveedores
    .filter(r => r.estado === 'nota_credito' || r.estado === 'reemplazado')
    .reduce((acc, r) => acc + Number(r.montoArs || r.monto || 0), 0);

  const perdidaPorRechazosArs = misRmas
    .filter(r => r.estado === 'rechazado_perdida')
    .reduce((acc, r) => acc + Number(r.montoArs || r.monto || 0) + Number(r.fletePerdido || 0), 0);

  // Calcular días transcurridos de una orden de taller
  const calcularDiasDesdeIngreso = (orden: any) => {
    if (!orden.fechaIngreso?.seconds) return 0;
    const fechaOrd = new Date(orden.fechaIngreso.seconds * 1000);
    const hoy = new Date();
    const diffMs = hoy.getTime() - fechaOrd.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // --- ACCIÓN 1: GENERAR REINGRESO POR GARANTÍA DESDE UNA ORDEN EXISTENTE ---
  const abrirReingresoEnTaller = async (ordenOriginal: any, diasTranscurridos: number) => {
    const fallaGarantia = prompt(
      `🔄 REINGRESO POR GARANTÍA — Orden Original #${ordenOriginal.codigoSeguimiento}\n` +
      `Días transcurridos: ${diasTranscurridos} de ${diasGarantiaOficial} días.\n\n` +
      `Describe la falla que presenta el equipo o repuesto:`,
      `Garantía de: ${ordenOriginal.fallaDeclarada}`
    );
    if (!fallaGarantia) return;

    const condicionIngreso = prompt(
      `¿En qué estado físico ingresa el módulo/equipo? (Verificar que no esté astillado, golpeado ni mojado):`,
      `Sin golpes ni humedad visible - Sujeto a revisión en banco`
    ) || 'Sujeto a revisión';

    await addDoc(collection(db, 'rmas_garantias'), {
      ownerId: tenantId,
      origenNombre: nombreNegocioActivo,
      tipo: 'cliente',
      producto: `${ordenOriginal.equipo?.marca || ''} ${ordenOriginal.equipo?.modelo || ''}`,
      entidad: ordenOriginal.cliente?.nombre || 'Cliente',
      telefonoEntidad: ordenOriginal.cliente?.telefono || '',
      ordenVinculada: ordenOriginal.codigoSeguimiento,
      motivo: fallaGarantia,
      condicionFisica: condicionIngreso,
      moneda: 'ARS',
      monto: Number(ordenOriginal.costoReparacion || 0),
      montoArs: Number(ordenOriginal.costoReparacion || 0),
      estado: 'en_revision_taller',
      fecha: new Date().toLocaleDateString(),
      fechaTimestamp: serverTimestamp()
    });

    await updateDoc(doc(db, 'ordenes_taller', ordenOriginal.id), {
      estado: 'reingreso garantia',
      historial: [
        ...(ordenOriginal.historial || []),
        {
          estado: 'reingreso garantia',
          fecha: new Date().toLocaleString(),
          comentario: `🔄 REINGRESO GARANTÍA (Día ${diasTranscurridos}): ${fallaGarantia} | Estética: ${condicionIngreso}`
        }
      ]
    });

    if (window.confirm(`✅ La Orden #${ordenOriginal.codigoSeguimiento} pasó a "🔄 Garantía" en tu Taller.\n\n¿Deseas cargar también el reclamo de este repuesto (RMA) a tu Proveedor para enviarlo con el comisionista?`)) {
      setVistaRma('proveedores');
      setRmaTipo('proveedor');
      setRmaProducto(`Repuesto de ${ordenOriginal.equipo?.marca} ${ordenOriginal.equipo?.modelo}`);
      setRmaOrdenVinculada(ordenOriginal.codigoSeguimiento);
      setRmaMotivo(fallaGarantia);
      setRmaMoneda('USD');
      setRmaMonto(ordenOriginal.costoRepuestoUsd ? String(ordenOriginal.costoRepuestoUsd) : '');
    } else {
      setPestaña('taller');
    }
  };

  // --- ACCIÓN 2: GUARDAR O EDITAR RMA (PROVEEDOR O CLIENTE) ---
  const guardarRma = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = Number(rmaMonto) || 0;
    const montoConvertidoArs = rmaMoneda === 'USD' ? Math.round(montoNum * dolarHoy) : montoNum;

    const payloadRma = {
      ownerId: tenantId,
      origenNombre: nombreNegocioActivo,
      tipo: rmaTipo,
      producto: rmaProducto,
      entidad: rmaEntidad,
      telefonoEntidad: rmaTelefonoEntidad,
      ordenVinculada: rmaOrdenVinculada.toUpperCase(),
      motivo: rmaMotivo,
      condicionFisica: rmaCondicionFisica,
      comisionista: rmaComisionista,
      moneda: rmaMoneda,
      montoOrigen: montoNum,
      monto: montoConvertidoArs,
      montoArs: montoConvertidoArs,
      fletePerdido: Number(rmaCostoFleteIdaVuelta) || 0
    };

    if (idRmaEditando) {
      await updateDoc(doc(db, 'rmas_garantias', idRmaEditando), payloadRma);
      alert('✅ Registro de RMA actualizado.');
      limpiarFormularioRma();
      return;
    }

    await addDoc(collection(db, 'rmas_garantias'), {
      ...payloadRma,
      estado: rmaTipo === 'proveedor' ? 'pendiente' : 'en_revision_taller',
      fecha: new Date().toLocaleDateString(),
      fechaTimestamp: serverTimestamp()
    });

    limpiarFormularioRma();
    alert('🔄 Caso de RMA / Garantía registrado correctamente.');
  };

  const limpiarFormularioRma = () => {
    setIdRmaEditando(null);
    setRmaProducto('');
    setRmaEntidad('');
    setRmaTelefonoEntidad('');
    setRmaOrdenVinculada('');
    setRmaMotivo('');
    setRmaCondicionFisica('Sello y film intactos, sin rotura ni sulfato');
    setRmaComisionista('');
    setRmaMonto('');
    setRmaCostoFleteIdaVuelta('0');
  };

  const cargarRmaParaEditar = (r: any) => {
    setIdRmaEditando(r.id);
    setRmaTipo(r.tipo || 'proveedor');
    setVistaRma(r.tipo === 'cliente' ? 'clientes' : 'proveedores');
    setRmaProducto(r.producto || '');
    setRmaEntidad(r.entidad || '');
    setRmaTelefonoEntidad(r.telefonoEntidad || '');
    setRmaOrdenVinculada(r.ordenVinculada || '');
    setRmaMotivo(r.motivo || '');
    setRmaCondicionFisica(r.condicionFisica || '');
    setRmaComisionista(r.comisionista || '');
    setRmaMoneda(r.moneda || 'ARS');
    setRmaMonto(r.montoOrigen !== undefined ? String(r.montoOrigen) : String(r.monto || ''));
    setRmaCostoFleteIdaVuelta(String(r.fletePerdido || 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- ACCIÓN 3: CAMBIAR ESTADO DEL RMA CON IMPACTO EN STOCK O FINANZAS ---
  const cambiarEstadoRma = async (rma: any, nuevoEstado: string) => {
    if (nuevoEstado === 'reemplazado') {
      const prodCoincidente = misProductos.find(p => p.nombre.toLowerCase().includes(rma.producto.toLowerCase()));
      if (prodCoincidente && window.confirm(`🔄 El proveedor repuso "${rma.producto}".\n¿Deseas sumar +1 unidad al stock de "${prodCoincidente.nombre}"?`)) {
        await updateDoc(doc(db, 'productos', prodCoincidente.id), {
          stock: Number(prodCoincidente.stock || 0) + 1
        });
      }
    }

    if (nuevoEstado === 'nota_credito') {
      const montoRecupero = Number(rma.montoArs || rma.monto || 0);
      if (montoRecupero > 0 && window.confirm(`💵 El proveedor aprobó Nota de Crédito / Devolución por $${montoRecupero.toLocaleString()}.\n¿Registrar este saldo a favor / ingreso en Finanzas?`)) {
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'ingreso',
          concepto: `Recupero RMA Proveedor (${rma.entidad}) - ${rma.producto}`,
          monto: montoRecupero,
          metodoPago: 'transferencia',
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }

    if (nuevoEstado === 'rechazado_perdida') {
      const totalPerdida = Number(rma.montoArs || rma.monto || 0) + Number(rma.fletePerdido || 0);
      if (totalPerdida > 0 && window.confirm(`❌ RMA Rechazado / Pérdida por $${totalPerdida.toLocaleString()} (Repuesto + Flete).\n¿Deseas asentar este egreso por pérdida en Caja/Finanzas para descontarlo de tu ganancia neta?`)) {
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'egreso',
          concepto: `Pérdida por Garantía / RMA (${rma.producto} - ${rma.entidad})`,
          monto: totalPerdida,
          metodoPago: 'efectivo',
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }

    await updateDoc(doc(db, 'rmas_garantias', rma.id), {
      estado: nuevoEstado,
      fechaResolucion: new Date().toLocaleDateString()
    });
  };

  // --- ACCIÓN 4: IMPRIMIR REMITO DE DEVOLUCIÓN PARA EL COMISIONISTA / PROVEEDOR ---
  const imprimirRemitoDevolucionRma = (r: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Remito RMA - ${r.producto}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; max-width: 680px; margin: 0 auto; padding: 25px; }
            .box-rma { border: 3px solid #111; border-radius: 10px; padding: 20px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 15px; }
            .badge { background: #111; color: #fff; padding: 5px 12px; font-weight: bold; border-radius: 6px; font-size: 13px; }
            .row { margin: 8px 0; font-size: 14px; }
            .falla-box { background: #f8f9fa; border: 1px dashed #333; padding: 12px; border-radius: 8px; margin: 14px 0; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align:right; margin-bottom:12px;">
            <button onclick="window.print()" style="background:#007aff; color:#fff; border:none; padding:10px 20px; border-radius:999px; font-weight:bold; cursor:pointer;">🖨️ Imprimir Etiqueta / Remito para Comisionista</button>
          </div>
          <div class="box-rma">
            <div class="header">
              <div>
                <h2 style="margin:0;">${nombreNegocioActivo}</h2>
                <div style="font-size:12px;">📍 ${direccionNegocioActivo} | 📱 WhatsApp: ${whatsappNegocioActivo}</div>
              </div>
              <div style="text-align:right;">
                <span class="badge">REMITO DEVOLUCIÓN RMA</span>
                <div style="font-size:12px; margin-top:6px;">Fecha: ${r.fecha}</div>
              </div>
            </div>
            <div class="row"><b>DESTINO (PROVEEDOR):</b> <span style="font-size:17px;">${r.entidad}</span></div>
            <div class="row"><b>TRANSPORTE / COMISIONISTA:</b> ${r.comisionista || 'En mano / Comisionista'}</div>
            <div class="row"><b>REPUESTO / ARTÍCULO DEVUELTO:</b> <b>${r.producto}</b></div>
            ${r.ordenVinculada ? `<div class="row"><b>ORDEN INTERNA REF:</b> #${r.ordenVinculada}</div>` : ''}
            <div class="falla-box">
              <div><b>DETALLE TÉCNICO DE LA FALLA:</b> ${r.motivo}</div>
              <div style="margin-top:6px;"><b>ESTADO FÍSICO / SELLOS:</b> ${r.condicionFisica || 'Sello intacto, sin daño físico'}</div>
            </div>
            <div class="row"><b>VALOR DECLARADO:</b> ${r.moneda === 'USD' ? `USD ${r.montoOrigen} ($${Number(r.montoArs || r.monto).toLocaleString()})` : `$${Number(r.monto || 0).toLocaleString()}`}</div>
            <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:12px;">
              <div style="border-top:1px solid #000; width:42%; text-align:center; padding-top:4px;">Firma Remitente (${nombreNegocioActivo})</div>
              <div style="border-top:1px solid #000; width:42%; text-align:center; padding-top:4px;">Recibió Comisionista / Proveedor</div>
            </div>
          </div>
        </body>
      </html>
    `);
    v.document.close();
  };

  const contactarWhatsAppRma = (r: any) => {
    const tel = (r.telefonoEntidad || '').replace(/\D/g, '');
    let msg = '';
    if (r.tipo === 'proveedor') {
      msg = `Hola *${r.entidad}*, te escribo de *${nombreNegocioActivo}* por un reclamo de RMA / Garantía:\n`;
      msg += `📦 *Repuesto:* ${r.producto}\n`;
      msg += `⚠️ *Falla detectada:* ${r.motivo}\n`;
      msg += `🛡️ *Estado:* ${r.condicionFisica || 'Sellos intactos'}\n`;
      if (r.comisionista) msg += `🚚 *Envío con:* ${r.comisionista}\n`;
      msg += `Quedo atento para coordinar el cambio o nota de crédito. ¡Gracias!`;
    } else {
      msg = `Hola *${r.entidad}*, te escribimos de *${nombreNegocioActivo}* sobre la revisión en garantía de tu *${r.producto}* ${r.ordenVinculada ? `(Orden #${r.ordenVinculada})` : ''}:\n`;
      msg += `📌 *Estado actual:* ${r.estado.replace(/_/g, ' ').toUpperCase()}\n`;
      msg += `📝 *Detalle:* ${r.motivo}`;
    }
    window.open(`https://wa.me/${tel ? '549' + tel : ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ordenesParaVerificar = misOrdenesTaller.filter(o => {
    if (!busquedaOrdenGarantia) return o.estado === 'entregado' || o.estado === 'reparado' || o.estado === 'reingreso garantia';
    const b = busquedaOrdenGarantia.toLowerCase();
    return o.codigoSeguimiento?.toLowerCase().includes(b) ||
           o.cliente?.nombre?.toLowerCase().includes(b) ||
           o.equipo?.marca?.toLowerCase().includes(b) ||
           o.equipo?.modelo?.toLowerCase().includes(b);
  });

  const listaTablaActiva = (vistaRma === 'clientes' ? rmasClientes : rmasProveedores).filter(r => {
    if (filtroEstadoRma !== 'todos' && r.estado !== filtroEstadoRma) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div className="neon-card neon-card-yellow">
          <span className="label-neon">⏳ Capital en Reclamo a Proveedores</span>
          <h2 className="glow-text-yellow" style={{ margin: '4px 0' }}>${capitalEnReclamoArs.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            {rmasProveedores.filter(r => r.estado === 'pendiente' || r.estado === 'enviado_comisionista').length} repuestos pendientes de cambio/NC
          </small>
        </div>
        <div className="neon-card neon-card-green">
          <span className="label-neon">✅ Capital Recuperado (Cambios / NC)</span>
          <h2 className="glow-text-green" style={{ margin: '4px 0' }}>${capitalRecuperadoArs.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Reconocidos por proveedores</small>
        </div>
        <div className="neon-card neon-card-pink">
          <span className="label-neon">❌ Pérdidas por Garantías / Fletes</span>
          <h2 className="glow-text-red" style={{ margin: '4px 0' }}>${perdidaPorRechazosArs.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Rechazados o absorbidos por el taller</small>
        </div>
      </div>

      <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          type="button" 
          onClick={() => setVistaRma('verificador')} 
          className={`neon-btn ${vistaRma === 'verificador' ? 'neon-btn-fillCyan' : ''}`}
          style={{ flex: 1 }}
        >
          🔍 1. Verificar Garantía de Orden y Reingresar al Taller
        </button>
        <button 
          type="button" 
          onClick={() => { setVistaRma('proveedores'); setRmaTipo('proveedor'); }} 
          className={`neon-btn ${vistaRma === 'proveedores' ? 'neon-btn-fillCyan' : ''}`}
          style={{ flex: 1 }}
        >
          📦 2. RMAs a Proveedores y Comisionistas ({rmasProveedores.length})
        </button>
        <button 
          type="button" 
          onClick={() => { setVistaRma('clientes'); setRmaTipo('cliente'); }} 
          className={`neon-btn ${vistaRma === 'clientes' ? 'neon-btn-fillCyan' : ''}`}
          style={{ flex: 1 }}
        >
          🛠️ 3. Historial Reclamos de Clientes ({rmasClientes.length})
        </button>
      </div>

      {vistaRma === 'verificador' && (
        <div className="neon-card">
          <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
            🔍 Verificador de Garantía por Orden (Plazo Oficial: {diasGarantiaOficial} días)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px' }}>
            Busca por código de orden, nombre del cliente o modelo para comprobar al instante si sigue dentro de los {diasGarantiaOficial} días de garantía y abrir el reingreso en el Taller.
          </p>
          <input 
            type="text" 
            className="neon-input" 
            placeholder="🔍 Escribe código de orden (#X9B2V), nombre del cliente o modelo (Ej: A52)..." 
            value={busquedaOrdenGarantia} 
            onChange={e => setBusquedaOrdenGarantia(e.target.value)} 
            style={{ marginBottom: '15px' }} 
          />

          <div style={{ overflowX: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Orden / Local</th>
                  <th>Cliente</th>
                  <th>Equipo & Trabajo Original</th>
                  <th>Días Transcurridos</th>
                  <th>Estado de Garantía</th>
                  <th>Acción Rápida</th>
                </tr>
              </thead>
              <tbody>
                {ordenesParaVerificar.slice(0, 15).map(o => {
                  const dias = calcularDiasDesdeIngreso(o);
                  const enGarantia = dias <= diasGarantiaOficial;
                  const fechaTexto = o.fechaIngreso?.seconds ? new Date(o.fechaIngreso.seconds * 1000).toLocaleDateString() : '-';
                  return (
                    <tr key={o.id}>
                      <td>
                        <b className="glow-text-cyan">#{o.codigoSeguimiento}</b><br />
                        <small style={{ color: 'var(--text-muted)' }}>{o.tallerOrigen || 'Central'}</small>
                      </td>
                      <td>
                        <b>{o.cliente?.nombre}</b><br />
                        <small className="glow-text-green">📱 {o.cliente?.telefono}</small>
                      </td>
                      <td>
                        <b>{o.equipo?.marca} {o.equipo?.modelo}</b><br />
                        <small style={{ color: 'var(--text-muted)' }}>Trabajo: {o.fallaDeclarada} (${o.costoReparacion || 0})</small>
                      </td>
                      <td>
                        <b>{dias} días</b><br />
                        <small style={{ color: 'var(--text-muted)' }}>Ingreso: {fechaTexto}</small>
                      </td>
                      <td>
                        <span 
                          className="neon-badge" 
                          style={{ 
                            background: enGarantia ? 'rgba(40,205,65,0.16)' : 'rgba(255,59,48,0.16)', 
                            color: enGarantia ? 'var(--neon-green)' : 'var(--neon-red)' 
                          }}
                        >
                          {enGarantia ? `🟢 EN GARANTÍA (Restan ${diasGarantiaOficial - dias} d.)` : `🔴 VENCIDA (+${dias - diasGarantiaOficial} días)`}
                        </span>
                      </td>
                      <td>
                        <button 
                          type="button" 
                          onClick={() => abrirReingresoEnTaller(o, dias)} 
                          className={`neon-btn ${enGarantia ? 'neon-btn-fillCyan' : 'neon-btn-red'}`}
                        >
                          🔄 Generar Reingreso Taller
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vistaRma !== 'verificador' && (
        <div>
          <form onSubmit={guardarRma} className="neon-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="glow-text-cyan" style={{ margin: 0 }}>
                {idRmaEditando 
                  ? '✏️ Editando Registro de RMA' 
                  : rmaTipo === 'proveedor' 
                    ? '📦 Registrar Devolución RMA a Proveedor (Módulo / Repuesto Fallado)' 
                    : '🛠️ Registrar Reclamo de Garantía de Cliente'}
              </h3>
              {idRmaEditando && (
                <button type="button" onClick={limpiarFormularioRma} className="neon-btn neon-btn-red">
                  Cancelar Edición
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label className="label-neon">Tipo de RMA</label>
                <select className="neon-select" value={rmaTipo} onChange={e => setRmaTipo(e.target.value as any)}>
                  <option value="proveedor">📦 Reclamo a Proveedor (Devolución Repuesto)</option>
                  <option value="cliente">🛠️ Garantía a Cliente / Local Gremio</option>
                </select>
              </div>
              <div>
                <label className="label-neon">Repuesto / Equipo Afectado *</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  required 
                  placeholder="Ej: Módulo Moto G84 OLED Original" 
                  value={rmaProducto} 
                  onChange={e => setRmaProducto(e.target.value)} 
                />
              </div>
              <div>
                <label className="label-neon">{rmaTipo === 'proveedor' ? 'Nombre del Proveedor *' : 'Nombre del Cliente *'}</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  required 
                  placeholder={rmaTipo === 'proveedor' ? "Ej: Mayorista BsAs / MDP" : "Ej: Juan Pérez"} 
                  value={rmaEntidad} 
                  onChange={e => setRmaEntidad(e.target.value)} 
                />
              </div>
              <div>
                <label className="label-neon">WhatsApp Proveedor / Cliente</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  placeholder="Ej: 223... o 11..." 
                  value={rmaTelefonoEntidad} 
                  onChange={e => setRmaTelefonoEntidad(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="label-neon">Falla Detectada *</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  required 
                  placeholder="Ej: Táctil se tilda / Líneas en imagen" 
                  value={rmaMotivo} 
                  onChange={e => setRmaMotivo(e.target.value)} 
                />
              </div>
              <div>
                <label className="label-neon">Estado de Sellos / Flex / Estética</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  placeholder="Sello intacto, sin pegar, flex sano" 
                  value={rmaCondicionFisica} 
                  onChange={e => setRmaCondicionFisica(e.target.value)} 
                />
              </div>
              {rmaTipo === 'proveedor' && (
                <div>
                  <label className="label-neon">Comisionista que lleva el RMA</label>
                  <select className="neon-select" value={rmaComisionista} onChange={e => setRmaComisionista(e.target.value)}>
                    <option value="">Seleccionar Comisionista...</option>
                    {opcionesComisionistas.map((c: any, idx: number) => (
                      <option key={idx} value={c.nombre}>{c.nombre} (${c.costo})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label-neon">Orden Taller Vinculada (Opcional)</label>
                <input 
                  type="text" 
                  className="neon-input" 
                  placeholder="Ej: X9B2V" 
                  value={rmaOrdenVinculada} 
                  onChange={e => setRmaOrdenVinculada(e.target.value)} 
                />
              </div>
              <div>
                <label className="label-neon">Moneda y Costo del Repuesto</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select className="neon-select" value={rmaMoneda} onChange={e => setRmaMoneda(e.target.value as any)} style={{ width: '90px' }}>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS $</option>
                  </select>
                  <input 
                    type="number" 
                    step="0.5"
                    className="neon-input" 
                    placeholder={rmaMoneda === 'USD' ? "Costo USD" : "Costo $"} 
                    value={rmaMonto} 
                    onChange={e => setRmaMonto(e.target.value)} 
                  />
                </div>
              </div>
              <div>
                <label className="label-neon">Costo Flete Envío RMA ($)</label>
                <input 
                  type="number" 
                  className="neon-input" 
                  value={rmaCostoFleteIdaVuelta} 
                  onChange={e => setRmaCostoFleteIdaVuelta(e.target.value)} 
                  placeholder="Flete $" 
                />
              </div>
            </div>

            <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
              {idRmaEditando ? '💾 Guardar Cambios del RMA' : '➕ Registrar RMA y Generar Seguimiento'}
            </button>
          </form>

          <div className="neon-card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 className="glow-text-cyan" style={{ margin: 0 }}>
                {vistaRma === 'proveedores' ? '📦 Listado de Repuestos en Reclamo a Proveedores' : '🛠️ Listado de Garantías de Clientes'}
              </h3>
              <select className="neon-select" value={filtroEstadoRma} onChange={e => setFiltroEstadoRma(e.target.value)} style={{ width: 'auto' }}>
                <option value="todos">Todos los Estados</option>
                <option value="pendiente">⏳ Pendiente de Envío</option>
                <option value="enviado_comisionista">🚚 Enviado con Comisionista</option>
                <option value="en_revision_taller">🔬 En Revisión</option>
                <option value="reemplazado">🔄 Reemplazado (+1 Stock)</option>
                <option value="nota_credito">💵 Nota de Crédito / Reintegro</option>
                <option value="rechazado_perdida">❌ Rechazado / Pérdida</option>
              </select>
            </div>

            <table className="neon-table">
              <thead>
                <tr>
                  <th>Fecha / Ref</th>
                  <th>Repuesto / Equipo</th>
                  <th>{vistaRma === 'proveedores' ? 'Proveedor & Comisionista' : 'Cliente'}</th>
                  <th>Falla & Condición</th>
                  <th>Valor en Juego</th>
                  <th>Estado / Resolución</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaTablaActiva.map(r => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.fecha}</b><br />
                      {r.ordenVinculada && (
                        <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.15)', color: 'var(--neon-cyan)' }}>
                          Orden #{r.ordenVinculada}
                        </span>
                      )}
                    </td>
                    <td><b>{r.producto}</b></td>
                    <td>
                      <b>{r.entidad}</b><br />
                      {r.comisionista && <small className="glow-text-pink">🚚 {r.comisionista}</small>}
                    </td>
                    <td>
                      <span className="glow-text-red">{r.motivo}</span><br />
                      <small style={{ color: 'var(--text-muted)' }}>🛡️ {r.condicionFisica || 'Sin observaciones'}</small>
                    </td>
                    <td>
                      {r.moneda === 'USD' ? (
                        <div>
                          <b className="glow-text-yellow">USD {r.montoOrigen}</b><br />
                          <small style={{ color: 'var(--text-muted)' }}>${Number(r.montoArs || r.monto || 0).toLocaleString()}</small>
                        </div>
                      ) : (
                        <b>${Number(r.monto || 0).toLocaleString()}</b>
                      )}
                    </td>
                    <td>
                      <select 
                        className="neon-select" 
                        value={r.estado} 
                        onChange={e => cambiarEstadoRma(r, e.target.value)}
                        style={{ padding: '7px' }}
                      >
                        <option value="pendiente">⏳ Pendiente en Local</option>
                        <option value="enviado_comisionista">🚚 Viajando con Comisionista</option>
                        <option value="en_revision_taller">🔬 En Revisión Técnica</option>
                        <option value="reemplazado">🔄 Reemplazo Recibido (+Stock)</option>
                        <option value="nota_credito">💵 Nota de Crédito Aprobada</option>
                        <option value="rechazado_perdida">❌ Rechazado (Asentar Pérdida)</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => cargarRmaParaEditar(r)} className="neon-btn" title="Editar RMA">✏️</button>
                        <button onClick={() => imprimirRemitoDevolucionRma(r)} className="neon-btn" title="Imprimir Etiqueta / Remito para el Comisionista">🖨️</button>
                        <button onClick={() => contactarWhatsAppRma(r)} className="neon-btn neon-btn-green" title="Reclamar o Avisar por WhatsApp">💬</button>
                        <button onClick={() => { if (window.confirm('¿Eliminar registro RMA?')) deleteDoc(doc(db, 'rmas_garantias', r.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {listaTablaActiva.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay registros cargados en esta pestaña.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};