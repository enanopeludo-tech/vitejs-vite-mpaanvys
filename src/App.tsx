// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, addDoc, serverTimestamp, query, onSnapshot, getDocs, where,
  doc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 
import { 
  CONFIG_DEFAULT, PERMISOS_DEFAULT_POR_ROL, 
  LISTA_MODULOS_PERMISOS, aplicarRedondeo, getEstilosTema, imprimirFacturaARCA 
} from './estilosTema';
import { TiendaPublica } from './modulos/TiendaPublica';
import { ModuloCatalogo } from './modulos/ModuloCatalogo';
import { ModuloProveedoresExcel } from './modulos/ModuloProveedoresExcel';
import { ModuloTaller } from './modulos/ModuloTaller';
import { ModuloPresupuestos } from './modulos/ModuloPresupuestos';

const Seguimiento = () => {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);

  const ejecutarBusqueda = async (codBuscar: string) => {
    if (!codBuscar) return;
    const q = query(collection(db, 'ordenes_taller'), where('codigoSeguimiento', '==', codBuscar.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) alert('Orden no encontrada.'); else setResultado(snap.docs[0].data());
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codUrl = params.get('codigo');
    if (codUrl) { setCodigo(codUrl.toUpperCase()); ejecutarBusqueda(codUrl); }
  }, []);

  return (
    <div style={{ padding: '50px 20px', maxWidth: '680px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 className="glow-text-cyan">🔍 Rastreo de Servicio Técnico</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Ingresa el código de 6 dígitos o escanea el QR de tu comprobante</p>
        <form onSubmit={(e) => { e.preventDefault(); ejecutarBusqueda(codigo); }} style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
          <input type="text" className="neon-input" placeholder="CÓDIGO (EJ: X9B2V)" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ textAlign: 'center', letterSpacing: '3px', fontSize: '19px', fontWeight: 'bold' }} maxLength={6}/>
          <button type="submit" className="neon-btn neon-btn-fillCyan">Consultar</button>
        </form>
      </div>

      {resultado && (
        <div className="neon-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SUCURSAL RECEPTORA: {resultado.tallerOrigen || 'CENTRAL'}</span>
              <h3 style={{ margin: 0 }}>{resultado.equipo.marca} {resultado.equipo.modelo}</h3>
            </div>
            <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.15)', color: 'var(--neon-cyan)' }}>#{resultado.codigoSeguimiento}</span>
          </div>
          <p style={{ marginTop: '12px' }}><b>Falla declarada:</b> {resultado.fallaDeclarada}</p>
          <div style={{ background: 'var(--bg-input)', padding: '18px', borderRadius: '14px', textAlign: 'center', margin: '18px 0', border: '1px solid var(--neon-cyan)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ESTADO ACTUAL DEL EQUIPO</span>
            <h2 className="glow-text-cyan" style={{ margin: '6px 0 0 0', textTransform: 'uppercase' }}>{resultado.estado}</h2>
            {resultado.costoReparacion && <h3 className="glow-text-green" style={{ margin: '10px 0 0 0' }}>Importe al Cliente: ${resultado.costoReparacion}</h3>}
          </div>
          <h4 className="glow-text-cyan">📋 Bitácora Técnica:</h4>
          <div style={{ borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '15px', marginLeft: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resultado.historial?.map((h:any, i:number) => (
              <div key={i}>
                <b className="glow-text-cyan" style={{ textTransform: 'uppercase', fontSize: '13px' }}>{h.estado}</b>
                <div style={{ fontSize: '16px' }}>{h.comentario}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🕒 {h.fecha}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LoginAdmin = () => {
  const [e, setE] = useState(''); const [p, setP] = useState('');
  const navigate = useNavigate();
  return (
    <div style={{ padding: '80px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center' }}>
        <h2 className="glow-text-cyan">🔐 Acceso al Sistema</h2>
        <form onSubmit={async (ev) => { ev.preventDefault(); try { await signInWithEmailAndPassword(auth, e, p); navigate('/admin-panel'); } catch (err) { alert('Usuario o contraseña incorrectos'); } }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          <input type="email" className="neon-input" placeholder="Email de Usuario" value={e} onChange={ex => setE(ex.target.value)} required/>
          <input type="password" className="neon-input" placeholder="Contraseña" value={p} onChange={ex => setP(ex.target.value)} required/>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>Ingresar a mi Panel ➔</button>
        </form>
      </div>
    </div>
  );
};

const DashboardTaller = ({ user }: { user: User }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidosWeb, setPedidosWeb] = useState<any[]>([]); 
  const [movimientosFinanzas, setMovimientosFinanzas] = useState<any[]>([]); 
  const [usuariosRoles, setUsuariosRoles] = useState<any[]>([]);
  const [talleresGremio, setTalleresGremio] = useState<any[]>([]);
  const [rmas, setRmas] = useState<any[]>([]);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [pestaña, setPestaña] = useState('dashboard'); 
  const [escaneandoPara, setEscaneandoPara] = useState<'formulario' | 'buscador' | null>(null);

  // Estados POS
  const [carritoPOS, setCarritoPOS] = useState<any[]>([]);
  const [busquedaPOS, setBusquedaPOS] = useState('');
  const [metodoPagoPOS, setMetodoPagoPOS] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'>('efectivo');
  const [clientePOS, setClientePOS] = useState('Consumidor Final');
  const [cuitPOS, setCuitPOS] = useState('');
  const [condicionIvaPOS, setCondicionIvaPOS] = useState('Consumidor Final');
  const [tipoFacturaPOS, setTipoFacturaPOS] = useState<'SIN_FACTURA' | 'C' | 'B' | 'A'>('SIN_FACTURA');

  // Estados Locales Gremio
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

  // Estados RMA, Finanzas y Usuarios
  const [rmaTipo, setRmaTipo] = useState<'proveedor' | 'cliente'>('proveedor');
  const [rmaProducto, setRmaProducto] = useState('');
  const [rmaEntidad, setRmaEntidad] = useState('');
  const [rmaMotivo, setRmaMotivo] = useState('');
  const [rmaMonto, setRmaMonto] = useState('');
  const [finTipo, setFinTipo] = useState('ingreso');
  const [finConcepto, setFinConcepto] = useState('');
  const [finMonto, setFinMonto] = useState('');
  const [finMetodo, setFinMetodo] = useState('efectivo');
  const [filtroBusquedaConcepto, setFiltroBusquedaConcepto] = useState('');

  const [idUsuarioEditando, setIdUsuarioEditando] = useState<string | null>(null);
  const [nuevoUserEmail, setNuevoUserEmail] = useState('');
  const [nuevoUserPassword, setNuevoUserPassword] = useState('');
  const [nuevoUserNombre, setNuevoUserNombre] = useState('');
  const [nuevoUserRol, setNuevoUserRol] = useState<string>('recepcion_ordenes');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>(PERMISOS_DEFAULT_POR_ROL['recepcion_ordenes']);
  const [creandoEmpleado, setCreandoEmpleado] = useState(false);

  const [conf, setConf] = useState<any>(CONFIG_DEFAULT);
  const [fiscalesLocal, setFiscalesLocal] = useState<any>({
    razonSocial: '', cuit: '', condicionIva: 'Responsable Monotributo', puntoVentaArca: '00001', ingresosBrutos: '', inicioActividades: '01/01/2023'
  });

  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement('script'); script.src = "https://unpkg.com/xlsx/dist/xlsx.full.min.js"; script.async = true; document.body.appendChild(script);
    }
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => { 
      if (docSnap.exists()) { const data = docSnap.data(); setConfig({ ...CONFIG_DEFAULT, ...data }); setConf({ ...CONFIG_DEFAULT, ...data }); } 
    });
    const unsubOrd = onSnapshot(query(collection(db, 'ordenes_taller')), (snap) => setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fechaIngreso?.seconds - a.fechaIngreso?.seconds)));
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snap) => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPedidos = onSnapshot(query(collection(db, 'pedidos_ecommerce')), (snap) => setPedidosWeb(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    const unsubFinanzas = onSnapshot(query(collection(db, 'finanzas')), (snap) => setMovimientosFinanzas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    const unsubRoles = onSnapshot(query(collection(db, 'usuarios_roles')), (snap) => setUsuariosRoles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTalleres = onSnapshot(query(collection(db, 'talleres_gremio')), (snap) => setTalleresGremio(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRmas = onSnapshot(query(collection(db, 'rmas_garantias')), (snap) => setRmas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPres = onSnapshot(query(collection(db, 'presupuestos')), (snap) => setPresupuestos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    return () => { unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); unsubFinanzas(); unsubRoles(); unsubTalleres(); unsubRmas(); unsubPres(); };
  }, []);

  const sucursalDirecta = talleresGremio.find(t => t.email?.toLowerCase() === user.email?.toLowerCase());
  const registroRolActual = usuariosRoles.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
  const sucursalPorEmpleado = (!sucursalDirecta && registroRolActual?.tenantId && registroRolActual.tenantId !== 'MASTER')
    ? talleresGremio.find(t => t.id === registroRolActual.tenantId) : null;

  const sucursalAsociada = sucursalDirecta || sucursalPorEmpleado;
  const esSucursalExterna = Boolean(sucursalAsociada);
  const tenantId = esSucursalExterna ? sucursalAsociada.id : 'MASTER';
  const nombreNegocioActivo = esSucursalExterna ? sucursalAsociada.nombre : config.empresaNombre;
  const direccionNegocioActivo = esSucursalExterna ? `${sucursalAsociada.direccion || ''} (${sucursalAsociada.ciudad || ''})` : config.direccion;
  const whatsappNegocioActivo = esSucursalExterna ? sucursalAsociada.telefono : config.whatsapp;

  useEffect(() => {
    if (sucursalAsociada) {
      setFiscalesLocal({
        razonSocial: sucursalAsociada.razonSocial || sucursalAsociada.encargado || sucursalAsociada.nombre,
        cuit: sucursalAsociada.cuit || '', condicionIva: sucursalAsociada.condicionIva || 'Responsable Monotributo',
        puntoVentaArca: sucursalAsociada.puntoVentaArca || '00001', ingresosBrutos: sucursalAsociada.ingresosBrutos || '',
        inicioActividades: sucursalAsociada.inicioActividades || '01/01/2023'
      });
    }
  }, [sucursalAsociada]);

  const datosFiscalesActivos = esSucursalExterna ? { ...fiscalesLocal, empresaNombre: sucursalAsociada.nombre, direccion: direccionNegocioActivo } : config;

  const rolNormalizado = sucursalDirecta ? 'admin' : (registroRolActual ? registroRolActual.rol : 'admin');
  const tienePermisoModulo = (moduloId: string) => {
    if (sucursalDirecta || !registroRolActual || rolNormalizado === 'admin') return true;
    if (Array.isArray(registroRolActual.permisos) && registroRolActual.permisos.length > 0) return registroRolActual.permisos.includes(moduloId);
    return (PERMISOS_DEFAULT_POR_ROL[rolNormalizado] || []).includes(moduloId);
  };
  const esAdminDelNegocioActivo = rolNormalizado === 'admin' || tienePermisoModulo('configuracion');

  const restaurarSuperAdmin = async () => {
    if (registroRolActual) {
      await deleteDoc(doc(db, 'usuarios_roles', registroRolActual.id));
      alert('👑 ¡Privilegios de Administrador Total restaurados!');
    }
  };

  const misProductos = productos.filter(p => (p.ownerId || 'MASTER') === tenantId);
  const misFinanzas = movimientosFinanzas.filter(m => (m.ownerId || 'MASTER') === tenantId);
  const misPedidosWeb = pedidosWeb.filter(p => (p.ownerId || 'MASTER') === tenantId);
  const misEmpleados = usuariosRoles.filter(u => (u.tenantId || 'MASTER') === tenantId);
  const misPresupuestos = presupuestos.filter(pr => (pr.ownerId || 'MASTER') === tenantId);
  const misOrdenesTaller = esSucursalExterna 
    ? ordenes.filter(o => o.tallerId === sucursalAsociada.id || o.tallerOrigen === sucursalAsociada.nombre) : ordenes;

  const generarDatosFacturaARCA = (tipoCmp: string, cuitReceptor: string, razonReceptor: string, condIvaReceptor: string, caeManual?: string) => {
    const ptoVta = String(datosFiscalesActivos.puntoVentaArca || "00001").padStart(5, "0");
    const proximoNumero = String(misFinanzas.filter(m => m.factura && m.factura.tipo === tipoCmp).length + 1).padStart(8, "0");
    const vto = new Date(); vto.setDate(vto.getDate() + 10);
    return {
      tipo: tipoCmp, puntoVenta: ptoVta, numero: `${ptoVta}-${proximoNumero}`,
      cuit: cuitReceptor || "00-00000000-0", razonSocialReceptor: razonReceptor || "Consumidor Final",
      condicionIvaReceptor: condIvaReceptor || "Consumidor Final",
      cae: caeManual || ("74" + Math.floor(100000000000 + Math.random() * 900000000000).toString()),
      vtoCae: vto.toLocaleDateString(), fechaEmision: new Date().toLocaleDateString()
    };
  };

  // --- Funciones POS ---
  const subtotalPOS = carritoPOS.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const ajusteFinancieroPOS = metodoPagoPOS === 'efectivo' ? -Math.round(subtotalPOS * (Number(config.descuentoEfectivoPorcentaje || 0) / 100)) : metodoPagoPOS === 'tarjeta' ? Math.round(subtotalPOS * (Number(config.recargoTarjetaPorcentaje || 0) / 100)) : 0;
  const totalFinalPOS = aplicarRedondeo(subtotalPOS + ajusteFinancieroPOS, config.redondeoPrecios);

  const cobrarVentaPOS = async () => {
    if (carritoPOS.length === 0) return;
    for (const item of carritoPOS) {
      const prodReal = misProductos.find(p => p.id === item.id);
      if (prodReal) await updateDoc(doc(db, 'productos', item.id), { stock: Math.max(0, prodReal.stock - item.cantidad), ventas: (prodReal.ventas || 0) + item.cantidad });
    }
    const facturaArcaObj = tipoFacturaPOS !== 'SIN_FACTURA' ? generarDatosFacturaARCA(tipoFacturaPOS, cuitPOS, clientePOS, condicionIvaPOS) : null;
    const itemsVenta = carritoPOS.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }));
    const docRef = await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId, tipo: 'ingreso', concepto: `Venta POS Mostrador (${clientePOS})`,
      monto: totalFinalPOS, metodoPago: metodoPagoPOS, fecha: serverTimestamp(), usuario: user.email, items: itemsVenta, factura: facturaArcaObj
    });
    if (facturaArcaObj) imprimirFacturaARCA({ id: docRef.id, monto: totalFinalPOS, metodoPago: metodoPagoPOS, items: itemsVenta, factura: facturaArcaObj }, datosFiscalesActivos);
    else alert(`⚡ Cobro de $${totalFinalPOS.toLocaleString()} registrado.`);
    setCarritoPOS([]); setClientePOS('Consumidor Final'); setCuitPOS(''); setTipoFacturaPOS('SIN_FACTURA');
  };

  // --- Funciones Locales y Usuarios (Con Reutilización de Correo y Permisos) ---
  const guardarTallerGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoCuentaLocal(true);
    try {
      const emailLimpio = tallerEmail.trim().toLowerCase();
      if (idTallerEditando) {
        await updateDoc(doc(db, 'talleres_gremio', idTallerEditando), { nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, direccion: tallerDireccion, email: emailLimpio, ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0 });
        setIdTallerEditando(null); setTallerNom(''); setTallerEmail('');
        return alert('Local actualizado.');
      }
      if (tallerPassword && tallerPassword.length >= 6) {
        const secondaryApp = getApps().find(a => a.name === "SecondaryCreatorApp") || initializeApp(auth.app.options, "SecondaryCreatorApp");
        const secondaryAuth = getAuth(secondaryApp);
        try { await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, tallerPassword); await signOut(secondaryAuth); }
        catch (authErr: any) { if (authErr.code !== 'auth/email-already-in-use') throw authErr; }
      }
      const existenteEnBd = talleresGremio.find(t => t.email?.toLowerCase() === emailLimpio);
      if (existenteEnBd) {
        await updateDoc(doc(db, 'talleres_gremio', existenteEnBd.id), { nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, direccion: tallerDireccion, email: emailLimpio, ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0, activo: true });
      } else {
        await addDoc(collection(db, 'talleres_gremio'), { nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, direccion: tallerDireccion, email: emailLimpio, ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0, saldoDeudor: 0, activo: true, fechaAlta: serverTimestamp() });
      }
      setTallerNom(''); setTallerEmail(''); setTallerPassword('');
      alert(`🏢 Local habilitado.`);
    } catch (err: any) { alert(err.message); } finally { setCreandoCuentaLocal(false); }
  };

  const togglePermisoIndividual = (idModulo: string) => {
    setPermisosSeleccionados(prev => prev.includes(idModulo) ? prev.filter(p => p !== idModulo) : [...prev, idModulo]);
  };

  const guardarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpio = nuevoUserEmail.trim().toLowerCase();
    setCreandoEmpleado(true);
    try {
      if (idUsuarioEditando) {
        await updateDoc(doc(db, 'usuarios_roles', idUsuarioEditando), { nombre: nuevoUserNombre, email: emailLimpio, rol: nuevoUserRol, permisos: permisosSeleccionados, activo: true });
        setIdUsuarioEditando(null); setNuevoUserNombre(''); setNuevoUserEmail('');
        return alert('✅ Permisos actualizados.');
      }
      if (nuevoUserPassword && nuevoUserPassword.length >= 6) {
        const secondaryApp = getApps().find(a => a.name === "SecondaryCreatorApp") || initializeApp(auth.app.options, "SecondaryCreatorApp");
        const secondaryAuth = getAuth(secondaryApp);
        try { await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, nuevoUserPassword); await signOut(secondaryAuth); }
        catch (authErr: any) { if (authErr.code !== 'auth/email-already-in-use') throw authErr; }
      }
      const docExistente = usuariosRoles.find(u => u.email?.toLowerCase() === emailLimpio);
      if (docExistente) {
        await updateDoc(doc(db, 'usuarios_roles', docExistente.id), { tenantId, nombreNegocio: nombreNegocioActivo, nombre: nuevoUserNombre, email: emailLimpio, rol: nuevoUserRol, permisos: permisosSeleccionados, activo: true });
      } else {
        await addDoc(collection(db, 'usuarios_roles'), { tenantId, nombreNegocio: nombreNegocioActivo, email: emailLimpio, nombre: nuevoUserNombre, rol: nuevoUserRol, permisos: permisosSeleccionados, activo: true, fecha: serverTimestamp() });
      }
      setNuevoUserNombre(''); setNuevoUserEmail(''); setNuevoUserPassword('');
      alert('✅ Usuario habilitado.');
    } catch (err: any) { alert(err.message); } finally { setCreandoEmpleado(false); }
  };

  if ((registroRolActual && registroRolActual.activo === false) || (sucursalAsociada && sucursalAsociada.activo === false)) {
    return (
      <div style={{ padding: '80px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div className="neon-card neon-card-pink">
          <h2 className="glow-text-red">🚫 Acceso Suspendido</h2>
          <p>Tu cuenta ({user.email}) se encuentra temporalmente desactivada por el Administrador.</p>
          <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red">Cerrar Sesión</button>
        </div>
      </div>
    );
  }

  const movimientosFiltrados = misFinanzas.filter(m => !filtroBusquedaConcepto || m.concepto.toLowerCase().includes(filtroBusquedaConcepto.toLowerCase()));
  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const equiposEnBanco = misOrdenesTaller.filter(o => o.estado !== 'entregado' && o.estado !== 'reparado').length;
  const urlVitrinaPropia = esSucursalExterna ? `${window.location.origin}/?tienda=${sucursalAsociada.id}` : window.location.origin;

  return (
    <div className="erp-layout">
      {escaneandoPara && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <h3 className="glow-text-cyan">📷 Escáner Activo</h3>
            <div id="reader" style={{ width: '100%', borderRadius: '12px', background: '#fff' }}></div>
            <button onClick={() => setEscaneandoPara(null)} className="neon-btn neon-btn-red" style={{ marginTop: '15px', width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      <aside className="erp-sidebar">
        <div style={{ padding: '8px 10px 15px 10px', borderBottom: '1px solid rgba(128,128,128,0.18)', marginBottom: '6px' }}>
          <div className="glow-text-cyan" style={{ fontWeight: 800, fontSize: '16px' }}>{nombreNegocioActivo}</div>
          <small style={{ color: 'var(--text-muted)' }}>CUIT: {datosFiscalesActivos.cuit}</small>
        </div>

        {!esSucursalExterna && rolNormalizado !== 'admin' && (
          <button onClick={restaurarSuperAdmin} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', marginBottom: '10px' }}>👑 Recuperar SuperAdmin</button>
        )}

        {tienePermisoModulo('dashboard') && <button onClick={() => setPestaña('dashboard')} className={`neon-btn side-btn ${pestaña === 'dashboard' ? 'active' : ''}`}>📊 1. Mi Resumen & Tienda</button>}
        {tienePermisoModulo('pos') && <button onClick={() => setPestaña('pos')} className={`neon-btn side-btn ${pestaña === 'pos' ? 'active' : ''}`}>🛒 2. Caja POS & ARCA</button>}
        {tienePermisoModulo('presupuestos') && <button onClick={() => setPestaña('presupuestos')} className={`neon-btn side-btn ${pestaña === 'presupuestos' ? 'active' : ''}`}>📄 3. Presupuestos ({misPresupuestos.length})</button>}
        {tienePermisoModulo('taller') && <button onClick={() => setPestaña('taller')} className={`neon-btn side-btn ${pestaña === 'taller' ? 'active' : ''}`}>🛠️ 4. Órdenes Taller ({equiposEnBanco})</button>}
        {!esSucursalExterna && esAdminDelNegocioActivo && <button onClick={() => setPestaña('talleres_b2b')} className={`neon-btn side-btn ${pestaña === 'talleres_b2b' ? 'active' : ''}`}>🏢 5. Red Locales ({talleresGremio.length})</button>}
        {tienePermisoModulo('catalogo') && <button onClick={() => setPestaña('catalogo')} className={`neon-btn side-btn ${pestaña === 'catalogo' ? 'active' : ''}`}>📦 6. Stock, Inflación y URL</button>}
        {tienePermisoModulo('rma') && <button onClick={() => setPestaña('rma')} className={`neon-btn side-btn ${pestaña === 'rma' ? 'active' : ''}`}>🔄 7. Garantías & RMA</button>}
        {tienePermisoModulo('pedidos') && <button onClick={() => setPestaña('pedidos')} className={`neon-btn side-btn ${pestaña === 'pedidos' ? 'active' : ''}`}>🌐 8. Mis Pedidos Web</button>}
        {tienePermisoModulo('proveedores') && <button onClick={() => setPestaña('proveedores')} className={`neon-btn side-btn ${pestaña === 'proveedores' ? 'active' : ''}`}>🚚 9. Importar Excel y Web</button>}
        {tienePermisoModulo('finanzas') && <button onClick={() => setPestaña('finanzas')} className={`neon-btn side-btn ${pestaña === 'finanzas' ? 'active' : ''}`}>💰 10. Finanzas & ARCA</button>}
        {esAdminDelNegocioActivo && <button onClick={() => setPestaña('configuracion')} className={`neon-btn side-btn ${pestaña === 'configuracion' ? 'active' : ''}`}>🛡️ 11. ARCA, URLs y Usuarios</button>}

        <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: 'auto', width: '100%' }}>🚪 Cerrar Sesión</button>
      </aside>

      <main className="erp-main">
        {pestaña === 'dashboard' && (
          <div className="neon-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>📊 Panel Principal // {nombreNegocioActivo}</h2>
              <span>Tienda Oficial: <a href={urlVitrinaPropia} target="_blank" rel="noreferrer" className="glow-text-green" style={{ fontWeight: 'bold' }}>{urlVitrinaPropia}</a></span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setPestaña('catalogo')} className="neon-btn neon-btn-fillCyan">📈 Ir a Ajuste de Inflación / Stock</button>
              <button onClick={() => setPestaña('proveedores')} className="neon-btn neon-btn-purple">🌐 Traer Artículos por URL</button>
            </div>
          </div>
        )}

        {pestaña === 'catalogo' && (
          <ModuloCatalogo tenantId={tenantId} nombreNegocioActivo={nombreNegocioActivo} misProductos={misProductos} config