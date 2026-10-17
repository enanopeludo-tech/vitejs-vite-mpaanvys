import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, addDoc, serverTimestamp, query, onSnapshot, getDocs, where,
  doc, updateDoc, deleteDoc, arrayUnion, setDoc, writeBatch 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 

// --- Configuración por defecto ERP Pro ---
const CONFIG_DEFAULT = {
  empresaNombre: "WALABBA TECNO",
  eslogan: "Laboratorio de Microelectrónica & Repuestos B2B",
  cuit: "20-35441122-3",
  direccion: "Av. 42 3998 - Necochea",
  horariosAtencion: "Lun a Vie 9:00 a 18:00 hs | Sáb 9:00 a 13:00 hs",
  whatsapp: "5492262619735",
  instagram: "@walabbatecno",
  logoUrl: "",
  monedaSimbolo: "$",
  cotizacionDolar: 1200,
  margenGanancia: 30,
  ivaPorcentaje: 21,
  recargoTarjetaPorcentaje: 15,
  descuentoEfectivoPorcentaje: 10,
  redondeoPrecios: "100",
  stockCriticoAlerta: 3,
  compraMinima: 0,
  envioLocalCosto: 0,
  envioGratisDesde: 50000,
  aliasTransferencia: "walabba.tecno.mp",
  bancoTitular: "Jose Luis Sena - Mercado Pago",
  linkMercadoPago: "",
  catalogoPublicoPrecios: false,
  garantiaDiasDefault: 30,
  costoDiagnosticoBase: 5000,
  sectoresTaller: "Laboratorio Microelectrónica, Módulos y Baterías, Software y Desbloqueos, Tercerizado",
  ticketEncabezado: "Av. 42 3998 - Necochea\nWhatsApp: 2262619735",
  ticketLeyenda: "Use el código o escanee el QR para seguir su reparación en vivo. Pasados los 90 días el equipo se considerará abandonado según Art. 2525 CCyC. La garantía cubre únicamente la mano de obra y repuesto de la falla reparada, no cubre equipos mojados, golpeados o manipulados por terceros.",
  promoPlantillaCRM: "Hola {nombre}! En *{empresa}* tenemos promos exclusivas esta semana en cargadores carga rápida, hidrogel antishock y limpieza de puerto. ¡Presentando este mensaje tenés 15% OFF!"
};

const CHECKLIST_ITEMS = [
  "Enciende", "Imagen / Display OK", "Táctil Funcional", "Pin de Carga OK", 
  "Batería Presente", "Cámaras OK", "Audio / Micrófono", "WiFi / Señal", 
  "Con Bandeja SIM", "Con Tarjeta SD", "Con Funda", "Rastros de Humedad"
];

