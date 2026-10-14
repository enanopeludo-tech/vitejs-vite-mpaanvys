import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';

// Herramientas de Firebase Auth
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Herramientas de Firebase Firestore
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';

import { auth, db } from './firebase'; 

// --------------------------------------------------------
// 1. E-COMMERCE MAYORISTA
// --------------------------------------------------------
const TiendaPublica = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'productos'));
    const desuscribir = onSnapshot(q, (snapshot) => {
      const arrayProductos = snapshot.docs.map((doc) => ({ idBaseDatos: doc.id, ...doc.data() }));
      setProductos(arrayProductos);
      setCargando(false);
    });
    return () => desuscribir();
  }, []);

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando catálogo...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: '0' }}>Catálogo B2B Mayorista</h1>
        <p style={{ color: '#666' }}>Repuestos, accesorios y herramientas para técnicos.</p>
      </div>
      
      {productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '8px' }}>
          <p>El catálogo está vacío actualmente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
          {productos.map((prod) => (
            <div key={prod.idBaseDatos} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ width: '100%', height: '160px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#aaa' }}>📷 Imagen</span>
              </div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>{prod.nombre}</h3>
              <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', flexGrow: 1 }}>{prod.descripcion}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#212529' }}>${prod.precio}</span>
                <button style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Comprar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------
