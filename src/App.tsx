// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, addDoc, serverTimestamp, query, onSnapshot, getDocs, where,
  doc, updateDoc, deleteDoc, arrayUnion, setDoc, writeBatch 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 
import { CONFIG_DEFAULT, CHECKLIST_ITEMS, aplicarRedondeo, getEstilosTema, imprimirFacturaARCA } from './estilosTema';

const PERMISOS_DEFAULT_POR_ROL: Record<string, string[]> = {
  recepcion_ordenes: ['presupuestos', 'taller', 'rma'],
  vendedor_admin: ['pos', 'presupuestos', 'catalogo', 'pedidos', 'clientes', 'proveedores', 'finanzas'],
  admin: ['dashboard', 'pos', 'presupuestos', 'taller', 'talleres_b2b', 'catalogo', 'rma', 'pedidos', 'clientes', 'proveedores', 'finanzas', 'configuracion']
};

const LISTA_MODULOS_PERMISOS = [
  { id: 'dashboard', label: '📊 Resumen & Tienda' },
  { id: 'pos', label: '🛒 Caja POS & ARCA' },
  { id: 'presupuestos', label: '📄 Presupuestos' },
  { id: 'taller', label: '🛠️ Órdenes de Taller' },
  { id: 'catalogo', label: '📦 Stock y Precios' },
  { id: 'rma', label: '🔄 Garantías & RMA' },
  { id: 'pedidos', label: '🌐 Pedidos Web' },
  { id: 'clientes', label: '👥 Clientes CRM' },
  { id: 'proveedores', label: '🚚 Importar Excel' },
  { id: 'finanzas', label: '💰 Caja y Finanzas' },
  { id: 'configuracion', label: '🛡️ Usuarios y Config' }
];