// --- ESTILOS NEON CYBERPUNK ---
const NEON_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

  :root {
    --bg-dark: #070a12;
    --bg-card: #0f1626;
    --bg-input: #090d16;
    --neon-cyan: #00f3ff;
    --neon-pink: #ff00ff;
    --neon-green: #00ff9d;
    --neon-purple: #b537f2;
    --neon-yellow: #ffee00;
    --neon-red: #ff0055;
    --text-main: #e2e8f0;
    --text-muted: #8b9bb4;
  }

  body {
    background-color: var(--bg-dark);
    color: var(--text-main);
    font-family: 'Rajdhani', sans-serif;
    font-size: 16px;
    margin: 0;
    padding: 0;
    background-image: 
      radial-gradient(circle at 10% 20%, rgba(0, 243, 255, 0.05), transparent 25%),
      radial-gradient(circle at 90% 80%, rgba(255, 0, 255, 0.04), transparent 25%);
  }

  h1, h2, h3, h4, .neon-title {
    font-family: 'Orbitron', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .neon-card {
    background: rgba(15, 22, 38, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 243, 255, 0.25);
    border-radius: 12px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 243, 255, 0.05);
    padding: 20px;
    transition: all 0.25s ease;
  }

  .neon-card-pink { border-color: rgba(255, 0, 255, 0.35); box-shadow: 0 0 15px rgba(255, 0, 255, 0.08); }
  .neon-card-green { border-color: rgba(0, 255, 157, 0.35); box-shadow: 0 0 15px rgba(0, 255, 157, 0.08); }
  .neon-card-purple { border-color: rgba(181, 55, 242, 0.35); box-shadow: 0 0 15px rgba(181, 55, 242, 0.08); }

  .neon-input, .neon-select, .neon-textarea {
    background: var(--bg-input);
    border: 1px solid rgba(0, 243, 255, 0.3);
    color: var(--text-main);
    padding: 10px 13px;
    border-radius: 8px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 15px;
    font-weight: 500;
    width: 100%;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .neon-input:focus, .neon-select:focus, .neon-textarea:focus {
    outline: none;
    border-color: var(--neon-cyan);
    box-shadow: 0 0 12px rgba(0, 243, 255, 0.4);
  }

  .neon-btn {
    background: transparent;
    border: 1px solid var(--neon-cyan);
    color: var(--neon-cyan);
    padding: 9px 15px;
    border-radius: 8px;
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .neon-btn:hover:not(:disabled) {
    background: var(--neon-cyan);
    color: #000;
    box-shadow: 0 0 18px var(--neon-cyan);
  }

  .neon-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #555; color: #777; }

  .neon-btn-fillCyan { background: linear-gradient(90deg, #00c6ff, #0072ff); border: 1px solid var(--neon-cyan); color: #fff; }
  .neon-btn-fillCyan:hover:not(:disabled) { background: var(--neon-cyan); color: #000; box-shadow: 0 0 22px var(--neon-cyan); }

  .neon-btn-green { border-color: var(--neon-green); color: var(--neon-green); }
  .neon-btn-green:hover:not(:disabled) { background: var(--neon-green); color: #000; box-shadow: 0 0 18px var(--neon-green); }

  .neon-btn-pink { border-color: var(--neon-pink); color: var(--neon-pink); }
  .neon-btn-pink:hover:not(:disabled) { background: var(--neon-pink); color: #000; box-shadow: 0 0 18px var(--neon-pink); }

  .neon-btn-purple { border-color: var(--neon-purple); color: var(--neon-purple); }
  .neon-btn-purple:hover:not(:disabled) { background: var(--neon-purple); color: #fff; box-shadow: 0 0 18px var(--neon-purple); }

  .neon-btn-red { border-color: var(--neon-red); color: var(--neon-red); }
  .neon-btn-red:hover:not(:disabled) { background: var(--neon-red); color: #fff; box-shadow: 0 0 18px var(--neon-red); }

  .neon-table { width: 100%; border-collapse: collapse; font-size: 15px; }
  .neon-table th { background: rgba(0, 243, 255, 0.1); color: var(--neon-cyan); font-family: 'Orbitron', sans-serif; font-size: 11px; padding: 12px; text-align: left; border-bottom: 2px solid rgba(0, 243, 255, 0.4); }
  .neon-table td { padding: 11px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .neon-table tr:hover td { background: rgba(0, 243, 255, 0.03); }

  .neon-badge { padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; font-family: 'Orbitron', sans-serif; text-transform: uppercase; display: inline-block; }

  .glow-text-cyan { color: var(--neon-cyan); text-shadow: 0 0 10px rgba(0, 243, 255, 0.6); }
  .glow-text-green { color: var(--neon-green); text-shadow: 0 0 10px rgba(0, 255, 157, 0.6); }
  .glow-text-pink { color: var(--neon-pink); text-shadow: 0 0 10px rgba(255, 0, 255, 0.6); }
  .glow-text-red { color: var(--neon-red); text-shadow: 0 0 10px rgba(255, 0, 85, 0.6); }

  .label-neon { display: block; font-size: 11px; font-weight: 700; color: var(--neon-cyan); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
`;

const aplicarRedondeo = (valor: number, multiploStr: string) => {
  const multiplo = Number(multiploStr) || 1;
  if (multiplo <= 1) return Math.round(valor);
  return Math.ceil(valor / multiplo) * multiplo;
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
  const puedeVerPrecios = user || config.catalogoPublicoPrecios;

  const productosFiltrados = productos
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
    if (totalCarrito < config.compraMinima) return alert(`Mínimo de compra: ${config.monedaSimbolo}${config.compraMinima}`);
    setProcesando(true);
    try {
      const docRef = await addDoc(collection(db, 'pedidos_ecommerce'), {
        cliente: formCheckout, items: carrito, subtotal: totalCarrito, costoEnvio: costoEnvioActual, total: totalFinal,
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

  if (cargando) return <div style={{ textAlign: 'center', padding: '80px', color: '#00f3ff', fontFamily: 'Orbitron' }}>⚡ CARGANDO CATÁLOGO B2B...</div>;

  return (
    <div style={{ padding: '25px', maxWidth: '1350px', margin: '0 auto', display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <div className="neon-card" style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderLeft: '4px solid #00f3ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {config.logoUrl ? <img src={config.logoUrl} alt="Logo" style={{ height: '55px', borderRadius: '8px' }} /> : <div style={{ fontSize: '32px' }}>⚡</div>}
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>{config.empresaNombre}</h2>
              <p style={{ margin: '3px 0 0 0', color: '#8b9bb4', fontSize: '14px' }}>{config.eslogan} | 📍 {config.direccion}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: '#8b9bb4' }}>
            <div>🕒 {config.horariosAtencion}</div>
            {config.cotizacionDolar > 0 && <div style={{ color: '#00ff9d', fontWeight: 'bold' }}>💵 Dólar Ref: ${config.cotizacionDolar}</div>}
          </div>
        </div>

        {!puedeVerPrecios && (
          <div className="neon-card neon-card-pink" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#ff99ff', fontWeight: 600 }}>🔒 Catálogo exclusivo gremio. Inicia sesión para ver precios mayoristas y operar.</span>
            <Link to="/admin-login" className="neon-btn neon-btn-pink" style={{ textDecoration: 'none' }}>Ingresar</Link>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input type="text" className="neon-input" placeholder="🔍 Buscar repuesto por modelo, marca o código..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: '2 1 280px' }} />
          <select className="neon-select" value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} style={{ flex: '1 1 180px' }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))', gap: '18px' }}>
          {productosFiltrados.map(prod => (
            <div key={prod.idBaseDatos} className="neon-card" style={{ border: prod.destacado && prod.stock > 0 ? '1px solid #ffee00' : undefined, position: 'relative', opacity: prod.stock === 0 ? 0.55 : 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {prod.destacado && prod.stock > 0 && (
                  <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#ffee00', color: '#000', padding: '2px 9px', borderRadius: '20px', fontWeight: 900, fontSize: '10px', fontFamily: 'Orbitron' }}>⚡ OFERTA</div>
                )}
                <div style={{ height: '130px', background: '#070a12', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {prod.imagenUrl ? <img src={prod.imagenUrl} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="prod" /> : <span style={{ fontSize: '32px', opacity: 0.3 }}>📦</span>}
                </div>
                <span className="neon-badge" style={{ background: 'rgba(0,243,255,0.1)', color: '#00f3ff', border: '1px solid rgba(0,243,255,0.3)', marginBottom: '6px' }}>{prod.categoria || 'General'}</span>
                <h4 style={{ margin: '6px 0 4px 0', fontSize: '15px', color: '#fff' }}>{prod.nombre}</h4>
                <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '0 0 10px 0' }}>{prod.descripcion}</p>
              </div>
              <div>
                <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                  {prod.stock === 0 ? <span className="glow-text-red">● AGOTADO</span> : prod.stock <= config.stockCriticoAlerta ? <span style={{ color: '#ffee00' }}>⚠️ ÚLTIMOS {prod.stock}</span> : <span className="glow-text-green">● EN STOCK ({prod.stock})</span>}
                </div>
                {puedeVerPrecios ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                    <b className="glow-text-cyan" style={{ fontSize: '20px', fontFamily: 'Orbitron' }}>${prod.precio?.toLocaleString()}</b>
                    <button onClick={() => agregarAlCarrito(prod)} disabled={prod.stock <= 0} className="neon-btn neon-btn-fillCyan">
                      {prod.stock > 0 ? '+ Sumar' : 'Sin Stock'}
                    </button>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', textAlign: 'center', fontSize: '12px', color: '#8b9bb4' }}>🔒 Precio oculto</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {puedeVerPrecios && (carrito.length > 0 || pedidoRealizado) && (
        <div style={{ flex: '1 1 30%', minWidth: '320px' }}>
          {pedidoRealizado ? (
            <div className="neon-card neon-card-green" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-green" style={{ margin: '0 0 10px 0' }}>✅ ¡PEDIDO CONFIRMADO!</h3>
              <p style={{ margin: '0 0 15px 0', color: '#8b9bb4' }}>Orden: <b style={{ color: '#fff' }}>#{pedidoRealizado.id.slice(-6).toUpperCase()}</b></p>
              <div style={{ background: '#070a12', padding: '15px', borderRadius: '8px', border: '1px solid rgba(0,255,157,0.3)', marginBottom: '20px' }}>
                <div className="glow-text-green" style={{ fontSize: '26px', fontFamily: 'Orbitron' }}>${pedidoRealizado.total.toLocaleString()}</div>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}><b>Alias:</b> {config.aliasTransferencia}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#8b9bb4' }}>{config.bancoTitular}</p>
                {config.linkMercadoPago && (
                  <a href={config.linkMercadoPago} target="_blank" rel="noreferrer" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', marginTop: '12px', textDecoration: 'none', boxSizing: 'border-box' }}>
                    💳 Pagar con Mercado Pago
                  </a>
                )}
              </div>
              <button onClick={() => window.open(`https://wa.me/${config.whatsapp}?text=Hola,%20confirmo%20pedido%20B2B%20%23${pedidoRealizado.id.slice(-6).toUpperCase()}%20por%20$${pedidoRealizado.total}`, '_blank')} className="neon-btn neon-btn-green" style={{ width: '100%' }}>
                💬 Enviar Comprobante por WhatsApp
              </button>
            </div>
          ) : modoCheckout ? (
            <div className="neon-card" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-cyan" style={{ margin: '0 0 20px 0' }}>📝 FINALIZAR PEDIDO</h3>
              <form onSubmit={confirmarPedido} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label className="label-neon">Razón Social / Taller</label><input type="text" className="neon-input" required value={formCheckout.nombre} onChange={e=>setFormCheckout({...formCheckout, nombre: e.target.value})} /></div>
                <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" required value={formCheckout.telefono} onChange={e=>setFormCheckout({...formCheckout, telefono: e.target.value})} /></div>
                <div>
                  <label className="label-neon">Entrega</label>
                  <select className="neon-select" value={formCheckout.metodoEnvio} onChange={e=>setFormCheckout({...formCheckout, metodoEnvio: e.target.value})}>
                    <option value="retiro">Retiro Local - Gratis</option>
                    <option value="domicilio">Cadetería (${costoEnvioActual})</option>
                  </select>
                </div>
                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>Confirmar Orden</button>
                <button type="button" onClick={() => setModoCheckout(false)} className="neon-btn" style={{ width: '100%', border: 'none' }}>Volver</button>
              </form>
            </div>
          ) : (
            <div className="neon-card" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-cyan" style={{ margin: '0 0 15px 0' }}>🛒 CARRITO ({carrito.length})</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {carrito.map(item => (
                  <div key={item.idBaseDatos} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 0' }}>
                    <div><b>{item.cantidad}x {item.nombre}</b><br/><span style={{ color: '#00f3ff' }}>${(item.precio * item.cantidad).toLocaleString()}</span></div>
                    <button onClick={() => setCarrito(carrito.filter(i => i.idBaseDatos !== item.idBaseDatos))} className="neon-btn neon-btn-red" style={{ padding: '2px 6px' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', fontSize: '18px' }}>
                <span>TOTAL:</span><b className="glow-text-green">${totalCarrito.toLocaleString()}</b>
              </div>
              <button onClick={() => setModoCheckout(true)} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>Iniciar Pago Seguro ➔</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ========================================================
// 2. SEGUIMIENTO PÚBLICO (SOPORTA ?codigo= DESDE QR)
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
        <h2 className="glow-text-cyan">🔍 SEGUIMIENTO EN TIEMPO REAL</h2>
        <p style={{ color: '#8b9bb4', marginBottom: '20px' }}>Ingresa el código de tu orden o escanea el QR de tu comprobante</p>
        <form onSubmit={buscar} style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
          <input type="text" className="neon-input" placeholder="CÓDIGO (EJ: X9B2V)" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ textAlign: 'center', fontFamily: 'Orbitron', letterSpacing: '3px', fontSize: '18px' }} maxLength={6}/>
          <button type="submit" className="neon-btn neon-btn-fillCyan">Consultar</button>
        </form>
      </div>

      {resultado && (
        <div className="neon-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>{resultado.equipo.marca} {resultado.equipo.modelo}</h3>
            <span className="neon-badge" style={{ background: 'rgba(0,243,255,0.15)', color: '#00f3ff', border: '1px solid #00f3ff' }}>#{resultado.codigoSeguimiento}</span>
          </div>
          <p style={{ marginTop: '12px' }}><b>Falla ingresada:</b> {resultado.fallaDeclarada}</p>
          <div style={{ background: '#070a12', padding: '18px', borderRadius: '8px', textAlign: 'center', margin: '18px 0', border: '1px solid #00f3ff' }}>
            <span style={{ fontSize: '11px', color: '#8b9bb4', fontFamily: 'Orbitron' }}>ESTADO EN LABORATORIO</span>
            <h2 className="glow-text-cyan" style={{ margin: '6px 0 0 0', textTransform: 'uppercase' }}>{resultado.estado}</h2>
            {resultado.costoReparacion && <h3 className="glow-text-green" style={{ margin: '10px 0 0 0' }}>Importe Final: ${resultado.costoReparacion}</h3>}
          </div>
          <h4 className="glow-text-cyan" style={{ fontSize: '13px' }}>📋 HISTORIAL TÉCNICO:</h4>
          <div style={{ borderLeft: '2px solid #00f3ff', paddingLeft: '15px', marginLeft: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {resultado.historial?.map((h:any, i:number) => (
              <div key={i}>
                <b style={{ color: '#00f3ff', textTransform: 'uppercase', fontSize: '12px', fontFamily: 'Orbitron' }}>{h.estado}</b>
                <div style={{ color: '#fff', fontSize: '15px' }}>{h.comentario}</div>
                <div style={{ fontSize: '11px', color: '#8b9bb4' }}>🕒 {h.fecha}</div>
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
    <div style={{ padding: '80px 20px', maxWidth: '380px', margin: '0 auto' }}>
      <div className="neon-card" style={{ textAlign: 'center' }}>
        <h2 className="glow-text-cyan">🔐 ACCESO ERP</h2>
        <form onSubmit={async (ev) => { ev.preventDefault(); try { await signInWithEmailAndPassword(auth, e, p); navigate('/admin-panel'); } catch (err) { alert('Credenciales incorrectas'); } }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <input type="email" className="neon-input" placeholder="Email" value={e} onChange={ex => setE(ex.target.value)} required/>
          <input type="password" className="neon-input" placeholder="Contraseña" value={p} onChange={ex => setP(ex.target.value)} required/>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '12px' }}>Entrar al Sistema ➔</button>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 4. PANEL ERP INDUSTRIAL (WALABBA TECNO)
// ========================================================
const DashboardTaller = ({ user }: { user: User }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidosWeb, setPedidosWeb] = useState<any[]>([]); 
  const [movimientosFinanzas, setMovimientosFinanzas] = useState<any[]>([]); 
  const [usuariosRoles, setUsuariosRoles] = useState<any[]>([]);
  const [pestaña, setPestaña] = useState('taller'); 

  // --- CRM Taller & Recepción Profesional ---
  const [cliNombre, setCliNombre] = useState(''); const [cliTel, setCliTel] = useState(''); const [cliDni, setCliDni] = useState('');
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [tecnico, setTecnico] = useState('');
  const [imei, setImei] = useState(''); const [contrasena, setContrasena] = useState('');
  const [condicionVisual, setCondicionVisual] = useState('');
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería Presente"]);

  // Filtros de Taller
  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroSectorTaller, setFiltroSectorTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');
  const [fechaDesdeTaller, setFechaDesdeTaller] = useState('');
  const [fechaHastaTaller, setFechaHastaTaller] = useState('');

  // --- Catálogo, Ubicación en Pañol y Filtros ---
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [prodNom, setProdNom] = useState(''); const [prodCat, setProdCat] = useState('');
  const [prodCosto, setProdCosto] = useState(''); 
  const [prodPrecio, setProdPrecio] = useState(''); const [prodStock, setProdStock] = useState('');
  const [prodUbicacion, setProdUbicacion] = useState(''); 
  const [prodDesc, setProdDesc] = useState(''); const [prodImg, setProdImg] = useState('');
  const [prodCodigoBarras, setProdCodigoBarras] = useState('');
  const [prodProveedor, setProdProveedor] = useState('');
  const [prodDestacado, setProdDestacado] = useState(false);
  const [prodUrlProveedor, setProdUrlProveedor] = useState(''); 
  
  // Filtros de Inventario
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [filtroCategoriaInv, setFiltroCategoriaInv] = useState('Todas');
  const [filtroProveedorInv, setFiltroProveedorInv] = useState('Todos');
  const [filtroStockInv, setFiltroStockInv] = useState('todos'); 
  const [escaneandoPara, setEscaneandoPara] = useState<'formulario' | 'buscador' | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

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

  // --- Finanzas & Filtros Avanzados ---
  const [finTipo, setFinTipo] = useState('ingreso'); const [finConcepto, setFinConcepto] = useState('');
  const [finMonto, setFinMonto] = useState(''); const [finMetodo, setFinMetodo] = useState('efectivo');
  const [filtroTiempo, setFiltroTiempo] = useState('todos'); 
  const [filtroTipoLista, setFiltroTipoLista] = useState('todos'); 
  const [filtroMetodoLista, setFiltroMetodoLista] = useState('todos');
  const [filtroFacturado, setFiltroFacturado] = useState('todos');
  const [filtroBusquedaConcepto, setFiltroBusquedaConcepto] = useState('');
  const [fechaDesdeFin, setFechaDesdeFin] = useState('');
  const [fechaHastaFin, setFechaHastaFin] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  // --- CRM Clientes & Marketing ---
  const [busquedaClienteCRM, setBusquedaClienteCRM] = useState('');
  const [mensajePromoCRM, setMensajePromoCRM] = useState(CONFIG_DEFAULT.promoPlantillaCRM);

  // --- Gestión de Usuarios / Roles ---
  const [nuevoUserEmail, setNuevoUserEmail] = useState('');
  const [nuevoUserNombre, setNuevoUserNombre] = useState('');
  const [nuevoUserRol, setNuevoUserRol] = useState<'admin' | 'tecnico' | 'vendedor'>('tecnico');

  const [conf, setConf] = useState<any>(CONFIG_DEFAULT);

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
    return () => { unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); unsubFinanzas(); unsubRoles(); };
  }, []);

  const registroRolActual = usuariosRoles.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
  const rolActual: 'admin' | 'tecnico' | 'vendedor' = registroRolActual ? registroRolActual.rol : 'admin';

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
    if (!window.confirm(`¿Importar desde "${hojaActiva}" para el proveedor "${nombreProveedorExcel}"?`)) return;
    
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
          
          const productoExistente = productos.find(p => p.nombre.toLowerCase() === nombreFinal.toLowerCase());
          if (productoExistente) {
            batch.update(doc(db, 'productos', productoExistente.id), { costoProveedor: costoEnPesos, precio: precioFinalRedondeado, proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
            actualizados++;
          } else {
            batch.set(doc(collection(db, 'productos')), { nombre: nombreFinal, categoria: hojaActiva, costoProveedor: costoEnPesos, precio: precioFinalRedondeado, stock: 0, descripcion: 'Importado de lista', fecha: serverTimestamp(), ventas: 0, proveedor: nombreProveedorExcel, ultimaActualizacion: fechaActualizacion });
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

  const toggleItemChecklist = (item: string) => {
    setChecklist(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid, 
      cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni }, 
      equipo: { marca, modelo, imei, contrasena, condicionVisual, checklist }, 
      fallaDeclarada: falla, 
      tecnicoAsignado: tecnico,
      costoReparacion: presupuestoInicial || '',
      seña: Number(señaRecibida) || 0,
      estado: 'ingresado', 
      codigoSeguimiento: cod, 
      fechaIngreso: serverTimestamp(), 
      historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: 'Equipo recepcionado en mostrador.' }]
    });

    if (Number(señaRecibida) > 0) {
      await addDoc(collection(db, 'finanzas'), {
        tipo: 'ingreso',
        concepto: `Seña Orden #${cod} - ${cliNombre} (${marca} ${modelo})`,
        monto: Number(señaRecibida),
        metodoPago: 'efectivo',
        fecha: serverTimestamp(),
        usuario: user.email
      });
    }

    setCliNombre(''); setCliTel(''); setCliDni(''); setMarca(''); setModelo(''); setFalla(''); setTecnico(''); setImei(''); setContrasena(''); setCondicionVisual(''); setPresupuestoInicial(''); setSeñaRecibida('');
    alert(`⚡ Orden generada con éxito. Código: #${cod}`);
  };

  const actualizarEstado = async (id: string, nuevoEstado: string, orden: any) => {
    const comentario = prompt(`Diagnóstico / Comentario para estado '${nuevoEstado}':`) || 'Actualización técnica';
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };
    if (nuevoEstado === 'reparado') { 
      const costo = prompt('Confirma el Costo Total de la reparación ($):', orden.costoReparacion || ''); 
      if(costo) data.costoReparacion = costo; 
    }
    if (nuevoEstado === 'entregado' && orden.costoReparacion) {
      const saldoRestante = Math.max(0, Number(orden.costoReparacion) - Number(orden.seña || 0));
      if (saldoRestante > 0 && window.confirm(`¿Registrar cobro del saldo restante ($${saldoRestante}) en Caja?`)) {
        const metodo = prompt('Método de pago (efectivo, transferencia, mercadopago, tarjeta):', 'efectivo') || 'efectivo';
        await addDoc(collection(db, 'finanzas'), {
          tipo: 'ingreso',
          concepto: `Cobro Taller Orden #${orden.codigoSeguimiento} - ${orden.equipo?.marca} ${orden.equipo?.modelo}`,
          monto: saldoRestante,
          metodoPago: metodo.toLowerCase(),
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const generarRecomendaciones = (fallaStr: string) => {
    const f = fallaStr.toLowerCase();
    if (f.includes('bateria') || f.includes('carga') || f.includes('pin')) {
      return "\n\n💡 *Recomendación Técnica:* Para proteger la nueva etapa de carga, sugerimos acompañar con un *Cable USB Certificado* o *Cargador Original*. ¡Consultanos!";
    }
    if (f.includes('pantalla') || f.includes('modulo') || f.includes('vidrio')) {
      return "\n\n💡 *Recomendación Técnica:* ¡Protegé tu pantalla nueva! Te sugerimos colocar un *Film Hidrogel Antishock* o *Funda Reforzada* antes de retirarlo.";
    }
    return `\n\n💡 *Garantía:* Contás con ${config.garantiaDiasDefault} días de garantía escrita y promos en accesorios.`;
  };

  const notificarClienteWhatsApp = (orden: any) => {
    const urlBase = window.location.origin;
    const saldo = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    let msg = `Hola ${orden.cliente.nombre}, te escribimos de *${config.empresaNombre}*.\n`;
    msg += `Tu equipo *${orden.equipo.marca} ${orden.equipo.modelo}* (Orden #${orden.codigoSeguimiento}) cambió al estado: *${orden.estado.toUpperCase()}*.\n`;
    if (orden.historial?.length > 0) msg += `📝 *Informe:* ${orden.historial[orden.historial.length - 1].comentario}\n`;
    if (orden.costoReparacion) msg += `💰 *Total:* $${orden.costoReparacion} ${orden.seña ? `(Seña: $${orden.seña} | Saldo a abonar: $${saldo})` : ''}\n`;
    msg += `\n🔍 Seguimiento en vivo: ${urlBase}/seguimiento?codigo=${orden.codigoSeguimiento}`;
    msg += generarRecomendaciones(orden.fallaDeclarada);
    window.open(`https://wa.me/549${orden.cliente.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const imprimirOrdenProfesional = (orden: any) => {
    const v = window.open('', '_blank');
    if(!v) return;
    const urlSeguimiento = `${window.location.origin}/seguimiento?codigo=${orden.codigoSeguimiento}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(urlSeguimiento)}`;
    const fechaFormateada = orden.fechaIngreso ? new Date(orden.fechaIngreso.seconds * 1000).toLocaleString() : new Date().toLocaleString();
    const saldoPendiente = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    const itemsCheck = orden.equipo?.checklist || [];

    v.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden #${orden.codigoSeguimiento} - ${config.empresaNombre}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 15px; background: #f0f2f5; }
            .toolbar { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; max-width: 820px; margin-left: auto; margin-right: auto; }
            .btn-print { background: #00f3ff; color: #000; border: none; padding: 8px 16px; border-radius: 5px; font-weight: bold; cursor: pointer; margin-left: 8px; }
            .btn-mode { background: #333; color: #fff; border: 1px solid #555; padding: 8px 14px; border-radius: 5px; cursor: pointer; margin-right: 6px; }
            .btn-mode.active { background: #00ff9d; color: #000; font-weight: bold; border-color: #00ff9d; }
            
            /* CONTENEDOR A4 */
            .page-a4 { background: #fff; max-width: 820px; margin: 0 auto; padding: 25px; border: 1px solid #ccc; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header-a4 { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 15px; }
            .brand-title { font-size: 24px; font-weight: 900; margin: 0; letter-spacing: 1px; }
            .order-box { text-align: right; border: 2px solid #111; padding: 8px 14px; border-radius: 6px; background: #f8f9fa; }
            .order-code { font-size: 24px; font-weight: 900; font-family: monospace; letter-spacing: 2px; }
            
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
            .panel { border: 1px solid #444; border-radius: 6px; padding: 10px 12px; }
            .panel-title { font-size: 11px; font-weight: 800; text-transform: uppercase; background: #111; color: #fff; padding: 4px 8px; margin: -10px -12px 8px -12px; border-top-left-radius: 4px; border-top-right-radius: 4px; }
            .row-data { font-size: 13px; margin: 4px 0; }
            
            .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; margin-top: 6px; }
            .check-item { display: flex; align-items: center; gap: 4px; }
            .box-mark { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 11px; font-size: 10px; font-weight: bold; }

            .fin-bar { display: flex; justify-content: space-between; background: #eee; border: 1px solid #333; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: bold; margin: 12px 0; }
            .legal-text { font-size: 9.5px; color: #333; text-align: justify; line-height: 1.35; border: 1px dashed #777; padding: 8px; border-radius: 4px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 32px; }
            .sig-line { width: 42%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 11px; font-weight: bold; }

            .cut-line { border-top: 2px dashed #000; margin: 22px 0; position: relative; text-align: center; }
            .cut-line span { background: #fff; padding: 0 10px; position: relative; top: -10px; font-size: 11px; font-weight: bold; }

            /* CONTENEDOR TÉRMICO 80MM */
            .page-thermal { display: none; background: #fff; width: 310px; margin: 0 auto; padding: 15px; border: 1px solid #ccc; font-family: monospace; text-align: center; }

            @media print {
              body { background: #fff; padding: 0; }
              .toolbar { display: none !important; }
              .page-a4, .page-thermal { border: none; box-shadow: none; margin: 0; width: 100%; max-width: 100%; }
            }
          </style>
          <script>
            function cambiarFormato(modo) {
              document.getElementById('vista-a4').style.display = modo === 'a4' ? 'block' : 'none';
              document.getElementById('vista-thermal').style.display = modo === 'thermal' ? 'block' : 'none';
              document.getElementById('btn-a4').className = modo === 'a4' ? 'btn-mode active' : 'btn-mode';
              document.getElementById('btn-thermal').className = modo === 'thermal' ? 'btn-mode active' : 'btn-mode';
            }
          </script>
        </head>
        <body>
          <div class="toolbar">
            <div>
              <button id="btn-a4" class="btn-mode active" onclick="cambiarFormato('a4')">📄 Formato Hoja A4 (Con Talón Cliente)</button>
              <button id="btn-thermal" class="btn-mode" onclick="cambiarFormato('thermal')">🧾 Formato Ticket Térmico 80mm</button>
            </div>
            <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR AHORA</button>
          </div>

          <!-- VISTA 1: HOJA A4 PROFESIONAL CON TALÓN -->
          <div id="vista-a4" class="page-a4">
            <div class="header-a4">
              <div>
                <h1 class="brand-title">${config.empresaNombre}</h1>
                <div style="font-size:12px; font-weight:bold;">${config.eslogan}</div>
                <div style="font-size:11px;">📍 ${config.direccion} | WhatsApp: ${config.whatsapp} | CUIT: ${config.cuit}</div>
              </div>
              <div class="order-box">
                <div style="font-size:10px; font-weight:bold;">ORDEN DE LABORATORIO</div>
                <div class="order-code">#${orden.codigoSeguimiento}</div>
                <div style="font-size:10px;">Ingreso: ${fechaFormateada}</div>
              </div>
            </div>

            <div class="grid-2">
              <div class="panel">
                <div class="panel-title">👤 Datos del Cliente</div>
                <div class="row-data"><b>Cliente:</b> ${orden.cliente?.nombre}</div>
                <div class="row-data"><b>Teléfono / WhatsApp:</b> ${orden.cliente?.telefono}</div>
                <div class="row-data"><b>DNI / CUIT:</b> ${orden.cliente?.dni || 'No especificado'}</div>
              </div>
              <div class="panel">
                <div class="panel-title">📱 Identificación del Equipo</div>
                <div class="row-data"><b>Marca y Modelo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</div>
                <div class="row-data"><b>IMEI / N° Serie:</b> ${orden.equipo?.imei || 'S/D'}</div>
                <div class="row-data"><b>PIN / Patrón Desbloqueo:</b> <span style="font-family:monospace; font-weight:bold; background:#eee; padding:1px 6px;">${orden.equipo?.contrasena || 'Sin Clave'}</span></div>
                <div class="row-data"><b>Sector Asignado:</b> ${orden.tecnicoAsignado || 'Laboratorio General'}</div>
              </div>
            </div>

            <div class="panel" style="margin-bottom: 12px;">
              <div class="panel-title">🔬 Diagnóstico, Estética y Checklist de Recepción</div>
              <div class="row-data"><b>Falla Declarada por el Cliente:</b> ${orden.fallaDeclarada}</div>
              <div class="row-data"><b>Estado Estético Visual:</b> ${orden.equipo?.condicionVisual || 'Normal de uso'}</div>
              <div class="checklist-grid">
                ${CHECKLIST_ITEMS.map(it => `
                  <div class="check-item">
                    <span class="box-mark">${itemsCheck.includes(it) ? '✓' : ''}</span> ${it}
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="fin-bar">
              <span>PRESUPUESTO ESTIMADO: $${orden.costoReparacion || 'A confirmar'}</span>
              <span>SEÑA ABONADA: $${orden.seña || 0}</span>
              <span>SALDO PENDIENTE: $${orden.costoReparacion ? saldoPendiente : 'A confirmar'}</span>
            </div>

            <div class="legal-text">
              <b>CONDICIONES LEGALES Y GARANTÍA (${config.garantiaDiasDefault} DÍAS):</b> ${config.ticketLeyenda}
            </div>

            <div class="signatures">
              <div class="sig-line">Firma y Aclaración del Cliente (Conformidad)</div>
              <div class="sig-line">Por ${config.empresaNombre} (Recepción)</div>
            </div>

            <div class="cut-line"><span>✂️ CORTAR AQUÍ - COMPROBANTE PARA EL CLIENTE ✂️</span></div>

            <div style="display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; border-radius: 8px; padding: 15px;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 4px 0;">${config.empresaNombre} - COMPROBANTE DE RETIRO</h3>
                <div style="font-size: 12px; margin-bottom: 8px;">📍 ${config.direccion} | 🕒 ${config.horariosAtencion} | 📱 WhatsApp: ${config.whatsapp}</div>
                <div style="font-size: 13px;"><b>Cliente:</b> ${orden.cliente?.nombre} | <b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</div>
                <div style="font-size: 13px; margin: 4px 0;"><b>Falla:</b> ${orden.fallaDeclarada}</div>
                <div style="font-size: 14px; margin-top: 8px; background: #eee; padding: 6px 10px; display: inline-block; font-weight: bold;">
                  Presupuesto: $${orden.costoReparacion || 'A evaluar'} | Seña: $${orden.seña || 0} | Saldo: $${orden.costoReparacion ? saldoPendiente : '-'}
                </div>
              </div>
              <div style="text-align: center; padding-left: 15px; border-left: 1px dashed #999;">
                <div style="font-size: 10px; font-weight: bold;">CÓDIGO DE SEGUIMIENTO</div>
                <div style="font-size: 22px; font-weight: 900; font-family: monospace; margin: 2px 0;">#${orden.codigoSeguimiento}</div>
                <img src="${qrUrl}" alt="QR Seguimiento" style="width: 95px; height: 95px;" />
                <div style="font-size: 9px; max-width: 110px;">Escaneá el QR para ver el estado en vivo</div>
              </div>
            </div>
          </div>

          <!-- VISTA 2: TICKET TÉRMICO 80MM -->
          <div id="vista-thermal" class="page-thermal">
            <h2 style="margin:0; font-size: 20px;">${config.empresaNombre}</h2>
            <div style="font-size: 11px; margin-bottom: 8px;">${config.direccion}<br/>WhatsApp: ${config.whatsapp}</div>
            <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 8px 0;">
              <div style="font-size: 11px;">ORDEN DE SERVICIO</div>
              <div style="font-size: 26px; font-weight: bold; letter-spacing: 2px;">#${orden.codigoSeguimiento}</div>
              <div style="font-size: 10px;">${fechaFormateada}</div>
            </div>
            <div style="text-align: left; font-size: 12px; line-height: 1.4;">
              <div><b>Cliente:</b> ${orden.cliente?.nombre}</div>
              <div><b>Tel:</b> ${orden.cliente?.telefono}</div>
              <div><b>Equipo:</b> ${orden.equipo?.marca} ${orden.equipo?.modelo}</div>
              <div><b>IMEI:</b> ${orden.equipo?.imei || '-'}</div>
              <div><b>Falla:</b> ${orden.fallaDeclarada}</div>
              <div><b>Estética:</b> ${orden.equipo?.condicionVisual || 'Normal'}</div>
              <hr style="border: none; border-top: 1px dashed #000;"/>
              <div><b>Total Est.:</b> $${orden.costoReparacion || 'A evaluar'}</div>
              <div><b>Seña:</b> $${orden.seña || 0} | <b>Saldo:</b> $${orden.costoReparacion ? saldoPendiente : '-'}</div>
            </div>
            <div style="margin: 12px 0;">
              <img src="${qrUrl}" style="width: 120px; height: 120px;" />
              <div style="font-size: 10px; font-weight: bold;">Escaneá para seguir tu equipo</div>
            </div>
            <div style="font-size: 9px; text-align: justify; border-top: 1px solid #000; padding-top: 8px;">
              ${config.ticketLeyenda}
            </div>
          </div>
        </body>
      </html>
    `);
    v.document.close();
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const fechaActualizacion = new Date().toLocaleDateString();
    const dataProducto = { 
      nombre: prodNom, categoria: prodCat, precio: Number(prodPrecio), 
      costoProveedor: Number(prodCosto) || 0, stock: Number(prodStock), 
      ubicacion: prodUbicacion, descripcion: prodDesc, imagenUrl: prodImg, 
      urlProveedor: prodUrlProveedor, proveedor: prodProveedor, 
      ultimaActualizacion: fechaActualizacion, codigoBarras: prodCodigoBarras, destacado: prodDestacado 
    };
    if (idEditando) await updateDoc(doc(db, 'productos', idEditando), dataProducto);
    else await addDoc(collection(db, 'productos'), { ...dataProducto, ventas: 0, fecha: serverTimestamp() });
    limpiarFormularioProducto();
  };

  const limpiarFormularioProducto = () => {
    setIdEditando(null); setProdNom(''); setProdCat(''); setProdPrecio(''); setProdCosto(''); setProdStock(''); setProdUbicacion(''); setProdDesc(''); setProdImg(''); setProdCodigoBarras(''); setProdProveedor(''); setProdDestacado(false); setProdUrlProveedor('');
  };

  const calcularPrecioVenta = () => { 
    if (prodCosto) {
      const bruto = Number(prodCosto) + (Number(prodCosto) * (Number(config.margenGanancia) / 100));
      setProdPrecio(aplicarRedondeo(bruto, config.redondeoPrecios).toString()); 
    }
  };

  const actualizarStock = async (id: string, nuevoStock: number) => { if (nuevoStock >= 0) await updateDoc(doc(db, 'productos', id), { stock: nuevoStock }); };
  
  const registrarVentaDirecta = async (p: any) => { 
    if (p.stock <= 0) return alert('Sin stock');
    await updateDoc(doc(db, 'productos', p.id), { stock: p.stock - 1, ventas: (p.ventas || 0) + 1 }); 
    await addDoc(collection(db, 'finanzas'), { 
      tipo: 'ingreso', concepto: `Venta Mostrador: ${p.nombre}`, monto: Number(p.precio), costoAsociado: Number(p.costoProveedor || 0), metodoPago: 'efectivo', fecha: serverTimestamp(), usuario: user.email,
      items: [{ nombre: p.nombre, cantidad: 1, precio: p.precio }]
    });
    alert('⚡ Venta registrada en caja.');
  };

  const cargarProductoParaEdicion = (p: any) => {
    setIdEditando(p.id); setProdNom(p.nombre); setProdCat(p.categoria || ''); setProdPrecio(p.precio?.toString() || ''); setProdCosto(p.costoProveedor?.toString() || ''); setProdStock(p.stock?.toString() || ''); setProdUbicacion(p.ubicacion || ''); setProdDesc(p.descripcion || ''); setProdImg(p.imagenUrl || ''); setProdCodigoBarras(p.codigoBarras || ''); setProdProveedor(p.proveedor || ''); setProdDestacado(p.destacado || false); setProdUrlProveedor(p.urlProveedor || ''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const pedirFaltantes = () => {
    const faltantes = productos.filter(p => p.stock <= config.stockCriticoAlerta);
    if (faltantes.length === 0) return alert('No hay faltantes.');
    let msg = `Hola! Reponer para *${config.empresaNombre}*:\n\n`; faltantes.forEach(p => { msg += `▪️ ${p.stock === 0 ? 5 : 3}x ${p.nombre}\n`; }); 
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroEstadoTaller !== 'todos' && o.estado !== filtroEstadoTaller) return false;
    if (filtroSectorTaller !== 'todos' && o.tecnicoAsignado !== filtroSectorTaller) return false;
    if (busquedaTaller) {
      const b = busquedaTaller.toLowerCase();
      const match = o.codigoSeguimiento?.toLowerCase().includes(b) ||
                    o.cliente?.nombre?.toLowerCase().includes(b) ||
                    o.cliente?.telefono?.includes(b) ||
                    o.equipo?.marca?.toLowerCase().includes(b) ||
                    o.equipo?.modelo?.toLowerCase().includes(b) ||
                    o.equipo?.imei?.toLowerCase().includes(b);
      if (!match) return false;
    }
    if (fechaDesdeTaller && o.fechaIngreso) {
      const fOrd = new Date(o.fechaIngreso.seconds * 1000);
      if (fOrd < new Date(fechaDesdeTaller + 'T00:00:00')) return false;
    }
    if (fechaHastaTaller && o.fechaIngreso) {
      const fOrd = new Date(o.fechaIngreso.seconds * 1000);
      if (fOrd > new Date(fechaHastaTaller + 'T23:59:59')) return false;
    }
    return true;
  });

  const categoriasUnicasInv = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria || 'General')))];
  const proveedoresUnicosInv = ['Todos', ...Array.from(new Set(productos.map(p => p.proveedor).filter(Boolean)))];

  const inventarioFiltrado = productos.filter(p => {
    if (filtroCategoriaInv !== 'Todas' && (p.categoria || 'General') !== filtroCategoriaInv) return false;
    if (filtroProveedorInv !== 'Todos' && p.proveedor !== filtroProveedorInv) return false;
    if (filtroStockInv === 'critico' && (p.stock > config.stockCriticoAlerta || p.stock === 0)) return false;
    if (filtroStockInv === 'agotado' && p.stock > 0) return false;
    if (busquedaInventario) {
      const b = busquedaInventario.toLowerCase();
      const match = p.nombre.toLowerCase().includes(b) || 
                    (p.codigoBarras && p.codigoBarras.includes(b)) || 
                    (p.ubicacion && p.ubicacion.toLowerCase().includes(b)) ||
                    (p.proveedor && p.proveedor.toLowerCase().includes(b));
      if (!match) return false;
    }
    return true;
  });

  const toggleSeleccion = (id: string) => { setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const toggleTodos = () => { if (seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0) setSeleccionados([]); else setSeleccionados(inventarioFiltrado.map(p => p.id)); };

  const eliminarSeleccionados = async () => {
    if (!window.confirm(`¿Eliminar ${seleccionados.length} productos?`)) return;
    const batch = writeBatch(db); seleccionados.forEach(id => { batch.delete(doc(db, 'productos', id)); });
    await batch.commit(); setSeleccionados([]);
  };

  const aplicarMargenMasivo = async () => {
    if (!window.confirm(`¿Actualizar precios masivos (${config.margenGanancia}%)?`)) return;
    const batch = writeBatch(db); 
    seleccionados.forEach(id => {
      const prod = productos.find(p => p.id === id);
      if (prod && prod.costoProveedor > 0) {
        const bruto = prod.costoProveedor + (prod.costoProveedor * (Number(config.margenGanancia) / 100));
        batch.update(doc(db, 'productos', id), { precio: aplicarRedondeo(bruto, config.redondeoPrecios) });
      }
    });
    await batch.commit(); setSeleccionados([]);
  };

  const cambiarEstadoPagoPedido = async (pedido: any, nuevoEstado: string) => {
    if (nuevoEstado === 'pagado' && pedido.estadoPago !== 'pagado') {
      const confirmar = window.confirm(`¿Registrar ingreso de $${pedido.total} en Finanzas?`);
      if (confirmar) {
        const metodo = prompt('Método (efectivo, transferencia, mercadopago):', 'transferencia') || 'transferencia';
        await addDoc(collection(db, 'finanzas'), { 
          tipo: 'ingreso', concepto: `Cobro Web #${pedido.id.slice(-6).toUpperCase()} - ${pedido.cliente?.nombre || 'Cliente'}`, 
          monto: Number(pedido.total), metodoPago: metodo.toLowerCase(), fecha: serverTimestamp(), usuario: user.email,
          items: pedido.items || [], cliente: pedido.cliente || {}
        });
      }
    }
    await updateDoc(doc(db, 'pedidos_ecommerce', pedido.id), { estadoPago: nuevoEstado });
  };

  const registrarMovimientoFinanzas = async (e: React.FormEvent) => {
    e.preventDefault(); 
    await addDoc(collection(db, 'finanzas'), { tipo: finTipo, concepto: finConcepto, monto: Number(finMonto), metodoPago: finMetodo, fecha: serverTimestamp(), usuario: user.email }); 
    setFinConcepto(''); setFinMonto('');
  };

  const guardarConfiguracion = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    await setDoc(doc(db, 'configuracion', 'general'), conf, { merge: true }); 
    alert('⚡ Parámetros actualizados.'); 
  };

  const clientesConsolidados = React.useMemo(() => {
    const mapa = new Map<string, any>();
    ordenes.forEach(o => {
      const tel = (o.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: o.cliente?.nombre || 'Sin Nombre', telefono: o.cliente?.telefono, dni: o.cliente?.dni || '', equipos: 0, comprasWeb: 0, totalGastado: 0, ultimaVisita: '' };
      actual.equipos += 1;
      actual.totalGastado += Number(o.costoReparacion || 0);
      if (o.equipo) actual.ultimoEquipo = `${o.equipo.marca} ${o.equipo.modelo}`;
      mapa.set(tel, actual);
    });
    pedidosWeb.forEach(p => {
      const tel = (p.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: p.cliente?.nombre || 'Cliente Web', telefono: p.cliente?.telefono, dni: '', equipos: 0, comprasWeb: 0, totalGastado: 0 };
      actual.comprasWeb += 1;
      actual.totalGastado += Number(p.total || 0);
      mapa.set(tel, actual);
    });
    return Array.from(mapa.values()).filter(c => 
      c.nombre.toLowerCase().includes(busquedaClienteCRM.toLowerCase()) || 
      c.telefono.includes(busquedaClienteCRM)
    ).sort((a, b) => b.totalGastado - a.totalGastado);
  }, [ordenes, pedidosWeb, busquedaClienteCRM]);

  const enviarPromoCRM = (cliente: any) => {
    const msg = mensajePromoCRM.replace('{nombre}', cliente.nombre).replace('{empresa}', config.empresaNombre);
    window.open(`https://wa.me/549${cliente.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const movimientosFiltrados = movimientosFinanzas.filter(m => {
    if (filtroTipoLista !== 'todos' && m.tipo !== filtroTipoLista) return false;
    if (filtroMetodoLista !== 'todos' && m.metodoPago !== filtroMetodoLista) return false;
    if (filtroFacturado === 'facturados' && !m.factura) return false;
    if (filtroFacturado === 'nofacturados' && m.factura) return false;
    if (filtroBusquedaConcepto && !m.concepto.toLowerCase().includes(filtroBusquedaConcepto.toLowerCase())) return false;
    
    if (m.fecha) {
      const fechaMov = new Date(m.fecha.seconds * 1000); const hoy = new Date();
      if (filtroTiempo === 'hoy' && fechaMov.toDateString() !== hoy.toDateString()) return false;
      if (filtroTiempo === 'semana' && fechaMov < new Date(hoy.setDate(hoy.getDate() - 7))) return false;
      if (filtroTiempo === 'mes' && (fechaMov.getMonth() !== hoy.getMonth() || fechaMov.getFullYear() !== hoy.getFullYear())) return false;
      if (fechaDesdeFin && fechaMov < new Date(fechaDesdeFin + 'T00:00:00')) return false;
      if (fechaHastaFin && fechaMov > new Date(fechaHastaFin + 'T23:59:59')) return false;
    }
    return true;
  });

  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const saldoNeto = totalIngresos - totalEgresos;
  const ivaEstimado = Math.round(totalIngresos - (totalIngresos / (1 + (Number(config.ivaPorcentaje || 21) / 100))));

  const agregarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUserEmail) return;
    await addDoc(collection(db, 'usuarios_roles'), { email: nuevoUserEmail.trim().toLowerCase(), nombre: nuevoUserNombre, rol: nuevoUserRol, fecha: serverTimestamp() });
    setNuevoUserEmail(''); setNuevoUserNombre('');
  };

  const pedidosPendientesNum = pedidosWeb.filter(p => p.estadoEnvio !== 'entregado').length;
  const listaSectores = (config.sectoresTaller || CONFIG_DEFAULT.sectoresTaller).split(',').map((s:string) => s.trim());

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {escaneandoPara && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <h3 className="glow-text-cyan">📷 ESCÁNER ACTIVO</h3>
            <div id="reader" style={{ width: '100%', borderRadius: '8px', background: '#fff' }}></div>
            <button onClick={() => setEscaneandoPara(null)} className="neon-btn neon-btn-red" style={{ marginTop: '15px', width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="neon-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
        <div>
          <h2 className="glow-text-cyan" style={{ margin: 0, fontSize: '20px' }}>⚡ {config.empresaNombre} // ERP INDUSTRIAL</h2>
          <span style={{ fontSize: '12px', color: '#8b9bb4' }}>
            Operador: <b style={{ color: '#fff' }}>{user.email}</b> | Rol Activo: <span className="neon-badge" style={{ background: 'rgba(0,255,157,0.15)', color: '#00ff9d' }}>{rolActual.toUpperCase()}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setPestaña('taller')} className={`neon-btn ${pestaña === 'taller' ? 'neon-btn-fillCyan' : ''}`}>🛠️ Taller ({ordenes.filter(o=>o.estado!=='entregado').length})</button>
          <button onClick={() => setPestaña('catalogo')} className={`neon-btn ${pestaña === 'catalogo' ? 'neon-btn-fillCyan' : ''}`}>📦 Pañol & Stock ({productos.length})</button>
          {rolActual !== 'tecnico' && (
            <>
              <button onClick={() => setPestaña('clientes')} className={`neon-btn neon-btn-green ${pestaña === 'clientes' ? 'neon-btn-fillCyan' : ''}`}>👥 Clientes CRM ({clientesConsolidados.length})</button>
              <button onClick={() => setPestaña('pedidos')} className={`neon-btn neon-btn-pink ${pestaña === 'pedidos' ? 'neon-btn-fillCyan' : ''}`}>🛒 Web B2B {pedidosPendientesNum > 0 && `(${pedidosPendientesNum})`}</button>
            </>
          )}
          {rolActual === 'admin' && (
            <>
              <button onClick={() => setPestaña('proveedores')} className={`neon-btn neon-btn-purple ${pestaña === 'proveedores' ? 'neon-btn-fillCyan' : ''}`}>🚚 Excel Prov.</button>
              <button onClick={() => setPestaña('finanzas')} className={`neon-btn neon-btn-green ${pestaña === 'finanzas' ? 'neon-btn-fillCyan' : ''}`}>💰 Finanzas</button>
              <button onClick={() => setPestaña('usuarios')} className={`neon-btn ${pestaña === 'usuarios' ? 'neon-btn-fillCyan' : ''}`}>🛡️ Roles</button>
              <button onClick={() => setPestaña('configuracion')} className={`neon-btn ${pestaña === 'configuracion' ? 'neon-btn-fillCyan' : ''}`}>⚙️ Config</button>
            </>
          )}
          <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red">Salir</button>
        </div>
      </div>

      {pestaña === 'taller' && (
        <div>
          <form onSubmit={guardarOrden} className="neon-card" style={{ marginBottom: '22px' }}>
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>📝 RECEPCIÓN PROFESIONAL DE LABORATORIO</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="label-neon">1. Cliente</label>
                <input type="text" className="neon-input" placeholder="Nombre y Apellido" value={cliNombre} onChange={e=>setCliNombre(e.target.value)} required style={{ marginBottom: '8px' }}/>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="neon-input" placeholder="WhatsApp (2262...)" value={cliTel} onChange={e=>setCliTel(e.target.value)} required />
                  <input type="text" className="neon-input" placeholder="DNI / CUIT" value={cliDni} onChange={e=>setCliDni(e.target.value)} />
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
                <input type="text" className="neon-input" placeholder="Observaciones estéticas (Rayas, golpes)" value={condicionVisual} onChange={e=>setCondicionVisual(e.target.value)} />
              </div>
              <div>
                <label className="label-neon">4. Laboratorio & Presupuesto</label>
                <select className="neon-select" value={tecnico} onChange={e=>setTecnico(e.target.value)} style={{ marginBottom: '8px' }}>
                  <option value="">Asignar Sector...</option>
                  {listaSectores.map((s:string)=><option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" className="neon-input" placeholder="Presupuesto $" value={presupuestoInicial} onChange={e=>setPresupuestoInicial(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Seña $" value={señaRecibida} onChange={e=>setSeñaRecibida(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ background: '#070a12', padding: '12px 15px', borderRadius: '8px', border: '1px solid rgba(0,243,255,0.2)', marginBottom: '15px' }}>
              <span className="label-neon">✅ CHECKLIST DE INGRESO (Sale impreso en la Orden A4):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: checklist.includes(item) ? '#00ff9d' : '#8b9bb4' }}>
                    <input type="checkbox" checked={checklist.includes(item)} onChange={() => toggleItemChecklist(item)} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '13px' }}>➕ INGRESAR EQUIPO Y GENERAR ORDEN</button>
          </form>

          <div className="neon-card" style={{ marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="glow-text-cyan" style={{ fontFamily: 'Orbitron', fontSize: '11px' }}>🔍 FILTRAR TALLER:</span>
            <input type="text" className="neon-input" placeholder="Buscar por código, cliente, modelo o IMEI..." value={busquedaTaller} onChange={e=>setBusquedaTaller(e.target.value)} style={{ flex: '1 1 220px' }} />
            <select className="neon-select" value={filtroEstadoTaller} onChange={e=>setFiltroEstadoTaller(e.target.value)} style={{ width: 'auto' }}>
              <option value="todos">Todos los Estados</option>
              <option value="ingresado">📥 Ingresado</option>
              <option value="en revision">🔬 En Revisión</option>
              <option value="esperando repuesto">⏳ Esperando Repuesto</option>
              <option value="reparado">✅ Reparado</option>
              <option value="reingreso garantia">🔄 Garantía</option>
              <option value="sin solucion">❌ Sin Solución</option>
              <option value="entregado">📦 Entregado</option>
            </select>
            <select className="neon-select" value={filtroSectorTaller} onChange={e=>setFiltroSectorTaller(e.target.value)} style={{ width: 'auto' }}>
              <option value="todos">Todos los Sectores</option>
              {listaSectores.map((s:string)=><option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" className="neon-input" value={fechaDesdeTaller} onChange={e=>setFechaDesdeTaller(e.target.value)} style={{ width: 'auto' }} title="Desde Fecha" />
            <input type="date" className="neon-input" value={fechaHastaTaller} onChange={e=>setFechaHastaTaller(e.target.value)} style={{ width: 'auto' }} title="Hasta Fecha" />
          </div>

          <div className="neon-card" style={{ overflowX: 'auto' }}>
            <table className="neon-table">
              <thead><tr><th>Orden</th><th>Cliente</th><th>Equipo & Diagnóstico</th><th>Estado / Saldo</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
              <tbody>
                {ordenesFiltradas.map(o => (
                  <tr key={o.id} style={{ opacity: o.estado === 'entregado' ? 0.55 : 1 }}>
                    <td style={{ fontFamily: 'Orbitron', color: '#00f3ff', fontWeight: 'bold' }}>#{o.codigoSeguimiento}</td>
                    <td><b>{o.cliente?.nombre}</b><br/><span style={{ fontSize: '13px', color: '#00ff9d' }}>📱 {o.cliente?.telefono}</span></td>
                    <td>
                      <b>{o.equipo?.marca} {o.equipo?.modelo}</b> {o.equipo?.contrasena && <span className="neon-badge" style={{ background: 'rgba(255,238,0,0.15)', color: '#ffee00' }}>🔑 {o.equipo.contrasena}</span>}<br/>
                      <span style={{ color: '#ff0055' }}>Falla: {o.fallaDeclarada}</span>
                      {o.tecnicoAsignado && <div style={{ fontSize: '12px', color: '#8b9bb4' }}>📍 {o.tecnicoAsignado}</div>}
                    </td>
                    <td>
                      <select className="neon-select" value={o.estado} onChange={e => actualizarEstado(o.id, e.target.value, o)} style={{ padding: '7px' }}>
                        <option value="ingresado">📥 Ingresado</option>
                        <option value="en revision">🔬 En Revisión</option>
                        <option value="esperando repuesto">⏳ Esperando Repuesto</option>
                        <option value="reparado">✅ Reparado</option>
                        <option value="reingreso garantia">🔄 Reingreso Garantía</option>
                        <option value="sin solucion">❌ Sin Solución</option>
                        <option value="entregado">📦 Entregado</option>
                      </select>
                      {o.costoReparacion && (
                        <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
                          <span className="glow-text-green">Total: ${o.costoReparacion}</span> {o.seña > 0 && `| Seña: $${o.seña}`}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => notificarClienteWhatsApp(o)} className="neon-btn neon-btn-green">💬 Avisar</button>
                        <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir Orden A4 con Talón / Ticket Térmico con QR">🖨️ Imprimir</button>
                        {rolActual === 'admin' && (
                          <button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'ordenes_taller',o.id))}} className="neon-btn neon-btn-red">🗑️</button>
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

      {pestaña === 'catalogo' && (
        <div>
          {rolActual !== 'tecnico' && (
            <div style={{ display: 'flex', gap: '20px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarProducto} className="neon-card" style={{ flex: '1 1 65%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 className="glow-text-cyan" style={{ margin: 0 }}>{idEditando ? '✏️ EDITAR ARTÍCULO' : '➕ ALTA DE ARTÍCULO & PAÑOL'}</h3>
                  <label style={{ color: '#ffee00', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input type="checkbox" checked={prodDestacado} onChange={e=>setProdDestacado(e.target.checked)} /> ⭐ Destacar
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="neon-input" placeholder="Proveedor" value={prodProveedor} onChange={e=>setProdProveedor(e.target.value)} />
                  <input type="text" className="neon-input" placeholder="📍 Ubicación (Ej: Gaveta A3)" value={prodUbicacion} onChange={e=>setProdUbicacion(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Costo $" value={prodCosto} onChange={e=>setProdCosto(e.target.value)} />
                  <button type="button" onClick={calcularPrecioVenta} className="neon-btn neon-btn-green">Calcular (+{config.margenGanancia}%)</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input type="text" className="neon-input" placeholder="Código de Barras / SKU" value={prodCodigoBarras} onChange={e=>setProdCodigoBarras(e.target.value)} />
                  <button type="button" onClick={() => setEscaneandoPara('formulario')} className="neon-btn">📷 Escanear</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <input type="text" className="neon-input" placeholder="Nombre / Modelo" value={prodNom} onChange={e=>setProdNom(e.target.value)} required />
                  <input type="text" className="neon-input" placeholder="Categoría" value={prodCat} onChange={e=>setProdCat(e.target.value)} required />
                  <input type="number" className="neon-input" placeholder="Venta $" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} required />
                  <input type="number" className="neon-input" placeholder="Stock" value={prodStock} onChange={e=>setProdStock(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '12px' }}>{idEditando ? 'Guardar Cambios' : 'Publicar Artículo'}</button>
                  {idEditando && <button type="button" onClick={limpiarFormularioProducto} className="neon-btn neon-btn-red">Cancelar</button>}
                </div>
              </form>
              <div className="neon-card" style={{ flex: '1 1 28%' }}>
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>📱 REPOSICIÓN RÁPIDA</h3>
                <p style={{ fontSize: '13px', color: '#8b9bb4' }}>Genera un listado automático por WhatsApp con todos los artículos en stock crítico (≤{config.stockCriticoAlerta}).</p>
                <button onClick={pedirFaltantes} className="neon-btn neon-btn-green" style={{ width: '100%', padding: '14px' }}>Enviar Faltantes por WhatsApp</button>
              </div>
            </div>
          )}

          <div className="neon-card" style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" className="neon-input" placeholder="🔍 Buscar por nombre, código, proveedor o gaveta..." value={busquedaInventario} onChange={e=>setBusquedaInventario(e.target.value)} style={{ flex: '1 1 240px' }} />
            <button onClick={() => setEscaneandoPara('buscador')} className="neon-btn">📷 Cámara</button>
            <select className="neon-select" value={filtroCategoriaInv} onChange={e=>setFiltroCategoriaInv(e.target.value)} style={{ width: 'auto' }}>
              {categoriasUnicasInv.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="neon-select" value={filtroProveedorInv} onChange={e=>setFiltroProveedorInv(e.target.value)} style={{ width: 'auto' }}>
              {proveedoresUnicosInv.map((pr:any) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
            <select className="neon-select" value={filtroStockInv} onChange={e=>setFiltroStockInv(e.target.value)} style={{ width: 'auto' }}>
              <option value="todos">Todo el Stock</option>
              <option value="critico">⚠️ Stock Crítico (≤{config.stockCriticoAlerta})</option>
              <option value="agotado">❌ Agotados (0)</option>
            </select>
          </div>

          {seleccionados.length > 0 && (
            <div className="neon-card neon-card-pink" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="glow-text-pink"><b>{seleccionados.length} artículos seleccionados</b></span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={aplicarMargenMasivo} className="neon-btn neon-btn-green">Recalcular Precios (+{config.margenGanancia}%)</button>
                <button onClick={eliminarSeleccionados} className="neon-btn neon-btn-red">Eliminar Lote</button>
                <button onClick={()=>setSeleccionados([])} className="neon-btn">Cancelar</button>
              </div>
            </div>
          )}

          <div className="neon-card" style={{ overflowX: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th style={{ width: '35px', textAlign: 'center' }}><input type="checkbox" checked={seleccionados.length === inventarioFiltrado.length && inventarioFiltrado.length > 0} onChange={toggleTodos} /></th>
                  <th>Ubicación</th>
                  <th>Artículo / Proveedor</th>
                  {rolActual === 'admin' && <th>Costo</th>}
                  <th>Precio Venta</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {inventarioFiltrado.map(p => (
                  <tr key={p.id} style={{ background: seleccionados.includes(p.id) ? 'rgba(0,243,255,0.08)' : undefined }}>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggleSeleccion(p.id)} /></td>
                    <td><span className="neon-badge" style={{ background: 'rgba(181,55,242,0.15)', color: '#b537f2', border: '1px solid rgba(181,55,242,0.4)' }}>📍 {p.ubicacion || 'S/U'}</span></td>
                    <td>
                      <b>{p.nombre}</b> {p.destacado && '⭐'}<br/>
                      <span style={{ fontSize: '11px', color: '#8b9bb4' }}>{p.categoria} {p.proveedor && `| 🏢 ${p.proveedor}`} {p.codigoBarras && `| #${p.codigoBarras}`}</span>
                    </td>
                    {rolActual === 'admin' && <td style={{ color: '#8b9bb4' }}>${p.costoProveedor?.toLocaleString() || 0}</td>}
                    <td className="glow-text-cyan" style={{ fontWeight: 'bold', fontSize: '17px' }}>${p.precio?.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => actualizarStock(p.id, p.stock - 1)} className="neon-btn neon-btn-red" style={{ padding: '2px 6px' }}>-</button>
                        <b style={{ color: p.stock <= config.stockCriticoAlerta ? '#ff0055' : '#00ff9d', minWidth: '24px', textAlign: 'center' }}>{p.stock}</b>
                        <button onClick={() => actualizarStock(p.id, p.stock + 1)} className="neon-btn neon-btn-green" style={{ padding: '2px 6px' }}>+</button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => registrarVentaDirecta(p)} className="neon-btn neon-btn-green" style={{ padding: '4px 8px' }}>$ Vender</button>
                        {rolActual !== 'tecnico' && <button onClick={() => cargarProductoParaEdicion(p)} className="neon-btn" style={{ padding: '4px 8px' }}>✏️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestaña === 'clientes' && (
        <div>
          <div className="neon-card neon-card-green" style={{ marginBottom: '20px' }}>
            <h3 className="glow-text-green" style={{ marginTop: 0 }}>📣 CAMPAÑAS DE MARKETING & FIDELIZACIÓN POR WHATSAPP</h3>
            <p style={{ fontSize: '14px', color: '#8b9bb4', margin: '0 0 10px 0' }}>
              Personaliza el mensaje promocional. Usa <b>{'{nombre}'}</b> y <b>{'{empresa}'}</b> para que se reemplacen automáticamente al enviarlo.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" className="neon-input" value={mensajePromoCRM} onChange={e=>setMensajePromoCRM(e.target.value)} style={{ flex: 1 }} />
              <input type="text" className="neon-input" placeholder="🔍 Buscar cliente por nombre o teléfono..." value={busquedaClienteCRM} onChange={e=>setBusquedaClienteCRM(e.target.value)} style={{ width: '280px' }} />
            </div>
          </div>
          <div className="neon-card" style={{ overflowX: 'auto' }}>
            <table className="neon-table">
              <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Categoría</th><th>Actividad Histórica</th><th>Total Invertido (LTV)</th><th style={{ textAlign: 'center' }}>Marketing Directo</th></tr></thead>
              <tbody>
                {clientesConsolidados.map((c, idx) => {
                  const categoria = c.comprasWeb > 0 ? 'GREMIO B2B' : c.equipos >= 3 || c.totalGastado > 100000 ? 'CLIENTE VIP' : 'ESTÁNDAR';
                  return (
                    <tr key={idx}>
                      <td><b style={{ color: '#fff' }}>{c.nombre}</b> {c.dni && <span style={{ fontSize: '12px', color: '#8b9bb4' }}>({c.dni})</span>}</td>
                      <td style={{ color: '#00ff9d' }}>📱 {c.telefono}</td>
                      <td><span className="neon-badge" style={{ background: categoria === 'GREMIO B2B' ? 'rgba(255,0,255,0.15)' : categoria === 'CLIENTE VIP' ? 'rgba(255,238,0,0.15)' : 'rgba(0,243,255,0.1)', color: categoria === 'GREMIO B2B' ? '#ff00ff' : categoria === 'CLIENTE VIP' ? '#ffee00' : '#00f3ff' }}>{categoria}</span></td>
                      <td style={{ fontSize: '13px', color: '#8b9bb4' }}>🛠️ {c.equipos} reparaciones | 🛒 {c.comprasWeb} pedidos web{c.ultimoEquipo && <div>Último equipo: <b style={{ color: '#e2e8f0' }}>{c.ultimoEquipo}</b></div>}</td>
                      <td className="glow-text-cyan" style={{ fontWeight: 'bold', fontSize: '16px' }}>${c.totalGastado.toLocaleString()}</td>
                      <td style={{ textAlign: 'center' }}><button onClick={() => enviarPromoCRM(c)} className="neon-btn neon-btn-green">🚀 Enviar Promo WhatsApp</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestaña === 'finanzas' && (
        <div>
          <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="glow-text-cyan" style={{ fontFamily: 'Orbitron', fontSize: '11px' }}>📊 AUDITORÍA:</span>
            <select className="neon-select" value={filtroTiempo} onChange={e=>setFiltroTiempo(e.target.value)} style={{ width: 'auto' }}><option value="todos">Todo el Historial</option><option value="hoy">Hoy</option><option value="semana">Últimos 7 días</option><option value="mes">Este Mes</option></select>
            <input type="date" className="neon-input" value={fechaDesdeFin} onChange={e=>setFechaDesdeFin(e.target.value)} style={{ width: 'auto' }} />
            <input type="date" className="neon-input" value={fechaHastaFin} onChange={e=>setFechaHastaFin(e.target.value)} style={{ width: 'auto' }} />
            <select className="neon-select" value={filtroTipoLista} onChange={e=>setFiltroTipoLista(e.target.value)} style={{ width: 'auto' }}><option value="todos">Ingresos y Egresos</option><option value="ingreso">Solo Ingresos</option><option value="egreso">Solo Egresos</option></select>
            <select className="neon-select" value={filtroMetodoLista} onChange={e=>setFiltroMetodoLista(e.target.value)} style={{ width: 'auto' }}><option value="todos">Todos los Medios</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option></select>
            <select className="neon-select" value={filtroFacturado} onChange={e=>setFiltroFacturado(e.target.value)} style={{ width: 'auto' }}><option value="todos">Todas (Con/Sin Factura)</option><option value="facturados">📄 Solo Facturadas</option><option value="nofacturados">⏳ Sin Facturar</option></select>
            <input type="text" className="neon-input" placeholder="Buscar concepto..." value={filtroBusquedaConcepto} onChange={e=>setFiltroBusquedaConcepto(e.target.value)} style={{ width: '170px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '22px' }}>
            <div className="neon-card neon-card-green" style={{ textAlign: 'center' }}><span className="label-neon" style={{ color: '#00ff9d' }}>INGRESOS BRUTOS</span><h2 className="glow-text-green" style={{ margin: '5px 0 0 0' }}>${totalIngresos.toLocaleString()}</h2></div>
            <div className="neon-card neon-card-pink" style={{ textAlign: 'center' }}><span className="label-neon" style={{ color: '#ff0055' }}>GASTOS / EGRESOS</span><h2 className="glow-text-red" style={{ margin: '5px 0 0 0' }}>${totalEgresos.toLocaleString()}</h2></div>
            <div className="neon-card" style={{ textAlign: 'center' }}><span className="label-neon">CAJA NETA</span><h2 className="glow-text-cyan" style={{ margin: '5px 0 0 0' }}>${saldoNeto.toLocaleString()}</h2></div>
            <div className="neon-card neon-card-purple" style={{ textAlign: 'center' }}><span className="label-neon" style={{ color: '#b537f2' }}>DÉBITO IVA EST. ({config.ivaPorcentaje}%)</span><h2 style={{ margin: '5px 0 0 0', color: '#b537f2' }}>${ivaEstimado.toLocaleString()}</h2></div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <form onSubmit={registrarMovimientoFinanzas} className="neon-card" style={{ flex: '1 1 280px', alignSelf: 'flex-start' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>➕ ASIENTO CONTABLE</h3>
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
                <thead><tr><th>Fecha</th><th>Concepto (Click ▶ para desglose)</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th><th style={{ textAlign: 'center' }}>Borrar</th></tr></thead>
                <tbody>
                  {movimientosFiltrados.map(m => (
                    <React.Fragment key={m.id}>
                      <tr>
                        <td style={{ fontSize: '12px', color: '#8b9bb4' }}>{m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                        <td>
                          {m.tipo === 'ingreso' && (
                            <button onClick={() => setExpandidoId(expandidoId === m.id ? null : m.id)} className="neon-btn" style={{ padding: '2px 6px', marginRight: '6px', fontSize: '10px' }}>
                              {expandidoId === m.id ? '▼' : '▶'}
                            </button>
                          )}
                          <b>{m.concepto}</b>
                          {m.factura && <span className="neon-badge" style={{ marginLeft: '8px', background: 'rgba(0,255,157,0.15)', color: '#00ff9d' }}>FAC {m.factura.tipo} #{m.factura.numero}</span>}
                        </td>
                        <td style={{ textTransform: 'uppercase', color: '#00f3ff' }}>{m.metodoPago}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: m.tipo === 'ingreso' ? '#00ff9d' : '#ff0055' }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}><button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'finanzas',m.id))}} className="neon-btn neon-btn-red" style={{ padding: '4px 8px' }}>🗑️</button></td>
                      </tr>
                      {expandidoId === m.id && (
                        <tr style={{ background: 'rgba(0, 243, 255, 0.04)' }}>
                          <td colSpan={5} style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, background: '#070a12', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0,243,255,0.2)' }}>
                                <h4 className="glow-text-cyan" style={{ margin: '0 0 8px 0', fontSize: '12px' }}>📦 ÍTEMS DE LA VENTA</h4>
                                {m.items?.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                                    {m.items.map((it:any, idx:number)=><li key={idx}><b>{it.cantidad}x</b> {it.nombre} (${it.precio})</li>)}
                                  </ul>
                                ) : <span style={{ color: '#8b9bb4', fontSize: '12px' }}>Sin ítems detallados.</span>}
                              </div>
                              <div style={{ flex: 1, background: '#070a12', padding: '12px', borderRadius: '6px', border: '1px solid rgba(0,255,157,0.2)' }}>
                                <h4 className="glow-text-green" style={{ margin: '0 0 8px 0', fontSize: '12px' }}>📄 FACTURACIÓN</h4>
                                {m.factura ? (
                                  <div style={{ fontSize: '13px' }}>
                                    <p style={{ margin: '2px 0' }}>Factura {m.factura.tipo} N° {m.factura.numero}</p>
                                    <p style={{ margin: '2px 0' }}>CUIT/DNI: {m.factura.cuit}</p>
                                    <button onClick={()=>updateDoc(doc(db,'finanzas',m.id), {factura: null})} className="neon-btn neon-btn-red" style={{ marginTop: '6px', padding: '2px 6px', fontSize: '10px' }}>Quitar</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}><select id={`tipo-${m.id}`} className="neon-select" style={{ width: '80px' }}><option>A</option><option>B</option><option>C</option></select><input id={`num-${m.id}`} type="text" className="neon-input" placeholder="Nº Comprobante" /></div>
                                    <input id={`cuit-${m.id}`} type="text" className="neon-input" placeholder="CUIT / DNI" />
                                    <button onClick={async()=>{
                                      const tipo = (document.getElementById(`tipo-${m.id}`) as HTMLSelectElement).value;
                                      const numero = (document.getElementById(`num-${m.id}`) as HTMLInputElement).value;
                                      const cuit = (document.getElementById(`cuit-${m.id}`) as HTMLInputElement).value;
                                      if(!numero) return alert('Ingresa el número');
                                      await updateDoc(doc(db,'finanzas',m.id), {factura:{tipo,numero,cuit}});
                                    }} className="neon-btn neon-btn-green" style={{ padding: '6px' }}>Asociar Factura</button>
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

      {pestaña === 'proveedores' && (
        <div className="neon-card">
          <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🚚 IMPORTADOR INTELIGENTE DE LISTAS DE PRECIOS</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div><label className="label-neon">Proveedor</label><input type="text" className="neon-input" placeholder="Ej: GsmServer" value={nombreProveedorExcel} onChange={e=>setNombreProveedorExcel(e.target.value)} /></div>
            <div><label className="label-neon">Moneda de Lista</label><select className="neon-select" value={monedaListaExcel} onChange={e=>setMonedaListaExcel(e.target.value as any)}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (x ${config.cotizacionDolar})</option></select></div>
            <div><label className="label-neon">Archivo .xlsx</label><input type="file" id="fileExcel" accept=".xlsx, .xls" className="neon-input" onChange={procesarArchivoExcel} /></div>
          </div>
          {excelHojas.length > 0 && !excelCargando && (
            <div style={{ background: '#070a12', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                <div><label className="label-neon">Pestaña</label><select className="neon-select" value={hojaActiva} onChange={cambiarHojaDropdown}>{excelHojas.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="label-neon">Col. Nombre</label><select className="neon-select" value={colNombre} onChange={e=>setColNombre(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                <div><label className="label-neon">Col. Costo</label><select className="neon-select" value={colCosto} onChange={e=>setColCosto(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                <div><label className="label-neon">Col. Marca (Opcional)</label><select className="neon-select" value={colMarca} onChange={e=>setColMarca(Number(e.target.value))}><option value={-1}>No Aplica</option>{[0,1,2,3,4,5,6].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
              </div>
              <button onClick={importarDatosAlInventario} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>🚀 Sincronizar Lista con Base de Datos</button>
            </div>
          )}
        </div>
      )}

      {pestaña === 'pedidos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {pedidosWeb.map(pedido => (
            <div key={pedido.id} className="neon-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 className="glow-text-pink" style={{ margin: '0 0 6px 0' }}>PEDIDO WEB #{pedido.id.slice(-6).toUpperCase()}</h4>
                <p style={{ margin: '2px 0' }}><b>Cliente:</b> {pedido.cliente.nombre} ({pedido.cliente.telefono})</p>
                <p style={{ margin: '2px 0' }}><b>Entrega:</b> {pedido.cliente.metodoEnvio.toUpperCase()}</p>
              </div>
              <div style={{ background: '#070a12', padding: '12px', borderRadius: '6px', flex: 1, minWidth: '220px' }}>
                <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                  {pedido.items.map((it:any, idx:number)=><li key={idx}>{it.cantidad}x {it.nombre} (${it.precio})</li>)}
                </ul>
                <b className="glow-text-green" style={{ display: 'block', marginTop: '6px' }}>Total: ${pedido.total?.toLocaleString()}</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                <select className="neon-select" value={pedido.estadoPago} onChange={e=>cambiarEstadoPagoPedido(pedido, e.target.value)}>
                  <option value="pendiente">Pago Pendiente</option>
                  <option value="pagado">✅ Pagado (Caja)</option>
                </select>
                <select className="neon-select" value={pedido.estadoEnvio} onChange={e=>updateDoc(doc(db,'pedidos_ecommerce',pedido.id), {estadoEnvio: e.target.value})}>
                  <option value="preparacion">En Preparación</option>
                  <option value="enviado">En Camino</option>
                  <option value="entregado">Entregado</option>
                </select>
              </div>
            </div>
          ))}
          {pedidosWeb.length === 0 && <div className="neon-card">No hay pedidos web registrados.</div>}
        </div>
      )}

      {pestaña === 'usuarios' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <form onSubmit={agregarUsuarioRol} className="neon-card" style={{ flex: '1 1 320px' }}>
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🛡️ ASIGNAR ROL DE ACCESO</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label className="label-neon">Nombre Colaborador</label><input type="text" className="neon-input" required value={nuevoUserNombre} onChange={e=>setNuevoUserNombre(e.target.value)} /></div>
              <div><label className="label-neon">Email</label><input type="email" className="neon-input" required value={nuevoUserEmail} onChange={e=>setNuevoUserEmail(e.target.value)} /></div>
              <div>
                <label className="label-neon">Permisos</label>
                <select className="neon-select" value={nuevoUserRol} onChange={e=>setNuevoUserRol(e.target.value as any)}>
                  <option value="tecnico">🔧 Técnico (Solo Taller y Stock)</option>
                  <option value="vendedor">🛒 Vendedor (Taller, Stock, CRM, Web)</option>
                  <option value="admin">👑 Admin Total (Finanzas, Costos y Config)</option>
                </select>
              </div>
              <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '12px' }}>Guardar Permiso</button>
            </div>
          </form>

          <div className="neon-card" style={{ flex: '2 1 500px' }}>
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>👥 PERSONAL AUTORIZADO</h3>
            <table className="neon-table">
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol Asignado</th><th>Acción</th></tr></thead>
              <tbody>
                {usuariosRoles.map(u => (
                  <tr key={u.id}>
                    <td><b>{u.nombre}</b></td>
                    <td>{u.email}</td>
                    <td><span className="neon-badge" style={{ background: 'rgba(0,243,255,0.15)', color: '#00f3ff' }}>{u.rol?.toUpperCase()}</span></td>
                    <td><button onClick={()=>deleteDoc(doc(db, 'usuarios_roles', u.id))} className="neon-btn neon-btn-red" style={{ padding: '4px 8px' }}>Revocar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestaña === 'configuracion' && (
        <form onSubmit={guardarConfiguracion} className="neon-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>⚙️ PARÁMETROS GLOBALES DEL ERP</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div><label className="label-neon">Nombre Empresa</label><input type="text" className="neon-input" value={conf.empresaNombre} onChange={e=>setConf({...conf, empresaNombre: e.target.value})} /></div>
            <div><label className="label-neon">Eslogan</label><input type="text" className="neon-input" value={conf.eslogan} onChange={e=>setConf({...conf, eslogan: e.target.value})} /></div>
            <div><label className="label-neon">CUIT</label><input type="text" className="neon-input" value={conf.cuit} onChange={e=>setConf({...conf, cuit: e.target.value})} /></div>
            <div><label className="label-neon">Dirección</label><input type="text" className="neon-input" value={conf.direccion} onChange={e=>setConf({...conf, direccion: e.target.value})} /></div>
            <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={conf.whatsapp} onChange={e=>setConf({...conf, whatsapp: e.target.value})} /></div>
            <div><label className="label-neon">Cotización Dólar ($)</label><input type="number" className="neon-input" value={conf.cotizacionDolar} onChange={e=>setConf({...conf, cotizacionDolar: Number(e.target.value)})} /></div>
            <div><label className="label-neon">Margen Ganancia Global (%)</label><input type="number" className="neon-input" value={conf.margenGanancia} onChange={e=>setConf({...conf, margenGanancia: Number(e.target.value)})} /></div>
            <div><label className="label-neon">Redondeo Precios (10, 50, 100)</label><input type="text" className="neon-input" value={conf.redondeoPrecios} onChange={e=>setConf({...conf, redondeoPrecios: e.target.value})} /></div>
            <div><label className="label-neon">Alias / CBU</label><input type="text" className="neon-input" value={conf.aliasTransferencia} onChange={e=>setConf({...conf, aliasTransferencia: e.target.value})} /></div>
            <div><label className="label-neon">Link Mercado Pago</label><input type="text" className="neon-input" value={conf.linkMercadoPago} onChange={e=>setConf({...conf, linkMercadoPago: e.target.value})} /></div>
            <div><label className="label-neon">Días de Garantía</label><input type="number" className="neon-input" value={conf.garantiaDiasDefault} onChange={e=>setConf({...conf, garantiaDiasDefault: Number(e.target.value)})} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Sectores de Laboratorio (Separados por coma)</label><input type="text" className="neon-input" value={conf.sectoresTaller} onChange={e=>setConf({...conf, sectoresTaller: e.target.value})} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Plantilla Marketing WhatsApp (Usa {'{nombre}'} y {'{empresa}'})</label><textarea className="neon-textarea" rows={2} value={conf.promoPlantillaCRM} onChange={e=>setConf({...conf, promoPlantillaCRM: e.target.value})} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Condiciones Legales de Garantía (Impresas en Orden A4 y Ticket)</label><textarea className="neon-textarea" rows={3} value={conf.ticketLeyenda} onChange={e=>setConf({...conf, ticketLeyenda: e.target.value})} /></div>
          </div>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '16px', fontSize: '15px' }}>💾 GUARDAR TODA LA CONFIGURACIÓN</button>
        </form>
      )}
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

  useEffect(() => { 
    const u = onAuthStateChanged(auth, u => { setUser(u); setCargando(false); }); 
    return () => u(); 
  }, []);

  if (cargando) return <div style={{ padding: '50px', textAlign: 'center', color: '#00f3ff', background: '#070a12', height: '100vh', fontFamily: 'Orbitron' }}>⚡ INICIANDO WALABBA TECNO ERP...</div>;

  return (
    <BrowserRouter>
      <style>{NEON_STYLES}</style>
      <nav style={{ padding: '15px 30px', background: 'rgba(7, 10, 18, 0.95)', borderBottom: '1px solid rgba(0, 243, 255, 0.35)', display: 'flex', gap: '25px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <Link to="/" className="glow-text-cyan" style={{ textDecoration: 'none', fontWeight: 900, fontFamily: 'Orbitron', fontSize: '15px' }}>⚡ TIENDA B2B</Link>
        <Link to="/seguimiento" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 600, fontFamily: 'Orbitron', fontSize: '13px' }}>🔍 RASTREAR EQUIPO</Link>
        {!user ? (
          <Link to="/admin-login" className="neon-btn" style={{ marginLeft: 'auto', textDecoration: 'none', padding: '7px 15px' }}>🔐 Acceso Taller</Link>
        ) : (
          <Link to="/admin-panel" className="neon-btn neon-btn-fillCyan" style={{ marginLeft: 'auto', textDecoration: 'none', padding: '7px 15px' }}>⚙️ PANEL ERP</Link>
        )}
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