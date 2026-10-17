import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, addDoc, serverTimestamp, query, onSnapshot, getDocs, where,
  doc, updateDoc, deleteDoc, arrayUnion, setDoc, writeBatch 
} from 'firebase/firestore';
import { auth, db } from './firebase'; 

// --- Configuración por defecto ERP Industrial ---
const CONFIG_DEFAULT = {
  empresaNombre: "WALABBA TECNO",
  eslogan: "Laboratorio Central de Microelectrónica & Hub B2B",
  cuit: "20-35441122-3",
  direccion: "Av. 42 3998 - Necochea",
  horariosAtencion: "Lun a Vie 9:00 a 18:00 hs | Sáb 9:00 a 13:00 hs",
  whatsapp: "5492262619735",
  instagram: "@walabbatecno",
  logoUrl: "",
  monedaSimbolo: "$",
  cotizacionDolar: 1200,
  margenGanancia: 35,
  descuentoGremioBronce: 10,
  descuentoGremioOro: 18,
  ivaPorcentaje: 21,
  recargoTarjetaPorcentaje: 15,
  descuentoEfectivoPorcentaje: 10,
  comisionTecnicoPorcentaje: 30,
  redondeoPrecios: "100",
  stockCriticoAlerta: 3,
  compraMinima: 0,
  envioLocalCosto: 1500,
  envioGratisDesde: 50000,
  aliasTransferencia: "walabba.tecno.mp",
  bancoTitular: "Jose Luis Sena - Mercado Pago",
  linkMercadoPago: "",
  catalogoPublicoPrecios: false,
  garantiaDiasDefault: 30,
  costoDiagnosticoBase: 5000,
  sectoresTaller: "Microelectrónica & Placas, Módulos y Baterías, Software & F4, Tercerizado Externo",
  ticketEncabezado: "Av. 42 3998 - Necochea\nWhatsApp: 2262619735",
  ticketLeyenda: "Use el código o escanee el QR para seguir su reparación en vivo. Pasados los 90 días el equipo se considerará abandonado según Art. 2525 CCyC. La garantía cubre únicamente la mano de obra y repuesto de la falla reparada, no cubre equipos mojados, golpeados o manipulados por terceros.",
  promoPlantillaCRM: "Hola {nombre}! En *{empresa}* tenemos promos exclusivas esta semana en cargadores carga rápida, hidrogel antishock y servicio de laboratorio. ¡Presentando este mensaje tenés 15% OFF!"
};

const CHECKLIST_ITEMS = [
  "Enciende", "Display OK", "Táctil OK", "Pin Carga OK", 
  "Batería OK", "Cámaras OK", "Audio / Mic", "WiFi / Señal", 
  "Bandeja SIM", "MicroSD", "Con Funda", "Mojado / Sulfato"
];

