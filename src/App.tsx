// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  onSnapshot, 
  getDocs, 
  where,
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 
import { 
  CONFIG_DEFAULT, 
  PERMISOS_DEFAULT_POR_ROL, 
  LISTA_MODULOS_PERMISOS, 
  aplicarRedondeo, 
  getEstilosTema, 
  imprimirFacturaARCA,
  obtenerDolarDesdeWeb
} from './estilosTema';
import { TiendaPublica } from './modulos/TiendaPublica';
import { ModuloCatalogo } from './modulos/ModuloCatalogo';
import { ModuloProveedoresExcel } from './modulos/ModuloProveedoresExcel';
import { ModuloTaller } from './modulos/ModuloTaller';
import { ModuloPresupuestos } from './modulos/ModuloPresupuestos';
import { ModuloRmaGarantias } from './modulos/ModuloRmaGarantias';

const Seguimiento = () => {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);

  const ejecutarBusqueda = async (codBuscar: string) => {
    if (!codBuscar) return;
    const q = query(
      collection(db, 'ordenes_taller'), 
      where('codigoSeguimiento', '==', codBuscar.trim().toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      alert('Orden no encontrada.');
    } else {
      setResultado(snap.docs[0].data());
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codUrl = params.get('codigo');
    if (codUrl) {
      setCodigo(codUrl.toUpperCase());
      ejecutarBusqueda(codUrl);
    }
  }, []);

  return (
    <div style={{ padding: '50px 20px', maxWidth: '680px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 className="glow-text-cyan">🔍 Rastreo de Servicio Técnico</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Ingresa el código de 6 dígitos o escanea el QR de tu comprobante
        </p>
        <form 
          onSubmit={(e) => { e.preventDefault(); ejecutarBusqueda(codigo); }} 
          style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}
        >
          <input 
            type="text" 
            className="neon-input" 
            placeholder="CÓDIGO (EJ: X9B2V)" 
            value={codigo} 
            onChange={e => setCodigo(e.target.value)} 
            style={{ textAlign: 'center', letterSpacing: '3px', fontSize: '19px', fontWeight: 'bold' }} 
            maxLength={6}
          />
          <button type="submit" className="neon-btn neon-btn-fillCyan">
            Consultar
          </button>
        </form>
      </div>

      {resultado && (
        <div className="neon-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                SUCURSAL RECEPTORA: {resultado.tallerOrigen || 'CENTRAL'}
              </span>
              <h3 style={{ margin: 0 }}>
                {resultado.equipo.marca} {resultado.equipo.modelo}
              </h3>
            </div>
            <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.15)', color: 'var(--neon-cyan)' }}>
              #{resultado.codigoSeguimiento}
            </span>
          </div>
          <p style={{ marginTop: '12px' }}>
            <b>Falla declarada:</b> {resultado.fallaDeclarada}
          </p>
          <div style={{ background: 'var(--bg-input)', padding: '18px', borderRadius: '14px', textAlign: 'center', margin: '18px 0', border: '1px solid var(--neon-cyan)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ESTADO ACTUAL DEL EQUIPO
            </span>
            <h2 className="glow-text-cyan" style={{ margin: '6px 0 0 0', textTransform: 'uppercase' }}>
              {resultado.estado}
            </h2>
            {resultado.costoReparacion && (
              <h3 className="glow-text-green" style={{ margin: '10px 0 0 0' }}>
                Importe al Cliente: ${resultado.costoReparacion}
              </h3>
            )}
          </div>
          <h4 className="glow-text-cyan">📋 Bitácora Técnica:</h4>
          <div style={{ borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '15px', marginLeft: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resultado.historial?.map((h: any, i: number) => (
              <div key={i}>
                <b className="glow-text-cyan" style={{ textTransform: 'uppercase', fontSize: '13px' }}>
                  {h.estado}
                </b>
                <div style={{ fontSize: '16px' }}>{h.comentario}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  🕒 {h.fecha}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LoginAdmin = () => {
  const [e, setE] = useState('');
  const [p, setP] = useState('');
  const navigate = useNavigate();

  const iniciar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, e, p);
      navigate('/admin-panel');
    } catch (err) {
      alert('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div style={{ padding: '80px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center' }}>
        <h2 className="glow-text-cyan">🔐 Acceso al Sistema</h2>
        <form onSubmit={iniciar} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          <input 
            type="email" 
            className="neon-input" 
            placeholder="Email de Usuario" 
            value={e} 
            onChange={ex => setE(ex.target.value)} 
            required
          />
          <input 
            type="password" 
            className="neon-input" 
            placeholder="Contraseña" 
            value={p} 
            onChange={ex => setP(ex.target.value)} 
            required
          />
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>
            Ingresar a mi Panel ➔
          </button>
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
  const [sincronizandoDolar, setSincronizandoDolar] = useState(false);

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

  // Estados Finanzas y Usuarios
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
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>(
    PERMISOS_DEFAULT_POR_ROL['recepcion_ordenes']
  );
  const [creandoEmpleado, setCreandoEmpleado] = useState(false);

  const [conf, setConf] = useState<any>(CONFIG_DEFAULT);
  const [fiscalesLocal, setFiscalesLocal] = useState<any>({
    razonSocial: '', 
    cuit: '', 
    condicionIva: 'Responsable Monotributo', 
    puntoVentaArca: '00001', 
    ingresosBrutos: '', 
    inicioActividades: '01/01/2023'
  });

  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/xlsx/dist/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => { 
      if (docSnap.exists()) { 
        const data = docSnap.data(); 
        setConfig({ ...CONFIG_DEFAULT, ...data }); 
        setConf({ ...CONFIG_DEFAULT, ...data }); 
      } 
    });
    const unsubOrd = onSnapshot(query(collection(db, 'ordenes_taller')), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrdenes(lista.sort((a: any, b: any) => b.fechaIngreso?.seconds - a.fechaIngreso?.seconds));
    });
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPedidos = onSnapshot(query(collection(db, 'pedidos_ecommerce')), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPedidosWeb(lista.sort((a: any, b: any) => b.fecha?.seconds - a.fecha?.seconds));
    });
    const unsubFinanzas = onSnapshot(query(collection(db, 'finanzas')), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMovimientosFinanzas(lista.sort((a: any, b: any) => b.fecha?.seconds - a.fecha?.seconds));
    });
    const unsubRoles = onSnapshot(query(collection(db, 'usuarios_roles')), (snap) => {
      setUsuariosRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTalleres = onSnapshot(query(collection(db, 'talleres_gremio')), (snap) => {
      setTalleresGremio(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRmas = onSnapshot(query(collection(db, 'rmas_garantias')), (snap) => {
      setRmas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPres = onSnapshot(query(collection(db, 'presupuestos')), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPresupuestos(lista.sort((a: any, b: any) => b.fecha?.seconds - a.fecha?.seconds));
    });
    return () => { 
      unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); 
      unsubFinanzas(); unsubRoles(); unsubTalleres(); unsubRmas(); unsubPres(); 
    };
  }, []);

  const sincronizarDolarAhora = async (tipoElegido?: string, mostrarAlerta: boolean = true) => {
    setSincronizandoDolar(true);
    try {
      const fuente = tipoElegido || conf.dolarTipoFuente || 'blue';
      const valorWeb = await obtenerDolarDesdeWeb(fuente);
      if (valorWeb && valorWeb > 0) {
        const ahoraStr = new Date().toLocaleString();
        setConf((prev: any) => ({ ...prev, cotizacionDolar: valorWeb, dolarUltimaSync: ahoraStr }));
        await setDoc(doc(db, 'configuracion', 'general'), { 
          cotizacionDolar: valorWeb, 
          dolarTipoFuente: fuente,
          dolarUltimaSync: ahoraStr 
        }, { merge: true });
        if (mostrarAlerta) {
          alert(`💵 Cotización Dólar (${fuente.toUpperCase()}) actualizada desde la web: $${valorWeb}`);
        }
      } else if (mostrarAlerta) {
        alert('No se pudo leer la cotización web en este momento. Puedes ingresarla manualmente.');
      }
    } finally {
      setSincronizandoDolar(false);
    }
  };

  const sucursalDirecta = talleresGremio.find(
    t => t.email?.toLowerCase() === user.email?.toLowerCase()
  );
  const registroRolActual = usuariosRoles.find(
    u => u.email?.toLowerCase() === user.email?.toLowerCase()
  );
  const sucursalPorEmpleado = (!sucursalDirecta && registroRolActual?.tenantId && registroRolActual.tenantId !== 'MASTER')
    ? talleresGremio.find(t => t.id === registroRolActual.tenantId) 
    : null;

  const sucursalAsociada = sucursalDirecta || sucursalPorEmpleado;
  const esSucursalExterna = Boolean(sucursalAsociada);
  const tenantId = esSucursalExterna ? sucursalAsociada.id : 'MASTER';
  const nombreNegocioActivo = esSucursalExterna ? sucursalAsociada.nombre : config.empresaNombre;
  const direccionNegocioActivo = esSucursalExterna 
    ? `${sucursalAsociada.direccion || ''} (${sucursalAsociada.ciudad || ''})` 
    : config.direccion;
  const whatsappNegocioActivo = esSucursalExterna ? sucursalAsociada.telefono : config.whatsapp;

  useEffect(() => {
    if (sucursalAsociada) {
      setFiscalesLocal({
        razonSocial: sucursalAsociada.razonSocial || sucursalAsociada.encargado || sucursalAsociada.nombre,
        cuit: sucursalAsociada.cuit || '', 
        condicionIva: sucursalAsociada.condicionIva || 'Responsable Monotributo',
        puntoVentaArca: sucursalAsociada.puntoVentaArca || '00001', 
        ingresosBrutos: sucursalAsociada.ingresosBrutos || '',
        inicioActividades: sucursalAsociada.inicioActividades || '01/01/2023'
      });
    }
  }, [sucursalAsociada]);

  const datosFiscalesActivos = esSucursalExterna 
    ? { ...fiscalesLocal, empresaNombre: sucursalAsociada.nombre, direccion: direccionNegocioActivo } 
    : config;

  const rolNormalizado = sucursalDirecta ? 'admin' : (registroRolActual ? registroRolActual.rol : 'admin');

  const tienePermisoModulo = (moduloId: string) => {
    if (sucursalDirecta || !registroRolActual || rolNormalizado === 'admin') return true;
    if (Array.isArray(registroRolActual.permisos) && registroRolActual.permisos.length > 0) {
      return registroRolActual.permisos.includes(moduloId);
    }
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
  const misAccesoriosLocalPOS = misProductos.filter(p => !p.esDeProveedor && p.descripcion !== 'Importado de lista');

  const misFinanzas = movimientosFinanzas.filter(m => (m.ownerId || 'MASTER') === tenantId);
  const misPedidosWeb = pedidosWeb.filter(p => (p.ownerId || 'MASTER') === tenantId);
  const misEmpleados = usuariosRoles.filter(u => (u.tenantId || 'MASTER') === tenantId);
  const misPresupuestos = presupuestos.filter(pr => (pr.ownerId || 'MASTER') === tenantId);
  const misOrdenesTaller = esSucursalExterna 
    ? ordenes.filter(o => o.tallerId === sucursalAsociada.id || o.tallerOrigen === sucursalAsociada.nombre) 
    : ordenes;

  const generarDatosFacturaARCA = (
    tipoCmp: string, 
    cuitReceptor: string, 
    razonReceptor: string, 
    condIvaReceptor: string, 
    caeManual?: string
  ) => {
    const ptoVta = String(datosFiscalesActivos.puntoVentaArca || "00001").padStart(5, "0");
    const cantPrevias = misFinanzas.filter(m => m.factura && m.factura.tipo === tipoCmp).length;
    const proximoNumero = String(cantPrevias + 1).padStart(8, "0");
    const vto = new Date(); 
    vto.setDate(vto.getDate() + 10);
    return {
      tipo: tipoCmp, 
      puntoVenta: ptoVta, 
      numero: `${ptoVta}-${proximoNumero}`,
      cuit: cuitReceptor || "00-00000000-0", 
      razonSocialReceptor: razonReceptor || "Consumidor Final",
      condicionIvaReceptor: condIvaReceptor || "Consumidor Final",
      cae: caeManual || ("74" + Math.floor(100000000000 + Math.random() * 900000000000).toString()),
      vtoCae: vto.toLocaleDateString(), 
      fechaEmision: new Date().toLocaleDateString()
    };
  };

  // --- Funciones POS ---
  const subtotalPOS = carritoPOS.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const ajusteFinancieroPOS = metodoPagoPOS === 'efectivo' 
    ? -Math.round(subtotalPOS * (Number(config.descuentoEfectivoPorcentaje || 0) / 100)) 
    : metodoPagoPOS === 'tarjeta' 
      ? Math.round(subtotalPOS * (Number(config.recargoTarjetaPorcentaje || 0) / 100)) 
      : 0;
  const totalFinalPOS = aplicarRedondeo(subtotalPOS + ajusteFinancieroPOS, config.redondeoPrecios);

  const cobrarVentaPOS = async () => {
    if (carritoPOS.length === 0) return;
    for (const item of carritoPOS) {
      const prodReal = misProductos.find(p => p.id === item.id);
      if (prodReal) {
        await updateDoc(doc(db, 'productos', item.id), { 
          stock: Math.max(0, prodReal.stock - item.cantidad), 
          ventas: (prodReal.ventas || 0) + item.cantidad 
        });
      }
    }
    const facturaArcaObj = tipoFacturaPOS !== 'SIN_FACTURA' 
      ? generarDatosFacturaARCA(tipoFacturaPOS, cuitPOS, clientePOS, condicionIvaPOS) 
      : null;
    const itemsVenta = carritoPOS.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }));
    const docRef = await addDoc(collection(db, 'finanzas'), {
      ownerId: tenantId, 
      tipo: 'ingreso', 
      concepto: `Venta POS Mostrador (${clientePOS})`,
      monto: totalFinalPOS, 
      metodoPago: metodoPagoPOS, 
      fecha: serverTimestamp(), 
      usuario: user.email, 
      items: itemsVenta, 
      factura: facturaArcaObj
    });
    if (facturaArcaObj) {
      imprimirFacturaARCA(
        { id: docRef.id, monto: totalFinalPOS, metodoPago: metodoPagoPOS, items: itemsVenta, factura: facturaArcaObj }, 
        datosFiscalesActivos
      );
    } else {
      alert(`⚡ Cobro de $${totalFinalPOS.toLocaleString()} registrado.`);
    }
    setCarritoPOS([]); 
    setClientePOS('Consumidor Final'); 
    setCuitPOS(''); 
    setTipoFacturaPOS('SIN_FACTURA');
  };

  // --- Funciones Locales y Usuarios ---
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
        setIdTallerEditando(null); 
        setTallerNom(''); 
        setTallerEmail('');
        return alert('Local actualizado.');
      }
      if (tallerPassword && tallerPassword.length >= 6) {
        const secondaryApp = getApps().find(a => a.name === "SecondaryCreatorApp") || initializeApp(auth.app.options, "SecondaryCreatorApp");
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
      setTallerNom(''); 
      setTallerEmail(''); 
      setTallerPassword('');
      alert('🏢 Local habilitado.');
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setCreandoCuentaLocal(false); 
    }
  };

  const togglePermisoIndividual = (idModulo: string) => {
    setPermisosSeleccionados(prev => 
      prev.includes(idModulo) ? prev.filter(p => p !== idModulo) : [...prev, idModulo]
    );
  };

  const guardarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpio = nuevoUserEmail.trim().toLowerCase();
    setCreandoEmpleado(true);
    try {
      if (idUsuarioEditando) {
        await updateDoc(doc(db, 'usuarios_roles', idUsuarioEditando), { 
          nombre: nuevoUserNombre, 
          email: emailLimpio, 
          rol: nuevoUserRol, 
          permisos: permisosSeleccionados, 
          activo: true 
        });
        setIdUsuarioEditando(null); 
        setNuevoUserNombre(''); 
        setNuevoUserEmail('');
        return alert('✅ Permisos actualizados.');
      }
      if (nuevoUserPassword && nuevoUserPassword.length >= 6) {
        const secondaryApp = getApps().find(a => a.name === "SecondaryCreatorApp") || initializeApp(auth.app.options, "SecondaryCreatorApp");
        const secondaryAuth = getAuth(secondaryApp);
        try { 
          await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, nuevoUserPassword); 
          await signOut(secondaryAuth); 
        } catch (authErr: any) { 
          if (authErr.code !== 'auth/email-already-in-use') throw authErr; 
        }
      }
      const docExistente = usuariosRoles.find(u => u.email?.toLowerCase() === emailLimpio);
      if (docExistente) {
        await updateDoc(doc(db, 'usuarios_roles', docExistente.id), { 
          tenantId, 
          nombreNegocio: nombreNegocioActivo, 
          nombre: nuevoUserNombre, 
          email: emailLimpio, 
          rol: nuevoUserRol, 
          permisos: permisosSeleccionados, 
          activo: true 
        });
      } else {
        await addDoc(collection(db, 'usuarios_roles'), { 
          tenantId, 
          nombreNegocio: nombreNegocioActivo, 
          email: emailLimpio, 
          nombre: nuevoUserNombre, 
          rol: nuevoUserRol, 
          permisos: permisosSeleccionados, 
          activo: true, 
          fecha: serverTimestamp() 
        });
      }
      setNuevoUserNombre(''); 
      setNuevoUserEmail(''); 
      setNuevoUserPassword('');
      alert('✅ Usuario habilitado.');
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setCreandoEmpleado(false); 
    }
  };

  if ((registroRolActual && registroRolActual.activo === false) || (sucursalAsociada && sucursalAsociada.activo === false)) {
    return (
      <div style={{ padding: '80px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div className="neon-card neon-card-pink">
          <h2 className="glow-text-red">🚫 Acceso Suspendido</h2>
          <p>Tu cuenta ({user.email}) se encuentra temporalmente desactivada por el Administrador.</p>
          <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red">
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const movimientosFiltrados = misFinanzas.filter(
    m => !filtroBusquedaConcepto || m.concepto.toLowerCase().includes(filtroBusquedaConcepto.toLowerCase())
  );
  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const equiposEnBanco = misOrdenesTaller.filter(o => o.estado !== 'entregado' && o.estado !== 'reparado').length;
  const urlVitrinaPropia = esSucursalExterna 
    ? `${window.location.origin}/?tienda=${sucursalAsociada.id}` 
    : window.location.origin;

  return (
    <div className="erp-layout">
      {escaneandoPara && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <h3 className="glow-text-cyan">📷 Escáner Activo</h3>
            <div id="reader" style={{ width: '100%', borderRadius: '12px', background: '#fff' }}></div>
            <button onClick={() => setEscaneandoPara(null)} className="neon-btn neon-btn-red" style={{ marginTop: '15px', width: '100%' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <aside className="erp-sidebar">
        <div style={{ padding: '8px 10px 15px 10px', borderBottom: '1px solid rgba(128,128,128,0.18)', marginBottom: '6px' }}>
          <div className="glow-text-cyan" style={{ fontWeight: 800, fontSize: '16px' }}>
            {nombreNegocioActivo}
          </div>
          <small style={{ color: 'var(--text-muted)', display: 'block' }}>
            CUIT: {datosFiscalesActivos.cuit}
          </small>
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '5px 10px', borderRadius: '10px' }}>
            <span className="glow-text-green" style={{ fontWeight: 'bold', fontSize: '13px' }}>
              💵 USD: ${config.cotizacionDolar}
            </span>
            {!esSucursalExterna && (
              <button 
                onClick={() => sincronizarDolarAhora(undefined, true)} 
                disabled={sincronizandoDolar}
                className="neon-btn" 
                style={{ padding: '2px 8px', fontSize: '11px' }}
                title="Actualizar Dólar desde la Web"
              >
                {sincronizandoDolar ? '...' : '🔄'}
              </button>
            )}
          </div>
        </div>

        {!esSucursalExterna && rolNormalizado !== 'admin' && (
          <button onClick={restaurarSuperAdmin} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', marginBottom: '10px' }}>
            👑 Recuperar SuperAdmin
          </button>
        )}

        {tienePermisoModulo('dashboard') && (
          <button onClick={() => setPestaña('dashboard')} className={`neon-btn side-btn ${pestaña === 'dashboard' ? 'active' : ''}`}>
            📊 1. Mi Resumen & Tienda
          </button>
        )}
        {tienePermisoModulo('pos') && (
          <button onClick={() => setPestaña('pos')} className={`neon-btn side-btn ${pestaña === 'pos' ? 'active' : ''}`}>
            🛒 2. Caja POS (Accesorios)
          </button>
        )}
        {tienePermisoModulo('presupuestos') && (
          <button onClick={() => setPestaña('presupuestos')} className={`neon-btn side-btn ${pestaña === 'presupuestos' ? 'active' : ''}`}>
            📄 3. Presupuestos ({misPresupuestos.length})
          </button>
        )}
        {tienePermisoModulo('taller') && (
          <button onClick={() => setPestaña('taller')} className={`neon-btn side-btn ${pestaña === 'taller' ? 'active' : ''}`}>
            🛠️ 4. Órdenes Taller ({equiposEnBanco})
          </button>
        )}
        {!esSucursalExterna && esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('talleres_b2b')} className={`neon-btn side-btn ${pestaña === 'talleres_b2b' ? 'active' : ''}`}>
            🏢 5. Red Locales ({talleresGremio.length})
          </button>
        )}
        {tienePermisoModulo('catalogo') && (
          <button onClick={() => setPestaña('catalogo')} className={`neon-btn side-btn ${pestaña === 'catalogo' ? 'active' : ''}`}>
            📦 6. Stock Local y Proveedores
          </button>
        )}
        {tienePermisoModulo('rma') && (
          <button onClick={() => setPestaña('rma')} className={`neon-btn side-btn ${pestaña === 'rma' ? 'active' : ''}`}>
            🔄 7. Garantías & RMA ({rmas.length})
          </button>
        )}
        {tienePermisoModulo('pedidos') && (
          <button onClick={() => setPestaña('pedidos')} className={`neon-btn side-btn ${pestaña === 'pedidos' ? 'active' : ''}`}>
            🌐 8. Mis Pedidos Web
          </button>
        )}
        {tienePermisoModulo('proveedores') && (
          <button onClick={() => setPestaña('proveedores')} className={`neon-btn side-btn ${pestaña === 'proveedores' ? 'active' : ''}`}>
            🚚 9. Importar Excel y Web
          </button>
        )}
        {tienePermisoModulo('finanzas') && (
          <button onClick={() => setPestaña('finanzas')} className={`neon-btn side-btn ${pestaña === 'finanzas' ? 'active' : ''}`}>
            💰 10. Finanzas & ARCA
          </button>
        )}
        {esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('configuracion')} className={`neon-btn side-btn ${pestaña === 'configuracion' ? 'active' : ''}`}>
            🛡️ 11. Dólar, Fletes y Config
          </button>
        )}

        <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: 'auto', width: '100%' }}>
          🚪 Cerrar Sesión
        </button>
      </aside>

      <main className="erp-main">
        {pestaña === 'dashboard' && (
          <div className="neon-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>
                📊 Panel Principal // {nombreNegocioActivo}
              </h2>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                💵 Cotización Dólar Global Activa: <b className="glow-text-green">${config.cotizacionDolar}</b> ({config.dolarTipoFuente?.toUpperCase() || 'BLUE'})
                {config.dolarUltimaSync && ` — Actualizado: ${config.dolarUltimaSync}`}
              </div>
              <span>
                Tienda Oficial:{' '}
                <a href={urlVitrinaPropia} target="_blank" rel="noreferrer" className="glow-text-cyan" style={{ fontWeight: 'bold' }}>
                  {urlVitrinaPropia}
                </a>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => sincronizarDolarAhora(undefined, true)} className="neon-btn neon-btn-green">
                🔄 Sincronizar Dólar Web (${config.cotizacionDolar})
              </button>
              <button onClick={() => setPestaña('configuracion')} className="neon-btn neon-btn-fillCyan">
                🚚 Configurar Fletes y Dólar
              </button>
            </div>
          </div>
        )}

        {pestaña === 'catalogo' && (
          <ModuloCatalogo 
            tenantId={tenantId} 
            nombreNegocioActivo={nombreNegocioActivo} 
            misProductos={misProductos} 
            config={config} 
            setEscaneandoPara={setEscaneandoPara} 
          />
        )}

        {pestaña === 'proveedores' && (
          <ModuloProveedoresExcel 
            tenantId={tenantId} 
            nombreNegocioActivo={nombreNegocioActivo} 
            misProductos={misProductos} 
            config={config} 
          />
        )}

        {pestaña === 'taller' && (
          <ModuloTaller 
            user={user} 
            tenantId={tenantId} 
            esSucursalExterna={esSucursalExterna} 
            sucursalAsociada={sucursalAsociada}
            nombreNegocioActivo={nombreNegocioActivo} 
            esAdminDelNegocioActivo={esAdminDelNegocioActivo}
            misOrdenesTaller={misOrdenesTaller} 
            misProductos={misProductos} 
            talleresGremio={talleresGremio} 
            config={config}
          />
        )}

        {pestaña === 'presupuestos' && (
          <ModuloPresupuestos 
            user={user} 
            tenantId={tenantId} 
            esSucursalExterna={esSucursalExterna} 
            sucursalAsociada={sucursalAsociada}
            nombreNegocioActivo={nombreNegocioActivo} 
            direccionNegocioActivo={direccionNegocioActivo} 
            whatsappNegocioActivo={whatsappNegocioActivo}
            misProductos={misProductos} 
            misPresupuestos={misPresupuestos} 
            config={config} 
            setPestaña={setPestaña}
          />
        )}

        {/* MÓDULO 7: GARANTÍAS & RMA CONECTADO AL NUEVO COMPONENTE MODULAR */}
        {pestaña === 'rma' && (
          <ModuloRmaGarantias 
            user={user}
            tenantId={tenantId}
            esSucursalExterna={esSucursalExterna}
            sucursalAsociada={sucursalAsociada}
            nombreNegocioActivo={nombreNegocioActivo}
            direccionNegocioActivo={direccionNegocioActivo}
            whatsappNegocioActivo={whatsappNegocioActivo}
            misOrdenesTaller={misOrdenesTaller}
            misProductos={misProductos}
            rmas={rmas}
            config={config}
            setPestaña={setPestaña}
          />
        )}

        {pestaña === 'pos' && (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div className="neon-card" style={{ flex: '2 1 480px' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
                🛍️ Venta Mostrador — Stock Exclusivo del Local ({misAccesoriosLocalPOS.length} accesorios)
              </h3>
              <input 
                type="text" 
                className="neon-input" 
                placeholder="🔍 Buscar accesorio o producto del local..." 
                value={busquedaPOS} 
                onChange={e => setBusquedaPOS(e.target.value)} 
                style={{ marginBottom: '12px' }} 
              />
              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Accesorio / Artículo Local</th>
                    <th>Stock</th>
                    <th>Lista</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {misAccesoriosLocalPOS
                    .filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busquedaPOS.toLowerCase()))
                    .slice(0, 15)
                    .map(p => (
                      <tr key={p.id}>
                        <td><b>{p.nombre}</b></td>
                        <td>{p.stock}</td>
                        <td>${p.precio?.toLocaleString()}</td>
                        <td>
                          <button 
                            onClick={() => setCarritoPOS([...carritoPOS, { ...p, cantidad: 1 }])} 
                            className="neon-btn neon-btn-fillCyan"
                          >
                            + Sumar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="neon-card neon-card-green" style={{ flex: '1 1 320px' }}>
              <h3 className="glow-text-green" style={{ marginTop: 0 }}>
                🧾 Cobro & Factura ARCA
              </h3>
              <select 
                className="neon-select" 
                value={tipoFacturaPOS} 
                onChange={e => setTipoFacturaPOS(e.target.value as any)} 
                style={{ marginBottom: '8px' }}
              >
                <option value="SIN_FACTURA">🧾 Ticket Interno</option>
                <option value="C">🏛️ Factura C ARCA</option>
                <option value="B">🏛️ Factura B ARCA</option>
                <option value="A">🏛️ Factura A ARCA</option>
              </select>
              <input 
                type="text" 
                className="neon-input" 
                placeholder="Cliente" 
                value={clientePOS} 
                onChange={e => setClientePOS(e.target.value)} 
                style={{ marginBottom: '8px' }} 
              />
              {tipoFacturaPOS !== 'SIN_FACTURA' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    className="neon-input" 
                    placeholder="CUIT / DNI" 
                    value={cuitPOS} 
                    onChange={e => setCuitPOS(e.target.value)} 
                  />
                  <select 
                    className="neon-select" 
                    value={condicionIvaPOS} 
                    onChange={e => setCondicionIvaPOS(e.target.value)}
                  >
                    <option value="Consumidor Final">Cons. Final</option>
                    <option value="Responsable Monotributo">Monotributo</option>
                    <option value="IVA Responsable Inscripto">Resp. Inscripto</option>
                  </select>
                </div>
              )}
              <select 
                className="neon-select" 
                value={metodoPagoPOS} 
                onChange={e => setMetodoPagoPOS(e.target.value as any)} 
                style={{ marginBottom: '12px' }}
              >
                <option value="efectivo">💵 Efectivo (-{config.descuentoEfectivoPorcentaje}%)</option>
                <option value="transferencia">🏦 Transferencia (Lista)</option>
                <option value="tarjeta">💳 Tarjeta (+{config.recargoTarjetaPorcentaje}%)</option>
              </select>
              <h2 className="glow-text-green">
                Total: ${totalFinalPOS.toLocaleString()}
              </h2>
              <button onClick={cobrarVentaPOS} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
                ✅ Confirmar Cobro
              </button>
            </div>
          </div>
        )}

        {pestaña === 'pedidos' && (
          <div className="neon-card">
            <h3 className="glow-text-pink" style={{ marginTop: 0 }}>
              🌐 Pedidos Web Recibidos
            </h3>
            {misPedidosWeb.map(p => (
              <div key={p.id} style={{ borderBottom: '1px solid rgba(128,128,128,0.15)', padding: '10px 0', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <b>#{p.id.slice(-6).toUpperCase()}</b> - {p.cliente?.nombre} ({p.cliente?.telefono})
                </div>
                <b className="glow-text-green">${p.total?.toLocaleString()}</b>
              </div>
            ))}
          </div>
        )}

        {pestaña === 'talleres_b2b' && (
          <div className="neon-card">
            <h3 className="glow-text-pink" style={{ marginTop: 0 }}>
              🏢 Alta, Edición y Reutilización de Correos de Locales Asociados
            </h3>
            <form onSubmit={guardarTallerGremio} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <input type="text" className="neon-input" placeholder="Nombre del Local *" required value={tallerNom} onChange={e => setTallerNom(e.target.value)} />
              <input type="text" className="neon-input" placeholder="Encargado" value={tallerEncargado} onChange={e => setTallerEncargado(e.target.value)} />
              <input type="text" className="neon-input" placeholder="Ciudad" value={tallerCiudad} onChange={e => setTallerCiudad(e.target.value)} />
              <input type="text" className="neon-input" placeholder="Dirección" value={tallerDireccion} onChange={e => setTallerDireccion(e.target.value)} />
              <input type="text" className="neon-input" placeholder="WhatsApp" value={tallerTel} onChange={e => setTallerTel(e.target.value)} />
              <select className="neon-select" value={tallerNivel} onChange={e => setTallerNivel(e.target.value as any)}>
                <option value="Bronce">Nivel Bronce</option>
                <option value="Oro">Nivel Oro</option>
              </select>
              <input type="number" className="neon-input" placeholder="Límite Cta Cte $" value={tallerLimiteCredito} onChange={e => setTallerLimiteCredito(e.target.value)} />
              <input type="email" className="neon-input" placeholder="Email Admin *" required value={tallerEmail} onChange={e => setTallerEmail(e.target.value)} />
              {!idTallerEditando && (
                <input type="text" className="neon-input" placeholder="Contraseña" value={tallerPassword} onChange={e => setTallerPassword(e.target.value)} />
              )}
              <button type="submit" disabled={creandoCuentaLocal} className="neon-btn neon-btn-fillCyan">
                {idTallerEditando ? '💾 Actualizar' : '🚀 Habilitar Local'}
              </button>
            </form>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Saldo Cta. Cte.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {talleresGremio.map(t => (
                  <tr key={t.id}>
                    <td><b>{t.nombre}</b> ({t.ciudad || 'Local'})</td>
                    <td>{t.email}</td>
                    <td>
                      <button 
                        onClick={() => updateDoc(doc(db, 'talleres_gremio', t.id), { activo: t.activo === false ? true : false })} 
                        className={`neon-btn ${t.activo !== false ? 'neon-btn-green' : 'neon-btn-red'}`} 
                        style={{ padding: '4px 10px' }}
                      >
                        {t.activo !== false ? '🟢 Activo' : '🔴 Suspendido'}
                      </button>
                    </td>
                    <td><b>${Number(t.saldoDeudor || 0).toLocaleString()}</b></td>
                    <td>
                      <button 
                        onClick={() => { 
                          setIdTallerEditando(t.id); 
                          setTallerNom(t.nombre); 
                          setTallerEmail(t.email); 
                          setTallerCiudad(t.ciudad || 'Necochea');
                          setTallerDireccion(t.direccion || ''); 
                          setTallerTel(t.telefono || ''); 
                        }} 
                        className="neon-btn" 
                        style={{ marginRight: '6px' }}
                      >
                        ✏️ Editar
                      </button>
                      <button onClick={() => deleteDoc(doc(db, 'talleres_gremio', t.id))} className="neon-btn neon-btn-red">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pestaña === 'finanzas' && (
          <div className="neon-card">
            <h3 className="glow-text-green" style={{ marginTop: 0 }}>
              💰 Caja y Emisión ARCA (Ingresos: ${totalIngresos.toLocaleString()} | Egresos: ${totalEgresos.toLocaleString()})
            </h3>
            <form 
              onSubmit={async (e) => { 
                e.preventDefault(); 
                await addDoc(collection(db, 'finanzas'), { 
                  ownerId: tenantId, 
                  tipo: finTipo, 
                  concepto: finConcepto, 
                  monto: Number(finMonto), 
                  metodoPago: finMetodo, 
                  fecha: serverTimestamp(), 
                  usuario: user.email 
                }); 
                setFinConcepto(''); setFinMonto(''); 
              }} 
              style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}
            >
              <select className="neon-select" value={finTipo} onChange={e => setFinTipo(e.target.value)} style={{ width: 'auto' }}>
                <option value="ingreso">Ingreso (+)</option>
                <option value="egreso">Egreso (-)</option>
              </select>
              <input type="text" className="neon-input" placeholder="Concepto..." required value={finConcepto} onChange={e => setFinConcepto(e.target.value)} style={{ flex: 2 }} />
              <input type="number" className="neon-input" placeholder="Monto $" required value={finMonto} onChange={e => setFinMonto(e.target.value)} style={{ flex: 1 }} />
              <select className="neon-select" value={finMetodo} onChange={e => setFinMetodo(e.target.value)} style={{ width: 'auto' }}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
              <button type="submit" className="neon-btn neon-btn-fillCyan">
                + Registrar
              </button>
            </form>
            <input 
              type="text" 
              className="neon-input" 
              placeholder="🔍 Filtrar movimientos..." 
              value={filtroBusquedaConcepto} 
              onChange={e => setFiltroBusquedaConcepto(e.target.value)} 
              style={{ marginBottom: '12px' }} 
            />
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Medio</th>
                  <th>Monto</th>
                  <th>Factura Electrónica ARCA</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map(m => (
                  <tr key={m.id}>
                    <td><b>{m.concepto}</b></td>
                    <td style={{ textTransform: 'uppercase' }}>{m.metodoPago}</td>
                    <td className={m.tipo === 'ingreso' ? 'glow-text-green' : 'glow-text-red'}>
                      {m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString()}
                    </td>
                    <td>
                      {m.factura ? (
                        <button onClick={() => imprimirFacturaARCA(m, datosFiscalesActivos)} className="neon-btn neon-btn-fillCyan">
                          🖨️ Imprimir FAC {m.factura.tipo} #{m.factura.numero}
                        </button>
                      ) : (
                        <button 
                          onClick={async () => { 
                            const fac = generarDatosFacturaARCA('C', '', 'Consumidor Final', 'Consumidor Final'); 
                            await updateDoc(doc(db, 'finanzas', m.id), { factura: fac }); 
                            imprimirFacturaARCA({ ...m, factura: fac }, datosFiscalesActivos); 
                          }} 
                          className="neon-btn"
                        >
                          🏛️ Emitir Factura ARCA
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pestaña === 'configuracion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {!esSucursalExterna && (
              <form 
                onSubmit={async (e) => { 
                  e.preventDefault(); 
                  await setDoc(doc(db, 'configuracion', 'general'), conf, { merge: true }); 
                  alert('⚡ Cotización Dólar, Costos de Fletes, Escalas USD y Configuración guardados en todo el sistema.'); 
                }} 
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div className="neon-card neon-card-green">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <h3 className="glow-text-green" style={{ margin: 0 }}>
                      💵 1. Cotización del Dólar Global (Sincronización Web + Edición Manual)
                    </h3>
                    <button 
                      type="button" 
                      onClick={() => sincronizarDolarAhora(conf.dolarTipoFuente, true)} 
                      disabled={sincronizandoDolar} 
                      className="neon-btn neon-btn-green"
                    >
                      {sincronizandoDolar ? 'Consultando Web...' : '🌐 Leer Cotización de la Web Ahora'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div>
                      <label className="label-neon" style={{ color: 'var(--neon-green)' }}>
                        Valor del Dólar Activo ($) — Editable
                      </label>
                      <input 
                        type="number" 
                        className="neon-input" 
                        value={conf.cotizacionDolar} 
                        onChange={e => setConf({ ...conf, cotizacionDolar: Number(e.target.value) })} 
                        style={{ fontWeight: 'bold', fontSize: '18px', borderColor: 'var(--neon-green)' }}
                      />
                    </div>
                    <div>
                      <label className="label-neon">Fuente Web de Referencia</label>
                      <select 
                        className="neon-select" 
                        value={conf.dolarTipoFuente || 'blue'} 
                        onChange={e => setConf({ ...conf, dolarTipoFuente: e.target.value })}
                      >
                        <option value="blue">💵 Dólar Blue (Venta)</option>
                        <option value="oficial">🏦 Dólar Oficial (Venta)</option>
                        <option value="bolsa">📈 Dólar MEP / Bolsa</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '18px' }}>
                      <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                        <input 
                          type="checkbox" 
                          checked={conf.dolarAutoWeb !== false} 
                          onChange={e => setConf({ ...conf, dolarAutoWeb: e.target.checked })} 
                        />{' '}
                        🔄 Sincronizar automáticamente desde la web al iniciar el sistema
                      </label>
                    </div>
                  </div>
                </div>

                <div className="neon-card neon-card-purple">
                  <h3 className="glow-text-pink" style={{ marginTop: 0 }}>
                    🚚 2. Costos de Fletes (Comisionistas), Repartidor Local y Escalas en USD
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>
                        Agenda y Tarifas de Comisionistas / Fletes de Origen (Formato: Nombre y Días:Costo separados por coma)
                      </label>
                      <input 
                        type="text" 
                        className="neon-input" 
                        value={conf.comisionistasLista || ''} 
                        onChange={e => setConf({ ...conf, comisionistasLista: e.target.value })} 
                        placeholder="Comisionista Mar del Plata (Lun/Mié/Vie):4500, Comisionista CABA (Mar/Jue):7500, Sin Flete:0"
                      />
                    </div>
                    <div>
                      <label className="label-neon">🛵 Costo Repartidor / Cadete Local ($)</label>
                      <input 
                        type="number" 
                        className="neon-input" 
                        value={conf.repartidorLocalCosto || 2000} 
                        onChange={e => setConf({ ...conf, repartidorLocalCosto: Number(e.target.value) })} 
                      />
                    </div>
                    <div>
                      <label className="label-neon">📦 Costo Envío Tienda Web ($)</label>
                      <input 
                        type="number" 
                        className="neon-input" 
                        value={conf.envioLocalCosto || 1500} 
                        onChange={e => setConf({ ...conf, envioLocalCosto: Number(e.target.value) })} 
                      />
                    </div>
                    <div>
                      <label className="label-neon">⚠️ Tope USD Gremio sin Seña (USD)</label>
                      <input 
                        type="number" 
                        className="neon-input" 
                        value={conf.topeUsdSinSenaGremio || 70} 
                        onChange={e => setConf({ ...conf, topeUsdSinSenaGremio: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', background: 'var(--bg-input)', padding: '14px', borderRadius: '14px' }}>
                    <div>
                      <label className="label-neon">Escala 1: Hasta USD</label>
                      <input type="number" className="neon-input" value={conf.escala1MaxUsd || 30} onChange={e => setConf({ ...conf, escala1MaxUsd: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Ganancia Central (Esc. 1)</label>
                      <input type="number" className="neon-input" value={conf.escala1MargenPublico || 80} onChange={e => setConf({ ...conf, escala1MargenPublico: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Ganancia Gremio (Esc. 1)</label>
                      <input type="number" className="neon-input" value={conf.escala1MargenGremio || 45} onChange={e => setConf({ ...conf, escala1MargenGremio: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">Escala 2: Hasta USD</label>
                      <input type="number" className="neon-input" value={conf.escala2MaxUsd || 80} onChange={e => setConf({ ...conf, escala2MaxUsd: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Ganancia Central (Esc. 2)</label>
                      <input type="number" className="neon-input" value={conf.escala2MargenPublico || 55} onChange={e => setConf({ ...conf, escala2MargenPublico: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Ganancia Gremio (Esc. 2)</label>
                      <input type="number" className="neon-input" value={conf.escala2MargenGremio || 30} onChange={e => setConf({ ...conf, escala2MargenGremio: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Central (+USD {conf.escala2MaxUsd || 80})</label>
                      <input type="number" className="neon-input" value={conf.escala3MargenPublico || 35} onChange={e => setConf({ ...conf, escala3MargenPublico: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label-neon">% Gremio (+USD {conf.escala2MaxUsd || 80})</label>
                      <input type="number" className="neon-input" value={conf.escala3MargenGremio || 20} onChange={e => setConf({ ...conf, escala3MargenGremio: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>

                <div className="neon-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <h3 className="glow-text-cyan" style={{ gridColumn: '1 / -1', margin: 0 }}>
                    🏛️ 3. Datos Fiscales ARCA, Tarjetas/Cuotas y URL de Catálogo Externo
                  </h3>
                  <div>
                    <label className="label-neon">Razón Social ARCA</label>
                    <input type="text" className="neon-input" value={conf.razonSocial || ''} onChange={e => setConf({ ...conf, razonSocial: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-neon">CUIT ARCA</label>
                    <input type="text" className="neon-input" value={conf.cuit || ''} onChange={e => setConf({ ...conf, cuit: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-neon">Punto de Venta ARCA</label>
                    <input type="text" className="neon-input" value={conf.puntoVentaArca || '00001'} onChange={e => setConf({ ...conf, puntoVentaArca: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-neon">Margen General Stock (%)</label>
                    <input type="number" className="neon-input" value={conf.margenGanancia} onChange={e => setConf({ ...conf, margenGanancia: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label-neon">Descuento Efectivo (%)</label>
                    <input type="number" className="neon-input" value={conf.descuentoEfectivoPorcentaje} onChange={e => setConf({ ...conf, descuentoEfectivoPorcentaje: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label-neon">Recargo Tarjeta 1 Pago (%)</label>
                    <input type="number" className="neon-input" value={conf.recargoTarjeta1Pago || 15} onChange={e => setConf({ ...conf, recargoTarjeta1Pago: Number(e.target.value), recargoTarjetaPorcentaje: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label-neon">Recargo 3 Cuotas (%)</label>
                    <input type="number" className="neon-input" value={conf.recargoTarjeta3Cuotas || 28} onChange={e => setConf({ ...conf, recargoTarjeta3Cuotas: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label-neon">Recargo 6 Cuotas (%)</label>
                    <input type="number" className="neon-input" value={conf.recargoTarjeta6Cuotas || 45} onChange={e => setConf({ ...conf, recargoTarjeta6Cuotas: Number(e.target.value) })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>
                      🌐 URL de Catálogo / Página Externa Vinculada para Traer Artículos y Precios:
                    </label>
                    <input 
                      type="text" 
                      className="neon-input" 
                      value={conf.urlsProveedoresVinculados || ''} 
                      onChange={e => setConf({ ...conf, urlsProveedoresVinculados: e.target.value })} 
                      placeholder="https://api.mercadolibre.com/sites/MLA/search?q=" 
                    />
                  </div>
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ gridColumn: '1 / -1', padding: '15px' }}>
                    💾 Guardar Dólar, Costos de Fletes y Configuración General
                  </button>
                </div>
              </form>
            )}

            <div className="neon-card">
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
                {idUsuarioEditando ? '✏️ Editando Usuario y Permisos' : `🛡️ Gestión de Usuarios, Roles y Permisos (${nombreNegocioActivo})`}
              </h3>
              <form onSubmit={guardarUsuarioRol} style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <input type="text" className="neon-input" placeholder="Nombre *" required value={nuevoUserNombre} onChange={e => setNuevoUserNombre(e.target.value)} />
                  <input type="email" className="neon-input" placeholder="Email (Reutilizable) *" required value={nuevoUserEmail} onChange={e => setNuevoUserEmail(e.target.value)} />
                  {!idUsuarioEditando && (
                    <input type="text" className="neon-input" placeholder="Contraseña" value={nuevoUserPassword} onChange={e => setNuevoUserPassword(e.target.value)} />
                  )}
                  <select 
                    className="neon-select" 
                    value={nuevoUserRol} 
                    onChange={e => { 
                      setNuevoUserRol(e.target.value); 
                      setPermisosSeleccionados(PERMISOS_DEFAULT_POR_ROL[e.target.value] || []); 
                    }}
                  >
                    <option value="recepcion_ordenes">🔧 Recepción y Órdenes</option>
                    <option value="vendedor_admin">💼 Vendedor, Stock y Finanzas</option>
                    <option value="admin">👑 Administrador Total</option>
                    <option value="personalizado">🎛️ Permisos a Medida</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {LISTA_MODULOS_PERMISOS.map(mod => (
                    <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={permisosSeleccionados.includes(mod.id)} 
                        onChange={() => togglePermisoIndividual(mod.id)} 
                      />
                      {mod.label}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={creandoEmpleado} className="neon-btn neon-btn-fillCyan" style={{ flex: 1 }}>
                    {idUsuarioEditando ? '💾 Guardar Cambios del Usuario' : '➕ Habilitar Usuario / Reutilizar Correo'}
                  </button>
                  {idUsuarioEditando && (
                    <button 
                      type="button" 
                      onClick={() => { setIdUsuarioEditando(null); setNuevoUserNombre(''); setNuevoUserEmail(''); }} 
                      className="neon-btn neon-btn-red"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Rol / Módulos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {misEmpleados.map(u => (
                    <tr key={u.id}>
                      <td><b>{u.nombre}</b></td>
                      <td>{u.email}</td>
                      <td>
                        <button 
                          onClick={() => updateDoc(doc(db, 'usuarios_roles', u.id), { activo: u.activo === false ? true : false })} 
                          className={`neon-btn ${u.activo !== false ? 'neon-btn-green' : 'neon-btn-red'}`} 
                          style={{ padding: '4px 10px' }}
                        >
                          {u.activo !== false ? '🟢 Activo' : '🔴 Suspendido'}
                        </button>
                      </td>
                      <td>{u.rol} ({Array.isArray(u.permisos) ? u.permisos.length : 'Todos'} mód.)</td>
                      <td>
                        <button 
                          onClick={() => { 
                            setIdUsuarioEditando(u.id); 
                            setNuevoUserNombre(u.nombre); 
                            setNuevoUserEmail(u.email); 
                            setNuevoUserRol(u.rol); 
                            setPermisosSeleccionados(u.permisos || PERMISOS_DEFAULT_POR_ROL[u.rol] || []); 
                          }} 
                          className="neon-btn" 
                          style={{ marginRight: '6px' }}
                        >
                          ✏️ Editar
                        </button>
                        <button onClick={() => deleteDoc(doc(db, 'usuarios_roles', u.id))} className="neon-btn neon-btn-red">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const RutaProtegida = ({ children, user }: { children: React.ReactNode, user: User | null }) => {
  return user ? <>{children}</> : <Navigate to="/admin-login" />;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null); 
  const [cargando, setCargando] = useState(true);
  const [temaActivo, setTemaActivo] = useState<string>('claro');
  const [fontSizeActivo, setFontSizeActivo] = useState<number>(17);
  const [dolarGlobal, setDolarGlobal] = useState<number>(CONFIG_DEFAULT.cotizacionDolar);
  const [rolesGlobal, setRolesGlobal] = useState<any[]>([]);
  const [talleresGlobal, setTalleresGlobal] = useState<any[]>([]);

  useEffect(() => { 
    const u = onAuthStateChanged(auth, u => { 
      setUser(u); 
      setCargando(false); 
    }); 
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), async (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.temaVisual) setTemaActivo(d.temaVisual);
        if (d.tamanoFuenteBase) setFontSizeActivo(Number(d.tamanoFuenteBase));
        if (d.cotizacionDolar) setDolarGlobal(Number(d.cotizacionDolar));

        if (d.dolarAutoWeb !== false && !(window as any).__dolarSincronizadoHoy) {
          (window as any).__dolarSincronizadoHoy = true;
          const valorWeb = await obtenerDolarDesdeWeb(d.dolarTipoFuente || 'blue');
          if (valorWeb && valorWeb > 0 && valorWeb !== Number(d.cotizacionDolar)) {
            setDolarGlobal(valorWeb);
            await setDoc(doc(db, 'configuracion', 'general'), { 
              cotizacionDolar: valorWeb, 
              dolarUltimaSync: new Date().toLocaleString() 
            }, { merge: true });
          }
        }
      }
    });
    const unsubR = onSnapshot(query(collection(db, 'usuarios_roles')), snap => {
      setRolesGlobal(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubT = onSnapshot(query(collection(db, 'talleres_gremio')), snap => {
      setTalleresGlobal(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u(); unsubConf(); unsubR(); unsubT(); }; 
  }, []);

  useEffect(() => {
    if (!user) {
      document.title = 'Walabba Tecno';
      return;
    }
    const emailActual = user.email?.toLowerCase() || '';
    const perfilEmpleado = rolesGlobal.find(r => r.email?.toLowerCase() === emailActual);
    const perfilTaller = talleresGlobal.find(t => t.email?.toLowerCase() === emailActual);
    const nombreMostrar = perfilEmpleado?.nombre || perfilTaller?.nombre || user.displayName || user.email?.split('@')[0] || 'Admin';
    document.title = `Walabba Tecno + ${nombreMostrar}`;
  }, [user, rolesGlobal, talleresGlobal]);

  if (cargando) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontWeight: 'bold' }}>
        Iniciando Sistema Modular...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <style>{getEstilosTema(temaActivo, fontSizeActivo)}</style>
      <nav className="top-nav-bar">
        <Link to="/" className="glow-text-cyan" style={{ textDecoration: 'none', fontWeight: 800, fontSize: '16px' }}>
          🛍️ Tienda Oficial
        </Link>
        <Link to="/seguimiento" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}>
          🔍 Rastrear Equipo
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="neon-badge" style={{ background: 'rgba(40,205,65,0.14)', color: 'var(--neon-green)', fontSize: '13px' }}>
            💵 Dólar Hoy: ${dolarGlobal}
          </span>
          <select 
            className="neon-select" 
            value={temaActivo} 
            onChange={e => setTemaActivo(e.target.value)} 
            style={{ width: 'auto', padding: '7px 14px', borderRadius: '9999px', fontSize: '13px' }}
          >
            <option value="claro">☀️ Clásico Claro</option>
            <option value="oscuro">🌙 Clásico Oscuro</option>
            <option value="sistema">🖥️ Sistema Auto</option>
            <option value="neon">⚡ Tema Neón</option>
          </select>
          {!user ? (
            <Link to="/admin-login" className="neon-btn" style={{ textDecoration: 'none' }}>
              🔐 Acceso
            </Link>
          ) : (
            <Link to="/admin-panel" className="neon-btn neon-btn-fillCyan" style={{ textDecoration: 'none' }}>
              ⚙️ Mi Panel
            </Link>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<TiendaPublica user={user} />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/admin-login" element={user ? <Navigate to="/admin-panel" /> : <LoginAdmin />} />
        <Route 
          path="/admin-panel" 
          element={
            <RutaProtegida user={user}>
              <DashboardTaller user={user!} />
            </RutaProtegida>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
// --- FIN DEL ARCHIVO APP.TSX ---