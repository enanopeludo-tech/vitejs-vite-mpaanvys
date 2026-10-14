import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from './firebase'; 

// ========================================================
// 1. E-COMMERCE B2B (Stock, Categorías, Buscador, Privado)
// ========================================================
const TiendaPublica = ({ user }: { user: User | null }) => {
  const NUMERO_WHATSAPP = "5491165045067"; 
  const [productos, setProductos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<any[]>([]);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  useEffect(() => {
    const desuscribir = onSnapshot(query(collection(db, 'productos')), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ idBaseDatos: doc.id, ...doc.data() })));
      setCargando(false);
    });
    return () => desuscribir();
  }, []);

  const categorias = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria || 'Otros')))];
  
  const productosFiltrados = productos.filter(p => 
    (categoriaActiva === 'Todas' || p.categoria === categoriaActiva) &&
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const agregarAlCarrito = (producto: any) => {
    const item = carrito.find(i => i.idBaseDatos === producto.idBaseDatos);
    if (item && item.cantidad < producto.stock) {
      setCarrito(carrito.map(i => i.idBaseDatos === producto.idBaseDatos ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else if (!item && producto.stock > 0) {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    } else {
      alert('No hay suficiente stock disponible.');
    }
  };

  const enviarPedido = () => {
    let msg = "Hola! Nuevo pedido mayorista B2B:\n\n";
    carrito.forEach(i => { msg += `▪️ ${i.cantidad}x ${i.nombre} ($${i.precio})\n`; });
    msg += `\n*Total: $${carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0)}*`;
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (cargando) return <div style={{ textAlign: 'center', padding: '50px' }}>Cargando catálogo...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <h2>Catálogo Mayorista</h2>
        {!user && <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '15px', color: '#856404' }}>🔒 Inicia sesión como Taller Asociado para ver precios y comprar.</div>}
        
        {/* Buscador y Categorías */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input type="text" placeholder="Buscar repuesto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '10px', flex: 1, borderRadius: '5px', border: '1px solid #ccc' }} />
          <select value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
          {productosFiltrados.map(prod => (
            <div key={prod.idBaseDatos} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', background: 'white' }}>
              <div style={{ height: '150px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                {prod.imagenUrl ? <img src={prod.imagenUrl} style={{ maxHeight: '100%', maxWidth: '100%' }} alt="prod" /> : '📷'}
              </div>
              <span style={{ fontSize: '11px', background: '#eee', padding: '3px 6px', borderRadius: '4px' }}>{prod.categoria || 'Otros'}</span>
              <h4 style={{ margin: '10px 0 5px 0' }}>{prod.nombre}</h4>
              <p style={{ fontSize: '12px', color: '#666', height: '40px', overflow: 'hidden' }}>{prod.descripcion}</p>
              
              {user ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <b style={{ fontSize: '18px' }}>${prod.precio}</b>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: prod.stock > 0 ? 'green' : 'red' }}>Stock: {prod.stock}</div>
                    <button onClick={() => agregarAlCarrito(prod)} disabled={prod.stock <= 0} style={{ background: prod.stock > 0 ? '#0d6efd' : '#ccc', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Sumar</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '10px' }}>Precio oculto</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {user && carrito.length > 0 && (
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '2px solid #25D366', position: 'sticky', top: '20px' }}>
            <h3>🛒 Carrito Mayorista</h3>
            {carrito.map(item => (
              <div key={item.idBaseDatos} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <div><b style={{ fontSize: '14px' }}>{item.cantidad}x {item.nombre}</b><br/><span style={{ fontSize: '12px', color: '#666' }}>${item.precio}</span></div>
                <button onClick={() => setCarrito(carrito.filter(i => i.idBaseDatos !== item.idBaseDatos))} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}>X</button>
              </div>
            ))}
            <h3 style={{ textAlign: 'right' }}>Total: ${carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0)}</h3>
            <button onClick={enviarPedido} style={{ width: '100%', padding: '10px', background: '#25D366', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Enviar Pedido (WhatsApp)</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 2. SEGUIMIENTO (Con Historial / Timeline)
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

  return (
    <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>Rastrear Equipo</h2>
      <form onSubmit={buscar} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <input type="text" placeholder="Código (Ej: X9B2V)" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ padding: '10px', textTransform: 'uppercase', width: '200px', textAlign: 'center' }} maxLength={6}/>
        <button type="submit" style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', cursor: 'pointer' }}>Buscar</button>
      </form>

      {resultado && (
        <div style={{ marginTop: '30px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>{resultado.equipo.marca} {resultado.equipo.modelo}</h3>
          <p><b>Falla:</b> {resultado.fallaDeclarada}</p>
          <hr/>
          <h4>Línea de tiempo de reparación:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {resultado.historial?.map((evento: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d6efd', marginTop: '5px' }}></div>
                <div>
                  <b style={{ textTransform: 'uppercase' }}>{evento.estado}</b>
                  <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}>{evento.fecha} - {evento.comentario}</p>
                </div>
              </div>
            ))}
          </div>
          {resultado.costoReparacion && <h3 style={{ textAlign: 'center', marginTop: '20px', color: '#198754' }}>Costo Final: ${resultado.costoReparacion}</h3>}
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
        <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none' }}>Entrar</button>
      </form>
    </div>
  );
};

// ========================================================
// 4. PANEL ERP: TALLER + CATÁLOGO + CRM + TICKETS
// ========================================================
const DashboardTaller = ({ user }: { user: User }) => {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [pestaña, setPestaña] = useState('taller'); // 'taller' | 'catalogo'

  // CRM y Formulario de Taller
  const [cliNombre, setCliNombre] = useState(''); const [cliTel, setCliTel] = useState('');
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [tecnico, setTecnico] = useState('');
  
  // Formulario Catálogo
  const [prodNom, setProdNom] = useState(''); const [prodCat, setProdCat] = useState('');
  const [prodPrecio, setProdPrecio] = useState(''); const [prodStock, setProdStock] = useState('');

  useEffect(() => {
    const unsubOrd = onSnapshot(query(collection(db, 'ordenes_taller'), where('idTiendaOrigen', '==', user.uid)), (snap) => setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snap) => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubOrd(); unsubProd(); };
  }, [user.uid]);

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fechaActual = new Date().toLocaleString();
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid,
      cliente: { nombre: cliNombre, telefono: cliTel },
      equipo: { marca, modelo },
      fallaDeclarada: falla,
      tecnicoAsignado: tecnico,
      estado: 'ingresado',
      codigoSeguimiento: cod,
      fechaIngreso: serverTimestamp(),
      historial: [{ estado: 'ingresado', fecha: fechaActual, comentario: 'Equipo recibido en sucursal.' }]
    });
    alert(`Generado. Código: ${cod}`);
    setCliNombre(''); setCliTel(''); setMarca(''); setModelo(''); setFalla(''); setTecnico('');
  };

  const actualizarEstado = async (id: string, nuevoEstado: string) => {
    const comentario = prompt(`Comentario para el estado '${nuevoEstado}':`) || 'Cambio de estado';
    const fechaActual = new Date().toLocaleString();
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: fechaActual, comentario }) };
    if (nuevoEstado === 'reparado') {
      const costo = prompt('Costo de la reparación:');
      if(costo) data.costoReparacion = costo;
    }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const imprimirTicket = (orden: any) => {
    const v = window.open('', '_blank');
    if(!v) return;
    v.document.write(`
      <div style="font-family: monospace; width: 300px; padding: 20px; border: 1px solid #000;">
        <h2 style="text-align:center; margin:0;">TICKET DE SERVICIO</h2>
        <p style="text-align:center; margin:5px 0;">${new Date().toLocaleDateString()}</p>
        <hr/>
        <p><b>Cliente:</b> ${orden.cliente?.nombre}</p>
        <p><b>Tel:</b> ${orden.cliente?.telefono}</p>
        <hr/>
        <p><b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</p>
        <p><b>Falla:</b> ${orden.fallaDeclarada}</p>
        <hr/>
        <h1 style="text-align:center; letter-spacing: 3px;">${orden.codigoSeguimiento}</h1>
        <p style="text-align:center; font-size:12px;">Use este código en nuestra web para seguir su reparación.</p>
      </div>
    `);
    v.document.close(); v.print();
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'productos'), { nombre: prodNom, categoria: prodCat, precio: Number(prodPrecio), stock: Number(prodStock), fecha: serverTimestamp() });
    setProdNom(''); setProdCat(''); setProdPrecio(''); setProdStock(''); alert('Producto agregado');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h2>ERP Panel</h2>
        <div>
          <button onClick={() => setPestaña('taller')} style={{ marginRight: '10px', padding: '10px', background: pestaña === 'taller' ? '#333' : '#ddd', color: pestaña === 'taller' ? 'white' : 'black', border: 'none', cursor: 'pointer' }}>🛠️ Taller (CRM)</button>
          <button onClick={() => setPestaña('catalogo')} style={{ marginRight: '10px', padding: '10px', background: pestaña === 'catalogo' ? '#333' : '#ddd', color: pestaña === 'catalogo' ? 'white' : 'black', border: 'none', cursor: 'pointer' }}>📦 Catálogo</button>
          <button onClick={() => signOut(auth)} style={{ padding: '10px', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {pestaña === 'taller' && (
        <div style={{ marginTop: '20px' }}>
          <form onSubmit={guardarOrden} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <h4 style={{ gridColumn: '1 / -1', margin: '0' }}>Ingresar Orden</h4>
            <input type="text" placeholder="Nombre Cliente" value={cliNombre} onChange={e=>setCliNombre(e.target.value)} required style={{ padding: '10px' }}/>
            <input type="text" placeholder="Teléfono Cliente" value={cliTel} onChange={e=>setCliTel(e.target.value)} required style={{ padding: '10px' }}/>
            <input type="text" placeholder="Marca" value={marca} onChange={e=>setMarca(e.target.value)} required style={{ padding: '10px' }}/>
            <input type="text" placeholder="Modelo" value={modelo} onChange={e=>setModelo(e.target.value)} required style={{ padding: '10px' }}/>
            <input type="text" placeholder="Falla declarada" value={falla} onChange={e=>setFalla(e.target.value)} required style={{ padding: '10px' }}/>
            <input type="text" placeholder="Técnico (Ej: Juan)" value={tecnico} onChange={e=>setTecnico(e.target.value)} style={{ padding: '10px' }}/>
            <button type="submit" style={{ gridColumn: '1 / -1', padding: '10px', background: '#28a745', color: 'white', border: 'none', fontWeight: 'bold' }}>Generar Orden y Código</button>
          </form>

          <table style={{ width: '100%', marginTop: '20px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#333', color: 'white' }}><th style={{ padding: '10px' }}>Cliente</th><th style={{ padding: '10px' }}>Equipo</th><th style={{ padding: '10px' }}>Cód</th><th style={{ padding: '10px' }}>Estado</th><th style={{ padding: '10px' }}>Acciones</th></tr></thead>
            <tbody>
              {ordenes.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}><b>{o.cliente?.nombre}</b><br/><span style={{ fontSize:'12px' }}>{o.cliente?.telefono}</span></td>
                  <td style={{ padding: '10px' }}>{o.equipo.marca} {o.equipo.modelo}<br/><span style={{ fontSize:'12px' }}>{o.tecnicoAsignado && `Téc: ${o.tecnicoAsignado}`}</span></td>
                  <td style={{ padding: '10px' }}>{o.codigoSeguimiento}</td>
                  <td style={{ padding: '10px' }}>{o.estado.toUpperCase()}</td>
                  <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                    <button onClick={() => imprimirTicket(o)} style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '5px', cursor: 'pointer' }}>🖨️ Ticket</button>
                    {o.estado === 'ingresado' && <button onClick={() => actualizarEstado(o.id, 'reparado')} style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px' }}>✓ Reparado</button>}
                    {o.estado === 'reparado' && <button onClick={() => actualizarEstado(o.id, 'entregado')} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '5px' }}>Entregar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestaña === 'catalogo' && (
        <div style={{ marginTop: '20px' }}>
          <form onSubmit={guardarProducto} style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Nombre Repuesto" value={prodNom} onChange={e=>setProdNom(e.target.value)} required style={{ flex: 2, padding: '10px' }}/>
            <input type="text" placeholder="Categoría (Ej: Pantallas)" value={prodCat} onChange={e=>setProdCat(e.target.value)} required style={{ flex: 1, padding: '10px' }}/>
            <input type="number" placeholder="Precio $" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} required style={{ width: '100px', padding: '10px' }}/>
            <input type="number" placeholder="Stock" value={prodStock} onChange={e=>setProdStock(e.target.value)} required style={{ width: '80px', padding: '10px' }}/>
            <button type="submit" style={{ padding: '10px 20px', background: '#0d6efd', color: 'white', border: 'none' }}>Guardar</button>
          </form>
          
          <table style={{ width: '100%', marginTop: '20px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#0d6efd', color: 'white' }}><th style={{ padding: '10px' }}>Repuesto</th><th style={{ padding: '10px' }}>Categoría</th><th style={{ padding: '10px' }}>Precio</th><th style={{ padding: '10px' }}>Stock</th><th style={{ padding: '10px' }}>Borrar</th></tr></thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{p.nombre}</td>
                  <td style={{ padding: '10px' }}>{p.categoria}</td>
                  <td style={{ padding: '10px' }}>${p.precio}</td>
                  <td style={{ padding: '10px', color: p.stock < 3 ? 'red' : 'black' }}>{p.stock}</td>
                  <td style={{ padding: '10px' }}><button onClick={async () => { if(window.confirm('¿Borrar?')) await deleteDoc(doc(db, 'productos', p.id)) }} style={{ background: 'red', color: 'white', border: 'none', padding: '5px' }}>X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
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

  if (cargando) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando sistema ERP...</div>;

  return (
    <BrowserRouter>
      <nav style={{ padding: '15px', background: '#111', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>🛒 Tienda B2B</Link>
        <Link to="/seguimiento" style={{ color: '#aaa', textDecoration: 'none' }}>🔍 Seguimiento Público</Link>
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