// --- ESTILOS NEON CYBERPUNK ---
const NEON_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

  :root {
    --bg-dark: #060911;
    --bg-card: #0d1322;
    --bg-input: #080c16;
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
  }

  h1, h2, h3, h4, .neon-title {
    font-family: 'Orbitron', sans-serif;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .neon-card {
    background: rgba(13, 19, 34, 0.92);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 243, 255, 0.22);
    border-radius: 12px;
    box-shadow: 0 8px 28px 0 rgba(0, 0, 0, 0.55);
    padding: 18px;
  }

  .neon-card-pink { border-color: rgba(255, 0, 255, 0.35); }
  .neon-card-green { border-color: rgba(0, 255, 157, 0.35); }
  .neon-card-purple { border-color: rgba(181, 55, 242, 0.35); }
  .neon-card-yellow { border-color: rgba(255, 238, 0, 0.35); }

  .neon-input, .neon-select, .neon-textarea {
    background: var(--bg-input);
    border: 1px solid rgba(0, 243, 255, 0.28);
    color: var(--text-main);
    padding: 9px 12px;
    border-radius: 7px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 15px;
    font-weight: 500;
    width: 100%;
    box-sizing: border-box;
  }

  .neon-input:focus, .neon-select:focus, .neon-textarea:focus {
    outline: none;
    border-color: var(--neon-cyan);
    box-shadow: 0 0 10px rgba(0, 243, 255, 0.35);
  }

  .neon-btn {
    background: rgba(0, 243, 255, 0.04);
    border: 1px solid var(--neon-cyan);
    color: var(--neon-cyan);
    padding: 8px 14px;
    border-radius: 7px;
    font-family: 'Orbitron', sans-serif;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    transition: all 0.18s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .neon-btn:hover:not(:disabled) {
    background: var(--neon-cyan);
    color: #000;
    box-shadow: 0 0 15px var(--neon-cyan);
  }

  .neon-btn:disabled { opacity: 0.35; cursor: not-allowed; border-color: #555; color: #777; }

  .neon-btn-fillCyan { background: linear-gradient(90deg, #00c6ff, #0072ff); border: 1px solid var(--neon-cyan); color: #fff; }
  .neon-btn-fillCyan:hover:not(:disabled) { background: var(--neon-cyan); color: #000; box-shadow: 0 0 20px var(--neon-cyan); }

  .neon-btn-green { border-color: var(--neon-green); color: var(--neon-green); }
  .neon-btn-green:hover:not(:disabled) { background: var(--neon-green); color: #000; box-shadow: 0 0 15px var(--neon-green); }

  .neon-btn-pink { border-color: var(--neon-pink); color: var(--neon-pink); }
  .neon-btn-pink:hover:not(:disabled) { background: var(--neon-pink); color: #000; box-shadow: 0 0 15px var(--neon-pink); }

  .neon-btn-purple { border-color: var(--neon-purple); color: var(--neon-purple); }
  .neon-btn-purple:hover:not(:disabled) { background: var(--neon-purple); color: #fff; box-shadow: 0 0 15px var(--neon-purple); }

  .neon-btn-red { border-color: var(--neon-red); color: var(--neon-red); }
  .neon-btn-red:hover:not(:disabled) { background: var(--neon-red); color: #fff; box-shadow: 0 0 15px var(--neon-red); }

  .neon-table { width: 100%; border-collapse: collapse; font-size: 14.5px; }
  .neon-table th { background: rgba(0, 243, 255, 0.08); color: var(--neon-cyan); font-family: 'Orbitron', sans-serif; font-size: 10.5px; padding: 11px; text-align: left; border-bottom: 2px solid rgba(0, 243, 255, 0.35); }
  .neon-table td { padding: 10px 11px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .neon-table tr:hover td { background: rgba(0, 243, 255, 0.03); }

  .neon-badge { padding: 3px 8px; border-radius: 16px; font-size: 9.5px; font-weight: 700; font-family: 'Orbitron', sans-serif; text-transform: uppercase; display: inline-block; }

  .glow-text-cyan { color: var(--neon-cyan); text-shadow: 0 0 8px rgba(0, 243, 255, 0.5); }
  .glow-text-green { color: var(--neon-green); text-shadow: 0 0 8px rgba(0, 255, 157, 0.5); }
  .glow-text-pink { color: var(--neon-pink); text-shadow: 0 0 8px rgba(255, 0, 255, 0.5); }
  .glow-text-red { color: var(--neon-red); text-shadow: 0 0 8px rgba(255, 0, 85, 0.5); }
  .glow-text-yellow { color: var(--neon-yellow); text-shadow: 0 0 8px rgba(255, 238, 0, 0.5); }

  .label-neon { display: block; font-size: 10.5px; font-weight: 700; color: var(--neon-cyan); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

  .erp-layout { display: flex; min-height: calc(100vh - 60px); }
  .erp-sidebar { width: 235px; background: rgba(8, 12, 22, 0.98); border-right: 1px solid rgba(0, 243, 255, 0.2); padding: 18px 12px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .erp-main { flex: 1; padding: 22px; overflow-x: hidden; }
  .side-btn { width: 100%; justify-content: flex-start; padding: 11px 14px; font-size: 11px; border-color: transparent; color: #94a3b8; background: transparent; }
  .side-btn:hover { background: rgba(0, 243, 255, 0.08); color: #fff; box-shadow: none; }
  .side-btn.active { background: linear-gradient(90deg, rgba(0, 243, 255, 0.18), transparent); border-left: 3px solid var(--neon-cyan); color: var(--neon-cyan); }

  @media (max-width: 900px) {
    .erp-layout { flex-direction: column; }
    .erp-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 10px; box-sizing: border-box; }
    .side-btn { width: auto; white-space: nowrap; }
  }
`;

const aplicarRedondeo = (valor: number, multiploStr: string) => {
  const multiplo = Number(multiploStr) || 1;
  if (multiplo <= 1) return Math.round(valor);
  return Math.ceil(valor / multiplo) * multiplo;
};

// ========================================================
// 1. E-COMMERCE B2B & MAYORISTA (SOPORTA NIVELES GREMIO)
// ========================================================
const TiendaPublica = ({ user }: { user: User | null }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [productos, setProductos] = useState<any[]>([]);
  const [talleresGremio, setTalleresGremio] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [modoCheckout, setModoCheckout] = useState(false);
  const [pedidoRealizado, setPedidoRealizado] = useState<any | null>(null);
  const [formCheckout, setFormCheckout] = useState({ nombre: '', telefono: '', metodoEnvio: 'retiro', direccion: '', metodoPago: 'transferencia', notas: '' });
  const [procesando, setProcesando] = useState(false);

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
    return () => { unsubConfig(); unsubProd(); unsubTalleres(); };
  }, []);

  const tallerAsociado = talleresGremio.find(t => t.email?.toLowerCase() === user?.email?.toLowerCase());
  const porcentajeDescuentoGremio = tallerAsociado 
    ? (tallerAsociado.nivel === 'Oro' ? Number(config.descuentoGremioOro || 18) : Number(config.descuentoGremioBronce || 10))
    : 0;

  const calcularPrecioFinalCliente = (precioBase: number) => {
    if (!porcentajeDescuentoGremio) return precioBase;
    return aplicarRedondeo(precioBase * (1 - porcentajeDescuentoGremio / 100), config.redondeoPrecios);
  };

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
    const precioAplicado = calcularPrecioFinalCliente(producto.precio);
    const item = carrito.find(i => i.idBaseDatos === producto.idBaseDatos);
    if (item && item.cantidad < producto.stock) {
      setCarrito(carrito.map(i => i.idBaseDatos === producto.idBaseDatos ? { ...i, cantidad: i.cantidad + 1, precio: precioAplicado } : i));
    } else if (!item && producto.stock > 0) {
      setCarrito([...carrito, { ...producto, precio: precioAplicado, cantidad: 1 }]);
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
        cliente: { ...formCheckout, emailUsuario: user?.email || '', tallerId: tallerAsociado?.id || null }, 
        items: carrito, subtotal: totalCarrito, costoEnvio: costoEnvioActual, total: totalFinal,
        estadoPago: formCheckout.metodoPago === 'cta_cte' ? 'cta_cte' : 'pendiente', 
        estadoEnvio: 'preparacion', fecha: serverTimestamp(),
      });

      if (formCheckout.metodoPago === 'cta_cte' && tallerAsociado) {
        await updateDoc(doc(db, 'talleres_gremio', tallerAsociado.id), {
          saldoDeudor: Number(tallerAsociado.saldoDeudor || 0) + totalFinal
        });
      }

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

  if (cargando) return <div style={{ textAlign: 'center', padding: '80px', color: '#00f3ff', fontFamily: 'Orbitron' }}>⚡ CARGANDO HUB MAYORISTA B2B...</div>;

  return (
    <div style={{ padding: '25px', maxWidth: '1380px', margin: '0 auto', display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 65%' }}>
        <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderLeft: '4px solid #00f3ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {config.logoUrl ? <img src={config.logoUrl} alt="Logo" style={{ height: '55px', borderRadius: '8px' }} /> : <div style={{ fontSize: '32px' }}>⚡</div>}
            <div>
              <h2 className="glow-text-cyan" style={{ margin: 0 }}>{config.empresaNombre}</h2>
              <p style={{ margin: '3px 0 0 0', color: '#8b9bb4', fontSize: '14px' }}>{config.eslogan} | 📍 {config.direccion}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: '#8b9bb4' }}>
            <div>🕒 {config.horariosAtencion}</div>
            {tallerAsociado && (
              <div className="neon-badge" style={{ background: 'rgba(0,255,157,0.15)', color: '#00ff9d', marginTop: '5px' }}>
                🏢 CONVENIO GREMIO {tallerAsociado.nivel.toUpperCase()} (-{porcentajeDescuentoGremio}%) | Cta. Cte: ${tallerAsociado.saldoDeudor || 0}
              </div>
            )}
          </div>
        </div>

        {!puedeVerPrecios && (
          <div className="neon-card neon-card-pink" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#ff99ff', fontWeight: 600 }}>🔒 Catálogo exclusivo para Talleres y Clientes Registrados. Inicia sesión para ver precios.</span>
            <Link to="/admin-login" className="neon-btn neon-btn-pink" style={{ textDecoration: 'none' }}>Ingresar</Link>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input type="text" className="neon-input" placeholder="🔍 Buscar módulo, integrado, batería o herramienta..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: '2 1 280px' }} />
          <select className="neon-select" value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)} style={{ flex: '1 1 180px' }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '18px' }}>
          {productosFiltrados.map(prod => {
            const precioMostrado = calcularPrecioFinalCliente(prod.precio);
            return (
              <div key={prod.idBaseDatos} className="neon-card" style={{ border: prod.destacado && prod.stock > 0 ? '1px solid #ffee00' : undefined, position: 'relative', opacity: prod.stock === 0 ? 0.55 : 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {prod.destacado && prod.stock > 0 && (
                    <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#ffee00', color: '#000', padding: '2px 9px', borderRadius: '20px', fontWeight: 900, fontSize: '10px', fontFamily: 'Orbitron' }}>⚡ DESTACADO</div>
                  )}
                  <div style={{ height: '125px', background: '#070a12', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {prod.imagenUrl ? <img src={prod.imagenUrl} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="prod" /> : <span style={{ fontSize: '32px', opacity: 0.3 }}>📦</span>}
                  </div>
                  <span className="neon-badge" style={{ background: 'rgba(0,243,255,0.1)', color: '#00f3ff', border: '1px solid rgba(0,243,255,0.3)', marginBottom: '6px' }}>{prod.categoria || 'General'}</span>
                  <h4 style={{ margin: '6px 0 4px 0', fontSize: '15px', color: '#fff' }}>{prod.nombre}</h4>
                  <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '0 0 10px 0' }}>{prod.descripcion}</p>
                </div>
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                    {prod.stock === 0 ? <span className="glow-text-red">● AGOTADO</span> : prod.stock <= config.stockCriticoAlerta ? <span style={{ color: '#ffee00' }}>⚠️ ÚLTIMOS {prod.stock}</span> : <span className="glow-text-green">● DISPONIBLE ({prod.stock})</span>}
                  </div>
                  {puedeVerPrecios ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                      <div>
                        {porcentajeDescuentoGremio > 0 && <span style={{ fontSize: '11px', textDecoration: 'line-through', color: '#8b9bb4', display: 'block' }}>${prod.precio?.toLocaleString()}</span>}
                        <b className="glow-text-cyan" style={{ fontSize: '20px', fontFamily: 'Orbitron' }}>${precioMostrado?.toLocaleString()}</b>
                      </div>
                      <button onClick={() => agregarAlCarrito(prod)} disabled={prod.stock <= 0} className="neon-btn neon-btn-fillCyan">
                        {prod.stock > 0 ? '+ Sumar' : 'Sin Stock'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', textAlign: 'center', fontSize: '12px', color: '#8b9bb4' }}>🔒 Precio Gremio Oculto</div>
                  )}
                </div>
              </div>
            );
          })}
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
              </div>
              <button onClick={() => window.open(`https://wa.me/${config.whatsapp}?text=Hola,%20confirmo%20pedido%20B2B%20%23${pedidoRealizado.id.slice(-6).toUpperCase()}%20por%20$${pedidoRealizado.total}`, '_blank')} className="neon-btn neon-btn-green" style={{ width: '100%' }}>
                💬 Coordinar por WhatsApp
              </button>
            </div>
          ) : modoCheckout ? (
            <div className="neon-card" style={{ position: 'sticky', top: '20px' }}>
              <h3 className="glow-text-cyan" style={{ margin: '0 0 20px 0' }}>📝 FINALIZAR PEDIDO B2B</h3>
              <form onSubmit={confirmarPedido} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><label className="label-neon">Taller / Cliente</label><input type="text" className="neon-input" required value={formCheckout.nombre} onChange={e=>setFormCheckout({...formCheckout, nombre: e.target.value})} /></div>
                <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" required value={formCheckout.telefono} onChange={e=>setFormCheckout({...formCheckout, telefono: e.target.value})} /></div>
                <div>
                  <label className="label-neon">Modalidad de Pago</label>
                  <select className="neon-select" value={formCheckout.metodoPago} onChange={e=>setFormCheckout({...formCheckout, metodoPago: e.target.value})}>
                    <option value="transferencia">Transferencia / Mercado Pago</option>
                    <option value="efectivo">Efectivo en Mostrador</option>
                    {tallerAsociado && <option value="cta_cte">🏢 Cargar a mi Cuenta Corriente Gremio</option>}
                  </select>
                </div>
                <div>
                  <label className="label-neon">Entrega</label>
                  <select className="neon-select" value={formCheckout.metodoEnvio} onChange={e=>setFormCheckout({...formCheckout, metodoEnvio: e.target.value})}>
                    <option value="retiro">Retiro en Local - Gratis</option>
                    <option value="domicilio">Moto Cadetería (${costoEnvioActual})</option>
                  </select>
                </div>
                <button type="submit" disabled={procesando} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
                  {procesando ? 'Procesando...' : 'Confirmar Orden ➔'}
                </button>
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
              <button onClick={() => setModoCheckout(true)} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>Continuar Pedido ➔</button>
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
        <h2 className="glow-text-cyan">🔍 RASTREO DE LABORATORIO EN VIVO</h2>
        <p style={{ color: '#8b9bb4', marginBottom: '20px' }}>Ingresa el código de 6 dígitos o escanea el QR de tu orden</p>
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
          <p style={{ marginTop: '12px' }}><b>Falla declarada:</b> {resultado.fallaDeclarada}</p>
          <div style={{ background: '#070a12', padding: '18px', borderRadius: '8px', textAlign: 'center', margin: '18px 0', border: '1px solid #00f3ff' }}>
            <span style={{ fontSize: '11px', color: '#8b9bb4', fontFamily: 'Orbitron' }}>ESTADO EN LABORATORIO</span>
            <h2 className="glow-text-cyan" style={{ margin: '6px 0 0 0', textTransform: 'uppercase' }}>{resultado.estado}</h2>
            {resultado.costoReparacion && <h3 className="glow-text-green" style={{ margin: '10px 0 0 0' }}>Presupuesto / Total: ${resultado.costoReparacion}</h3>}
          </div>
          <h4 className="glow-text-cyan" style={{ fontSize: '13px' }}>📋 BITÁCORA TÉCNICA:</h4>
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
        <h2 className="glow-text-cyan">🔐 ACCESO ERP / GREMIO</h2>
        <form onSubmit={async (ev) => { ev.preventDefault(); try { await signInWithEmailAndPassword(auth, e, p); navigate('/admin-panel'); } catch (err) { alert('Credenciales incorrectas'); } }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <input type="email" className="neon-input" placeholder="Email" value={e} onChange={ex => setE(ex.target.value)} required/>
          <input type="password" className="neon-input" placeholder="Contraseña" value={p} onChange={ex => setP(ex.target.value)} required/>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '12px' }}>Ingresar al Sistema ➔</button>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 4. PANEL ERP INDUSTRIAL REORGANIZADO (SIDEBAR + 11 MÓDULOS)
// ========================================================
const DashboardTaller = ({ user }: { user: User }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidosWeb, setPedidosWeb] = useState<any[]>([]); 
  const [movimientosFinanzas, setMovimientosFinanzas] = useState<any[]>([]); 
  const [usuariosRoles, setUsuariosRoles] = useState<any[]>([]);
  const [talleresGremio, setTalleresGremio] = useState<any[]>([]);
  const [rmas, setRmas] = useState<any[]>([]);
  const [pestaña, setPestaña] = useState('dashboard'); 

  // --- POS Mostrador Multicaja ---
  const [carritoPOS, setCarritoPOS] = useState<any[]>([]);
  const [busquedaPOS, setBusquedaPOS] = useState('');
  const [metodoPagoPOS, setMetodoPagoPOS] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'>('efectivo');
  const [clientePOS, setClientePOS] = useState('Consumidor Final');

  // --- CRM Taller & Recepción ---
  const [cliNombre, setCliNombre] = useState(''); const [cliTel, setCliTel] = useState(''); const [cliDni, setCliDni] = useState('');
  const [tallerOrigenOrden, setTallerOrigenOrden] = useState('Mostrador Propio');
  const [marca, setMarca] = useState(''); const [modelo, setModelo] = useState('');
  const [falla, setFalla] = useState(''); const [tecnico, setTecnico] = useState('');
  const [imei, setImei] = useState(''); const [contrasena, setContrasena] = useState('');
  const [condicionVisual, setCondicionVisual] = useState('');
  const [presupuestoInicial, setPresupuestoInicial] = useState('');
  const [señaRecibida, setSeñaRecibida] = useState('');
  const [checklist, setChecklist] = useState<string[]>(["Enciende", "Batería OK"]);

  // Filtros de Taller
  const [filtroEstadoTaller, setFiltroEstadoTaller] = useState('todos');
  const [filtroSectorTaller, setFiltroSectorTaller] = useState('todos');
  const [busquedaTaller, setBusquedaTaller] = useState('');

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
  
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [filtroCategoriaInv, setFiltroCategoriaInv] = useState('Todas');
  const [filtroStockInv, setFiltroStockInv] = useState('todos'); 
  const [escaneandoPara, setEscaneandoPara] = useState<'formulario' | 'buscador' | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // --- Red de Talleres Asociados B2B (Gremio) ---
  const [tallerNom, setTallerNom] = useState('');
  const [tallerEncargado, setTallerEncargado] = useState('');
  const [tallerTel, setTallerTel] = useState('');
  const [tallerEmail, setTallerEmail] = useState('');
  const [tallerCiudad, setTallerCiudad] = useState('Necochea');
  const [tallerNivel, setTallerNivel] = useState<'Bronce' | 'Oro'>('Bronce');
  const [tallerLimiteCredito, setTallerLimiteCredito] = useState('150000');

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

  // --- Usuarios / Roles ---
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
    const unsubTalleres = onSnapshot(query(collection(db, 'talleres_gremio')), (snap) => setTalleresGremio(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRmas = onSnapshot(query(collection(db, 'rmas_garantias')), (snap) => setRmas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); unsubFinanzas(); unsubRoles(); unsubTalleres(); unsubRmas(); };
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

  // --- Funciones POS Mostrador Multicaja ---
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
        const prodReal = productos.find(p => p.id === item.id);
        if (prodReal) {
          await updateDoc(doc(db, 'productos', item.id), {
            stock: Math.max(0, prodReal.stock - item.cantidad),
            ventas: (prodReal.ventas || 0) + item.cantidad
          });
        }
      }
      await addDoc(collection(db, 'finanzas'), {
        tipo: 'ingreso',
        concepto: `Venta POS Mostrador (${clientePOS}) - ${carritoPOS.length} ítems`,
        monto: totalFinalPOS,
        costoAsociado: costoTotalPOS,
        metodoPago: metodoPagoPOS,
        fecha: serverTimestamp(),
        usuario: user.email,
        items: carritoPOS.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }))
      });
      setCarritoPOS([]);
      setClientePOS('Consumidor Final');
      alert(`⚡ Cobro de $${totalFinalPOS.toLocaleString()} registrado en Caja y stock descontado.`);
    } catch (e) {
      alert('Error al procesar venta POS.');
    }
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

  // --- Funciones Taller e Imputación de Repuestos ---
  const toggleItemChecklist = (item: string) => {
    setChecklist(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const guardarOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    const cod = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'ordenes_taller'), {
      idTiendaOrigen: user.uid, 
      tallerOrigen: tallerOrigenOrden,
      cliente: { nombre: cliNombre, telefono: cliTel, dni: cliDni }, 
      equipo: { marca, modelo, imei, contrasena, condicionVisual, checklist }, 
      fallaDeclarada: falla, 
      tecnicoAsignado: tecnico,
      costoReparacion: presupuestoInicial || '',
      costoRepuestosUsados: 0,
      repuestosLista: [],
      seña: Number(señaRecibida) || 0,
      estado: 'ingresado', 
      codigoSeguimiento: cod, 
      fechaIngreso: serverTimestamp(), 
      historial: [{ estado: 'ingresado', fecha: new Date().toLocaleString(), comentario: `Equipo recepcionado (${tallerOrigenOrden}).` }]
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

  const imputarRepuestoAOrden = async (orden: any) => {
    const busquedaRep = prompt('Escribe parte del nombre del repuesto usado (Ej: A52, Pin, Modulo):');
    if (!busquedaRep) return;
    const candidatos = productos.filter(p => p.stock > 0 && p.nombre.toLowerCase().includes(busquedaRep.toLowerCase()));
    if (candidatos.length === 0) return alert('No se encontraron repuestos con stock con ese nombre.');
    
    const listaOpciones = candidatos.slice(0, 8).map((c, idx) => `${idx + 1}. ${c.nombre} (Stock: ${c.stock} | Costo: $${c.costoProveedor || 0})`).join('\n');
    const eleccion = prompt(`Selecciona el número del repuesto a descontar del Pañol:\n\n${listaOpciones}`);
    const indexElegido = Number(eleccion) - 1;
    if (isNaN(indexElegido) || !candidatos[indexElegido]) return;

    const repuesto = candidatos[indexElegido];
    await updateDoc(doc(db, 'productos', repuesto.id), { stock: repuesto.stock - 1 });
    await updateDoc(doc(db, 'ordenes_taller', orden.id), {
      costoRepuestosUsados: Number(orden.costoRepuestosUsados || 0) + Number(repuesto.costoProveedor || 0),
      repuestosLista: arrayUnion({ nombre: repuesto.nombre, costo: Number(repuesto.costoProveedor || 0) }),
      historial: arrayUnion({ estado: orden.estado, fecha: new Date().toLocaleString(), comentario: `Repuesto instalado desde Pañol: ${repuesto.nombre}` })
    });
    alert(`🔩 Repuesto "${repuesto.nombre}" descontado del stock y vinculado a la orden #${orden.codigoSeguimiento}.`);
  };

  const actualizarEstado = async (id: string, nuevoEstado: string, orden: any) => {
    const comentario = prompt(`Diagnóstico / Comentario para estado '${nuevoEstado}':`) || 'Actualización técnica';
    let data: any = { estado: nuevoEstado, historial: arrayUnion({ estado: nuevoEstado, fecha: new Date().toLocaleString(), comentario }) };
    if (nuevoEstado === 'reparado') { 
      const costo = prompt('Confirma el Precio Final a cobrar ($):', orden.costoReparacion || ''); 
      if(costo) data.costoReparacion = costo; 
    }
    if (nuevoEstado === 'entregado' && orden.costoReparacion) {
      const saldoRestante = Math.max(0, Number(orden.costoReparacion) - Number(orden.seña || 0));
      const tallerColega = talleresGremio.find(t => t.nombre === orden.tallerOrigen);
      if (tallerColega && saldoRestante > 0) {
        if (window.confirm(`Esta orden pertenece al taller asociado "${tallerColega.nombre}". ¿Cargar el saldo de $${saldoRestante} a su Cuenta Corriente B2B?`)) {
          await updateDoc(doc(db, 'talleres_gremio', tallerColega.id), {
            saldoDeudor: Number(tallerColega.saldoDeudor || 0) + saldoRestante
          });
          await updateDoc(doc(db, 'ordenes_taller', id), data);
          return alert(`Saldo de $${saldoRestante} cargado a la Cuenta Corriente de ${tallerColega.nombre}.`);
        }
      }

      if (saldoRestante > 0 && window.confirm(`¿Registrar cobro del saldo restante ($${saldoRestante}) en Caja?`)) {
        const metodo = prompt('Método de pago (efectivo, transferencia, mercadopago, tarjeta):', 'efectivo') || 'efectivo';
        await addDoc(collection(db, 'finanzas'), {
          tipo: 'ingreso',
          concepto: `Cobro Taller Orden #${orden.codigoSeguimiento} - ${orden.equipo?.marca} ${orden.equipo?.modelo}`,
          monto: saldoRestante,
          costoAsociado: Number(orden.costoRepuestosUsados || 0),
          metodoPago: metodo.toLowerCase(),
          fecha: serverTimestamp(),
          usuario: user.email
        });
      }
    }
    await updateDoc(doc(db, 'ordenes_taller', id), data);
  };

  const notificarClienteWhatsApp = (orden: any) => {
    const urlBase = window.location.origin;
    const saldo = Math.max(0, Number(orden.costoReparacion || 0) - Number(orden.seña || 0));
    let msg = `Hola ${orden.cliente.nombre}, te escribimos de *${config.empresaNombre}*.\n`;
    msg += `Tu equipo *${orden.equipo.marca} ${orden.equipo.modelo}* (Orden #${orden.codigoSeguimiento}) cambió al estado: *${orden.estado.toUpperCase()}*.\n`;
    if (orden.historial?.length > 0) msg += `📝 *Informe:* ${orden.historial[orden.historial.length - 1].comentario}\n`;
    if (orden.costoReparacion) msg += `💰 *Total:* $${orden.costoReparacion} ${orden.seña ? `(Seña: $${orden.seña} | Saldo: $${saldo})` : ''}\n`;
    msg += `\n🔍 Seguimiento en vivo: ${urlBase}/seguimiento?codigo=${orden.codigoSeguimiento}`;
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
            .btn-print { background: #00f3ff; color: #000; border: none; padding: 8px 16px; border-radius: 5px; font-weight: bold; cursor: pointer; }
            .btn-mode { background: #333; color: #fff; border: 1px solid #555; padding: 8px 14px; border-radius: 5px; cursor: pointer; margin-right: 6px; }
            .btn-mode.active { background: #00ff9d; color: #000; font-weight: bold; }
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
              <button class="btn-mode active" onclick="cambiarFormato('a4')">📄 Hoja A4 Dual</button>
              <button class="btn-mode" onclick="cambiarFormato('thermal')">🧾 Ticket Térmico 80mm</button>
            </div>
            <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR</button>
          </div>
          <div id="vista-a4" class="page-a4">
            <div class="header-a4">
              <div>
                <h1 class="brand-title">${config.empresaNombre}</h1>
                <div style="font-size:12px; font-weight:bold;">${config.eslogan}</div>
                <div style="font-size:11px;">📍 ${config.direccion} | WhatsApp: ${config.whatsapp} | CUIT: ${config.cuit}</div>
              </div>
              <div class="order-box">
                <div style="font-size:10px; font-weight:bold;">ORDEN DE LABORATORIO (${orden.tallerOrigen || 'Mostrador'})</div>
                <div class="order-code">#${orden.codigoSeguimiento}</div>
                <div style="font-size:10px;">${fechaFormateada}</div>
              </div>
            </div>
            <div class="grid-2">
              <div class="panel">
                <div class="panel-title">👤 Cliente / Origen</div>
                <div class="row-data"><b>Nombre:</b> ${orden.cliente?.nombre}</div>
                <div class="row-data"><b>WhatsApp:</b> ${orden.cliente?.telefono}</div>
                <div class="row-data"><b>DNI / Origen:</b> ${orden.cliente?.dni || '-'} (${orden.tallerOrigen || 'Propio'})</div>
              </div>
              <div class="panel">
                <div class="panel-title">📱 Equipo</div>
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
              <div class="sig-line">Recibió por ${config.empresaNombre}</div>
            </div>
            <div class="cut-line"><span>✂️ TALÓN PARA EL CLIENTE ✂️</span></div>
            <div style="display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; border-radius: 8px; padding: 14px;">
              <div>
                <h3 style="margin: 0 0 4px 0;">${config.empresaNombre} - TALÓN DE RETIRO</h3>
                <div style="font-size: 12px;">📍 ${config.direccion} | 📱 WhatsApp: ${config.whatsapp}</div>
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
            <h2 style="margin:0;">${config.empresaNombre}</h2>
            <div style="font-size: 11px;">${config.direccion}<br/>Tel: ${config.whatsapp}</div>
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
    const faltantes = productos.filter(p => p.stock <= config.stockCriticoAlerta);
    if (faltantes.length === 0) return alert('No hay faltantes.');
    let msg = `Hola! Reponer para *${config.empresaNombre}*:\n\n`; faltantes.forEach(p => { msg += `▪️ ${p.stock === 0 ? 5 : 3}x ${p.nombre}\n`; }); 
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- Funciones Red de Talleres Gremio B2B ---
  const guardarTallerGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'talleres_gremio'), {
      nombre: tallerNom, encargado: tallerEncargado, telefono: tallerTel, email: tallerEmail.trim().toLowerCase(),
      ciudad: tallerCiudad, nivel: tallerNivel, limiteCredito: Number(tallerLimiteCredito) || 0, saldoDeudor: 0, fechaAlta: serverTimestamp()
    });
    setTallerNom(''); setTallerEncargado(''); setTallerTel(''); setTallerEmail('');
    alert('🏢 Taller asociado registrado en la red B2B.');
  };

  const registrarPagoCtaCteTaller = async (taller: any) => {
    const abono = Number(prompt(`Saldo actual de ${taller.nombre}: $${taller.saldoDeudor || 0}\nIngresa el monto que abona ($):`, taller.saldoDeudor || '0'));
    if (!abono || abono <= 0) return;
    await updateDoc(doc(db, 'talleres_gremio', taller.id), {
      saldoDeudor: Math.max(0, Number(taller.saldoDeudor || 0) - abono)
    });
    await addDoc(collection(db, 'finanzas'), {
      tipo: 'ingreso',
      concepto: `Cobro Cta. Cte. Gremio - Taller: ${taller.nombre}`,
      monto: abono,
      metodoPago: 'transferencia',
      fecha: serverTimestamp(),
      usuario: user.email
    });
    alert('⚡ Pago imputado en Cuenta Corriente y sumado a Caja.');
  };

  // --- Funciones RMA y Garantías ---
  const guardarRMA = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'rmas_garantias'), {
      tipo: rmaTipo, producto: rmaProducto, entidad: rmaEntidad, motivo: rmaMotivo,
      monto: Number(rmaMonto) || 0, estado: 'pendiente', fecha: new Date().toLocaleDateString()
    });
    setRmaProducto(''); setRmaEntidad(''); setRmaMotivo(''); setRmaMonto('');
  };

  // --- Filtros ---
  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroEstadoTaller !== 'todos' && o.estado !== filtroEstadoTaller) return false;
    if (filtroSectorTaller !== 'todos' && o.tecnicoAsignado !== filtroSectorTaller) return false;
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

  const categoriasUnicasInv = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria || 'General')))];
  const inventarioFiltrado = productos.filter(p => {
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
    if (!window.confirm(`¿Eliminar ${seleccionados.length} productos?`)) return;
    const batch = writeBatch(db); seleccionados.forEach(id => { batch.delete(doc(db, 'productos', id)); });
    await batch.commit(); setSeleccionados([]);
  };

  const cambiarEstadoPagoPedido = async (pedido: any, nuevoEstado: string) => {
    if (nuevoEstado === 'pagado' && pedido.estadoPago !== 'pagado') {
      const confirmar = window.confirm(`¿Registrar ingreso de $${pedido.total} en Finanzas?`);
      if (confirmar) {
        await addDoc(collection(db, 'finanzas'), { 
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
    await addDoc(collection(db, 'finanzas'), { tipo: finTipo, concepto: finConcepto, monto: Number(finMonto), metodoPago: finMetodo, fecha: serverTimestamp(), usuario: user.email }); 
    setFinConcepto(''); setFinMonto('');
  };

  const guardarConfiguracion = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    await setDoc(doc(db, 'configuracion', 'general'), conf, { merge: true }); 
    alert('⚡ Parámetros guardados.'); 
  };

  // --- Consolidación CRM ---
  const clientesConsolidados = React.useMemo(() => {
    const mapa = new Map<string, any>();
    ordenes.forEach(o => {
      const tel = (o.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: o.cliente?.nombre || 'Sin Nombre', telefono: o.cliente?.telefono, equipos: 0, comprasWeb: 0, totalGastado: 0 };
      actual.equipos += 1;
      actual.totalGastado += Number(o.costoReparacion || 0);
      mapa.set(tel, actual);
    });
    pedidosWeb.forEach(p => {
      const tel = (p.cliente?.telefono || '').replace(/\D/g, '');
      if (!tel) return;
      const actual = mapa.get(tel) || { nombre: p.cliente?.nombre || 'Cliente Web', telefono: p.cliente?.telefono, equipos: 0, comprasWeb: 0, totalGastado: 0 };
      actual.comprasWeb += 1;
      actual.totalGastado += Number(p.total || 0);
      mapa.set(tel, actual);
    });
    return Array.from(mapa.values()).filter(c => c.nombre.toLowerCase().includes(busquedaClienteCRM.toLowerCase()) || c.telefono.includes(busquedaClienteCRM)).sort((a, b) => b.totalGastado - a.totalGastado);
  }, [ordenes, pedidosWeb, busquedaClienteCRM]);

  const movimientosFiltrados = movimientosFinanzas.filter(m => {
    if (filtroTipoLista !== 'todos' && m.tipo !== filtroTipoLista) return false;
    if (filtroBusquedaConcepto && !m.concepto.toLowerCase().includes(filtroBusquedaConcepto.toLowerCase())) return false;
    if (m.fecha && filtroTiempo !== 'todos') {
      const fechaMov = new Date(m.fecha.seconds * 1000); const hoy = new Date();
      if (filtroTiempo === 'hoy' && fechaMov.toDateString() !== hoy.toDateString()) return false;
      if (filtroTiempo === 'mes' && (fechaMov.getMonth() !== hoy.getMonth() || fechaMov.getFullYear() !== hoy.getFullYear())) return false;
    }
    return true;
  });

  // --- KPIs Ejecutivos ---
  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const saldoNeto = totalIngresos - totalEgresos;
  const capitalCostoPanol = productos.reduce((acc, p) => acc + ((p.costoProveedor || 0) * (p.stock || 0)), 0);
  const capitalVentaPanol = productos.reduce((acc, p) => acc + ((p.precio || 0) * (p.stock || 0)), 0);
  const deudaTotalTalleresB2B = talleresGremio.reduce((acc, t) => acc + Number(t.saldoDeudor || 0), 0);
  const equiposEnBanco = ordenes.filter(o => o.estado !== 'entregado' && o.estado !== 'reparado').length;
  const equiposListosSinRetirar = ordenes.filter(o => o.estado === 'reparado').length;

  const agregarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUserEmail) return;
    await addDoc(collection(db, 'usuarios_roles'), { email: nuevoUserEmail.trim().toLowerCase(), nombre: nuevoUserNombre, rol: nuevoUserRol, fecha: serverTimestamp() });
    setNuevoUserEmail(''); setNuevoUserNombre('');
  };

  const listaSectores = (config.sectoresTaller || CONFIG_DEFAULT.sectoresTaller).split(',').map((s:string) => s.trim());

  return (
    <div className="erp-layout">
      {escaneandoPara && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <h3 className="glow-text-cyan">📷 ESCÁNER ACTIVO</h3>
            <div id="reader" style={{ width: '100%', borderRadius: '8px', background: '#fff' }}></div>
            <button onClick={() => setEscaneandoPara(null)} className="neon-btn neon-btn-red" style={{ marginTop: '15px', width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* SIDEBAR DE NAVEGACIÓN ERP */}
      <aside className="erp-sidebar">
        <div style={{ padding: '8px 10px 15px 10px', borderBottom: '1px solid rgba(0,243,255,0.15)', marginBottom: '6px' }}>
          <div className="glow-text-cyan" style={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: '14px' }}>{config.empresaNombre}</div>
          <div style={{ fontSize: '11px', color: '#8b9bb4', marginTop: '3px' }}>Rol: <b style={{ color: '#00ff9d' }}>{rolActual.toUpperCase()}</b></div>
        </div>

        <button onClick={() => setPestaña('dashboard')} className={`neon-btn side-btn ${pestaña === 'dashboard' ? 'active' : ''}`}>📊 1. Centro de Comando</button>
        {rolActual !== 'tecnico' && (
          <button onClick={() => setPestaña('pos')} className={`neon-btn side-btn ${pestaña === 'pos' ? 'active' : ''}`}>🛒 2. Caja POS Mostrador</button>
        )}
        <button onClick={() => setPestaña('taller')} className={`neon-btn side-btn ${pestaña === 'taller' ? 'active' : ''}`}>🛠️ 3. Laboratorio ({equiposEnBanco})</button>
        <button onClick={() => setPestaña('talleres_b2b')} className={`neon-btn side-btn ${pestaña === 'talleres_b2b' ? 'active' : ''}`}>🏢 4. Red Talleres B2B ({talleresGremio.length})</button>
        <button onClick={() => setPestaña('catalogo')} className={`neon-btn side-btn ${pestaña === 'catalogo' ? 'active' : ''}`}>📦 5. Pañol & Inventario</button>
        <button onClick={() => setPestaña('rma')} className={`neon-btn side-btn ${pestaña === 'rma' ? 'active' : ''}`}>🔄 6. Garantías & RMA</button>
        
        {rolActual !== 'tecnico' && (
          <>
            <button onClick={() => setPestaña('pedidos')} className={`neon-btn side-btn ${pestaña === 'pedidos' ? 'active' : ''}`}>🌐 7. Pedidos Web B2B</button>
            <button onClick={() => setPestaña('clientes')} className={`neon-btn side-btn ${pestaña === 'clientes' ? 'active' : ''}`}>👥 8. CRM & Promos</button>
          </>
        )}
        {rolActual === 'admin' && (
          <>
            <button onClick={() => setPestaña('proveedores')} className={`neon-btn side-btn ${pestaña === 'proveedores' ? 'active' : ''}`}>🚚 9. Importador Excel</button>
            <button onClick={() => setPestaña('finanzas')} className={`neon-btn side-btn ${pestaña === 'finanzas' ? 'active' : ''}`}>💰 10. Finanzas & IVA</button>
            <button onClick={() => setPestaña('configuracion')} className={`neon-btn side-btn ${pestaña === 'configuracion' ? 'active' : ''}`}>⚙️ 11. Config & Roles</button>
          </>
        )}

        <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: 'auto', width: '100%' }}>🚪 Cerrar Sesión</button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="erp-main">

        {/* ========================================== */}
        {/* MÓDULO 1: DASHBOARD EJECUTIVO & KPIS       */}
        {/* ========================================== */}
        {pestaña === 'dashboard' && (
          <div>
            <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>📊 CENTRO DE COMANDO // ESTADO EN TIEMPO REAL</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '25px' }}>
              <div className="neon-card">
                <span className="label-neon">🔬 Equipos en Banco</span>
                <h2 className="glow-text-cyan" style={{ margin: '6px 0' }}>{equiposEnBanco}</h2>
                <span style={{ fontSize: '12px', color: '#8b9bb4' }}>Pendientes de diagnóstico/repuesto</span>
              </div>
              <div className="neon-card neon-card-green">
                <span className="label-neon" style={{ color: '#00ff9d' }}>✅ Listos para Entregar</span>
                <h2 className="glow-text-green" style={{ margin: '6px 0' }}>{equiposListosSinRetirar}</h2>
                <span style={{ fontSize: '12px', color: '#8b9bb4' }}>Cobro pendiente en mostrador</span>
              </div>
              <div className="neon-card neon-card-pink">
                <span className="label-neon" style={{ color: '#ff00ff' }}>🏢 Ctas. Ctes. Talleres B2B</span>
                <h2 className="glow-text-pink" style={{ margin: '6px 0' }}>${deudaTotalTalleresB2B.toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: '#8b9bb4' }}>Saldo a cobrar de {talleresGremio.length} talleres</span>
              </div>
              {rolActual === 'admin' && (
                <div className="neon-card neon-card-yellow">
                  <span className="label-neon" style={{ color: '#ffee00' }}>📦 Capital en Pañol (Venta)</span>
                  <h2 className="glow-text-yellow" style={{ margin: '6px 0' }}>${capitalVentaPanol.toLocaleString()}</h2>
                  <span style={{ fontSize: '12px', color: '#8b9bb4' }}>Costo base: ${capitalCostoPanol.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <div className="neon-card">
                <h3 className="glow-text-cyan" style={{ marginTop: 0, fontSize: '15px' }}>⚡ ACCESOS RÁPIDOS DE OPERACIÓN</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => setPestaña('pos')} className="neon-btn neon-btn-green" style={{ padding: '14px' }}>🛒 Nueva Venta POS</button>
                  <button onClick={() => setPestaña('taller')} className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>➕ Ingresar Equipo</button>
                  <button onClick={() => setPestaña('talleres_b2b')} className="neon-btn neon-btn-pink" style={{ padding: '14px' }}>🏢 Cuentas Gremio</button>
                  <button onClick={pedirFaltantes} className="neon-btn" style={{ padding: '14px' }}>📱 Pedir Faltantes</button>
                </div>
              </div>

              <div className="neon-card">
                <h3 className="glow-text-green" style={{ marginTop: 0, fontSize: '15px' }}>🏆 TOP 5 REPUESTOS DE MAYOR ROTACIÓN</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {[...productos].sort((a, b) => (b.ventas || 0) - (a.ventas || 0)).slice(0, 5).map((p, i) => (
                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '14px' }}>
                      <span><b style={{ color: '#00f3ff' }}>#{i + 1}</b> {p.nombre} <small style={{ color: '#8b9bb4' }}>({p.ubicacion || 'S/U'})</small></span>
                      <span className="neon-badge" style={{ background: 'rgba(0,255,157,0.15)', color: '#00ff9d' }}>{p.ventas || 0} vendidos</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 2: PUNTO DE VENTA (POS MOSTRADOR)   */}
        {/* ========================================== */}
        {pestaña === 'pos' && (
          <div>
            <h2 className="glow-text-green" style={{ marginTop: 0 }}>🛒 PUNTO DE VENTA (POS MOSTRADOR MULTICAJA)</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div className="neon-card" style={{ flex: '2 1 500px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <input type="text" className="neon-input" placeholder="🔍 Escanea código de barras o escribe modelo del repuesto/accesorio..." value={busquedaPOS} onChange={e=>setBusquedaPOS(e.target.value)} />
                  <button onClick={() => setEscaneandoPara('buscador')} className="neon-btn">📷 Lector</button>
                </div>
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table className="neon-table">
                    <thead><tr><th>Ubicación</th><th>Artículo</th><th>Stock</th><th>Precio</th><th>Acción</th></tr></thead>
                    <tbody>
                      {productos.filter(p => p.stock > 0 && (p.nombre.toLowerCase().includes(busquedaPOS.toLowerCase()) || (p.codigoBarras && p.codigoBarras.includes(busquedaPOS)))).slice(0, 20).map(p => (
                        <tr key={p.id}>
                          <td><span className="neon-badge" style={{ background: 'rgba(181,55,242,0.15)', color: '#b537f2' }}>{p.ubicacion || 'S/U'}</span></td>
                          <td><b>{p.nombre}</b><br/><small style={{ color: '#8b9bb4' }}>{p.categoria}</small></td>
                          <td style={{ color: '#00ff9d', fontWeight: 'bold' }}>{p.stock}</td>
                          <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                          <td><button onClick={() => agregarAlPOS(p)} className="neon-btn neon-btn-fillCyan">+ Sumar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="neon-card neon-card-green" style={{ flex: '1 1 320px' }}>
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>🧾 TICKET DE VENTA ACTUAL</h3>
                <div style={{ marginBottom: '10px' }}>
                  <label className="label-neon">Cliente / Destinatario</label>
                  <input type="text" className="neon-input" value={clientePOS} onChange={e=>setClientePOS(e.target.value)} />
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {carritoPOS.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div><b>{item.cantidad}x</b> {item.nombre}<br/><small style={{ color: '#00f3ff' }}>${(item.precio * item.cantidad).toLocaleString()}</small></div>
                      <button onClick={() => setCarritoPOS(carritoPOS.filter(i => i.id !== item.id))} className="neon-btn neon-btn-red" style={{ padding: '2px 6px' }}>✕</button>
                    </div>
                  ))}
                  {carritoPOS.length === 0 && <p style={{ color: '#8b9bb4', textAlign: 'center', padding: '20px 0' }}>Ticket vacío. Selecciona artículos a la izquierda.</p>}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label-neon">Condición de Pago (Calcula Desc./Recargo)</label>
                  <select className="neon-select" value={metodoPagoPOS} onChange={e=>setMetodoPagoPOS(e.target.value as any)}>
                    <option value="efectivo">💵 Efectivo (-{config.descuentoEfectivoPorcentaje}% Desc.)</option>
                    <option value="transferencia">🏦 Transferencia (Precio Lista)</option>
                    <option value="mercadopago">📱 Mercado Pago (Precio Lista)</option>
                    <option value="tarjeta">💳 Tarjeta / Cuotas (+{config.recargoTarjetaPorcentaje}% Recargo)</option>
                  </select>
                </div>

                <div style={{ background: '#060911', padding: '14px', borderRadius: '8px', marginBottom: '15px', border: '1px solid rgba(0,255,157,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}><span>Subtotal Lista:</span><span>${subtotalPOS.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: ajusteFinancieroPOS < 0 ? '#00ff9d' : '#ff0055' }}>
                    <span>Ajuste Financiero:</span><span>{ajusteFinancieroPOS >= 0 ? `+${ajusteFinancieroPOS}` : ajusteFinancieroPOS}</span>
                  </div>
                  <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', fontWeight: 'bold' }}>
                    <span>TOTAL:</span><span className="glow-text-green">${totalFinalPOS.toLocaleString()}</span>
                  </div>
                </div>

                <button onClick={cobrarVentaPOS} disabled={carritoPOS.length === 0} className="neon-btn neon-btn-green" style={{ width: '100%', padding: '14px', fontSize: '13px' }}>
                  ✅ COBRAR E IMPUTAR EN CAJA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 3: LABORATORIO & TALLER             */}
        {/* ========================================== */}
        {pestaña === 'taller' && (
          <div>
            <form onSubmit={guardarOrden} className="neon-card" style={{ marginBottom: '22px' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>📝 RECEPCIÓN PROFESIONAL (CLIENTES Y TALLERES B2B)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="label-neon">1. Origen & Cliente</label>
                  <select className="neon-select" value={tallerOrigenOrden} onChange={e=>setTallerOrigenOrden(e.target.value)} style={{ marginBottom: '8px', borderColor: '#ff00ff' }}>
                    <option value="Mostrador Propio">🏪 Cliente Mostrador Propio</option>
                    {talleresGremio.map(t => <option key={t.id} value={t.nombre}>🏢 Gremio B2B: {t.nombre}</option>)}
                  </select>
                  <input type="text" className="neon-input" placeholder="Nombre Cliente / Referencia" value={cliNombre} onChange={e=>setCliNombre(e.target.value)} required style={{ marginBottom: '8px' }}/>
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
                  <label className="label-neon">3. Diagnóstico y Estética</label>
                  <input type="text" className="neon-input" placeholder="Falla a reparar" value={falla} onChange={e=>setFalla(e.target.value)} required style={{ marginBottom: '8px' }}/>
                  <input type="text" className="neon-input" placeholder="Estética (Rayas, golpes)" value={condicionVisual} onChange={e=>setCondicionVisual(e.target.value)} />
                </div>
                <div>
                  <label className="label-neon">4. Sector & Presupuesto</label>
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
              <div style={{ background: '#060911', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,243,255,0.2)', marginBottom: '14px' }}>
                <span className="label-neon">✅ CHECKLIST DE RECEPCIÓN:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                  {CHECKLIST_ITEMS.map(item => (
                    <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: checklist.includes(item) ? '#00ff9d' : '#8b9bb4' }}>
                      <input type="checkbox" checked={checklist.includes(item)} onChange={() => toggleItemChecklist(item)} /> {item}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '13px' }}>➕ GENERAR ORDEN DE LABORATORIO</button>
            </form>

            <div className="neon-card" style={{ marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" className="neon-input" placeholder="🔍 Buscar por orden, cliente, taller gremio o modelo..." value={busquedaTaller} onChange={e=>setBusquedaTaller(e.target.value)} style={{ flex: '1 1 220px' }} />
              <select className="neon-select" value={filtroEstadoTaller} onChange={e=>setFiltroEstadoTaller(e.target.value)} style={{ width: 'auto' }}>
                <option value="todos">Todos los Estados</option>
                <option value="ingresado">📥 Ingresado</option>
                <option value="en revision">🔬 En Revisión</option>
                <option value="esperando repuesto">⏳ Esperando Repuesto</option>
                <option value="reparado">✅ Reparado</option>
                <option value="reingreso garantia">🔄 Garantía</option>
                <option value="entregado">📦 Entregado</option>
              </select>
              <select className="neon-select" value={filtroSectorTaller} onChange={e=>setFiltroSectorTaller(e.target.value)} style={{ width: 'auto' }}>
                <option value="todos">Todos los Sectores</option>
                {listaSectores.map((s:string)=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="neon-card" style={{ overflowX: 'auto' }}>
              <table className="neon-table">
                <thead><tr><th>Orden / Origen</th><th>Cliente</th><th>Equipo & Repuestos Imputados</th><th>Estado & Rentabilidad</th><th style={{ textAlign: 'center' }}>Acciones</th></tr></thead>
                <tbody>
                  {ordenesFiltradas.map(o => {
                    const utilidadNeta = Math.max(0, Number(o.costoReparacion || 0) - Number(o.costoRepuestosUsados || 0));
                    return (
                      <tr key={o.id} style={{ opacity: o.estado === 'entregado' ? 0.55 : 1 }}>
                        <td>
                          <span style={{ fontFamily: 'Orbitron', color: '#00f3ff', fontWeight: 'bold' }}>#{o.codigoSeguimiento}</span><br/>
                          <span className="neon-badge" style={{ background: o.tallerOrigen && o.tallerOrigen !== 'Mostrador Propio' ? 'rgba(255,0,255,0.15)' : 'rgba(0,243,255,0.1)', color: o.tallerOrigen && o.tallerOrigen !== 'Mostrador Propio' ? '#ff00ff' : '#00f3ff', marginTop: '4px' }}>
                            {o.tallerOrigen || 'Mostrador'}
                          </span>
                        </td>
                        <td><b>{o.cliente?.nombre}</b><br/><span style={{ fontSize: '13px', color: '#00ff9d' }}>📱 {o.cliente?.telefono}</span></td>
                        <td>
                          <b>{o.equipo?.marca} {o.equipo?.modelo}</b> {o.equipo?.contrasena && <span className="neon-badge" style={{ background: 'rgba(255,238,0,0.15)', color: '#ffee00' }}>🔑 {o.equipo.contrasena}</span>}<br/>
                          <span style={{ color: '#ff0055' }}>Falla: {o.fallaDeclarada}</span>
                          {o.repuestosLista?.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: '#00ff9d', marginTop: '3px' }}>
                              🔩 Repuestos: {o.repuestosLista.map((r:any)=>r.nombre).join(', ')} (Costo: ${o.costoRepuestosUsados})
                            </div>
                          )}
                        </td>
                        <td>
                          <select className="neon-select" value={o.estado} onChange={e => actualizarEstado(o.id, e.target.value, o)} style={{ padding: '6px' }}>
                            <option value="ingresado">📥 Ingresado</option>
                            <option value="en revision">🔬 En Revisión</option>
                            <option value="esperando repuesto">⏳ Esperando Repuesto</option>
                            <option value="reparado">✅ Reparado</option>
                            <option value="reingreso garantia">🔄 Garantía</option>
                            <option value="sin solucion">❌ Sin Solución</option>
                            <option value="entregado">📦 Entregado</option>
                          </select>
                          {o.costoReparacion && (
                            <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
                              <b className="glow-text-green">Cobro: ${o.costoReparacion}</b>
                              {rolActual === 'admin' && <span style={{ color: '#8b9bb4' }}> | Neto: ${utilidadNeta}</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button onClick={() => imputarRepuestoAOrden(o)} className="neon-btn neon-btn-purple" title="Descontar repuesto del Pañol e imputar a esta orden">🔩 +Repuesto</button>
                            <button onClick={() => notificarClienteWhatsApp(o)} className="neon-btn neon-btn-green">💬</button>
                            <button onClick={() => imprimirOrdenProfesional(o)} className="neon-btn" title="Imprimir A4 / Térmica">🖨️</button>
                            {rolActual === 'admin' && (
                              <button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'ordenes_taller',o.id))}} className="neon-btn neon-btn-red">🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MÓDULO 4: RED DE DEMÁS TALLERES B2B & CTAS CORRIENTES*/}
        {/* ==================================================== */}
        {pestaña === 'talleres_b2b' && (
          <div>
            <h2 className="glow-text-pink" style={{ marginTop: 0 }}>🏢 GESTIÓN DE DEMÁS TALLERES (RED GREMIO B2B & CUENTAS CORRIENTES)</h2>
            <p style={{ color: '#8b9bb4', marginTop: '-10px', marginBottom: '20px' }}>
              Administra a los talleres colegas que te tercerizan reparaciones de placa o te compran repuestos al por mayor con lista diferenciada y cuenta corriente.
            </p>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarTallerGremio} className="neon-card neon-card-pink" style={{ flex: '1 1 320px', alignSelf: 'flex-start' }}>
                <h3 className="glow-text-pink" style={{ marginTop: 0 }}>➕ VINCULAR NUEVO TALLER</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><label className="label-neon">Nombre del Taller</label><input type="text" className="neon-input" required value={tallerNom} onChange={e=>setTallerNom(e.target.value)} placeholder="Ej: Servicio Técnico Sur" /></div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}><label className="label-neon">Responsable</label><input type="text" className="neon-input" required value={tallerEncargado} onChange={e=>setTallerEncargado(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><label className="label-neon">Localidad / Ciudad</label><input type="text" className="neon-input" required value={tallerCiudad} onChange={e=>setTallerCiudad(e.target.value)} /></div>
                  </div>
                  <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" required value={tallerTel} onChange={e=>setTallerTel(e.target.value)} /></div>
                  <div><label className="label-neon">Email (Para Login en Tienda B2B)</label><input type="email" className="neon-input" required value={tallerEmail} onChange={e=>setTallerEmail(e.target.value)} placeholder="taller@correo.com" /></div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="label-neon">Nivel Descuento</label>
                      <select className="neon-select" value={tallerNivel} onChange={e=>setTallerNivel(e.target.value as any)}>
                        <option value="Bronce">Bronce (-{config.descuentoGremioBronce}%)</option>
                        <option value="Oro">Oro (-{config.descuentoGremioOro}%)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label-neon">Límite Cta. Cte. ($)</label>
                      <input type="number" className="neon-input" value={tallerLimiteCredito} onChange={e=>setTallerLimiteCredito(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="neon-btn neon-btn-pink" style={{ padding: '12px', marginTop: '6px' }}>Dar de Alta Taller B2B</button>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 580px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Taller / Ciudad</th><th>Contacto</th><th>Categoría</th><th>Equipos En Taller</th><th>Saldo Deudor (Cta. Cte.)</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {talleresGremio.map(t => {
                      const equiposDelTaller = ordenes.filter(o => o.tallerOrigen === t.nombre && o.estado !== 'entregado').length;
                      return (
                        <tr key={t.id}>
                          <td><b>{t.nombre}</b> ({t.ciudad || 'Local'})<br/><small style={{ color: '#8b9bb4' }}>{t.email}</small></td>
                          <td>{t.encargado}<br/><span style={{ color: '#00ff9d', fontSize: '13px' }}>📱 {t.telefono}</span></td>
                          <td><span className="neon-badge" style={{ background: t.nivel === 'Oro' ? 'rgba(255,238,0,0.15)' : 'rgba(0,243,255,0.1)', color: t.nivel === 'Oro' ? '#ffee00' : '#00f3ff' }}>GREMIO {t.nivel}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00f3ff' }}>{equiposDelTaller} activos</td>
                          <td>
                            <b className={Number(t.saldoDeudor) > 0 ? 'glow-text-red' : 'glow-text-green'} style={{ fontSize: '16px' }}>
                              ${Number(t.saldoDeudor || 0).toLocaleString()}
                            </b>
                            <div style={{ fontSize: '11px', color: '#8b9bb4' }}>Límite: ${Number(t.limiteCredito || 0).toLocaleString()}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => registrarPagoCtaCteTaller(t)} className="neon-btn neon-btn-green">💵 Cobrar Saldo</button>
                              <button onClick={() => window.open(`https://wa.me/549${t.telefono.replace(/\D/g,'')}?text=Hola%20${encodeURIComponent(t.nombre)},%20te%20escribimos%20de%20${encodeURIComponent(config.empresaNombre)}.%20Tu%20saldo%20actual%20en%20Cuenta%20Corriente%20es%20$${t.saldoDeudor || 0}.`, '_blank')} className="neon-btn">💬</button>
                              <button onClick={()=>deleteDoc(doc(db,'talleres_gremio',t.id))} className="neon-btn neon-btn-red">🗑️</button>
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

        {/* ========================================== */}
        {/* MÓDULO 5: PAÑOL E INVENTARIO               */}
        {/* ========================================== */}
        {pestaña === 'catalogo' && (
          <div>
            {rolActual !== 'tecnico' && (
              <form onSubmit={guardarProducto} className="neon-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 className="glow-text-cyan" style={{ margin: 0 }}>{idEditando ? '✏️ EDITAR ARTÍCULO' : '➕ ALTA EN PAÑOL E INVENTARIO'}</h3>
                  <label style={{ color: '#ffee00', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input type="checkbox" checked={prodDestacado} onChange={e=>setProdDestacado(e.target.checked)} /> ⭐ Destacar en Tienda B2B
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                  <input type="text" className="neon-input" placeholder="Proveedor" value={prodProveedor} onChange={e=>setProdProveedor(e.target.value)} />
                  <input type="text" className="neon-input" placeholder="📍 Ubicación (Ej: Gaveta A3)" value={prodUbicacion} onChange={e=>setProdUbicacion(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Costo $" value={prodCosto} onChange={e=>setProdCosto(e.target.value)} />
                  <button type="button" onClick={calcularPrecioVenta} className="neon-btn neon-btn-green">Calcular (+{config.margenGanancia}%)</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <input type="text" className="neon-input" placeholder="Nombre / Modelo" value={prodNom} onChange={e=>setProdNom(e.target.value)} required />
                  <input type="text" className="neon-input" placeholder="Categoría" value={prodCat} onChange={e=>setProdCat(e.target.value)} required />
                  <input type="text" className="neon-input" placeholder="Cód. Barras" value={prodCodigoBarras} onChange={e=>setProdCodigoBarras(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Venta $" value={prodPrecio} onChange={e=>setProdPrecio(e.target.value)} required />
                  <input type="number" className="neon-input" placeholder="Stock" value={prodStock} onChange={e=>setProdStock(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '12px' }}>{idEditando ? 'Guardar Cambios' : 'Guardar en Pañol'}</button>
                  {idEditando && <button type="button" onClick={limpiarFormularioProducto} className="neon-btn neon-btn-red">Cancelar</button>}
                </div>
              </form>
            )}

            <div className="neon-card" style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" className="neon-input" placeholder="🔍 Buscar por nombre, código o gaveta..." value={busquedaInventario} onChange={e=>setBusquedaInventario(e.target.value)} style={{ flex: 1 }} />
              <select className="neon-select" value={filtroCategoriaInv} onChange={e=>setFiltroCategoriaInv(e.target.value)} style={{ width: 'auto' }}>
                {categoriasUnicasInv.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="neon-select" value={filtroStockInv} onChange={e=>setFiltroStockInv(e.target.value)} style={{ width: 'auto' }}>
                <option value="todos">Todo el Stock</option>
                <option value="critico">⚠️ Crítico (≤{config.stockCriticoAlerta})</option>
                <option value="agotado">❌ Sin Stock (0)</option>
              </select>
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
                    <th>Gaveta</th>
                    <th>Artículo</th>
                    {rolActual === 'admin' && <th>Costo</th>}
                    <th>Público</th>
                    <th>Gremio Oro (-{config.descuentoGremioOro}%)</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.map(p => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggleSeleccion(p.id)} /></td>
                      <td><span className="neon-badge" style={{ background: 'rgba(181,55,242,0.15)', color: '#b537f2' }}>📍 {p.ubicacion || 'S/U'}</span></td>
                      <td><b>{p.nombre}</b><br/><small style={{ color: '#8b9bb4' }}>{p.categoria} {p.proveedor && `| ${p.proveedor}`}</small></td>
                      {rolActual === 'admin' && <td style={{ color: '#8b9bb4' }}>${p.costoProveedor?.toLocaleString() || 0}</td>}
                      <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                      <td style={{ color: '#ffee00', fontWeight: 'bold' }}>${aplicarRedondeo(p.precio * (1 - Number(config.descuentoGremioOro || 18)/100), config.redondeoPrecios).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => actualizarStock(p.id, p.stock - 1)} className="neon-btn neon-btn-red" style={{ padding: '2px 6px' }}>-</button>
                          <b style={{ color: p.stock <= config.stockCriticoAlerta ? '#ff0055' : '#00ff9d' }}>{p.stock}</b>
                          <button onClick={() => actualizarStock(p.id, p.stock + 1)} className="neon-btn neon-btn-green" style={{ padding: '2px 6px' }}>+</button>
                        </div>
                      </td>
                      <td><button onClick={() => cargarProductoParaEdicion(p)} className="neon-btn">✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 6: RMA & GARANTÍAS DE PROVEEDORES   */}
        {/* ========================================== */}
        {pestaña === 'rma' && (
          <div>
            <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>🔄 CONTROL DE RMA DE PROVEEDORES & GARANTÍAS</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarRMA} className="neon-card" style={{ flex: '1 1 300px' }}>
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>➕ REGISTRAR FALLA / RMA</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select className="neon-select" value={rmaTipo} onChange={e=>setRmaTipo(e.target.value as any)}>
                    <option value="proveedor">📦 Reclamo a Proveedor (Repuesto Fallado)</option>
                    <option value="cliente">🛠️ Garantía de Cliente / Taller</option>
                  </select>
                  <input type="text" className="neon-input" required placeholder="Repuesto / Equipo (Ej: Módulo A52 OLED)" value={rmaProducto} onChange={e=>setRmaProducto(e.target.value)} />
                  <input type="text" className="neon-input" required placeholder="Proveedor o Cliente" value={rmaEntidad} onChange={e=>setRmaEntidad(e.target.value)} />
                  <input type="text" className="neon-input" required placeholder="Falla detectada (Ej: Falla táctil sin pegar)" value={rmaMotivo} onChange={e=>setRmaMotivo(e.target.value)} />
                  <input type="number" className="neon-input" placeholder="Costo a recuperar ($)" value={rmaMonto} onChange={e=>setRmaMonto(e.target.value)} />
                  <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '12px' }}>Registrar Ticket RMA</button>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 550px' }}>
                <table className="neon-table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Artículo</th><th>Proveedor/Cliente</th><th>Falla</th><th>Monto</th><th>Estado</th></tr></thead>
                  <tbody>
                    {rmas.map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha}</td>
                        <td><span className="neon-badge" style={{ background: 'rgba(0,243,255,0.1)', color: '#00f3ff' }}>{r.tipo}</span></td>
                        <td><b>{r.producto}</b></td>
                        <td>{r.entidad}</td>
                        <td style={{ color: '#ff0055' }}>{r.motivo}</td>
                        <td>${r.monto}</td>
                        <td>
                          <select className="neon-select" value={r.estado} onChange={e=>updateDoc(doc(db,'rmas_garantias',r.id), {estado: e.target.value})} style={{ padding: '4px' }}>
                            <option value="pendiente">⏳ Pendiente</option>
                            <option value="enviado">🚚 Enviado a Prov.</option>
                            <option value="resuelto">✅ Nota Crédito / Cambiado</option>
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

        {/* ========================================== */}
        {/* MÓDULO 7: PEDIDOS WEB B2B                  */}
        {/* ========================================== */}
        {pestaña === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h2 className="glow-text-pink" style={{ marginTop: 0 }}>🌐 PEDIDOS MAYORISTAS RECIBIDOS DESDE LA TIENDA B2B</h2>
            {pedidosWeb.map(pedido => (
              <div key={pedido.id} className="neon-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="glow-text-pink" style={{ margin: '0 0 6px 0' }}>ORDEN WEB #{pedido.id.slice(-6).toUpperCase()}</h4>
                  <p style={{ margin: '2px 0' }}><b>Cliente/Taller:</b> {pedido.cliente.nombre} ({pedido.cliente.telefono})</p>
                  <p style={{ margin: '2px 0' }}><b>Modalidad:</b> {pedido.cliente.metodoEnvio.toUpperCase()} | <b>Pago:</b> {pedido.estadoPago.toUpperCase()}</p>
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
                    <option value="cta_cte">🏢 En Cta. Cte. Gremio</option>
                    <option value="pagado">✅ Pagado (Caja)</option>
                  </select>
                  <select className="neon-select" value={pedido.estadoEnvio} onChange={e=>updateDoc(doc(db,'pedidos_ecommerce',pedido.id), {estadoEnvio: e.target.value})}>
                    <option value="preparacion">En Preparación</option>
                    <option value="enviado">Listo / En Camino</option>
                    <option value="entregado">Entregado</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 8: CRM CLIENTES & MARKETING         */}
        {/* ========================================== */}
        {pestaña === 'clientes' && (
          <div>
            <div className="neon-card neon-card-green" style={{ marginBottom: '20px' }}>
              <h3 className="glow-text-green" style={{ marginTop: 0 }}>📣 CRM & CAMPAÑAS DE FIDELIZACIÓN POR WHATSAPP</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="text" className="neon-input" value={mensajePromoCRM} onChange={e=>setMensajePromoCRM(e.target.value)} style={{ flex: 1 }} />
                <input type="text" className="neon-input" placeholder="🔍 Buscar cliente..." value={busquedaClienteCRM} onChange={e=>setBusquedaClienteCRM(e.target.value)} style={{ width: '250px' }} />
              </div>
            </div>
            <div className="neon-card" style={{ overflowX: 'auto' }}>
              <table className="neon-table">
                <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Historial</th><th>Total Gastado (LTV)</th><th>Acción</th></tr></thead>
                <tbody>
                  {clientesConsolidados.map((c, idx) => (
                    <tr key={idx}>
                      <td><b>{c.nombre}</b></td>
                      <td style={{ color: '#00ff9d' }}>📱 {c.telefono}</td>
                      <td>🛠️ {c.equipos} equipos | 🛒 {c.comprasWeb} pedidos</td>
                      <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${c.totalGastado.toLocaleString()}</td>
                      <td><button onClick={() => window.open(`https://wa.me/549${c.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(mensajePromoCRM.replace('{nombre}', c.nombre).replace('{empresa}', config.empresaNombre))}`, '_blank')} className="neon-btn neon-btn-green">🚀 Enviar Promo</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 9: IMPORTADOR EXCEL                 */}
        {/* ========================================== */}
        {pestaña === 'proveedores' && (
          <div className="neon-card">
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🚚 IMPORTADOR MASIVO DE LISTAS DE PRECIOS (SIN DUPLICAR)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div><label className="label-neon">Proveedor</label><input type="text" className="neon-input" value={nombreProveedorExcel} onChange={e=>setNombreProveedorExcel(e.target.value)} /></div>
              <div><label className="label-neon">Moneda</label><select className="neon-select" value={monedaListaExcel} onChange={e=>setMonedaListaExcel(e.target.value as any)}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (x ${config.cotizacionDolar})</option></select></div>
              <div><label className="label-neon">Archivo .xlsx</label><input type="file" id="fileExcel" accept=".xlsx, .xls" className="neon-input" onChange={procesarArchivoExcel} /></div>
            </div>
            {excelHojas.length > 0 && !excelCargando && (
              <div style={{ background: '#070a12', padding: '15px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div><label className="label-neon">Pestaña</label><select className="neon-select" value={hojaActiva} onChange={cambiarHojaDropdown}>{excelHojas.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="label-neon">Col. Nombre</label><select className="neon-select" value={colNombre} onChange={e=>setColNombre(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                  <div><label className="label-neon">Col. Costo</label><select className="neon-select" value={colCosto} onChange={e=>setColCosto(Number(e.target.value))}>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                  <div><label className="label-neon">Col. Marca</label><select className="neon-select" value={colMarca} onChange={e=>setColMarca(Number(e.target.value))}><option value={-1}>No Aplica</option>{[0,1,2,3,4].map(i=><option key={i} value={i}>Columna {String.fromCharCode(65+i)}</option>)}</select></div>
                </div>
                <button onClick={importarDatosAlInventario} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>🚀 Sincronizar Lista con Base de Datos</button>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* MÓDULO 10: FINANZAS, CAJA & FACTURACIÓN    */}
        {/* ========================================== */}
        {pestaña === 'finanzas' && (
          <div>
            <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="neon-select" value={filtroTiempo} onChange={e=>setFiltroTiempo(e.target.value)} style={{ width: 'auto' }}><option value="todos">Todo el Historial</option><option value="hoy">Hoy</option><option value="mes">Este Mes</option></select>
              <select className="neon-select" value={filtroTipoLista} onChange={e=>setFiltroTipoLista(e.target.value)} style={{ width: 'auto' }}><option value="todos">Ingresos y Egresos</option><option value="ingreso">Solo Ingresos</option><option value="egreso">Solo Egresos</option></select>
              <input type="text" className="neon-input" placeholder="Buscar concepto..." value={filtroBusquedaConcepto} onChange={e=>setFiltroBusquedaConcepto(e.target.value)} style={{ flex: 1 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '22px' }}>
              <div className="neon-card neon-card-green" style={{ textAlign: 'center' }}><span className="label-neon" style={{ color: '#00ff9d' }}>INGRESOS</span><h2 className="glow-text-green" style={{ margin: '5px 0 0 0' }}>${totalIngresos.toLocaleString()}</h2></div>
              <div className="neon-card neon-card-pink" style={{ textAlign: 'center' }}><span className="label-neon" style={{ color: '#ff0055' }}>EGRESOS</span><h2 className="glow-text-red" style={{ margin: '5px 0 0 0' }}>${totalEgresos.toLocaleString()}</h2></div>
              <div className="neon-card" style={{ textAlign: 'center' }}><span className="label-neon">CAJA NETA</span><h2 className="glow-text-cyan" style={{ margin: '5px 0 0 0' }}>${saldoNeto.toLocaleString()}</h2></div>
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

              <div className="neon-card" style={{ flex: '2 1 600px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th><th>Borrar</th></tr></thead>
                  <tbody>
                    {movimientosFiltrados.map(m => (
                      <React.Fragment key={m.id}>
                        <tr>
                          <td style={{ fontSize: '12px', color: '#8b9bb4' }}>{m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                          <td>
                            {m.items?.length > 0 && (
                              <button onClick={() => setExpandidoId(expandidoId === m.id ? null : m.id)} className="neon-btn" style={{ padding: '2px 6px', marginRight: '6px' }}>{expandidoId === m.id ? '▼' : '▶'}</button>
                            )}
                            <b>{m.concepto}</b>
                          </td>
                          <td style={{ textTransform: 'uppercase', color: '#00f3ff' }}>{m.metodoPago}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: m.tipo === 'ingreso' ? '#00ff9d' : '#ff0055' }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString()}</td>
                          <td><button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'finanzas',m.id))}} className="neon-btn neon-btn-red" style={{ padding: '4px 8px' }}>🗑️</button></td>
                        </tr>
                        {expandidoId === m.id && (
                          <tr style={{ background: 'rgba(0, 243, 255, 0.04)' }}>
                            <td colSpan={5} style={{ padding: '12px' }}>
                              <b>Ítems:</b> {m.items?.map((it:any)=>`${it.cantidad}x ${it.nombre} ($${it.precio})`).join(' | ')}
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

        {/* ========================================== */}
        {/* MÓDULO 11: CONFIGURACIÓN & ROLES           */}
        {/* ========================================== */}
        {pestaña === 'configuracion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <form onSubmit={guardarConfiguracion} className="neon-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>⚙️ PARÁMETROS GLOBALES Y FINANCIEROS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div><label className="label-neon">Empresa</label><input type="text" className="neon-input" value={conf.empresaNombre} onChange={e=>setConf({...conf, empresaNombre: e.target.value})} /></div>
                <div><label className="label-neon">Dirección</label><input type="text" className="neon-input" value={conf.direccion} onChange={e=>setConf({...conf, direccion: e.target.value})} /></div>
                <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={conf.whatsapp} onChange={e=>setConf({...conf, whatsapp: e.target.value})} /></div>
                <div><label className="label-neon">Dólar Ref ($)</label><input type="number" className="neon-input" value={conf.cotizacionDolar} onChange={e=>setConf({...conf, cotizacionDolar: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Markup Público (%)</label><input type="number" className="neon-input" value={conf.margenGanancia} onChange={e=>setConf({...conf, margenGanancia: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Desc. Gremio Bronce (%)</label><input type="number" className="neon-input" value={conf.descuentoGremioBronce} onChange={e=>setConf({...conf, descuentoGremioBronce: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Desc. Gremio Oro (%)</label><input type="number" className="neon-input" value={conf.descuentoGremioOro} onChange={e=>setConf({...conf, descuentoGremioOro: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Desc. Efectivo POS (%)</label><input type="number" className="neon-input" value={conf.descuentoEfectivoPorcentaje} onChange={e=>setConf({...conf, descuentoEfectivoPorcentaje: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Recargo Tarjeta POS (%)</label><input type="number" className="neon-input" value={conf.recargoTarjetaPorcentaje} onChange={e=>setConf({...conf, recargoTarjetaPorcentaje: Number(e.target.value)})} /></div>
                <div><label className="label-neon">Alias / CBU</label><input type="text" className="neon-input" value={conf.aliasTransferencia} onChange={e=>setConf({...conf, aliasTransferencia: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Sectores de Laboratorio</label><input type="text" className="neon-input" value={conf.sectoresTaller} onChange={e=>setConf({...conf, sectoresTaller: e.target.value})} /></div>
              </div>
              <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>💾 GUARDAR PARÁMETROS</button>
            </form>

            <div className="neon-card">
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🛡️ GESTIÓN DE ROLES DEL PERSONAL</h3>
              <form onSubmit={agregarUsuarioRol} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <input type="text" className="neon-input" placeholder="Nombre" required value={nuevoUserNombre} onChange={e=>setNuevoUserNombre(e.target.value)} style={{ flex: 1 }} />
                <input type="email" className="neon-input" placeholder="Email Firebase" required value={nuevoUserEmail} onChange={e=>setNuevoUserEmail(e.target.value)} style={{ flex: 1 }} />
                <select className="neon-select" value={nuevoUserRol} onChange={e=>setNuevoUserRol(e.target.value as any)} style={{ width: 'auto' }}>
                  <option value="tecnico">🔧 Técnico</option>
                  <option value="vendedor">🛒 Vendedor</option>
                  <option value="admin">👑 Admin</option>
                </select>
                <button type="submit" className="neon-btn neon-btn-fillCyan">+ Asignar Rol</button>
              </form>
              <table className="neon-table">
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Acción</th></tr></thead>
                <tbody>
                  {usuariosRoles.map(u => (
                    <tr key={u.id}>
                      <td><b>{u.nombre}</b></td><td>{u.email}</td><td>{u.rol?.toUpperCase()}</td>
                      <td><button onClick={()=>deleteDoc(doc(db, 'usuarios_roles', u.id))} className="neon-btn neon-btn-red">Quitar</button></td>
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

  if (cargando) return <div style={{ padding: '50px', textAlign: 'center', color: '#00f3ff', background: '#060911', height: '100vh', fontFamily: 'Orbitron' }}>⚡ INICIANDO WALABBA TECNO ERP...</div>;

  return (
    <BrowserRouter>
      <style>{NEON_STYLES}</style>
      <nav style={{ padding: '12px 25px', background: 'rgba(6, 9, 17, 0.98)', borderBottom: '1px solid rgba(0, 243, 255, 0.35)', display: 'flex', gap: '20px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link to="/" className="glow-text-cyan" style={{ textDecoration: 'none', fontWeight: 900, fontFamily: 'Orbitron', fontSize: '14px' }}>⚡ CATÁLOGO MAYORISTA B2B</Link>
        <Link to="/seguimiento" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 600, fontFamily: 'Orbitron', fontSize: '12px' }}>🔍 RASTREAR EQUIPO</Link>
        {!user ? (
          <Link to="/admin-login" className="neon-btn" style={{ marginLeft: 'auto', textDecoration: 'none' }}>🔐 Acceso Gremio / ERP</Link>
        ) : (
          <Link to="/admin-panel" className="neon-btn neon-btn-fillCyan" style={{ marginLeft: 'auto', textDecoration: 'none' }}>⚙️ PANEL CENTRAL ERP</Link>
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