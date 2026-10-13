import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';

// Herramientas de Firebase Auth
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Herramientas de Firebase Firestore
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';

// Tu archivo de conexión a Firebase
import { auth, db } from './firebase'; 

// --------------------------------------------------------
// 1. VISTAS PÚBLICAS
// --------------------------------------------------------
const TiendaPublica = () => (
  <div style={{ padding: '20px' }}>
    <h2>Tienda Mayorista - Repuestos y Accesorios</h2>
    <p>Aquí mostraremos los productos a la venta desde Firestore en el futuro.</p>
  </div>
);

const Seguimiento = () => {
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [resultado, setResultado] = useState<any | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBusqueda) return;

    setBuscando(true);
    setErrorBusqueda('');
    setResultado(null);

    try {
      const codigoFiltro = codigoBusqueda.trim().toUpperCase();
      const q = query(
        collection(db, 'ordenes_taller'), 
        where('codigoSeguimiento', '==', codigoFiltro)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorBusqueda('No se encontró ninguna orden con ese código. Verifícalo e intenta de nuevo.');
      } else {
        setResultado(querySnapshot.docs[0].data());
      }
    } catch (error) {
      console.error(error);
      setErrorBusqueda('Hubo un error al buscar. Intenta más tarde.');
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
        <input 
          type="text" 
          placeholder="Ej. A5B9X2" 
          value={codigoBusqueda}
          onChange={(e) => setCodigoBusqueda(e.target.value)}
          style={{ padding: '12px', fontSize: '18px', width: '200px', textAlign: 'center', textTransform: 'uppercase', borderRadius: '4px', border: '2px solid #ccc' }}
          maxLength={6}
        />
        <button 
          type="submit" 
          disabled={buscando}
          style={{ padding: '12px 25px', fontSize: '16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: buscando ? 'not-allowed' : 'pointer' }}
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {errorBusqueda && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', fontWeight: 'bold' }}>
          {errorBusqueda}
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: '30px', padding: '25px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'left' }}>
          <h3 style={{ marginTop: '0', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Detalles del Equipo</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MARCA</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px' }}>{resultado.equipo.marca}</p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>MODELO</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '18px' }}>{resultado.equipo.modelo}</p>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <p style={{ margin: '0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>FALLA REPORTADA</p>
            <p style={{ margin: '5px 0 0 0', background: '#f8f9fa', padding: '10px', borderRadius: '4px', fontStyle: 'italic' }}>
              "{resultado.fallaDeclarada}"
            </p>
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
// 2. VISTA DE LOGIN
// --------------------------------------------------------
const LoginAdmin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin-panel');
    } catch (err) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
    }
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
// 3. PANEL DE ADMINISTRACIÓN (Con Lista en Tiempo Real)
// --------------------------------------------------------
const DashboardTaller = ({ user }: { user: User }) => {
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ordenes, setOrdenes] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'ordenes_taller'), where('idTiendaOrigen', '==', user.uid));
    const desuscribir = onSnapshot(q, (snapshot) => {
      const arrayOrdenes = snapshot.docs.map((doc) => ({ idBaseDatos: doc.id, ...doc.data() }));
      setOrdenes(arrayOrdenes);
    });
    return () => desuscribir();
  }, [user.uid]);

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('Guardando orden...');
    try {
      const codigoCorto = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'ordenes_taller'), {
        idTiendaOrigen: user.uid,
        emailTienda: user.email,
        equipo: { marca, modelo },
        fallaDeclarada: falla,
        estado: 'ingresado',
        codigoSeguimiento: codigoCorto,
        fechaIngreso: serverTimestamp()
      });
      setMensaje(`¡Orden guardada con éxito! Código: ${codigoCorto}`);
      setMarca(''); setModelo(''); setFalla('');
      setTimeout(() => setMensaje(''), 4000); 
    } catch (error) {
      console.error(error);
      setMensaje('Error al guardar la orden. Verifica la consola.');
    }
  };

  const colorEstado = (estado: string) => {
    switch (estado) {
      case 'ingresado': return '#ffeeba'; 
      case 'reparado': return '#d4edda';  
      case 'entregado': return '#e2e3e5'; 
      default: return '#f8f9fa';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>Panel Taller ({user.email})</h2>
        <button onClick={() => signOut(auth)} style={{ background: '#dc3545', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </div>
      
      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginTop: '20px', border: '1px solid #ddd' }}>
        <h3 style={{ marginTop: '0' }}>Ingresar Nuevo Equipo</h3>
        <form onSubmit={guardarOrden} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Marca</label>
            <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Modelo</label>
            <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Falla</label>
            <input type="text" value={falla} onChange={(e) => setFalla(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" style={{ background: '#28a745', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
        </form>
        {mensaje && <p style={{ color: mensaje.includes('Error') ? 'red' : 'green', fontWeight: 'bold', fontSize: '14px', marginTop: '10px' }}>{mensaje}</p>}
      </div>

      <h3 style={{ marginTop: '30px' }}>Equipos Ingresados por esta Tienda</h3>
      {ordenes.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>Aún no has ingresado ningún equipo.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#343a40', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Código</th>
              <th style={{ padding: '10px' }}>Equipo</th>
              <th style={{ padding: '10px' }}>Falla</th>
              <th style={{ padding: '10px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((orden) => (
              <tr key={orden.idBaseDatos} style={{ background: colorEstado(orden.estado), borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{orden.codigoSeguimiento}</td>
                <td style={{ padding: '10px' }}>{orden.equipo.marca} {orden.equipo.modelo}</td>
                <td style={{ padding: '10px', fontSize: '14px' }}>{orden.fallaDeclarada}</td>
                <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>{orden.estado.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// --------------------------------------------------------
// 4. EL GUARDIÁN DE RUTAS
// --------------------------------------------------------
const RutaProtegida = ({ children, user }: { children: JSX.Element, user: User | null }) => {
  if (!user) return <Navigate to="/admin-login" />;
  return children;
};

// --------------------------------------------------------
// 5. APLICACIÓN PRINCIPAL (ENRUTADOR)
// --------------------------------------------------------
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioActual) => {
      setUser(usuarioActual);
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  if (cargando) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando sistema...</div>;

  return (
    <BrowserRouter>
      <nav style={{ padding: '15px', background: '#212529', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>🛒 E-Commerce</Link>
        <Link to="/seguimiento" style={{ color: '#adb5bd', textDecoration: 'none' }}>🔍 Seguimiento</Link>
        
        {!user ? (
          <Link to="/admin-login" style={{ marginLeft: 'auto', color: '#17a2b8', fontWeight: 'bold', textDecoration: 'none' }}>Acceso Mayorista</Link>
        ) : (
          <Link to="/admin-panel" style={{ marginLeft: 'auto', color: '#ffc107', fontWeight: 'bold', textDecoration: 'none' }}>Ir al Panel Taller</Link>
        )}
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
