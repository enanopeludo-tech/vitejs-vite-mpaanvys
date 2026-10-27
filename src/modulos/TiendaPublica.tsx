// src/modulos/TiendaPublica.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CONFIG_DEFAULT, aplicarRedondeo } from '../estilosTema';

export const TiendaPublica = ({ user }: { user: User | null }) => {
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

  // FILTRO ESTRICTO: Solo muestra artículos propios de la tienda (excluye listas masivas de proveedores para que no se mezclen)
  const productosPropiosDeTienda = productos.filter(p => {
    const perteneceATienda = (p.ownerId || 'MASTER') === tiendaIdEfectiva;
    const esPropio = config.mostrarArticulosProveedorEnTienda ? true : (!p.esDeProveedor && p.descripcion !== 'Importado de lista');
    return perteneceATienda && esPropio;
  });

  // Conteo de artículos por cada categoría para el Menú de Categorías
  const categoriasConConteo = React.useMemo(() => {
    const mapa = new Map<string, number>();
    productosPropiosDeTienda.forEach(p => {
      const cat = p.categoria || 'General';
      mapa.set(cat, (mapa.get(cat) || 0) + 1);
    });
    return Array.from(mapa.entries());
  }, [productosPropiosDeTienda]);

  const puedeVerPrecios = localDueñoVitrina ? true : (user || config.catalogoPublicoPrecios);

  const productosFiltrados = productosPropiosDeTienda
    .filter(p => 
      (categoriaActiva === 'Todas' || (p.categoria || 'General') === categoriaActiva) &&
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

  if (cargando) return <div style={{ textAlign: 'center', padding: '80px', fontWeight: 'bold' }}>Cargando Tienda Oficial...</div>;

  return (
    <div style={{ padding: '25px', maxWidth: '1380px', margin: '0 auto', display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <div className="neon-card" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderLeft: '4px solid var(--neon-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '32px' }}>🛍️</div>
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>{nombreVitrina}</h2>
              <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>
                {localDueñoVitrina ? `Tienda Oficial del Local | 📍 ${direccionVitrina}` : `${config.eslogan} | 📍 ${direccionVitrina}`}
              </p>
            </div>
          </div>
        </div>

        {/* MENÚ INTERACTIVO DE CATEGORÍAS (ESTILO PÍLDORAS iOS 26.1) */}
        <div className="neon-card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
          <span className="label-neon">📂 Menú de Categorías (Solo Artículos Oficiales de {nombreVitrina}):</span>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', marginTop: '8px' }}>
            <button 
              onClick={() => setCategoriaActiva('Todas')} 
              className={`neon-btn ${categoriaActiva === 'Todas' ? 'neon-btn-fillCyan' : ''}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              ✨ Todas ({productosPropiosDeTienda.length})
            </button>
            {categoriasConConteo.map(([cat, count]) => (
              <button 
                key={cat} 
                onClick={() => setCategoriaActiva(cat)} 
                className={`neon-btn ${categoriaActiva === cat ? 'neon-btn-fillCyan' : ''}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {cat} ({count})
              </button>
            ))}
          </div>
          <div style={{ marginTop: '12px' }}>
            <input type="text" className="neon-input" placeholder={`🔍 Buscar dentro de ${categoriaActiva === 'Todas' ? 'toda la tienda' : categoriaActiva}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
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
                  <div style={{ height: '135px', background: 'var(--bg-input)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(128,128,128,0.12)' }}>
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
                    <div style={{ borderTop: '1px solid rgba(128,128,128,0.15)', paddingTop: '10px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <Link to="/admin-login" style={{ color: 'var(--neon-cyan)' }}>🔒 Inicia sesión para ver precios</Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {productosFiltrados.length === 0 && (
            <div className="neon-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay artículos propios publicados en esta categoría todavía.
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