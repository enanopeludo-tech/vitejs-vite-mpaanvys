// src/modulos/ModuloClientesGremioFinanzas.tsx
import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { imprimirFacturaARCA } from '../estilosTema';

interface PropsClientesGremioFinanzas {
  vista: 'clientes' | 'talleres_b2b' | 'finanzas';
  user: any;
  tenantId: string;
  nombreNegocioActivo: string;
  datosFiscalesActivos: any;
  misOrdenesTaller: any[];
  misPedidosWeb: any[];
  misFinanzas: any[];
  talleresGremio: any[];
  config: any;
}

export const ModuloClientesGremioFinanzas: React.FC<PropsClientesGremioFinanzas> = ({
  vista,
  user,
  tenantId,
  nombreNegocioActivo,
  datosFiscalesActivos,
  misOrdenesTaller,
  misPedidosWeb,
  misFinanzas,
  talleresGremio,
  config
}) => {
  // ============================================================================
  // 1. ESTADOS PARA CLIENTES CRM & CAMPAÑAS WHATSAPP
  // ============================================================================
  const [clientesBd, setClientesBd] = useState<any[]>([]);
  const [idClienteEditando, setIdClienteEditando] = useState<string | null>(null);
  const [crmNombre, setCrmNombre] = useState('');
  const [crmTelefono, setCrmTelefono] = useState('');
  const [crmDni, setCrmDni] = useState('');
  const [crmDireccion, setCrmDireccion] = useState('');
  const [crmNotas, setCrmNotas] = useState('');
  const [busquedaCrm, setBusquedaCrm] = useState('');
  const [plantillaPromo, setPlantillaPromo] = useState(
    config.promoPlantillaCRM ||
    'Hola {nombre}! En *{empresa}* tenemos promos exclusivas esta semana en cargadores carga rápida, hidrogel antishock y servicio técnico. ¡Consultanos!'
  );

  useEffect(() => {
    const unsubCrm = onSnapshot(query(collection(db, 'clientes_crm')), (snap) => {
      setClientesBd(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubCrm();
  }, []);

  useEffect(() => {
    if (config.promoPlantillaCRM) {
      setPlantillaPromo(config.promoPlantillaCRM);
    }
  }, [config.promoPlantillaCRM]);

  // ============================================================================
  // 2. ESTADOS PARA RED DE LOCALES ASOCIADOS (GREMIO B2B)
  // ============================================================================
  const [idTallerEditando, setIdTallerEditando] = useState<string | null>(null);
  const [tallerNom, setTallerNom] = useState('');
  const [tallerEncargado, setTallerEncargado] = useState('');
  const [tallerTel, setTallerTel] = useState('');
  const [tallerDireccion, setTallerDireccion] = useState('');
  const [tallerEmail, setTallerEmail] = useState('');
  const [tallerPassword, setTallerPassword] = useState('');
  const [tallerCiudad, setTallerCiudad] = useState('Necochea');
  const [tallerNivel, setTallerNivel] = useState<'Bronce' | 'Oro'>('Bronce');
  const [tallerLimiteCredito, setTallerLimiteCredito] = useState('150000');
  const [creandoCuentaLocal, setCreandoCuentaLocal] = useState(false);

  // ============================================================================
  // 3. ESTADOS PARA FINANZAS, ARQUEO DE CAJA Y FACTURACIÓN ARCA
  // ============================================================================
  const [finTipo, setFinTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [finConcepto, setFinConcepto] = useState('');
  const [finMonto, setFinMonto] = useState('');
  const [finMetodo, setFinMetodo] = useState<'efectivo' | 'transferencia' | 'mercadopago' | 'tarjeta'>('efectivo');
  const [filtroBusquedaConcepto, setFiltroBusquedaConcepto] = useState('');
  const [filtroTipoMovimiento, setFiltroTipoMovimiento] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filtroMedioPagoFin, setFiltroMedioPagoFin] = useState('todos');

  // ----------------------------------------------------------------------------
  // LÓGICA CLIENTES CRM
  // ----------------------------------------------------------------------------
  const misClientesGuardados = clientesBd.filter(c => (c.ownerId || 'MASTER') === tenantId);

  const mapaUnificadoClientes = new Map<string, any>();

  misClientesGuardados.forEach(c => {
    const claveTel = (c.telefono || '').replace(/\D/g, '') || c.id;
    mapaUnificadoClientes.set(claveTel, {
      ...c,
      esDeColeccionCrm: true,
      cantidadOrdenes: 0,
      totalGastado: 0
    });
  });

  misOrdenesTaller.forEach(o => {
    const telLimpio = (o.cliente?.telefono || '').replace(/\D/g, '');
    if (!telLimpio) return;
    const existente = mapaUnificadoClientes.get(telLimpio);
    const montoOrden = Number(o.costoReparacion || o.seña || 0);
    const equipoTexto = ((o.equipo?.marca || '') + ' ' + (o.equipo?.modelo || '')).trim();
    if (existente) {
      existente.cantidadOrdenes = (existente.cantidadOrdenes || 0) + 1;
      existente.totalGastado = (existente.totalGastado || 0) + montoOrden;
      if (!existente.ultimoEquipo && equipoTexto) {
        existente.ultimoEquipo = equipoTexto;
      }
    } else {
      mapaUnificadoClientes.set(telLimpio, {
        id: 'taller_' + o.id,
        esDeColeccionCrm: false,
        nombre: o.cliente?.nombre || 'Cliente Taller',
        telefono: o.cliente?.telefono || '',
        dni: o.cliente?.dni || '',
        direccion: '',
        ultimoEquipo: equipoTexto,
        origen: 'Taller',
        cantidadOrdenes: 1,
        totalGastado: montoOrden
      });
    }
  });

  misPedidosWeb.forEach(p => {
    const telLimpio = (p.cliente?.telefono || '').replace(/\D/g, '');
    if (!telLimpio) return;
    const existente = mapaUnificadoClientes.get(telLimpio);
    const montoPedido = Number(p.total || 0);
    if (existente) {
      existente.totalGastado = (existente.totalGastado || 0) + montoPedido;
    } else {
      mapaUnificadoClientes.set(telLimpio, {
        id: 'web_' + p.id,
        esDeColeccionCrm: false,
        nombre: p.cliente?.nombre || 'Cliente Web',
        telefono: p.cliente?.telefono || '',
        dni: p.cliente?.dni || '',
        direccion: p.cliente?.direccion || '',
        ultimoEquipo: 'Compra Tienda Online',
        origen: 'Tienda Web',
        cantidadOrdenes: 0,
        totalGastado: montoPedido
      });
    }
  });

  const carteraClientesUnificada = Array.from(mapaUnificadoClientes.values()).filter(c => {
    if (!busquedaCrm) return true;
    const b = busquedaCrm.toLowerCase();
    return Boolean(
      c.nombre?.toLowerCase().includes(b) ||
      c.telefono?.toLowerCase().includes(b) ||
      c.dni?.toLowerCase().includes(b) ||
      c.ultimoEquipo?.toLowerCase().includes(b)
    );
  });

  const guardarClienteCrm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ownerId: tenantId,
      nombre: crmNombre,
      telefono: crmTelefono,
      dni: crmDni,
      direccion: crmDireccion,
      notas: crmNotas,
      origen: 'Manual CRM',
      fechaAlta: new Date().toLocaleDateString()
    };

    if (idClienteEditando) {
      await updateDoc(doc(db, 'clientes_crm', idClienteEditando), payload);
      alert('✅ Ficha del cliente actualizada.');
      limpiarFormCrm();
      return;
    }

    await addDoc(collection(db, 'clientes_crm'), {
      ...payload,
      fechaTimestamp: serverTimestamp()
    });
    limpiarFormCrm();
    alert('👤 Cliente agendado en tu base CRM.');
  };

  const limpiarFormCrm = () => {
    setIdClienteEditando(null);
    setCrmNombre('');
    setCrmTelefono('');
    setCrmDni('');
    setCrmDireccion('');
    setCrmNotas('');
  };

  const enviarPromoWhatsAppCrm = (cliente: any) => {
    const mensajePersonalizado = plantillaPromo
      .replace(/\{nombre\}/gi, cliente.nombre || 'Cliente')
      .replace(/\{empresa\}/gi, nombreNegocioActivo);
    const tel = (cliente.telefono || '').replace(/\D/g, '');
    const urlWa = 'https://wa.me/549' + tel + '?text=' + encodeURIComponent(mensajePersonalizado);
    window.open(urlWa, '_blank');
  };

  const exportarClientesCsv = () => {
    if (carteraClientesUnificada.length === 0) return alert('No hay clientes para exportar.');
    const encabezados = ['Nombre', 'Telefono', 'DNI', 'Origen', 'Ultimo Equipo', 'Ordenes', 'Total Historico'];
    const filas = carteraClientesUnificada.map(c => [
      '"' + String(c.nombre || '').replace(/"/g, '""') + '"',
      '"' + String(c.telefono || '') + '"',
      '"' + String(c.dni || '') + '"',
      '"' + String(c.origen || 'Local') + '"',
      '"' + String(c.ultimoEquipo || '').replace(/"/g, '""') + '"',
      c.cantidadOrdenes || 0,
      c.totalGastado || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'Clientes_CRM_' + nombreNegocioActivo.replace(/\s+/g, '_') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------------------------------
  // LÓGICA RED DE LOCALES ASOCIADOS Y CUENTA CORRIENTE
  // ----------------------------------------------------------------------------
  const guardarTallerGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoCuentaLocal(true);
    try {
      const emailLimpio = tallerEmail.trim().toLowerCase();
      if (idTallerEditando) {
        await updateDoc(doc(db, 'talleres_gremio', idTallerEditando), {
          nombre: tallerNom,
          encargado: tallerEncargado,
          telefono: tallerTel,
          direccion: tallerDireccion,
          email: emailLimpio,
          ciudad: tallerCiudad,
          nivel: tallerNivel,
          limiteCredito: Number(tallerLimiteCredito) || 0
        });
        limpiarFormTaller();
        return alert('✅ Datos del Local Asociado actualizados.');
      }

      if (tallerPassword && tallerPassword.length >= 6) {
        const secondaryApp = getApps().find(a => a.name === 'SecondaryCreatorApp') || initializeApp(auth.app.options, 'SecondaryCreatorApp');
        const secondaryAuth = getAuth(secondaryApp);
        try {
          await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, tallerPassword);
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          if (authErr.code !== 'auth/email-already-in-use') throw authErr;
        }
      }

      const existenteEnBd = talleresGremio.find(t => t.email?.toLowerCase() === emailLimpio);
      if (existenteEnBd) {
        await updateDoc(doc(db, 'talleres_gremio', existenteEnBd.id), {
          nombre: tallerNom,
          encargado: tallerEncargado,
          telefono: tallerTel,
          direccion: tallerDireccion,
          email: emailLimpio,
          ciudad: tallerCiudad,
          nivel: tallerNivel,
          limiteCredito: Number(tallerLimiteCredito) || 0,
          activo: true
        });
      } else {
        await addDoc(collection(db, 'talleres_gremio'), {
          nombre: tallerNom,
          encargado: tallerEncargado,
          telefono: tallerTel,
          direccion: tallerDireccion,
          email: emailLimpio,
          ciudad: tallerCiudad,
          nivel: tallerNivel,
          limiteCredito: Number(tallerLimiteCredito) || 0,
          saldoDeudor: 0,
          activo: true,
          fechaAlta: serverTimestamp()
        });
      }
      limpiarFormTaller();
      alert('🏢 Local Asociado habilitado correctamente.');
    } catch (err: any) {
      alert('Error al guardar local: ' + err.message);
    } finally {
      setCreandoCuentaLocal(false);
    }
  };

  const limpiarFormTaller = () => {
    setIdTallerEditando(null);
    setTallerNom('');
    setTallerEncargado('');
    setTallerTel('');
    setTallerDireccion('');
    setTallerEmail('');
    setTallerPassword('');
    setTallerCiudad('Necochea');
    setTallerNivel('Bronce');
    setTallerLimiteCredito('150000');
  };

  const registrarCobroCuentaCorrienteGremio = async (taller: any) => {
    const deudaActual = Number(taller.saldoDeudor || 0);
    const textoPrompt =
      '💵 COBRAR CUENTA CORRIENTE — Local: ' + taller.nombre + '\n' +
      'Saldo deudor actual: $' + deudaActual.toLocaleString() + '\n\n' +
      'Ingresa el monto que entrega/abona el local ahora ($):';
    const montoCobrado = Number(prompt(textoPrompt, deudaActual > 0 ? String(deudaActual) : ''));
    if (!montoCobrado || montoCobrado <= 0) return;

    const medioPago = prompt('Medio de pago recibido (efectivo, transferencia, mercadopago):', 'efectivo') || 'efectivo';
    const nuevoSaldo = Math.max(0, deudaActual - montoCobrado);

    await updateDoc(doc(db, 'talleres_gremio', taller.id), {
      saldoDeudor: nuevoSaldo,
      ultimoPagoFecha: new Date().toLocaleDateString(),
      ultimoPagoMonto: montoCobrado
    });

    await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId,
      tipo: 'ingreso',
      concepto: 'Cobro Cta. Cte. Gremio: ' + taller.nombre + ' (Resta: $' + nuevoSaldo.toLocaleString() + ')',
      monto: montoCobrado,
      metodoPago: medioPago.toLowerCase(),
      fecha: serverTimestamp(),
      usuario: user.email
    });

    alert('✅ Entrega de $' + montoCobrado.toLocaleString() + ' registrada en Caja. Nuevo saldo de ' + taller.nombre + ': $' + nuevoSaldo.toLocaleString() + '.');
  };

  const cargarCargoManualCtaCte = async (taller: any) => {
    const deudaActual = Number(taller.saldoDeudor || 0);
    const montoCargo = Number(prompt('➕ CARGAR DEUDA A CUENTA CORRIENTE — ' + taller.nombre + '\nIngresa el importe a sumar al saldo deudor ($):'));
    if (!montoCargo || montoCargo <= 0) return;

    const nuevoSaldo = deudaActual + montoCargo;
    await updateDoc(doc(db, 'talleres_gremio', taller.id), {
      saldoDeudor: nuevoSaldo
    });
    alert('📌 Saldo actualizado. Deuda total de ' + taller.nombre + ': $' + nuevoSaldo.toLocaleString() + '.');
  };

  const enviarEstadoCuentaWhatsAppGremio = (taller: any) => {
    const ordenesDelLocal = misOrdenesTaller.filter(o => o.tallerId === taller.id || o.tallerOrigen === taller.nombre);
    const enCurso = ordenesDelLocal.filter(o => o.estado !== 'entregado').length;
    const deuda = Number(taller.saldoDeudor || 0);
    const limite = Number(taller.limiteCredito || 0);

    let msg = 'Hola *' + (taller.encargado || taller.nombre) + '*, te enviamos el resumen de tu cuenta Gremio B2B en *' + nombreNegocioActivo + '*:\n\n';
    msg += '🏢 *Local:* ' + taller.nombre + ' (Nivel ' + (taller.nivel || 'Bronce') + ')\n';
    msg += '🛠️ *Equipos en laboratorio / para retirar:* ' + enCurso + '\n';
    msg += '💰 *Saldo actual en Cuenta Corriente:* $' + deuda.toLocaleString() + '\n';
    msg += '📊 *Límite de crédito asignado:* $' + limite.toLocaleString() + '\n';
    if (config.aliasTransferencia) {
      msg += '\n🏦 *Alias para transferencias:* ' + config.aliasTransferencia + ' (' + config.bancoTitular + ')';
    }
    const urlWa = 'https://wa.me/549' + (taller.telefono || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
    window.open(urlWa, '_blank');
  };

  // ----------------------------------------------------------------------------
  // LÓGICA FINANZAS, CAJA Y CIERRE DE CAJA DIARIO
  // ----------------------------------------------------------------------------
  const registrarMovimientoFinanzas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finConcepto || !finMonto) return;
    await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId,
      tipo: finTipo,
      concepto: finConcepto,
      monto: Number(finMonto),
      metodoPago: finMetodo,
      fecha: serverTimestamp(),
      usuario: user.email
    });
    setFinConcepto('');
    setFinMonto('');
  };

  const emitirFacturaArcaDesdeFinanzas = async (movimiento: any) => {
    const tipoCmp = (prompt('Selecciona el tipo de Factura Electrónica ARCA a emitir (C, B o A):', 'C') || 'C').toUpperCase();
    if (!['A', 'B', 'C'].includes(tipoCmp)) return alert('Tipo de factura inválido. Usa A, B o C.');

    const cuitReceptor = prompt('Ingresa el CUIT o DNI del Receptor (dejar vacío para Consumidor Final):', '') || '00-00000000-0';
    const razonReceptor = prompt('Nombre o Razón Social del Receptor:', 'Consumidor Final') || 'Consumidor Final';
    const condIvaReceptor = tipoCmp === 'A' ? 'IVA Responsable Inscripto' : 'Consumidor Final';

    const ptoVta = String(datosFiscalesActivos.puntoVentaArca || '00001').padStart(5, '0');
    const cantPrevias = misFinanzas.filter(m => m.factura && m.factura.tipo === tipoCmp).length;
    const proximoNumero = String(cantPrevias + 1).padStart(8, '0');
    const vto = new Date();
    vto.setDate(vto.getDate() + 10);

    const facObj = {
      tipo: tipoCmp,
      puntoVenta: ptoVta,
      numero: ptoVta + '-' + proximoNumero,
      cuit: cuitReceptor,
      razonSocialReceptor: razonReceptor,
      condicionIvaReceptor: condIvaReceptor,
      cae: '74' + Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      vtoCae: vto.toLocaleDateString(),
      fechaEmision: new Date().toLocaleDateString()
    };

    await updateDoc(doc(db, 'finanzas', movimiento.id), { factura: facObj });
    imprimirFacturaARCA({ ...movimiento, factura: facObj }, datosFiscalesActivos);
  };

  // --- IMPRIMIR CIERRE DE CAJA DIARIO (SIN BACKTICKS ANIDADOS) ---
  const imprimirCierreCajaDiario = () => {
    const hoyStr = new Date().toLocaleDateString();
    const movsHoy = misFinanzas.filter(m => {
      if (!m.fecha?.seconds) return true;
      const fechaMov = new Date(m.fecha.seconds * 1000).toLocaleDateString();
      return fechaMov === hoyStr;
    });

    const ingresosHoy = movsHoy.filter(m => m.tipo === 'ingreso');
    const egresosHoy = movsHoy.filter(m => m.tipo === 'egreso');

    const totalIng = ingresosHoy.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const totalEgr = egresosHoy.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const netoHoy = totalIng - totalEgr;

    const efectivoIng = ingresosHoy.filter(m => m.metodoPago === 'efectivo').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const efectivoEgr = egresosHoy.filter(m => m.metodoPago === 'efectivo').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const efectivoHoy = efectivoIng - efectivoEgr;

    const transferenciaHoy = ingresosHoy
      .filter(m => m.metodoPago === 'transferencia' || m.metodoPago === 'mercadopago')
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const tarjetaHoy = ingresosHoy
      .filter(m => (m.metodoPago || '').startsWith('tarjeta'))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const filasHtml = movsHoy.length > 0
      ? movsHoy.map(m => {
          const signo = m.tipo === 'ingreso' ? '+' : '-';
          const colorMonto = m.tipo === 'ingreso' ? '#198754' : '#ff3b30';
          return (
            '<tr>' +
              '<td>' + (m.concepto || '-') + '</td>' +
              '<td style="text-transform:uppercase;">' + (m.metodoPago || '-') + '</td>' +
              '<td style="text-align:right; font-weight:bold; color:' + colorMonto + ';">' +
                signo + '$' + Number(m.monto || 0).toLocaleString() +
              '</td>' +
            '</tr>'
          );
        }).join('')
      : '<tr><td colspan="3" style="text-align:center; color:#777;">No hay movimientos registrados en la fecha de hoy.</td></tr>';

    const htmlDoc = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<title>Cierre de Caja Diario - ' + nombreNegocioActivo + '</title>',
      '<style>',
      'body { font-family: "Segoe UI", Arial, sans-serif; color: #111; max-width: 660px; margin: 0 auto; padding: 25px; }',
      '.cierre-box { border: 3px solid #111; border-radius: 12px; padding: 22px; }',
      '.header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 15px; }',
      '.grid-totales { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 15px 0; }',
      '.card-tot { background: #f8f9fa; border: 1px solid #ccc; padding: 12px; border-radius: 8px; text-align: center; }',
      'table { width: 100%; border-collapse: collapse; margin-top: 15px; }',
      'th { background: #eee; padding: 8px; text-align: left; font-size: 11px; border-bottom: 1px solid #000; }',
      'td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; }',
      '@media print { .no-print { display: none; } }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="no-print" style="text-align:right; margin-bottom:12px;">',
      '<button onclick="window.print()" style="background:#007aff; color:#fff; border:none; padding:10px 20px; border-radius:999px; font-weight:bold; cursor:pointer;">🖨️ Imprimir Arqueo de Caja Diario</button>',
      '</div>',
      '<div class="cierre-box">',
      '<div class="header">',
      '<div>',
      '<h2 style="margin:0;">' + nombreNegocioActivo + '</h2>',
      '<div style="font-size:12px;">📍 ' + (datosFiscalesActivos.direccion || '-') + ' | CUIT: ' + (datosFiscalesActivos.cuit || '-') + '</div>',
      '</div>',
      '<div style="text-align:right;">',
      '<div style="font-size:11px; font-weight:bold;">ARQUEO Y CIERRE DE CAJA</div>',
      '<div style="font-size:16px; font-weight:900;">📅 ' + hoyStr + '</div>',
      '</div>',
      '</div>',
      '<div class="grid-totales">',
      '<div class="card-tot" style="border-color:#28cd41; background:#f0fff4;">',
      '<div style="font-size:11px; font-weight:bold; color:#198754;">💵 EFECTIVO NETO EN CAJA</div>',
      '<div style="font-size:22px; font-weight:900; color:#198754; margin-top:4px;">$' + efectivoHoy.toLocaleString() + '</div>',
      '</div>',
      '<div class="card-tot" style="border-color:#007aff;">',
      '<div style="font-size:11px; font-weight:bold; color:#007aff;">🏦 TRANSFERENCIA / MERCADO PAGO</div>',
      '<div style="font-size:22px; font-weight:900; color:#007aff; margin-top:4px;">$' + transferenciaHoy.toLocaleString() + '</div>',
      '</div>',
      '<div class="card-tot" style="border-color:#af52de;">',
      '<div style="font-size:11px; font-weight:bold; color:#af52de;">💳 TARJETAS / CUOTAS</div>',
      '<div style="font-size:22px; font-weight:900; color:#af52de; margin-top:4px;">$' + tarjetaHoy.toLocaleString() + '</div>',
      '</div>',
      '<div class="card-tot" style="border-color:#333; background:#eee;">',
      '<div style="font-size:11px; font-weight:bold; color:#333;">📊 BALANCE NETO DEL DÍA</div>',
      '<div style="font-size:22px; font-weight:900; color:#111; margin-top:4px;">$' + netoHoy.toLocaleString() + '</div>',
      '</div>',
      '</div>',
      '<div style="font-size:13px; margin:15px 0 5px 0;">',
      '<b>Total Ingresos del Día:</b> +$' + totalIng.toLocaleString() + ' | <b>Total Egresos del Día:</b> -$' + totalEgr.toLocaleString() + ' (Operaciones: ' + movsHoy.length + ')',
      '</div>',
      '<table>',
      '<thead><tr><th>Detalle / Concepto</th><th>Medio</th><th style="text-align:right;">Importe</th></tr></thead>',
      '<tbody>' + filasHtml + '</tbody>',
      '</table>',
      '<div style="display:flex; justify-content:space-between; margin-top:42px; font-size:12px;">',
      '<div style="border-top:1px solid #000; width:44%; text-align:center; padding-top:4px;">Firma Cajero / Operador (' + (user.email || '') + ')</div>',
      '<div style="border-top:1px solid #000; width:44%; text-align:center; padding-top:4px;">Controló Administración</div>',
      '</div>',
      '</div>',
      '</body>',
      '</html>'
    ].join('\n');

    const v = window.open('', '_blank');
    if (!v) return;
    v.document.write(htmlDoc);
    v.document.close();
  };

  // ============================================================================
  // RENDERIZADO SEGÚN LA PESTAÑA ACTIVA ('clientes' | 'talleres_b2b' | 'finanzas')
  // ============================================================================
  if (vista === 'clientes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="neon-card neon-card-purple">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            <div>
              <h3 className="glow-text-pink" style={{ margin: 0 }}>
                📣 1. Campaña de Promociones y Fidelización por WhatsApp ({carteraClientesUnificada.length} clientes)
              </h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Usa las etiquetas <b>{'{nombre}'}</b> y <b>{'{empresa}'}</b> para personalizar el mensaje automáticamente al tocar el botón de WhatsApp de cada cliente.
              </small>
            </div>
            <button type="button" onClick={exportarClientesCsv} className="neon-btn neon-btn-green">
              📥 Exportar Cartera a Excel (.CSV)
            </button>
          </div>
          <textarea 
            className="neon-textarea" 
            rows={2} 
            value={plantillaPromo} 
            onChange={e => setPlantillaPromo(e.target.value)} 
          />
        </div>

        <form onSubmit={guardarClienteCrm} className="neon-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="glow-text-cyan" style={{ margin: 0 }}>
              {idClienteEditando ? '✏️ Editando Ficha de Cliente' : '👤 2. Agendar Nuevo Cliente en CRM'}
            </h3>
            {idClienteEditando && (
              <button type="button" onClick={limpiarFormCrm} className="neon-btn neon-btn-red">
                Cancelar Edición
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <input type="text" className="neon-input" required placeholder="Nombre y Apellido *" value={crmNombre} onChange={e => setCrmNombre(e.target.value)} />
            <input type="text" className="neon-input" required placeholder="WhatsApp (2262...) *" value={crmTelefono} onChange={e => setCrmTelefono(e.target.value)} />
            <input type="text" className="neon-input" placeholder="DNI / CUIT" value={crmDni} onChange={e => setCrmDni(e.target.value)} />
            <input type="text" className="neon-input" placeholder="Dirección / Ciudad" value={crmDireccion} onChange={e => setCrmDireccion(e.target.value)} />
            <input type="text" className="neon-input" placeholder="Equipo / Notas" value={crmNotas} onChange={e => setCrmNotas(e.target.value)} />
            <button type="submit" className="neon-btn neon-btn-fillCyan">
              {idClienteEditando ? '💾 Actualizar' : '➕ Agendar Cliente'}
            </button>
          </div>
        </form>

        <div className="neon-card" style={{ overflowX: 'auto' }}>
          <input 
            type="text" 
            className="neon-input" 
            placeholder="🔍 Buscar cliente por nombre, WhatsApp, DNI o modelo de equipo..." 
            value={busquedaCrm} 
            onChange={e => setBusquedaCrm(e.target.value)} 
            style={{ marginBottom: '14px' }} 
          />
          <table className="neon-table">
            <thead>
              <tr>
                <th>Cliente & DNI</th>
                <th>WhatsApp</th>
                <th>Origen / Último Equipo</th>
                <th>Actividad</th>
                <th style={{ textAlign: 'center' }}>Acciones CRM</th>
              </tr>
            </thead>
            <tbody>
              {carteraClientesUnificada.map(c => (
                <tr key={c.id}>
                  <td>
                    <b>{c.nombre}</b><br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      DNI: {c.dni || '-'} {c.direccion ? '| 📍 ' + c.direccion : ''}
                    </small>
                  </td>
                  <td className="glow-text-green" style={{ fontWeight: 'bold' }}>📱 {c.telefono}</td>
                  <td>
                    <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)' }}>
                      {c.origen || 'Local'}
                    </span>{' '}
                    <small>{c.ultimoEquipo || c.notas || '-'}</small>
                  </td>
                  <td>
                    <b>{c.cantidadOrdenes || 0} órdenes</b><br />
                    <small className="glow-text-cyan">Total: ${Number(c.totalGastado || 0).toLocaleString()}</small>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => enviarPromoWhatsAppCrm(c)} className="neon-btn neon-btn-green" title="Enviar Promo por WhatsApp">
                        💬 Enviar Promo
                      </button>
                      {c.esDeColeccionCrm && (
                        <>
                          <button 
                            onClick={() => {
                              setIdClienteEditando(c.id);
                              setCrmNombre(c.nombre || '');
                              setCrmTelefono(c.telefono || '');
                              setCrmDni(c.dni || '');
                              setCrmDireccion(c.direccion || '');
                              setCrmNotas(c.notas || '');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} 
                            className="neon-btn"
                          >
                            ✏️
                          </button>
                          <button onClick={() => { if (window.confirm('¿Eliminar cliente del CRM?')) deleteDoc(doc(db, 'clientes_crm', c.id)); }} className="neon-btn neon-btn-red">
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {carteraClientesUnificada.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (vista === 'talleres_b2b') {
    const deudaTotalRed = talleresGremio.reduce((acc, t) => acc + Number(t.saldoDeudor || 0), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="neon-card neon-card-purple" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="glow-text-pink" style={{ margin: 0 }}>
              🏢 Red de Locales Asociados & Cuentas Corrientes Gremio B2B
            </h2>
            <small style={{ color: 'var(--text-muted)' }}>
              Cada local habilitado tiene su propio panel multi-sucursal, su link de tienda web (/?tienda=ID) y su tarifa mayorista automática.
            </small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="label-neon">Saldo Total a Cobrar en Cta. Cte.</span>
            <h2 className="glow-text-yellow" style={{ margin: 0 }}>${deudaTotalRed.toLocaleString()}</h2>
          </div>
        </div>

        <div className="neon-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="glow-text-cyan" style={{ margin: 0 }}>
              {idTallerEditando ? '✏️ Editando Local Asociado' : '➕ Habilitar Nuevo Local Asociado / Taller Colega'}
            </h3>
            {idTallerEditando && (
              <button type="button" onClick={limpiarFormTaller} className="neon-btn neon-btn-red">
                Cancelar Edición
              </button>
            )}
          </div>
          <form onSubmit={guardarTallerGremio} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '10px' }}>
            <input type="text" className="neon-input" placeholder="Nombre del Local *" required value={tallerNom} onChange={e => setTallerNom(e.target.value)} />
            <input type="text" className="neon-input" placeholder="Encargado / Titular" value={tallerEncargado} onChange={e => setTallerEncargado(e.target.value)} />
            <input type="text" className="neon-input" placeholder="Ciudad" value={tallerCiudad} onChange={e => setTallerCiudad(e.target.value)} />
            <input type="text" className="neon-input" placeholder="Dirección" value={tallerDireccion} onChange={e => setTallerDireccion(e.target.value)} />
            <input type="text" className="neon-input" placeholder="WhatsApp" value={tallerTel} onChange={e => setTallerTel(e.target.value)} />
            <select className="neon-select" value={tallerNivel} onChange={e => setTallerNivel(e.target.value as any)}>
              <option value="Bronce">🥉 Nivel Bronce (-{config.descuentoGremioBronce || 10}%)</option>
              <option value="Oro">🥇 Nivel Oro (-{config.descuentoGremioOro || 18}%)</option>
            </select>
            <input type="number" className="neon-input" placeholder="Límite Cta Cte $" value={tallerLimiteCredito} onChange={e => setTallerLimiteCredito(e.target.value)} />
            <input type="email" className="neon-input" placeholder="Email de Acceso *" required value={tallerEmail} onChange={e => setTallerEmail(e.target.value)} />
            {!idTallerEditando && (
              <input type="text" className="neon-input" placeholder="Contraseña Inicial (mín. 6)" value={tallerPassword} onChange={e => setTallerPassword(e.target.value)} />
            )}
            <button type="submit" disabled={creandoCuentaLocal} className="neon-btn neon-btn-fillCyan">
              {idTallerEditando ? '💾 Guardar Cambios' : '🚀 Habilitar Local'}
            </button>
          </form>
        </div>

        <div className="neon-card" style={{ overflowX: 'auto' }}>
          <table className="neon-table">
            <thead>
              <tr>
                <th>Local & Nivel</th>
                <th>Contacto & Acceso</th>
                <th>Estado</th>
                <th>Saldo Deudor / Límite</th>
                <th style={{ textAlign: 'center' }}>Gestión Cuenta Corriente y Acciones</th>
              </tr>
            </thead>
            <tbody>
              {talleresGremio.map(t => {
                const saldo = Number(t.saldoDeudor || 0);
                const limite = Number(t.limiteCredito || 150000);
                const superaLimite = saldo > limite && limite > 0;
                return (
                  <tr key={t.id}>
                    <td>
                      <b>{t.nombre}</b> ({t.ciudad || 'Local'})<br />
                      <span className="neon-badge" style={{ background: t.nivel === 'Oro' ? 'rgba(255,149,0,0.18)' : 'rgba(0,122,255,0.14)', color: t.nivel === 'Oro' ? 'var(--neon-yellow)' : 'var(--neon-cyan)' }}>
                        {t.nivel === 'Oro' ? '🥇 Nivel Oro' : '🥉 Nivel Bronce'}
                      </span>
                    </td>
                    <td>
                      <small>{t.email}</small><br />
                      <span className="glow-text-green" style={{ fontSize: '13px' }}>📱 {t.telefono || '-'}</span>
                    </td>
                    <td>
                      <button 
                        onClick={() => updateDoc(doc(db, 'talleres_gremio', t.id), { activo: t.activo === false ? true : false })} 
                        className={'neon-btn ' + (t.activo !== false ? 'neon-btn-green' : 'neon-btn-red')} 
                        style={{ padding: '4px 10px' }}
                      >
                        {t.activo !== false ? '🟢 Activo' : '🔴 Suspendido'}
                      </button>
                    </td>
                    <td>
                      <b className={superaLimite ? 'glow-text-red' : saldo > 0 ? 'glow-text-yellow' : 'glow-text-green'} style={{ fontSize: '17px' }}>
                        ${saldo.toLocaleString()}
                      </b>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        Límite: ${limite.toLocaleString()}
                      </small>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => registrarCobroCuentaCorrienteGremio(t)} className="neon-btn neon-btn-green" title="Cobrar entrega de dinero e imputar en Caja">
                          💵 Cobrar Entrega
                        </button>
                        <button onClick={() => cargarCargoManualCtaCte(t)} className="neon-btn" title="Sumar cargo a la Cuenta Corriente">
                          ➕ Cargo
                        </button>
                        <button onClick={() => enviarEstadoCuentaWhatsAppGremio(t)} className="neon-btn neon-btn-purple" title="Enviar Resumen de Cuenta por WhatsApp">
                          💬 Resumen WA
                        </button>
                        <button 
                          onClick={() => {
                            setIdTallerEditando(t.id);
                            setTallerNom(t.nombre || '');
                            setTallerEncargado(t.encargado || '');
                            setTallerEmail(t.email || '');
                            setTallerCiudad(t.ciudad || 'Necochea');
                            setTallerDireccion(t.direccion || '');
                            setTallerTel(t.telefono || '');
                            setTallerNivel(t.nivel || 'Bronce');
                            setTallerLimiteCredito(String(t.limiteCredito || 150000));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          className="neon-btn"
                        >
                          ✏️
                        </button>
                        <button onClick={() => { if (window.confirm('¿Eliminar local ' + t.nombre + '?')) deleteDoc(doc(db, 'talleres_gremio', t.id)); }} className="neon-btn neon-btn-red">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {talleresGremio.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay locales asociados cargados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // VISTA FINANZAS, ARQUEO DE CAJA, CIERRE DIARIO Y FACTURACIÓN ARCA
  const totalIngresos = misFinanzas.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const totalEgresos = misFinanzas.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const cajaEfectivo = misFinanzas.filter(m => m.metodoPago === 'efectivo').reduce((acc, m) => acc + (m.tipo === 'ingreso' ? Number(m.monto || 0) : -Number(m.monto || 0)), 0);
  const cajaTransferencia = misFinanzas.filter(m => m.metodoPago === 'transferencia' || m.metodoPago === 'mercadopago').reduce((acc, m) => acc + (m.tipo === 'ingreso' ? Number(m.monto || 0) : -Number(m.monto || 0)), 0);
  const cajaTarjeta = misFinanzas.filter(m => (m.metodoPago || '').startsWith('tarjeta')).reduce((acc, m) => acc + (m.tipo === 'ingreso' ? Number(m.monto || 0) : -Number(m.monto || 0)), 0);

  const movimientosFiltrados = misFinanzas.filter(m => {
    if (filtroTipoMovimiento !== 'todos' && m.tipo !== filtroTipoMovimiento) return false;
    if (filtroMedioPagoFin !== 'todos' && (m.metodoPago || '').toLowerCase() !== filtroMedioPagoFin) return false;
    if (filtroBusquedaConcepto) {
      return (m.concepto || '').toLowerCase().includes(filtroBusquedaConcepto.toLowerCase());
    }
    return true;
  });

  const exportarFinanzasCsv = () => {
    if (movimientosFiltrados.length === 0) return alert('No hay movimientos para exportar.');
    const headers = ['Fecha', 'Tipo', 'Concepto', 'Medio de Pago', 'Monto', 'Factura ARCA', 'CAE'];
    const rows = movimientosFiltrados.map(m => [
      '"' + (m.fecha?.seconds ? new Date(m.fecha.seconds * 1000).toLocaleString() : '-') + '"',
      '"' + (m.tipo || '') + '"',
      '"' + String(m.concepto || '').replace(/"/g, '""') + '"',
      '"' + (m.metodoPago || '') + '"',
      m.monto || 0,
      '"' + (m.factura ? (m.factura.tipo + ' ' + m.factura.numero) : 'Ticket Interno') + '"',
      '"' + (m.factura?.cae || '') + '"'
    ]);
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'Caja_Finanzas_' + nombreNegocioActivo.replace(/\s+/g, '_') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="neon-card neon-card-green">
          <span className="label-neon">💵 Caja Física Efectivo</span>
          <h2 className="glow-text-green" style={{ margin: '4px 0' }}>${cajaEfectivo.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Billetes en mostrador</small>
        </div>
        <div className="neon-card">
          <span className="label-neon">🏦 Banco / Mercado Pago</span>
          <h2 className="glow-text-cyan" style={{ margin: '4px 0' }}>${cajaTransferencia.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Transferencias acreditadas</small>
        </div>
        <div className="neon-card neon-card-purple">
          <span className="label-neon">💳 Lote Tarjetas / Cuotas</span>
          <h2 className="glow-text-pink" style={{ margin: '4px 0' }}>${cajaTarjeta.toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Cobros con Posnet / Link</small>
        </div>
        <div className="neon-card neon-card-yellow">
          <span className="label-neon">📊 Balance Acumulado</span>
          <h2 className="glow-text-yellow" style={{ margin: '4px 0' }}>${(totalIngresos - totalEgresos).toLocaleString()}</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            Ing: +${totalIngresos.toLocaleString()} | Egr: -${totalEgresos.toLocaleString()}
          </small>
        </div>
      </div>

      <div className="neon-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <h3 className="glow-text-cyan" style={{ margin: 0 }}>
            💰 Registrar Ingreso o Egreso de Caja & Cierre Diario
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={imprimirCierreCajaDiario} className="neon-btn neon-btn-fillCyan">
              🖨️ Imprimir Cierre de Caja Diario
            </button>
            <button type="button" onClick={exportarFinanzasCsv} className="neon-btn neon-btn-green">
              📥 Descargar Libro (.CSV)
            </button>
          </div>
        </div>
        <form onSubmit={registrarMovimientoFinanzas} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select className="neon-select" value={finTipo} onChange={e => setFinTipo(e.target.value as any)} style={{ width: 'auto' }}>
            <option value="ingreso">🟢 Ingreso (+)</option>
            <option value="egreso">🔴 Egreso / Gasto (-)</option>
          </select>
          <input type="text" className="neon-input" placeholder="Concepto (Ej: Pago Comisionista MDP, Insumos)..." required value={finConcepto} onChange={e => setFinConcepto(e.target.value)} style={{ flex: 2, minWidth: '220px' }} />
          <input type="number" className="neon-input" placeholder="Monto $" required value={finMonto} onChange={e => setFinMonto(e.target.value)} style={{ flex: 1, minWidth: '130px' }} />
          <select className="neon-select" value={finMetodo} onChange={e => setFinMetodo(e.target.value as any)} style={{ width: 'auto' }}>
            <option value="efectivo">💵 Efectivo</option>
            <option value="transferencia">🏦 Transferencia</option>
            <option value="mercadopago">📱 Mercado Pago</option>
            <option value="tarjeta">💳 Tarjeta</option>
          </select>
          <button type="submit" className="neon-btn neon-btn-fillCyan">
            + Asentar en Caja
          </button>
        </form>
      </div>

      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <input 
            type="text" 
            className="neon-input" 
            placeholder="🔍 Buscar movimiento por concepto, orden o cliente..." 
            value={filtroBusquedaConcepto} 
            onChange={e => setFiltroBusquedaConcepto(e.target.value)} 
            style={{ flex: 1 }} 
          />
          <select className="neon-select" value={filtroTipoMovimiento} onChange={e => setFiltroTipoMovimiento(e.target.value as any)} style={{ width: 'auto' }}>
            <option value="todos">Ingresos y Egresos</option>
            <option value="ingreso">Solo Ingresos (+)</option>
            <option value="egreso">Solo Egresos (-)</option>
          </select>
          <select className="neon-select" value={filtroMedioPagoFin} onChange={e => setFiltroMedioPagoFin(e.target.value)} style={{ width: 'auto' }}>
            <option value="todos">Todos los Medios</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>

        <table className="neon-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Medio</th>
              <th>Importe</th>
              <th>Comprobante Oficial ARCA</th>
              <th>Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {movimientosFiltrados.map(m => {
              const fechaStr = m.fecha?.seconds ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente';
              return (
                <tr key={m.id}>
                  <td><small style={{ color: 'var(--text-muted)' }}>{fechaStr}</small></td>
                  <td><b>{m.concepto}</b></td>
                  <td style={{ textTransform: 'uppercase', fontSize: '13px' }}>{m.metodoPago}</td>
                  <td className={m.tipo === 'ingreso' ? 'glow-text-green' : 'glow-text-red'} style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    {m.tipo === 'ingreso' ? '+' : '-'}${Number(m.monto || 0).toLocaleString()}
                  </td>
                  <td>
                    {m.factura ? (
                      <button onClick={() => imprimirFacturaARCA(m, datosFiscalesActivos)} className="neon-btn neon-btn-fillCyan">
                        🖨️ FAC {m.factura.tipo} #{m.factura.numero}
                      </button>
                    ) : m.tipo === 'ingreso' ? (
                      <button onClick={() => emitirFacturaArcaDesdeFinanzas(m)} className="neon-btn">
                        🏛️ Emitir Factura ARCA (A/B/C)
                      </button>
                    ) : (
                      <small style={{ color: 'var(--text-muted)' }}>Comprobante Egreso</small>
                    )}
                  </td>
                  <td>
                    <button onClick={() => { if (window.confirm('¿Eliminar asiento de caja?')) deleteDoc(doc(db, 'finanzas', m.id)); }} className="neon-btn neon-btn-red">
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
            {movimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay movimientos registrados con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// --- FIN DEL ARCHIVO MODULOCLIENTESGREMIOFINANZAS.TSX ---