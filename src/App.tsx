import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; 

// ========================================================
// 1. E-COMMERCE MAYORISTA (Con imágenes y carrito)
// ========================================================
const TiendaPublica = () => {
  const NUMERO_WHATSAPP = "5491165045067"; // CAMBIA ESTO POR TU NÚMERO
  const [productos, setProductos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'productos'));
    const desuscribir = onSnapshot(q, (snapshot) => {
      setProductos(snapshot.docs.map((doc) => ({ idBaseDatos: doc.id, ...doc.data() })));
      setCargando(false);
    });
    return () => desuscribir();
  }, []);

  const agregarAlCarrito = (producto: any) => {
    const itemExistente = carrito.find(item => item.idBaseDatos === producto.idBaseDatos);
    if (itemExistente) setCarrito(carrito.map(item => item.idBaseDatos === producto.idBaseDatos ? { ...item, cantidad: item.cantidad + 1 } : item));
    else setCarrito([...carrito, { ...producto, cantidad: 1 }]);
  };

  const quitarDelCarrito = (idBaseDatos: string) => setCarrito(carrito.filter(item => item.idBaseDatos !== idBaseDatos));
  const totalCarrito = carrito.reduce((suma, item) => suma + (Number(item.precio) * item.cantidad), 0);

  const enviarPedidoPorWhatsApp = () => {
    let mensaje = "Hola! Quisiera hacer el siguiente pedido:\n\n";
    carrito.forEach((item) => { mensaje += `▪️ ${item.cantidad}x ${item.nombre} ($${item.precio} c/u)\n`; });
    mensaje += `\n*Total: $${totalCarrito}*`;
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando catálogo...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 60%' }}>
        <div style={{ textAlign: 'left', marginBottom: '30px' }}>
          <h1 style={{ margin: '0' }}>Catálogo B2B Mayorista</h1>
          <p style={{ color: '#666' }}>Repuestos, accesorios y herramientas para técnicos.</p>
        </div>
        {productos.length === 0 ? <p>Catálogo vacío.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {productos.map((prod) => (
              <div key={prod.idBaseDatos} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', background: 'white', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', height: '180px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '15px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {prod.imagenUrl ? <img src={prod.imagenUrl} alt={prod.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#aaa' }}>📷 Sin imagen</span>}
                </div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{prod.nombre}</h3>
                <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '13px', flexGrow: 1 }}>{prod.descripcion}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>${prod.precio}</span>
                  <button onClick={() => agregarAlCarrito(prod)} style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Agregar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {carrito.length > 0 && (
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '2px solid #25D366', position: 'sticky', top: '20px' }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>🛒 Tu Pedido</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '300px', overflowY: 'auto' }}>
              {carrito.map((item) => (
                <div key={item.idBaseDatos} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                  <div><p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{item.cantidad}x {item.nombre}</p><p style={{ margin: '0', color: '#666', fontSize: '12px' }}>${item.precio} c/u</p></div>
                  <button onClick={() => quitarDelCarrito(item.idBaseDatos)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Total:</span><span style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>${totalCarrito}</span>
            </div>
            <button onClick={enviarPedidoPorWhatsApp} style={{ width: '100%', padding: '15px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer' }}>Enviar por WhatsApp</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 2. SEGUIMIENTO DE REPARACIONES (Muestra el costo final)
// ========================================================
const Seguimiento = () => {
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBusqueda) return;
    setBuscando(true); setErrorBusqueda(''); setResultado(null);
    try {
      const q = query(collection(db, 'ordenes_taller'), where('codigoSeguimiento', '==', codigoBusqueda.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) setErrorBusqueda('No se encontró ninguna orden con ese código.');
      else setResultado(querySnapshot.docs[0].data());
    } catch (error) { setErrorBusqueda('Error al buscar.'); } finally { setBuscando(false); }
  };

  const estiloEstado = (est: string) => est === 'ingresado' ? { bg: '#ffeeba', txt: '#856404', lbl: 'En Taller' } : est === 'reparado' ? { bg: '#d4edda', txt: '#155724', lbl: '¡Reparado!' } : { bg: '#e2e3e5', txt: '#383d41', lbl: 'Entregado' };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h2>🔍 Rastrear Reparación</h2>
      <form onSubmit={buscarOrden} style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
        <input type="text" placeholder="Ej. A5B9X2" value={codigoBusqueda} onChange={(e) => setCodigoBusqueda(e.target.value)} style={{ padding: '12px', fontSize: '18px', width: '200px', textAlign: 'center', textTransform: 'uppercase', borderRadius: '4px', border: '2px solid #ccc' }} maxLength={6} />
        <button type="submit" disabled={buscando} style={{ padding: '12px 25px', fontSize: '16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: buscando ? 'not-allowed' : 'pointer' }}>Buscar</button>
      </form>
      {errorBusqueda && <div style={{ marginTop: '20px', padding: '15px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', fontWeight: 'bold' }}>{errorBusqueda}</div>}
      
      {resultado && (
        <div style={{ marginTop: '30px', padding: '25px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'left' }}>
          <h3 style={{ marginTop: '0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Detalles del Equipo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <div><p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MARCA</p><p style={{ margin: '0', fontSize: '18px' }}>{resultado.equipo.marca}</p></div>
            <div><p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MODELO</p><p style={{ margin: '0', fontSize: '18px' }}>{resultado.equipo.modelo}</p></div>
          </div>
          <div style={{ marginTop: '20px' }}><p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>FALLA REPORTADA</p><p style={{ margin: '5px 0 0 0', background: '#f8f9fa', padding: '10px', borderRadius: '4px', fontStyle: 'italic' }}>"{resultado.fallaDeclarada}"</p></div>
          <div style={{ marginTop: '25px', padding: '15px', background: estiloEstado(resultado.estado).bg, color: estiloEstado(resultado.estado).txt, borderRadius: '6px', textAlign: 'center' }}>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>ESTADO ACTUAL</p><h2 style={{ margin: '5px 0 0 0' }}>{estiloEstado(resultado.estado).lbl}</h2>
            {/* NUEVO: Muestra el costo si ya está reparado */}
            {resultado.costoReparacion && <h3 style={{ margin: '15px 0 0 0', color: '#333' }}>Costo a abonar: ${resultado.costoReparacion}</h3>}
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 3. VISTA DE LOGIN
// ========================================================
const LoginAdmin = () => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const navigate = useNavigate();
  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); navigate('/admin-panel'); } catch (err) { setError('Credenciales incorrectas.'); }
  };
  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>Acceso Talleres</h2>
      <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Ingresar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

// ========================================================
// 4. PANEL DE ADMINISTRACIÓN TOTAL
// ========================================================
const DashboardTaller = ({ user }: { user: User }) => {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productosPanel, setProductosPanel] = useState<any[]>([]);

  // Estados Form Reparaciones
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState(''); const [falla, setFalla] = useState('');
  // Estados Form Catálogo (con Imagen)
  const [nombreProd, setNombreProd] = useState(''); const [descProd, setDescProd] = useState(''); const [precioProd, setPrecioProd] = useState(''); const [imagenUrl, setImagenUrl] = useState('');

  // Cargar Órdenes y Productos
  useEffect(() => {
    const unsubOrdenes = onSnapshot(query(collection(db, 'ordenes_taller'), where('idTiendaOrigen', '==', user.uid)), (snap) => setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProds = onSnapshot(query(collection(db, 'productos')), (snap) => setProductosPanel(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubOrdenes(); unsubProds(); };
  }, [user.uid]);

  // Funciones de Reparación
  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoCorto = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'ordenes_taller'), { idTiendaOrigen: user.uid, emailTienda: user.email, equipo: { marca, modelo }, fallaDeclarada: falla, estado: 'ingresado', codigoSeguimiento: codigoCorto, fechaIngreso: serverTimestamp() });
    setMarca(''); setModelo(''); setFalla(''); alert(`Orden guardada. Código: ${codigoCorto}`);
  };

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    let dataUpdate: any = { estado: nuevoEstado };
    if (nuevoEstado === 'reparado') {
      const costo = prompt('Ingresa el costo final de la reparación (solo números):');
      if (costo === null) return; // Si cancela, abortamos
      dataUpdate.costoReparacion = costo;
    }
    await updateDoc(doc(db, 'ordenes_taller', id), dataUpdate);
  };

  const eliminarOrden = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar esta orden del sistema?")) {
      await deleteDoc(doc(db, 'ordenes_taller', id));
    }
  };

  // Funciones de Catálogo
  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'productos'), { nombre: nombreProd, descripcion: descProd, precio: precioProd, imagenUrl: imagenUrl, fechaAgregado: serverTimestamp() });
    setNombreProd(''); setDescProd(''); setPrecioProd(''); setImagenUrl(''); alert('Producto publicado exitosamente');
  };

  const eliminarProducto = async (id: string) => {
    if (window.confirm("¿Quitar este producto del catálogo público?")) {
      await deleteDoc(doc(db, 'productos', id));
    }
  };

  const colorE = (est: string) => est === 'ingresado' ? '#ffeeba' : est === 'reparado' ? '#d4edda' : '#e2e3e5';

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>Panel Administrativo ({user.email})</h2>
        <button onClick={() => signOut(auth)} style={{ background: '#dc3545', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </div>
      
      {/* SECCIÓN 1: REPARACIONES */}
      <h3 style={{ marginTop: '30px', color: '#333' }}>🛠️ Gestión de Reparaciones</h3>
      <form onSubmit={guardarOrden} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Marca</label><input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Modelo</label><input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
        <div style={{ flex: 2 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Falla</label><input type="text" value={falla} onChange={(e) => setFalla(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
        <button type="submit" style={{ background: '#28a745', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Equipo</button>
      </form>

      <div style={{ marginTop: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#343a40', color: 'white', textAlign: 'left' }}><th style={{ padding: '10px' }}>Cód</th><th style={{ padding: '10px' }}>Equipo</th><th style={{ padding: '10px' }}>Costo</th><th style={{ padding: '10px' }}>Estado</th><th style={{ padding: '10px' }}>Acciones</th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id} style={{ background: colorE(o.estado), borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{o.codigoSeguimiento}</td>
                <td style={{ padding: '10px' }}>{o.equipo.marca} {o.equipo.modelo}</td>
                <td style={{ padding: '10px', fontWeight: 'bold', color: '#198754' }}>{o.costoReparacion ? `$${o.costoReparacion}` : '-'}</td>
                <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>{o.estado}</td>
                <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                  {o.estado === 'ingresado' && <button onClick={() => cambiarEstado(o.id, 'reparado')} style={{ background: '#28a745', color: 'white', padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>A Reparado</button>}
                  {o.estado === 'reparado' && <button onClick={() => cambiarEstado(o.id, 'entregado')} style={{ background: '#6c757d', color: 'white', padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>A Entregado</button>}
                  <button onClick={() => eliminarOrden(o.id)} style={{ background: '#dc3545', color: 'white', padding: '6px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr style={{ margin: '40px 0', border: '1px solid #eee' }} />

      {/* SECCIÓN 2: CATÁLOGO */}
      <h3 style={{ marginTop: '30px', color: '#084298' }}>📦 Gestión de Catálogo</h3>
      <form onSubmit={guardarProducto} style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', border: '1px solid #b6d4fe', display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nombre</label><input type="text" value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
        <div style={{ flex: '1 1 100px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Precio ($)</label><input type="number" value={precioProd} onChange={(e) => setPrecioProd(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
        <div style={{ flex: '1 1 300px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Descripción</label><input type="text" value={descProd} onChange={(e) => setDescProd(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
        <div style={{ flex: '1 1 100%', display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>URL de Imagen (Opcional - Pega un link de Google)</label><input type="text" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
          <button type="submit" style={{ background: '#0d6efd', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Publicar Producto</button>
        </div>
      </form>

      {/* Lista de productos para poder eliminarlos */}
      <div style={{ marginTop: '20px' }}>
        <h4>Productos Publicados ({productosPanel.length})</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {productosPanel.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #ddd', padding: '10px', marginBottom: '5px', borderRadius: '4px' }}>
              <span><b>{p.nombre}</b> - ${p.precio}</span>
              <button onClick={() => eliminarProducto(p.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
};

// ========================================================
// 5. ENRUTADOR PRINCIPAL
// ========================================================
const RutaProtegida = ({ children, user }: { children: React.ReactNode, user: User | null }) => {
  if (!user) return <Navigate to="/admin-login" />;
  return children;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [cargando, setCargando] = useState(true);
  useEffect(() => { const u = onAuthStateChanged(auth, (u) => { setUser(u); setCargando(false); }); return () => u(); }, []);

  if (cargando) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando sistema...</div>;

  return (
    <BrowserRouter>
      <nav style={{ padding: '15px', background: '#212529', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>🛒 E-Commerce</Link>
        <Link to="/seguimiento" style={{ color: '#adb5bd', textDecoration: 'none' }}>🔍 Seguimiento</Link>
        {!user ? <Link to="/admin-login" style={{ marginLeft: 'auto', color: '#17a2b8', fontWeight: 'bold', textDecoration: 'none' }}>Acceso Taller</Link> : <Link to="/admin-panel" style={{ marginLeft: 'auto', color: '#ffc107', fontWeight: 'bold', textDecoration: 'none' }}>Ir al Panel</Link>}
      </nav>
      <Routes>
        <Route path="/" element={<TiendaPublica />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/admin-login" element={user ? <Navigate to="/admin-panel" /> : <LoginAdmin />} />
        <Route path="/admin-panel" element={<RutaProtegida user={user}><DashboardTaller user={user!} /></RutaProtegida>} />
      </Routes>
    </BrowserRouter>
  );
}
