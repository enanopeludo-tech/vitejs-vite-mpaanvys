// src/modulos/ModuloTaller.tsx
import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CHECKLIST_ITEMS } from '../estilosTema';

interface PropsTaller {
  user: any;
  tenantId: string;
  esSucursalExterna: boolean;
  sucursalAsociada: any;
  nombreNegocioActivo: string;
  esAdminDelNegocioActivo: boolean;
  misOrdenesTaller: any[];
  misProductos: any[];
  talleresGremio: any[];
  config: any;
}

export const ModuloTaller: React.FC<PropsTaller> = ({
  user,
  tenantId,
  esSucursalExterna,
  sucursalAsociada,
  nombreNegocioActivo,
  esAdminDelNegocioActivo,
  misOrdenesTaller,
  misProductos,
  talleresGremio,
  config
}) => {
  const [cliNombre, setCliNombre] = useState('');
  const [cliTel, setCliTel] = useState('');
  const [cliDni, setCliDni] = useState('');
  const [tallerOrigenOrden, setTallerOrigenOrden] = useState('Mostrador Propio');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [imei, setImei] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [condicionVisual, setCondicionVisual] = useState('');
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [costoGremioInicial, setCostoGremioInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería OK"]);

  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroOrigenTaller, setFiltroOrigenTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');

  const listaSectores = (config.sectoresTaller || "Microelectrónica, Módulos, Software").split(',').map((s: string) => s.trim());

  const toggleItemChecklist = (item: string) => {
    setChecklist(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const origenFinal = esSucursalExterna ? sucursalAsociada.nombre : tallerOrigenOrden;
    const idSucursalFinal = esSucursalExterna ? sucursalAsociada.id : (talleresGremio.find(t => t.nombre === tallerOrigenOrden)?.id || 'MASTER');

    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: idSucursalFinal,
      tallerOrigen: origenFinal,
      cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni },
      equipo: { marca, modelo, imei, contrasena, condicionVisual, checklist },
      fallaDeclarada: falla,
      tecnicoAsignado: esSucursalExterna ? 'Laboratorio Central Walabba' : tecnico,
      costoReparacion: presupuestoInicial || '',
      costoGremio: esSucursalExterna ? '' : (costoGremioInicial || ''),
      costoRepuestosUsados: 0,
      repuestosLista: [],
      seña: Number(señaRecibida) || 0,
      estado: 'ingresado',
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: `Equipo recepcionado en ${origenFinal} (${user.email}).` }]
    });

    if (Number(señaRecibida) > 0) {
      await addDoc(collection(db, 'finanzas'), {
        ownerId: tenantId,
        tipo: 'ingreso',
        concepto: `Seña Orden #${cod} - ${cliNombre} (${marca} ${modelo})`,
        monto: Number(señaRecibida),
        metodoPago: 'efectivo',
        fecha: serverTimestamp(),
        usuario: user.email
      });
    }

    setCliNombre(''); setCliTel(''); setCliDni(''); setMarca(''); setModelo(''); setFalla('');
    setTecnico(''); setImei(''); setContrasena(''); setCondicionVisual('');
    setPresupuestoInicial(''); setCostoGremioInicial(''); setSeñaRecibida('');
    alert(`⚡ Orden #${cod} generada correctamente.`);
  };

  const imputarRepuestoAOrden = async (orden: any) => {
    const busquedaRep = prompt('Escribe parte del nombre del repuesto usado (Ej: A52, Pin, Modulo):');
    if (!busquedaRep) return;
    const candidatos = misProductos.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busquedaRep.toLowerCase()));
    if (candidatos.length === 0) return alert('No se encontraron repuestos en tu stock con ese nombre.');

    const listaOpciones = candidatos.slice(0, 8).map((c, idx) => `${idx + 1}. ${c.nombre} (Stock: ${c.stock} | Costo: $${c.costoProveedor || 0})`).join('\n');
    const eleccion = prompt(`Selecciona el número del repuesto a descontar de tu stock:\n\n${listaOpciones}`);
    const indexElegido = Number(eleccion) - 1;
    if (isNaN(indexElegido) || !candidatos[indexElegido]) return;

    const repuesto = candidatos[indexElegido];
    await updateDoc(doc(db, 'productos', repuesto.id), { stock: repuesto.stock - 1 });
    await updateDoc(doc(db, 'ordenes_taller', orden.id), {
      costoRepuestosUsados: Number(orden.costoRepuestosUsados || 0) + Number(repuesto.costoProveedor || 0),
      repuestosLista: arrayUnion({ nombre: repuesto.nombre, costo: Number(repuesto.costoProveedor || 0) }),
      historial: arrayUnion({ estado: orden.estado, fecha: new Date().toLocaleString(), comentario: `Repuesto instalado: ${repuesto.nombre}` })
    });
    alert(`🔩 Repuesto "${repuesto.nombre}" descontado del stock y vinculado a la orden #${orden.codigoSeguimiento}.`);
  };

  const actualizarEstado = async (id: string, nuevoEstado: string, orden: any) => {
    const comentario = prompt(`Diagnóstico / Comentario para estado '${nuevoEstado}':`) || `Actualizado por ${nombreNegocioActivo}`;
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };

    if (nuevoEstado === 'reparado') {
      if (!esSucursalExterna && orden.tallerOrigen && orden.tallerOrigen !== 'Mostrador Propio') {
        const costoAlLocal = prompt(`Esta orden es del local "${orden.tallerOrigen}".\nIngresa tu Costo Mayorista Gremio a cobrarle al local ($):`, orden.costoGremio || '');
        if (costoAlLocal !== null) data.costoGremio = costoAlLocal;
      }
      const costoCliente = prompt('Precio Final al Cliente del Ticket ($):', orden.costoReparacion || '');
      if (costoCliente !== null) data.costoReparacion = costoCliente;
    }

    if (nuevoEstado === 'entregado') {
      if (!esSucursalExterna && orden.tallerOrigen && orden.tallerOrigen !== 'Mostrador Propio') {
        const tallerColega = talleresGremio.find(t => t.nombre === orden.tallerOrigen || t.id === orden.tallerId);
        const montoCtaCte = Number(orden.costoGremio || orden.costoReparacion || 0);
        if (tallerColega && montoCtaCte > 0) {
          if (window.confirm(`¿Cargar el costo gremio de $${montoCtaCte} a la Cuenta Corriente del local "${tallerColega.nombre}"?`)) {
            await updateDoc(doc(db, 'talleres_gremio', tallerColega.id), {
              saldoDeudor: Number(tallerColega.saldoDeudor || 0) + montoCtaCte
            });
          }
        }
      } else {
        const saldoRestante = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
        if (saldoRestante > 0 && window.confirm(`¿Registrar cobro del saldo restante ($${saldoRestante}) en la Caja de ${nombreNegocioActivo}?`)) {
          const metodo = prompt('Método de pago (efectivo, transferencia, mercadopago, tarjeta):', 'efectivo') || 'efectivo';
          await addDoc(collection(db, 'finanzas'), {
            ownerId: tenantId,
            tipo: 'ingreso',
            concepto: `Cobro Orden #${orden.codigoSeguimiento} - ${orden.equipo?.marca} ${orden.equipo?.modelo}`,
            monto: saldoRestante,
            costoAsociado: esSucursalExterna ? Number(orden.costoGremio || 0) : Number(orden.costoRepuestosUsados || 0),
            metodoPago: metodo.toLowerCase(),
            fecha: serverTimestamp(),
            usuario: user.email
          });
        }
      }
    }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const notificarClienteWhatsApp = (orden: any) => {
    const urlBase = window.location.origin;
    const saldo = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    let msg = `Hola ${orden.cliente.nombre}, te escribimos de *${nombreNegocioActivo}*.\n`;
    msg += `Tu equipo *${orden.equipo.marca} ${orden.equipo.modelo}* (Orden #${orden.codigoSeguimiento}) cambió al estado: *${orden.estado.toUpperCase()}*.\n`;
    if (orden.historial?.length > 0) msg += `📝 *Informe:* ${orden.historial[orden.historial.length - 1].comentario}\n`;
    if (orden.costoReparacion) msg += `💰 *Total:* $${orden.costoReparacion} ${orden.seña ? `(Seña: $${orden.seña} \vert{} Saldo: $${saldo})` : ''}\n`;
    msg += `\n🔍 Seguimiento en vivo: ${urlBase}/seguimiento?codigo=${orden.codigoSeguimiento}`;
    window.open(`https://wa.me/549${orden.cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirOrdenProfesional = (orden: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    const localDeLaOrden = talleresGremio.find(t => t.id === orden.tallerId || t.nombre === orden.tallerOrigen);
    const tituloEmpresaTicket = localDeLaOrden ? localDeLaOrden.nombre : config.empresaNombre;
    const subtituloTicket = localDeLaOrden ? `Servicio Técnico & Accesorios (${localDeLaOrden.ciudad || ''})` : config.eslogan;
    const direccionTicket = localDeLaOrden ? (localDeLaOrden.direccion || localDeLaOrden.ciudad || '') : config.direccion;
    const whatsappTicket = localDeLaOrden ? localDeLaOrden.telefono : config.whatsapp;

    const urlSeguimiento = `${window.location.origin}/seguimiento?codigo=${orden.codigoSeguimiento}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(urlSeguimiento)}`;
    const fechaFormateada = orden.fechaIngreso ? new Date(orden.fechaIngreso.seconds * 1000).toLocaleString() : new Date().toLocaleString();
    const saldoPendiente = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    const itemsCheck = orden.equipo?.checklist || [];

    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden #${orden.codigoSeguimiento} - ${tituloEmpresaTicket}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 15px; background: #f0f2f5; }
            .toolbar { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; max-width: 820px; margin-left: auto; margin-right: auto; }
            .btn-print { background: #007aff; color: #fff; border: none; padding: 8px 18px; border-radius: 999px; font-weight: bold; cursor: pointer; }
            .btn-mode { background: #333; color: #fff; border: 1px solid #555; padding: 8px 14px; border-radius: 999px; cursor: pointer; margin-right: 6px; }
            .page-a4 { background: #fff; max-width: 820px; margin: 0 auto; padding: 25px; border: 1px solid #ccc; }
            .header-a4 { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 15px; }
            .brand-title { font-size: 24px; font-weight: 900; margin: 0; }
            .order-box { text-align: right; border: 2px solid #111; padding: 8px 14px; border-radius: 6px; background: #f8f9fa; }
            .order-code { font-size: 24px; font-weight: 900; font-family: monospace; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
            .panel { border: 1px solid #444; border-radius: 6px; padding: 10px 12px; }
            .panel-title { font-size: 11px; font-weight: 800; text-transform: uppercase; background: #111; color: #fff; padding: 4px 8px; margin: -10px -12px 8px -12px; }
            .row-data { font-size: 13px; margin: 4px 0; }
            .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; margin-top: 6px; }
            .box-mark { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 11px; font-size: 10px; font-weight: bold; }
            .fin-bar { display: flex; justify-content: space-between; background: #eee; border: 1px solid #333; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: bold; margin: 12px 0; }
            .legal-text { font-size: 9.5px; color: #333; text-align: justify; border: 1px dashed #777; padding: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 32px; }
            .sig-line { width: 42%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; font-weight: bold; }
            .cut-line { border-top: 2px dashed #000; margin: 22px 0; text-align: center; }
            .cut-line span { background: #fff; padding: 0 10px; position: relative; top: -10px; font-size: 11px; font-weight: bold; }
            .page-thermal { display: none; background: #fff; width: 310px; margin: 0 auto; padding: 15px; border: 1px solid #ccc; font-family: monospace; text-align: center; }
            @media print { body { background: #fff; padding: 0; } .toolbar { display: none !important; } .page-a4, .page-thermal { border: none; width: 100%; max-width: 100%; } }
          </style>
          <script>
            function cambiarFormato(modo) {
              document.getElementById('vista-a4').style.display = modo === 'a4' ? 'block' : 'none';
              document.getElementById('vista-thermal').style.display = modo === 'thermal' ? 'block' : 'none';
            }
          </script>
        </head>
        <body>
          <div class="toolbar">
            <div>
              <button class="btn-mode" onclick="cambiarFormato('a4')">📄 Hoja A4 Dual</button>
              <button class="btn-mode" onclick="cambiarFormato('thermal')">🧾 Ticket Térmico 80mm</button>
            </div>
            <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR</button>
          </div>
          <div id="vista-a4" class="page-a4">
            <div class="header-a4">
              <div>
                <h1 class="brand-title">${tituloEmpresaTicket}</h1>
                <div style="font-size:12px; font-weight:bold;">${subtituloTicket}</div>
                <div style="font-size:11px;">📍 ${direccionTicket} | WhatsApp: ${whatsappTicket}</div>
              </div>
              <div class="order-box">
                <div style="font-size:10px; font-weight:bold;">ORDEN DE SERVICIO</div>
                <div class="order-code">#${orden.codigoSeguimiento}</div>
                <div style="font-size:10px;">${fechaFormateada}</div>
              </div>
            </div>
            <div class="grid-2">
              <div class="panel">
                <div class="panel-title">👤 Datos del Cliente</div>
                <div class="row-data"><b>Nombre:</b> ${orden.cliente?.nombre}</div>
                <div class="row-data"><b>WhatsApp:</b> ${orden.cliente?.telefono}</div>
                <div class="row-data"><b>DNI:</b> ${orden.cliente?.dni || '-'}</div>
              </div>
              <div class="panel">
                <div class="panel-title">📱 Equipo Recibido</div>
                <div class="row-data"><b>Modelo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</div>
                <div class="row-data"><b>IMEI:</b> ${orden.equipo?.imei || 'S/D'}</div>
                <div class="row-data"><b>PIN / Patrón:</b> ${orden.equipo?.contrasena || 'Sin Clave'}</div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-title">🔬 Diagnóstico y Checklist</div>
              <div class="row-data"><b>Falla:</b> ${orden.fallaDeclarada} | <b>Estética:</b> ${orden.equipo?.condicionVisual || 'Normal'}</div>
              <div class="checklist-grid">
                ${CHECKLIST_ITEMS.map(it => `<div><span class="box-mark">${itemsCheck.includes(it) ? '✓' : ''}</span>${it}</div>`).join('')}
              </div>
            </div>
            <div class="fin-bar">
              <span>PRESUPUESTO: $${orden.costoReparacion || 'A evaluar'}</span>
              <span>SEÑA: $${orden.seña || 0}</span>
              <span>SALDO: $${orden.costoReparacion ? saldoPendiente : '-'}</span>
            </div>
            <div class="legal-text"><b>GARANTÍA (${config.garantiaDiasDefault} DÍAS):</b> ${config.ticketLeyenda}</div>
            <div class="signatures">
              <div class="sig-line">Firma Conformidad Cliente</div>
              <div class="sig-line">Recibió por ${tituloEmpresaTicket}</div>
            </div>
            <div class="cut-line"><span>✂️ TALÓN PARA EL CLIENTE ✂️</span></div>
            <div style="display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; border-radius: 8px; padding: 14px;">
              <div>
                <h3 style="margin: 0 0 4px 0;">${tituloEmpresaTicket} - TALÓN DE RETIRO</h3>
                <div style="font-size: 12px;">📍 ${direccionTicket} | 📱 WhatsApp: ${whatsappTicket}</div>
                <div style="font-size: 13px; margin-top: 4px;"><b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo} | <b>Falla:</b> ${orden.fallaDeclarada}</div>
                <div style="font-size: 14px; margin-top: 6px; font-weight: bold;">Total: $${orden.costoReparacion || 'A evaluar'} | Seña: $${orden.seña || 0} | Saldo: $${orden.costoReparacion ? saldoPendiente : '-'}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 20px; font-weight: 900; font-family: monospace;">#${orden.codigoSeguimiento}</div>
                <img src="${qrUrl}" style="width: 90px; height: 90px;" />
              </div>
            </div>
          </div>
          <div id="vista-thermal" class="page-thermal">
            <h2 style="margin:0;">${tituloEmpresaTicket}</h2>
            <div style="font-size: 11px;">${direccionTicket}<br/>Tel: ${whatsappTicket}</div>
            <hr/>
            <div style="font-size: 24px; font-weight: bold;">#${orden.codigoSeguimiento}</div>
            <div style="text-align: left; font-size: 12px;">
              <div><b>Cliente:</b> ${orden.cliente?.nombre}</div>
              <div><b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</div>
              <div><b>Falla:</b> ${orden.fallaDeclarada}</div>
              <div><b>Total:</b> $${orden.costoReparacion || 'A evaluar'} (Seña: $${orden.seña || 0})</div>
            </div>
            <img src="${qrUrl}" style="width: 115px; height: 115px; margin: 10px 0;" />
            <div style="font-size: 9px; text-align: justify;">${config.ticketLeyenda}</div>
          </div>
        </body>
      </html>
    `);
    v.document.close();
  };

  const ordenesFiltradas = misOrdenesTaller.filter(o => {
    if (filtroEstadoTaller !== 'todos' && o.estado !== filtroEstadoTaller) return false;
    if (!esSucursalExterna && filtroOrigenTaller !== 'todos' && o.tallerOrigen !== filtroOrigenTaller) return false;
    if (busquedaTaller) {
      const b = busquedaTaller.toLowerCase();
      const match = o.codigoSeguimiento?.toLowerCase().includes(b) ||
                    o.cliente?.nombre?.toLowerCase().includes(b) ||
                    o.tallerOrigen?.toLowerCase().includes(b) ||
                    o.equipo?.marca?.toLowerCase().includes(b) ||
                    o.equipo?.modelo?.toLowerCase().includes(b);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div>
      <form onSubmit={guardarOrden} className="neon-card" style={{ marginBottom: '22px' }}>
        <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
          {esSucursalExterna ? `📝 Ingreso y Gestión de Orden de Reparación (${nombreNegocioActivo})` : '📝 Recepción Central de Laboratorio (Control Absoluto)'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label className="label-neon">1. Sucursal & Cliente</label>
            {!esSucursalExterna ? (
              <select className="neon-select" value={tallerOrigenOrden} onChange={e => setTallerOrigenOrden(e.target.value)} style={{ marginBottom: '8px' }}>
                <option value="Mostrador Propio">🏪 Mostrador Central Walabba</option>
                {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Local Asociado: {t.nombre}</option>)}
              </select>
            ) : (
              <div className="neon-badge" style={{ background: 'rgba(88,86,214,0.15)', color: 'var(--neon-pink)', marginBottom: '8px', padding: '7px 12px' }}>
                🏢 Sucursal: {sucursalAsociada.nombre}
              </div>
            )}
            <input type="text" className="neon-input" placeholder="Nombre del Cliente" value={cliNombre} onChange={e => setCliNombre(e.target.value)} required style={{ marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="WhatsApp (2262...)" value={cliTel} onChange={e => setCliTel(e.target.value)} required />
              <input type="text" className="neon-input" placeholder="DNI" value={cliDni} onChange={e => setCliDni(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-neon">2. Equipo & Seguridad</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" className="neon-input" placeholder="Marca" value={marca} onChange={e => setMarca(e.target.value)} required />
              <input type="text" className="neon-input" placeholder="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="IMEI / Serie" value={imei} onChange={e => setImei(e.target.value)} />
              <input type="text" className="neon-input" placeholder="PIN / Patrón" value={contrasena} onChange={e => setContrasena(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-neon">3. Falla y Estado Estético</label>
            <input type="text" className="neon-input" placeholder="Falla a reparar" value={falla} onChange={e => setFalla(e.target.value)} required style={{ marginBottom: '8px' }} />
            <input type="text" className="neon-input" placeholder="Estética (Rayas, golpes)" value={condicionVisual} onChange={e => setCondicionVisual(e.target.value)} />
          </div>
          <div>
            <label className="label-neon">4. Importes & Seña</label>
            {!esSucursalExterna && (
              <select className="neon-select" value={tecnico} onChange={e => setTecnico(e.target.value)} style={{ marginBottom: '8px' }}>
                <option value="">Asignar Sector...</option>
                {listaSectores.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="number" className="neon-input" placeholder="Precio Cliente $" value={presupuestoInicial} onChange={e => setPresupuestoInicial(e.target.value)} />
              <input type="number" className="neon-input" placeholder="Seña $" value={señaRecibida} onChange={e => setSeñaRecibida(e.target.value)} />
            </div>
            {!esSucursalExterna && tallerOrigenOrden !== 'Mostrador Propio' && (
              <input type="number" className="neon-input" placeholder="Costo Gremio al Local $" value={costoGremioInicial} onChange={e => setCostoGremioInicial(e.target.value)} />
            )}
          </div>
        </div>

        <div style={{ background: 'var(--bg-input)', padding: '12px 15px', borderRadius: '14px', marginBottom: '14px' }}>
          <span className="label-neon">✅ Checklist de Recepción:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '6px' }}>
            {CHECKLIST_ITEMS.map(item => (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: checklist.includes(item) ? 700 : 400, color: checklist.includes(item) ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                <input type="checkbox" checked={checklist.includes(item)} onChange={() => toggleItemChecklist(item)} /> {item}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
          ➕ Generar Orden de Reparación
        </button>
      </form>

      <div className="neon-card" style={{ marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" className="neon-input" placeholder="🔍 Buscar por código, cliente, local o modelo..." value={busquedaTaller} onChange={e => setBusquedaTaller(e.target.value)} style={{ flex: '1 1 220px' }} />
        {!esSucursalExterna && (
          <select className="neon-select" value={filtroOrigenTaller} onChange={e => setFiltroOrigenTaller(e.target.value)} style={{ width: 'auto' }}>
            <option value="todos">🏢 Todos los Locales + Central</option>
            <option value="Mostrador Propio">🏪 Solo Mostrador Central</option>
            {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Local: {t.nombre}</option>)}
          </select>
        )}
        <select className="neon-select" value={filtroEstadoTaller} onChange={e => setFiltroEstadoTaller(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todos los Estados</option>
          <option value="ingresado">📥 Ingresado en Local</option>
          <option value="en revision">🔬 En Laboratorio Central</option>
          <option value="esperando repuesto">⏳ Esperando Repuesto</option>
          <option value="reparado">✅ Reparado / Listo</option>
          <option value="reingreso garantia">🔄 Garantía</option>
          <option value="entregado">📦 Entregado</option>
        </select>
      </div>

      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <table className="neon-table">
          <thead>
            <tr>
              <th>Orden / Local</th>
              <th>Cliente Final</th>
              <th>Equipo & Falla</th>
              <th>Gestión de Estado & Precios</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenesFiltradas.map(o => (
              <tr key={o.id} style={{ opacity: o.estado === 'entregado' ? 0.55 : 1 }}>
                <td>
                  <b className="glow-text-cyan" style={{ fontSize: '17px' }}>#{o.codigoSeguimiento}</b><br />
                  <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)', marginTop: '4px' }}>
                    {o.tallerOrigen || 'Central'}
                  </span>
                </td>
                <td><b>{o.cliente?.nombre}</b><br /><span className="glow-text-green" style={{ fontSize: '14px' }}>📱 {o.cliente?.telefono}</span></td>
                <td>
                  <b>{o.equipo?.marca} {o.equipo?.modelo}</b> {o.equipo?.contrasena && <span className="neon-badge" style={{ background: 'rgba(255,149,0,0.15)', color: 'var(--neon-yellow)' }}>🔑 {o.equipo.contrasena}</span>}<br />
                  <span className="glow-text-red">Falla: {o.fallaDeclarada}</span>
                  {o.repuestosLista?.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--neon-green)', marginTop: '3px' }}>
                      🔩 Repuestos: {o.repuestosLista.map((r: any) => r.nombre).join(', ')}
                    </div>
                  )}
                </td>
                <td>
                  <select className="neon-select" value={o.estado} onChange={e => actualizarEstado(o.id, e.target.value, o)} style={{ padding: '8px' }}>
                    <option value="ingresado">📥 Ingresado</option>
                    <option value="en revision">🔬 En Revisión Laboratorio</option>
                    <option value="esperando repuesto">⏳ Esperando Repuesto</option>
                    <option value="reparado">✅ Reparado y Listo</option>
                    <option value="reingreso garantia">🔄 Garantía</option>
                    <option value="sin solucion">❌ Sin Solución</option>
                    <option value="entregado">📦 Entregado</option>
                  </select>
                  <div style={{ fontSize: '13px', marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="glow-text-green">Público: ${o.costoReparacion || 'S/P'}</span>
                    {o.costoGremio && <span className="glow-text-pink" style={{ fontWeight: 'bold' }}>Gremio: ${o.costoGremio}</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => imputarRepuestoAOrden(o)} className="neon-btn neon-btn-purple" title="Descontar repuesto de mi stock">🔩</button>
                    <button onClick={() => notificarClienteWhatsApp(o)} className="neon-btn neon-btn-green" title="Avisar por WhatsApp">💬</button>
                    <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir Orden A4 Dual / Térmica">🖨️</button>
                    {esAdminDelNegocioActivo && (
                      <button onClick={async () => { if (window.confirm('¿Eliminar orden?')) await deleteDoc(doc(db, 'ordenes_taller', o.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};