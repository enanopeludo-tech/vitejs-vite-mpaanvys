// src/modulos/ModuloPresupuestos.tsx
import React, { useState, useEffect } from 'react';
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
  // Datos del Cliente y Presupuesto
  const [presCliente, setPresCliente] = useState('');
  const [presTel, setPresTel] = useState('');
  const [presEquipo, setPresEquipo] = useState('');
  const [presValidez, setPresValidez] = useState('7');
  const [presNotas, setPresNotas] = useState('Para iniciar el pedido del repuesto se requiere el 50% de adelanto. Saldo 50% contra entrega.');
  const [tipoClientePres, setTipoClientePres] = useState<'publico' | 'gremio'>(esSucursalExterna ? 'gremio' : 'publico');
  const [modalidadEntregaPres, setModalidadEntregaPres] = useState<'retira_local' | 'cadete_incluido' | 'cadete_a_cargo_cliente'>('retira_local');
  const [itemsPresupuesto, setItemsPresupuesto] = useState<any[]>([]);

  // --- CALCULADORA RÁPIDA USD + COMISIONISTA + MANO DE OBRA EN PRESUPUESTOS ---
  const [calcDescRepuesto, setCalcDescRepuesto] = useState('Cambio de Módulo / Pantalla');
  const [calcCostoUsd, setCalcCostoUsd] = useState('');
  const [calcComisionista, setCalcComisionista] = useState('4500');
  const [calcManoObra, setCalcManoObra] = useState('0');
  const [calcPrecioListaResultante, setCalcPrecioListaResultante] = useState(0);

  // Carga manual o desde stock separado (Proveedores vs Local)
  const [itemManualDesc, setItemManualDesc] = useState('');
  const [itemManualPrecio, setItemManualPrecio] = useState('');
  const [origenStockBuscador, setOrigenStockBuscador] = useState<'proveedores' | 'local'>('proveedores');
  const [busquedaProdPres, setBusquedaProdPres] = useState('');

  const opcionesComisionistas = (config.comisionistasLista || "Comisionista Mar del Plata:4500, Comisionista CABA:7500, Sin Flete:0")
    .split(',')
    .map((item: string) => {
      const partes = item.split(':');
      return { nombre: partes[0]?.trim() || 'Comisionista', costo: Number(partes[1]) || 0 };
    });

  // Cálculo automático en vivo de la Calculadora USD dentro de Presupuestos
  useEffect(() => {
    const usd = Number(calcCostoUsd);
    if (!usd || usd <= 0) {
      setCalcPrecioListaResultante(0);
      return;
    }
    const dolarHoy = Number(config.cotizacionDolar || 1200);
    let margen = tipoClientePres === 'gremio' 
      ? Number(config.escala3MargenGremio || 20) 
      : Number(config.escala3MargenPublico || 35);

    if (usd <= Number(config.escala1MaxUsd || 30)) {
      margen = tipoClientePres === 'gremio' 
        ? Number(config.escala1MargenGremio || 45) 
        : Number(config.escala1MargenPublico || 80);
    } else if (usd <= Number(config.escala2MaxUsd || 80)) {
      margen = tipoClientePres === 'gremio' 
        ? Number(config.escala2MargenGremio || 30) 
        : Number(config.escala2MargenPublico || 55);
    }

    const repuestoEnPesos = (usd * (1 + margen / 100)) * dolarHoy;
    const flete = Number(calcComisionista || 0);
    const manoObra = Number(calcManoObra || 0);
    const totalLista = aplicarRedondeo(repuestoEnPesos + flete + manoObra, config.redondeoPrecios);
    setCalcPrecioListaResultante(totalLista);
  }, [calcCostoUsd, calcComisionista, calcManoObra, tipoClientePres, config]);

  const sumarDesdeCalculadoraUsd = () => {
    if (calcPrecioListaResultante <= 0) return alert('Ingresa un costo en USD válido.');
    const nombreConDetalle = `${calcDescRepuesto || 'Reparación'} (Incluye repuesto y gestión)`;
    setItemsPresupuesto([
      ...itemsPresupuesto, 
      { 
        idProd: null, 
        nombre: nombreConDetalle, 
        cantidad: 1, 
        precio: calcPrecioListaResultante,
        costoUsd: Number(calcCostoUsd) || 0,
        flete: Number(calcComisionista) || 0
      }
    ]);
    setCalcCostoUsd('');
    setCalcManoObra('0');
  };

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

  // Filtrar productos separando estrictamente Stock de Proveedores (Taller) vs Stock del Local (Accesorios)
  const productosFiltradosPorOrigen = misProductos.filter(p => {
    const esDeProv = Boolean(p.esDeProveedor || p.descripcion === 'Importado de lista');
    if (origenStockBuscador === 'proveedores' && !esDeProv) return false;
    if (origenStockBuscador === 'local' && esDeProv) return false;
    return p.nombre.toLowerCase().includes(busquedaProdPres.toLowerCase());
  });

  // Totales según Modalidad de Pago + Repartidor Local
  const costoCadeteIncluido = modalidadEntregaPres === 'cadete_incluido' ? Number(config.repartidorLocalCosto || 2000) : 0;
  const subtotalItemsLista = itemsPresupuesto.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const totalListaPresupuesto = subtotalItemsLista + costoCadeteIncluido;

  const totalEfectivoPresupuesto = aplicarRedondeo(
    totalListaPresupuesto * (1 - Number(config.descuentoEfectivoPorcentaje || 10) / 100), 
    config.redondeoPrecios
  );
  const totalTarjeta1Pago = aplicarRedondeo(
    totalListaPresupuesto * (1 + Number(config.recargoTarjeta1Pago || config.recargoTarjetaPorcentaje || 15) / 100), 
    config.redondeoPrecios
  );
  const totalTarjeta3Cuotas = aplicarRedondeo(
    totalListaPresupuesto * (1 + Number(config.recargoTarjeta3Cuotas || 28) / 100), 
    config.redondeoPrecios
  );
  const totalTarjeta6Cuotas = aplicarRedondeo(
    totalListaPresupuesto * (1 + Number(config.recargoTarjeta6Cuotas || 45) / 100), 
    config.redondeoPrecios
  );

  // Cálculo del 50% de adelanto
  const senaEfectivo50 = aplicarRedondeo(totalEfectivoPresupuesto * 0.5, config.redondeoPrecios);
  const senaLista50 = aplicarRedondeo(totalListaPresupuesto * 0.5, config.redondeoPrecios);
  const senaTarjeta50 = aplicarRedondeo(totalTarjeta1Pago * 0.5, config.redondeoPrecios);

  const guardarPresupuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsPresupuesto.length === 0) return alert('Agrega al menos un ítem o cotización USD al presupuesto.');
    const numPres = Math.random().toString(36).substring(2, 7).toUpperCase();
    await addDoc(collection(db, 'presupuestos'), {
      ownerId: tenantId,
      numero: numPres,
      cliente: presCliente,
      telefono: presTel,
      equipo: presEquipo,
      tipoCliente: tipoClientePres,
      modalidadEntrega: modalidadEntregaPres,
      costoCadeteIncluido: costoCadeteIncluido,
      validezDias: Number(presValidez) || 7,
      notas: presNotas,
      items: itemsPresupuesto,
      totalLista: totalListaPresupuesto,
      totalEfectivo: totalEfectivoPresupuesto,
      totalTarjeta: totalTarjeta1Pago,
      totalTarjeta3: totalTarjeta3Cuotas,
      totalTarjeta6: totalTarjeta6Cuotas,
      senaEfectivo: senaEfectivo50,
      estado: 'pendiente',
      fecha: serverTimestamp(),
      fechaTexto: new Date().toLocaleDateString()
    });
    setPresCliente(''); 
    setPresTel(''); 
    setPresEquipo(''); 
    setItemsPresupuesto([]);
    alert(`📄 Presupuesto #${numPres} generado y guardado.`);
  };

  const enviarPresupuestoWhatsApp = (pr: any) => {
    const senaEfvo = pr.senaEfectivo || Math.round((pr.totalEfectivo || 0) * 0.5);
    let msg = `Hola *${pr.cliente}*, te enviamos el presupuesto *#${pr.numero}* de *${nombreNegocioActivo}*:\n`;
    if (pr.equipo) msg += `📱 *Equipo:* ${pr.equipo}\n`;
    msg += `\n📋 *TRABAJO A REALIZAR:*\n`;
    pr.items?.forEach((it: any) => {
      msg += `▪️ ${it.cantidad}x ${it.nombre}\n`;
    });
    if (pr.modalidadEntrega === 'cadete_incluido') {
      msg += `🛵 *Incluye retiro/entrega con repartidor a domicilio ($${pr.costoCadeteIncluido || config.repartidorLocalCosto}).*\n`;
    } else if (pr.modalidadEntrega === 'cadete_a_cargo_cliente') {
      msg += `🛵 *Entrega:* Retiro en local sin cargo o envío con repartidor ($${config.repartidorLocalCosto || 2000} a cargo del cliente).\n`;
    }
    msg += `\n💰 *VALORES SEGÚN MODALIDAD DE PAGO:*\n`;
    msg += `💵 *Efectivo (-${config.descuentoEfectivoPorcentaje}%): $${pr.totalEfectivo?.toLocaleString()}* (Seña 50%: $${senaEfvo.toLocaleString()})\n`;
    msg += `🏦 *Transferencia (Lista): $${pr.totalLista?.toLocaleString()}* (Seña 50%: $${Math.round((pr.totalLista || 0) * 0.5).toLocaleString()})\n`;
    msg += `💳 *Tarjeta 1 Pago: $${pr.totalTarjeta?.toLocaleString()}*\n`;
    if (pr.totalTarjeta3) {
      msg += `💳 *3 Cuotas:* $${pr.totalTarjeta3?.toLocaleString()} (3 de $${Math.round(pr.totalTarjeta3 / 3).toLocaleString()})\n`;
    }
    if (pr.totalTarjeta6) {
      msg += `💳 *6 Cuotas:* $${pr.totalTarjeta6?.toLocaleString()} (6 de $${Math.round(pr.totalTarjeta6 / 6).toLocaleString()})\n`;
    }
    msg += `\n📌 *Condición:* Se requiere el 50% de adelanto para encargar el repuesto y el 50% restante previo a la entrega del equipo.\n`;
    msg += `⏳ *Validez:* ${pr.validezDias} días.`;
    window.open(`https://wa.me/549${(pr.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirPresupuestoPDF = (pr: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    const senaEfvo = pr.senaEfectivo || Math.round((pr.totalEfectivo || 0) * 0.5);
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
            .totales { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 20px; }
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
            <b>Cliente:</b> ${pr.cliente} | <b>Teléfono:</b> ${pr.telefono || '-'} | <b>Equipo:</b> ${pr.equipo || 'Varios'}
          </div>
          <table>
            <thead><tr><th>Cant.</th><th>Descripción de Repuesto / Servicio</th><th style="text-align:right;">Unitario (Lista)</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>
              ${pr.items?.map((it: any) => `
                <tr>
                  <td><b>${it.cantidad}</b></td>
                  <td>${it.nombre}</td>
                  <td style="text-align:right;">$${it.precio?.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:bold;">$${(it.precio * it.cantidad).toLocaleString()}</td>
                </tr>
              `).join('')}
              ${pr.costoCadeteIncluido > 0 ? `
                <tr>
                  <td><b>1</b></td>
                  <td>🛵 Servicio de Repartidor / Cadetería a Domicilio</td>
                  <td style="text-align:right;">$${pr.costoCadeteIncluido.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:bold;">$${pr.costoCadeteIncluido.toLocaleString()}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
          <div class="totales">
            <div class="box-tot" style="border-color:#28cd41; background:#f0fff4;">
              <div style="font-size:11px; font-weight:bold; color:#198754;">EFECTIVO (-${config.descuentoEfectivoPorcentaje}%)</div>
              <div style="font-size:20px; font-weight:900; color:#198754; margin-top:4px;">$${pr.totalEfectivo?.toLocaleString()}</div>
              <div style="font-size:11px; margin-top:4px;">Seña 50%: <b>$${senaEfvo.toLocaleString()}</b></div>
            </div>
            <div class="box-tot" style="border-color:#007aff;">
              <div style="font-size:11px; font-weight:bold; color:#007aff;">TRANSFERENCIA (LISTA)</div>
              <div style="font-size:20px; font-weight:900; color:#007aff; margin-top:4px;">$${pr.totalLista?.toLocaleString()}</div>
              <div style="font-size:11px; margin-top:4px;">Seña 50%: <b>$${Math.round((pr.totalLista || 0) * 0.5).toLocaleString()}</b></div>
            </div>
            <div class="box-tot">
              <div style="font-size:11px; font-weight:bold; color:#666;">TARJETA 1 PAGO</div>
              <div style="font-size:20px; font-weight:900; color:#333; margin-top:4px;">$${pr.totalTarjeta?.toLocaleString()}</div>
              <div style="font-size:11px; margin-top:4px;">Seña 50%: <b>$${Math.round((pr.totalTarjeta || 0) * 0.5).toLocaleString()}</b></div>
            </div>
            <div class="box-tot">
              <div style="font-size:11px; font-weight:bold; color:#666;">3 / 6 CUOTAS</div>
              <div style="font-size:14px; font-weight:800; color:#333; margin-top:4px;">3x $${Math.round((pr.totalTarjeta3 || pr.totalTarjeta) / 3).toLocaleString()}</div>
              <div style="font-size:14px; font-weight:800; color:#333;">6x $${Math.round((pr.totalTarjeta6 || pr.totalTarjeta) / 6).toLocaleString()}</div>
            </div>
          </div>
          <p style="margin-top:25px; font-size:12px; color:#333; border-top:1px dashed #ccc; padding-top:10px;">
            <b>Condiciones de Trabajo:</b> ${pr.notas || 'Se requiere el 50% de adelanto para encargar el repuesto y el 50% restante antes de retirar.'}
          </p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    v.document.close();
  };

  const convertirPresupuestoEnOrden = async (pr: any) => {
    const metodoElegido = prompt(
      `Convertir Presupuesto #${pr.numero} en Orden de Taller.\nElige la modalidad de pago confirmada por el cliente:\n1 = Efectivo ($${pr.totalEfectivo})\n2 = Transferencia Lista ($${pr.totalLista})\n3 = Tarjeta 1 Pago ($${pr.totalTarjeta})\n4 = Tarjeta 3 Cuotas ($${pr.totalTarjeta3 || pr.totalTarjeta})`,
      "1"
    );
    if (!metodoElegido) return;

    let montoElegido = pr.totalEfectivo;
    let etiquetaMetodo = 'efectivo';
    if (metodoElegido === '2') { montoElegido = pr.totalLista; etiquetaMetodo = 'transferencia'; }
    if (metodoElegido === '3') { montoElegido = pr.totalTarjeta; etiquetaMetodo = 'tarjeta_1'; }
    if (metodoElegido === '4') { montoElegido = pr.totalTarjeta3 || pr.totalTarjeta; etiquetaMetodo = 'tarjeta_3'; }

    const senaSugerida = Math.round(Number(montoElegido || 0) * 0.5);
    const senaAbonadaAhora = Number(prompt(`Total acordado (${etiquetaMetodo.toUpperCase()}): $${montoElegido}.\nIngresa la Seña del 50% recibida ahora ($):`, senaSugerida.toString())) || 0;

    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resumenTrabajos = pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(' + ');
    const estadoInicial = senaAbonadaAhora >= senaSugerida ? 'ingresado' : 'esperando sena 50%';

    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: tenantId,
      tallerOrigen: esSucursalExterna ? sucursalAsociada.nombre : 'Mostrador Propio',
      cliente: { nombre: pr.cliente, telefono: pr.telefono || '', dni: '' },
      equipo: { marca: pr.equipo || 'Equipo', modelo: '', imei: '', contrasena: '', condicionVisual: 'Según Presupuesto #' + pr.numero, checklist: [] },
      fallaDeclarada: resumenTrabajos,
      tecnicoAsignado: '',
      modalidadPago: etiquetaMetodo,
      modalidadEntrega: pr.modalidadEntrega || 'retira_local',
      costoReparacion: montoElegido?.toString() || '',
      seña: senaAbonadaAhora,
      estado: estadoInicial,
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ estado: estadoInicial, fecha: new Date().toLocaleString(), comentario: `Creado desde Presupuesto #${pr.numero} (${etiquetaMetodo.toUpperCase()}) | Seña: $${senaAbonadaAhora}` }]
    });

    if (senaAbonadaAhora > 0) {
      await addDoc(collection(db, 'finanzas'), {
        ownerId: tenantId,
        tipo: 'ingreso',
        concepto: `Seña 50% Presupuesto #${pr.numero} -> Orden #${cod} (${pr.cliente})`,
        monto: senaAbonadaAhora,
        metodoPago: etiquetaMetodo.startsWith('tarjeta') ? 'tarjeta' : etiquetaMetodo,
        fecha: serverTimestamp(),
        usuario: user.email
      });
    }

    await updateDoc(doc(db, 'presupuestos', pr.id), { estado: 'aprobado' });
    alert(`✅ Convertido en Orden de Taller #${cod}.`);
    setPestaña('taller');
  };

  return (
    <div>
      <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>
        📄 Generador de Presupuestos (Con Calculadora USD, Comisionistas, Cuotas y 50% Seña)
      </h2>

      {/* BLOQUE 1: CALCULADORA DE REPUESTOS EN DÓLARES + COMISIONISTA DIRECTO EN PRESUPUESTOS */}
      <div className="neon-card neon-card-purple" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="glow-text-pink" style={{ margin: 0 }}>
            🧮 1. Cotizador Instantáneo desde Lista en Dólares + Flete Comisionista (Dólar Hoy: ${config.cotizacionDolar})
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              onClick={() => setTipoClientePres('publico')} 
              className={`neon-btn ${tipoClientePres === 'publico' ? 'neon-btn-fillCyan' : ''}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              🏪 Escala Cliente Final (Central)
            </button>
            <button 
              type="button" 
              onClick={() => setTipoClientePres('gremio')} 
              className={`neon-btn ${tipoClientePres === 'gremio' ? 'neon-btn-fillCyan' : ''}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              🏢 Escala Gremio / Taller
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="label-neon">Trabajo / Repuesto a Cotizar</label>
            <input 
              type="text" 
              className="neon-input" 
              value={calcDescRepuesto} 
              onChange={e => setCalcDescRepuesto(e.target.value)} 
              placeholder="Ej: Cambio de Pantalla Original Moto G84" 
            />
          </div>
          <div>
            <label className="label-neon" style={{ color: 'var(--neon-green)' }}>Costo Lista (USD)</label>
            <input 
              type="number" 
              step="0.5"
              className="neon-input" 
              value={calcCostoUsd} 
              onChange={e => setCalcCostoUsd(e.target.value)} 
              placeholder="Ej: 45 USD" 
              style={{ fontWeight: 'bold' }}
            />
          </div>
          <div>
            <label className="label-neon">Comisionista / Flete</label>
            <select className="neon-select" value={calcComisionista} onChange={e => setCalcComisionista(e.target.value)}>
              {opcionesComisionistas.map((c: any, i: number) => (
                <option key={i} value={c.costo}>{c.nombre} (${c.costo})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-neon">Mano de Obra Adic. ($)</label>
            <input 
              type="number" 
              className="neon-input" 
              value={calcManoObra} 
              onChange={e => setCalcManoObra(e.target.value)} 
            />
          </div>
          <div>
            <button 
              type="button" 
              onClick={sumarDesdeCalculadoraUsd} 
              className="neon-btn neon-btn-fillCyan" 
              style={{ width: '100%', height: '46px' }}
            >
              ➕ Sumar (${calcPrecioListaResultante.toLocaleString()})
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
        {/* BLOQUE 2: BUSCADOR CON STOCK DE PROVEEDORES SEPARADO DEL STOCK DEL LOCAL */}
        <div className="neon-card" style={{ flex: '1 1 420px' }}>
          <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>2. O Sumar desde Base de Datos / Manual</h3>
          
          <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '14px' }}>
            <label className="label-neon">🛠️ Ítem Manual Rápido (En Pesos)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="Descripción..." value={itemManualDesc} onChange={e => setItemManualDesc(e.target.value)} style={{ flex: 2 }} />
              <input type="number" className="neon-input" placeholder="Lista $" value={itemManualPrecio} onChange={e => setItemManualPrecio(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={agregarItemManualPresupuesto} className="neon-btn neon-btn-fillCyan">+ Añadir</button>
            </div>
          </div>

          {/* PESTAÑAS QUE SEPARAN STOCK DE PROVEEDORES VS STOCK DEL LOCAL */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button 
              type="button" 
              onClick={() => setOrigenStockBuscador('proveedores')} 
              className={`neon-btn ${origenStockBuscador === 'proveedores' ? 'neon-btn-fillCyan' : ''}`}
              style={{ flex: 1, fontSize: '13px' }}
            >
              🔧 Repuestos Proveedores (Taller)
            </button>
            <button 
              type="button" 
              onClick={() => setOrigenStockBuscador('local')} 
              className={`neon-btn ${origenStockBuscador === 'local' ? 'neon-btn-fillCyan' : ''}`}
              style={{ flex: 1, fontSize: '13px' }}
            >
              🛍️ Accesorios del Local
            </button>
          </div>

          <input 
            type="text" 
            className="neon-input" 
            placeholder={origenStockBuscador === 'proveedores' ? "🔍 Buscar módulo, pin o placa en listas de proveedores..." : "🔍 Buscar cargador, funda o hidrogel del local..."} 
            value={busquedaProdPres} 
            onChange={e => setBusquedaProdPres(e.target.value)} 
            style={{ marginBottom: '10px' }} 
          />
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>{origenStockBuscador === 'proveedores' ? 'Repuesto (Proveedor)' : 'Accesorio (Local)'}</th>
                  <th>Precio Lista</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltradosPorOrigen.slice(0, 12).map(p => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.nombre}</b><br />
                      <small style={{ color: 'var(--text-muted)' }}>
                        {p.proveedor ? `Prov: ${p.proveedor}` : `Stock Local: ${p.stock}`}
                      </small>
                    </td>
                    <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                    <td><button type="button" onClick={() => agregarProductoAPresupuesto(p)} className="neon-btn">+ Cotizar</button></td>
                  </tr>
                ))}
                {productosFiltradosPorOrigen.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay artículos en esta sección con ese nombre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BLOQUE 3: RESUMEN FINANCIERO MULTIPAGO + 50% DE SEÑA + CADETERÍA */}
        <form onSubmit={guardarPresupuesto} className="neon-card neon-card-green" style={{ flex: '1 1 440px' }}>
          <h3 className="glow-text-green" style={{ marginTop: 0 }}>3. Cliente, Entrega, Medios de Pago y 50% Seña</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label className="label-neon">Nombre del Cliente *</label>
              <input type="text" className="neon-input" required value={presCliente} onChange={e => setPresCliente(e.target.value)} placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <label className="label-neon">WhatsApp</label>
              <input type="text" className="neon-input" value={presTel} onChange={e => setPresTel(e.target.value)} placeholder="2262..." />
            </div>
            <div>
              <label className="label-neon">Equipo / Modelo</label>
              <input type="text" className="neon-input" value={presEquipo} onChange={e => setPresEquipo(e.target.value)} placeholder="Ej: Samsung A52" />
            </div>
            <div>
              <label className="label-neon">Logística de Entrega / Retiro</label>
              <select className="neon-select" value={modalidadEntregaPres} onChange={e => setModalidadEntregaPres(e.target.value as any)}>
                <option value="retira_local">📍 Retira por el Local ($0)</option>
                <option value="cadete_incluido">🛵 Incluir Repartidor (+${config.repartidorLocalCosto || 2000})</option>
                <option value="cadete_a_cargo_cliente">🛵 Repartidor a cargo del Cliente</option>
              </select>
            </div>
          </div>

          <div style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid rgba(128,128,128,0.15)' }}>
            {itemsPresupuesto.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                <div><b>{it.cantidad}x</b> {it.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <b className="glow-text-cyan">${(it.precio * it.cantidad).toLocaleString()}</b>
                  <button type="button" onClick={() => setItemsPresupuesto(itemsPresupuesto.filter((_, i) => i !== idx))} className="neon-btn neon-btn-red" style={{ padding: '3px 8px' }}>✕</button>
                </div>
              </div>
            ))}
            {itemsPresupuesto.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Usa el cotizador USD o la tabla para sumar ítems.</p>}
          </div>

          {/* CUADRO COMPARATIVO DE MODALIDADES DE PAGO + 50% ADELANTO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '12px', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>💵 EFECTIVO (-{config.descuentoEfectivoPorcentaje}%)</span>
              <b className="glow-text-green" style={{ fontSize: '17px' }}>${totalEfectivoPresupuesto.toLocaleString()}</b>
              <small style={{ display: 'block', fontSize: '11px', color: 'var(--neon-green)' }}>Seña 50%: ${senaEfectivo50.toLocaleString()}</small>
            </div>
            <div style={{ borderLeft: '1px solid rgba(128,128,128,0.2)', borderRight: '1px solid rgba(128,128,128,0.2)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>🏦 TRANSF. (LISTA)</span>
              <b className="glow-text-cyan" style={{ fontSize: '17px' }}>${totalListaPresupuesto.toLocaleString()}</b>
              <small style={{ display: 'block', fontSize: '11px', color: 'var(--neon-cyan)' }}>Seña 50%: ${senaLista50.toLocaleString()}</small>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>💳 TARJETA 1 PAGO</span>
              <b className="glow-text-pink" style={{ fontSize: '17px' }}>${totalTarjeta1Pago.toLocaleString()}</b>
              <small style={{ display: 'block', fontSize: '11px', color: 'var(--neon-pink)' }}>Seña 50%: ${senaTarjeta50.toLocaleString()}</small>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>💳 CUOTAS</span>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>3x ${Math.round(totalTarjeta3Cuotas / 3).toLocaleString()}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>6x ${Math.round(totalTarjeta6Cuotas / 6).toLocaleString()}</div>
            </div>
          </div>

          <input type="text" className="neon-input" value={presNotas} onChange={e => setPresNotas(e.target.value)} placeholder="Notas al pie..." style={{ marginBottom: '12px' }} />

          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
            💾 Guardar Presupuesto Oficial
          </button>
        </form>
      </div>

      {/* HISTORIAL DE PRESUPUESTOS */}
      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>📋 Historial de Presupuestos Emitidos</h3>
        <table className="neon-table">
          <thead>
            <tr>
              <th>N° / Fecha</th>
              <th>Cliente & Equipo</th>
              <th>Detalle Cotizado</th>
              <th>Efectivo (Seña 50%)</th>
              <th>Lista</th>
              <th>Tarjeta / Cuotas</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {misPresupuestos.map(pr => (
              <tr key={pr.id}>
                <td><b className="glow-text-cyan">#{pr.numero}</b><br /><small style={{ color: 'var(--text-muted)' }}>{pr.fechaTexto}</small></td>
                <td><b>{pr.cliente}</b><br /><small style={{ color: 'var(--text-muted)' }}>{pr.equipo || '-'} | 📱 {pr.telefono}</small></td>
                <td style={{ fontSize: '13px' }}>{pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', ')}</td>
                <td>
                  <b className="glow-text-green">${pr.totalEfectivo?.toLocaleString()}</b><br />
                  <small style={{ color: 'var(--text-muted)' }}>50%: ${Math.round((pr.totalEfectivo || 0) * 0.5).toLocaleString()}</small>
                </td>
                <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${pr.totalLista?.toLocaleString()}</td>
                <td>
                  <b className="glow-text-pink">${pr.totalTarjeta?.toLocaleString()}</b><br />
                  {pr.totalTarjeta3 && <small style={{ color: 'var(--text-muted)' }}>3x ${Math.round(pr.totalTarjeta3 / 3).toLocaleString()}</small>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => enviarPresupuestoWhatsApp(pr)} className="neon-btn neon-btn-green">💬 WhatsApp</button>
                    <button onClick={() => imprimirPresupuestoPDF(pr)} className="neon-btn">🖨️ PDF</button>
                    <button onClick={() => convertirPresupuestoEnOrden(pr)} className="neon-btn neon-btn-purple">🛠️ Aprobar y Cobrar 50%</button>
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