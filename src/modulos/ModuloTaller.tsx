// src/modulos/ModuloTaller.tsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, arrayUnion, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
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
  
  // --- ESTADO PATRÓN DE DESBLOQUEO INTERACTIVO 3x3 (NODOS 1 AL 9) ---
  const [patronNodos, setPatronNodos] = useState<number[]>([]);

  const [condicionVisual, setCondicionVisual] = useState('');
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería OK"]);

  // --- BUSCADOR RÁPIDO DE REPUESTOS EN PROVEEDORES PARA LA CALCULADORA ---
  const [busquedaRepuestoCalc, setBusquedaRepuestoCalc] = useState('');

  // --- MOTOR DE COTIZACIÓN USD + COMISIONISTA + MEDIO DE PAGO + REPARTIDOR ---
  const [costoRepuestoUsd, setCostoRepuestoUsd] = useState('');
  const [manoDeObraExtra, setManoDeObraExtra] = useState('0');
  const [comisionistaElegido, setComisionistaElegido] = useState('4500');
  const [modalidadEntrega, setModalidadEntrega] = useState<'retira_local' | 'cadete_incluido' | 'cadete_a_cargo_cliente'>('retira_local');
  const [modalidadPagoOrden, setModalidadPagoOrden] = useState<'efectivo' | 'transferencia' | 'mercadopago' | 'tarjeta_1' | 'tarjeta_3' | 'tarjeta_6'>('efectivo');
  
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [costoGremioInicial, setCostoGremioInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [senaRequeridaSugerida, setSenaRequeridaSugerida] = useState(0);
  const [alertaTopeGremio, setAlertaTopeGremio] = useState(false);

  // --- FILTROS DE TABLA Y MODALES (BITÁCORA + COBRO MERCADO PAGO) ---
  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroOrigenTaller, setFiltroOrigenTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');
  const [ordenDetalleModal, setOrdenDetalleModal] = useState<any | null>(null);
  const [ordenCobroMpModal, setOrdenCobroMpModal] = useState<any | null>(null);
  const [montoCobrarMpInput, setMontoCobrarMpInput] = useState<string>('');

  const listaSectores = (config.sectoresTaller || "Microelectrónica, Módulos, Software").split(',').map((s: string) => s.trim());
  
  const opcionesComisionistas = (config.comisionistasLista || "Comisionista Mar del Plata:4500, Comisionista CABA:7500, Sin Flete:0")
    .split(',')
    .map((item: string) => {
      const partes = item.split(':');
      return { nombre: partes[0]?.trim() || 'Comisionista', costo: Number(partes[1]) || 0 };
    });

  // --- MANEJO DEL PATRÓN 3x3 INTERACTIVO ---
  const tocarNodoPatron3x3 = (nodo: number) => {
    setPatronNodos(prev => {
      if (prev.includes(nodo)) {
        const idx = prev.indexOf(nodo);
        return prev.slice(0, idx);
      }
      return [...prev, nodo];
    });
  };

  const patronComoTexto = patronNodos.join('-');

  // Filtrar catálogo de proveedores para autocompletar la calculadora USD
  const sugerenciasRepuestosProv = busquedaRepuestoCalc.trim().length >= 2
    ? misProductos
        .filter(p => (p.esDeProveedor || p.descripcion === 'Importado de lista') && p.nombre.toLowerCase().includes(busquedaRepuestoCalc.toLowerCase()))
        .slice(0, 6)
    : [];

  const seleccionarRepuestoParaCalculadora = (prod: any) => {
    const dolarHoy = Number(config.cotizacionDolar || 1200);
    const costoBaseArs = Number(prod.costoProveedor || prod.precio || 0);
    const usdEstimado = Math.max(1, Math.round((costoBaseArs / dolarHoy) * 10) / 10);
    setCostoRepuestoUsd(usdEstimado.toString());
    if (!falla) setFalla('Cambio de ' + prod.nombre);
    setBusquedaRepuestoCalc('');
  };

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
    } else if (modalidadPagoOrden === 'mercadopago') {
      factorPago = 1 + (Number(config.mpRecargoPorcentaje || 0) / 100);
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
    setPatronNodos([]);
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

    // Cargar patrón 3x3 guardado
    const patronGuardado = orden.equipo?.patron3x3 || '';
    if (patronGuardado) {
      const nodosParseados = String(patronGuardado)
        .split('-')
        .map(n => Number(n))
        .filter(n => n >= 1 && n <= 9);
      setPatronNodos(nodosParseados);
    } else {
      setPatronNodos([]);
    }

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

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const origenFinal = esSucursalExterna ? sucursalAsociada.nombre : tallerOrigenOrden;
    const idSucursalFinal = esSucursalExterna 
      ? sucursalAsociada.id 
      : (talleresGremio.find(t => t.nombre === tallerOrigenOrden)?.id || 'MASTER');

    const objetoEquipo = {
      marca,
      modelo,
      imei,
      contrasena,
      patron3x3: patronComoTexto,
      condicionVisual,
      checklist
    };

    if (idOrdenEditando) {
      const nuevaSenaNum = Number(señaRecibida) || 0;
      const diferenciaSena = nuevaSenaNum - senaOriginalEditando;

      await updateDoc(doc(db, 'ordenes_taller', idOrdenEditando), {
        tallerId: idSucursalFinal,
        tallerOrigen: origenFinal,
        cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni },
        equipo: objetoEquipo,
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
          comentario: 'Orden editada por ' + user.email + ' | Total: $' + (presupuestoInicial || 0) + ' | Seña: $' + nuevaSenaNum
        })
      });

      if (diferenciaSena > 0) {
        const registrarDiferencia = window.confirm(
          '💵 La seña aumentó en $' + diferenciaSena.toLocaleString() + ' (Antes: $' + senaOriginalEditando.toLocaleString() + ' ➔ Ahora: $' + nuevaSenaNum.toLocaleString() + ').\n\n¿Deseas registrar este ingreso de $' + diferenciaSena.toLocaleString() + ' en la Caja ahora?'
        );
        if (registrarDiferencia) {
          await addDoc(collection(db, 'finanzas'), {
            ownerId: tenantId,
            tipo: 'ingreso',
            concepto: 'Ampliación Seña Orden #' + codigoOrdenEditando + ' - ' + cliNombre + ' (' + marca + ' ' + modelo + ')',
            monto: diferenciaSena,
            metodoPago: modalidadPagoOrden.startsWith('tarjeta') ? 'tarjeta' : modalidadPagoOrden,
            fecha: serverTimestamp(),
            usuario: user.email
          });
        }
      }

      alert('✅ Orden #' + codigoOrdenEditando + ' actualizada correctamente.');
      limpiarFormularioOrden();
      return;
    }

    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const estadoInicial = (senaRequeridaSugerida > 0 && Number(señaRecibida) < senaRequeridaSugerida)
      ? 'esperando sena 50%'
      : 'ingresado';

    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: idSucursalFinal,
      tallerOrigen: origenFinal,
      cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni },
      equipo: objetoEquipo,
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
        comentario: 'Recepcionado en ' + origenFinal + ' | Pago: ' + modalidadPagoOrden.toUpperCase() + ' | Seña abonada: $' + (señaRecibida || 0) 
      }]
    });

    try {
      const telLimpio = cliTel.replace(/\D/g, '');
      if (telLimpio.length >= 6) {
        const snapCrm = await getDocs(query(collection(db, 'clientes_crm'), where('telefono', '==', cliTel)));
        if (snapCrm.empty) {
          await addDoc(collection(db, 'clientes_crm'), {
            ownerId: tenantId,
            nombre: cliNombre,
            telefono: cliTel,
            dni: cliDni,
            ultimoEquipo: marca + ' ' + modelo,
            origen: 'Taller',
            fechaAlta: new Date().toLocaleDateString(),
            fechaTimestamp: serverTimestamp()
          });
        }
      }
    } catch {
      // Continuar normalmente
    }

    if (Number(señaRecibida) > 0) {
      await addDoc(collection(db, 'finanzas'), {
        ownerId: tenantId,
        tipo: 'ingreso',
        concepto: 'Adelanto 50% Orden #' + cod + ' - ' + cliNombre + ' (' + marca + ' ' + modelo + ')',
        monto: Number(señaRecibida),
        metodoPago: modalidadPagoOrden.startsWith('tarjeta') ? 'tarjeta' : modalidadPagoOrden,
        fecha: serverTimestamp(),
        usuario: user.email
      });
    }

    limpiarFormularioOrden();
    alert('⚡ Orden #' + cod + ' generada (' + estadoInicial.toUpperCase() + ').');
  };

  // --- ABRIR MODAL DE COBRO CON MERCADO PAGO ---
  const abrirModalMercadoPago = (orden: any) => {
    const total = Number(orden.costoReparacion || 0);
    const sena = Number(orden.seña || 0);
    const saldoRestante = Math.max(0, total - sena);
    const sugerido = sena === 0 && total > 0 ? Math.round(total * 0.5) : saldoRestante;
    setOrdenCobroMpModal(orden);
    setMontoCobrarMpInput(String(sugerido || 0));
  };

  const acreditarCobroMercadoPagoEnOrden = async () => {
    if (!ordenCobroMpModal) return;
    const montoNum = Number(montoCobrarMpInput);
    if (!montoNum || montoNum <= 0) return alert('Ingresa un monto válido a acreditar.');

    const nuevaSenaTotal = Number(ordenCobroMpModal.seña || 0) + montoNum;
    const totalRep = Number(ordenCobroMpModal.costoReparacion || 0);
    const nuevoEstado = ordenCobroMpModal.estado === 'esperando sena 50%' ? 'ingresado' : ordenCobroMpModal.estado;

    await updateDoc(doc(db, 'ordenes_taller', ordenCobroMpModal.id), {
      seña: nuevaSenaTotal,
      estado: nuevoEstado,
      modalidadPago: 'mercadopago',
      historial: arrayUnion({
        estado: nuevoEstado,
        fecha: new Date().toLocaleString(),
        comentario: 'Pago acreditado por Mercado Pago: $' + montoNum.toLocaleString() + ' (Total abonado: $' + nuevaSenaTotal.toLocaleString() + ' de $' + totalRep.toLocaleString() + ')'
      })
    });

    await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId,
      tipo: 'ingreso',
      concepto: 'Cobro Mercado Pago Orden #' + ordenCobroMpModal.codigoSeguimiento + ' - ' + (ordenCobroMpModal.cliente?.nombre || 'Cliente'),
      monto: montoNum,
      metodoPago: 'mercadopago',
      fecha: serverTimestamp(),
      usuario: user.email
    });

    alert('✅ Pago de $' + montoNum.toLocaleString() + ' por Mercado Pago acreditado en la Orden #' + ordenCobroMpModal.codigoSeguimiento + ' y asentado en Finanzas.');
    setOrdenCobroMpModal(null);
  };

  const enviarLinkMercadoPagoWhatsApp = (orden: any, montoCobrar: number) => {
    const linkMp = config.linkMercadoPago || 'https://link.mercadopago.com.ar/walabbatecno';
    let msg = 'Hola *' + (orden.cliente?.nombre || 'Cliente') + '*, te enviamos el link y datos de *Mercado Pago* de *' + nombreNegocioActivo + '* para abonar la Orden *#' + orden.codigoSeguimiento + '* (*' + (orden.equipo?.marca || '') + ' ' + (orden.equipo?.modelo || '') + '*):\n\n';
    msg += '💰 *Importe a abonar:* $' + Number(montoCobrar || 0).toLocaleString() + '\n';
    msg += '🔗 *Link de Pago Mercado Pago:* ' + linkMp + '\n';
    if (config.aliasTransferencia) {
      msg += '🏦 *Alias MP Directo:* ' + config.aliasTransferencia + ' (' + config.bancoTitular + ')\n';
    }
    msg += '\nPor favor envianos el comprobante por acá apenas se acredite. ¡Gracias!';
    const tel = (orden.cliente?.telefono || '').replace(/\D/g, '');
    window.open('https://wa.me/549' + tel + '?text=' + encodeURIComponent(msg), '_blank');
  };

  const imputarRepuestoAOrden = async (orden: any) => {
    const busquedaRep = prompt('Escribe parte del nombre del repuesto usado (Ej: A52, Pin, Modulo):');
    if (!busquedaRep) return;
    const candidatos = misProductos.filter(p => p.nombre.toLowerCase().includes(busquedaRep.toLowerCase()));
    if (candidatos.length === 0) return alert('No se encontraron repuestos en tu catálogo con ese nombre.');

    const listaOpciones = candidatos.slice(0, 10).map((c, idx) => (idx + 1) + '. ' + c.nombre + ' (Stock: ' + (c.stock || 0) + ' | Costo: $' + (c.costoProveedor || c.precio || 0) + ')').join('\n');
    const eleccion = prompt('Selecciona el número del repuesto a imputar en la orden:\n\n' + listaOpciones);
    const indexElegido = Number(eleccion) - 1;
    if (isNaN(indexElegido) || !candidatos[indexElegido]) return;

    const repuesto = candidatos[indexElegido];
    if (Number(repuesto.stock || 0) > 0) {
      await updateDoc(doc(db, 'productos', repuesto.id), { stock: Math.max(0, Number(repuesto.stock) - 1) });
    }
    const costoImputado = Number(repuesto.costoProveedor || repuesto.precio || 0);
    await updateDoc(doc(db, 'ordenes_taller', orden.id), {
      costoRepuestosUsados: Number(orden.costoRepuestosUsados || 0) + costoImputado,
      repuestosLista: arrayUnion({ nombre: repuesto.nombre, costo: costoImputado }),
      historial: arrayUnion({ estado: orden.estado, fecha: new Date().toLocaleString(), comentario: 'Repuesto instalado: ' + repuesto.nombre + ' ($' + costoImputado + ')' })
    });
    alert('🔩 Repuesto "' + repuesto.nombre + '" imputado a la orden #' + orden.codigoSeguimiento + '.');
  };

  const actualizarEstado = async (id: string, nuevoEstado: string, orden: any) => {
    const totalOrden = Number(orden.costoReparacion || 0);
    const senaActual = Number(orden.seña || 0);
    const saldoPendiente = Math.max(0, totalOrden - senaActual);

    if (orden.estado === 'esperando sena 50%' && nuevoEstado !== 'esperando sena 50%' && senaActual === 0 && totalOrden > 0) {
      const montoSena = Number(prompt('⚠️ Para iniciar la gestión se requiere el 50% de adelanto ($' + Math.round(totalOrden * 0.5) + ').\nIngresa el monto de seña recibido ($):', Math.round(totalOrden * 0.5).toString()));
      if (montoSena > 0) {
        await updateDoc(doc(db, 'ordenes_taller', id), { seña: montoSena });
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'ingreso',
          concepto: 'Cobro Seña 50% Orden #' + orden.codigoSeguimiento + ' - ' + orden.cliente?.nombre,
          monto: montoSena,
          metodoPago: 'efectivo',
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }

    const comentario = prompt("Diagnóstico / Comentario para estado '" + nuevoEstado + "':") || ('Actualizado por ' + nombreNegocioActivo);
    const data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };

    if (nuevoEstado === 'reparado') {
      if (!esSucursalExterna && orden.tallerOrigen && orden.tallerOrigen !== 'Mostrador Propio') {
        const costoAlLocal = prompt('Orden del local "' + orden.tallerOrigen + '".\nConfirma el Costo Gremio ($):', orden.costoGremio || '');
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
          if (window.confirm('¿Cargar el saldo gremio restante de $' + montoCtaCte.toLocaleString() + ' a la Cuenta Corriente del local "' + tallerColega.nombre + '"?')) {
            await updateDoc(doc(db, 'talleres_gremio', tallerColega.id), {
              saldoDeudor: Number(tallerColega.saldoDeudor || 0) + montoCtaCte
            });
            data.seña = Number(orden.costoGremio || orden.costoReparacion || 0);
          }
        }
      } else if (saldoPendiente > 0) {
        const confirmarCobroFinal = window.confirm(
          '🔒 CONTROL DE ENTREGA:\nAntes de retirar/enviar el equipo, el cliente debe abonar el 50% restante ($' + saldoPendiente.toLocaleString() + ').\n\n¿Confirmar cobro de $' + saldoPendiente.toLocaleString() + ' e imputarlo en Caja ahora?'
        );
        if (!confirmarCobroFinal) {
          return alert('⛔ Entrega pausada: El equipo no puede marcarse como Entregado hasta saldar el 50% restante.');
        }
        const metodo = prompt('Método de pago del saldo final (efectivo, transferencia, mercadopago, tarjeta):', orden.modalidadPago || 'efectivo') || 'efectivo';
        await addDoc(collection(db, 'finanzas'), {
          ownerId: tenantId,
          tipo: 'ingreso',
          concepto: 'Cancelación 50% Final Orden #' + orden.codigoSeguimiento + ' - ' + (orden.equipo?.marca || '') + ' ' + (orden.equipo?.modelo || ''),
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

    let textoLogistica = '📍 *Retiro:* Podés pasar a retirarlo por nuestro local (' + config.direccion + ').';
    if (orden.modalidadEntrega === 'cadete_incluido') {
      textoLogistica = '🛵 *Envío a domicilio:* El costo del repartidor ya está incluido en tu presupuesto. Coordinamos por acá la franja horaria.';
    } else if (orden.modalidadEntrega === 'cadete_a_cargo_cliente') {
      textoLogistica = '🛵 *Opciones de entrega:* Podés retirar por el local o te lo enviamos con repartidor (costo de envío $' + (config.repartidorLocalCosto || 2000) + ' a abonar al cadete al recibir).';
    }

    let msg = 'Hola *' + orden.cliente.nombre + '*, te escribimos de *' + nombreNegocioActivo + '*.\n';
    msg += 'Tu equipo *' + orden.equipo.marca + ' ' + orden.equipo.modelo + '* (Orden *#' + orden.codigoSeguimiento + '*) se encuentra en estado: *' + orden.estado.toUpperCase() + '*.\n\n';
    
    if (total > 0) {
      msg += '💰 *DETALLE DE PAGO (' + (orden.modalidadPago || 'efectivo').toUpperCase() + '):*\n';
      msg += '▪️ Presupuesto Total: $' + total.toLocaleString() + '\n';
      msg += '▪️ Adelanto entregado: -$' + sena.toLocaleString() + '\n';
      msg += '📌 *Saldo a abonar previo a la entrega: $' + saldo.toLocaleString() + '*\n';
      if (config.linkMercadoPago) {
        msg += '💠 *Link Mercado Pago:* ' + config.linkMercadoPago + '\n';
      }
      msg += '\n';
    }
    
    msg += textoLogistica + '\n';
    msg += '\n🔍 Seguimiento en vivo: ' + urlBase + '/seguimiento?codigo=' + orden.codigoSeguimiento;
    window.open('https://wa.me/549' + orden.cliente.telefono.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), '_blank');
  };

  // --- IMPRIMIR ORDEN A4 CON GRÁFICO DE PATRÓN 3x3 ---
  const imprimirOrdenProfesional = (orden: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
    const localDeLaOrden = talleresGremio.find(t => t.id === orden.tallerId || t.nombre === orden.tallerOrigen);
    const tituloEmpresaTicket = localDeLaOrden ? localDeLaOrden.nombre : config.empresaNombre;
    const subtituloTicket = localDeLaOrden ? ('Servicio Técnico & Accesorios (' + (localDeLaOrden.ciudad || '') + ')') : config.eslogan;
    const direccionTicket = localDeLaOrden ? (localDeLaOrden.direccion || localDeLaOrden.ciudad || '') : config.direccion;
    const whatsappTicket = localDeLaOrden ? localDeLaOrden.telefono : config.whatsapp;

    const urlSeguimiento = window.location.origin + '/seguimiento?codigo=' + orden.codigoSeguimiento;
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=' + encodeURIComponent(urlSeguimiento);
    const fechaFormateada = orden.fechaIngreso ? new Date(orden.fechaIngreso.seconds * 1000).toLocaleString() : new Date().toLocaleString();
    const saldoPendiente = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    const itemsCheck = orden.equipo?.checklist || [];
    const patronGuardado = String(orden.equipo?.patron3x3 || '');
    const nodosPatron = patronGuardado ? patronGuardado.split('-').map(n => Number(n)) : [];

    // Construir celdas visuales del patrón 3x3 para la impresión
    const celdasPatronHtml = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
      const ordenPaso = nodosPatron.indexOf(num) + 1;
      const activo = ordenPaso > 0;
      return (
        '<div style="width:22px; height:22px; border:1.5px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; background:' + (activo ? '#111' : '#fff') + '; color:' + (activo ? '#fff' : '#888') + ';">' +
          (activo ? ordenPaso : '•') +
        '</div>'
      );
    }).join('');

    const htmlOrden = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<title>Orden #' + orden.codigoSeguimiento + ' - ' + tituloEmpresaTicket + '</title>',
      '<style>',
      '* { box-sizing: border-box; }',
      'body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 15px; background: #f0f2f5; }',
      '.toolbar { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; max-width: 820px; margin-left: auto; margin-right: auto; }',
      '.btn-print { background: #007aff; color: #fff; border: none; padding: 8px 18px; border-radius: 999px; font-weight: bold; cursor: pointer; }',
      '.page-a4 { background: #fff; max-width: 820px; margin: 0 auto; padding: 25px; border: 1px solid #ccc; }',
      '.header-a4 { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 15px; }',
      '.brand-title { font-size: 24px; font-weight: 900; margin: 0; }',
      '.order-box { text-align: right; border: 2px solid #111; padding: 8px 14px; border-radius: 6px; background: #f8f9fa; }',
      '.order-code { font-size: 24px; font-weight: 900; font-family: monospace; }',
      '.grid-2 { display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px; margin-bottom: 12px; }',
      '.panel { border: 1px solid #444; border-radius: 6px; padding: 10px 12px; }',
      '.panel-title { font-size: 11px; font-weight: 800; text-transform: uppercase; background: #111; color: #fff; padding: 4px 8px; margin: -10px -12px 8px -12px; }',
      '.row-data { font-size: 13px; margin: 4px 0; }',
      '.checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; margin-top: 6px; }',
      '.box-mark { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 11px; font-size: 10px; font-weight: bold; }',
      '.fin-bar { display: flex; justify-content: space-between; background: #eee; border: 1px solid #333; padding: 8px 14px; border-radius: 6px; font-size: 13.5px; font-weight: bold; margin: 12px 0; }',
      '.legal-text { font-size: 9.5px; color: #333; text-align: justify; border: 1px dashed #777; padding: 8px; }',
      '.signatures { display: flex; justify-content: space-between; margin-top: 32px; }',
      '.sig-line { width: 42%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; font-weight: bold; }',
      '.cut-line { border-top: 2px dashed #000; margin: 22px 0; text-align: center; }',
      '.cut-line span { background: #fff; padding: 0 10px; position: relative; top: -10px; font-size: 11px; font-weight: bold; }',
      '@media print { body { background: #fff; padding: 0; } .toolbar { display: none !important; } .page-a4 { border: none; width: 100%; max-width: 100%; } }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="toolbar">',
      '<span>Vista Previa de Orden (Con Patrón 3x3)</span>',
      '<button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR ORDEN</button>',
      '</div>',
      '<div class="page-a4">',
      '<div class="header-a4">',
      '<div>',
      '<h1 class="brand-title">' + tituloEmpresaTicket + '</h1>',
      '<div style="font-size:12px; font-weight:bold;">' + subtituloTicket + '</div>',
      '<div style="font-size:11px;">📍 ' + direccionTicket + ' | WhatsApp: ' + whatsappTicket + '</div>',
      '</div>',
      '<div class="order-box">',
      '<div style="font-size:10px; font-weight:bold;">ORDEN DE SERVICIO</div>',
      '<div class="order-code">#' + orden.codigoSeguimiento + '</div>',
      '<div style="font-size:10px;">' + fechaFormateada + '</div>',
      '</div>',
      '</div>',
      '<div class="grid-2">',
      '<div class="panel">',
      '<div class="panel-title">👤 Datos del Cliente</div>',
      '<div class="row-data"><b>Nombre:</b> ' + (orden.cliente?.nombre || '-') + '</div>',
      '<div class="row-data"><b>WhatsApp:</b> ' + (orden.cliente?.telefono || '-') + '</div>',
      '<div class="row-data"><b>Pago / Entrega:</b> ' + (orden.modalidadPago || 'efectivo').toUpperCase() + ' / ' + (orden.modalidadEntrega || 'retira_local').replace(/_/g, ' ').toUpperCase() + '</div>',
      '</div>',
      '<div class="panel" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">',
      '<div style="flex:1;">',
      '<div class="panel-title">📱 Equipo y Desbloqueo</div>',
      '<div class="row-data"><b>Modelo:</b> ' + (orden.equipo?.marca || '') + ' ' + (orden.equipo?.modelo || '') + '</div>',
      '<div class="row-data"><b>IMEI:</b> ' + (orden.equipo?.imei || 'S/D') + '</div>',
      '<div class="row-data"><b>PIN / Clave:</b> ' + (orden.equipo?.contrasena || 'Sin PIN') + '</div>',
      '<div class="row-data"><b>Secuencia Patrón:</b> ' + (patronGuardado || 'Sin Patrón') + '</div>',
      '</div>',
      '<div style="text-align:center; border:1px solid #ccc; padding:6px; border-radius:6px; background:#fafafa;">',
      '<div style="font-size:9px; font-weight:bold; margin-bottom:4px;">PATRÓN 3x3</div>',
      '<div style="display:grid; grid-template-columns:repeat(3, 22px); gap:5px;">' + celdasPatronHtml + '</div>',
      '</div>',
      '</div>',
      '</div>',
      '<div class="panel">',
      '<div class="panel-title">🔬 Diagnóstico y Checklist</div>',
      '<div class="row-data"><b>Falla:</b> ' + orden.fallaDeclarada + ' | <b>Estética:</b> ' + (orden.equipo?.condicionVisual || 'Normal') + '</div>',
      '<div class="checklist-grid">',
      CHECKLIST_ITEMS.map(it => '<div><span class="box-mark">' + (itemsCheck.includes(it) ? '✓' : '') + '</span> ' + it + '</div>').join(''),
      '</div>',
      '</div>',
      '<div class="fin-bar">',
      '<span>TOTAL (' + (orden.modalidadPago || 'EFVO').toUpperCase() + '): $' + (orden.costoReparacion || 'A evaluar') + '</span>',
      '<span>ADELANTO (50%): $' + (orden.seña || 0) + '</span>',
      '<span>SALDO PREVIO A ENTREGA: $' + (orden.costoReparacion ? saldoPendiente : '-') + '</span>',
      '</div>',
      '<div class="legal-text"><b>GARANTÍA (' + config.garantiaDiasDefault + ' DÍAS) Y CONDICIÓN DE ENTREGA:</b> El saldo restante del 50% debe estar íntegramente abonado antes del retiro o envío del equipo. ' + config.ticketLeyenda + '</div>',
      '<div class="signatures">',
      '<div class="sig-line">Firma Conformidad Cliente</div>',
      '<div class="sig-line">Recibió por ' + tituloEmpresaTicket + '</div>',
      '</div>',
      '<div class="cut-line"><span>✂️ TALÓN PARA EL CLIENTE ✂️</span></div>',
      '<div style="display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; border-radius: 8px; padding: 14px;">',
      '<div>',
      '<h3 style="margin: 0 0 4px 0;">' + tituloEmpresaTicket + ' - TALÓN DE RETIRO</h3>',
      '<div style="font-size: 12px;">📍 ' + direccionTicket + ' | 📱 WhatsApp: ' + whatsappTicket + '</div>',
      '<div style="font-size: 13px; margin-top: 4px;"><b>Equipo:</b> ' + (orden.equipo?.marca || '') + ' ' + (orden.equipo?.modelo || '') + ' | <b>Falla:</b> ' + orden.fallaDeclarada + '</div>',
      '<div style="font-size: 13.5px; margin-top: 6px; font-weight: bold;">',
      'Total (' + (orden.modalidadPago || 'Efvo').toUpperCase() + '): $' + (orden.costoReparacion || 'A evaluar') + ' | Seña: $' + (orden.seña || 0) + ' | Saldo a cancelar: $' + (orden.costoReparacion ? saldoPendiente : '-'),
      '</div>',
      '</div>',
      '<div style="text-align: center;">',
      '<div style="font-size: 20px; font-weight: 900; font-family: monospace;">#' + orden.codigoSeguimiento + '</div>',
      '<img src="' + qrUrl + '" style="width: 90px; height: 90px;" />',
      '</div>',
      '</div>',
      '</div>',
      '</body>',
      '</html>'
    ].join('\n');

    v.document.write(htmlOrden);
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

  const linkMpActivo = config.linkMercadoPago || 'https://link.mercadopago.com.ar/walabbatecno';
  const qrMercadoPagoUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=' + encodeURIComponent(linkMpActivo);

  return (
    <div>
      {/* MODAL DE COBRO CON MERCADO PAGO (QR + LINK + WHATSAPP + IMPUTACIÓN EN CAJA) */}
      {ordenCobroMpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '480px', textAlign: 'center', border: '2px solid #009ee3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#009ee3' }}>
                💠 Cobro con Mercado Pago — Orden #{ordenCobroMpModal.codigoSeguimiento}
              </h3>
              <button onClick={() => setOrdenCobroMpModal(null)} className="neon-btn neon-btn-red" style={{ padding: '4px 12px' }}>✕</button>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
              Cliente: <b>{ordenCobroMpModal.cliente?.nombre}</b> | Equipo: <b>{ordenCobroMpModal.equipo?.marca} {ordenCobroMpModal.equipo?.modelo}</b>
            </p>

            <div style={{ background: '#fff', padding: '14px', borderRadius: '16px', display: 'inline-block', marginBottom: '12px', border: '2px solid #009ee3' }}>
              <img src={qrMercadoPagoUrl} alt="QR Mercado Pago" style={{ width: '185px', height: '185px', display: 'block' }} />
              <small style={{ color: '#009ee3', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                Escaneá con la App de Mercado Pago
              </small>
            </div>

            {config.aliasTransferencia && (
              <div style={{ fontSize: '13px', marginBottom: '12px', background: 'var(--bg-input)', padding: '8px', borderRadius: '10px' }}>
                🏦 Alias Oficial MP: <b className="glow-text-cyan">{config.aliasTransferencia}</b> ({config.bancoTitular})
              </div>
            )}

            <div style={{ textAlign: 'left', marginBottom: '14px' }}>
              <label className="label-neon">Importe a Cobrar / Acreditar ahora ($)</label>
              <input 
                type="number" 
                className="neon-input" 
                value={montoCobrarMpInput} 
                onChange={e => setMontoCobrarMpInput(e.target.value)} 
                style={{ fontWeight: 'bold', fontSize: '18px', textAlign: 'center', borderColor: '#009ee3' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <a 
                href={linkMpActivo} 
                target="_blank" 
                rel="noreferrer" 
                className="neon-btn" 
                style={{ flex: 1, textDecoration: 'none', borderColor: '#009ee3', color: '#009ee3' }}
              >
                🔗 Abrir Checkout MP
              </a>
              <button 
                type="button" 
                onClick={() => enviarLinkMercadoPagoWhatsApp(ordenCobroMpModal, Number(montoCobrarMpInput))} 
                className="neon-btn neon-btn-green" 
                style={{ flex: 1 }}
              >
                💬 Enviar Link por WA
              </button>
            </div>

            <button 
              type="button" 
              onClick={acreditarCobroMercadoPagoEnOrden} 
              className="neon-btn neon-btn-fillCyan" 
              style={{ width: '100%', padding: '13px', fontSize: '15px' }}
            >
              ✅ Confirmar y Acreditar Pago MP en Caja (${Number(montoCobrarMpInput || 0).toLocaleString()})
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE BITÁCORA Y REPUESTOS USADOS */}
      {ordenDetalleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="glow-text-cyan" style={{ margin: 0 }}>
                📋 Bitácora Técnica — Orden #{ordenDetalleModal.codigoSeguimiento}
              </h3>
              <button onClick={() => setOrdenDetalleModal(null)} className="neon-btn neon-btn-red" style={{ padding: '4px 12px' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              <b>Equipo:</b> {ordenDetalleModal.equipo?.marca} {ordenDetalleModal.equipo?.modelo} | <b>Cliente:</b> {ordenDetalleModal.cliente?.nombre}
            </p>
            {(ordenDetalleModal.equipo?.patron3x3 || ordenDetalleModal.equipo?.contrasena) && (
              <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', marginBottom: '12px' }}>
                {ordenDetalleModal.equipo?.patron3x3 && (
                  <div>🔢 <b>Patrón 3x3:</b> <span className="glow-text-cyan">{ordenDetalleModal.equipo.patron3x3}</span></div>
                )}
                {ordenDetalleModal.equipo?.contrasena && (
                  <div>🔑 <b>PIN / Clave:</b> <span className="glow-text-yellow">{ordenDetalleModal.equipo.contrasena}</span></div>
                )}
              </div>
            )}
            {Array.isArray(ordenDetalleModal.repuestosLista) && ordenDetalleModal.repuestosLista.length > 0 && (
              <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', marginBottom: '14px' }}>
                <b className="glow-text-pink" style={{ fontSize: '13px' }}>🔩 Repuestos Imputados (Costo Total: ${Number(ordenDetalleModal.costoRepuestosUsados || 0).toLocaleString()}):</b>
                {ordenDetalleModal.repuestosLista.map((r: any, idx: number) => (
                  <div key={idx} style={{ fontSize: '13px', marginTop: '4px' }}>
                    • {r.nombre} (${Number(r.costo || 0).toLocaleString()})
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(ordenDetalleModal.historial || []).map((h: any, i: number) => (
                <div key={i}>
                  <b className="glow-text-cyan" style={{ textTransform: 'uppercase', fontSize: '12px' }}>{h.estado}</b>
                  <div style={{ fontSize: '14px' }}>{h.comentario}</div>
                  <small style={{ color: 'var(--text-muted)' }}>🕒 {h.fecha}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <form 
        onSubmit={guardarOrden} 
        className={'neon-card ' + (idOrdenEditando ? 'neon-card-yellow' : '')} 
        style={{ marginBottom: '22px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className={idOrdenEditando ? 'glow-text-yellow' : 'glow-text-cyan'} style={{ margin: 0 }}>
            {idOrdenEditando 
              ? '✏️ Editando Orden de Reparación #' + codigoOrdenEditando 
              : esSucursalExterna 
                ? '📝 Ingreso de Orden de Reparación (' + nombreNegocioActivo + ')' 
                : '📝 Recepción Central + Patrón 3x3 + Calculadora USD / Mercado Pago / 50% Seña'}
          </h3>
          {idOrdenEditando && (
            <button type="button" onClick={limpiarFormularioOrden} className="neon-btn neon-btn-red">
              ❌ Cancelar Edición
            </button>
          )}
        </div>

        <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(0,122,255,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <span className="label-neon" style={{ color: 'var(--neon-cyan)', margin: 0 }}>
              🧮 Cotizador Instantáneo (Dólar Hoy: ${config.cotizacionDolar} | Calcula Escala + Comisionista + Medio de Pago + 50% Seña)
            </span>
            <input 
              type="text" 
              className="neon-input" 
              placeholder="🔍 Autocompletar costo desde mi Catálogo de Proveedores..." 
              value={busquedaRepuestoCalc} 
              onChange={e => setBusquedaRepuestoCalc(e.target.value)} 
              style={{ maxWidth: '340px', padding: '6px 12px', fontSize: '13px' }} 
            />
          </div>

          {sugerenciasRepuestosProv.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {sugerenciasRepuestosProv.map(p => (
                <button 
                  key={p.id} 
                  type="button" 
                  onClick={() => seleccionarRepuestoParaCalculadora(p)} 
                  className="neon-btn neon-btn-purple" 
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  ⚡ {p.nombre} (Costo: ${Number(p.costoProveedor || p.precio || 0).toLocaleString()})
                </button>
              ))}
            </div>
          )}

          {alertaTopeGremio && (
            <div style={{ marginBottom: '10px' }}>
              <span className="neon-badge" style={{ background: 'rgba(255,59,48,0.18)', color: 'var(--neon-red)' }}>
                ⚠️ Repuesto supera USD {config.topeUsdSinSenaGremio}: Requiere 50% de adelanto al Gremio
              </span>
            </div>
          )}

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
                <option value="mercadopago">💠 Mercado Pago QR / Link ({Number(config.mpRecargoPorcentaje || 0) > 0 ? '+' + config.mpRecargoPorcentaje + '%' : 'Lista'})</option>
                <option value="tarjeta_1">💳 Tarjeta 1 Pago (+{config.recargoTarjeta1Pago || 15}%)</option>
                <option value="tarjeta_3">💳 Tarjeta 3 Cuotas (+{config.recargoTarjeta3Cuotas || 28}%)</option>
                <option value="tarjeta_6">💳 Tarjeta 6 Cuotas (+{config.recargoTarjeta6Cuotas || 45}%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE CARGA DE CLIENTE, EQUIPO Y GRILLA INTERACTIVA DE PATRÓN 3x3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: '14px', marginBottom: '14px' }}>
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

          {/* COLUMNA 2: EQUIPO + PAD TÁCTIL DE PATRÓN 3x3 */}
          <div>
            <label className="label-neon">2. Equipo, PIN & Patrón 3x3</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" className="neon-input" placeholder="Marca *" value={marca} onChange={e => setMarca(e.target.value)} required />
              <input type="text" className="neon-input" placeholder="Modelo *" value={modelo} onChange={e => setModelo(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" className="neon-input" placeholder="IMEI / Serie" value={imei} onChange={e => setImei(e.target.value)} />
              <input type="text" className="neon-input" placeholder="PIN / Contraseña" value={contrasena} onChange={e => setContrasena(e.target.value)} />
            </div>

            {/* WIDGET INTERACTIVO DE PATRÓN DE DESBLOQUEO 3x3 */}
            <div style={{ background: 'var(--bg-input)', border: '1px solid rgba(0,122,255,0.35)', borderRadius: '14px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <span className="label-neon" style={{ color: 'var(--neon-cyan)', marginBottom: '3px' }}>
                  🔢 Patrón de Desbloqueo 3x3
                </span>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tocá los puntos en orden:
                </div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: patronComoTexto ? 'var(--neon-green)' : 'var(--text-muted)', minHeight: '20px' }}>
                  {patronComoTexto ? 'Trazo: ' + patronComoTexto : 'Sin patrón marcado'}
                </div>
                {patronNodos.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setPatronNodos([])} 
                    className="neon-btn neon-btn-red" 
                    style={{ padding: '3px 10px', fontSize: '11px', marginTop: '4px' }}
                  >
                    🔄 Limpiar Patrón
                  </button>
                )}
              </div>

              {/* GRILLA 3x3 DE BOTONES TÁCTILES */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: '7px', background: 'rgba(0,0,0,0.06)', padding: '8px', borderRadius: '12px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                  const pasoOrden = patronNodos.indexOf(num) + 1;
                  const estaMarcado = pasoOrden > 0;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => tocarNodoPatron3x3(num)}
                      title={'Punto ' + num + (estaMarcado ? ' (Paso ' + pasoOrden + ')' : '')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        border: estaMarcado ? '2px solid var(--neon-cyan)' : '1.5px solid rgba(128,128,128,0.45)',
                        background: estaMarcado ? 'var(--neon-cyan)' : 'var(--bg-card)',
                        color: estaMarcado ? '#fff' : 'var(--text-muted)',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: estaMarcado ? '0 0 10px rgba(0,122,255,0.5)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {estaMarcado ? pasoOrden : num}
                    </button>
                  );
                })}
              </div>
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
            {modalidadPagoOrden === 'mercadopago' && (
              <div style={{ fontSize: '12px', color: '#009ee3', marginTop: '4px', fontWeight: 'bold' }}>
                💠 Al crear la orden podrás mostrar el QR o enviar el Link de Mercado Pago.
              </div>
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
              ? '💾 Guardar Cambios en Orden #' + codigoOrdenEditando 
              : '➕ Generar Orden de Reparación ' + (Number(señaRecibida) > 0 ? '(Con Adelanto de $' + Number(señaRecibida).toLocaleString() + ')' : '')}
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
              <th>Equipo, Patrón 3x3 & Falla</th>
              <th>Estado, Seña 50% y Saldo</th>
              <th style={{ textAlign: 'center' }}>Acciones y Cobro MP</th>
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
                    <b>{o.equipo?.marca} {o.equipo?.modelo}</b>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '3px 0' }}>
                      {o.equipo?.contrasena && (
                        <span className="neon-badge" style={{ background: 'rgba(255,149,0,0.15)', color: 'var(--neon-yellow)' }}>
                          🔑 PIN: {o.equipo.contrasena}
                        </span>
                      )}
                      {o.equipo?.patron3x3 && (
                        <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.16)', color: 'var(--neon-cyan)' }}>
                          🔢 Patrón 3x3: {o.equipo.patron3x3}
                        </span>
                      )}
                    </div>
                    <span className="glow-text-red">Falla: {o.fallaDeclarada}</span><br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      Pago: {(o.modalidadPago || 'efectivo').toUpperCase()}
                      {o.tecnicoAsignado ? ' | Sector: ' + o.tecnicoAsignado : ''}
                    </small>
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
                      <button 
                        onClick={() => abrirModalMercadoPago(o)} 
                        className="neon-btn" 
                        style={{ borderColor: '#009ee3', color: '#009ee3' }} 
                        title="Cobrar Seña o Saldo con QR / Link de Mercado Pago"
                      >
                        💠 MP
                      </button>
                      <button onClick={() => cargarOrdenParaEditar(o)} className="neon-btn" title="Editar Orden y Patrón 3x3">✏️</button>
                      <button onClick={() => setOrdenDetalleModal(o)} className="neon-btn" title="Ver Bitácora Técnica y Repuestos Usados">📋</button>
                      <button onClick={() => imputarRepuestoAOrden(o)} className="neon-btn neon-btn-purple" title="Descontar repuesto de mi stock">🔩</button>
                      <button onClick={() => notificarClienteWhatsApp(o)} className="neon-btn neon-btn-green" title="Avisar por WhatsApp con saldo y envío">💬</button>
                      <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir Orden con Gráfico Patrón 3x3">🖨️</button>
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