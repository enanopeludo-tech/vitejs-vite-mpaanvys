// src/modulos/ModuloTaller.tsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CHECKLIST_ITEMS, aplicarRedondeo } from '../estilosTema';

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
  // --- ESTADOS DE EDICIÓN DE ORDEN ---
  const [idOrdenEditando, setIdOrdenEditando] = useState<string | null>(null);
  const [codigoOrdenEditando, setCodigoOrdenEditando] = useState<string>('');
  const [senaOriginalEditando, setSenaOriginalEditando] = useState<number>(0);
  const omitirRecalculoAlCargarRef = useRef<boolean>(false);

  // --- ESTADOS DATOS DEL CLIENTE Y EQUIPO ---
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
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería OK"]);

  // --- MOTOR DE COTIZACIÓN USD + COMISIONISTA + MEDIO DE PAGO + REPARTIDOR ---
  const [costoRepuestoUsd, setCostoRepuestoUsd] = useState('');
  const [manoDeObraExtra, setManoDeObraExtra] = useState('0');
  const [comisionistaElegido, setComisionistaElegido] = useState('4500');
  const [modalidadEntrega, setModalidadEntrega] = useState<'retira_local' | 'cadete_incluido' | 'cadete_a_cargo_cliente'>('retira_local');
  const [modalidadPagoOrden, setModalidadPagoOrden] = useState<'efectivo' | 'transferencia' | 'tarjeta_1' | 'tarjeta_3' | 'tarjeta_6'>('efectivo');
  
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [costoGremioInicial, setCostoGremioInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [senaRequeridaSugerida, setSenaRequeridaSugerida] = useState(0);
  const [alertaTopeGremio, setAlertaTopeGremio] = useState(false);

  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroOrigenTaller, setFiltroOrigenTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');

  const listaSectores = (config.sectoresTaller || "Microelectrónica, Módulos, Software").split(',').map((s: string) => s.trim());
  
  const opcionesComisionistas = (config.comisionistasLista || "Comisionista Mar del Plata:4500, Comisionista CABA:7500, Sin Flete:0")
    .split(',')
    .map((item: string) => {
      const partes = item.split(':');
      return { nombre: partes[0]?.trim() || 'Comisionista', costo: Number(partes[1]) || 0 };
    });

  const calcularPresupuestoOperativo = () => {
    const usd = Number(costoRepuestoUsd);
    if (!usd || usd <= 0) return;

    const dolarHoy = Number(config.cotizacionDolar || 1200);
    const esOrdenDeGremio = esSucursalExterna || tallerOrigenOrden !== 'Mostrador Propio';

    let margenPublico = Number(config.escala3MargenPublico || 35);
    let margenGremio = Number(config.escala3MargenGremio || 20);

    if (usd <= Number(config.escala1MaxUsd || 30)) {
      margenPublico = Number(config.escala1MargenPublico || 80);
      margenGremio = Number(config.escala1MargenGremio || 45);
    } else if (usd <= Number(config.escala2MaxUsd || 80)) {
      margenPublico = Number(config.escala2MargenPublico || 55);
      margenGremio = Number(config.escala2MargenGremio || 30);
    }

    const fleteOrigen = Number(comisionistaElegido || 0);
    const manoObra = Number(manoDeObraExtra || 0);
    const cadeteLocal = modalidadEntrega === 'cadete_incluido' ? Number(config.repartidorLocalCosto || 2000) : 0;

    const repuestoPublicoArs = (usd * (1 + margenPublico / 100)) * dolarHoy;
    const repuestoGremioArs = (usd * (1 + margenGremio / 100)) * dolarHoy;

    const baseListaPublico = repuestoPublicoArs + fleteOrigen + manoObra + cadeteLocal;
    const baseListaGremio = repuestoGremioArs + fleteOrigen + manoObra + cadeteLocal;

    let factorPago = 1;
    if (modalidadPagoOrden === 'efectivo') {
      factorPago = 1 - (Number(config.descuentoEfectivoPorcentaje || 10) / 100);
    } else if (modalidadPagoOrden === 'tarjeta_1') {
      factorPago = 1 + (Number(config.recargoTarjeta1Pago || config.recargoTarjetaPorcentaje || 15) / 100);
    } else if (modalidadPagoOrden === 'tarjeta_3') {
      factorPago = 1 + (Number(config.recargoTarjeta3Cuotas || 28) / 100);
    } else if (modalidadPagoOrden === 'tarjeta_6') {
      factorPago = 1 + (Number(config.recargoTarjeta6Cuotas || 45) / 100);
    }

    const finalPublicoRedondeado = aplicarRedondeo(baseListaPublico * factorPago, config.redondeoPrecios);
    const finalGremioRedondeado = aplicarRedondeo(baseListaGremio * factorPago, config.redondeoPrecios);

    setPresupuestoInicial(finalPublicoRedondeado.toString());
    setCostoGremioInicial(finalGremioRedondeado.toString());

    const topeUsdGremio = Number(config.topeUsdSinSenaGremio || 70);
    if (!esOrdenDeGremio) {
      const cincuentaPorciento = aplicarRedondeo(finalPublicoRedondeado * 0.5, config.redondeoPrecios);
      setSenaRequeridaSugerida(cincuentaPorciento);
      if (!idOrdenEditando) {
        setSeñaRecibida(cincuentaPorciento.toString());
      }
      setAlertaTopeGremio(false);
    } else {
      if (usd >= topeUsdGremio) {
        const cincuentaGremio = aplicarRedondeo(finalGremioRedondeado * 0.5, config.redondeoPrecios);
        setSenaRequeridaSugerida(cincuentaGremio);
        if (!idOrdenEditando) {
          setSeñaRecibida(cincuentaGremio.toString());
        }
        setAlertaTopeGremio(true);
      } else {
        setSenaRequeridaSugerida(0);
        if (!idOrdenEditando) {
          setSeñaRecibida('0');
        }
        setAlertaTopeGremio(false);
      }
    }
  };

  useEffect(() => {
    if (omitirRecalculoAlCargarRef.current) {
      omitirRecalculoAlCargarRef.current = false;
      return;
    }
    if (Number(costoRepuestoUsd) > 0) {
      calcularPresupuestoOperativo();
    }
  }, [costoRepuestoUsd, manoDeObraExtra, comisionistaElegido, modalidadEntrega, modalidadPagoOrden, tallerOrigenOrden]);

  const toggleItemChecklist = (item: string) => {
    setChecklist(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const limpiarFormularioOrden = () => {
    setIdOrdenEditando(null);
    setCodigoOrdenEditando('');
    setSenaOriginalEditando(0);
    setCliNombre('');
    setCliTel('');
    setCliDni('');
    setTallerOrigenOrden('Mostrador Propio');
    setMarca('');
    setModelo('');
    setFalla('');
    setTecnico('');
    setImei('');
    setContrasena('');
    setCondicionVisual('');
    setChecklist(["Enciende", "Batería OK"]);
    setCostoRepuestoUsd('');
    setManoDeObraExtra('0');
    setPresupuestoInicial('');
    setCostoGremioInicial('');
    setSeñaRecibida('');
    setSenaRequeridaSugerida(0);
    setAlertaTopeGremio(false);
  };

  // --- CARGAR ORDEN EN EL FORMULARIO PARA EDITAR ---
  const cargarOrdenParaEditar = (orden: any) => {
    omitirRecalculoAlCargarRef.current = true;
    setIdOrdenEditando(orden.id);
    setCodigoOrdenEditando(orden.codigoSeguimiento || '');
    setSenaOriginalEditando(Number(orden.seña || 0));

    setCliNombre(orden.cliente?.nombre || '');
    setCliTel(orden.cliente?.telefono || '');
    setCliDni(orden.cliente?.dni || '');
    setTallerOrigenOrden(orden.tallerOrigen || 'Mostrador Propio');

    setMarca(orden.equipo?.marca || '');
    setModelo(orden.equipo?.modelo || '');
    setImei(orden.equipo?.imei || '');
    setContrasena(orden.equipo?.contrasena || '');
    setCondicionVisual(orden.equipo?.condicionVisual || '');
    setChecklist(Array.isArray(orden.equipo?.checklist) ? orden.equipo.checklist : []);

    setFalla(orden.fallaDeclarada || '');
    setTecnico(orden.tecnicoAsignado || '');

    setCostoRepuestoUsd(orden.costoRepuestoUsd ? String(orden.costoRepuestoUsd) : '');
    setManoDeObraExtra(orden.manoDeObraExtra ? String(orden.manoDeObraExtra) : '0');
    setComisionistaElegido(orden.fleteComisionista !== undefined ? String(orden.fleteComisionista) : '4500');
    setModalidadEntrega(orden.modalidadEntrega || 'retira_local');
    setModalidadPagoOrden(orden.modalidadPago || 'efectivo');

    setPresupuestoInicial(orden.costoReparacion !== undefined ? String(orden.costoReparacion) : '');
    setCostoGremioInicial(orden.costoGremio !== undefined ? String(orden.costoGremio) : '');
    setSeñaRecibida(orden.seña !== undefined ? String(orden.seña) : '0');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- GUARDAR NUEVA ORDEN O ACTUALIZAR ORDEN EDITADA ---
  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const origenFinal = esSucursalExterna ? sucursalAsociada.nombre : tallerOrigenOrden;
    const idSucursalFinal = esSucursalExterna 
      ? sucursalAsociada.id 
      : (talleresGremio.find(t => t.nombre === tallerOrigenOrden)?.id || 'MASTER');

    // MODO EDICIÓN DE ORDEN EXISTENTE
    if (idOrdenEditando) {
      const nuevaSenaNum = Number(señaRecibida) || 0;
      const diferenciaSena = nuevaSenaNum - senaOriginalEditando;

      await updateDoc(doc(db, 'ordenes_taller', idOrdenEditando), {
        tallerId: idSucursalFinal,
        tallerOrigen: origenFinal,
        cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni },
        equipo: { marca, modelo, imei, contrasena, condicionVisual, checklist },
        fallaDeclarada: falla,
        tecnicoAsignado: esSucursalExterna ? 'Laboratorio Central Walabba' : tecnico,
        costoRepuestoUsd: Number(costoRepuestoUsd) || 0,
        manoDeObraExtra: Number(manoDeObraExtra) || 0,
        fleteComisionista: Number(comisionistaElegido) || 0,
        modalidadPago: modalidadPagoOrden,
        modalidadEntrega: modalidadEntrega,
        costoReparacion: presupuestoInicial || '',
        costoGremio: esSucursalExterna ? '' : (costoGremioInicial || ''),
        seña: nuevaSenaNum,
        historial: arrayUnion({
          estado: 'editado',
          fecha: new Date().toLocaleString(),
          comentario: `Orden editada por ${user.email} | Total: $${presupuestoInicial || 0} | Seña: $${nuevaSenaNum}`
        })
      });

      if (diferenciaSena > 0) {
        const registrarDiferencia = window.confirm(
          `💵 La seña aumentó en $${diferenciaSena.toLocaleString()} (Antes: $${senaOriginalEditando.toLocaleString()} ➔ Ahora: $${nuevaSenaNum.toLocaleString()}).\n\n¿Deseas registrar este ingreso de $${diferenciaSena.toLocaleString()} en la Caja ahora?`
        );
        if (registrarDiferencia) {
          await addDoc(collection(db, 'finanzas'), {
            ownerId: tenantId,
            tipo: 'ingreso',
            concepto: `Ampliación Seña Orden #${codigoOrdenEditando} - ${cliNombre} (${marca} ${modelo})`,
            monto: diferenciaSena,
            metodoPago: modalidadPagoOrden.startsWith('tarjeta') ? 'tarjeta' : modalidadPagoOrden,
            fecha: serverTimestamp(),
            usuario: user.email
          });
        }
      }

      alert(`✅ Orden #${codigoOrdenEditando} actualizada correctamente.`);
      limpiarFormularioOrden();
      return;
    }

    // MODO ALTA DE ORDEN NUEVA
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const estadoInicial = (senaRequeridaSugerida > 0 && Number(señaRecibida) < senaRequeridaSugerida)
      ? 'esperando sena 50%'
      : 'ingresado';

    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: idSucursalFinal,
      tallerOrigen: origenFinal,
      cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni },
      equipo: { marca, modelo, imei, contrasena, condicionVisual, checklist },
      fallaDeclarada: falla,
      tecnicoAsignado: esSucursalExterna ? 'Laboratorio Central Walabba' : tecnico,
      costoRepuestoUsd: Number(costoRepuestoUsd) || 0,
      manoDeObraExtra: Number(manoDeObraExtra) || 0,
      fleteComisionista: Number(comisionistaElegido) || 0,
      modalidadPago: modalidadPagoOrden,
      modalidadEntrega: modalidadEntrega,
      costoReparacion: presupuestoInicial || '',
      costoGremio: esSucursalExterna ? '' : (costoGremioInicial || ''),
      costoRepuestosUsados: 0,
      repuestosLista: [],
      seña: Number(señaRecibida) || 0,
      estado: estadoInicial,
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ 
        estado: estadoInicial, 
        fecha: new Date().toLocaleString(), 
        comentario: `Recepcionado en ${origenFinal} | Pago: ${modalidadPagoOrden.toUpperCase()} | Seña abonada: $${señaRecibida || 0}` 
      }]
    });

    if (Number(señaRecibida) > 0) {
      await addDoc(collection(db, 'finanzas'), {
        ownerId: tenantId,
        tipo: 'ingreso',
        concepto: `Adelanto 50% Orden #${cod} - ${cliNombre} (${marca} ${modelo})`,
        monto: Number(señaRecibida),
        metodoPago: modalidadPagoOrden.startsWith('tarjeta') ? 'tarjeta' : modalidadPagoOrden,
        fecha: serverTimestamp(),
        usuario: user.email
      });
    }

    limpiarFormularioOrden();
    alert(`⚡ Orden #${cod} generada (${estadoInicial.toUpperCase()}).`);
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
    alert(`🔩 Repuesto "${repuesto.nombre}" descontado del stock.`);
  };

  const actualizarEstado = async (id: string, nuevoEstado: string, orden: any) => {
    const totalOrden = Number(orden.costoReparacion || 0);
    const senaActual = Number(orden.seña || 0);
    const saldoPendiente = Math.max(0, totalOrden - senaActual);

    if (orden.estado === 'esperando sena 50%' && nuevoEstado !== 'esperando sena 50%' && senaActual === 0 && totalOrden > 0) {
      const montoSena = Number(prompt(`⚠️ Para iniciar la gestión se requiere el 50% de adelanto ($${Math.round(totalOrden * 0.5)}).\nIngresa el monto de seña recibido ($):`, Math.round(totalOrden * 0.5).toString()));
      if (montoSena > 0) {
        await updateDoc(doc(db, 'ordenes_taller', id), { seña: montoSena });
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'ingreso',
          concepto: `Cobro Seña 50% Orden #${orden.codigoSeguimiento} - ${orden.cliente?.nombre}`,
          monto: montoSena,
          metodoPago: 'efectivo',
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }

    const comentario = prompt(`Diagnóstico / Comentario para estado '${nuevoEstado}':`) || `Actualizado por ${nombreNegocioActivo}`;
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };

    if (nuevoEstado === 'reparado') {
      if (!esSucursalExterna && orden.tallerOrigen && orden.tallerOrigen !== 'Mostrador Propio') {
        const costoAlLocal = prompt(`Orden del local "${orden.tallerOrigen}".\nConfirma el Costo Gremio ($):`, orden.costoGremio || '');
        if (costoAlLocal !== null) data.costoGremio = costoAlLocal;
      }
      const costoCliente = prompt('Confirma el Precio Total al Cliente ($):', orden.costoReparacion || '');
      if (costoCliente !== null) data.costoReparacion = costoCliente;
    }

    if (nuevoEstado === 'entregado') {
      if (!esSucursalExterna && orden.tallerOrigen && orden.tallerOrigen !== 'Mostrador Propio') {
        const tallerColega = talleresGremio.find(t => t.nombre === orden.tallerOrigen || t.id === orden.tallerId);
        const montoCtaCte = Math.max(0, Number(orden.costoGremio || orden.costoReparacion || 0) - senaActual);
        if (tallerColega && montoCtaCte > 0) {
          if (window.confirm(`¿Cargar el saldo gremio restante de $${montoCtaCte.toLocaleString()} a la Cuenta Corriente del local "${tallerColega.nombre}"?`)) {
            await updateDoc(doc(db, 'talleres_gremio', tallerColega.id), {
              saldoDeudor: Number(tallerColega.saldoDeudor || 0) + montoCtaCte
            });
            data.seña = Number(orden.costoGremio || orden.costoReparacion || 0);
          }
        }
      } else if (saldoPendiente > 0) {
        const confirmarCobroFinal = window.confirm(
          `🔒 CONTROL DE ENTREGA:\nAntes de retirar/enviar el equipo, el cliente debe abonar el 50% restante ($${saldoPendiente.toLocaleString()}).\n\n¿Confirmar cobro de $${saldoPendiente.toLocaleString()} e imputarlo en Caja ahora?`
        );
        if (!confirmarCobroFinal) {
          return alert('⛔ Entrega pausada: El equipo no puede marcarse como Entregado hasta saldar el 50% restante.');
        }
        const metodo = prompt('Método de pago del saldo final (efectivo, transferencia, mercadopago, tarjeta):', orden.modalidadPago || 'efectivo') || 'efectivo';
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'ingreso',
          concepto: `Cancelación 50% Final Orden #${orden.codigoSeguimiento} - ${orden.equipo?.marca} ${orden.equipo?.modelo}`,
          monto: saldoPendiente,
          costoAsociado: esSucursalExterna ? Number(orden.costoGremio || 0) : Number(orden.costoRepuestosUsados || 0),
          metodoPago: metodo.toLowerCase(),
          fecha: serverTimestamp(),
          usuario: user.email
        });
        data.seña = totalOrden;
      }
    }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const notificarClienteWhatsApp = (orden: any) => {
    const urlBase = window.location.origin;
    const total = Number(orden.costoReparacion || 0);
    const sena = Number(orden.seña || 0);
    const saldo = Math.max(0, total - sena);

    let textoLogistica = `📍 *Retiro:* Podés pasar a retirarlo por nuestro local (${config.direccion}).`;
    if (orden.modalidadEntrega === 'cadete_incluido') {
      textoLogistica = `🛵 *Envío a domicilio:* El costo del repartidor ya está incluido en tu presupuesto. Coordinamos por acá la franja horaria.`;
    } else if (orden.modalidadEntrega === 'cadete_a_cargo_cliente') {
      textoLogistica = `🛵 *Opciones de entrega:* Podés retirar por el local o te lo enviamos con repartidor (costo de envío $${config.repartidorLocalCosto || 2000} a abonar al cadete al recibir).`;
    }

    let msg = `Hola *${orden.cliente.nombre}*, te escribimos de *${nombreNegocioActivo}*.\n`;
    msg += `Tu equipo *${orden.equipo.marca} ${orden.equipo.modelo}* (Orden *#${orden.codigoSeguimiento}*) se encuentra en estado: *${orden.estado.toUpperCase()}*.\n\n`;
    
    if (total > 0) {
      msg += `💰 *DETALLE DE PAGO (${(orden.modalidadPago || 'efectivo').toUpperCase()}):*\n`;
      msg += `▪️ Presupuesto Total: $${total.toLocaleString()}\n`;
      msg += `▪️ Adelanto entregado: -$${sena.toLocaleString()}\n`;
      msg += `📌 *Saldo a abonar previo a la entrega: $${saldo.toLocaleString()}*\n\n`;
    }
    
    msg += `${textoLogistica}\n`;
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
            .fin-bar { display: flex; justify-content: space-between; background: #eee; border: 1px solid #333; padding: 8px 14px; border-radius: 6px; font-size: 13.5px; font-weight: bold; margin: 12px 0; }
            .legal-text { font-size: 9.5px; color: #333; text-align: justify; border: 1px dashed #777; padding: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 32px; }
            .sig-line { width: 42%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; font-weight: bold; }
            .cut-line { border-top: 2px dashed #000; margin: 22px 0; text-align: center; }
            .cut-line span { background: #fff; padding: 0 10px; position: relative; top: -10px; font-size: 11px; font-weight: bold; }
            @media print { body { background: #fff; padding: 0; } .toolbar { display: none !important; } .page-a4 { border: none; width: 100%; max-width: 100%; } }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <span>Vista Previa de Orden</span>
            <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR ORDEN</button>
          </div>
          <div class="page-a4">
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
                <div class="row-data"><b>Modalidad Pago / Entrega:</b> ${(orden.modalidadPago || 'efectivo').toUpperCase()} / ${(orden.modalidadEntrega || 'retira_local').replace(/_/g, ' ').toUpperCase()}</div>
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
                ${CHECKLIST_ITEMS.map(it => `<div><span class="box-mark">${itemsCheck.includes(it) ? '✓' : ''}</span> ${it}</div>`).join('')}
              </div>
            </div>
            <div class="fin-bar">
              <span>TOTAL (${(orden.modalidadPago || 'EFVO').toUpperCase()}): $${orden.costoReparacion || 'A evaluar'}</span>
              <span>ADELANTO (50%): $${orden.seña || 0}</span>
              <span>SALDO PREVIO A ENTREGA: $${orden.costoReparacion ? saldoPendiente : '-'}</span>
            </div>
            <div class="legal-text"><b>GARANTÍA (${config.garantiaDiasDefault} DÍAS) Y CONDICIÓN DE ENTREGA:</b> El saldo restante del 50% debe estar íntegramente abonado antes del retiro o envío del equipo. ${config.ticketLeyenda}</div>
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
                <div style="font-size: 13.5px; margin-top: 6px; font-weight: bold;">
                  Total (${(orden.modalidadPago || 'Efvo').toUpperCase()}): $${orden.costoReparacion || 'A evaluar'} | Seña: $${orden.seña || 0} | Saldo a cancelar: $${orden.costoReparacion ? saldoPendiente : '-'}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 20px; font-weight: 900; font-family: monospace;">#${orden.codigoSeguimiento}</div>
                <img src="${qrUrl}" style="width: 90px; height: 90px;" />
              </div>
            </div>
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
      <form 
        onSubmit={guardarOrden} 
        className={`neon-card ${idOrdenEditando ? 'neon-card-yellow' : ''}`} 
        style={{ marginBottom: '22px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className={idOrdenEditando ? 'glow-text-yellow' : 'glow-text-cyan'} style={{ margin: 0 }}>
            {idOrdenEditando 
              ? `✏️ Editando Orden de Reparación #${codigoOrdenEditando}` 
              : esSucursalExterna 
                ? `📝 Ingreso de Orden de Reparación (${nombreNegocioActivo})` 
                : '📝 Recepción Central + Calculadora Operativa (USD / Comisionista / Cuotas / 50% Seña)'}
          </h3>
          {idOrdenEditando && (
            <button type="button" onClick={limpiarFormularioOrden} className="neon-btn neon-btn-red">
              ❌ Cancelar Edición
            </button>
          )}
        </div>

        <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(0,122,255,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span className="label-neon" style={{ color: 'var(--neon-cyan)', margin: 0 }}>
              🧮 Cotizador Instantáneo (Dólar Hoy: ${config.cotizacionDolar} | Calcula Escala + Comisionista + Medio de Pago + 50% Seña)
            </span>
            {alertaTopeGremio && (
              <span className="neon-badge" style={{ background: 'rgba(255,59,48,0.18)', color: 'var(--neon-red)' }}>
                ⚠️ Repuesto supera USD {config.topeUsdSinSenaGremio}: Requiere 50% de adelanto al Gremio
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
            <div>
              <label className="label-neon">1. Costo Lista Prov. (USD)</label>
              <input 
                type="number" 
                step="0.5"
                className="neon-input" 
                placeholder="Ej: 45 (en USD)" 
                value={costoRepuestoUsd} 
                onChange={e => setCostoRepuestoUsd(e.target.value)} 
              />
            </div>
            <div>
              <label className="label-neon">2. Comisionista / Flete</label>
              <select className="neon-select" value={comisionistaElegido} onChange={e => setComisionistaElegido(e.target.value)}>
                {opcionesComisionistas.map((c: any, i: number) => (
                  <option key={i} value={c.costo}>{c.nombre} (${c.costo})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-neon">3. Mano Obra Extra ($)</label>
              <input 
                type="number" 
                className="neon-input" 
                placeholder="Adicional $" 
                value={manoDeObraExtra} 
                onChange={e => setManoDeObraExtra(e.target.value)} 
              />
            </div>
            <div>
              <label className="label-neon">4. Entrega / Repartidor</label>
              <select className="neon-select" value={modalidadEntrega} onChange={e => setModalidadEntrega(e.target.value as any)}>
                <option value="retira_local">📍 Retira por el Local ($0)</option>
                <option value="cadete_incluido">🛵 Repartidor Incluido (+${config.repartidorLocalCosto || 2000})</option>
                <option value="cadete_a_cargo_cliente">🛵 Repartidor a cargo del Cliente</option>
              </select>
            </div>
            <div>
              <label className="label-neon" style={{ color: 'var(--neon-green)' }}>5. Modalidad de Pago Cliente</label>
              <select className="neon-select" value={modalidadPagoOrden} onChange={e => setModalidadPagoOrden(e.target.value as any)} style={{ fontWeight: 'bold' }}>
                <option value="efectivo">💵 Efectivo (-{config.descuentoEfectivoPorcentaje}%)</option>
                <option value="transferencia">🏦 Transferencia (Lista)</option>
                <option value="tarjeta_1">💳 Tarjeta 1 Pago (+{config.recargoTarjeta1Pago || 15}%)</option>
                <option value="tarjeta_3">💳 Tarjeta 3 Cuotas (+{config.recargoTarjeta3Cuotas || 28}%)</option>
                <option value="tarjeta_6">💳 Tarjeta 6 Cuotas (+{config.recargoTarjeta6Cuotas || 45}%)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label className="label-neon">1. Origen & Cliente</label>
            {!esSucursalExterna ? (
              <select className="neon-select" value={tallerOrigenOrden} onChange={e => setTallerOrigenOrden(e.target.value)} style={{ marginBottom: '8px' }}>
                <option value="Mostrador Propio">🏪 Cliente Local Central (Pide 50% Seña)</option>
                {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Proveedor/Gremio: {t.nombre}</option>)}
              </select>
            ) : (
              <div className="neon-badge" style={{ background: 'rgba(88,86,214,0.15)', color: 'var(--neon-pink)', marginBottom: '8px', padding: '7px 12px' }}>
                🏢 Sucursal: {sucursalAsociada.nombre}
              </div>
            )}
            <input type="text" className="neon-input" placeholder="Nombre del Cliente *" value={cliNombre} onChange={e => setCliNombre(e.target.value)} required style={{ marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="WhatsApp (2262...) *" value={cliTel} onChange={e => setCliTel(e.target.value)} required />
              <input type="text" className="neon-input" placeholder="DNI" value={cliDni} onChange={e => setCliDni(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-neon">2. Equipo & Seguridad</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" className="neon-input" placeholder="Marca *" value={marca} onChange={e => setMarca(e.target.value)} required />
              <input type="text" className="neon-input" placeholder="Modelo *" value={modelo} onChange={e => setModelo(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="neon-input" placeholder="IMEI / Serie" value={imei} onChange={e => setImei(e.target.value)} />
              <input type="text" className="neon-input" placeholder="PIN / Patrón" value={contrasena} onChange={e => setContrasena(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-neon">3. Falla y Estado Estético</label>
            <input type="text" className="neon-input" placeholder="Falla a reparar *" value={falla} onChange={e => setFalla(e.target.value)} required style={{ marginBottom: '8px' }} />
            <input type="text" className="neon-input" placeholder="Estética (Rayas, golpes)" value={condicionVisual} onChange={e => setCondicionVisual(e.target.value)} />
          </div>

          <div>
            <label className="label-neon">4. Total Final y Adelanto 50%</label>
            {!esSucursalExterna && (
              <select className="neon-select" value={tecnico} onChange={e => setTecnico(e.target.value)} style={{ marginBottom: '8px' }}>
                <option value="">Asignar Sector...</option>
                {listaSectores.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <small style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL CLIENTE ($)</small>
                <input type="number" className="neon-input" placeholder="Total $" value={presupuestoInicial} onChange={e => setPresupuestoInicial(e.target.value)} style={{ fontWeight: 'bold' }} />
              </div>
              <div style={{ flex: 1 }}>
                <small style={{ fontSize: '10px', color: 'var(--neon-green)' }}>SEÑA 50% RECIBIDA ($)</small>
                <input type="number" className="neon-input" placeholder="Adelanto $" value={señaRecibida} onChange={e => setSeñaRecibida(e.target.value)} style={{ borderColor: 'var(--neon-green)', fontWeight: 'bold' }} />
              </div>
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

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '14px' }}>
            {idOrdenEditando 
              ? `💾 Guardar Cambios en Orden #${codigoOrdenEditando}` 
              : `➕ Generar Orden de Reparación ${Number(señaRecibida) > 0 ? `(Con Adelanto de $${Number(señaRecibida).toLocaleString()})` : ''}`}
          </button>
          {idOrdenEditando && (
            <button type="button" onClick={limpiarFormularioOrden} className="neon-btn neon-btn-red" style={{ padding: '14px 22px' }}>
              Cancelar
            </button>
          )}
        </div>
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
          <option value="esperando sena 50%">⏳ Esperando Seña 50%</option>
          <option value="ingresado">📥 Ingresado / Señado</option>
          <option value="repuesto en viaje comisionista">🚚 Repuesto en Comisionista</option>
          <option value="en revision">🔬 En Banco de Trabajo</option>
          <option value="reparado">✅ Reparado / Listo para Retiro o Envío</option>
          <option value="reingreso garantia">🔄 Garantía</option>
          <option value="entregado">📦 Entregado (100% Abonado)</option>
        </select>
      </div>

      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <table className="neon-table">
          <thead>
            <tr>
              <th>Orden / Origen</th>
              <th>Cliente & Entrega</th>
              <th>Equipo & Falla</th>
              <th>Estado, Seña 50% y Saldo</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenesFiltradas.map(o => {
              const saldoRestante = Math.max(0, Number(o.costoReparacion || 0) - Number(o.seña || 0));
              const estaEditandoEsta = idOrdenEditando === o.id;
              return (
                <tr key={o.id} style={{ opacity: o.estado === 'entregado' ? 0.55 : 1, background: estaEditandoEsta ? 'rgba(255,149,0,0.1)' : 'transparent' }}>
                  <td>
                    <b className="glow-text-cyan" style={{ fontSize: '17px' }}>#{o.codigoSeguimiento}</b><br />
                    <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)', marginTop: '4px' }}>
                      {o.tallerOrigen || 'Central'}
                    </span>
                  </td>
                  <td>
                    <b>{o.cliente?.nombre}</b><br />
                    <span className="glow-text-green" style={{ fontSize: '14px' }}>📱 {o.cliente?.telefono}</span><br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      {o.modalidadEntrega === 'cadete_incluido' ? '🛵 Repartidor Incluido' : o.modalidadEntrega === 'cadete_a_cargo_cliente' ? '🛵 Repartidor a cargo Cliente' : '📍 Retira en Local'}
                    </small>
                  </td>
                  <td>
                    <b>{o.equipo?.marca} {o.equipo?.modelo}</b> {o.equipo?.contrasena && <span className="neon-badge" style={{ background: 'rgba(255,149,0,0.15)', color: 'var(--neon-yellow)' }}>🔑 {o.equipo.contrasena}</span>}<br />
                    <span className="glow-text-red">Falla: {o.fallaDeclarada}</span><br />
                    <small style={{ color: 'var(--text-muted)' }}>Pago: {(o.modalidadPago || 'efectivo').toUpperCase()}</small>
                  </td>
                  <td>
                    <select className="neon-select" value={o.estado} onChange={e => actualizarEstado(o.id, e.target.value, o)} style={{ padding: '8px' }}>
                      <option value="esperando sena 50%">⏳ Esperando Seña 50%</option>
                      <option value="ingresado">📥 Ingresado (Seña OK)</option>
                      <option value="repuesto en viaje comisionista">🚚 Repuesto con Comisionista</option>
                      <option value="en revision">🔬 En Reparación</option>
                      <option value="reparado">✅ Reparado y Listo</option>
                      <option value="reingreso garantia">🔄 Garantía</option>
                      <option value="sin solucion">❌ Sin Solución</option>
                      <option value="entregado">📦 Entregado (Saldado)</option>
                    </select>
                    <div style={{ fontSize: '12.5px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span>Total: <b>${Number(o.costoReparacion || 0).toLocaleString()}</b></span>
                      <span className="glow-text-green">Seña: ${Number(o.seña || 0).toLocaleString()}</span>
                      <span className={saldoRestante > 0 ? 'glow-text-red' : 'glow-text-green'} style={{ fontWeight: 'bold' }}>
                        Resta: ${saldoRestante.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => cargarOrdenParaEditar(o)} className="neon-btn" title="Editar todos los datos de la Orden">✏️</button>
                      <button onClick={() => imputarRepuestoAOrden(o)} className="neon-btn neon-btn-purple" title="Descontar repuesto de mi stock">🔩</button>
                      <button onClick={() => notificarClienteWhatsApp(o)} className="neon-btn neon-btn-green" title="Avisar por WhatsApp con saldo y envío">💬</button>
                      <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir Orden">🖨️</button>
                      {esAdminDelNegocioActivo && (
                        <button onClick={async () => { if (window.confirm('¿Eliminar orden?')) await deleteDoc(doc(db, 'ordenes_taller', o.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// --- FIN DEL ARCHIVO MODULOTALLER.TSX ---