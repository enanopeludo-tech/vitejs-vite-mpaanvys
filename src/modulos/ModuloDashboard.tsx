// src/modulos/ModuloDashboard.tsx
import React from 'react';

interface PropsDashboard {
  esSucursalExterna: boolean;
  nombreNegocioActivo: string;
  urlVitrinaPropia: string;
  config: any;
  misOrdenesTaller: any[];
  misProductos: any[];
  misFinanzas: any[];
  misPedidosWeb: any[];
  misPresupuestos: any[];
  talleresGremio: any[];
  rmas: any[];
  sincronizandoDolar: boolean;
  sincronizarDolarAhora: (tipo?: string, alerta?: boolean) => void;
  setPestaña: (p: string) => void;
}

export const ModuloDashboard: React.FC<PropsDashboard> = ({
  esSucursalExterna,
  nombreNegocioActivo,
  urlVitrinaPropia,
  config,
  misOrdenesTaller,
  misProductos,
  misFinanzas,
  misPedidosWeb,
  misPresupuestos,
  talleresGremio,
  rmas,
  sincronizandoDolar,
  sincronizarDolarAhora,
  setPestaña
}) => {
  // 1. Métricas Financieras
  const totalIngresos = misFinanzas
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const totalEgresos = misFinanzas
    .filter(m => m.tipo === 'egreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const balanceNeto = totalIngresos - totalEgresos;

  const ingresosEfectivo = misFinanzas
    .filter(m => m.tipo === 'ingreso' && m.metodoPago === 'efectivo')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const ingresosDigitales = totalIngresos - ingresosEfectivo;

  // 2. Métricas de Laboratorio y Saldos 50% por Cobrar
  const ordenesEsperandoSena = misOrdenesTaller.filter(o => o.estado === 'esperando sena 50%');
  const ordenesEnComisionista = misOrdenesTaller.filter(o => o.estado === 'repuesto en viaje comisionista');
  const ordenesEnBanco = misOrdenesTaller.filter(o => o.estado === 'ingresado' || o.estado === 'en revision' || o.estado === 'reingreso garantia');
  const ordenesListasParaRetiro = misOrdenesTaller.filter(o => o.estado === 'reparado');

  const saldoPorCobrarEnListos = ordenesListasParaRetiro.reduce((acc, o) => {
    const total = Number(o.costoReparacion || 0);
    const sena = Number(o.seña || 0);
    return acc + Math.max(0, total - sena);
  }, 0);

  // 3. Métricas de Stock del Local (Sin mezclar proveedores)
  const accesoriosLocal = misProductos.filter(p => !p.esDeProveedor && p.descripcion !== 'Importado de lista');
  const alertaMinimo = Number(config.stockCriticoAlerta || 3);
  const accesoriosStockCritico = accesoriosLocal.filter(p => Number(p.stock || 0) <= alertaMinimo);

  // 4. Métricas Gremio B2B, Pedidos Web y RMAs
  const deudaTotalGremio = talleresGremio.reduce((acc, t) => acc + Number(t.saldoDeudor || 0), 0);
  const pedidosWebPendientes = misPedidosWeb.filter(p => !p.estado || p.estado === 'pendiente' || p.estado === 'pagado_preparacion');
  const rmasActivos = rmas.filter(r => r.estado === 'pendiente' || r.estado === 'enviado_comisionista');

  const recordarRetiroWhatsApp = (orden: any) => {
    const total = Number(orden.costoReparacion || 0);
    const sena = Number(orden.seña || 0);
    const saldo = Math.max(0, total - sena);
    let msg = `Hola *${orden.cliente?.nombre}*, te recordamos de *${nombreNegocioActivo}* que tu *${orden.equipo?.marca} ${orden.equipo?.modelo}* (Orden *#${orden.codigoSeguimiento}*) ya se encuentra *REPARADO Y LISTO* para retirar o enviar con nuestro repartidor.\n\n`;
    msg += `💰 *Saldo restante (50%) a abonar en la entrega: $${saldo.toLocaleString()}*\n`;
    msg += `📍 Dirección: ${config.direccion} (${config.horariosAtencion})`;
    window.open(`https://wa.me/549${(orden.cliente?.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirQrMostradorTienda = () => {
    const v = window.open('', '_blank');
    if (!v) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(urlVitrinaPropia)}`;
    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Catálogo Oficial - ${nombreNegocioActivo}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 40px; }
            .card-qr { border: 4px solid #007aff; border-radius: 24px; max-width: 420px; margin: 0 auto; padding: 30px; }
          </style>
        </head>
        <body>
          <div class="card-qr">
            <h1 style="margin:0; color:#007aff;">${nombreNegocioActivo}</h1>
            <p style="font-weight:bold; color:#444;">ESCANEÁ EL QR Y MIRÁ NUESTRO CATÁLOGO DE ACCESORIOS Y PRECIOS EN VIVO</p>
            <img src="${qrUrl}" style="width:240px; height:240px; margin:15px 0;" />
            <div style="font-size:13px; color:#333;">📱 WhatsApp: ${config.whatsapp}<br/>📍 ${config.direccion}</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    v.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BARRA SUPERIOR EJECUTIVA + TIENDA OFICIAL + DÓLAR */}
      <div className="neon-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 className="glow-text-cyan" style={{ margin: 0 }}>
            📊 Centro de Comando // {nombreNegocioActivo}
          </h2>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            💵 Dólar Global Activo: <b className="glow-text-green">${config.cotizacionDolar}</b> ({config.dolarTipoFuente?.toUpperCase() || 'BLUE'}) 
            {' | '} 🛍️ Tienda Pública:{' '}
            <a href={urlVitrinaPropia} target="_blank" rel="noreferrer" className="glow-text-cyan" style={{ fontWeight: 'bold' }}>
              {urlVitrinaPropia}
            </a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => { navigator.clipboard.writeText(urlVitrinaPropia); alert('🔗 Link de tu Tienda Oficial copiado al portapapeles.'); }} 
            className="neon-btn"
          >
            📋 Copiar Link Tienda
          </button>
          <button onClick={imprimirQrMostradorTienda} className="neon-btn neon-btn-purple">
            📱 Imprimir QR Mostrador
          </button>
          {!esSucursalExterna && (
            <button onClick={() => sincronizarDolarAhora(undefined, true)} disabled={sincronizandoDolar} className="neon-btn neon-btn-green">
              {sincronizandoDolar ? 'Sincronizando...' : `🔄 Actualizar Dólar ($${config.cotizacionDolar})`}
            </button>
          )}
        </div>
      </div>

      {/* GRILLA DE 6 TARJETAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="neon-card neon-card-green" onClick={() => setPestaña('finanzas')} style={{ cursor: 'pointer' }}>
          <span className="label-neon">💰 Caja Neta Acumulada</span>
          <h2 className="glow-text-green" style={{ margin: '6px 0' }}>${balanceNeto.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)', display: 'block' }}>
            💵 Efectivo: ${ingresosEfectivo.toLocaleString()} | 🏦 Digital: ${ingresosDigitales.toLocaleString()}
          </small>
          <small style={{ color: 'var(--neon-red)' }}>Egresos: -${totalEgresos.toLocaleString()}</small>
        </div>

        <div className="neon-card" onClick={() => setPestaña('taller')} style={{ cursor: 'pointer' }}>
          <span className="label-neon">🛠️ Estado del Laboratorio</span>
          <h2 className="glow-text-cyan" style={{ margin: '6px 0' }}>{ordenesEnBanco.length} en Banco</h2>
          <small style={{ color: 'var(--text-muted)', display: 'block' }}>
            ⏳ Esperando 50% Seña: <b>{ordenesEsperandoSena.length}</b>
          </small>
          <small style={{ color: 'var(--neon-pink)' }}>
            🚚 Repuesto en Comisionista: <b>{ordenesEnComisionista.length}</b>
          </small>
        </div>

        <div className="neon-card neon-card-yellow" onClick={() => setPestaña('taller')} style={{ cursor: 'pointer' }}>
          <span className="label-neon">✅ Equipos Reparados por Entregar</span>
          <h2 className="glow-text-yellow" style={{ margin: '6px 0' }}>${saldoPorCobrarEnListos.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)', display: 'block' }}>
            <b>{ordenesListasParaRetiro.length} equipos terminados</b> esperando retiro y pago del 50% final.
          </small>
        </div>

        {!esSucursalExterna && (
          <div className="neon-card neon-card-purple" onClick={() => setPestaña('talleres_b2b')} style={{ cursor: 'pointer' }}>
            <span className="label-neon">🏢 Cuentas Corrientes Gremio</span>
            <h2 className="glow-text-pink" style={{ margin: '6px 0' }}>${deudaTotalGremio.toLocaleString()}</h2>
            <small style={{ color: 'var(--text-muted)' }}>
              Saldo a cobrar en {talleresGremio.length} locales asociados
            </small>
          </div>
        )}

        <div className="neon-card" onClick={() => setPestaña('pedidos')} style={{ cursor: 'pointer' }}>
          <span className="label-neon">🌐 Pedidos Web & Presupuestos</span>
          <h2 className="glow-text-cyan" style={{ margin: '6px 0' }}>{pedidosWebPendientes.length} Pedidos Activos</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            📄 {misPresupuestos.length} presupuestos emitidos
          </small>
        </div>

        <div className="neon-card neon-card-pink" onClick={() => setPestaña('catalogo')} style={{ cursor: 'pointer' }}>
          <span className="label-neon">📦 Alertas de Stock & RMA</span>
          <h2 className="glow-text-red" style={{ margin: '6px 0' }}>{accesoriosStockCritico.length} en Stock Crítico</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            🔄 {rmasActivos.length} RMAs reclamados a proveedores
          </small>
        </div>
      </div>

      {/* DOS COLUMNAS OPERATIVAS: EQUIPOS LISTOS PARA COBRAR EL 50% FINAL + REPOSICIÓN DE STOCK LOCAL */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="neon-card" style={{ flex: '1 1 460px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="glow-text-green" style={{ margin: 0 }}>
              ✅ Equipos Listos para Retiro / Envío (Cobrar 50% Restante)
            </h3>
            <button onClick={() => setPestaña('taller')} className="neon-btn" style={{ padding: '5px 12px', fontSize: '12px' }}>
              Ver Taller ➔
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente / Equipo</th>
                  <th>Saldo a Cobrar</th>
                  <th>Avisar</th>
                </tr>
              </thead>
              <tbody>
                {ordenesListasParaRetiro.slice(0, 8).map(o => {
                  const saldo = Math.max(0, Number(o.costoReparacion || 0) - Number(o.seña || 0));
                  return (
                    <tr key={o.id}>
                      <td><b className="glow-text-cyan">#{o.codigoSeguimiento}</b></td>
                      <td>
                        <b>{o.cliente?.nombre}</b><br />
                        <small style={{ color: 'var(--text-muted)' }}>{o.equipo?.marca} {o.equipo?.modelo}</small>
                      </td>
                      <td className="glow-text-green" style={{ fontWeight: 'bold' }}>
                        ${saldo.toLocaleString()}
                      </td>
                      <td>
                        <button onClick={() => recordarRetiroWhatsApp(o)} className="neon-btn neon-btn-green" style={{ padding: '5px 10px' }}>
                          💬 Reclamar Retiro
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {ordenesListasParaRetiro.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay equipos terminados pendientes de retiro en este momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="neon-card" style={{ flex: '1 1 380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="glow-text-yellow" style={{ margin: 0 }}>
              ⚠️ Accesorios del Local con Stock Bajo (≤ {alertaMinimo})
            </h3>
            <button onClick={() => setPestaña('catalogo')} className="neon-btn" style={{ padding: '5px 12px', fontSize: '12px' }}>
              Reponer ➔
            </button>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Accesorio (Local)</th>
                  <th>Ubicación</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {accesoriosStockCritico.slice(0, 10).map(p => (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b></td>
                    <td><small style={{ color: 'var(--text-muted)' }}>{p.ubicacion || 'Mostrador'}</small></td>
                    <td>
                      <span className="neon-badge" style={{ background: 'rgba(255,59,48,0.15)', color: 'var(--neon-red)' }}>
                        {p.stock} unid.
                      </span>
                    </td>
                  </tr>
                ))}
                {accesoriosStockCritico.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      🎉 Todo el stock de accesorios del local está por encima del mínimo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
// --- FIN DEL ARCHIVO MODULODASHBOARD.TSX ---