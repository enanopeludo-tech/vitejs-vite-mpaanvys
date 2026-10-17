import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, doc, updateDoc, deleteDoc, arrayUnion, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase'; 

// --- Configuración por defecto ---
const CONFIG_DEFAULT = {
  whatsapp: "5492262619735",
  empresaNombre: "WALABBA TECNO",
  logoUrl: "",
  ticketEncabezado: "Av. 42 3998\nWhatsApp: 2262619735",
  ticketLeyenda: "Use el código en nuestra web para seguir su reparación. Pasados los 90 días no nos responsabilizamos por el equipo.",
  margenGanancia: 30,
  compraMinima: 0,
  envioLocalCosto: 0,
  aliasTransferencia: "walabba.tecno.mp",
  linkMercadoPago: ""
};

// ========================================================
// 1. E-COMMERCE B2B
// ========================================================
const TiendaPublica = ({ user }: { user: User | null }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [productos, setProductos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  const [modoCheckout, setModoCheckout] = useState(false);
  const [pedidoRealizado, setPedidoRealizado] = useState<any | null>(null);
  const [formCheckout, setFormCheckout] = useState({ nombre: '', telefono: '', metodoEnvio: 'retiro', direccion: '', notas: '' });
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => {
      if (docSnap.exists()) setConfig({ ...CONFIG_DEFAULT, ...docSnap.data() });
    });
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ idBaseDatos: doc.id, ...doc.data() })));
      setCargando(false);
    });
    return () => { unsubConfig(); unsubProd(); };
  }, []);

  const categorias = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria || 'Otros')))];
  
  const productosFiltrados = productos
    .filter(p => 
      (categoriaActiva === 'Todas' || p.categoria === categoriaActiva) &&
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
       (p.codigoBarras && p.codigoBarras.includes(busqueda)))
    )
    .sort((a, b) => {
      const aDestacado = a.destacado && a.stock > 0 ? 1 : 0;
      const bDestacado = b.destacado && b.stock > 0 ? 1 : 0;
      return bDestacado - aDestacado;
    });

  const agregarAlCarrito = (producto: any) => {
    const item = carrito.find(i => i.idBaseDatos === producto.idBaseDatos);
    if (item && item.cantidad < producto.stock) {
      setCarrito(carrito.map(i => i.idBaseDatos === producto.idBaseDatos ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else if (!item && producto.stock > 0) {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    } else {
      alert('Stock máximo alcanzado.');
    }
  };

  const totalCarrito = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
  const costoEnvioActual = formCheckout.metodoEnvio === 'domicilio' ? Number(config.envioLocalCosto) : 0;
  const totalFinal = totalCarrito + costoEnvioActual;

  const confirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCarrito < config.compraMinima) return alert(`El mínimo de compra es $${config.compraMinima}`);
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'pedidos_ecommerce'), {
        cliente: formCheckout, items: carrito, subtotal: totalCarrito, costoEnvio: costoEnvioActual, total: totalFinal,
        estadoPago: 'pendiente', estadoEnvio: 'preparacion', fecha: serverTimestamp(),
      });
      for (const item of carrito) {
        const prodActual = productos.find(p => p.idBaseDatos === item.idBaseDatos);
        if(prodActual) {
          await updateDoc(doc(db, 'productos', item.idBaseDatos), { stock: Math.max(0, prodActual.stock - item.cantidad), ventas: (prodActual.ventas || 0) + item.cantidad });
        }
      }
      setPedidoRealizado({ id: docRef.id, total: totalFinal });
      setCarrito([]); setModoCheckout(false);
    } catch (error) { alert('Error al procesar.'); } finally { setProcesando(false); }
  };

  const enviarComprobanteWhatsApp = () => {
    const msg = `Hola ${config.empresaNombre}! Acabo de realizar el pedido B2B #${pedidoRealizado.id.slice(-6).toUpperCase()}.\nEl total es $${pedidoRealizado.total}. Te envío este mensaje para coordinar el pago/entrega.`;
    window.open(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (cargando) return <div style={{ textAlign: 'center', padding: '50px' }}>Cargando catálogo...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          {config.logoUrl && <img src={config.logoUrl} alt="Logo" style={{ height: '50px', borderRadius: '8px' }} />}
          <h2 style={{ margin: 0 }}>Catálogo B2B {config.empresaNombre}</h2>
        </div>

        {!user && <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '15px', color: '#856404' }}>🔒 Inicia sesión como Taller Asociado para ver precios y comprar.</div>}
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input type="text" placeholder="Buscar por nombre o código..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '10px', flex: 1, borderRadius: '5px', border: '1px solid #ccc' }} />
          <select value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
          {productosFiltrados.map(prod => (
            <div key={prod.idBaseDatos} style={{ border: prod.destacado && prod.stock > 0 ? '2px solid #ffc107' : '1px solid #ddd', borderRadius: '8px', padding: '15px', background: 'white', position: 'relative', opacity: prod.stock === 0 ? 0.6 : 1 }}>
              {prod.destacado && prod.stock > 0 && <div style={{ position: 'absolute', top: '-10px', left: '-10px', background: '#ffc107', color: 'black', padding: '5px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>🔥 OFERTA DESTACADA</div>}
              <div style={{ height: '150px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', marginTop: prod.destacado && prod.stock > 0 ? '10px' : '0' }}>
                {prod.imagenUrl ? <img src={prod.imagenUrl} style={{ maxHeight: '100%', maxWidth: '100%' }} alt="prod" /> : '📷'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', background: '#eee', padding: '3px 6px', borderRadius: '4px' }}>{prod.categoria || 'Otros'}</span>
                {prod.codigoBarras && <span style={{ fontSize: '10px', color: '#888' }}>||| {prod.codigoBarras}</span>}
              </div>
              <h4 style={{ margin: '10px 0 5px 0' }}>{prod.nombre}</h4>
              <p style={{ fontSize: '12px', color: '#666', height: '40px', overflow: 'hidden' }}>{prod.descripcion}</p>
              <div style={{ minHeight: '20px', margin: '5px 0' }}>
                {prod.stock === 0 && <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '12px' }}>❌ AGOTADO</span>}
                {prod.stock > 0 && prod.stock <= 3 && <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '12px', animation: 'pulse 1s infinite' }}>⚠️ Solo quedan {prod.stock}</span>}
              </div>

              {user ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <b style={{ fontSize: '18px' }}>${prod.precio}</b>
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={() => { agregarAlCarrito(prod); setPedidoRealizado(null); }} disabled={prod.stock <= 0} style={{ background: prod.stock > 0 ? '#0d6efd' : '#ccc', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: prod.stock > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                      {prod.stock > 0 ? 'Sumar' : 'Sin Stock'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '10px' }}>Precio oculto</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {user && (carrito.length > 0 || pedidoRealizado) && (
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          {pedidoRealizado ? (
            <div style={{ background: '#d4edda', padding: '20px', borderRadius: '8px', border: '2px solid #28a745', position: 'sticky', top: '20px' }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#155724' }}>✅ ¡Pedido Confirmado!</h2>
              <p style={{ margin: '0 0 20px 0', color: '#155724', fontSize: '14px' }}>Nº de Orden: <b>#{pedidoRealizado.id.slice(-6).toUpperCase()}</b></p>
              <div style={{ background: 'white', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Total a abonar: <span style={{ fontSize: '24px', color: '#28a745' }}>${pedidoRealizado.total}</span></h4>
                <hr style={{ margin: '10px 0', borderColor: '#eee' }}/>
                <h4 style={{ margin: '0 0 10px 0' }}>Métodos de Pago:</h4>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}><b>Transferencia (Alias/CBU):</b><br/>{config.aliasTransferencia || 'No configurado'}</p>
                {config.linkMercadoPago && (
                  <a href={config.linkMercadoPago} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '10px', background: '#009ee3', color: 'white', padding: '10px 15px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>💳 Pagar con Mercado Pago</a>
                )}
              </div>
              <button onClick={enviarComprobanteWhatsApp} style={{ width: '100%', padding: '12px', background: '#25D366', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Notificar Pago por WhatsApp</button>
              <button onClick={() => setPedidoRealizado(null)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#155724', border: 'none', marginTop: '10px', cursor: 'pointer', textDecoration: 'underline' }}>Volver al catálogo</button>
            </div>
          ) : modoCheckout ? (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '2px solid #0d6efd', position: 'sticky', top: '20px' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#0d6efd' }}>📝 Completar Pedido</h3>
              <form onSubmit={confirmarPedido} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nombre Completo / Local</label><input type="text" required value={formCheckout.nombre} onChange={e=>setFormCheckout({...formCheckout, nombre: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Teléfono de Contacto</label><input type="text" required value={formCheckout.telefono} onChange={e=>setFormCheckout({...formCheckout, telefono: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Método de Entrega</label>
                  <select value={formCheckout.metodoEnvio} onChange={e=>setFormCheckout({...formCheckout, metodoEnvio: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', marginTop: '5px' }}>
                    <option value="retiro">Retiro en Local (Gratis)</option>
                    <option value="domicilio">Envío a Domicilio (${config.envioLocalCosto})</option>
                  </select>
                </div>
                {formCheckout.metodoEnvio === 'domicilio' && (
                  <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Dirección Completa</label><input type="text" required value={formCheckout.direccion} onChange={e=>setFormCheckout({...formCheckout, direccion: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
                )}
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Notas adicionales</label><textarea value={formCheckout.notas} onChange={e=>setFormCheckout({...formCheckout, notas: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}><span>Subtotal:</span><span>${totalCarrito}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '5px 0' }}><span>Envío:</span><span>${costoEnvioActual}</span></div>
                  <hr style={{ margin: '10px 0', borderColor: '#ddd' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}><span>Total a Pagar:</span><span style={{ color: '#0d6efd' }}>${totalFinal}</span></div>
                </div>
                <button type="submit" disabled={procesando} style={{ width: '100%', padding: '15px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: procesando ? 'not-allowed' : 'pointer' }}>{procesando ? 'Procesando...' : 'Confirmar Pedido y Ver Pago'}</button>
                <button type="button" onClick={() => setModoCheckout(false)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Volver al Carrito</button>
              </form>
            </div>
          ) : (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '2px solid #333', position: 'sticky', top: '20px' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>🛒 Carrito Mayorista</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {carrito.map(item => (
                  <div key={item.idBaseDatos} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                    <div><b style={{ fontSize: '14px' }}>{item.cantidad}x {item.nombre}</b><br/><span style={{ fontSize: '12px', color: '#666' }}>${item.precio} c/u</span></div>
                    <button onClick={() => setCarrito(carrito.filter(i => i.idBaseDatos !== item.idBaseDatos))} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                  </div>
                ))}
              </div>
              <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><span>Subtotal:</span><h3 style={{ margin: 0, color: '#28a745' }}>${totalCarrito}</h3></div>
              {config.compraMinima > 0 && totalCarrito < config.compraMinima && <p style={{ color: '#dc3545', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>Faltan ${config.compraMinima - totalCarrito} para el mínimo.</p>}
              <button onClick={() => setModoCheckout(true)} disabled={totalCarrito < config.compraMinima} style={{ width: '100%', padding: '15px', background: totalCarrito >= config.compraMinima ? '#333' : '#ccc', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: totalCarrito >= config.compraMinima ? 'pointer' : 'not-allowed' }}>Iniciar Pago Seguro ➔</button>
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

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query(collection(db, 'ordenes_taller'), where('codigoSeguimiento', '==', codigo.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) alert('No encontrado'); else setResultado(snap.docs[0].data());
  };

  const getEstiloEstado = (estado: string) => {
    const e = estado.toLowerCase();
    if (e === 'ingresado') return { color: '#856404', bg: '#ffeeba', icon: '📥', label: 'Ingresado al Taller' };
    if (e === 'en revision') return { color: '#004085', bg: '#cce5ff', icon: '🔬', label: 'En Revisión Técnica' };
    if (e === 'esperando repuesto') return { color: '#856404', bg: '#fff3cd', icon: '⏳', label: 'Esperando Repuesto' };
    if (e === 'reparado') return { color: '#155724', bg: '#d4edda', icon: '✅', label: '¡Reparado y Listo!' };
    if (e === 'reingreso garantia') return { color: '#6f42c1', bg: '#e2d9f3', icon: '🔄', label: 'Reingreso por Garantía' };
    if (e === 'sin solucion') return { color: '#721c24', bg: '#f8d7da', icon: '❌', label: 'Sin Solución / Cancelado' };
    if (e === 'entregado') return { color: '#383d41', bg: '#e2e3e5', icon: '📦', label: 'Equipo Entregado' };
    return { color: '#333', bg: '#f8f9fa', icon: '📌', label: estado };
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>Rastrear Equipo</h2>
      <form onSubmit={buscar} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <input type="text" placeholder="Código (Ej: X9B2V)" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ padding: '10px', textTransform: 'uppercase', width: '200px', textAlign: 'center', fontSize: '18px', border: '2px solid #ccc', borderRadius: '4px' }} maxLength={6}/>
        <button type="submit" style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>Buscar</button>
      </form>

      {resultado && (
        <div style={{ marginTop: '30px', background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>{resultado.equipo.marca} {resultado.equipo.modelo}</h3>
            <span style={{ background: '#eee', padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Orden: {resultado.codigoSeguimiento}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', marginBottom: '20px' }}>
            <div><p style={{ margin: 0, color: '#666', fontSize: '12px' }}>FALLA REPORTADA</p><p style={{ margin: 0, fontWeight: 'bold' }}>{resultado.fallaDeclarada}</p></div>
            <div><p style={{ margin: 0, color: '#666', fontSize: '12px' }}>CONDICIÓN INICIAL</p><p style={{ margin: 0, fontWeight: 'bold' }}>{resultado.equipo.condicionVisual || 'No especificada'}</p></div>
          </div>

          <div style={{ background: getEstiloEstado(resultado.estado).bg, padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', border: `1px solid ${getEstiloEstado(resultado.estado).color}` }}>
            <p style={{ margin: 0, fontSize: '12px', color: getEstiloEstado(resultado.estado).color, fontWeight: 'bold' }}>ESTADO ACTUAL</p>
            <h2 style={{ margin: '5px 0 0 0', color: getEstiloEstado(resultado.estado).color }}>{getEstiloEstado(resultado.estado).icon} {getEstiloEstado(resultado.estado).label}</h2>
            {resultado.costoReparacion && <h3 style={{ margin: '10px 0 0 0', color: '#155724' }}>Costo Final: ${resultado.costoReparacion}</h3>}
          </div>

          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Historial de seguimiento:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '2px solid #0d6efd', paddingLeft: '15px', marginLeft: '5px' }}>
            {resultado.historial?.map((evento: any, i: number) => (
              <div key={i} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#0d6efd', border: '2px solid white' }}></div>
                <b style={{ textTransform: 'uppercase', fontSize: '13px', color: '#0d6efd' }}>{evento.estado}</b>
                <p style={{ margin: '2px 0', fontSize: '13px', color: '#333', fontWeight: 'bold' }}>{evento.comentario}</p>
                <p style={{ margin: '0', fontSize: '11px', color: '#888' }}>{evento.fecha}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 3. LOGIN
// ========================================================
const LoginAdmin = () => {
  const [e, setE] = useState(''); const [p, setP] = useState('');
  const navigate = useNavigate();
  return (
    <div style={{ padding: '40px', maxWidth: '300px', margin: '0 auto', textAlign: 'center' }}>
      <h2>Acceso Taller</h2>
      <form onSubmit={async (ev) => { ev.preventDefault(); try { await signInWithEmailAndPassword(auth, e, p); navigate('/admin-panel'); } catch (err) { alert('Error de login'); } }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="email" placeholder="Email" value={e} onChange={ex => setE(ex.target.value)} style={{ padding: '10px' }} required/>
        <input type="password" placeholder="Clave" value={p} onChange={ex => setP(ex.target.value)} style={{ padding: '10px' }} required/>
        <button type="submit" style={{ padding: '10px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Entrar</button>
      </form>
    </div>
  );
};

// ========================================================
// 4. PANEL ERP AVANZADO (Facturación y Despliegue)
// ========================================================
const DashboardTaller = ({ user }: { user: User }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidosWeb, setPedidosWeb] = useState<any[]>([]); 
  const [movimientosFinanzas, setMovimientosFinanzas] = useState<any[]>([]); 
  const [pestaña, setPestaña] = useState('finanzas'); 

  // CRM Taller
  const [cliNombre, setCliNombre] = useState(''); const [cliTel, setCliTel] = useState('');
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [tecnico, setTecnico] = useState('');
  const [imei, setImei] = useState(''); const [contrasena, setContrasena] = useState('');
  const [condicionVisual, setCondicionVisual] = useState('');
  
  // Catálogo e Inventario
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [prodNom, setProdNom] = useState(''); const [prodCat, setProdCat] = useState('');
  const [prodCosto, setProdCosto] = useState(''); 
  const [prodPrecio, setProdPrecio] = useState(''); const [prodStock, setProdStock] = useState('');
  const [prodDesc, setProdDesc] = useState(''); const [prodImg, setProdImg] = useState('');
  const [prodCodigoBarras, setProdCodigoBarras] = useState('');
  const [prodProveedor, setProdProveedor] = useState('');
  const [prodDestacado, setProdDestacado] = useState(false);
  const [prodUrlProveedor, setProdUrlProveedor] = useState(''); 
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [escaneandoPara, setEscaneandoPara] = useState<'formulario' | 'buscador' | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // Módulo Proveedores / Excel
  const [excelCargando, setExcelCargando] = useState(false);
  const [excelHojas, setExcelHojas] = useState<string[]>([]);
  const [hojaActiva, setHojaActiva] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [colNombre, setColNombre] = useState<number>(0);
  const [colCosto, setColCosto] = useState<number>(1);
  const [colMarca, setColMarca] = useState<number>(-1);
  const [nombreProveedorExcel, setNombreProveedorExcel] = useState(''); 

  // Finanzas
  const [finTipo, setFinTipo] = useState('ingreso'); const [finConcepto, setFinConcepto] = useState('');
  const [finMonto, setFinMonto] = useState(''); const [finMetodo, setFinMetodo] = useState('efectivo');
  const [filtroTiempo, setFiltroTiempo] = useState('todos'); const [filtroTipoLista, setFiltroTipoLista] = useState('todos'); const [filtroMetodoLista, setFiltroMetodoLista] = useState('todos');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [facturaEdit, setFacturaEdit] = useState<any>({});
  const [conf, setConf] = useState(CONFIG_DEFAULT);

  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement('script'); script.src = "https://unpkg.com/xlsx/dist/xlsx.full.min.js"; script.async = true; document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); setConfig({ ...CONFIG_DEFAULT, ...data }); setConf({ ...CONFIG_DEFAULT, ...data }); } });
    const unsubOrd = onSnapshot(query(collection(db, 'ordenes_taller'), where('idTiendaOrigen', '==', user.uid)), (snap) => setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fechaIngreso?.seconds - a.fechaIngreso?.seconds)));
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snap) => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPedidos = onSnapshot(query(collection(db, 'pedidos_ecommerce')), (snap) => setPedidosWeb(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    const unsubFinanzas = onSnapshot(query(collection(db, 'finanzas')), (snap) => setMovimientosFinanzas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    return () => { unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); unsubFinanzas(); };
  }, [user.uid]);

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

  const parsePrecio = (valor: any) => {
    if (valor === undefined || valor === null || valor === '') return NaN;
    if (typeof valor === 'number') return valor;
    let str = valor.toString().replace(/[^0-9.,-]/g, '');
    if (str.includes(',') && str.includes('.')) {
       if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
       else str = str.replace(/,/g, '');
    } else if (str.includes(',')) {
       str = str.replace(',', '.');
    }
    return parseFloat(str);
  };

  const procesarArchivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(window as any).XLSX) return alert('Librería Excel cargando, intenta en unos segundos...');
    setExcelCargando(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        setExcelHojas(wb.SheetNames);
        if (wb.SheetNames.length > 0) seleccionarHojaExcel(wb, wb.SheetNames[0]);
        (window as any).__currentWorkbook = wb;
      } catch (error) { alert('Error al leer el archivo Excel.'); } finally { setExcelCargando(false); }
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
    if (excelData.length === 0) return alert('No hay datos para importar.');
    if (!nombreProveedorExcel) return alert('Por favor, ingresa el nombre del proveedor para registrar de dónde viene esta lista.');
    if (!window.confirm(`¿Importar/Actualizar filas desde la hoja "${hojaActiva}"?\nLos artículos existentes solo actualizarán su costo y precio bajo el proveedor "${nombreProveedorExcel}".`)) return;
    
    let agregados = 0; let actualizados = 0; let omitidos = 0; let marcaActual = 'General';
    const fechaActualizacion = new Date().toLocaleDateString();

    setExcelCargando(true);
    try {
      let batch = writeBatch(db);
      let operacionActual = 0;

      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        if (!row || row.length === 0) continue;
        
        const nombreObtenido = row[colNombre]?.toString().trim();
        const costoObtenido = parsePrecio(row[colCosto]);
        const marcaDetectada = colMarca >= 0 ? row[colMarca]?.toString().trim() : null;

        if (marcaDetectada && isNaN(costoObtenido)) { marcaActual = marcaDetectada; continue; }

        if (nombreObtenido && !isNaN(costoObtenido) && costoObtenido > 0) {
          const precioFinal = costoObtenido + (costoObtenido * (Number(config.margenGanancia) / 100));
          const nombreFinal = colMarca === -1 ? nombreObtenido : `${marcaActual} - ${nombreObtenido}`;
          
          const productoExistente = productos.find(p => p.nombre.toLowerCase() === nombreFinal.toLowerCase());

          if (productoExistente) {
            const docRef = doc(db, 'productos', productoExistente.id);
            batch.update(docRef, { costoProveedor: costoObtenido, precio: Math.round(precioFinal), proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
            actualizados++;
          } else {
            const nuevoDocRef = doc(collection(db, 'productos'));
            batch.set(nuevoDocRef, { nombre: nombreFinal, categoria: hojaActiva, costoProveedor: costoObtenido, precio: Math.round(precioFinal), stock: 0, descripcion: 'Importado de lista', fecha: serverTimestamp(), ventas: 0, proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
            agregados++;
          }
          
          operacionActual++;
          if (operacionActual >= 400) { await batch.commit(); batch = writeBatch(db); operacionActual = 0; }
        } else {
          omitidos++;
        }
      }
      
      if (operacionActual > 0) await batch.commit(); 
      alert(`¡Proceso Completado!\n\nNuevos Agregados: ${agregados}\nPrecios Actualizados: ${actualizados}\nOmitidos (Vacíos o sin precio): ${omitidos}`);
    } catch (error: any) { alert(`Error en Base de Datos: ${error.message}`); } finally {
      setExcelCargando(false); setExcelData([]); 
      const fileInput = document.getElementById('fileExcel') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
    }
  };

  const generarRecomendaciones = (fallaStr: string) => {
    const f = fallaStr.toLowerCase();
    if (f.includes('bateria') || f.includes('carga') || f.includes('pin')) return "\n\n💡 *Recomendación del Técnico:* Para maximizar la vida útil, sugerimos acompañar esta reparación con un *Cable USB nuevo* o *Limpieza de puerto*. ¡Consultanos!";
    if (f.includes('pantalla') || f.includes('modulo') || f.includes('vidrio')) return "\n\n💡 *Recomendación del Técnico:* ¡Protegé tu inversión! Sugerimos agregar una *Funda Anti-impacto* o *Hidrogel* al retirar tu equipo. Tenemos stock.";
    return "\n\n💡 *Recomendación del Técnico:* Recordá consultar por nuestros accesorios en promoción al retirar tu equipo.";
  };

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid, cliente: { nombre: cliNombre, telefono: cliTel }, equipo: { marca, modelo, imei, contrasena, condicionVisual }, fallaDeclarada: falla, tecnicoAsignado: tecnico,
      estado: 'ingresado', codigoSeguimiento: cod, fechaIngreso: serverTimestamp(), historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: 'Equipo recibido en mostrador.' }]
    });
    setCliNombre(''); setCliTel(''); setMarca(''); setModelo(''); setFalla(''); setTecnico(''); setImei(''); setContrasena(''); setCondicionVisual(''); alert(`Generado. Código: ${cod}`);
  };

  const actualizarEstado = async (id: string, nuevoEstado: string) => {
    const comentario = prompt(`Comentario/Diagnóstico para el estado '${nuevoEstado}':`) || 'Actualización de estado.';
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };
    if (nuevoEstado === 'reparado') { const costo = prompt('Ingresa el Costo Final de la reparación:'); if(costo) data.costoReparacion = costo; }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const notificarClienteWhatsApp = (orden: any) => {
    const urlBase = window.location.origin;
    let msg = `Hola ${orden.cliente.nombre}, somos *${config.empresaNombre}*.\nTe escribimos para avisarte sobre tu *${orden.equipo.marca} ${orden.equipo.modelo}*.\n\n🔧 *Estado actualizado:* ${orden.estado.toUpperCase()}\n`;
    if (orden.historial && orden.historial.length > 0) msg += `📝 *Detalle:* ${orden.historial[orden.historial.length - 1].comentario}\n`;
    if (orden.costoReparacion) msg += `💰 *Costo Total:* $${orden.costoReparacion}\n`;
    msg += `\n🔍 Seguí el estado en tiempo real ingresando el código *${orden.codigoSeguimiento}* en nuestra web: ${urlBase}/seguimiento`;
    msg += generarRecomendaciones(orden.fallaDeclarada);
    window.open(`https://wa.me/549${orden.cliente.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirTicket = (orden: any) => {
    const v = window.open('', '_blank');
    if(!v) return;
    const logoHtml = config.logoUrl ? `<img src="${config.logoUrl}" style="max-height:60px; margin-bottom:10px;"/>` : '';
    v.document.write(`
      <div style="font-family: monospace; width: 300px; padding: 20px; border: 1px dashed #000; text-align: center;">
        ${logoHtml}<h2 style="margin:0;">${config.empresaNombre}</h2>
        <p style="margin:5px 0; font-size: 12px;">${config.ticketEncabezado.replace(/\n/g, '<br/>')}</p>
        <p style="margin:10px 0; border-top: 1px solid #000; padding-top: 5px;">${new Date().toLocaleDateString()}</p>
        <div style="text-align: left;"><p style="margin:2px 0;"><b>Cliente:</b> ${orden.cliente?.nombre}</p><p style="margin:2px 0;"><b>Tel:</b> ${orden.cliente?.telefono}</p><hr/><p style="margin:2px 0;"><b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</p>
        ${orden.equipo?.imei ? `<p style="margin:2px 0; font-size:11px;"><b>IMEI:</b> ${orden.equipo.imei}</p>` : ''}${orden.equipo?.contrasena ? `<p style="margin:2px 0; font-size:11px;"><b>Clave/Patrón:</b> ${orden.equipo.contrasena}</p>` : ''}<p style="margin:2px 0; font-size:11px;"><b>Condición:</b> ${orden.equipo?.condicionVisual || 'No especificada'}</p><hr/><p style="margin:2px 0;"><b>Falla:</b> ${orden.fallaDeclarada}</p></div>
        <hr/><h1 style="letter-spacing: 3px; font-size: 28px; margin: 10px 0;">${orden.codigoSeguimiento}</h1><p style="font-size:10px; text-align: justify; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px;">${config.ticketLeyenda}</p>
      </div>
    `);
    v.document.close(); setTimeout(() => v.print(), 500);
  };

  const limpiarFormularioProducto = () => {
    setIdEditando(null); setProdNom(''); setProdCat(''); setProdPrecio(''); setProdCosto(''); setProdStock(''); setProdDesc(''); setProdImg(''); setProdCodigoBarras(''); setProdProveedor(''); setProdDestacado(false); setProdUrlProveedor('');
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const fechaActualizacion = new Date().toLocaleDateString();
    const dataProducto = { nombre: prodNom, categoria: prodCat, precio: Number(prodPrecio), costoProveedor: Number(prodCosto) || 0, stock: Number(prodStock), descripcion: prodDesc, imagenUrl: prodImg, urlProveedor: prodUrlProveedor, proveedor: prodProveedor, ultimaActualizacion: fechaActualizacion, codigoBarras: prodCodigoBarras, destacado: prodDestacado };
    if (idEditando) await updateDoc(doc(db, 'productos', idEditando), dataProducto);
    else await addDoc(collection(db, 'productos'), { ...dataProducto, ventas: 0, fecha: serverTimestamp() });
    limpiarFormularioProducto();
  };

  const calcularPrecioVenta = () => { if (prodCosto) setProdPrecio((Number(prodCosto) + (Number(prodCosto) * (Number(config.margenGanancia) / 100))).toFixed(0)); };
  const actualizarStock = async (id: string, nuevoStock: number) => { if (nuevoStock >= 0) await updateDoc(doc(db, 'productos', id), { stock: nuevoStock }); };
  
  const registrarVentaDirecta = async (p: any) => { 
    if (p.stock <= 0) return alert('Sin stock disponible');
    await updateDoc(doc(db, 'productos', p.id), { stock: p.stock - 1, ventas: (p.ventas || 0) + 1 }); 
    
    // Novedad: Guardar el ítem en la venta directa
    await addDoc(collection(db, 'finanzas'), { 
      tipo: 'ingreso', 
      concepto: `Venta Mostrador: ${p.nombre}`, 
      monto: Number(p.precio), 
      metodoPago: 'efectivo', 
      fecha: serverTimestamp(), 
      usuario: user.email,
      items: [{ nombre: p.nombre, cantidad: 1, precio: p.precio }]
    });
    alert('Venta realizada y cobro registrado en caja (Efectivo).');
  };

  const cargarProductoParaEdicion = (p: any) => {
    setIdEditando(p.id); setProdNom(p.nombre); setProdCat(p.categoria || ''); setProdPrecio(p.precio?.toString() || ''); setProdCosto(p.costoProveedor?.toString() || ''); setProdStock(p.stock?.toString() || ''); setProdDesc(p.descripcion || ''); setProdImg(p.imagenUrl || ''); setProdCodigoBarras(p.codigoBarras || ''); setProdProveedor(p.proveedor || ''); setProdDestacado(p.destacado || false); setProdUrlProveedor(p.urlProveedor || ''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const pedirFaltantes = () => {
    const faltantes = productos.filter(p => p.stock <= 3);
    if (faltantes.length === 0) return alert('No hay artículos con stock crítico.');
    let msg = `Hola! Necesito reponer para ${config.empresaNombre}:\n\n`; faltantes.forEach(p => { msg += `▪️ ${p.stock === 0 ? 5 : 3}x ${p.nombre} ${p.urlProveedor ? `(Ref: ${p.urlProveedor})` : ''}\n`; }); window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const inventarioFiltrado = productos.filter(p => p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()) || (p.codigoBarras && p.codigoBarras.includes(busquedaInventario)));

  const toggleSeleccion = (id: string) => { setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  const toggleTodos = () => {
    if (seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0) setSeleccionados([]); 
    else setSeleccionados(inventarioFiltrado.map(p => p.id)); 
  };

  const eliminarSeleccionados = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar PERMANENTEMENTE los ${seleccionados.length} productos seleccionados?`)) return;
    try {
      const batch = writeBatch(db); seleccionados.forEach(id => { batch.delete(doc(db, 'productos', id)); });
      await batch.commit(); setSeleccionados([]); alert('Productos eliminados correctamente.');
    } catch (error) { alert('Error al eliminar productos masivamente.'); }
  };

  const aplicarMargenMasivo = async () => {
    if (!window.confirm(`¿Recalcular el precio de venta de los ${seleccionados.length} productos seleccionados aplicando el margen global del ${config.margenGanancia}% sobre su Costo Proveedor?`)) return;
    try {
      const batch = writeBatch(db); let actualizados = 0;
      seleccionados.forEach(id => {
        const prod = productos.find(p => p.id === id);
        if (prod && prod.costoProveedor > 0) {
          const nuevoPrecio = Math.round(prod.costoProveedor + (prod.costoProveedor * (Number(config.margenGanancia) / 100)));
          batch.update(doc(db, 'productos', id), { precio: nuevoPrecio }); actualizados++;
        }
      });
      await batch.commit(); setSeleccionados([]); alert(`Éxito. Se recalcularon ${actualizados} precios.`);
    } catch (error) { alert('Error al actualizar precios masivamente.'); }
  };

  // Novedad: Lógica Web ➔ Caja
  const cambiarEstadoPagoPedido = async (pedido: any, nuevoEstado: string) => {
    if (nuevoEstado === 'pagado' && pedido.estadoPago !== 'pagado') {
      const confirmar = window.confirm(`¿Registrar el ingreso de $${pedido.total} en Finanzas por este pedido web?`);
      if (confirmar) {
        const metodo = prompt('Método de pago (efectivo, transferencia, mercadopago, tarjeta):', 'mercadopago') || 'mercadopago';
        await addDoc(collection(db, 'finanzas'), { 
          tipo: 'ingreso', 
          concepto: `Cobro Web #${pedido.id.slice(-6).toUpperCase()} - ${pedido.cliente?.nombre || 'Cliente'}`, 
          monto: Number(pedido.total), 
          metodoPago: metodo.toLowerCase(), 
          fecha: serverTimestamp(), 
          usuario: user.email,
          items: pedido.items || [],
          cliente: pedido.cliente || {}
        });
        alert('Ingreso registrado automáticamente en Finanzas.');
      }
    }
    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), { estadoPago: nuevoEstado });
  };

  const registrarMovimientoFinanzas = async (e: React.FormEvent) => {
    e.preventDefault(); await addDoc(collection(db, 'finanzas'), { tipo: finTipo, concepto: finConcepto, monto: Number(finMonto), metodoPago: finMetodo, fecha: serverTimestamp(), usuario: user.email }); setFinConcepto(''); setFinMonto(''); alert('Movimiento registrado en caja.');
  };
  const guardarConfiguracion = async (e: React.FormEvent) => { e.preventDefault(); await setDoc(doc(db, 'configuracion', 'general'), conf, { merge: true }); alert('Configuración guardada.'); };

  const movimientosFiltrados = movimientosFinanzas.filter(m => {
    if (filtroTipoLista !== 'todos' && m.tipo !== filtroTipoLista) return false;
    if (filtroMetodoLista !== 'todos' && m.metodoPago !== filtroMetodoLista) return false;
    if (filtroTiempo !== 'todos' && m.fecha) {
      const fechaMov = new Date(m.fecha.seconds * 1000); const hoy = new Date();
      if (filtroTiempo === 'hoy') return fechaMov.toDateString() === hoy.toDateString();
      if (filtroTiempo === 'semana') return fechaMov >= new Date(hoy.setDate(hoy.getDate() - 7));
      if (filtroTiempo === 'mes') return fechaMov.getMonth() === hoy.getMonth() && fechaMov.getFullYear() === hoy.getFullYear();
      if (filtroTiempo === 'año') return fechaMov.getFullYear() === hoy.getFullYear();
    }
    return true;
  });

  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const saldoNeto = totalIngresos - totalEgresos;

  const imprimirReporteFinanzas = () => {
    const v = window.open('', '_blank');
    if(!v) return;
    v.document.write(`
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h2 style="text-align:center; border-bottom: 2px solid #333; padding-bottom: 10px;">REPORTE FINANCIERO - ${config.empresaNombre}</h2>
        <p><b>Fecha de emisión:</b> ${new Date().toLocaleString()}</p>
        <p><b>Filtros aplicados:</b> Tiempo: ${filtroTiempo.toUpperCase()} | Tipo: ${filtroTipoLista.toUpperCase()} | Método: ${filtroMetodoLista.toUpperCase()}</p>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8f9fa; padding: 15px; border: 1px solid #ddd;">
          <div><h3 style="margin:0; color: #28a745;">Ingresos: $${totalIngresos.toLocaleString()}</h3></div>
          <div><h3 style="margin:0; color: #dc3545;">Egresos: $${totalEgresos.toLocaleString()}</h3></div>
          <div><h3 style="margin:0; color: ${saldoNeto >= 0 ? '#007bff' : '#fd7e14'};">Saldo Neto: $${saldoNeto.toLocaleString()}</h3></div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #eee;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Fecha</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Concepto</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Método</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${movimientosFiltrados.map(m => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.concepto}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${m.metodoPago}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: ${m.tipo === 'ingreso' ? '#28a745' : '#dc3545'}">${m.tipo === 'ingreso' ? '+' : '-'}$${m.monto}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
    v.document.close(); setTimeout(() => v.print(), 500);
  };

  const pedidosPendientesNum = pedidosWeb.filter(p => p.estadoEnvio !== 'entregado').length;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* MODAL ESCÁNER CÁMARA */}
      {escaneandoPara && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Escanear Código</h3>
            <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
            <button onClick={() => setEscaneandoPara(null)} style={{ marginTop: '20px', width: '100%', padding: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>ERP Panel - {config.empresaNombre}</h2>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <button onClick={() => setPestaña('proveedores')} style={{ padding: '8px 15px', background: pestaña === 'proveedores' ? '#6f42c1' : '#e2d9f3', color: pestaña === 'proveedores' ? 'white' : '#6f42c1', border: '1px solid #6f42c1', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>🚚 Proveedores</button>
          <button onClick={() => setPestaña('taller')} style={{ padding: '8px 15px', background: pestaña === 'taller' ? '#333' : '#ddd', color: pestaña === 'taller' ? 'white' : 'black', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🛠️ Taller CRM</button>
          <button onClick={() => setPestaña('pedidos')} style={{ padding: '8px 15px', background: pestaña === 'pedidos' ? '#e83e8c' : '#f8d7da', color: pestaña === 'pedidos' ? 'white' : '#721c24', border: '1px solid #e83e8c', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>🛒 Pedidos Web {pedidosPendientesNum > 0 && `(${pedidosPendientesNum})`}</button>
          <button onClick={() => setPestaña('catalogo')} style={{ padding: '8px 15px', background: pestaña === 'catalogo' ? '#333' : '#ddd', color: pestaña === 'catalogo' ? 'white' : 'black', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>📦 Inventario</button>
          <button onClick={() => setPestaña('finanzas')} style={{ padding: '8px 15px', background: pestaña === 'finanzas' ? '#198754' : '#d4edda', color: pestaña === 'finanzas' ? 'white' : '#155724', border: '1px solid #198754', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>💰 Finanzas</button>
          <button onClick={() => setPestaña('configuracion')} style={{ padding: '8px 15px', background: pestaña === 'configuracion' ? '#0d6efd' : '#e3f2fd', color: pestaña === 'configuracion' ? 'white' : '#084298', border: '1px solid #0d6efd', cursor: 'pointer', borderRadius: '4px' }}>⚙️ Config</button>
          <button onClick={() => signOut(auth)} style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Salir</button>
        </div>
      </div>

      {pestaña === 'proveedores' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #6f42c1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, color: '#6f42c1' }}>📥 Importador Masivo de Listas de Precios (Excel)</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Subí el archivo <b>.xlsx</b>. El sistema verificará tu base de datos: <b>creará</b> los artículos nuevos y <b>actualizará el precio</b> de los que ya existen, sin duplicarlos.</p>
            <div style={{ background: '#f0e6ff', padding: '15px', borderRadius: '8px', border: '1px dashed #6f42c1' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6f42c1' }}>Nombre del Proveedor (Para identificar la actualización):</label>
              <input type="text" placeholder="Ej: Celulares Mayorista BA" value={nombreProveedorExcel} onChange={e=>setNombreProveedorExcel(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/>
            </div>
            <input type="file" id="fileExcel" accept=".xlsx, .xls" onChange={procesarArchivoExcel} style={{ padding: '10px', border: '2px dashed #6f42c1', borderRadius: '8px', cursor: 'pointer' }} />
            {excelCargando && <p style={{ color: '#0d6efd', fontWeight: 'bold' }}>Procesando archivo...</p>}
            
            {excelHojas.length > 0 && !excelCargando && (
              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Pestaña:</label><br/><select value={hojaActiva} onChange={cambiarHojaDropdown} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>{excelHojas.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Columna Nombre:</label><br/><select value={colNombre} onChange={e=>setColNombre(Number(e.target.value))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>{[0,1,2,3,4,5,6].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
                  <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Columna Costo:</label><br/><select value={colCosto} onChange={e=>setColCosto(Number(e.target.value))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>{[0,1,2,3,4,5,6].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
                  <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Columna Marca (Opcional):</label><br/><select value={colMarca} onChange={e=>setColMarca(Number(e.target.value))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}><option value={-1}>No Aplica</option>{[0,1,2,3,4,5,6].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', background: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#eee' }}><tr><th style={{ padding: '8px' }}>Vista Previa (15)</th><th style={{ padding: '8px' }}>Costo</th><th style={{ padding: '8px', color: '#198754' }}>Venta (+{config.margenGanancia}%)</th></tr></thead>
                    <tbody>
                      {excelData.slice(0, 15).map((row, i) => {
                        const n = row[colNombre]?.toString(); const c = parsePrecio(row[colCosto]);
                        if (!n || isNaN(c)) return null; const p = c + (c * (Number(config.margenGanancia)/100));
                        return <tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>{colMarca >= 0 && row[colMarca] ? `${row[colMarca]} - ` : ''}{n}</td><td style={{ padding: '8px' }}>${c}</td><td style={{ padding: '8px', fontWeight: 'bold', color: '#198754' }}>${Math.round(p)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <button onClick={importarDatosAlInventario} style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>🚀 Iniciar Importación / Actualización a BD</button>
              </div>
            )}
          </div>
        </div>
      )}

      {pestaña === 'taller' && (
        <div style={{ marginTop: '20px' }}>
          <form onSubmit={guardarOrden} style={{ background: '#f8f9fa', padding: '25px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #ddd', marginBottom: '30px' }}>
            <h3 style={{ margin: '0', color: '#333', borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>📝 Nueva Orden de Ingreso</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>1. DATOS DEL CLIENTE</label><input type="text" placeholder="Nombre completo" value={cliNombre} onChange={e=>setCliNombre(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/><input type="text" placeholder="WhatsApp (Ej: 2262...)" value={cliTel} onChange={e=>setCliTel(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>2. IDENTIFICACIÓN DEL EQUIPO</label><div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}><input type="text" placeholder="Marca (Ej: Samsung)" value={marca} onChange={e=>setMarca(e.target.value)} required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/><input type="text" placeholder="Modelo (Ej: A52)" value={modelo} onChange={e=>setModelo(e.target.value)} required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/></div><div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}><input type="text" placeholder="IMEI / N° Serie (Opcional)" value={imei} onChange={e=>setImei(e.target.value)} style={{ flex: 2, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/><input type="text" placeholder="Clave / Patrón" value={contrasena} onChange={e=>setContrasena(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/></div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>3. ESTADO Y DIAGNÓSTICO</label><textarea placeholder="Falla declarada por el cliente..." value={falla} onChange={e=>setFalla(e.target.value)} required rows={3} style={{ width: '100%', padding: '10px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/><input type="text" placeholder="Condición visual (Rayas, golpes, pantalla rota...)" value={condicionVisual} onChange={e=>setCondicionVisual(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>4. ASIGNACIÓN</label><select value={tecnico} onChange={e=>setTecnico(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}><option value="">Sin asignar</option><option value="Laboratorio 1">Laboratorio 1</option><option value="Laboratorio 2">Laboratorio 2</option><option value="Tercerizado">Tercerizado</option></select><button type="submit" style={{ width: '100%', padding: '15px', marginTop: '15px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>➕ Ingresar Equipo</button></div>
            </div>
          </form>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px', background: 'white', border: '1px solid #ddd' }}>
            <thead><tr style={{ background: '#333', color: 'white' }}><th style={{ padding: '12px' }}>Cód. Orden</th><th style={{ padding: '12px' }}>Cliente</th><th style={{ padding: '12px' }}>Equipo & Info</th><th style={{ padding: '12px' }}>Estado / Modificar</th><th style={{ padding: '12px', textAlign: 'center' }}>Comunicación</th></tr></thead>
            <tbody>
              {ordenes.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #eee', opacity: o.estado === 'entregado' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '16px', color: '#0d6efd' }}>{o.codigoSeguimiento}</td>
                  <td style={{ padding: '12px' }}><b style={{ fontSize: '14px' }}>{o.cliente?.nombre}</b><br/><a href={`https://wa.me/549${o.cliente?.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 'bold' }}>{o.cliente?.telefono}</a></td>
                  <td style={{ padding: '12px' }}><b>{o.equipo.marca} {o.equipo.modelo}</b>{o.equipo.contrasena && <span style={{ marginLeft: '10px', background: '#fff3cd', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid #ffeeba' }}>Clave: {o.equipo.contrasena}</span>}<br/><span style={{ color: '#dc3545', fontWeight: 'bold' }}>Falla:</span> {o.fallaDeclarada}<br/>{o.tecnicoAsignado && <span style={{ color: '#666', fontStyle: 'italic', fontSize: '11px' }}>Área: {o.tecnicoAsignado}</span>}</td>
                  <td style={{ padding: '12px' }}>
                    <select value={o.estado} onChange={e => actualizarEstado(o.id, e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #ccc', background: o.estado==='reparado'?'#d4edda': o.estado==='sin solucion'?'#f8d7da': o.estado==='esperando repuesto'?'#fff3cd': o.estado==='en revision'?'#cce5ff': o.estado==='reingreso garantia'?'#e2d9f3':'#fff' }}>
                      <option value="ingresado">📥 Ingresado</option><option value="en revision">🔬 En Revisión</option><option value="esperando repuesto">⏳ Esperando Repuesto</option><option value="reparado">✅ Reparado</option><option value="sin solucion">❌ Sin Solución</option><option value="reingreso garantia">🔄 Reingreso Garantía</option><option value="entregado">📦 Entregado</option>
                    </select>
                    {o.costoReparacion && <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#155724', textAlign: 'center' }}>Costo: ${o.costoReparacion}</div>}
                  </td>
                  <td style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                    <button onClick={() => notificarClienteWhatsApp(o)} style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>💬 WhatsApp</button>
                    <div style={{ display: 'flex', gap: '5px', width: '100%' }}><button onClick={() => imprimirTicket(o)} style={{ flex: 1, background: '#17a2b8', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>🖨️</button><button onClick={async () => { if(window.confirm('¿Borrar?')) await deleteDoc(doc(db, 'ordenes_taller', o.id)) }} style={{ flex: 1, background: '#dc3545', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestaña === 'catalogo' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <form onSubmit={guardarProducto} style={{ flex: '1 1 60%', background: idEditando ? '#fff3cd' : '#e3f2fd', padding: '20px', borderRadius: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap', border: idEditando ? '1px solid #ffeeba' : '1px solid #b6d4fe' }}>
              <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: '0', color: idEditando ? '#856404' : '#084298' }}>{idEditando ? '✏️ Editando Producto' : 'Publicar Producto Manual'}</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', background: prodDestacado ? '#ffc107' : '#fff', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ccc', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}><input type="checkbox" checked={prodDestacado} onChange={e => setProdDestacado(e.target.checked)} /> ⭐ Destacar</label>
              </div>
              <div style={{ flex: '1 1 100%', background: '#fff', padding: '10px', borderRadius: '5px', border: '1px dashed #0d6efd', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="URL Proveedor" value={prodUrlProveedor} onChange={e=>setProdUrlProveedor(e.target.value)} style={{ flex: '1 1 100%', padding: '8px', border: '1px solid #ddd' }}/>
                <input type="number" placeholder="Costo $" value={prodCosto} onChange={e=>setProdCosto(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #ddd' }}/>
                <button type="button" onClick={calcularPrecioVenta} style={{ background: '#198754', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold' }}>Markup (+{config.margenGanancia}%)</button>
              </div>
              <div style={{ flex: '1 1 100%', display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="Cód. Barras" value={prodCodigoBarras} onChange={e=>setProdCodigoBarras(e.target.value)} style={{ flex: 1, padding: '10px', border: '2px solid #0d6efd', borderRadius: '4px' }}/>
                <button type="button" onClick={() => setEscaneandoPara('formulario')} style={{ background: '#333', color: 'white', border: 'none', padding: '0 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📷 Cámara</button>
              </div>
              <input type="text" placeholder="Nombre Repuesto" value={prodNom} onChange={e=>setProdNom(e.target.value)} required style={{ flex: 2, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="text" placeholder="Categoría" value={prodCat} onChange={e=>setProdCat(e.target.value)} required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="number" placeholder="Venta Final $" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} required style={{ width: '150px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', color: '#0d6efd' }}/>
              <input type="number" placeholder="Stock" value={prodStock} onChange={e=>setProdStock(e.target.value)} required style={{ width: '80px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="text" placeholder="Descripción" value={prodDesc} onChange={e=>setProdDesc(e.target.value)} required style={{ flex: '1 1 100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="text" placeholder="URL Imagen" value={prodImg} onChange={e=>setProdImg(e.target.value)} style={{ flex: '1 1 100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <div style={{ flex: '1 1 100%', display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ padding: '12px 20px', background: idEditando ? '#ffc107' : '#0d6efd', color: idEditando ? 'black' : 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', flex: 1 }}>{idEditando ? 'Guardar Cambios' : 'Publicar Producto'}</button>
                {idEditando && <button type="button" onClick={limpiarFormularioProducto} style={{ padding: '12px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Cancelar</button>}
              </div>
            </form>
            <div style={{ flex: '1 1 30%', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #28a745', paddingBottom: '5px' }}>📈 Inteligencia</h3>
              <button onClick={pedirFaltantes} style={{ width: '100%', padding: '15px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px', cursor: 'pointer' }}>📱 Pedido Proveedor</button>
              <h4 style={{ margin: '0 0 10px 0' }}>🏆 Top 5 Más Vendidos</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                {[...productos].sort((a, b) => (b.ventas || 0) - (a.ventas || 0)).slice(0, 5).map((p, i) => (
                  <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}><span><b>{i + 1}.</b> {p.nombre}</span><span style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>{p.ventas || 0} v.</span></li>
                ))}
              </ul>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#333', padding: '15px', borderRadius: '8px', color: 'white' }}>
            <span>🔍 Buscar:</span><input type="text" placeholder="Código de barras o texto..." value={busquedaInventario} onChange={e=>setBusquedaInventario(e.target.value)} style={{ padding: '10px', flex: 1, borderRadius: '4px', border: 'none' }} />
            <button onClick={() => setEscaneandoPara('buscador')} style={{ padding: '10px', background: '#0d6efd', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>📷 Cámara</button>
            <button onClick={() => setBusquedaInventario('')} style={{ padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Limpiar</button>
          </div>

          {seleccionados.length > 0 && (
            <div style={{ background: '#e3f2fd', border: '2px solid #0d6efd', padding: '15px', borderRadius: '8px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><strong style={{ color: '#084298', fontSize: '16px' }}>{seleccionados.length} Productos Seleccionados</strong></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={aplicarMargenMasivo} style={{ background: '#198754', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Actualizar Precio (+{config.margenGanancia}%)</button>
                <button onClick={eliminarSeleccionados} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar Seleccionados</button>
                <button onClick={() => setSeleccionados([])} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
          
          <table style={{ width: '100%', marginTop: '20px', textAlign: 'left', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0d6efd', color: 'white' }}>
                <th style={{ padding: '10px', width: '40px', textAlign: 'center' }}><input type="checkbox" checked={seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0} onChange={toggleTodos} /></th>
                <th style={{ padding: '10px' }}>Cód. Barras</th>
                <th style={{ padding: '10px' }}>Repuesto</th>
                <th style={{ padding: '10px' }}>Precio</th>
                <th style={{ padding: '10px' }}>Stock</th>
                <th style={{ padding: '10px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventarioFiltrado.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #ddd', background: seleccionados.includes(p.id) ? '#e3f2fd' : (p.stock < 3 ? '#fff3cd' : 'white') }}>
                  <td style={{ padding: '10px', textAlign: 'center' }}><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggleSeleccion(p.id)} /></td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{p.codigoBarras || '-'}</td>
                  <td style={{ padding: '10px' }}>
                    <b>{p.nombre}</b> {p.destacado && <span style={{ fontSize: '12px' }}>⭐</span>}
                    <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                      {p.proveedor && <span>🏢 Prov: <b>{p.proveedor}</b> | </span>}
                      {p.ultimaActualizacion && <span>📅 Act: {p.ultimaActualizacion}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>${p.precio}</td>
                  <td style={{ padding: '10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><button onClick={() => actualizarStock(p.id, p.stock - 1)} style={{ padding: '2px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>-</button><span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{p.stock}</span><button onClick={() => actualizarStock(p.id, p.stock + 1)} style={{ padding: '2px 8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>+</button></div></td>
                  <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                    <button onClick={() => registrarVentaDirecta(p)} style={{ background: '#198754', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold' }}>$</button>
                    <button onClick={() => cargarProductoParaEdicion(p)} style={{ background: '#ffc107', color: 'black', border: 'none', padding: '6px 10px', borderRadius: '4px' }}>Editar</button>
                    <button onClick={async () => { if(window.confirm('¿Borrar?')) await deleteDoc(doc(db, 'productos', p.id)) }} style={{ background: 'transparent', color: 'red', border: 'none', cursor: 'pointer', fontSize: '16px' }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECCIÓN: FINANZAS Y FACTURACIÓN DESPLEGABLE */}
      {pestaña === 'finanzas' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold' }}>🔍 Filtrar Reporte:</span>
            <select value={filtroTiempo} onChange={e=>setFiltroTiempo(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}><option value="todos">Todo el historial</option><option value="hoy">Hoy</option><option value="semana">Últimos 7 días</option><option value="mes">Este Mes</option><option value="año">Este Año</option></select>
            <select value={filtroTipoLista} onChange={e=>setFiltroTipoLista(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}><option value="todos">Ingresos y Egresos</option><option value="ingreso">Solo Ingresos</option><option value="egreso">Solo Egresos</option></select>
            <select value={filtroMetodoLista} onChange={e=>setFiltroMetodoLista(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}><option value="todos">Todos los Métodos</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option></select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ background: '#d4edda', padding: '20px', borderRadius: '8px', border: '1px solid #c3e6cb', textAlign: 'center' }}><h3 style={{ margin: '0 0 10px 0', color: '#155724' }}>Ingresos</h3><h2 style={{ margin: 0, color: '#28a745', fontSize: '32px' }}>${totalIngresos.toLocaleString()}</h2></div>
            <div style={{ background: '#f8d7da', padding: '20px', borderRadius: '8px', border: '1px solid #f5c6cb', textAlign: 'center' }}><h3 style={{ margin: '0 0 10px 0', color: '#721c24' }}>Egresos</h3><h2 style={{ margin: 0, color: '#dc3545', fontSize: '32px' }}>${totalEgresos.toLocaleString()}</h2></div>
            <div style={{ background: saldoNeto >= 0 ? '#cce5ff' : '#fff3cd', padding: '20px', borderRadius: '8px', border: `1px solid ${saldoNeto >= 0 ? '#b8daff' : '#ffeeba'}`, textAlign: 'center' }}><h3 style={{ margin: '0 0 10px 0', color: saldoNeto >= 0 ? '#004085' : '#856404' }}>Saldo Neto</h3><h2 style={{ margin: 0, color: saldoNeto >= 0 ? '#007bff' : '#fd7e14', fontSize: '32px' }}>${saldoNeto.toLocaleString()}</h2></div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <form onSubmit={registrarMovimientoFinanzas} style={{ flex: '1 1 300px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', alignSelf: 'flex-start' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>Registrar Movimiento</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Tipo</label><select value={finTipo} onChange={e=>setFinTipo(e.target.value)} style={{ width: '100%', padding: '10px', background: finTipo === 'ingreso' ? '#d4edda' : '#f8d7da', border: '1px solid #ccc', borderRadius: '4px' }}><option value="ingreso">Ingreso (Cobro)</option><option value="egreso">Egreso (Gasto)</option></select></div>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Concepto</label><input type="text" required value={finConcepto} onChange={e=>setFinConcepto(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/></div>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Monto ($)</label><input type="number" required value={finMonto} onChange={e=>setFinMonto(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/></div>
                <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Método de Pago</label><select value={finMetodo} onChange={e=>setFinMetodo(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option></select></div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: finTipo === 'ingreso' ? '#28a745' : '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Registrar en Caja</button>
              </div>
            </form>
            <div style={{ flex: '1 1 600px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Historial Filtrado</h3>
                <button onClick={imprimirReporteFinanzas} style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir Reporte</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead><tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}><th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th><th style={{ padding: '10px', textAlign: 'left' }}>Concepto</th><th style={{ padding: '10px', textAlign: 'left' }}>Método</th><th style={{ padding: '10px', textAlign: 'right' }}>Monto</th><th style={{ padding: '10px', textAlign: 'center' }}>Acción</th></tr></thead>
                <tbody>
                  {movimientosFiltrados.map(m => (
                    <React.Fragment key={m.id}>
                      <tr style={{ borderBottom: expandidoId === m.id ? 'none' : '1px solid #eee', background: expandidoId === m.id ? '#f0f8ff' : 'transparent' }}>
                        <td style={{ padding: '10px', color: '#666', fontSize: '12px' }}>{m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                        <td style={{ padding: '10px' }}>
                          {m.tipo === 'ingreso' && (m.items?.length > 0 || m.concepto.includes('Web') || m.concepto.includes('Mostrador')) && (
                            <button onClick={() => setExpandidoId(expandidoId === m.id ? null : m.id)} style={{ marginRight: '8px', cursor: 'pointer', border: 'none', background: '#0d6efd', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              {expandidoId === m.id ? '▼' : '▶'}
                            </button>
                          )}
                          {m.concepto}
                        </td>
                        <td style={{ padding: '10px', textTransform: 'capitalize' }}>{m.metodoPago}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: m.tipo === 'ingreso' ? '#28a745' : '#dc3545' }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}><button onClick={async () => { if(window.confirm('¿Eliminar?')) await deleteDoc(doc(db, 'finanzas', m.id)) }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>🗑️</button></td>
                      </tr>
                      {/* VISTA DESPLEGADA DE VENTA Y FACTURACIÓN */}
                      {expandidoId === m.id && (
                        <tr style={{ background: '#f0f8ff', borderBottom: '1px solid #ccc' }}>
                          <td colSpan={5} style={{ padding: '15px 30px' }}>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: '250px', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #b6d4fe' }}>
                                <h5 style={{ margin: '0 0 10px 0', color: '#084298' }}>📦 Detalle de Artículos</h5>
                                {m.items && m.items.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                                    {m.items.map((it:any, idx:number) => <li key={idx}><b>{it.cantidad || 1}x</b> {it.nombre} <span style={{color: '#666'}}>(${it.precio})</span></li>)}
                                  </ul>
                                ) : <p style={{ margin: 0, fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Artículos no especificados.</p>}
                              </div>
                              <div style={{ flex: 1, minWidth: '250px', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #b6d4fe' }}>
                                <h5 style={{ margin: '0 0 10px 0', color: '#084298' }}>📄 Datos de Facturación</h5>
                                {m.factura ? (
                                  <div style={{ fontSize: '13px' }}>
                                    <p style={{ margin: '2px 0' }}><b>Tipo:</b> Factura {m.factura.tipo}</p>
                                    <p style={{ margin: '2px 0' }}><b>Número:</b> {m.factura.numero}</p>
                                    <p style={{ margin: '2px 0' }}><b>CUIT/DNI:</b> {m.factura.cuit}</p>
                                    <button onClick={() => updateDoc(doc(db, 'finanzas', m.id), { factura: null })} style={{ marginTop: '10px', fontSize: '11px', background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Borrar Datos</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      <select id={`fac-tipo-${m.id}`} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}><option>A</option><option>B</option><option>C</option><option>Ticket</option></select>
                                      <input id={`fac-num-${m.id}`} type="text" placeholder="Nº Comprobante" style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <input id={`fac-cuit-${m.id}`} type="text" placeholder="CUIT / DNI Cliente" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    <button onClick={async () => {
                                      const tipo = (document.getElementById(`fac-tipo-${m.id}`) as HTMLSelectElement).value;
                                      const numero = (document.getElementById(`fac-num-${m.id}`) as HTMLInputElement).value;
                                      const cuit = (document.getElementById(`fac-cuit-${m.id}`) as HTMLInputElement).value;
                                      if(!numero && !cuit) return alert('Completa un dato para guardar');
                                      await updateDoc(doc(db, 'finanzas', m.id), { factura: { tipo, numero, cuit } });
                                      alert('Facturación asociada a la venta.');
                                    }} style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Asociar Factura</button>
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

      {/* SECCIÓN: PEDIDOS WEB AUTOMATIZADOS */}
      {pestaña === 'pedidos' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidosWeb.map(pedido => (
              <div key={pedido.id} style={{ background: 'white', border: `2px solid ${pedido.estadoEnvio === 'entregado' ? '#e2e3e5' : '#e83e8c'}`, borderRadius: '8px', padding: '15px', display: 'flex', flexWrap: 'wrap', gap: '20px', opacity: pedido.estadoEnvio === 'entregado' ? 0.7 : 1 }}>
                <div style={{ flex: '1 1 250px' }}><h4 style={{ margin: '0 0 10px 0' }}>Orden #{pedido.id.slice(-6).toUpperCase()}</h4><p style={{ margin: '0', fontSize: '14px' }}><b>Cliente:</b> {pedido.cliente.nombre}</p><p style={{ margin: '0', fontSize: '14px' }}><b>Teléfono:</b> {pedido.cliente.telefono}</p><p style={{ margin: '0', fontSize: '14px' }}><b>Envío:</b> {pedido.cliente.metodoEnvio === 'retiro' ? 'Retiro en Local' : `Envío Domicilio ($${pedido.costoEnvio})`}</p>{pedido.cliente.metodoEnvio === 'domicilio' && <p style={{ margin: '0', fontSize: '14px' }}><b>Dirección:</b> {pedido.cliente.direccion}</p>}</div>
                <div style={{ flex: '1 1 300px', background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}><h5 style={{ margin: '0 0 10px 0' }}>Artículos:</h5><ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>{pedido.items.map((item:any) => <li key={item.idBaseDatos}>{item.cantidad}x {item.nombre}</li>)}</ul><h4 style={{ margin: '10px 0 0 0', color: '#28a745', borderTop: '1px solid #ddd', paddingTop: '10px' }}>Total a Cobrar: ${pedido.total}</h4></div>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '10px' }}><select value={pedido.estadoPago} onChange={e=>cambiarEstadoPagoPedido(pedido, e.target.value)} style={{ padding: '8px', background: pedido.estadoPago === 'pagado' ? '#d4edda' : '#fff3cd', border: '1px solid #ccc', borderRadius: '4px' }}><option value="pendiente">Pendiente de Pago</option><option value="pagado">Pagado</option></select><select value={pedido.estadoEnvio} onChange={e=>updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), { estadoEnvio: e.target.value })} style={{ padding: '8px', background: pedido.estadoEnvio === 'entregado' ? '#d4edda' : pedido.estadoEnvio === 'enviado' ? '#cce5ff' : '#fff', border: '1px solid #ccc', borderRadius: '4px' }}><option value="preparacion">En Preparación</option><option value="enviado">Enviado / Listo</option><option value="entregado">Entregado</option></select><button onClick={async () => { if(window.confirm('¿Anular?')) await deleteDoc(doc(db, 'pedidos_ecommerce', pedido.id)) }} style={{ padding: '8px', background: 'transparent', color: 'red', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Anular Pedido</button></div>
              </div>
            ))}
            {pedidosWeb.length === 0 && <p style={{ fontStyle: 'italic', color: '#999' }}>No hay pedidos registrados.</p>}
          </div>
        </div>
      )}

      {/* SECCIÓN: CONFIGURACIÓN */}
      {pestaña === 'configuracion' && (
        <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <form onSubmit={guardarConfiguracion} style={{ flex: '1 1 100%', background: 'white', padding: '30px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px' }}><h3 style={{ margin: '0 0 15px 0', color: '#0d6efd' }}>🏢 General y Marca</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Empresa</label><input type="text" value={conf.empresaNombre} onChange={e=>setConf({...conf, empresaNombre: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>WhatsApp</label><input type="text" value={conf.whatsapp} onChange={e=>setConf({...conf, whatsapp: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Logo URL</label><input type="text" value={conf.logoUrl} onChange={e=>setConf({...conf, logoUrl: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div></div></div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px' }}><h3 style={{ margin: '0 0 15px 0', color: '#28a745' }}>🖨️ Órdenes y Tickets</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Encabezado Ticket</label><textarea value={conf.ticketEncabezado} onChange={e=>setConf({...conf, ticketEncabezado: e.target.value})} rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Leyenda Pie</label><textarea value={conf.ticketLeyenda} onChange={e=>setConf({...conf, ticketLeyenda: e.target.value})} rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div></div></div>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px' }}><h3 style={{ margin: '0 0 15px 0', color: '#ffc107' }}>🛒 E-Commerce Automatizado</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Margen Ganancia (%)</label><input type="number" value={conf.margenGanancia} onChange={e=>setConf({...conf, margenGanancia: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Compra Mínima ($)</label><input type="number" value={conf.compraMinima} onChange={e=>setConf({...conf, compraMinima: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div></div></div>
            <div><h3 style={{ margin: '0 0 15px 0', color: '#e83e8c' }}>💳 Pagos y Envíos</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Costo Envío ($)</label><input type="number" value={conf.envioLocalCosto} onChange={e=>setConf({...conf, envioLocalCosto: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Alias / CBU</label><input type="text" value={conf.aliasTransferencia} onChange={e=>setConf({...conf, aliasTransferencia: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div><div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Link MercadoPago</label><input type="text" value={conf.linkMercadoPago} onChange={e=>setConf({...conf, linkMercadoPago: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}/></div></div></div>
            <button type="submit" style={{ padding: '15px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>💾 Guardar Toda la Configuración</button>
          </form>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 5. ENRUTADOR PRINCIPAL
// ========================================================
const RutaProtegida = ({ children, user }: { children: React.ReactNode, user: User | null }) => user ? children : <Navigate to="/admin-login" />;

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [cargando, setCargando] = useState(true);
  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setCargando(false); }); return () => u(); }, []);

  if (cargando) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando ERP...</div>;

  return (
    <BrowserRouter>
      <nav style={{ padding: '15px', background: '#111', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>🛒 Tienda B2B</Link>
        <Link to="/seguimiento" style={{ color: '#aaa', textDecoration: 'none' }}>🔍 Seguimiento</Link>
        {!user ? <Link to="/admin-login" style={{ marginLeft: 'auto', color: '#17a2b8', textDecoration: 'none' }}>Acceso Taller</Link> : <Link to="/admin-panel" style={{ marginLeft: 'auto', color: '#ffc107', fontWeight: 'bold', textDecoration: 'none' }}>⚙️ ERP Taller</Link>}
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