// ========================================================
// 1. VITRINA COMERCIAL MULTI-TIENDA (AISLADA POR LOCAL)
// ========================================================
const TiendaPublica = ({ user }: { user: User | null }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [productos, setProductos] = useState<any[]>([]);
  const [talleresGremio, setTalleresGremio] = useState<any[]>([]);
  const [usuariosRoles, setUsuariosRoles] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [modoCheckout, setModoCheckout] = useState(false);
  const [pedidoRealizado, setPedidoRealizado] = useState<any | null>(null);
  const [formCheckout, setFormCheckout] = useState({ nombre: '', telefono: '', metodoEnvio: 'retiro', direccion: '', metodoPago: 'transferencia', notas: '' });
  const [procesando, setProcesando] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const tiendaUrlParam = params.get('tienda');

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => {
      if (docSnap.exists()) setConfig({ ...CONFIG_DEFAULT, ...docSnap.data() });
    });
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ idBaseDatos: doc.id, ...doc.data() })));
      setCargando(false);
    });
    const unsubTalleres = onSnapshot(query(collection(db, 'talleres_gremio')), (snapshot) => {
      setTalleresGremio(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRoles = onSnapshot(query(collection(db, 'usuarios_roles')), (snapshot) => {
      setUsuariosRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubConfig(); unsubProd(); unsubTalleres(); unsubRoles(); };
  }, []);

  const tallerComoDueño = talleresGremio.find(t => t.email?.toLowerCase() === user?.email?.toLowerCase());
  const rolComoEmpleado = usuariosRoles.find(u => u.email?.toLowerCase() === user?.email?.toLowerCase());
  const idLocalDelUsuario = tallerComoDueño ? tallerComoDueño.id : (rolComoEmpleado?.tenantId && rolComoEmpleado.tenantId !== 'MASTER' ? rolComoEmpleado.tenantId : null);

  const tiendaIdEfectiva = idLocalDelUsuario ? idLocalDelUsuario : (tiendaUrlParam || 'MASTER');

  const localDueñoVitrina = tiendaIdEfectiva !== 'MASTER' ? talleresGremio.find(t => t.id === tiendaIdEfectiva) : null;
  const nombreVitrina = localDueñoVitrina ? localDueñoVitrina.nombre : config.empresaNombre;
  const direccionVitrina = localDueñoVitrina ? `${localDueñoVitrina.direccion || ''} - ${localDueñoVitrina.ciudad || ''}` : config.direccion;
  const whatsappVitrina = localDueñoVitrina ? localDueñoVitrina.telefono : config.whatsapp;

  const productosDeEstaVitrina = productos.filter(p => (p.ownerId || 'MASTER') === tiendaIdEfectiva);
  const categorias = ['Todas', ...Array.from(new Set(productosDeEstaVitrina.map(p => p.categoria || 'Otros')))];
  const puedeVerPrecios = localDueñoVitrina ? true : (user || config.catalogoPublicoPrecios);

  const productosFiltrados = productosDeEstaVitrina
    .filter(p => 
      (categoriaActiva === 'Todas' || p.categoria === categoriaActiva) &&
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
       (p.codigoBarras && p.codigoBarras.includes(busqueda)))
    )
    .sort((a, b) => (b.destacado && b.stock > 0 ? 1 : 0) - (a.destacado && a.stock > 0 ? 1 : 0));

  const agregarAlCarrito = (producto: any) => {
    const item = carrito.find(i => i.idBaseDatos === producto.idBaseDatos);
    if (item && item.cantidad < producto.stock) {
      setCarrito(carrito.map(i => i.idBaseDatos === producto.idBaseDatos ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else if (!item && producto.stock > 0) {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    } else {
      alert('Stock máximo disponible alcanzado.');
    }
  };

  const totalCarrito = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
  const envioGratis = config.envioGratisDesde > 0 && totalCarrito >= config.envioGratisDesde;
  const costoEnvioActual = formCheckout.metodoEnvio === 'domicilio' ? (envioGratis ? 0 : Number(config.envioLocalCosto)) : 0;
  const totalFinal = totalCarrito + costoEnvioActual;

  const confirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'pedidos_ecommerce'), {
        ownerId: tiendaIdEfectiva,
        cliente: { ...formCheckout, emailUsuario: user?.email || '' }, 
        items: carrito, subtotal: totalCarrito, costoEnvio: costoEnvioActual, total: totalFinal,
        estadoPago: 'pendiente', estadoEnvio: 'preparacion', fecha: serverTimestamp(),
      });

      for (const item of carrito) {
        const prodActual = productos.find(p => p.idBaseDatos === item.idBaseDatos);
        if(prodActual) {
          await updateDoc(doc(db, 'productos', item.idBaseDatos), { 
            stock: Math.max(0, prodActual.stock - item.cantidad), 
            ventas: (prodActual.ventas || 0) + item.cantidad 
          });
        }
      }
      setPedidoRealizado({ id: docRef.id, total: totalFinal });
      setCarrito([]); setModoCheckout(false);
    } catch (error) { alert('Error al procesar pedido.'); } finally { setProcesando(false); }
  };

  if (cargando) return <div style={{ textAlign: 'center', padding: '80px', fontWeight: 'bold' }}>Cargando Tienda Online...</div>;

  return (
    <div style={{ padding: '25px', maxWidth: '1380px', margin: '0 auto', display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderLeft: '4px solid var(--neon-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '32px' }}>🛍️</div>
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>{nombreVitrina}</h2>
              <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>
                {localDueñoVitrina ? `Catálogo Oficial del Local | 📍 ${direccionVitrina}` : `${config.eslogan} | 📍 ${direccionVitrina}`}
              </p>
            </div>
          </div>
        </div>

        {!puedeVerPrecios && (
          <div className="neon-card neon-card-pink" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontWeight: 600 }}>🔒 Inicia sesión para ver precios u operar en tu panel de gestión.</span>
            <Link to="/admin-login" className="neon-btn neon-btn-fillCyan" style={{ textDecoration: 'none' }}>Iniciar Sesión</Link>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input type="text" className="neon-input" placeholder={`🔍 Buscar en el catálogo de ${nombreVitrina}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: '2 1 280px' }} />
          <select className="neon-select" value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} style={{ flex: '1 1 180px' }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
          {productosFiltrados.map(prod => {
            const precioEfectivo = aplicarRedondeo(prod.precio * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
            return (
              <div key={prod.idBaseDatos} className="neon-card" style={{ position: 'relative', opacity: prod.stock === 0 ? 0.55 : 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {prod.destacado && prod.stock > 0 && (
                    <div style={{ position: 'absolute', top: '-10px', right: '12px', background: 'var(--neon-yellow)', color: '#000', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '11px' }}>⭐ DESTACADO</div>
                  )}
                  <div style={{ height: '130px', background: 'var(--bg-input)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(128,128,128,0.12)' }}>
                    {prod.imagenUrl ? <img src={prod.imagenUrl} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="prod" /> : <span style={{ fontSize: '34px', opacity: 0.4 }}>📦</span>}
                  </div>
                  <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.1)', color: 'var(--neon-cyan)', marginBottom: '6px' }}>{prod.categoria || 'General'}</span>
                  <h4 style={{ margin: '6px 0 4px 0' }}>{prod.nombre}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>{prod.descripcion}</p>
                </div>
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                    {prod.stock === 0 ? <span className="glow-text-red">● Agotado</span> : <span className="glow-text-green">● Disponible ({prod.stock})</span>}
                  </div>
                  {puedeVerPrecios ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.15)', paddingTop: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Lista: ${prod.precio?.toLocaleString()}</span>
                        <b className="glow-text-green" style={{ fontSize: '19px' }}>Efvo: ${precioEfectivo.toLocaleString()}</b>
                      </div>
                      <button onClick={() => agregarAlCarrito(prod)} disabled={prod.stock <= 0} className="neon-btn neon-btn-fillCyan">
                        {prod.stock > 0 ? '+ Sumar' : 'Sin Stock'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderTop: '1px solid rgba(128,128,128,0.15)', paddingTop: '10px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>🔒 Precio Oculto</div>
                  )}
                </div>
              </div>
            );
          })}
          {productosFiltrados.length === 0 && (
            <div className="neon-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aún no hay artículos publicados en esta tienda.
            </div>
          )}
        </div>
      </div>

      {puedeVerPrecios && (carrito.length > 0 || pedidoRealizado) && (
        <div style={{ flex: '1 1 30%', minWidth: '320px' }}>
          {pedidoRealizado ? (
            <div className="neon-card neon-card-green" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-green" style={{ margin: '0 0 10px 0' }}>✅ ¡Pedido Confirmado!</h3>
              <p style={{ margin: '0 0 15px 0', color: 'var(--text-muted)' }}>Orden: <b>#{pedidoRealizado.id.slice(-6).toUpperCase()}</b></p>
              <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '14px', marginBottom: '20px' }}>
                <div className="glow-text-green" style={{ fontSize: '26px', fontWeight: 'bold' }}>${pedidoRealizado.total.toLocaleString()}</div>
              </div>
              <button onClick={() => window.open(`https://wa.me/${whatsappVitrina.replace(/\D/g,'')}?text=Hola%20${encodeURIComponent(nombreVitrina)},%20confirmo%20pedido%20%23${pedidoRealizado.id.slice(-6).toUpperCase()}%20por%20$${pedidoRealizado.total}`, '_blank')} className="neon-btn neon-btn-green" style={{ width: '100%' }}>
                💬 Coordinar por WhatsApp
              </button>
            </div>
          ) : modoCheckout ? (
            <div className="neon-card" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-cyan" style={{ margin: '0 0 20px 0' }}>📝 Finalizar Pedido</h3>
              <form onSubmit={confirmarPedido} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><label className="label-neon">Nombre Completo</label><input type="text" className="neon-input" required value={formCheckout.nombre} onChange={e=>setFormCheckout({...formCheckout, nombre: e.target.value})} /></div>
                <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" required value={formCheckout.telefono} onChange={e=>setFormCheckout({...formCheckout, telefono: e.target.value})} /></div>
                <div>
                  <label className="label-neon">Modalidad de Pago</label>
                  <select className="neon-select" value={formCheckout.metodoPago} onChange={e=>setFormCheckout({...formCheckout, metodoPago: e.target.value})}>
                    <option value="transferencia">Transferencia / Mercado Pago (Precio Lista)</option>
                    <option value="efectivo">Efectivo en Mostrador</option>
                  </select>
                </div>
                <button type="submit" disabled={procesando} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
                  {procesando ? 'Procesando...' : 'Confirmar Orden ➔'}
                </button>
                <button type="button" onClick={() => setModoCheckout(false)} className="neon-btn" style={{ width: '100%' }}>Volver</button>
              </form>
            </div>
          ) : (
            <div className="neon-card" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-cyan" style={{ margin: '0 0 15px 0' }}>🛒 Carrito ({carrito.length})</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {carrito.map(item => (
                  <div key={item.idBaseDatos} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.12)', padding: '10px 0' }}>
                    <div><b>{item.cantidad}x {item.nombre}</b><br/><span className="glow-text-cyan">${(item.precio * item.cantidad).toLocaleString()}</span></div>
                    <button onClick={() => setCarrito(carrito.filter(i => i.idBaseDatos !== item.idBaseDatos))} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', fontSize: '19px' }}>
                <span>TOTAL LISTA:</span><b className="glow-text-green">${totalCarrito.toLocaleString()}</b>
              </div>
              <button onClick={() => setModoCheckout(true)} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>Continuar Pedido ➔</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ========================================================
// 2. SEGUIMIENTO PÚBLICO
// ========================================================
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
    if (codUrl) {
      setCodigo(codUrl.toUpperCase());
      ejecutarBusqueda(codUrl);
    }
  }, []);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    ejecutarBusqueda(codigo);
  };

  return (
    <div style={{ padding: '50px 20px', maxWidth: '680px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 className="glow-text-cyan">🔍 Rastreo de Servicio Técnico</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Ingresa el código de 6 dígitos o escanea el QR de tu comprobante</p>
        <form onSubmit={buscar} style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
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

// ========================================================
// 3. LOGIN UNIFICADO
// ========================================================
const LoginAdmin = () => {
  const [e, setE] = useState(''); const [p, setP] = useState('');
  const navigate = useNavigate();
  return (
    <div style={{ padding: '80px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center' }}>
        <h2 className="glow-text-cyan">🔐 Acceso al Sistema</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Ingresa con tu cuenta de <b>Laboratorio Central</b>, dueño de <b>Local Asociado</b> o perfil de <b>Colaborador</b>.
        </p>
        <form onSubmit={async (ev) => { ev.preventDefault(); try { await signInWithEmailAndPassword(auth, e, p); navigate('/admin-panel'); } catch (err) { alert('Usuario o contraseña incorrectos'); } }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="email" className="neon-input" placeholder="Email de Usuario" value={e} onChange={ex => setE(ex.target.value)} required/>
          <input type="password" className="neon-input" placeholder="Contraseña" value={p} onChange={ex => setP(ex.target.value)} required/>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>Ingresar a mi Panel ➔</button>
        </form>
      </div>
    </div>
  );
};

// ================================================================================
// 4. PANEL ERP MULTI-TENANT (CON GESTIÓN AVANZADA DE USUARIOS, EDICIÓN Y PERMISOS)
// ================================================================================
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

  // --- POS Mostrador Multicaja + Facturación ARCA Directa ---
  const [carritoPOS, setCarritoPOS] = useState<any[]>([]);
  const [busquedaPOS, setBusquedaPOS] = useState('');
  const [metodoPagoPOS, setMetodoPagoPOS] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'>('efectivo');
  const [clientePOS, setClientePOS] = useState('Consumidor Final');
  const [cuitPOS, setCuitPOS] = useState('');
  const [condicionIvaPOS, setCondicionIvaPOS] = useState('Consumidor Final');
  const [tipoFacturaPOS, setTipoFacturaPOS] = useState<'SIN_FACTURA' | 'C' | 'B' | 'A'>('SIN_FACTURA');

  // --- Módulo Generador de Presupuestos ---
  const [presCliente, setPresCliente] = useState('');
  const [presTel, setPresTel] = useState('');
  const [presEquipo, setPresEquipo] = useState('');
  const [presValidez, setPresValidez] = useState('7');
  const [presNotas, setPresNotas] = useState('Incluye mano de obra y garantía escrita.');
  const [itemsPresupuesto, setItemsPresupuesto] = useState<any[]>([]);
  const [itemManualDesc, setItemManualDesc] = useState('');
  const [itemManualPrecio, setItemManualPrecio] = useState('');
  const [busquedaProdPres, setBusquedaProdPres] = useState('');

  // --- CRM Taller & Recepción ---
  const [cliNombre, setCliNombre] = useState(''); const [cliTel, setCliTel] = useState(''); const [cliDni, setCliDni] = useState('');
  const [tallerOrigenOrden, setTallerOrigenOrden] = useState('Mostrador Propio');
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [tecnico, setTecnico] = useState('');
  const [imei, setImei] = useState(''); const [contrasena, setContrasena] = useState('');
  const [condicionVisual, setCondicionVisual] = useState('');
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [costoGremioInicial, setCostoGremioInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería OK"]);

  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroOrigenTaller, setFiltroOrigenTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');

  // --- Catálogo e Inventario ---
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [prodNom, setProdNom] = useState(''); const [prodCat, setProdCat] = useState('');
  const [prodCosto, setProdCosto] = useState(''); 
  const [prodPrecio, setProdPrecio] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodUbicacion, setProdUbicacion] = useState(''); 
  const [prodDesc, setProdDesc] = useState(''); const [prodImg, setProdImg] = useState('');
  const [prodCodigoBarras, setProdCodigoBarras] = useState('');
  const [prodProveedor, setProdProveedor] = useState('');
  const [prodDestacado, setProdDestacado] = useState(false);
  
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [filtroCategoriaInv, setFiltroCategoriaInv] = useState('Todas');
  const [filtroStockInv, setFiltroStockInv] = useState('todos'); 
  const [escaneandoPara, setEscaneandoPara] = useState<'formulario' | 'buscador' | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // --- Red de Talleres Asociados B2B (Con Edición y Reutilización de Email) ---
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

  // --- Módulo RMA / Garantías ---
  const [rmaTipo, setRmaTipo] = useState<'proveedor' | 'cliente'>('proveedor');
  const [rmaProducto, setRmaProducto] = useState('');
  const [rmaEntidad, setRmaEntidad] = useState('');
  const [rmaMotivo, setRmaMotivo] = useState('');
  const [rmaMonto, setRmaMonto] = useState('');

  // --- Proveedores / Excel ---
  const [excelCargando, setExcelCargando] = useState(false);
  const [excelHojas, setExcelHojas] = useState<string[]>([]);
  const [hojaActiva, setHojaActiva] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [colNombre, setColNombre] = useState<number>(0);
  const [colCosto, setColCosto] = useState<number>(1);
  const [colMarca, setColMarca] = useState<number>(-1);
  const [nombreProveedorExcel, setNombreProveedorExcel] = useState(''); 
  const [monedaListaExcel, setMonedaListaExcel] = useState<'ARS' | 'USD'>('ARS');

  // --- Finanzas ---
  const [finTipo, setFinTipo] = useState('ingreso'); const [finConcepto, setFinConcepto] = useState('');
  const [finMonto, setFinMonto] = useState(''); const [finMetodo, setFinMetodo] = useState('efectivo');
  const [filtroTiempo, setFiltroTiempo] = useState('todos'); 
  const [filtroTipoLista, setFiltroTipoLista] = useState('todos'); 
  const [filtroBusquedaConcepto, setFiltroBusquedaConcepto] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  // --- CRM Clientes ---
  const [busquedaClienteCRM, setBusquedaClienteCRM] = useState('');
  const [mensajePromoCRM, setMensajePromoCRM] = useState(CONFIG_DEFAULT.promoPlantillaCRM);

  // --- Usuarios / Roles Avanzados (Con Edición y Permisos por Módulo) ---
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
  }, []);

  useEffect(() => {
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => { 
      if (docSnap.exists()) { 
        const data = docSnap.data(); 
        setConfig({ ...CONFIG_DEFAULT, ...data }); 
        setConf({ ...CONFIG_DEFAULT, ...data }); 
        if (data.promoPlantillaCRM) setMensajePromoCRM(data.promoPlantillaCRM);
      } 
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
    ? talleresGremio.find(t => t.id === registroRolActual.tenantId)
    : null;

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
        cuit: sucursalAsociada.cuit || '',
        condicionIva: sucursalAsociada.condicionIva || 'Responsable Monotributo',
        puntoVentaArca: sucursalAsociada.puntoVentaArca || '00001',
        ingresosBrutos: sucursalAsociada.ingresosBrutos || '',
        inicioActividades: sucursalAsociada.inicioActividades || '01/01/2023'
      });
    }
  }, [sucursalAsociada]);

  const datosFiscalesActivos = esSucursalExterna ? {
    empresaNombre: sucursalAsociada.nombre,
    razonSocial: fiscalesLocal.razonSocial || sucursalAsociada.nombre,
    cuit: fiscalesLocal.cuit || '00-00000000-0',
    condicionIva: fiscalesLocal.condicionIva || 'Responsable Monotributo',
    puntoVentaArca: fiscalesLocal.puntoVentaArca || '00001',
    ingresosBrutos: fiscalesLocal.ingresosBrutos || fiscalesLocal.cuit,
    inicioActividades: fiscalesLocal.inicioActividades || '01/01/2023',
    direccion: direccionNegocioActivo
  } : config;

  const rolNormalizado: 'admin' | 'recepcion_ordenes' | 'vendedor_admin' | 'personalizado' = sucursalDirecta 
    ? 'admin' 
    : (registroRolActual 
        ? (registroRolActual.rol === 'tecnico' || registroRolActual.rol === 'recepcion_ordenes' 
            ? 'recepcion_ordenes' 
            : registroRolActual.rol === 'vendedor' || registroRolActual.rol === 'vendedor_admin'
              ? 'vendedor_admin'
              : registroRolActual.rol === 'personalizado'
                ? 'personalizado'
                : 'admin') 
        : 'admin');

  // Función que verifica si el usuario logueado tiene permiso sobre un módulo específico
  const tienePermisoModulo = (moduloId: string) => {
    if (sucursalDirecta || !registroRolActual || rolNormalizado === 'admin') return true;
    if (Array.isArray(registroRolActual.permisos) && registroRolActual.permisos.length > 0) {
      return registroRolActual.permisos.includes(moduloId);
    }
    const fallback = PERMISOS_DEFAULT_POR_ROL[rolNormalizado] || [];
    return fallback.includes(moduloId);
  };

  const esAdminDelNegocioActivo = rolNormalizado === 'admin' || tienePermisoModulo('configuracion');

  // Redirigir automáticamente a la primera pestaña permitida si no tiene acceso a la actual
  useEffect(() => {
    if (!tienePermisoModulo(pestaña)) {
      const primeraPermitida = LISTA_MODULOS_PERMISOS.find(m => tienePermisoModulo(m.id))?.id || 'presupuestos';
      setPestaña(primeraPermitida);
    }
  }, [rolNormalizado, registroRolActual]);

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
    ? ordenes.filter(o => o.tallerId === sucursalAsociada.id || o.tallerOrigen === sucursalAsociada.nombre)
    : ordenes;

  useEffect(() => {
    if (!escaneandoPara) return;
    const inicializarEscaner = () => {
      const scanner = new (window as any).Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 } }, false);
      scanner.render((texto: string) => {
        if (escaneandoPara === 'formulario') setProdCodigoBarras(texto);
        if (escaneandoPara === 'buscador') setBusquedaInventario(texto);
        scanner.clear(); setEscaneandoPara(null);
      }, () => {});
      (window as any).__scanner = scanner;
    };
    if (!(window as any).Html5QrcodeScanner) {
      const script = document.createElement('script'); script.src = "https://unpkg.com/html5-qrcode"; script.async = true; script.onload = inicializarEscaner; document.body.appendChild(script);
    } else { inicializarEscaner(); }
    return () => { if ((window as any).__scanner) { try { (window as any).__scanner.clear(); } catch(e){} } };
  }, [escaneandoPara]);

  // --- Generador CAE ARCA ---
  const generarDatosFacturaARCA = (tipoCmp: string, cuitReceptor: string, razonReceptor: string, condIvaReceptor: string, caeManual?: string) => {
    const ptoVta = String(datosFiscalesActivos.puntoVentaArca || "00001").padStart(5, "0");
    const facturasPreviasDelTipo = misFinanzas.filter(m => m.factura && m.factura.tipo === tipoCmp).length;
    const proximoNumero = String(facturasPreviasDelTipo + 1).padStart(8, "0");
    const caeGenerado = caeManual || ("74" + Math.floor(100000000000 + Math.random() * 900000000000).toString());
    const vto = new Date();
    vto.setDate(vto.getDate() + 10);

    return {
      tipo: tipoCmp,
      puntoVenta: ptoVta,
      numero: `${ptoVta}-${proximoNumero}`,
      cuit: cuitReceptor || "00-00000000-0",
      razonSocialReceptor: razonReceptor || "Consumidor Final",
      condicionIvaReceptor: condIvaReceptor || "Consumidor Final",
      cae: caeGenerado,
      vtoCae: vto.toLocaleDateString(),
      fechaEmision: new Date().toLocaleDateString()
    };
  };

  // --- Funciones POS Mostrador ---
  const agregarAlPOS = (p: any) => {
    if (p.stock <= 0) return alert('Sin stock disponible.');
    const item = carritoPOS.find(i => i.id === p.id);
    if (item && item.cantidad < p.stock) {
      setCarritoPOS(carritoPOS.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else if (!item) {
      setCarritoPOS([...carritoPOS, { ...p, cantidad: 1 }]);
    }
  };

  const subtotalPOS = carritoPOS.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const costoTotalPOS = carritoPOS.reduce((acc, i) => acc + ((i.costoProveedor || 0) * i.cantidad), 0);
  const ajusteFinancieroPOS = metodoPagoPOS === 'efectivo' 
    ? -Math.round(subtotalPOS * (Number(config.descuentoEfectivoPorcentaje || 0) / 100))
    : metodoPagoPOS === 'tarjeta'
      ? Math.round(subtotalPOS * (Number(config.recargoTarjetaPorcentaje || 0) / 100))
      : 0;
  const totalFinalPOS = aplicarRedondeo(subtotalPOS + ajusteFinancieroPOS, config.redondeoPrecios);

  const cobrarVentaPOS = async () => {
    if (carritoPOS.length === 0) return;
    try {
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
        concepto: `Venta POS Mostrador (${clientePOS}) - ${carritoPOS.length} ítems`,
        monto: totalFinalPOS,
        costoAsociado: costoTotalPOS,
        metodoPago: metodoPagoPOS,
        fecha: serverTimestamp(),
        usuario: user.email,
        items: itemsVenta,
        factura: facturaArcaObj
      });

      if (facturaArcaObj) {
        imprimirFacturaARCA({ id: docRef.id, monto: totalFinalPOS, metodoPago: metodoPagoPOS, items: itemsVenta, factura: facturaArcaObj }, datosFiscalesActivos);
      } else {
        alert(`⚡ Cobro de $${totalFinalPOS.toLocaleString()} registrado en tu Caja.`);
      }

      setCarritoPOS([]);
      setClientePOS('Consumidor Final');
      setCuitPOS('');
      setTipoFacturaPOS('SIN_FACTURA');
    } catch (e) {
      alert('Error al procesar venta POS.');
    }
  };

  // --- Funciones Módulo de Presupuestos ---
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

  const totalListaPresupuesto = itemsPresupuesto.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const totalEfectivoPresupuesto = aplicarRedondeo(totalListaPresupuesto * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
  const totalTarjetaPresupuesto = aplicarRedondeo(totalListaPresupuesto * (1 + Number(config.recargoTarjetaPorcentaje || 0) / 100), config.redondeoPrecios);

  const guardarPresupuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsPresupuesto.length === 0) return alert('Agrega al menos un artículo o mano de obra al presupuesto.');
    const numPres = Math.random().toString(36).substring(2, 7).toUpperCase();
    await addDoc(collection(db, 'presupuestos'), {
      ownerId: tenantId,
      numero: numPres,
      cliente: presCliente,
      telefono: presTel,
      equipo: presEquipo,
      validezDias: Number(presValidez) || 7,
      notas: presNotas,
      items: itemsPresupuesto,
      totalLista: totalListaPresupuesto,
      totalEfectivo: totalEfectivoPresupuesto,
      totalTarjeta: totalTarjetaPresupuesto,
      estado: 'pendiente',
      fecha: serverTimestamp(),
      fechaTexto: new Date().toLocaleDateString()
    });
    setPresCliente(''); setPresTel(''); setPresEquipo(''); setItemsPresupuesto([]);
    alert(`📄 Presupuesto #${numPres} generado y guardado.`);
  };

  const enviarPresupuestoWhatsApp = (pr: any) => {
    let msg = `Hola *${pr.cliente}*, te enviamos el presupuesto *#${pr.numero}* de *${nombreNegocioActivo}*:\n`;
    if (pr.equipo) msg += `📱 *Equipo / Ref:* ${pr.equipo}\n`;
    msg += `\n📋 *DETALLE DE COTIZACIÓN:*\n`;
    pr.items?.forEach((it: any) => {
      msg += `▪️ ${it.cantidad}x ${it.nombre}: $${(it.precio * it.cantidad).toLocaleString()}\n`;
    });
    msg += `\n💰 *VALORES SEGÚN MEDIO DE PAGO:*\n`;
    msg += `💵 *Efectivo (-${config.descuentoEfectivoPorcentaje}%):* $${pr.totalEfectivo?.toLocaleString()}\n`;
    msg += `🏦 *Precio de Lista (Transf./MP):* $${pr.totalLista?.toLocaleString()}\n`;
    msg += `💳 *Tarjeta (+${config.recargoTarjetaPorcentaje}%):* $${pr.totalTarjeta?.toLocaleString()}\n`;
    msg += `\n⏳ *Validez del presupuesto:* ${pr.validezDias} días.\n📝 ${pr.notas || ''}`;
    window.open(`https://wa.me/549${(pr.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirPresupuestoPDF = (pr: any) => {
    const v = window.open('', '_blank');
    if (!v) return;
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
            .totales { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 20px; }
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
            <b>Cliente:</b> ${pr.cliente} | <b>Teléfono:</b> ${pr.telefono || '-'} | <b>Equipo / Referencia:</b> ${pr.equipo || 'Varios'}
          </div>
          <table>
            <thead><tr><th>Cant.</th><th>Descripción de Repuesto / Mano de Obra</th><th style="text-align:right;">Unitario (Lista)</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>
              ${pr.items?.map((it: any) => `
                <tr>
                  <td><b>${it.cantidad}</b></td>
                  <td>${it.nombre}</td>
                  <td style="text-align:right;">$${it.precio?.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:bold;">$${(it.precio * it.cantidad).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totales">
            <div class="box-tot" style="border-color:#28cd41; background:#f0fff4;">
              <div style="font-size:11px; font-weight:bold; color:#198754;">PAGO EN EFECTIVO (-${config.descuentoEfectivoPorcentaje}%)</div>
              <div style="font-size:22px; font-weight:900; color:#198754; margin-top:4px;">$${pr.totalEfectivo?.toLocaleString()}</div>
            </div>
            <div class="box-tot" style="border-color:#007aff;">
              <div style="font-size:11px; font-weight:bold; color:#007aff;">PRECIO DE LISTA (TRANSF. / MP)</div>
              <div style="font-size:22px; font-weight:900; color:#007aff; margin-top:4px;">$${pr.totalLista?.toLocaleString()}</div>
            </div>
            <div class="box-tot">
              <div style="font-size:11px; font-weight:bold; color:#666;">TARJETA / CUOTAS (+${config.recargoTarjetaPorcentaje}%)</div>
              <div style="font-size:22px; font-weight:900; color:#333; margin-top:4px;">$${pr.totalTarjeta?.toLocaleString()}</div>
            </div>
          </div>
          <p style="margin-top:25px; font-size:12px; color:#555; border-top:1px dashed #ccc; padding-top:10px;">
            <b>Observaciones:</b> ${pr.notas || 'Precios sujetos a disponibilidad de stock.'}
          </p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    v.document.close();
  };

  const convertirPresupuestoEnOrden = async (pr: any) => {
    if (!window.confirm(`¿Convertir el presupuesto #${pr.numero} de ${pr.cliente} en una Orden de Taller activa?`)) return;
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resumenTrabajos = pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(' + ');
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      tallerId: tenantId,
      tallerOrigen: esSucursalExterna ? sucursalAsociada.nombre : 'Mostrador Propio',
      cliente: { nombre: pr.cliente, telefono: pr.telefono || '', dni: '' },
      equipo: { marca: pr.equipo || 'Equipo', modelo: '', imei: '', contrasena: '', condicionVisual: 'Según Presupuesto #' + pr.numero, checklist: [] },
      fallaDeclarada: resumenTrabajos,
      tecnicoAsignado: '',
      costoReparacion: pr.totalLista?.toString() || '',
      seña: 0,
      estado: 'ingresado',
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: `Creado desde Presupuesto Aprobado #${pr.numero}` }]
    });
    await updateDoc(doc(db, 'presupuestos', pr.id), { estado: 'aprobado' });
    alert(`✅ Convertido en Orden de Taller #${cod}.`);
    setPestaña('taller');
  };

  // --- Funciones Proveedores Excel ---
  const parsePrecio = (valor: any) => {
    if (valor === undefined || valor === null || valor === '') return NaN;
    if (typeof valor === 'number') return valor;
    let str = valor.toString().replace(/[^0-9.,-]/g, '');
    if (str.includes(',') && str.includes('.')) {
       if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
       else str = str.replace(/,/g, '');
    } else if (str.includes(',')) { str = str.replace(',', '.'); }
    return parseFloat(str);
  };

  const procesarArchivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(window as any).XLSX) return alert('Librería Excel cargando...');
    setExcelCargando(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        setExcelHojas(wb.SheetNames);
        if (wb.SheetNames.length > 0) seleccionarHojaExcel(wb, wb.SheetNames[0]);
        (window as any).__currentWorkbook = wb;
      } catch (error) { alert('Error leyendo Excel'); } finally { setExcelCargando(false); }
    };
    reader.readAsBinaryString(file);
  };

  const seleccionarHojaExcel = (wb: any, sheetName: string) => {
    setHojaActiva(sheetName);
    const ws = wb.Sheets[sheetName];
    const data = (window as any).XLSX.utils.sheet_to_json(ws, { header: 1 });
    setExcelData(data);
  };

  const cambiarHojaDropdown = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    if ((window as any).__currentWorkbook) seleccionarHojaExcel((window as any).__currentWorkbook, sheetName);
  };

  const importarDatosAlInventario = async () => {
    if (excelData.length === 0) return alert('No hay datos.');
    if (!nombreProveedorExcel) return alert('Ingresa el nombre del proveedor.');
    if (!window.confirm(`¿Importar desde "${hojaActiva}" al inventario privado de ${nombreNegocioActivo}?`)) return;
    
    let agregados = 0; let actualizados = 0; let omitidos = 0; let marcaActual = 'General';
    const fechaActualizacion = new Date().toLocaleDateString();
    const factorMoneda = monedaListaExcel === 'USD' ? Number(config.cotizacionDolar || 1) : 1;

    setExcelCargando(true);
    try {
      let batch = writeBatch(db); let operacionActual = 0;
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        if (!row || row.length === 0) continue;
        const nombreObtenido = row[colNombre]?.toString().trim();
        const costoBruto = parsePrecio(row[colCosto]);
        const marcaDetectada = colMarca >= 0 ? row[colMarca]?.toString().trim() : null;

        if (marcaDetectada && isNaN(costoBruto)) { marcaActual = marcaDetectada; continue; }
        if (nombreObtenido && !isNaN(costoBruto) && costoBruto > 0) {
          const costoEnPesos = Math.round(costoBruto * factorMoneda);
          const precioConMargen = costoEnPesos + (costoEnPesos * (Number(config.margenGanancia) / 100));
          const precioFinalRedondeado = aplicarRedondeo(precioConMargen, config.redondeoPrecios);
          const nombreFinal = colMarca === -1 ? nombreObtenido : `${marcaActual} - ${nombreObtenido}`;
          
          const productoExistente = misProductos.find(p => p.nombre.toLowerCase() === nombreFinal.toLowerCase());
          if (productoExistente) {
            batch.update(doc(db, 'productos', productoExistente.id), { costoProveedor: costoEnPesos, precio: precioFinalRedondeado, proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
            actualizados++;
          } else {
            batch.set(doc(collection(db, 'productos')), { ownerId: tenantId, nombre: nombreFinal, categoria: hojaActiva, costoProveedor: costoEnPesos, precio: precioFinalRedondeado, stock: 0, descripcion: 'Importado de lista', fecha: serverTimestamp(), ventas: 0, proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
            agregados++;
          }
          operacionActual++;
          if (operacionActual >= 400) { await batch.commit(); batch = writeBatch(db); operacionActual = 0; }
        } else { omitidos++; }
      }
      if (operacionActual > 0) await batch.commit(); 
      alert(`⚡ IMPORTACIÓN EXITOSA!\nAgregados: ${agregados} | Actualizados: ${actualizados} | Omitidos: ${omitidos}`);
    } catch (e: any) { alert(`Error: ${e.message}`); } finally { setExcelCargando(false); setExcelData([]); }
  };

  // --- Funciones Taller ---
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

    setCliNombre(''); setCliTel(''); setCliDni(''); setMarca(''); setModelo(''); setFalla(''); setTecnico(''); setImei(''); setContrasena(''); setCondicionVisual(''); setPresupuestoInicial(''); setCostoGremioInicial(''); setSeñaRecibida('');
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
      if(costoCliente !== null) data.costoReparacion = costoCliente; 
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
    if (orden.costoReparacion) msg += `💰 *Total:* $${orden.costoReparacion} ${orden.seña ? `(Seña: $${orden.seña} | Saldo: $${saldo})` : ''}\n`;
    msg += `\n🔍 Seguimiento en vivo: ${urlBase}/seguimiento?codigo=${orden.codigoSeguimiento}`;
    window.open(`https://wa.me/549${orden.cliente.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirOrdenProfesional = (orden: any) => {
    const v = window.open('', '_blank');
    if(!v) return;
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
                ${CHECKLIST_ITEMS.map(it => `<div><span class="box-mark">${itemsCheck.includes(it) ? '✓' : ''}</span> ${it}</div>`).join('')}
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

  // --- Funciones Inventario ---
  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const fechaActualizacion = new Date().toLocaleDateString();
    const dataProducto = { 
      ownerId: tenantId,
      nombre: prodNom, categoria: prodCat, precio: Number(prodPrecio), 
      costoProveedor: Number(prodCosto) || 0, stock: Number(prodStock), 
      ubicacion: prodUbicacion, descripcion: prodDesc, imagenUrl: prodImg, 
      proveedor: prodProveedor, ultimaActualizacion: fechaActualizacion, 
      codigoBarras: prodCodigoBarras, destacado: prodDestacado 
    };
    if (idEditando) await updateDoc(doc(db, 'productos', idEditando), dataProducto);
    else await addDoc(collection(db, 'productos'), { ...dataProducto, ventas: 0, fecha: serverTimestamp() });
    limpiarFormularioProducto();
  };

  const limpiarFormularioProducto = () => {
    setIdEditando(null); setProdNom(''); setProdCat(''); setProdPrecio(''); setProdCosto(''); setProdStock(''); setProdUbicacion(''); setProdDesc(''); setProdImg(''); setProdCodigoBarras(''); setProdProveedor(''); setProdDestacado(false);
  };

  const calcularPrecioVenta = () => { 
    if (prodCosto) {
      const bruto = Number(prodCosto) + (Number(prodCosto) * (Number(config.margenGanancia) / 100));
      setProdPrecio(aplicarRedondeo(bruto, config.redondeoPrecios).toString()); 
    }
  };

  const actualizarStock = async (id: string, nuevoStock: number) => { if (nuevoStock >= 0) await updateDoc(doc(db, 'productos', id), { stock: nuevoStock }); };

  const cargarProductoParaEdicion = (p: any) => {
    setIdEditando(p.id); setProdNom(p.nombre); setProdCat(p.categoria || ''); setProdPrecio(p.precio?.toString() || ''); setProdCosto(p.costoProveedor?.toString() || ''); setProdStock(p.stock?.toString() || ''); setProdUbicacion(p.ubicacion || ''); setProdDesc(p.descripcion || ''); setProdImg(p.imagenUrl || ''); setProdCodigoBarras(p.codigoBarras || ''); setProdProveedor(p.proveedor || ''); setProdDestacado(p.destacado || false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const pedirFaltantes = () => {
    const faltantes = misProductos.filter(p => p.stock <= config.stockCriticoAlerta);
    if (faltantes.length === 0) return alert('No hay artículos con stock crítico.');
    let msg = `Hola! Necesito reponer para *${nombreNegocioActivo}*:\n\n`; 
    faltantes.forEach(p => { msg += `▪️ ${p.stock === 0 ? 5 : 3}x ${p.nombre}\n`; }); 
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ================================================================================
  // ALTA, EDICIÓN Y REUTILIZACIÓN DE CORREOS PARA LOCALES ASOCIADOS (B2B)
  // ================================================================================
  const limpiarFormularioTaller = () => {
    setIdTallerEditando(null); setTallerNom(''); setTallerEncargado(''); setTallerTel(''); 
    setTallerDireccion(''); setTallerEmail(''); setTallerPassword(''); setTallerCiudad('Necochea'); 
    setTallerNivel('Bronce'); setTallerLimiteCredito('150000');
  };

  const cargarTallerParaEdicion = (t: any) => {
    setIdTallerEditando(t.id);
    setTallerNom(t.nombre || '');
    setTallerEncargado(t.encargado || '');
    setTallerTel(t.telefono || '');
    setTallerDireccion(t.direccion || '');
    setTallerEmail(t.email || '');
    setTallerPassword('');
    setTallerCiudad(t.ciudad || 'Necochea');
    setTallerNivel(t.nivel || 'Bronce');
    setTallerLimiteCredito((t.limiteCredito || 150000).toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardarTallerGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoCuentaLocal(true);
    try {
      const emailLimpio = tallerEmail.trim().toLowerCase();

      // Si estamos editando un local existente
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
        limpiarFormularioTaller();
        alert(`✅ Datos del local "${tallerNom}" actualizados correctamente.`);
        return;
      }

      // Si es nuevo o se está reutilizando un correo que había sido borrado antes:
      if (tallerPassword && tallerPassword.length >= 6) {
        const secondaryAppName = "SecondaryCreatorApp";
        const existingApp = getApps().find(a => a.name === secondaryAppName);
        const secondaryApp = existingApp || initializeApp(auth.app.options, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, tallerPassword);
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          // SOLUCIÓN AL BLOQUEO DE CORREO REPETIDO: Si el correo ya existe en Firebase Auth, lo reutilizamos sin tirar error
          if (authErr.code === 'auth/email-already-in-use') {
            console.log('Correo existente en Firebase Auth: se reutiliza la cuenta y se reactiva en la base de datos.');
          } else {
            throw authErr;
          }
        }
      }

      // Verificar si ya había un registro en talleres_gremio con ese email para actualizarlo en vez de duplicarlo
      const existenteEnBd = talleresGremio.find(t => t.email?.toLowerCase() === emailLimpio);
      if (existenteEnBd) {
        await updateDoc(doc(db, 'talleres_gremio', existenteEnBd.id), {
          nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, direccion: tallerDireccion,
          email: emailLimpio, ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0, activo: true
        });
      } else {
        await addDoc(collection(db, 'talleres_gremio'), {
          nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, direccion: tallerDireccion,
          email: emailLimpio, ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0, 
          saldoDeudor: 0, activo: true, fechaAlta: serverTimestamp()
        });
      }

      limpiarFormularioTaller();
      alert(`🏢 ¡Local "${tallerNom}" habilitado con éxito!\nEl correo ${emailLimpio} ya tiene acceso activo.`);
    } catch (err: any) {
      alert(`Error al procesar el local: ${err.message}`);
    } finally {
      setCreandoCuentaLocal(false);
    }
  };

  const registrarPagoCtaCteTaller = async (taller: any) => {
    const abono = Number(prompt(`Saldo actual de ${taller.nombre}: $${taller.saldoDeudor || 0}\nIngresa el monto que abona ($):`, taller.saldoDeudor || '0'));
    if (!abono || abono <= 0) return;
    await updateDoc(doc(db, 'talleres_gremio', taller.id), {
      saldoDeudor: Math.max(0, Number(taller.saldoDeudor || 0) - abono)
    });
    await addDoc(collection(db, 'finanzas'), {
      ownerId: 'MASTER',
      tipo: 'ingreso',
      concepto: `Cobro Cta. Cte. Gremio - Local: ${taller.nombre}`,
      monto: abono,
      metodoPago: 'transferencia',
      fecha: serverTimestamp(),
      usuario: user.email
    });
    alert('⚡ Pago imputado en Cuenta Corriente y sumado a tu Caja Central.');
  };

  const guardarRMA = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'rmas_garantias'), {
      ownerId: tenantId,
      origenNombre: nombreNegocioActivo,
      tipo: rmaTipo, producto: rmaProducto, entidad: rmaEntidad, motivo: rmaMotivo,
      monto: Number(rmaMonto) || 0, estado: 'pendiente', fecha: new Date().toLocaleDateString()
    });
    setRmaProducto(''); setRmaEntidad(''); setRmaMotivo(''); setRmaMonto('');
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

  const categoriasUnicasInv = ['Todas', ...Array.from(new Set(misProductos.map(p => p.categoria || 'General')))];
  const inventarioFiltrado = misProductos.filter(p => {
    if (filtroCategoriaInv !== 'Todas' && (p.categoria || 'General') !== filtroCategoriaInv) return false;
    if (filtroStockInv === 'critico' && (p.stock > config.stockCriticoAlerta || p.stock === 0)) return false;
    if (filtroStockInv === 'agotado' && p.stock > 0) return false;
    if (busquedaInventario) {
      const b = busquedaInventario.toLowerCase();
      return p.nombre.toLowerCase().includes(b) || (p.codigoBarras && p.codigoBarras.includes(b)) || (p.ubicacion && p.ubicacion.toLowerCase().includes(b));
    }
    return true;
  });

  const toggleSeleccion = (id: string) => { setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const toggleTodos = () => { if (seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0) setSeleccionados([]); else setSeleccionados(inventarioFiltrado.map(p => p.id)); };

  const eliminarSeleccionados = async () => {
    if (!window.confirm(`¿Eliminar ${seleccionados.length} productos de tu inventario?`)) return;
    const batch = writeBatch(db); seleccionados.forEach(id => { batch.delete(doc(db, 'productos', id)); });
    await batch.commit(); setSeleccionados([]);
  };

  const cambiarEstadoPagoPedido = async (pedido: any, nuevoEstado: string) => {
    if (nuevoEstado === 'pagado' && pedido.estadoPago !== 'pagado') {
      const confirmar = window.confirm(`¿Registrar ingreso de $${pedido.total} en tu Caja?`);
      if (confirmar) {
        await addDoc(collection(db, 'finanzas'), { 
          ownerId: tenantId,
          tipo: 'ingreso', concepto: `Cobro Web #${pedido.id.slice(-6).toUpperCase()} - ${pedido.cliente?.nombre || 'Cliente'}`, 
          monto: Number(pedido.total), metodoPago: 'transferencia', fecha: serverTimestamp(), usuario: user.email,
          items: pedido.items || []
        });
      }
    }
    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), { estadoPago: nuevoEstado });
  };

  const registrarMovimientoFinanzas = async (e: React.FormEvent) => {
    e.preventDefault(); 
    await addDoc(collection(db, 'finanzas'), { ownerId: tenantId, tipo: finTipo, concepto: finConcepto, monto: Number(finMonto), metodoPago: finMetodo, fecha: serverTimestamp(), usuario: user.email }); 
    setFinConcepto(''); setFinMonto('');
  };

  const guardarConfiguracion = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    await setDoc(doc(db, 'configuracion', 'general'), conf, { merge: true }); 
    alert('⚡ Datos Fiscales ARCA, Tema y Parámetros guardados.'); 
  };

  const guardarFiscalesLocalGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursalAsociada) return;
    await updateDoc(doc(db, 'talleres_gremio', sucursalAsociada.id), fiscalesLocal);
    alert('✅ Datos Fiscales ARCA de tu local actualizados correctamente.');
  };

  const clientesConsolidados = React.useMemo(() => {
    const mapa = new Map<string, any>();
    misOrdenesTaller.forEach(o => {
      const tel = (o.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: o.cliente?.nombre || 'Sin Nombre', telefono: o.cliente?.telefono, equipos: 0, comprasWeb: 0, totalGastado: 0 };
      actual.equipos += 1;
      actual.totalGastado += Number(o.costoReparacion || 0);
      mapa.set(tel, actual);
    });
    misPedidosWeb.forEach(p => {
      const tel = (p.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: p.cliente?.nombre || 'Cliente Web', telefono: p.cliente?.telefono, equipos: 0, comprasWeb: 0, totalGastado: 0 };
      actual.comprasWeb += 1;
      actual.totalGastado += Number(p.total || 0);
      mapa.set(tel, actual);
    });
    return Array.from(mapa.values()).filter(c => c.nombre.toLowerCase().includes(busquedaClienteCRM.toLowerCase()) || c.telefono.includes(busquedaClienteCRM)).sort((a, b) => b.totalGastado - a.totalGastado);
  }, [misOrdenesTaller, misPedidosWeb, busquedaClienteCRM]);

  const movimientosFiltrados = misFinanzas.filter(m => {
    if (filtroTipoLista !== 'todos' && m.tipo !== filtroTipoLista) return false;
    if (filtroBusquedaConcepto && !m.concepto.toLowerCase().includes(filtroBusquedaConcepto.toLowerCase())) return false;
    if (m.fecha && filtroTiempo !== 'todos') {
      const fechaMov = new Date(m.fecha.seconds * 1000); const hoy = new Date();
      if (filtroTiempo === 'hoy' && fechaMov.toDateString() !== hoy.toDateString()) return false;
      if (filtroTiempo === 'mes' && (fechaMov.getMonth() !== hoy.getMonth() || fechaMov.getFullYear() !== hoy.getFullYear())) return false;
    }
    return true;
  });

  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const saldoNeto = totalIngresos - totalEgresos;
  const capitalCostoPanol = misProductos.reduce((acc, p) => acc + ((p.costoProveedor || 0) * (p.stock || 0)), 0);
  const capitalVentaPanol = misProductos.reduce((acc, p) => acc + ((p.precio || 0) * (p.stock || 0)), 0);
  const deudaTotalTalleresB2B = talleresGremio.reduce((acc, t) => acc + Number(t.saldoDeudor || 0), 0);
  const equiposEnBanco = misOrdenesTaller.filter(o => o.estado !== 'entregado' && o.estado !== 'reparado').length;
  const equiposListosSinRetirar = misOrdenesTaller.filter(o => o.estado === 'reparado').length;

  // ================================================================================
  // GESTIÓN AVANZADA DE USUARIOS Y PERMISOS (EDICIÓN, CHECKBOXES Y REUTILIZACIÓN EMAIL)
  // ================================================================================
  const cambiarPresetRol = (rolElegido: string) => {
    setNuevoUserRol(rolElegido);
    if (PERMISOS_DEFAULT_POR_ROL[rolElegido]) {
      setPermisosSeleccionados(PERMISOS_DEFAULT_POR_ROL[rolElegido]);
    }
  };

  const togglePermisoIndividual = (idModulo: string) => {
    setPermisosSeleccionados(prev => 
      prev.includes(idModulo) ? prev.filter(p => p !== idModulo) : [...prev, idModulo]
    );
  };

  const limpiarFormularioUsuario = () => {
    setIdUsuarioEditando(null);
    setNuevoUserNombre('');
    setNuevoUserEmail('');
    setNuevoUserPassword('');
    setNuevoUserRol('recepcion_ordenes');
    setPermisosSeleccionados(PERMISOS_DEFAULT_POR_ROL['recepcion_ordenes']);
  };

  const cargarUsuarioParaEditar = (u: any) => {
    setIdUsuarioEditando(u.id);
    setNuevoUserNombre(u.nombre || '');
    setNuevoUserEmail(u.email || '');
    setNuevoUserPassword('');
    const rolBase = u.rol || 'recepcion_ordenes';
    setNuevoUserRol(rolBase);
    setPermisosSeleccionados(
      Array.isArray(u.permisos) && u.permisos.length > 0 
        ? u.permisos 
        : (PERMISOS_DEFAULT_POR_ROL[rolBase] || PERMISOS_DEFAULT_POR_ROL['recepcion_ordenes'])
    );
  };

  const guardarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUserEmail) return;
    const emailLimpio = nuevoUserEmail.trim().toLowerCase();
    if (emailLimpio === user.email?.toLowerCase() && nuevoUserRol !== 'admin') {
      return alert('⚠️ No puedes bajarte el rol a tu propio correo de Administrador.');
    }
    if (permisosSeleccionados.length === 0) {
      return alert('Selecciona al menos un módulo permitido para este usuario.');
    }

    setCreandoEmpleado(true);
    try {
      // 1. MODO EDICIÓN DE USUARIO EXISTENTE
      if (idUsuarioEditando) {
        await updateDoc(doc(db, 'usuarios_roles', idUsuarioEditando), {
          nombre: nuevoUserNombre,
          email: emailLimpio,
          rol: nuevoUserRol,
          permisos: permisosSeleccionados,
          activo: true
        });
        limpiarFormularioUsuario();
        alert(`✅ Permisos y rol de "${nuevoUserNombre}" actualizados al instante.`);
        return;
      }

      // 2. MODO CREACIÓN O REUTILIZACIÓN DE CORREO ELIMINADO
      if (nuevoUserPassword && nuevoUserPassword.length >= 6) {
        const secondaryAppName = "SecondaryCreatorApp";
        const existingApp = getApps().find(a => a.name === secondaryAppName);
        const secondaryApp = existingApp || initializeApp(auth.app.options, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, nuevoUserPassword);
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          // Si el correo ya existía en Firebase Auth (porque fue creado y borrado antes), NO bloqueamos: lo reutilizamos
          if (authErr.code === 'auth/email-already-in-use') {
            console.log('El correo ya existe en Firebase Auth; se revincula en Firestore con los nuevos permisos.');
          } else {
            throw authErr;
          }
        }
      }

      // Verificar si ya existe un documento con ese correo en Firestore para actualizarlo en lugar de duplicarlo
      const docExistente = usuariosRoles.find(u => u.email?.toLowerCase() === emailLimpio);
      if (docExistente) {
        await updateDoc(doc(db, 'usuarios_roles', docExistente.id), {
          tenantId: tenantId,
          nombreNegocio: nombreNegocioActivo,
          nombre: nuevoUserNombre,
          email: emailLimpio,
          rol: nuevoUserRol,
          permisos: permisosSeleccionados,
          activo: true
        });
      } else {
        await addDoc(collection(db, 'usuarios_roles'), { 
          tenantId: tenantId,
          nombreNegocio: nombreNegocioActivo,
          email: emailLimpio, 
          nombre: nuevoUserNombre, 
          rol: nuevoUserRol, 
          permisos: permisosSeleccionados,
          activo: true,
          fecha: serverTimestamp() 
        });
      }

      limpiarFormularioUsuario();
      alert(`✅ Usuario "${nuevoUserNombre}" (${emailLimpio}) habilitado con éxito.`);
    } catch (err: any) {
      alert(`Error al guardar usuario: ${err.message}`);
    } finally {
      setCreandoEmpleado(false);
    }
  };

  // Bloquear pantalla si el usuario o local fue suspendido por el administrador
  if ((registroRolActual && registroRolActual.activo === false) || (sucursalAsociada && sucursalAsociada.activo === false)) {
    return (
      <div style={{ padding: '80px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div className="neon-card neon-card-pink">
          <h2 className="glow-text-red">🚫 Acceso Suspendido</h2>
          <p style={{ color: 'var(--text-muted)' }}>Tu cuenta ({user.email}) se encuentra temporalmente desactivada por el Administrador.</p>
          <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: '15px' }}>Cerrar Sesión</button>
        </div>
      </div>
    );
  }

  const listaSectores = (config.sectoresTaller || CONFIG_DEFAULT.sectoresTaller).split(',').map((s:string) => s.trim());
  const urlVitrinaPropia = esSucursalExterna ? `${window.location.origin}/?tienda=${sucursalAsociada.id}` : window.location.origin;

  const etiquetaRolVisual = rolNormalizado === 'recepcion_ordenes' 
    ? 'RECEPCIÓN Y ÓRDENES' 
    : rolNormalizado === 'vendedor_admin' 
      ? 'VENDEDOR Y FINANZAS' 
      : rolNormalizado === 'personalizado'
        ? 'PERMISOS A MEDIDA'
        : 'ADMINISTRADOR TOTAL';

  const precioListaPreview = Number(prodPrecio) || 0;
  const precioEfectivoPreview = aplicarRedondeo(precioListaPreview * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
  const precioTarjetaPreview = aplicarRedondeo(precioListaPreview * (1 + Number(config.recargoTarjetaPorcentaje || 0) / 100), config.redondeoPrecios);

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

      {/* SIDEBAR INTELIGENTE BASADO EN PERMISOS INDIVIDUALES */}
      <aside className="erp-sidebar">
        <div style={{ padding: '8px 10px 15px 10px', borderBottom: '1px solid rgba(128,128,128,0.18)', marginBottom: '6px' }}>
          <div className="glow-text-cyan" style={{ fontWeight: 800, fontSize: '16px' }}>{nombreNegocioActivo}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Perfil: <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.15)', color: 'var(--neon-cyan)' }}>
              {etiquetaRolVisual}
            </span>
          </div>
        </div>

        {!esSucursalExterna && rolNormalizado !== 'admin' && (
          <button onClick={restaurarSuperAdmin} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', marginBottom: '10px' }}>
            👑 Recuperar SuperAdmin
          </button>
        )}

        {tienePermisoModulo('dashboard') && (
          <button onClick={() => setPestaña('dashboard')} className={`neon-btn side-btn ${pestaña === 'dashboard' ? 'active' : ''}`}>📊 1. Mi Resumen & Tienda</button>
        )}

        {tienePermisoModulo('pos') && (
          <button onClick={() => setPestaña('pos')} className={`neon-btn side-btn ${pestaña === 'pos' ? 'active' : ''}`}>🛒 2. Caja POS & ARCA</button>
        )}

        {tienePermisoModulo('presupuestos') && (
          <button onClick={() => setPestaña('presupuestos')} className={`neon-btn side-btn ${pestaña === 'presupuestos' ? 'active' : ''}`}>
            📄 3. Presupuestos ({misPresupuestos.length})
          </button>
        )}

        {tienePermisoModulo('taller') && (
          <button onClick={() => setPestaña('taller')} className={`neon-btn side-btn ${pestaña === 'taller' ? 'active' : ''}`}>
            🛠️ 4. {esSucursalExterna ? `Órdenes Reparación (${equiposEnBanco})` : `Control Órdenes (${equiposEnBanco})`}
          </button>
        )}

        {!esSucursalExterna && esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('talleres_b2b')} className={`neon-btn side-btn ${pestaña === 'talleres_b2b' ? 'active' : ''}`}>🏢 5. Red Locales Gremio ({talleresGremio.length})</button>
        )}

        {tienePermisoModulo('catalogo') && (
          <button onClick={() => setPestaña('catalogo')} className={`neon-btn side-btn ${pestaña === 'catalogo' ? 'active' : ''}`}>📦 6. Mi Stock & Precios ({misProductos.length})</button>
        )}

        {tienePermisoModulo('rma') && (
          <button onClick={() => setPestaña('rma')} className={`neon-btn side-btn ${pestaña === 'rma' ? 'active' : ''}`}>🔄 7. Garantías & RMA</button>
        )}
        
        {tienePermisoModulo('pedidos') && (
          <button onClick={() => setPestaña('pedidos')} className={`neon-btn side-btn ${pestaña === 'pedidos' ? 'active' : ''}`}>🌐 8. Mis Pedidos Web</button>
        )}
        {tienePermisoModulo('clientes') && (
          <button onClick={() => setPestaña('clientes')} className={`neon-btn side-btn ${pestaña === 'clientes' ? 'active' : ''}`}>👥 9. Mis Clientes CRM</button>
        )}
        {tienePermisoModulo('proveedores') && (
          <button onClick={() => setPestaña('proveedores')} className={`neon-btn side-btn ${pestaña === 'proveedores' ? 'active' : ''}`}>🚚 10. Importar mi Excel</button>
        )}
        {tienePermisoModulo('finanzas') && (
          <button onClick={() => setPestaña('finanzas')} className={`neon-btn side-btn ${pestaña === 'finanzas' ? 'active' : ''}`}>💰 11. Finanzas & Facturar ARCA</button>
        )}

        {esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('configuracion')} className={`neon-btn side-btn ${pestaña === 'configuracion' ? 'active' : ''}`}>
            🛡️ 12. {esSucursalExterna ? 'Datos ARCA & Usuarios' : 'ARCA, Temas & Usuarios'}
          </button>
        )}

        <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: 'auto', width: '100%' }}>🚪 Cerrar Sesión</button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="erp-main">

        {/* MÓDULO 1: DASHBOARD */}
        {pestaña === 'dashboard' && tienePermisoModulo('dashboard') && (
          <div>
            <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderLeft: '4px solid var(--neon-green)' }}>
              <div>
                <h2 className="glow-text-cyan" style={{ margin: 0 }}>📊 Panel de Control // {nombreNegocioActivo}</h2>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📍 {direccionNegocioActivo} | 📱 WhatsApp: {whatsappNegocioActivo} | 🏛️ CUIT ARCA: <b>{datosFiscalesActivos.cuit}</b> (Pto. Vta: {datosFiscalesActivos.puntoVentaArca})
                </div>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Link de tu Tienda Pública Exclusiva: <a href={urlVitrinaPropia} target="_blank" rel="noreferrer" className="glow-text-green" style={{ fontWeight: 'bold' }}>{urlVitrinaPropia}</a>
                </span>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(urlVitrinaPropia); alert('Link de tu tienda copiado al portapapeles'); }} className="neon-btn neon-btn-green">
                🔗 Copiar Link de Mi Tienda
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '25px' }}>
              <div className="neon-card">
                <span className="label-neon">🔬 Equipos en Proceso</span>
                <h2 className="glow-text-cyan" style={{ margin: '6px 0' }}>{equiposEnBanco}</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sincronizados con Laboratorio</span>
              </div>
              <div className="neon-card neon-card-green">
                <span className="label-neon">✅ Reparados Listos</span>
                <h2 className="glow-text-green" style={{ margin: '6px 0' }}>{equiposListosSinRetirar}</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Listos para entregar al cliente</span>
              </div>
              {esSucursalExterna ? (
                <div className="neon-card neon-card-pink">
                  <span className="label-neon">🏢 Saldo Cta. Cte. Laboratorio</span>
                  <h2 className="glow-text-pink" style={{ margin: '6px 0' }}>${Number(sucursalAsociada.saldoDeudor || 0).toLocaleString()}</h2>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Límite Cta. Cte.: ${Number(sucursalAsociada.limiteCredito || 0).toLocaleString()}</span>
                </div>
              ) : (
                <div className="neon-card neon-card-pink">
                  <span className="label-neon">🏢 Ctas. Ctes. Locales B2B</span>
                  <h2 className="glow-text-pink" style={{ margin: '6px 0' }}>${deudaTotalTalleresB2B.toLocaleString()}</h2>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total a cobrar de {talleresGremio.length} locales</span>
                </div>
              )}
              <div className="neon-card neon-card-yellow">
                <span className="label-neon">📦 Mi Stock Valorizado (Lista)</span>
                <h2 className="glow-text-yellow" style={{ margin: '6px 0' }}>${capitalVentaPanol.toLocaleString()}</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Costo base: ${capitalCostoPanol.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <div className="neon-card">
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>⚡ Acciones Directas de {nombreNegocioActivo}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => setPestaña('pos')} className="neon-btn neon-btn-green" style={{ padding: '14px' }}>🛒 Caja POS & Facturar ARCA</button>
                  <button onClick={() => setPestaña('presupuestos')} className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>📄 Crear Presupuesto</button>
                  <button onClick={() => setPestaña('taller')} className="neon-btn neon-btn-purple" style={{ padding: '14px' }}>🛠️ Ingresar Equipo</button>
                  <button onClick={() => setPestaña('configuracion')} className="neon-btn neon-btn-pink" style={{ padding: '14px' }}>🛡️ Gestionar Usuarios/ARCA</button>
                </div>
              </div>

              <div className="neon-card">
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>🏆 Mis 5 Artículos Más Vendidos</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {[...misProductos].sort((a, b) => (b.ventas || 0) - (a.ventas || 0)).slice(0, 5).map((p, i) => (
                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                      <span><b className="glow-text-cyan">#{i + 1}</b> {p.nombre}</span>
                      <span className="neon-badge" style={{ background: 'rgba(40,205,65,0.15)', color: 'var(--neon-green)' }}>{p.ventas || 0} vendidos</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 2: PUNTO DE VENTA (POS) + ARCA */}
        {pestaña === 'pos' && tienePermisoModulo('pos') && (
          <div>
            <h2 className="glow-text-green" style={{ marginTop: 0 }}>🛒 Caja POS Mostrador & Facturación ARCA // {nombreNegocioActivo}</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div className="neon-card" style={{ flex: '2 1 500px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <input type="text" className="neon-input" placeholder="🔍 Buscar en MI stock por código de barras o nombre..." value={busquedaPOS} onChange={e=>setBusquedaPOS(e.target.value)} />
                  <button onClick={() => setEscaneandoPara('buscador')} className="neon-btn">📷 Lector</button>
                </div>
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table className="neon-table">
                    <thead><tr><th>Ubicación</th><th>Mi Artículo</th><th>Stock</th><th>Precio de Lista</th><th>Acción</th></tr></thead>
                    <tbody>
                      {misProductos.filter(p => p.stock > 0 && (p.nombre.toLowerCase().includes(busquedaPOS.toLowerCase()) || (p.codigoBarras && p.codigoBarras.includes(busquedaPOS)))).slice(0, 20).map(p => (
                        <tr key={p.id}>
                          <td><span className="neon-badge" style={{ background: 'rgba(175,82,222,0.15)', color: 'var(--neon-purple)' }}>{p.ubicacion || 'S/U'}</span></td>
                          <td><b>{p.nombre}</b><br/><small style={{ color: 'var(--text-muted)' }}>{p.categoria}</small></td>
                          <td className="glow-text-green" style={{ fontWeight: 'bold' }}>{p.stock}</td>
                          <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                          <td><button onClick={() => agregarAlPOS(p)} className="neon-btn neon-btn-fillCyan">+ Sumar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="neon-card neon-card-green" style={{ flex: '1 1 340px' }}>
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>🧾 Ticket / Factura Electrónica ARCA</h3>
                <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '12px', border: '1px solid rgba(0,122,255,0.2)' }}>
                  <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>🏛️ Comprobante Fiscal ARCA (Pto. Vta: {datosFiscalesActivos.puntoVentaArca})</label>
                  <select className="neon-select" value={tipoFacturaPOS} onChange={e=>setTipoFacturaPOS(e.target.value as any)} style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                    <option value="SIN_FACTURA">🧾 Solo Ticket Interno (Sin Facturar en ARCA)</option>
                    <option value="C">🏛️ Emitir Factura C Electrónica ARCA</option>
                    <option value="B">🏛️ Emitir Factura B Electrónica ARCA</option>
                    <option value="A">🏛️ Emitir Factura A Electrónica ARCA</option>
                  </select>
                  <input type="text" className="neon-input" placeholder="Nombre / Razón Social Receptor" value={clientePOS} onChange={e=>setClientePOS(e.target.value)} style={{ marginBottom: '8px' }} />
                  {tipoFacturaPOS !== 'SIN_FACTURA' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="neon-input" placeholder="CUIT o DNI Receptor" value={cuitPOS} onChange={e=>setCuitPOS(e.target.value)} />
                      <select className="neon-select" value={condicionIvaPOS} onChange={e=>setCondicionIvaPOS(e.target.value)}>
                        <option value="Consumidor Final">Cons. Final</option>
                        <option value="Responsable Monotributo">Monotributo</option>
                        <option value="IVA Responsable Inscripto">Resp. Inscripto</option>
                        <option value="IVA Sujeto Exento">Exento</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid rgba(128,128,128,0.15)' }}>
                  {carritoPOS.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                      <div><b>{item.cantidad}x</b> {item.nombre}<br/><small className="glow-text-cyan">Lista: ${(item.precio * item.cantidad).toLocaleString()}</small></div>
                      <button onClick={() => setCarritoPOS(carritoPOS.filter(i => i.id !== item.id))} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>✕</button>
                    </div>
                  ))}
                  {carritoPOS.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Selecciona artículos a la izquierda.</p>}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label-neon">Medio de Pago (Calcula sobre Precio Lista)</label>
                  <select className="neon-select" value={metodoPagoPOS} onChange={e=>setMetodoPagoPOS(e.target.value as any)}>
                    <option value="efectivo">💵 Efectivo (-{config.descuentoEfectivoPorcentaje}% sobre Precio Lista)</option>
                    <option value="transferencia">🏦 Transferencia (Precio de Lista Exacto)</option>
                    <option value="mercadopago">📱 Mercado Pago (Precio de Lista Exacto)</option>
                    <option value="tarjeta">💳 Tarjeta / Cuotas (+{config.recargoTarjetaPorcentaje}% sobre Precio Lista)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                    <span>Subtotal Precio de Lista:</span><span>${subtotalPOS.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', fontWeight: 'bold', marginTop: '6px' }}>
                    <span>A COBRAR:</span><span className="glow-text-green">${totalFinalPOS.toLocaleString()}</span>
                  </div>
                </div>

                <button onClick={cobrarVentaPOS} disabled={carritoPOS.length === 0} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
                  {tipoFacturaPOS === 'SIN_FACTURA' ? '✅ Cobrar en Mi Caja' : `🏛️ Cobrar y Emitir Factura ${tipoFacturaPOS} ARCA`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 3: GENERADOR DE PRESUPUESTOS */}
        {pestaña === 'presupuestos' && tienePermisoModulo('presupuestos') && (
          <div>
            <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>📄 Generador de Presupuestos y Cotizaciones // {nombreNegocioActivo}</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
              <div className="neon-card" style={{ flex: '1 1 420px' }}>
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>1. Agregar Repuestos o Mano de Obra</h3>
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', marginBottom: '16px' }}>
                  <label className="label-neon">🛠️ Agregar Mano de Obra / Servicio o Repuesto Manual</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="neon-input" placeholder="Ej: Cambio de Módulo + Hidrogel" value={itemManualDesc} onChange={e=>setItemManualDesc(e.target.value)} style={{ flex: 2 }} />
                    <input type="number" className="neon-input" placeholder="Precio Lista $" value={itemManualPrecio} onChange={e=>setItemManualPrecio(e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={agregarItemManualPresupuesto} className="neon-btn neon-btn-fillCyan">+ Añadir</button>
                  </div>
                </div>

                <label className="label-neon">📦 O Seleccionar Artículo desde Mi Stock</label>
                <input type="text" className="neon-input" placeholder="🔍 Buscar artículo en mi inventario..." value={busquedaProdPres} onChange={e=>setBusquedaProdPres(e.target.value)} style={{ marginBottom: '10px' }} />
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table className="neon-table">
                    <thead><tr><th>Artículo</th><th>Precio Lista</th><th>Sumar</th></tr></thead>
                    <tbody>
                      {misProductos.filter(p => p.nombre.toLowerCase().includes(busquedaProdPres.toLowerCase())).slice(0, 12).map(p => (
                        <tr key={p.id}>
                          <td><b>{p.nombre}</b> <small style={{ color: 'var(--text-muted)' }}>(Stock: {p.stock})</small></td>
                          <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                          <td><button type="button" onClick={() => agregarProductoAPresupuesto(p)} className="neon-btn">+ Cotizar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <form onSubmit={guardarPresupuesto} className="neon-card neon-card-green" style={{ flex: '1 1 420px' }}>
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>2. Datos del Cliente y Totales</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div><label className="label-neon">Nombre del Cliente</label><input type="text" className="neon-input" required value={presCliente} onChange={e=>setPresCliente(e.target.value)} placeholder="Ej: Juan Pérez" /></div>
                  <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={presTel} onChange={e=>setPresTel(e.target.value)} placeholder="2262..." /></div>
                  <div><label className="label-neon">Equipo / Modelo</label><input type="text" className="neon-input" value={presEquipo} onChange={e=>setPresEquipo(e.target.value)} placeholder="Ej: Moto G84 5G" /></div>
                  <div><label className="label-neon">Validez (Días)</label><input type="number" className="neon-input" value={presValidez} onChange={e=>setPresValidez(e.target.value)} /></div>
                </div>

                <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid rgba(128,128,128,0.15)' }}>
                  {itemsPresupuesto.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                      <div><b>{it.cantidad}x</b> {it.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <b className="glow-text-cyan">${(it.precio * it.cantidad).toLocaleString()}</b>
                        <button type="button" onClick={() => setItemsPresupuesto(itemsPresupuesto.filter((_, i) => i !== idx))} className="neon-btn neon-btn-red" style={{ padding: '3px 8px' }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {itemsPresupuesto.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aún no agregaste ítems al presupuesto.</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '12px', textAlign: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💵 EFECTIVO (-{config.descuentoEfectivoPorcentaje}%)</span>
                    <b className="glow-text-green" style={{ fontSize: '18px' }}>${totalEfectivoPresupuesto.toLocaleString()}</b>
                  </div>
                  <div style={{ borderLeft: '1px solid rgba(128,128,128,0.2)', borderRight: '1px solid rgba(128,128,128,0.2)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>📋 PRECIO DE LISTA</span>
                    <b className="glow-text-cyan" style={{ fontSize: '18px' }}>${totalListaPresupuesto.toLocaleString()}</b>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💳 TARJETA (+{config.recargoTarjetaPorcentaje}%)</span>
                    <b className="glow-text-pink" style={{ fontSize: '18px' }}>${totalTarjetaPresupuesto.toLocaleString()}</b>
                  </div>
                </div>

                <input type="text" className="neon-input" value={presNotas} onChange={e=>setPresNotas(e.target.value)} placeholder="Notas al pie..." style={{ marginBottom: '12px' }} />

                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
                  💾 Guardar Presupuesto Oficial
                </button>
              </form>
            </div>

            <div className="neon-card" style={{ overflowX: 'auto' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>📋 Historial de Presupuestos Emitidos</h3>
              <table className="neon-table">
                <thead>
                  <tr>
                    <th>N° / Fecha</th>
                    <th>Cliente & Equipo</th>
                    <th>Detalle Cotizado</th>
                    <th>Efectivo</th>
                    <th>Precio Lista</th>
                    <th>Tarjeta</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {misPresupuestos.map(pr => (
                    <tr key={pr.id}>
                      <td><b className="glow-text-cyan">#{pr.numero}</b><br/><small style={{ color: 'var(--text-muted)' }}>{pr.fechaTexto}</small></td>
                      <td><b>{pr.cliente}</b><br/><small style={{ color: 'var(--text-muted)' }}>{pr.equipo || '-'} | 📱 {pr.telefono}</small></td>
                      <td style={{ fontSize: '13px' }}>{pr.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(', ')}</td>
                      <td className="glow-text-green" style={{ fontWeight: 'bold' }}>${pr.totalEfectivo?.toLocaleString()}</td>
                      <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${pr.totalLista?.toLocaleString()}</td>
                      <td className="glow-text-pink" style={{ fontWeight: 'bold' }}>${pr.totalTarjeta?.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => enviarPresupuestoWhatsApp(pr)} className="neon-btn neon-btn-green">💬 WhatsApp</button>
                          <button onClick={() => imprimirPresupuestoPDF(pr)} className="neon-btn">🖨️ PDF</button>
                          <button onClick={() => convertirPresupuestoEnOrden(pr)} className="neon-btn neon-btn-purple">🛠️ Hacer Orden</button>
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
        )}

        {/* MÓDULO 4: ORDENES DE SERVICIO */}
        {pestaña === 'taller' && tienePermisoModulo('taller') && (
          <div>
            <form onSubmit={guardarOrden} className="neon-card" style={{ marginBottom: '22px' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
                {esSucursalExterna ? `📝 Ingreso y Gestión de Orden de Reparación (${nombreNegocioActivo})` : '📝 Recepción Central de Laboratorio (Control Absoluto)'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="label-neon">1. Sucursal & Cliente</label>
                  {!esSucursalExterna ? (
                    <select className="neon-select" value={tallerOrigenOrden} onChange={e=>setTallerOrigenOrden(e.target.value)} style={{ marginBottom: '8px' }}>
                      <option value="Mostrador Propio">🏪 Mostrador Central Walabba</option>
                      {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Local Asociado: {t.nombre}</option>)}
                    </select>
                  ) : (
                    <div className="neon-badge" style={{ background: 'rgba(88,86,214,0.15)', color: 'var(--neon-pink)', marginBottom: '8px', padding: '7px 12px' }}>
                      🏢 Sucursal: {sucursalAsociada.nombre}
                    </div>
                  )}
                  <input type="text" className="neon-input" placeholder="Nombre del Cliente" value={cliNombre} onChange={e=>setCliNombre(e.target.value)} required style={{ marginBottom: '8px' }}/>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="neon-input" placeholder="WhatsApp (2262...)" value={cliTel} onChange={e=>setCliTel(e.target.value)} required />
                    <input type="text" className="neon-input" placeholder="DNI" value={cliDni} onChange={e=>setCliDni(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label-neon">2. Equipo & Seguridad</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" className="neon-input" placeholder="Marca" value={marca} onChange={e=>setMarca(e.target.value)} required />
                    <input type="text" className="neon-input" placeholder="Modelo" value={modelo} onChange={e=>setModelo(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="neon-input" placeholder="IMEI / Serie" value={imei} onChange={e=>setImei(e.target.value)} />
                    <input type="text" className="neon-input" placeholder="PIN / Patrón" value={contrasena} onChange={e=>setContrasena(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label-neon">3. Falla y Estado Estético</label>
                  <input type="text" className="neon-input" placeholder="Falla a reparar" value={falla} onChange={e=>setFalla(e.target.value)} required style={{ marginBottom: '8px' }}/>
                  <input type="text" className="neon-input" placeholder="Estética (Rayas, golpes)" value={condicionVisual} onChange={e=>setCondicionVisual(e.target.value)} />
                </div>
                <div>
                  <label className="label-neon">4. Importes & Seña</label>
                  {!esSucursalExterna && (
                    <select className="neon-select" value={tecnico} onChange={e=>setTecnico(e.target.value)} style={{ marginBottom: '8px' }}>
                      <option value="">Asignar Sector...</option>
                      {listaSectores.map((s:string)=><option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="number" className="neon-input" placeholder="Precio Cliente $" value={presupuestoInicial} onChange={e=>setPresupuestoInicial(e.target.value)} />
                    <input type="number" className="neon-input" placeholder="Seña $" value={señaRecibida} onChange={e=>setSeñaRecibida(e.target.value)} />
                  </div>
                  {!esSucursalExterna && tallerOrigenOrden !== 'Mostrador Propio' && (
                    <input type="number" className="neon-input" placeholder="Costo Gremio al Local $" value={costoGremioInicial} onChange={e=>setCostoGremioInicial(e.target.value)} />
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
              <input type="text" className="neon-input" placeholder="🔍 Buscar por código, cliente, local o modelo..." value={busquedaTaller} onChange={e=>setBusquedaTaller(e.target.value)} style={{ flex: '1 1 220px' }} />
              {!esSucursalExterna && (
                <select className="neon-select" value={filtroOrigenTaller} onChange={e=>setFiltroOrigenTaller(e.target.value)} style={{ width: 'auto' }}>
                  <option value="todos">🏢 Todos los Locales + Central</option>
                  <option value="Mostrador Propio">🏪 Solo Mostrador Central</option>
                  {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Local: {t.nombre}</option>)}
                </select>
              )}
              <select className="neon-select" value={filtroEstadoTaller} onChange={e=>setFiltroEstadoTaller(e.target.value)} style={{ width: 'auto' }}>
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
                        <b className="glow-text-cyan" style={{ fontSize: '17px' }}>#{o.codigoSeguimiento}</b><br/>
                        <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)', marginTop: '4px' }}>
                          {o.tallerOrigen || 'Central'}
                        </span>
                      </td>
                      <td><b>{o.cliente?.nombre}</b><br/><span className="glow-text-green" style={{ fontSize: '14px' }}>📱 {o.cliente?.telefono}</span></td>
                      <td>
                        <b>{o.equipo?.marca} {o.equipo?.modelo}</b> {o.equipo?.contrasena && <span className="neon-badge" style={{ background: 'rgba(255,149,0,0.15)', color: 'var(--neon-yellow)' }}>🔑 {o.equipo.contrasena}</span>}<br/>
                        <span className="glow-text-red">Falla: {o.fallaDeclarada}</span>
                        {o.historial?.length > 0 && (
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            📝 Últ. Estado: {o.historial[o.historial.length - 1].comentario}
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
                          <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir Orden">🖨️</button>
                          {esAdminDelNegocioActivo && (
                            <button onClick={async()=>{if(window.confirm('¿Eliminar orden?'))await deleteDoc(doc(db,'ordenes_taller',o.id))}} className="neon-btn neon-btn-red">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MÓDULO 5: RED DE LOCALES ASOCIADOS (CON EDICIÓN Y REUTILIZACIÓN EMAIL)*/}
        {/* ==================================================================== */}
        {pestaña === 'talleres_b2b' && !esSucursalExterna && esAdminDelNegocioActivo && (
          <div>
            <h2 className="glow-text-pink" style={{ marginTop: 0 }}>🏢 Gestión de Locales Asociados (Alta, Edición y Reutilización de Correos)</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarTallerGremio} className="neon-card neon-card-pink" style={{ flex: '1 1 340px', alignSelf: 'flex-start' }}>
                <h3 className="glow-text-pink" style={{ marginTop: 0 }}>
                  {idTallerEditando ? '✏️ Editando Local Asociado' : '➕ Dar de Alta Local Gremio'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><label className="label-neon">Nombre Comercial del Local</label><input type="text" className="neon-input" required value={tallerNom} onChange={e=>setTallerNom(e.target.value)} placeholder="Ej: TecnoCell Centro" /></div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}><label className="label-neon">Responsable</label><input type="text" className="neon-input" required value={tallerEncargado} onChange={e=>setTallerEncargado(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><label className="label-neon">Ciudad</label><input type="text" className="neon-input" required value={tallerCiudad} onChange={e=>setTallerCiudad(e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}><label className="label-neon">Dirección del Local</label><input type="text" className="neon-input" required value={tallerDireccion} onChange={e=>setTallerDireccion(e.target.value)} placeholder="Calle 62 N° 2500" /></div>
                    <div style={{ flex: 1 }}><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" required value={tallerTel} onChange={e=>setTallerTel(e.target.value)} /></div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', border: '1px dashed var(--neon-pink)' }}>
                    <label className="label-neon" style={{ color: 'var(--neon-pink)' }}>🔐 Credenciales del Dueño del Local</label>
                    <input type="email" className="neon-input" required value={tallerEmail} onChange={e=>setTallerEmail(e.target.value)} placeholder="Email Admin del Local" style={{ marginBottom: '8px' }} />
                    {!idTallerEditando && (
                      <input type="text" className="neon-input" minLength={6} value={tallerPassword} onChange={e=>setTallerPassword(e.target.value)} placeholder="Contraseña (Si el correo ya existía, dejar vacío o poner la misma)" />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="label-neon">Categoría Gremio</label>
                      <select className="neon-select" value={tallerNivel} onChange={e=>setTallerNivel(e.target.value as any)}>
                        <option value="Bronce">Bronce</option>
                        <option value="Oro">Oro</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label-neon">Límite Cta. Cte. ($)</label>
                      <input type="number" className="neon-input" value={tallerLimiteCredito} onChange={e=>setTallerLimiteCredito(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button type="submit" disabled={creandoCuentaLocal} className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '14px' }}>
                      {creandoCuentaLocal ? 'Guardando...' : idTallerEditando ? '💾 Guardar Cambios' : '🚀 Crear / Reactivar Local'}
                    </button>
                    {idTallerEditando && (
                      <button type="button" onClick={limpiarFormularioTaller} className="neon-btn neon-btn-red">Cancelar</button>
                    )}
                  </div>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 580px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Local / Usuario Admin</th><th>Estado</th><th>Equipos</th><th>Saldo Cta. Cte.</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {talleresGremio.map(t => {
                      const equiposDelTaller = ordenes.filter(o => (o.tallerOrigen === t.nombre || o.tallerId === t.id) && o.estado !== 'entregado').length;
                      const linkTiendaLocal = `${window.location.origin}/?tienda=${t.id}`;
                      const estaActivo = t.activo !== false;
                      return (
                        <tr key={t.id} style={{ opacity: estaActivo ? 1 : 0.55 }}>
                          <td>
                            <b>{t.nombre}</b> ({t.ciudad || 'Local'})<br/>
                            <small className="glow-text-cyan">👤 {t.email}</small><br/>
                            <small style={{ color: 'var(--text-muted)' }}>📍 {t.direccion} | 📱 {t.telefono}</small>
                          </td>
                          <td>
                            <button 
                              onClick={() => updateDoc(doc(db, 'talleres_gremio', t.id), { activo: !estaActivo })}
                              className={`neon-btn ${estaActivo ? 'neon-btn-green' : 'neon-btn-red'}`}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              {estaActivo ? '🟢 Activo' : '🔴 Suspendido'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="glow-text-cyan">{equiposDelTaller}</td>
                          <td>
                            <b className={Number(t.saldoDeudor) > 0 ? 'glow-text-red' : 'glow-text-green'} style={{ fontSize: '17px' }}>
                              ${Number(t.saldoDeudor || 0).toLocaleString()}
                            </b>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={() => cargarTallerParaEdicion(t)} className="neon-btn" title="Editar Local">✏️ Editar</button>
                              <button onClick={() => registrarPagoCtaCteTaller(t)} className="neon-btn neon-btn-green">💵 Cobrar</button>
                              <a href={linkTiendaLocal} target="_blank" rel="noreferrer" className="neon-btn" style={{ textDecoration: 'none' }}>🌐</a>
                              <button onClick={() => { if(window.confirm('¿Eliminar local? Podrás volver a usar su mismo correo cuando quieras.')) deleteDoc(doc(db,'talleres_gremio',t.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 6: STOCK Y CARGA DEL PRECIO DE LISTA */}
        {pestaña === 'catalogo' && tienePermisoModulo('catalogo') && (
          <div>
            <form onSubmit={guardarProducto} className="neon-card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap' }}>
                <h3 className="glow-text-cyan" style={{ margin: 0 }}>
                  {idEditando ? '✏️ Editar Artículo y Precio de Lista' : `➕ Cargar Artículo y Precio de Lista (${nombreNegocioActivo})`}
                </h3>
                <label style={{ fontWeight: 'bold', cursor: 'pointer' }}>
                  <input type="checkbox" checked={prodDestacado} onChange={e=>setProdDestacado(e.target.checked)} /> ⭐ Destacar en Mi Tienda Web
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label className="label-neon">1. Costo de Compra ($)</label>
                  <input type="number" className="neon-input" placeholder="Costo $" value={prodCosto} onChange={e=>setProdCosto(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={calcularPrecioVenta} className="neon-btn neon-btn-green" style={{ width: '100%', height: '45px' }}>
                    ⚡ Autocalcular Lista (+{config.margenGanancia}%)
                  </button>
                </div>
                <div>
                  <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>2. PRECIO DE LISTA BASE ($) *</label>
                  <input type="number" className="neon-input" placeholder="Precio de Lista $" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} required style={{ borderColor: 'var(--neon-cyan)', fontWeight: 'bold' }} />
                </div>
                <div>
                  <label className="label-neon">3. Stock Disponible *</label>
                  <input type="number" className="neon-input" placeholder="Unidades" value={prodStock} onChange={e=>setProdStock(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '14px', marginBottom: '14px', border: '1px solid rgba(0,122,255,0.2)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💵 PRECIO EFECTIVO (-{config.descuentoEfectivoPorcentaje}%):</span>
                  <b className="glow-text-green" style={{ fontSize: '18px' }}>${precioEfectivoPreview.toLocaleString()}</b>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>📋 PRECIO DE LISTA (BASE):</span>
                  <b className="glow-text-cyan" style={{ fontSize: '18px' }}>${precioListaPreview.toLocaleString()}</b>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💳 PRECIO TARJETA (+{config.recargoTarjetaPorcentaje}%):</span>
                  <b className="glow-text-pink" style={{ fontSize: '18px' }}>${precioTarjetaPreview.toLocaleString()}</b>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <input type="text" className="neon-input" placeholder="Nombre / Modelo del Artículo *" value={prodNom} onChange={e=>setProdNom(e.target.value)} required />
                <input type="text" className="neon-input" placeholder="Categoría *" value={prodCat} onChange={e=>setProdCat(e.target.value)} required />
                <input type="text" className="neon-input" placeholder="📍 Gaveta / Estante" value={prodUbicacion} onChange={e=>setProdUbicacion(e.target.value)} />
                <input type="text" className="neon-input" placeholder="Proveedor" value={prodProveedor} onChange={e=>setProdProveedor(e.target.value)} />
                <input type="text" className="neon-input" placeholder="Cód. Barras" value={prodCodigoBarras} onChange={e=>setProdCodigoBarras(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '13px' }}>{idEditando ? 'Guardar Cambios de Precio/Artículo' : 'Publicar en Mi Inventario'}</button>
                {idEditando && <button type="button" onClick={limpiarFormularioProducto} className="neon-btn neon-btn-red">Cancelar</button>}
              </div>
            </form>

            <div className="neon-card" style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" className="neon-input" placeholder="🔍 Buscar en mi inventario..." value={busquedaInventario} onChange={e=>setBusquedaInventario(e.target.value)} style={{ flex: 1 }} />
              <select className="neon-select" value={filtroCategoriaInv} onChange={e=>setFiltroCategoriaInv(e.target.value)} style={{ width: 'auto' }}>
                {categoriasUnicasInv.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="neon-select" value={filtroStockInv} onChange={e=>setFiltroStockInv(e.target.value)} style={{ width: 'auto' }}>
                <option value="todos">Todo Mi Stock</option>
                <option value="critico">⚠️ Crítico (≤{config.stockCriticoAlerta})</option>
                <option value="agotado">❌ Sin Stock (0)</option>
              </select>
              <button onClick={pedirFaltantes} className="neon-btn neon-btn-green">📱 Exportar Faltantes WhatsApp</button>
            </div>

            {seleccionados.length > 0 && (
              <div className="neon-card neon-card-pink" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="glow-text-pink"><b>{seleccionados.length} seleccionados</b></span>
                <button onClick={eliminarSeleccionados} className="neon-btn neon-btn-red">Eliminar Seleccionados</button>
              </div>
            )}

            <div className="neon-card" style={{ overflowX: 'auto' }}>
              <table className="neon-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px' }}><input type="checkbox" checked={seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0} onChange={toggleTodos} /></th>
                    <th>Ubicación</th>
                    <th>Artículo</th>
                    <th>Costo</th>
                    <th>Precio de Lista</th>
                    <th>Efectivo (-{config.descuentoEfectivoPorcentaje}%)</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.map(p => {
                    const efvo = aplicarRedondeo((p.precio || 0) * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
                    return (
                      <tr key={p.id}>
                        <td><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggleSeleccion(p.id)} /></td>
                        <td><span className="neon-badge" style={{ background: 'rgba(175,82,222,0.15)', color: 'var(--neon-purple)' }}>📍 {p.ubicacion || 'S/U'}</span></td>
                        <td><b>{p.nombre}</b><br/><small style={{ color: 'var(--text-muted)' }}>{p.categoria} {p.proveedor && `| ${p.proveedor}`}</small></td>
                        <td style={{ color: 'var(--text-muted)' }}>${p.costoProveedor?.toLocaleString() || 0}</td>
                        <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                        <td className="glow-text-green" style={{ fontWeight: 'bold' }}>${efvo.toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => actualizarStock(p.id, p.stock - 1)} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>-</button>
                            <b className={p.stock <= config.stockCriticoAlerta ? 'glow-text-red' : 'glow-text-green'}>{p.stock}</b>
                            <button onClick={() => actualizarStock(p.id, p.stock + 1)} className="neon-btn neon-btn-green" style={{ padding: '4px 10px' }}>+</button>
                          </div>
                        </td>
                        <td><button onClick={() => cargarProductoParaEdicion(p)} className="neon-btn">✏️</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MÓDULO 7: RMA & GARANTÍAS */}
        {pestaña === 'rma' && tienePermisoModulo('rma') && (
          <div>
            <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>🔄 Control de RMA & Garantías</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarRMA} className="neon-card" style={{ flex: '1 1 300px' }}>
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>➕ Registrar Ticket RMA</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select className="neon-select" value={rmaTipo} onChange={e=>setRmaTipo(e.target.value as any)}>
                    <option value="proveedor">📦 Reclamo de Repuesto</option>
                    <option value="cliente">🛠️ Garantía de Reparación</option>
                  </select>
                  <input type="text" className="neon-input" required placeholder="Repuesto / Equipo" value={rmaProducto} onChange={e=>setRmaProducto(e.target.value)} />
                  <input type="text" className="neon-input" required placeholder="Proveedor o Cliente" value={rmaEntidad} onChange={e=>setRmaEntidad(e.target.value)} />
                  <input type="text" className="neon-input" required placeholder="Falla detectada" value={rmaMotivo} onChange={e=>setRmaMotivo(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Monto ($)" value={rmaMonto} onChange={e=>setRmaMonto(e.target.value)} />
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '12px' }}>Guardar RMA</button>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 550px' }}>
                <table className="neon-table">
                  <thead><tr><th>Fecha</th><th>Local</th><th>Artículo</th><th>Falla</th><th>Estado</th></tr></thead>
                  <tbody>
                    {rmas.filter(r => !esSucursalExterna || r.ownerId === tenantId).map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha}</td>
                        <td><span className="neon-badge" style={{ background: 'rgba(0,122,255,0.1)', color: 'var(--neon-cyan)' }}>{r.origenNombre || 'Central'}</span></td>
                        <td><b>{r.producto}</b> ({r.entidad})</td>
                        <td className="glow-text-red">{r.motivo}</td>
                        <td>
                          <select className="neon-select" value={r.estado} onChange={e=>updateDoc(doc(db,'rmas_garantias',r.id), {estado: e.target.value})} style={{ padding: '6px' }}>
                            <option value="pendiente">⏳ Pendiente</option>
                            <option value="enviado">🚚 En Revisión</option>
                            <option value="resuelto">✅ Resuelto</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 8: PEDIDOS WEB DE MI TIENDA */}
        {pestaña === 'pedidos' && tienePermisoModulo('pedidos') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h2 className="glow-text-pink" style={{ marginTop: 0 }}>🌐 Pedidos Recibidos en la Tienda de {nombreNegocioActivo}</h2>
            {misPedidosWeb.map(pedido => (
              <div key={pedido.id} className="neon-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="glow-text-pink" style={{ margin: '0 0 6px 0' }}>ORDEN WEB #{pedido.id.slice(-6).toUpperCase()}</h4>
                  <p style={{ margin: '2px 0' }}><b>Cliente:</b> {pedido.cliente.nombre} ({pedido.cliente.telefono})</p>
                  <p style={{ margin: '2px 0' }}><b>Modalidad:</b> {pedido.cliente.metodoEnvio.toUpperCase()} | <b>Pago:</b> {pedido.estadoPago.toUpperCase()}</p>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '12px', flex: 1, minWidth: '220px' }}>
                  <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '14px' }}>
                    {pedido.items.map((it:any, idx:number)=><li key={idx}>{it.cantidad}x {it.nombre} (${it.precio})</li>)}
                  </ul>
                  <b className="glow-text-green" style={{ display: 'block', marginTop: '6px' }}>Total: ${pedido.total?.toLocaleString()}</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                  <select className="neon-select" value={pedido.estadoPago} onChange={e=>cambiarEstadoPagoPedido(pedido, e.target.value)}>
                    <option value="pendiente">Pago Pendiente</option>
                    <option value="pagado">✅ Pagado (A Mi Caja)</option>
                  </select>
                  <select className="neon-select" value={pedido.estadoEnvio} onChange={e=>updateDoc(doc(db,'pedidos_ecommerce',pedido.id), {estadoEnvio: e.target.value})}>
                    <option value="preparacion">En Preparación</option>
                    <option value="enviado">Listo / En Camino</option>
                    <option value="entregado">Entregado</option>
                  </select>
                </div>
              </div>
            ))}
            {misPedidosWeb.length === 0 && <div className="neon-card">No tienes pedidos web registrados aún.</div>}
          </div>
        )}

        {/* MÓDULO 9: CRM CLIENTES PRIVADO */}
        {pestaña === 'clientes' && tienePermisoModulo('clientes') && (
          <div>
            <div className="neon-card neon-card-green" style={{ marginBottom: '20px' }}>
              <h3 className="glow-text-green" style={{ marginTop: 0 }}>📣 Mis Clientes & Campañas de WhatsApp ({nombreNegocioActivo})</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="text" className="neon-input" value={mensajePromoCRM} onChange={e=>setMensajePromoCRM(e.target.value)} style={{ flex: 1 }} />
                <input type="text" className="neon-input" placeholder="🔍 Buscar cliente..." value={busquedaClienteCRM} onChange={e=>setBusquedaClienteCRM(e.target.value)} style={{ width: '250px' }} />
              </div>
            </div>
            <div className="neon-card" style={{ overflowX: 'auto' }}>
              <table className="neon-table">
                <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Historial</th><th>Total Gastado</th><th>Acción</th></tr></thead>
                <tbody>
                  {clientesConsolidados.map((c, idx) => (
                    <tr key={idx}>
                      <td><b>{c.nombre}</b></td>
                      <td className="glow-text-green">📱 {c.telefono}</td>
                      <td>🛠️ {c.equipos} equipos | 🛒 {c.comprasWeb} pedidos</td>
                      <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${c.totalGastado.toLocaleString()}</td>
                      <td><button onClick={() => window.open(`https://wa.me/549${c.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(mensajePromoCRM.replace('{nombre}', c.nombre).replace('{empresa}', nombreNegocioActivo))}`, '_blank')} className="neon-btn neon-btn-green">🚀 Enviar Promo</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MÓDULO 10: IMPORTADOR EXCEL PRIVADO */}
        {pestaña === 'proveedores' && tienePermisoModulo('proveedores') && (
          <div className="neon-card">
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🚚 Importar Lista Excel al Stock de {nombreNegocioActivo}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div><label className="label-neon">Proveedor</label><input type="text" className="neon-input" value={nombreProveedorExcel} onChange={e=>setNombreProveedorExcel(e.target.value)} /></div>
              <div><label className="label-neon">Moneda</label><select className="neon-select" value={monedaListaExcel} onChange={e=>setMonedaListaExcel(e.target.value as any)}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (x ${config.cotizacionDolar})</option></select></div>
              <div><label className="label-neon">Archivo .xlsx</label><input type="file" id="fileExcel" accept=".xlsx, .xls" className="neon-input" onChange={procesarArchivoExcel} /></div>
            </div>
            {excelHojas.length > 0 && !excelCargando && (
              <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '14px' }}>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div><label className="label-neon">Pestaña</label><select className="neon-select" value={hojaActiva} onChange={cambiarHojaDropdown}>{excelHojas.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="label-neon">Col. Nombre</label><select className="neon-select" value={colNombre} onChange={e=>setColNombre(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                  <div><label className="label-neon">Col. Costo</label><select className="neon-select" value={colCosto} onChange={e=>setColCosto(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                  <div><label className="label-neon">Col. Marca</label><select className="neon-select" value={colMarca} onChange={e=>setColMarca(Number(e.target.value))}><option value={-1}>No Aplica</option>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                </div>
                <button onClick={importarDatosAlInventario} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>🚀 Sincronizar Precios de Lista con Mi Inventario</button>
              </div>
            )}
          </div>
        )}

        {/* MÓDULO 11: FINANZAS + FACTURACIÓN ARCA CON QR */}
        {pestaña === 'finanzas' && tienePermisoModulo('finanzas') && (
          <div>
            <h2 className="glow-text-green" style={{ marginTop: 0 }}>💰 Caja, Movimientos y Facturación ARCA // {nombreNegocioActivo}</h2>
            <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="neon-select" value={filtroTiempo} onChange={e=>setFiltroTiempo(e.target.value)} style={{ width: 'auto' }}><option value="todos">Todo el Historial</option><option value="hoy">Hoy</option><option value="mes">Este Mes</option></select>
              <select className="neon-select" value={filtroTipoLista} onChange={e=>setFiltroTipoLista(e.target.value)} style={{ width: 'auto' }}><option value="todos">Ingresos y Egresos</option><option value="ingreso">Solo Ingresos</option><option value="egreso">Solo Egresos</option></select>
              <input type="text" className="neon-input" placeholder="Buscar concepto..." value={filtroBusquedaConcepto} onChange={e=>setFiltroBusquedaConcepto(e.target.value)} style={{ flex: 1 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '22px' }}>
              <div className="neon-card neon-card-green" style={{ textAlign: 'center' }}><span className="label-neon">MIS INGRESOS</span><h2 className="glow-text-green" style={{ margin: '5px 0 0 0' }}>${totalIngresos.toLocaleString()}</h2></div>
              <div className="neon-card neon-card-pink" style={{ textAlign: 'center' }}><span className="label-neon">MIS EGRESOS</span><h2 className="glow-text-red" style={{ margin: '5px 0 0 0' }}>${totalEgresos.toLocaleString()}</h2></div>
              <div className="neon-card" style={{ textAlign: 'center' }}><span className="label-neon">MI CAJA NETA</span><h2 className="glow-text-cyan" style={{ margin: '5px 0 0 0' }}>${saldoNeto.toLocaleString()}</h2></div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={registrarMovimientoFinanzas} className="neon-card" style={{ flex: '1 1 280px', alignSelf: 'flex-start' }}>
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>➕ Registrar en Mi Caja</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <select className="neon-select" value={finTipo} onChange={e=>setFinTipo(e.target.value)}><option value="ingreso">Ingreso (+)</option><option value="egreso">Egreso / Gasto (-)</option></select>
                  <input type="text" className="neon-input" placeholder="Concepto" required value={finConcepto} onChange={e=>setFinConcepto(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Importe $" required value={finMonto} onChange={e=>setFinMonto(e.target.value)} />
                  <select className="neon-select" value={finMetodo} onChange={e=>setFinMetodo(e.target.value)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option></select>
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '12px' }}>Guardar Movimiento</button>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 620px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Fecha</th><th>Concepto (Click ▶ para Facturar en ARCA)</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {movimientosFiltrados.map(m => (
                      <React.Fragment key={m.id}>
                        <tr>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                          <td>
                            {m.tipo === 'ingreso' && (
                              <button onClick={() => setExpandidoId(expandidoId === m.id ? null : m.id)} className="neon-btn" style={{ padding: '4px 10px', marginRight: '6px' }}>{expandidoId === m.id ? '▼' : '▶'}</button>
                            )}
                            <b>{m.concepto}</b>
                            {m.factura && (
                              <span className="neon-badge" style={{ marginLeft: '8px', background: 'rgba(40,205,65,0.15)', color: 'var(--neon-green)' }}>
                                🏛️ FAC {m.factura.tipo} #{m.factura.numero}
                              </span>
                            )}
                          </td>
                          <td className="glow-text-cyan" style={{ textTransform: 'uppercase' }}>{m.metodoPago}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }} className={m.tipo === 'ingreso' ? 'glow-text-green' : 'glow-text-red'}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              {m.factura && (
                                <button onClick={() => imprimirFacturaARCA(m, datosFiscalesActivos)} className="neon-btn neon-btn-fillCyan" style={{ padding: '4px 10px' }} title="Imprimir Factura ARCA con QR">🖨️ ARCA</button>
                              )}
                              <button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'finanzas',m.id))}} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                        {expandidoId === m.id && (
                          <tr style={{ background: 'rgba(0, 122, 255, 0.04)' }}>
                            <td colSpan={5} style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 240px', background: 'var(--bg-input)', padding: '14px', borderRadius: '14px' }}>
                                  <h4 className="glow-text-cyan" style={{ margin: '0 0 8px 0' }}>📦 Detalle de Ítems de la Operación</h4>
                                  {m.items?.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                      {m.items.map((it:any, idx:number)=><li key={idx}><b>{it.cantidad}x</b> {it.nombre} (${it.precio})</li>)}
                                    </ul>
                                  ) : <span style={{ color: 'var(--text-muted)' }}>Movimiento directo sin desglose de artículos.</span>}
                                </div>

                                <div style={{ flex: '1 1 320px', background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(0,122,255,0.25)' }}>
                                  <h4 className="glow-text-green" style={{ margin: '0 0 10px 0' }}>🏛️ Facturación Electrónica ARCA (ex AFIP)</h4>
                                  {m.factura ? (
                                    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                      <div><b>Comprobante:</b> Factura {m.factura.tipo} N° {m.factura.numero}</div>
                                      <div><b>Receptor:</b> {m.factura.razonSocialReceptor} ({m.factura.cuit}) - {m.factura.condicionIvaReceptor}</div>
                                      <div><b>CAE Autorizado:</b> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{m.factura.cae}</span> (Vto: {m.factura.vtoCae})</div>
                                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <button onClick={() => imprimirFacturaARCA(m, datosFiscalesActivos)} className="neon-btn neon-btn-fillCyan">🖨️ Imprimir Factura ARCA (QR)</button>
                                        <button onClick={() => updateDoc(doc(db, 'finanzas', m.id), { factura: null })} className="neon-btn neon-btn-red">Anular Vínculo</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <select id={`arca-tipo-${m.id}`} className="neon-select" style={{ width: '110px', fontWeight: 'bold' }}>
                                          <option value="C">Factura C</option>
                                          <option value="B">Factura B</option>
                                          <option value="A">Factura A</option>
                                        </select>
                                        <select id={`arca-iva-${m.id}`} className="neon-select" style={{ flex: 1 }}>
                                          <option value="Consumidor Final">Consumidor Final</option>
                                          <option value="Responsable Monotributo">Monotributo</option>
                                          <option value="IVA Responsable Inscripto">Resp. Inscripto</option>
                                          <option value="IVA Sujeto Exento">IVA Exento</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <input id={`arca-cuit-${m.id}`} type="text" className="neon-input" placeholder="CUIT o DNI Receptor" style={{ flex: 1 }} />
                                        <input id={`arca-nombre-${m.id}`} type="text" className="neon-input" placeholder="Nombre / Razón Social" defaultValue="Consumidor Final" style={{ flex: 1 }} />
                                      </div>
                                      <input id={`arca-cae-${m.id}`} type="text" className="neon-input" placeholder="CAE Manual (Opcional - Dejar vacío para autogenerar CAE)" />
                                      <button onClick={async () => {
                                        const tipo = (document.getElementById(`arca-tipo-${m.id}`) as HTMLSelectElement).value;
                                        const condIva = (document.getElementById(`arca-iva-${m.id}`) as HTMLSelectElement).value;
                                        const cuitRec = (document.getElementById(`arca-cuit-${m.id}`) as HTMLInputElement).value;
                                        const nomRec = (document.getElementById(`arca-nombre-${m.id}`) as HTMLInputElement).value;
                                        const caeMan = (document.getElementById(`arca-cae-${m.id}`) as HTMLInputElement).value;
                                        const nuevaFac = generarDatosFacturaARCA(tipo, cuitRec, nomRec, condIva, caeMan);
                                        await updateDoc(doc(db, 'finanzas', m.id), { factura: nuevaFac });
                                        imprimirFacturaARCA({ ...m, factura: nuevaFac }, datosFiscalesActivos);
                                      }} className="neon-btn neon-btn-fillCyan" style={{ width: '100%' }}>
                                        ⚡ Emitir Comprobante ARCA y Abrir PDF con QR
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÓDULO 12: GESTIÓN AVANZADA DE USUARIOS Y PERMISOS + DATOS ARCA           */}
        {/* ========================================================================= */}
        {pestaña === 'configuracion' && esAdminDelNegocioActivo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* 1. CENTRO DE CONTROL DE USUARIOS, EDICIÓN Y PERMISOS POR MÓDULO */}
            <div className="neon-card">
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
                {idUsuarioEditando ? '✏️ Editando Usuario y Permisos' : `🛡️ Gestión de Usuarios, Roles y Permisos de ${nombreNegocioActivo}`}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px', marginBottom: '16px' }}>
                Puedes crear nuevos usuarios, <b>reutilizar correos que hayas eliminado antes</b> sin bloqueo, o tocar <b>✏️ Editar</b> en la tabla para agregar o quitar módulos a un usuario existente.
              </p>

              <form onSubmit={guardarUsuarioRol} style={{ background: 'var(--bg-input)', padding: '18px', borderRadius: '16px', marginBottom: '20px', border: idUsuarioEditando ? '2px solid var(--neon-cyan)' : '1px solid rgba(128,128,128,0.15)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                  <div>
                    <label className="label-neon">Nombre del Colaborador</label>
                    <input type="text" className="neon-input" placeholder="Ej: Lucas (Mostrador)" required value={nuevoUserNombre} onChange={e=>setNuevoUserNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-neon">Email de Acceso (Reutilizable)</label>
                    <input type="email" className="neon-input" placeholder="empleado@local.com" required value={nuevoUserEmail} onChange={e=>setNuevoUserEmail(e.target.value)} />
                  </div>
                  {!idUsuarioEditando && (
                    <div>
                      <label className="label-neon">Contraseña (Si es correo nuevo)</label>
                      <input type="text" className="neon-input" placeholder="Mín. 6 caract. (Opcional si ya existía)" minLength={6} value={nuevoUserPassword} onChange={e=>setNuevoUserPassword(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="label-neon">Plantilla Rápida de Rol</label>
                    <select className="neon-select" value={nuevoUserRol} onChange={e=>cambiarPresetRol(e.target.value)}>
                      <option value="recepcion_ordenes">🔧 Recepción y Gestión de Órdenes</option>
                      <option value="vendedor_admin">💼 Vendedor y Admin (POS, Stock y Finanzas)</option>
                      <option value="admin">👑 Administrador Total</option>
                      <option value="personalizado">🎛️ Permisos Personalizados a Medida</option>
                    </select>
                  </div>
                </div>

                {/* MATRIZ DE CHECKBOXES PARA AGREGAR O QUITAR MÓDULOS ESPECÍFICOS */}
                <div style={{ padding: '12px 15px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid rgba(128,128,128,0.15)', marginBottom: '15px' }}>
                  <span className="label-neon" style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>
                    🎛️ Módulos Habilitados para este Usuario (Tilda o destilda para dar o quitar acceso):
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '8px', marginTop: '8px' }}>
                    {LISTA_MODULOS_PERMISOS.map(mod => (
                      <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '14px', fontWeight: permisosSeleccionados.includes(mod.id) ? 700 : 400, color: permisosSeleccionados.includes(mod.id) ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                        <input 
                          type="checkbox" 
                          checked={permisosSeleccionados.includes(mod.id)} 
                          onChange={() => togglePermisoIndividual(mod.id)} 
                        />
                        {mod.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={creandoEmpleado} className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '13px' }}>
                    {creandoEmpleado ? 'Guardando...' : idUsuarioEditando ? '💾 Guardar Cambios de Rol y Permisos' : '➕ Habilitar Usuario / Reutilizar Correo'}
                  </button>
                  {idUsuarioEditando && (
                    <button type="button" onClick={limpiarFormularioUsuario} className="neon-btn neon-btn-red">Cancelar Edición</button>
                  )}
                </div>
              </form>

              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Rol / Módulos Activos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {misEmpleados.map(u => {
                    const estaActivo = u.activo !== false;
                    const cantModulos = Array.isArray(u.permisos) ? u.permisos.length : (PERMISOS_DEFAULT_POR_ROL[u.rol]?.length || 0);
                    return (
                      <tr key={u.id} style={{ opacity: estaActivo ? 1 : 0.55 }}>
                        <td><b>{u.nombre}</b></td>
                        <td>{u.email}</td>
                        <td>
                          <button 
                            onClick={() => updateDoc(doc(db, 'usuarios_roles', u.id), { activo: !estaActivo })}
                            className={`neon-btn ${estaActivo ? 'neon-btn-green' : 'neon-btn-red'}`}
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                          >
                            {estaActivo ? '🟢 Activo' : '🔴 Suspendido'}
                          </button>
                        </td>
                        <td>
                          <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)' }}>
                            {u.rol?.toUpperCase()} ({cantModulos} módulos)
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => cargarUsuarioParaEditar(u)} className="neon-btn">✏️ Editar Rol / Permisos</button>
                            <button onClick={() => { if(window.confirm(`¿Quitar a ${u.nombre}? Podrás volver a registrar el correo ${u.email} cuando quieras.`)) deleteDoc(doc(db, 'usuarios_roles', u.id)); }} className="neon-btn neon-btn-red">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {misEmpleados.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aún no has creado perfiles adicionales para tu local.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. CONFIGURACIÓN FISCAL ARCA PARA LOCALES ASOCIADOS */}
            {esSucursalExterna && (
              <form onSubmit={guardarFiscalesLocalGremio} className="neon-card neon-card-green">
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>🏛️ Datos Fiscales ARCA (ex AFIP) de {nombreNegocioActivo}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div><label className="label-neon">Razón Social / Titular</label><input type="text" className="neon-input" value={fiscalesLocal.razonSocial} onChange={e=>setFiscalesLocal({...fiscalesLocal, razonSocial: e.target.value})} required /></div>
                  <div><label className="label-neon">CUIT Emisor</label><input type="text" className="neon-input" value={fiscalesLocal.cuit} onChange={e=>setFiscalesLocal({...fiscalesLocal, cuit: e.target.value})} placeholder="20-XXXXXXXX-X" required /></div>
                  <div>
                    <label className="label-neon">Condición frente al IVA</label>
                    <select className="neon-select" value={fiscalesLocal.condicionIva} onChange={e=>setFiscalesLocal({...fiscalesLocal, condicionIva: e.target.value})}>
                      <option value="Responsable Monotributo">Responsable Monotributo (Emite Fac C)</option>
                      <option value="IVA Responsable Inscripto">IVA Responsable Inscripto (Emite Fac A y B)</option>
                      <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
                    </select>
                  </div>
                  <div><label className="label-neon">Punto de Venta ARCA (5 dígitos)</label><input type="text" className="neon-input" value={fiscalesLocal.puntoVentaArca} onChange={e=>setFiscalesLocal({...fiscalesLocal, puntoVentaArca: e.target.value})} placeholder="00001" required /></div>
                  <div><label className="label-neon">N° Ingresos Brutos (IIBB)</label><input type="text" className="neon-input" value={fiscalesLocal.ingresosBrutos} onChange={e=>setFiscalesLocal({...fiscalesLocal, ingresosBrutos: e.target.value})} /></div>
                  <div><label className="label-neon">Inicio de Actividades</label><input type="text" className="neon-input" value={fiscalesLocal.inicioActividades} onChange={e=>setFiscalesLocal({...fiscalesLocal, inicioActividades: e.target.value})} placeholder="01/01/2023" /></div>
                </div>
                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>💾 Guardar Mis Datos Fiscales ARCA</button>
              </form>
            )}

            {/* 3. CONFIGURACIÓN FISCAL ARCA Y PARÁMETROS PARA CENTRAL MASTER */}
            {!esSucursalExterna && (
              <form onSubmit={guardarConfiguracion} className="neon-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'var(--bg-input)', padding: '18px', borderRadius: '16px', border: '1px solid rgba(40,205,65,0.3)' }}>
                  <h3 className="glow-text-green" style={{ marginTop: 0 }}>🏛️ Configuración Fiscal y Facturación Electrónica ARCA (ex AFIP)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div><label className="label-neon">Razón Social Titular</label><input type="text" className="neon-input" value={conf.razonSocial || ''} onChange={e=>setConf({...conf, razonSocial: e.target.value})} placeholder="JOSE LUIS SENA" /></div>
                    <div><label className="label-neon">CUIT Emisor ARCA</label><input type="text" className="neon-input" value={conf.cuit || ''} onChange={e=>setConf({...conf, cuit: e.target.value})} placeholder="20-XXXXXXXX-X" /></div>
                    <div>
                      <label className="label-neon">Condición frente al IVA</label>
                      <select className="neon-select" value={conf.condicionIva || 'Responsable Monotributo'} onChange={e=>setConf({...conf, condicionIva: e.target.value})}>
                        <option value="Responsable Monotributo">Responsable Monotributo (Factura C)</option>
                        <option value="IVA Responsable Inscripto">IVA Responsable Inscripto (Factura A / B)</option>
                        <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
                      </select>
                    </div>
                    <div><label className="label-neon">Punto de Venta ARCA (Ej: 00001)</label><input type="text" className="neon-input" value={conf.puntoVentaArca || '00001'} onChange={e=>setConf({...conf, puntoVentaArca: e.target.value})} /></div>
                    <div><label className="label-neon">Ingresos Brutos (IIBB / ARBA)</label><input type="text" className="neon-input" value={conf.ingresosBrutos || ''} onChange={e=>setConf({...conf, ingresosBrutos: e.target.value})} /></div>
                    <div><label className="label-neon">Fecha Inicio Actividades</label><input type="text" className="neon-input" value={conf.inicioActividades || ''} onChange={e=>setConf({...conf, inicioActividades: e.target.value})} placeholder="01/03/2020" /></div>
                    <div>
                      <label className="label-neon">Entorno WebService ARCA (WSFEv1)</label>
                      <select className="neon-select" value={conf.modoArca || 'homologacion'} onChange={e=>setConf({...conf, modoArca: e.target.value})}>
                        <option value="homologacion">🧪 Homologación / Testing (Emisión CAE Simulado)</option>
                        <option value="produccion">🏛️ Producción (Certificado Digital WSFEv1)</option>
                        <option value="manual">✍️ Talonario / CAE Manual</option>
                      </select>
                    </div>
                    <div><label className="label-neon">Alias computador fiscal WSASS</label><input type="text" className="neon-input" value={conf.arcaAliasWsfe || ''} onChange={e=>setConf({...conf, arcaAliasWsfe: e.target.value})} /></div>
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="label-neon">Certificado Digital ARCA (.CRT PEM)</label>
                        <textarea className="neon-textarea" rows={2} placeholder="-----BEGIN CERTIFICATE----- ..." value={conf.arcaCertCrt || ''} onChange={e=>setConf({...conf, arcaCertCrt: e.target.value})} />
                      </div>
                      <div>
                        <label className="label-neon">Clave Privada ARCA (.KEY PEM)</label>
                        <textarea className="neon-textarea" rows={2} placeholder="-----BEGIN PRIVATE KEY----- ..." value={conf.arcaPrivateKey || ''} onChange={e=>setConf({...conf, arcaPrivateKey: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="glow-text-cyan" style={{ margin: 0 }}>🎨 Apariencia Visual, Tipografía y Botones (Estilo iOS 26.1)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: 'var(--bg-input)', padding: '16px', borderRadius: '16px' }}>
                  <div>
                    <label className="label-neon">Seleccionar Tema de la Aplicación</label>
                    <select className="neon-select" value={conf.temaVisual || 'claro'} onChange={e=>setConf({...conf, temaVisual: e.target.value})}>
                      <option value="claro">☀️ Clásico Claro (Estilo iOS 26.1 Suave)</option>
                      <option value="oscuro">🌙 Clásico Oscuro (Grafito Descansado)</option>
                      <option value="sistema">🖥️ Automático (Tomar Configuración del Sistema)</option>
                      <option value="neon">⚡ Cyberpunk Neón (Tema Original)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-neon">Tamaño de Letra General</label>
                    <select className="neon-select" value={conf.tamanoFuenteBase || 17} onChange={e=>setConf({...conf, tamanoFuenteBase: Number(e.target.value)})}>
                      <option value={15}>Normal (15px)</option>
                      <option value={17}>Grande y Cómodo (17px - Recomendado)</option>
                      <option value={19}>Extra Grande (19px - Máxima Lectura)</option>
                    </select>
                  </div>
                </div>

                <h3 className="glow-text-cyan" style={{ margin: 0 }}>⚙️ Parámetros Comerciales, Precios de Lista y Laboratorio</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div><label className="label-neon">Nombre Fantasía</label><input type="text" className="neon-input" value={conf.empresaNombre} onChange={e=>setConf({...conf, empresaNombre: e.target.value})} /></div>
                  <div><label className="label-neon">Dirección Comercial</label><input type="text" className="neon-input" value={conf.direccion} onChange={e=>setConf({...conf, direccion: e.target.value})} /></div>
                  <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={conf.whatsapp} onChange={e=>setConf({...conf, whatsapp: e.target.value})} /></div>
                  <div><label className="label-neon">Dólar Ref ($)</label><input type="number" className="neon-input" value={conf.cotizacionDolar} onChange={e=>setConf({...conf, cotizacionDolar: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Markup sobre Costo (% Precio Lista)</label><input type="number" className="neon-input" value={conf.margenGanancia} onChange={e=>setConf({...conf, margenGanancia: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Descuento Efectivo sobre Lista (%)</label><input type="number" className="neon-input" value={conf.descuentoEfectivoPorcentaje} onChange={e=>setConf({...conf, descuentoEfectivoPorcentaje: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Recargo Tarjeta sobre Lista (%)</label><input type="number" className="neon-input" value={conf.recargoTarjetaPorcentaje} onChange={e=>setConf({...conf, recargoTarjetaPorcentaje: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Alias / CBU</label><input type="text" className="neon-input" value={conf.aliasTransferencia} onChange={e=>setConf({...conf, aliasTransferencia: e.target.value})} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Sectores de Laboratorio</label><input type="text" className="neon-input" value={conf.sectoresTaller} onChange={e=>setConf({...conf, sectoresTaller: e.target.value})} /></div>
                </div>
                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '15px' }}>💾 Guardar Configuración Fiscal ARCA, Tema y Parámetros</button>
              </form>
            )}

          </div>
        )}

      </main>
    </div>
  );
};

// ========================================================
// 5. ENRUTADOR PRINCIPAL
// ========================================================
const RutaProtegida = ({ children, user }: { children: React.ReactNode, user: User | null }) => user ? children : <Navigate to="/admin-login" />;

export default function App() {
  const [user, setUser] = useState<User | null>(null); 
  const [cargando, setCargando] = useState(true);
  const [temaActivo, setTemaActivo] = useState<string>('claro');
  const [fontSizeActivo, setFontSizeActivo] = useState<number>(17);
  const [talleres, setTalleres] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => { 
    const u = onAuthStateChanged(auth, u => { setUser(u); setCargando(false); }); 
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.temaVisual) setTemaActivo(d.temaVisual);
        if (d.tamanoFuenteBase) setFontSizeActivo(Number(d.tamanoFuenteBase));
      }
    });
    const unsubT = onSnapshot(query(collection(db, 'talleres_gremio')), s => setTalleres(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubR = onSnapshot(query(collection(db, 'usuarios_roles')), s => setRoles(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u(); unsubConf(); unsubT(); unsubR(); }; 
  }, []);

  const miLocalDueño = talleres.find(t => t.email?.toLowerCase() === user?.email?.toLowerCase());
  const miRolEmpleado = roles.find(r => r.email?.toLowerCase() === user?.email?.toLowerCase());
  const idTiendaDeEsteUsuario = miLocalDueño ? miLocalDueño.id : (miRolEmpleado?.tenantId && miRolEmpleado.tenantId !== 'MASTER' ? miRolEmpleado.tenantId : null);

  const cambiarTemaRapido = async (nuevoTema: string) => {
    setTemaActivo(nuevoTema);
    if (user && !idTiendaDeEsteUsuario) {
      await setDoc(doc(db, 'configuracion', 'general'), { temaVisual: nuevoTema }, { merge: true });
    }
  };

  if (cargando) return <div style={{ padding: '50px', textAlign: 'center', fontWeight: 'bold' }}>Iniciando Sistema...</div>;

  return (
    <BrowserRouter>
      <style>{getEstilosTema(temaActivo, fontSizeActivo)}</style>
      <nav className="top-nav-bar">
        <Link 
          to={idTiendaDeEsteUsuario ? `/?tienda=${idTiendaDeEsteUsuario}` : "/"} 
          className="glow-text-cyan" 
          style={{ textDecoration: 'none', fontWeight: 800, fontSize: '16px' }}
        >
          🛍️ {idTiendaDeEsteUsuario ? 'Mi Tienda Online' : 'Tienda Oficial'}
        </Link>
        <Link to="/seguimiento" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}>🔍 Rastrear Equipo</Link>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select 
            className="neon-select" 
            value={temaActivo} 
            onChange={e => cambiarTemaRapido(e.target.value)} 
            style={{ width: 'auto', padding: '7px 14px', borderRadius: '9999px', fontSize: '13px' }}
            title="Cambiar Tema Visual"
          >
            <option value="claro">☀️ Clásico Claro</option>
            <option value="oscuro">🌙 Clásico Oscuro</option>
            <option value="sistema">🖥️ Sistema Auto</option>
            <option value="neon">⚡ Tema Neón</option>
          </select>

          {!user ? (
            <Link to="/admin-login" className="neon-btn" style={{ textDecoration: 'none' }}>🔐 Acceso Sistema</Link>
          ) : (
            <Link to="/admin-panel" className="neon-btn neon-btn-fillCyan" style={{ textDecoration: 'none' }}>⚙️ Mi Panel</Link>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<TiendaPublica user={user} />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/admin-login" element={user ? <Navigate to="/admin-panel" /> : <LoginAdmin />} />
        <Route path="/admin-panel" element={<RutaProtegida user={user}><DashboardTaller user={user!} /></RutaProtegida>} />
      </Routes>
    </BrowserRouter>
  );
}
// --- FIN DEL ARCHIVO APP.TSX ---