// 2. SEGUIMIENTO DE REPARACIONES
// --------------------------------------------------------
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
    } catch (error) {
      setErrorBusqueda('Error al buscar. Intenta más tarde.');
    } finally {
      setBuscando(false);
    }
  };

  const estiloEstado = (estado: string) => {
    switch (estado) {
      case 'ingresado': return { bg: '#ffeeba', texto: '#856404', label: 'Ingresado al taller' };
      case 'reparado': return { bg: '#d4edda', texto: '#155724', label: '¡Reparado y listo!' };
      case 'entregado': return { bg: '#e2e3e5', texto: '#383d41', label: 'Ya fue entregado' };
      default: return { bg: '#f8f9fa', texto: '#333', label: estado };
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h2>🔍 Rastrear Reparación</h2>
      <p style={{ color: '#666' }}>Ingresa el código de 6 letras para ver el estado del equipo.</p>
      <form onSubmit={buscarOrden} style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <input type="text" placeholder="Ej. A5B9X2" value={codigoBusqueda} onChange={(e) => setCodigoBusqueda(e.target.value)} style={{ padding: '12px', fontSize: '18px', width: '200px', textAlign: 'center', textTransform: 'uppercase', borderRadius: '4px', border: '2px solid #ccc' }} maxLength={6} />
        <button type="submit" disabled={buscando} style={{ padding: '12px 25px', fontSize: '16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: buscando ? 'not-allowed' : 'pointer' }}>
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>
      {errorBusqueda && <div style={{ marginTop: '20px', padding: '15px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', fontWeight: 'bold' }}>{errorBusqueda}</div>}
      {resultado && (
        <div style={{ marginTop: '30px', padding: '25px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'left' }}>
          <h3 style={{ marginTop: '0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Detalles del Equipo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <div><p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MARCA</p><p style={{ margin: '5px 0 0 0', fontSize: '18px' }}>{resultado.equipo.marca}</p></div>
            <div><p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MODELO</p><p style={{ margin: '5px 0 0 0', fontSize: '18px' }}>{resultado.equipo.modelo}</p></div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>FALLA REPORTADA</p>
            <p style={{ margin: '5px 0 0 0', background: '#f8f9fa', padding: '10px', borderRadius: '4px', fontStyle: 'italic' }}>"{resultado.fallaDeclarada}"</p>
          </div>
          <div style={{ marginTop: '25px', padding: '15px', background: estiloEstado(resultado.estado).bg, color: estiloEstado(resultado.estado).texto, borderRadius: '6px', textAlign: 'center' }}>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>ESTADO ACTUAL</p>
            <h2 style={{ margin: '5px 0 0 0' }}>{estiloEstado(resultado.estado).label}</h2>
          </div>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------
// 3. VISTA DE LOGIN
// --------------------------------------------------------
const LoginAdmin = () => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const navigate = useNavigate();

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); navigate('/admin-panel'); } 
    catch (err) { setError('Correo o contraseña incorrectos.'); }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>Acceso Talleres Asociados</h2>
      <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Ingresar</button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}
    </div>
  );
};

// --------------------------------------------------------
// 4. PANEL DE ADMINISTRACIÓN
// --------------------------------------------------------
const DashboardTaller = ({ user }: { user: User }) => {
  // Estados para Órdenes de Reparación
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [mensajeOrden, setMensajeOrden] = useState('');
  const [ordenes, setOrdenes] = useState<any[]>([]);

  // Estados para Nuevo Producto (Catálogo)
  const [nombreProd, setNombreProd] = useState('');
  const [descProd, setDescProd] = useState('');
  const [precioProd, setPrecioProd] = useState('');
  const [mensajeProd, setMensajeProd] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'ordenes_taller'), where('idTiendaOrigen', '==', user.uid));
    const desuscribir = onSnapshot(q, (snapshot) => {
      setOrdenes(snapshot.docs.map((doc) => ({ idBaseDatos: doc.id, ...doc.data() })));
    });
    return () => desuscribir();
  }, [user.uid]);

  // Guardar nueva Reparación
  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault(); setMensajeOrden('Guardando...');
    try {
      const codigoCorto = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'ordenes_taller'), {
        idTiendaOrigen: user.uid, emailTienda: user.email, equipo: { marca, modelo },
        fallaDeclarada: falla, estado: 'ingresado', codigoSeguimiento: codigoCorto, fechaIngreso: serverTimestamp()
      });
      setMensajeOrden(`¡Exito! Código: ${codigoCorto}`); setMarca(''); setModelo(''); setFalla('');
      setTimeout(() => setMensajeOrden(''), 4000); 
    } catch (error) { setMensajeOrden('Error al guardar.'); }
  };

  const cambiarEstado = async (idDocumento: string, nuevoEstado: string) => {
    try { await updateDoc(doc(db, 'ordenes_taller', idDocumento), { estado: nuevoEstado }); } 
    catch (error) { alert('Hubo un error al actualizar el estado.'); }
  };

  // Guardar nuevo Producto al Catálogo
  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault(); setMensajeProd('Agregando producto...');
    try {
      await addDoc(collection(db, 'productos'), {
        nombre: nombreProd,
        descripcion: descProd,
        precio: precioProd, // Guardado como texto
        fechaAgregado: serverTimestamp()
      });
      setMensajeProd('¡Producto agregado al catálogo!');
      setNombreProd(''); setDescProd(''); setPrecioProd('');
      setTimeout(() => setMensajeProd(''), 4000);
    } catch (error) {
      console.error(error);
      setMensajeProd('Error al agregar el producto.');
    }
  };

  const colorEstado = (est: string) => est === 'ingresado' ? '#ffeeba' : est === 'reparado' ? '#d4edda' : '#e2e3e5';

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>Panel Administrativo ({user.email})</h2>
        <button onClick={() => signOut(auth)} style={{ background: '#dc3545', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </div>
      
      {/* SECCIÓN 1: REPARACIONES */}
      <h3 style={{ marginTop: '30px', color: '#333' }}>🛠️ Gestión de Reparaciones</h3>
      
      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h4 style={{ marginTop: '0' }}>Ingresar Nuevo Equipo</h4>
        <form onSubmit={guardarOrden} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Marca</label><input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
          <div style={{ flex: 1, minWidth: '150px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Modelo</label><input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
          <div style={{ flex: 2, minWidth: '200px' }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Falla</label><input type="text" value={falla} onChange={(e) => setFalla(e.target.value)} required style={{ width: '100%', padding: '8px' }} /></div>
          <button type="submit" style={{ background: '#28a745', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Guardar</button>
        </form>
        {mensajeOrden && <p style={{ color: mensajeOrden.includes('Error') ? 'red' : 'green', fontWeight: 'bold', fontSize: '14px' }}>{mensajeOrden}</p>}
      </div>

      <div style={{ marginTop: '20px', overflowX: 'auto' }}>
        {ordenes.length === 0 ? <p style={{ color: '#666', fontStyle: 'italic' }}>Sin equipos cargados.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#343a40', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Cód</th><th style={{ padding: '10px' }}>Equipo</th><th style={{ padding: '10px' }}>Falla</th><th style={{ padding: '10px' }}>Estado</th><th style={{ padding: '10px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.idBaseDatos} style={{ background: colorEstado(o.estado), borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{o.codigoSeguimiento}</td>
                  <td style={{ padding: '10px' }}>{o.equipo.marca} {o.equipo.modelo}</td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{o.fallaDeclarada}</td>
                  <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>{o.estado.replace('_', ' ')}</td>
                  <td style={{ padding: '10px' }}>
                    {o.estado === 'ingresado' && <button onClick={() => cambiarEstado(o.idBaseDatos, 'reparado')} style={{ background: '#28a745', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Marcar Reparado</button>}
                    {o.estado === 'reparado' && <button onClick={() => cambiarEstado(o.idBaseDatos, 'entregado')} style={{ background: '#6c757d', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Marcar Entregado</button>}
                    {o.estado === 'entregado' && <span style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>✓ Listo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <hr style={{ margin: '40px 0', border: '1px solid #eee' }} />

      {/* SECCIÓN 2: CATÁLOGO */}
      <h3 style={{ marginTop: '30px', color: '#084298' }}>📦 Gestión de Catálogo</h3>
      
      <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', border: '1px solid #b6d4fe' }}>
        <h4 style={{ marginTop: '0', color: '#084298' }}>Publicar Nuevo Repuesto / Accesorio</h4>
        <form onSubmit={guardarProducto} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#052c65' }}>Nombre del producto</label>
            <input type="text" value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} placeholder="Ej. Pantalla Moto G20" required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ flex: '1 1 100px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#052c65' }}>Precio ($)</label>
            <input type="number" value={precioProd} onChange={(e) => setPrecioProd(e.target.value)} placeholder="Ej. 4500" required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ flex: '1 1 100%', display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#052c65' }}>Descripción breve</label>
              <input type="text" value={descProd} onChange={(e) => setDescProd(e.target.value)} placeholder="Ej. Módulo original sin marco" required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ background: '#0d6efd', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', height: 'fit-content' }}>
              Publicar Producto
            </button>
          </div>

        </form>
        {mensajeProd && <p style={{ color: mensajeProd.includes('Error') ? 'red' : 'green', fontWeight: 'bold', fontSize: '14px', marginTop: '15px' }}>{mensajeProd}</p>}
      </div>

    </div>
  );
};

// --------------------------------------------------------
// 5. APLICACIÓN PRINCIPAL (ENRUTADOR)
// --------------------------------------------------------
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
        {!user ? <Link to="/admin-login" style={{ marginLeft: 'auto', color: '#17a2b8', fontWeight: 'bold', textDecoration: 'none' }}>Acceso Mayorista</Link> : <Link to="/admin-panel" style={{ marginLeft: 'auto', color: '#ffc107', fontWeight: 'bold', textDecoration: 'none' }}>Ir al Panel Taller</Link>}
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
