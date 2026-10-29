// src/modulos/ModuloPedidosWeb.tsx
import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { imprimirFacturaARCA } from '../estilosTema';

interface PropsPedidosWeb {
  user: any;
  tenantId: string;
  nombreNegocioActivo: string;
  direccionNegocioActivo: string;
  whatsappNegocioActivo: string;
  datosFiscalesActivos: any;
  misPedidosWeb: any[];
  misProductos: any[];
  misFinanzas: any[];
  config: any;
}

export const ModuloPedidosWeb: React.FC<PropsPedidosWeb> = ({
  user,
  tenantId,
  nombreNegocioActivo,
  direccionNegocioActivo,
  whatsappNegocioActivo,
  datosFiscalesActivos,
  misPedidosWeb,
  misProductos,
  misFinanzas,
  config
}) => {
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('todos');
  const [busquedaPedido, setBusquedaPedido] = useState('');

  // --- ACCIÓN 1: COBRAR PEDIDO WEB, DESCONTAR STOCK LOCAL Y REGISTRAR EN CAJA ---
  const procesarCobroYDescuentoStock = async (pedido: any) => {
    if (pedido.cobradoEnCaja) {
      return alert('Este pedido ya fue cobrado y descontado del stock anteriormente.');
    }

    const metodo = prompt(
      `💰 COBRAR PEDIDO WEB #${pedido.id.slice(-6).toUpperCase()} ($${Number(pedido.total || 0).toLocaleString()})\n` +
      `Ingresa el medio de pago confirmado (transferencia, mercadopago, efectivo, tarjeta):`,
      pedido.metodoPago || 'transferencia'
    );
    if (!metodo) return;

    // 1. Descontar cada artículo comprado del Stock del Local
    if (Array.isArray(pedido.items)) {
      for (const item of pedido.items) {
        const prodEnBd = misProductos.find(p => p.id === item.id || p.nombre.toLowerCase() === (item.nombre || '').toLowerCase());
        if (prodEnBd) {
          const cantComprada = Number(item.cantidad || 1);
          await updateDoc(doc(db, 'productos', prodEnBd.id), {
            stock: Math.max(0, Number(prodEnBd.stock || 0) - cantComprada),
            ventas: Number(prodEnBd.ventas || 0) + cantComprada
          });
        }
      }
    }

    // 2. Registrar ingreso en Caja / Finanzas
    const docFin = await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId,
      tipo: 'ingreso',
      concepto: `Venta Tienda Web #${pedido.id.slice(-6).toUpperCase()} - ${pedido.cliente?.nombre || 'Cliente Web'}`,
      monto: Number(pedido.total || 0),
      metodoPago: metodo.toLowerCase(),
      items: pedido.items || [],
      fecha: serverTimestamp(),
      usuario: user.email
    });

    // 3. Marcar pedido como Pagado y en Preparación
    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), {
      estado: 'pagado_preparacion',
      cobradoEnCaja: true,
      idMovimientoFinanzas: docFin.id,
      metodoPagoConfirmado: metodo.toLowerCase()
    });

    alert(`✅ Stock descontado y cobro de $${Number(pedido.total || 0).toLocaleString()} registrado en Caja.`);
  };

  // --- ACCIÓN 2: CAMBIAR ESTADO Y ASIGNAR REPARTIDOR O TRACKING ---
  const cambiarEstadoPedidoWeb = async (pedido: any, nuevoEstado: string) => {
    let datosExtra: any = { estado: nuevoEstado };

    if (nuevoEstado === 'en_camino') {
      const infoEnvio = prompt(
        `🛵 DESPACHO DE PEDIDO #${pedido.id.slice(-6).toUpperCase()}\n` +
        `Escribe el nombre del Repartidor Local o el Código de Seguimiento de Correo/Comisionista:`,
        `Repartidor Local (${nombreNegocioActivo})`
      );
      if (infoEnvio !== null) datosExtra.infoSeguimientoEnvio = infoEnvio;
    }

    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), datosExtra);
  };

  // --- ACCIÓN 3: EMITIR FACTURA ARCA DESDE EL PEDIDO WEB ---
  const emitirFacturaArcaPedido = async (pedido: any) => {
    const tipoFac = prompt('Tipo de Factura ARCA a emitir (C, B o A):', 'C')?.toUpperCase() || 'C';
    const cuitCli = prompt('DNI o CUIT del comprador (dejar vacío para Consumidor Final):', pedido.cliente?.dni || '') || '00-00000000-0';

    const ptoVta = String(datosFiscalesActivos.puntoVentaArca || "00001").padStart(5, "0");
    const cantPrevias = misFinanzas.filter(m => m.factura && m.factura.tipo === tipoFac).length;
    const proximoNumero = String(cantPrevias + 1).padStart(8, "0");
    const vto = new Date();
    vto.setDate(vto.getDate() + 10);

    const facturaObj = {
      tipo: tipoFac,
      puntoVenta: ptoVta,
      numero: `${ptoVta}-${proximoNumero}`,
      cuit: cuitCli,
      razonSocialReceptor: pedido.cliente?.nombre || "Consumidor Final",
      condicionIvaReceptor: tipoFac === 'A' ? "IVA Responsable Inscripto" : "Consumidor Final",
      cae: "74" + Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      vtoCae: vto.toLocaleDateString(),
      fechaEmision: new Date().toLocaleDateString()
    };

    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), { factura: facturaObj });
    imprimirFacturaARCA(
      {
        monto: pedido.total,
        metodoPago: pedido.metodoPagoConfirmado || 'transferencia',
        concepto: `Pedido Web #${pedido.id.slice(-6).toUpperCase()}`,
        items: pedido.items || [],
        factura: facturaObj
      },
      datosFiscalesActivos
    );
  };

  // --- ACCIÓN 4: NOTIFICAR AL COMPRADOR POR WHATSAPP SEGÚN ESTADO ---
  const avisarCompradorWhatsApp = (pedido: any) => {
    const cod = pedido.id.slice(-6).toUpperCase();
    const estadoActual = pedido.estado || 'pendiente';
    const detalleItems = (pedido.items || []).map((i: any) => `▪️ ${i.cantidad || 1}x ${i.nombre}`).join('\n');

    let msg = `Hola *${pedido.cliente?.nombre}*, te escribimos de *${nombreNegocioActivo}* por tu Pedido Web *#${cod}*:\n\n`;
    msg += `🛍️ *Detalle de tu compra:*\n${detalleItems}\n`;
    msg += `💰 *Total:* $${Number(pedido.total || 0).toLocaleString()}\n\n`;

    if (estadoActual === 'pendiente') {
      msg += `⏳ *Estado:* Pendiente de acreditación de pago.\n`;
      msg += `🏦 *Alias para transferir:* ${config.aliasTransferencia} (${config.bancoTitular})\n`;
      msg += `Envianos el comprobante por acá así ya separamos tu pedido.`;
    } else if (estadoActual === 'pagado_preparacion') {
      msg += `✅ *Estado:* ¡Pago acreditado! Tu pedido ya está preparado y separado.`;
    } else if (estadoActual === 'en_camino') {
      msg += `🛵 *Estado:* ¡Tu pedido está en camino!\n`;
      if (pedido.infoSeguimientoEnvio) msg += `📦 *Transporte / Seguimiento:* ${pedido.infoSeguimientoEnvio}\n`;
    } else if (estadoActual === 'entregado') {
      msg += `🎉 *Estado:* Pedido Entregado. ¡Muchas gracias por tu compra!`;
    }

    window.open(`https://wa.me/549${(pedido.cliente?.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- ACCIÓN 5: IMPRIMIR ETIQUETA / COMANDA DE PREPARACIÓN Y ENVÍO ---
  const imprimirRemitoEnvioPedido = (pedido: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    const cod = pedido.id.slice(-6).toUpperCase();
    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comanda Pedido Web #${cod}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; max-width: 650px; margin: 0 auto; padding: 25px; }
            .etiqueta { border: 3px solid #111; border-radius: 12px; padding: 20px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #eee; padding: 8px; text-align: left; border-bottom: 1px solid #000; font-size: 12px; }
            td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align:right; margin-bottom:12px;">
            <button onclick="window.print()" style="background:#007aff; color:#fff; border:none; padding:10px 20px; border-radius:999px; font-weight:bold; cursor:pointer;">🖨️ Imprimir Etiqueta / Remito para el Paquete</button>
          </div>
          <div class="etiqueta">
            <div class="header">
              <div>
                <h2 style="margin:0;">${nombreNegocioActivo}</h2>
                <div style="font-size:12px;">📍 ${direccionNegocioActivo} | 📱 ${whatsappNegocioActivo}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px; font-weight:bold;">PEDIDO E-COMMERCE</div>
                <div style="font-size:24px; font-weight:900;">#${cod}</div>
              </div>
            </div>
            <div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:12px; font-size:14px;">
              <div><b>DESTINATARIO:</b> ${pedido.cliente?.nombre || 'Cliente Web'}</div>
              <div><b>TELÉFONO:</b> ${pedido.cliente?.telefono || '-'}</div>
              <div><b>DIRECCIÓN / ENTREGA:</b> ${pedido.cliente?.direccion || 'Retira por el Local'}</div>
              ${pedido.infoSeguimientoEnvio ? `<div><b>REPARTIDOR / TRACKING:</b> ${pedido.infoSeguimientoEnvio}</div>` : ''}
            </div>
            <table>
              <thead><tr><th>Cant.</th><th>Artículo</th><th style="text-align:right;">Subtotal</th></tr></thead>
              <tbody>
                ${(pedido.items || []).map((it: any) => `
                  <tr>
                    <td><b>${it.cantidad || 1}</b></td>
                    <td>${it.nombre}</td>
                    <td style="text-align:right;">$${(Number(it.precio || 0) * Number(it.cantidad || 1)).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid #000; padding-top:12px; font-weight:bold; font-size:16px;">
              <span>ESTADO: ${pedido.cobradoEnCaja ? '✅ PAGADO' : '⏳ COBRAR AL ENTREGAR'}</span>
              <span>TOTAL: $${Number(pedido.total || 0).toLocaleString()}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    v.document.close();
  };

  const pedidosFiltrados = misPedidosWeb.filter(p => {
    const est = p.estado || 'pendiente';
    if (filtroEstadoPedido !== 'todos' && est !== filtroEstadoPedido) return false;
    if (busquedaPedido) {
      const b = busquedaPedido.toLowerCase();
      return p.id.toLowerCase().includes(b) ||
             p.cliente?.nombre?.toLowerCase().includes(b) ||
             p.cliente?.telefono?.toLowerCase().includes(b);
    }
    return true;
  });

  const totalVendidoWeb = misPedidosWeb
    .filter(p => p.cobradoEnCaja || p.estado === 'entregado')
    .reduce((acc, p) => acc + Number(p.total || 0), 0);

  return (
    <div>
      {/* KPIs DE TIENDA ONLINE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div className="neon-card">
          <span className="label-neon">🛍️ Pedidos Web Recibidos</span>
          <h2 className="glow-text-cyan" style={{ margin: '4px 0' }}>{misPedidosWeb.length} Pedidos</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            ⏳ {misPedidosWeb.filter(p => !p.estado || p.estado === 'pendiente').length} esperando pago
          </small>
        </div>
        <div className="neon-card neon-card-green">
          <span className="label-neon">💰 Ventas Web Cobradas</span>
          <h2 className="glow-text-green" style={{ margin: '4px 0' }}>${totalVendidoWeb.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Acreditados en Caja y descontados de Stock</small>
        </div>
        <div className="neon-card neon-card-purple">
          <span className="label-neon">🛵 En Camino / Para Despachar</span>
          <h2 className="glow-text-pink" style={{ margin: '4px 0' }}>
            {misPedidosWeb.filter(p => p.estado === 'pagado_preparacion' || p.estado === 'en_camino').length} Paquetes
          </h2>
          <small style={{ color: 'var(--text-muted)' }}>Con Repartidor Local o Encomienda</small>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="neon-card" style={{ marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          className="neon-input" 
          placeholder="🔍 Buscar pedido por código, cliente o WhatsApp..." 
          value={busquedaPedido} 
          onChange={e => setBusquedaPedido(e.target.value)} 
          style={{ flex: 1 }} 
        />
        <select className="neon-select" value={filtroEstadoPedido} onChange={e => setFiltroEstadoPedido(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todos los Pedidos ({misPedidosWeb.length})</option>
          <option value="pendiente">⏳ Pendiente de Pago</option>
          <option value="pagado_preparacion">💵 Pagado / En Preparación</option>
          <option value="en_camino">🛵 En Camino (Repartidor / Correo)</option>
          <option value="entregado">✅ Entregado</option>
          <option value="cancelado">❌ Cancelado</option>
        </select>
      </div>

      {/* TABLA DE PEDIDOS WEB */}
      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <table className="neon-table">
          <thead>
            <tr>
              <th>Pedido / Fecha</th>
              <th>Comprador & Dirección</th>
              <th>Artículos Comprados</th>
              <th>Total & Caja</th>
              <th>Estado Logístico</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map(p => {
              const cod = p.id.slice(-6).toUpperCase();
              const fechaStr = p.fecha?.seconds ? new Date(p.fecha.seconds * 1000).toLocaleString() : 'Reciente';
              return (
                <tr key={p.id} style={{ opacity: p.estado === 'cancelado' ? 0.5 : 1 }}>
                  <td>
                    <b className="glow-text-cyan" style={{ fontSize: '16px' }}>#{cod}</b><br />
                    <small style={{ color: 'var(--text-muted)' }}>{fechaStr}</small>
                  </td>
                  <td>
                    <b>{p.cliente?.nombre || 'Cliente Web'}</b><br />
                    <span className="glow-text-green" style={{ fontSize: '13px' }}>📱 {p.cliente?.telefono || '-'}</span><br />
                    <small style={{ color: 'var(--text-muted)' }}>📍 {p.cliente?.direccion || 'Retira en Local'}</small>
                  </td>
                  <td>
                    {(p.items || []).map((it: any, idx: number) => (
                      <div key={idx} style={{ fontSize: '13px' }}>
                        <b>{it.cantidad || 1}x</b> {it.nombre} <small style={{ color: 'var(--text-muted)' }}>(${Number(it.precio || 0).toLocaleString()})</small>
                      </div>
                    ))}
                    {p.infoSeguimientoEnvio && (
                      <div style={{ fontSize: '12px', color: 'var(--neon-pink)', marginTop: '4px' }}>
                        🛵 Envío: {p.infoSeguimientoEnvio}
                      </div>
                    )}
                  </td>
                  <td>
                    <b className="glow-text-green" style={{ fontSize: '17px' }}>${Number(p.total || 0).toLocaleString()}</b><br />
                    {p.cobradoEnCaja ? (
                      <span className="neon-badge" style={{ background: 'rgba(40,205,65,0.15)', color: 'var(--neon-green)', marginTop: '4px' }}>
                        ✅ Cobrado y Descontado
                      </span>
                    ) : (
                      <button 
                        onClick={() => procesarCobroYDescuentoStock(p)} 
                        className="neon-btn neon-btn-fillCyan" 
                        style={{ padding: '4px 10px', fontSize: '11px', marginTop: '4px' }}
                      >
                        💰 Cobrar y Descontar Stock
                      </button>
                    )}
                  </td>
                  <td>
                    <select 
                      className="neon-select" 
                      value={p.estado || 'pendiente'} 
                      onChange={e => cambiarEstadoPedidoWeb(p, e.target.value)}
                      style={{ padding: '7px' }}
                    >
                      <option value="pendiente">⏳ Pendiente de Pago</option>
                      <option value="pagado_preparacion">💵 En Preparación</option>
                      <option value="en_camino">🛵 En Camino / Repartidor</option>
                      <option value="entregado">✅ Entregado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => avisarCompradorWhatsApp(p)} className="neon-btn neon-btn-green" title="Avisar por WhatsApp">💬</button>
                      <button onClick={() => imprimirRemitoEnvioPedido(p)} className="neon-btn" title="Imprimir Etiqueta / Comanda de Paquete">🖨️</button>
                      <button onClick={() => emitirFacturaArcaPedido(p)} className="neon-btn neon-btn-purple" title="Emitir Factura ARCA">🏛️</button>
                      <button onClick={() => { if (window.confirm('¿Eliminar pedido web?')) deleteDoc(doc(db, 'pedidos_ecommerce', p.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay pedidos web en este estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// --- FIN DEL ARCHIVO MODULOPEDIDOSWEB.TSX ---