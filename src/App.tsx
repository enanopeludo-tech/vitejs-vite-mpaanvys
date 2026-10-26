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

// --- Configuración por defecto ERP Central ---
const CONFIG_DEFAULT = {
  temaVisual: "claro", // 'claro' | 'oscuro' | 'sistema' | 'neon'
  tamanoFuenteBase: 17,
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
  sectoresTaller: "Microelectrónica & Placas, Módulos y Baterías, Software & F4, Tercerizado Externo",
  ticketLeyenda: "Use el código o escanee el QR para seguir su reparación en vivo. Pasados los 90 días el equipo se considerará abandonado según Art. 2525 CCyC. La garantía cubre únicamente la falla reparada, no cubre equipos mojados, golpeados o manipulados por terceros.",
  promoPlantillaCRM: "Hola {nombre}! En *{empresa}* tenemos promos exclusivas esta semana en cargadores carga rápida, hidrogel antishock y servicio técnico. ¡Consultanos!"
};

const CHECKLIST_ITEMS = [
  "Enciende", "Display OK", "Táctil OK", "Pin Carga OK", 
  "Batería OK", "Cámaras OK", "Audio / Mic", "WiFi / Señal", 
  "Bandeja SIM", "MicroSD", "Con Funda", "Mojado / Sulfato"
];

// --- GENERADOR DE ESTILOS DINÁMICOS (CLÁSICO iOS 26.1 / SISTEMA / NEÓN) ---
const getEstilosTema = (temaConfig: string, fontSizeBase: number = 17) => {
  const prefiereOscuroSO = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const temaEfectivo = temaConfig === 'sistema' ? (prefiereOscuroSO ? 'oscuro' : 'claro') : (temaConfig || 'claro');

  const paletas: Record<string, any> = {
    claro: {
      bgMain: '#f2f2f7',
      bgCard: 'rgba(255, 255, 255, 0.88)',
      bgInput: '#ffffff',
      bgSidebar: 'rgba(248, 249, 252, 0.95)',
      bgNav: 'rgba(255, 255, 255, 0.85)',
      textMain: '#1c1c1e',
      textMuted: '#636366',
      primary: '#007aff',
      success: '#28cd41',
      accentPink: '#5856d6',
      accentPurple: '#af52de',
      warning: '#ff9500',
      danger: '#ff3b30',
      borderCard: 'rgba(0, 0, 0, 0.08)',
      borderInput: '#d1d1d6',
      shadowCard: '0 8px 24px rgba(0, 0, 0, 0.05)',
      fontHeading: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      fontBody: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
      esNeon: false
    },
    oscuro: {
      bgMain: '#000000',
      bgCard: 'rgba(28, 28, 30, 0.88)',
      bgInput: '#2c2c2e',
      bgSidebar: 'rgba(18, 18, 20, 0.95)',
      bgNav: 'rgba(28, 28, 30, 0.85)',
      textMain: '#f2f2f7',
      textMuted: '#98989d',
      primary: '#0a84ff',
      success: '#30d158',
      accentPink: '#5e5ce6',
      accentPurple: '#bf5af2',
      warning: '#ff9f0a',
      danger: '#ff453a',
      borderCard: 'rgba(255, 255, 255, 0.12)',
      borderInput: '#3a3a3c',
      shadowCard: '0 8px 28px rgba(0, 0, 0, 0.4)',
      fontHeading: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      fontBody: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
      esNeon: false
    },
    neon: {
      bgMain: '#060911',
      bgCard: 'rgba(13, 19, 34, 0.92)',
      bgInput: '#080c16',
      bgSidebar: 'rgba(8, 12, 22, 0.98)',
      bgNav: 'rgba(6, 9, 17, 0.95)',
      textMain: '#e2e8f0',
      textMuted: '#8b9bb4',
      primary: '#00f3ff',
      success: '#00ff9d',
      accentPink: '#ff00ff',
      accentPurple: '#b537f2',
      warning: '#ffee00',
      danger: '#ff0055',
      borderCard: 'rgba(0, 243, 255, 0.25)',
      borderInput: 'rgba(0, 243, 255, 0.3)',
      shadowCard: '0 8px 28px rgba(0, 0, 0, 0.6)',
      fontHeading: "'Orbitron', sans-serif",
      fontBody: "'Rajdhani', sans-serif",
      esNeon: true
    }
  };

  const p = paletas[temaEfectivo] || paletas.claro;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap');

    :root {
      --bg-dark: ${p.bgMain};
      --bg-card: ${p.bgCard};
      --bg-input: ${p.bgInput};
      --neon-cyan: ${p.primary};
      --neon-pink: ${p.accentPink};
      --neon-green: ${p.success};
      --neon-purple: ${p.accentPurple};
      --neon-yellow: ${p.warning};
      --neon-red: ${p.danger};
      --text-main: ${p.textMain};
      --text-muted: ${p.textMuted};
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: ${p.fontBody};
      font-size: ${fontSizeBase}px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      transition: background-color 0.25s ease, color 0.25s ease;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, .neon-title {
      font-family: ${p.fontHeading};
      letter-spacing: ${p.esNeon ? '0.8px' : '-0.3px'};
      font-weight: 700;
      color: var(--text-main);
    }

    h2 { font-size: ${fontSizeBase + 6}px; }
    h3 { font-size: ${fontSizeBase + 3}px; }
    h4 { font-size: ${fontSizeBase + 1}px; }

    .neon-card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid ${p.borderCard};
      border-radius: 20px;
      box-shadow: ${p.shadowCard};
      padding: 22px;
      transition: all 0.2s ease;
    }

    .neon-card-pink { border-color: ${p.esNeon ? 'rgba(255, 0, 255, 0.35)' : 'rgba(88, 86, 214, 0.3)'}; }
    .neon-card-green { border-color: ${p.esNeon ? 'rgba(0, 255, 157, 0.35)' : 'rgba(40, 205, 65, 0.3)'}; }
    .neon-card-purple { border-color: ${p.esNeon ? 'rgba(181, 55, 242, 0.35)' : 'rgba(175, 82, 222, 0.3)'}; }
    .neon-card-yellow { border-color: ${p.esNeon ? 'rgba(255, 238, 0, 0.35)' : 'rgba(255, 149, 0, 0.3)'}; }

    .neon-input, .neon-select, .neon-textarea {
      background: var(--bg-input);
      border: 1px solid ${p.borderInput};
      color: var(--text-main);
      padding: 12px 15px;
      border-radius: 14px;
      font-family: ${p.fontBody};
      font-size: ${fontSizeBase - 1}px;
      font-weight: 500;
      width: 100%;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .neon-input:focus, .neon-select:focus, .neon-textarea:focus {
      outline: none;
      border-color: var(--neon-cyan);
      box-shadow: 0 0 0 3px ${p.esNeon ? 'rgba(0, 243, 255, 0.25)' : 'rgba(0, 122, 255, 0.2)'};
    }

    /* BOTONES ESTILO iOS 26.1 (Píldora Liquid Glass + Spring) */
    .neon-btn {
      background: ${p.esNeon ? 'rgba(0, 243, 255, 0.08)' : (temaEfectivo === 'claro' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(10, 132, 255, 0.18)')};
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid ${p.esNeon ? 'var(--neon-cyan)' : 'rgba(0, 122, 255, 0.22)'};
      color: var(--neon-cyan);
      padding: 11px 20px;
      border-radius: 9999px;
      font-family: ${p.fontHeading};
      font-size: ${fontSizeBase - 2}px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.2px;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .neon-btn:hover:not(:disabled) {
      background: var(--neon-cyan);
      color: ${p.esNeon ? '#000' : '#fff'};
      transform: scale(1.02);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 6px 16px ${p.esNeon ? 'rgba(0, 243, 255, 0.4)' : 'rgba(0, 122, 255, 0.3)'};
    }

    .neon-btn:active:not(:disabled) { transform: scale(0.96); }
    .neon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .neon-btn-fillCyan { 
      background: linear-gradient(180deg, ${p.esNeon ? '#00c6ff' : '#2e90ff'} 0%, var(--neon-cyan) 100%); 
      border: 1px solid rgba(255, 255, 255, 0.2); 
      color: #ffffff; 
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 4px 14px rgba(0, 122, 255, 0.28);
    }
    .neon-btn-fillCyan:hover:not(:disabled) { filter: brightness(1.06); color: #ffffff; }

    .neon-btn-green { 
      background: ${p.esNeon ? 'transparent' : 'rgba(40, 205, 65, 0.12)'};
      border-color: ${p.esNeon ? 'var(--neon-green)' : 'rgba(40, 205, 65, 0.3)'}; 
      color: ${temaEfectivo === 'claro' ? '#198754' : 'var(--neon-green)'}; 
    }
    .neon-btn-green:hover:not(:disabled) { background: var(--neon-green); color: #fff; }

    .neon-btn-pink { 
      background: ${p.esNeon ? 'transparent' : 'rgba(88, 86, 214, 0.12)'};
      border-color: ${p.esNeon ? 'var(--neon-pink)' : 'rgba(88, 86, 214, 0.3)'}; 
      color: var(--neon-pink); 
    }
    .neon-btn-pink:hover:not(:disabled) { background: var(--neon-pink); color: #fff; }

    .neon-btn-purple { 
      background: ${p.esNeon ? 'transparent' : 'rgba(175, 82, 222, 0.12)'};
      border-color: ${p.esNeon ? 'var(--neon-purple)' : 'rgba(175, 82, 222, 0.3)'}; 
      color: var(--neon-purple); 
    }
    .neon-btn-purple:hover:not(:disabled) { background: var(--neon-purple); color: #fff; }

    .neon-btn-red { 
      background: ${p.esNeon ? 'transparent' : 'rgba(255, 59, 48, 0.12)'};
      border-color: ${p.esNeon ? 'var(--neon-red)' : 'rgba(255, 59, 48, 0.3)'}; 
      color: var(--neon-red); 
    }
    .neon-btn-red:hover:not(:disabled) { background: var(--neon-red); color: #fff; }

    .neon-table { width: 100%; border-collapse: collapse; font-size: ${fontSizeBase - 1}px; }
    .neon-table th { 
      background: ${temaEfectivo === 'claro' ? '#f2f2f7' : 'rgba(255, 255, 255, 0.06)'}; 
      color: var(--text-muted); 
      font-weight: 700;
      font-size: ${fontSizeBase - 3}px; 
      padding: 13px 12px; 
      text-align: left; 
      border-bottom: 1px solid ${p.borderInput}; 
      text-transform: uppercase;
    }
    .neon-table td { padding: 13px 12px; border-bottom: 1px solid ${p.borderCard}; color: var(--text-main); }
    .neon-table tr:hover td { background: ${temaEfectivo === 'claro' ? 'rgba(0, 122, 255, 0.04)' : 'rgba(255, 255, 255, 0.03)'}; }

    .neon-badge { padding: 5px 12px; border-radius: 9999px; font-size: ${fontSizeBase - 4}px; font-weight: 700; display: inline-block; }

    .glow-text-cyan { color: var(--neon-cyan); ${p.esNeon ? 'text-shadow: 0 0 8px rgba(0, 243, 255, 0.5);' : ''} }
    .glow-text-green { color: ${temaEfectivo === 'claro' ? '#198754' : 'var(--neon-green)'}; ${p.esNeon ? 'text-shadow: 0 0 8px rgba(0, 255, 157, 0.5);' : ''} }
    .glow-text-pink { color: var(--neon-pink); ${p.esNeon ? 'text-shadow: 0 0 8px rgba(255, 0, 255, 0.5);' : ''} }
    .glow-text-red { color: var(--neon-red); ${p.esNeon ? 'text-shadow: 0 0 8px rgba(255, 0, 85, 0.5);' : ''} }
    .glow-text-yellow { color: ${temaEfectivo === 'claro' ? '#d97706' : 'var(--neon-yellow)'}; }

    .label-neon { display: block; font-size: ${fontSizeBase - 3}px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }

    .erp-layout { display: flex; min-height: calc(100vh - 65px); }
    .erp-sidebar { width: 265px; background: ${p.bgSidebar}; border-right: 1px solid ${p.borderCard}; padding: 18px 14px; display: flex; flex-direction: column; gap: 7px; flex-shrink: 0; backdrop-filter: blur(20px); }
    .erp-main { flex: 1; padding: 24px; overflow-x: hidden; }
    .side-btn { width: 100%; justify-content: flex-start; padding: 12px 16px; font-size: ${fontSizeBase - 2}px; border-color: transparent; color: var(--text-muted); background: transparent; text-align: left; border-radius: 14px; box-shadow: none; }
    .side-btn:hover { background: ${temaEfectivo === 'claro' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.06)'}; color: var(--text-main); transform: none; box-shadow: none; }
    .side-btn.active { background: var(--neon-cyan); color: ${p.esNeon ? '#000' : '#fff'}; font-weight: 700; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25); }

    .top-nav-bar {
      padding: 12px 25px; 
      background: ${p.bgNav}; 
      border-bottom: 1px solid ${p.borderCard}; 
      display: flex; 
      gap: 20px; 
      align-items: center; 
      position: sticky; 
      top: 0; 
      zIndex: 100;
      backdrop-filter: blur(20px);
    }

    @media (max-width: 900px) {
      .erp-layout { flex-direction: column; }
      .erp-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 10px; box-sizing: border-box; }
      .side-btn { width: auto; white-space: nowrap; }
    }
  `;
};

const aplicarRedondeo = (valor: number, multiploStr: string) => {
  const multiplo = Number(multiploStr) || 1;
  if (multiplo <= 1) return Math.round(valor);
  return Math.ceil(valor / multiplo) * multiplo;
};

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

  const productosDeEstaVitrina = productos.filter(p => {
    const owner = p.ownerId || 'MASTER';
    return owner === tiendaIdEfectiva;
  });

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
        estadoPago: 'pendiente', 
        estadoEnvio: 'preparacion', fecha: serverTimestamp(),
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
// 4. PANEL ERP MULTI-TENANT (CON MÓDULO DE PRESUPUESTOS Y CALCULADORA DE LISTAS)
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

  // --- POS Mostrador Multicaja ---
  const [carritoPOS, setCarritoPOS] = useState<any[]>([]);
  const [busquedaPOS, setBusquedaPOS] = useState('');
  const [metodoPagoPOS, setMetodoPagoPOS] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'>('efectivo');
  const [clientePOS, setClientePOS] = useState('Consumidor Final');

  // --- Nuevo Módulo Generador de Presupuestos ---
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

  // --- Catálogo e Inventario (Con Precio de Lista explícito) ---
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [prodNom, setProdNom] = useState(''); const [prodCat, setProdCat] = useState('');
  const [prodCosto, setProdCosto] = useState(''); 
  const [prodPrecio, setProdPrecio] = useState(''); // Precio de Lista Base
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

  // --- Red de Talleres Asociados B2B ---
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

  // --- Usuarios / Roles ---
  const [nuevoUserEmail, setNuevoUserEmail] = useState('');
  const [nuevoUserPassword, setNuevoUserPassword] = useState('');
  const [nuevoUserNombre, setNuevoUserNombre] = useState('');
  const [nuevoUserRol, setNuevoUserRol] = useState<string>('recepcion_ordenes');
  const [creandoEmpleado, setCreandoEmpleado] = useState(false);

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
    const unsubPres = onSnapshot(query(collection(db, 'presupuestos')), (snap) => setPresupuestos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.fecha?.seconds - a.fecha?.seconds)));
    return () => { unsubConf(); unsubOrd(); unsubProd(); unsubPedidos(); unsubFinanzas(); unsubRoles(); unsubTalleres(); unsubRmas(); unsubPres(); };
  }, []);

  // =========================================================================
  // DETECCIÓN MULTI-TENANT Y SUB-ROLES DE EMPLEADOS
  // =========================================================================
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

  const rolNormalizado: 'admin' | 'recepcion_ordenes' | 'vendedor_admin' = sucursalDirecta 
    ? 'admin' 
    : (registroRolActual 
        ? (registroRolActual.rol === 'tecnico' || registroRolActual.rol === 'recepcion_ordenes' 
            ? 'recepcion_ordenes' 
            : registroRolActual.rol === 'vendedor' || registroRolActual.rol === 'vendedor_admin'
              ? 'vendedor_admin'
              : 'admin') 
        : 'admin');

  const puedeGestionarOrdenes = rolNormalizado === 'admin' || rolNormalizado === 'recepcion_ordenes';
  const puedeVentasStockFinanzas = rolNormalizado === 'admin' || rolNormalizado === 'vendedor_admin';
  const esAdminDelNegocioActivo = rolNormalizado === 'admin';

  useEffect(() => {
    if (rolNormalizado === 'recepcion_ordenes' && pestaña !== 'taller' && pestaña !== 'rma' && pestaña !== 'presupuestos') {
      setPestaña('taller');
    } else if (rolNormalizado === 'vendedor_admin' && pestaña === 'taller') {
      setPestaña('pos');
    }
  }, [rolNormalizado, pestaña]);

  const restaurarSuperAdmin = async () => {
    if (registroRolActual) {
      await deleteDoc(doc(db, 'usuarios_roles', registroRolActual.id));
      alert('👑 ¡Privilegios de Administrador Total restaurados!');
    }
  };

  // AISLAMIENTO DE DATOS POR LOCAL
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
        const prodReal = misProductos.find(p => p.id === item.id);
        if (prodReal) {
          await updateDoc(doc(db, 'productos', item.id), {
            stock: Math.max(0, prodReal.stock - item.cantidad),
            ventas: (prodReal.ventas || 0) + item.cantidad
          });
        }
      }
      await addDoc(collection(db, 'finanzas'), {
        ownerId: tenantId,
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
      alert(`⚡ Cobro de $${totalFinalPOS.toLocaleString()} registrado en tu Caja y descontado de tu stock.`);
    } catch (e) {
      alert('Error al procesar venta POS.');
    }
  };

  // =========================================================================
  // FUNCIONES DEL NUEVO MÓDULO DE PRESUPUESTOS Y COTIZACIONES
  // =========================================================================
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

  const guardarTallerGremio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoCuentaLocal(true);
    try {
      const emailLimpio = tallerEmail.trim().toLowerCase();
      if (tallerPassword && tallerPassword.length >= 6) {
        const secondaryAppName = "SecondaryCreatorApp";
        const existingApp = getApps().find(a => a.name === secondaryAppName);
        const secondaryApp = existingApp || initializeApp(auth.app.options, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, tallerPassword);
        await signOut(secondaryAuth);
      }

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
        fechaAlta: serverTimestamp()
      });

      setTallerNom(''); setTallerEncargado(''); setTallerTel(''); setTallerDireccion(''); setTallerEmail(''); setTallerPassword('');
      alert(`🏢 ¡Local "${tallerNom}" dado de alta!\nUsuario: ${emailLimpio}\nContraseña: ${tallerPassword || '(La que ya tenía)'}`);
    } catch (err: any) {
      alert(`Aviso al crear credenciales: ${err.message}`);
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
    alert('⚡ Parámetros y Tema Visual guardados.'); 
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

  const agregarUsuarioRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUserEmail) return;
    const emailLimpio = nuevoUserEmail.trim().toLowerCase();
    if (emailLimpio === user.email?.toLowerCase() && nuevoUserRol !== 'admin') {
      return alert('⚠️ No puedes bajarte el rol a tu propio correo de Administrador.');
    }
    setCreandoEmpleado(true);
    try {
      if (nuevoUserPassword && nuevoUserPassword.length >= 6) {
        const secondaryAppName = "SecondaryCreatorApp";
        const existingApp = getApps().find(a => a.name === secondaryAppName);
        const secondaryApp = existingApp || initializeApp(auth.app.options, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, emailLimpio, nuevoUserPassword);
        await signOut(secondaryAuth);
      }

      await addDoc(collection(db, 'usuarios_roles'), { 
        tenantId: tenantId,
        nombreNegocio: nombreNegocioActivo,
        email: emailLimpio, 
        nombre: nuevoUserNombre, 
        rol: nuevoUserRol, 
        fecha: serverTimestamp() 
      });
      setNuevoUserEmail(''); setNuevoUserPassword(''); setNuevoUserNombre('');
      alert(`✅ Usuario "${nuevoUserNombre}" creado y asignado al rol seleccionado dentro de ${nombreNegocioActivo}.`);
    } catch (err: any) {
      alert(`Aviso al registrar usuario: ${err.message}`);
    } finally {
      setCreandoEmpleado(false);
    }
  };

  const listaSectores = (config.sectoresTaller || CONFIG_DEFAULT.sectoresTaller).split(',').map((s:string) => s.trim());
  const urlVitrinaPropia = esSucursalExterna ? `${window.location.origin}/?tienda=${sucursalAsociada.id}` : window.location.origin;

  const etiquetaRolVisual = rolNormalizado === 'recepcion_ordenes' 
    ? 'RECEPCIÓN Y ÓRDENES' 
    : rolNormalizado === 'vendedor_admin' 
      ? 'VENDEDOR Y FINANZAS' 
      : 'ADMINISTRADOR TOTAL';

  // Vista previa en vivo de los 3 precios mientras cargas un producto
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

      {/* SIDEBAR INTELIGENTE */}
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

        {esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('dashboard')} className={`neon-btn side-btn ${pestaña === 'dashboard' ? 'active' : ''}`}>📊 1. Mi Resumen & Tienda</button>
        )}

        {puedeVentasStockFinanzas && (
          <button onClick={() => setPestaña('pos')} className={`neon-btn side-btn ${pestaña === 'pos' ? 'active' : ''}`}>🛒 2. Mi Caja POS Mostrador</button>
        )}

        <button onClick={() => setPestaña('presupuestos')} className={`neon-btn side-btn ${pestaña === 'presupuestos' ? 'active' : ''}`}>
          📄 3. Presupuestos ({misPresupuestos.length})
        </button>

        {puedeGestionarOrdenes && (
          <button onClick={() => setPestaña('taller')} className={`neon-btn side-btn ${pestaña === 'taller' ? 'active' : ''}`}>
            🛠️ 4. {esSucursalExterna ? `Órdenes Reparación (${equiposEnBanco})` : `Control Órdenes (${equiposEnBanco})`}
          </button>
        )}

        {!esSucursalExterna && esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('talleres_b2b')} className={`neon-btn side-btn ${pestaña === 'talleres_b2b' ? 'active' : ''}`}>🏢 5. Red Locales Gremio ({talleresGremio.length})</button>
        )}

        {puedeVentasStockFinanzas && (
          <button onClick={() => setPestaña('catalogo')} className={`neon-btn side-btn ${pestaña === 'catalogo' ? 'active' : ''}`}>📦 6. Mi Stock & Precios ({misProductos.length})</button>
        )}

        {puedeGestionarOrdenes && (
          <button onClick={() => setPestaña('rma')} className={`neon-btn side-btn ${pestaña === 'rma' ? 'active' : ''}`}>🔄 7. Garantías & RMA</button>
        )}
        
        {puedeVentasStockFinanzas && (
          <>
            <button onClick={() => setPestaña('pedidos')} className={`neon-btn side-btn ${pestaña === 'pedidos' ? 'active' : ''}`}>🌐 8. Mis Pedidos Web</button>
            <button onClick={() => setPestaña('clientes')} className={`neon-btn side-btn ${pestaña === 'clientes' ? 'active' : ''}`}>👥 9. Mis Clientes CRM</button>
            <button onClick={() => setPestaña('proveedores')} className={`neon-btn side-btn ${pestaña === 'proveedores' ? 'active' : ''}`}>🚚 10. Importar mi Excel</button>
            <button onClick={() => setPestaña('finanzas')} className={`neon-btn side-btn ${pestaña === 'finanzas' ? 'active' : ''}`}>💰 11. Mi Caja & Finanzas</button>
          </>
        )}

        {esAdminDelNegocioActivo && (
          <button onClick={() => setPestaña('configuracion')} className={`neon-btn side-btn ${pestaña === 'configuracion' ? 'active' : ''}`}>
            🛡️ 12. {esSucursalExterna ? 'Mi Personal & Roles' : 'Temas, Config & Roles'}
          </button>
        )}

        <button onClick={() => signOut(auth)} className="neon-btn neon-btn-red" style={{ marginTop: 'auto', width: '100%' }}>🚪 Cerrar Sesión</button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="erp-main">

        {/* ========================================== */}
        {/* MÓDULO 1: DASHBOARD                        */}
        {/* ========================================== */}
        {pestaña === 'dashboard' && esAdminDelNegocioActivo && (
          <div>
            <div className="neon-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderLeft: '4px solid var(--neon-green)' }}>
              <div>
                <h2 className="glow-text-cyan" style={{ margin: 0 }}>📊 Panel de Control // {nombreNegocioActivo}</h2>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📍 {direccionNegocioActivo} | 📱 WhatsApp Activo: {whatsappNegocioActivo}
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
                  <button onClick={() => setPestaña('pos')} className="neon-btn neon-btn-green" style={{ padding: '14px' }}>🛒 Vender en Caja POS</button>
                  <button onClick={() => setPestaña('presupuestos')} className="neon-btn neon-btn-fillCyan" style={{ padding: '14px' }}>📄 Crear Presupuesto</button>
                  <button onClick={() => setPestaña('taller')} className="neon-btn neon-btn-purple" style={{ padding: '14px' }}>🛠️ Ingresar Equipo</button>
                  <button onClick={() => setPestaña('catalogo')} className="neon-btn neon-btn-pink" style={{ padding: '14px' }}>📦 Cargar Precios Lista</button>
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

        {/* ========================================== */}
        {/* MÓDULO 2: PUNTO DE VENTA (POS)             */}
        {/* ========================================== */}
        {pestaña === 'pos' && puedeVentasStockFinanzas && (
          <div>
            <h2 className="glow-text-green" style={{ marginTop: 0 }}>🛒 Caja POS Mostrador // {nombreNegocioActivo}</h2>
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

              <div className="neon-card neon-card-green" style={{ flex: '1 1 320px' }}>
                <h3 className="glow-text-green" style={{ marginTop: 0 }}>🧾 Ticket de Venta Local</h3>
                <div style={{ marginBottom: '10px' }}>
                  <label className="label-neon">Cliente</label>
                  <input type="text" className="neon-input" value={clientePOS} onChange={e=>setClientePOS(e.target.value)} />
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '15px', borderTop: '1px solid rgba(128,128,128,0.15)' }}>
                  {carritoPOS.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                      <div><b>{item.cantidad}x</b> {item.nombre}<br/><small className="glow-text-cyan">Lista: ${(item.precio * item.cantidad).toLocaleString()}</small></div>
                      <button onClick={() => setCarritoPOS(carritoPOS.filter(i => i.id !== item.id))} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>✕</button>
                    </div>
                  ))}
                  {carritoPOS.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Selecciona artículos de tu stock a la izquierda.</p>}
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
                  ✅ Cobrar en Mi Caja
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÓDULO 3: NUEVO GENERADOR DE PRESUPUESTOS Y COTIZACIONES (PDF + WHATSAPP) */}
        {/* ========================================================================= */}
        {pestaña === 'presupuestos' && (
          <div>
            <h2 className="glow-text-cyan" style={{ marginTop: 0 }}>📄 Generador de Presupuestos y Cotizaciones // {nombreNegocioActivo}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '20px' }}>
              Arma cotizaciones combinando artículos de tu stock y mano de obra sin descontar inventario. El sistema calcula automáticamente el precio en Efectivo, Precio de Lista y Tarjeta.
            </p>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
              {/* Selector de Ítems para el Presupuesto */}
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

              {/* Resumen del Presupuesto a Guardar */}
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

                {/* Desglose Automático de las 3 Listas */}
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

            {/* Historial de Presupuestos Emitidos */}
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
                          <button onClick={() => enviarPresupuestoWhatsApp(pr)} className="neon-btn neon-btn-green" title="Enviar por WhatsApp">💬 WhatsApp</button>
                          <button onClick={() => imprimirPresupuestoPDF(pr)} className="neon-btn" title="Imprimir Hoja de Presupuesto">🖨️ PDF</button>
                          <button onClick={() => convertirPresupuestoEnOrden(pr)} className="neon-btn neon-btn-purple" title="Transformar en Orden de Reparación">🛠️ Hacer Orden</button>
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

        {/* ================================================================= */}
        {/* MÓDULO 4: ORDENES DE SERVICIO                                     */}
        {/* ================================================================= */}
        {pestaña === 'taller' && puedeGestionarOrdenes && (
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
        {/* MÓDULO 5: RED DE LOCALES ASOCIADOS (SOLO CENTRAL MASTER)             */}
        {/* ==================================================================== */}
        {pestaña === 'talleres_b2b' && !esSucursalExterna && esAdminDelNegocioActivo && (
          <div>
            <h2 className="glow-text-pink" style={{ marginTop: 0 }}>🏢 Gestión de Locales Asociados (Creación de Cuentas Independientes)</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <form onSubmit={guardarTallerGremio} className="neon-card neon-card-pink" style={{ flex: '1 1 340px', alignSelf: 'flex-start' }}>
                <h3 className="glow-text-pink" style={{ marginTop: 0 }}>➕ Dar de Alta Local Gremio</h3>
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
                    <input type="text" className="neon-input" required minLength={6} value={tallerPassword} onChange={e=>setTallerPassword(e.target.value)} placeholder="Contraseña (Mínimo 6 caracteres)" />
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
                  <button type="submit" disabled={creandoCuentaLocal} className="neon-btn neon-btn-fillCyan" style={{ padding: '14px', marginTop: '6px' }}>
                    {creandoCuentaLocal ? 'Creando Cuenta...' : '🚀 Crear Local Independiente'}
                  </button>
                </div>
              </form>

              <div className="neon-card" style={{ flex: '2 1 580px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Local / Usuario Admin</th><th>Tienda del Local</th><th>Equipos en Taller</th><th>Saldo Cta. Cte.</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {talleresGremio.map(t => {
                      const equiposDelTaller = ordenes.filter(o => (o.tallerOrigen === t.nombre || o.tallerId === t.id) && o.estado !== 'entregado').length;
                      const linkTiendaLocal = `${window.location.origin}/?tienda=${t.id}`;
                      return (
                        <tr key={t.id}>
                          <td>
                            <b>{t.nombre}</b> ({t.ciudad || 'Local'})<br/>
                            <small className="glow-text-cyan">👤 {t.email}</small><br/>
                            <small style={{ color: 'var(--text-muted)' }}>📍 {t.direccion} | 📱 {t.telefono}</small>
                          </td>
                          <td>
                            <a href={linkTiendaLocal} target="_blank" rel="noreferrer" className="neon-btn" style={{ textDecoration: 'none', padding: '6px 12px' }}>
                              🌐 Abrir Vitrina
                            </a>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="glow-text-cyan">{equiposDelTaller} activos</td>
                          <td>
                            <b className={Number(t.saldoDeudor) > 0 ? 'glow-text-red' : 'glow-text-green'} style={{ fontSize: '17px' }}>
                              ${Number(t.saldoDeudor || 0).toLocaleString()}
                            </b>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => registrarPagoCtaCteTaller(t)} className="neon-btn neon-btn-green">💵 Cobrar</button>
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

        {/* ========================================================================= */}
        {/* MÓDULO 6: STOCK Y CARGA EXPLICITA DEL "PRECIO DE LISTA" + VISTA DE LISTAS */}
        {/* ========================================================================= */}
        {pestaña === 'catalogo' && puedeVentasStockFinanzas && (
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

              {/* Simulador Visual en Vivo de las 3 Listas */}
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

        {/* ========================================== */}
        {/* MÓDULO 7: RMA & GARANTÍAS                  */}
        {/* ========================================== */}
        {pestaña === 'rma' && puedeGestionarOrdenes && (
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

        {/* ========================================== */}
        {/* MÓDULO 8: PEDIDOS WEB DE MI TIENDA         */}
        {/* ========================================== */}
        {pestaña === 'pedidos' && puedeVentasStockFinanzas && (
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

        {/* ========================================== */}
        {/* MÓDULO 9: CRM CLIENTES PRIVADO             */}
        {/* ========================================== */}
        {pestaña === 'clientes' && puedeVentasStockFinanzas && (
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

        {/* ========================================== */}
        {/* MÓDULO 10: IMPORTADOR EXCEL PRIVADO        */}
        {/* ========================================== */}
        {pestaña === 'proveedores' && puedeVentasStockFinanzas && (
          <div className="neon-card">
            <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🚚 Importar Lista Excel al Stock de {nombreNegocioActivo}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px' }}>
              El sistema tomará la columna de Costo de tu Excel, le sumará el <b>{config.margenGanancia}% de ganancia</b> y lo guardará automáticamente como el <b>Precio de Lista</b> de cada artículo.
            </p>
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

        {/* ========================================== */}
        {/* MÓDULO 11: FINANZAS PRIVADAS POR LOCAL     */}
        {/* ========================================== */}
        {pestaña === 'finanzas' && puedeVentasStockFinanzas && (
          <div>
            <h2 className="glow-text-green" style={{ marginTop: 0 }}>💰 Caja y Movimientos Financieros // {nombreNegocioActivo}</h2>
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

              <div className="neon-card" style={{ flex: '2 1 600px', overflowX: 'auto' }}>
                <table className="neon-table">
                  <thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th><th>Borrar</th></tr></thead>
                  <tbody>
                    {movimientosFiltrados.map(m => (
                      <React.Fragment key={m.id}>
                        <tr>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.fecha ? new Date(m.fecha.seconds * 1000).toLocaleString() : 'Reciente'}</td>
                          <td>
                            {m.items?.length > 0 && (
                              <button onClick={() => setExpandidoId(expandidoId === m.id ? null : m.id)} className="neon-btn" style={{ padding: '4px 10px', marginRight: '6px' }}>{expandidoId === m.id ? '▼' : '▶'}</button>
                            )}
                            <b>{m.concepto}</b>
                          </td>
                          <td className="glow-text-cyan" style={{ textTransform: 'uppercase' }}>{m.metodoPago}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }} className={m.tipo === 'ingreso' ? 'glow-text-green' : 'glow-text-red'}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString()}</td>
                          <td><button onClick={async()=>{if(window.confirm('¿Borrar?'))await deleteDoc(doc(db,'finanzas',m.id))}} className="neon-btn neon-btn-red" style={{ padding: '4px 10px' }}>🗑️</button></td>
                        </tr>
                        {expandidoId === m.id && (
                          <tr style={{ background: 'rgba(0, 122, 255, 0.04)' }}>
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

        {/* ========================================================================= */}
        {/* MÓDULO 12: GESTIÓN DE USUARIOS Y ROLES + CONFIG DE LISTAS                 */}
        {/* ========================================================================= */}
        {pestaña === 'configuracion' && esAdminDelNegocioActivo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div className="neon-card">
              <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🛡️ Gestión de Usuarios y Roles de {nombreNegocioActivo}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px', marginBottom: '16px' }}>
                Crea cuentas para tu equipo con permisos específicos. Los colaboradores creados aquí solo tendrán acceso a los datos de <b>{nombreNegocioActivo}</b>.
              </p>
              <form onSubmit={agregarUsuarioRol} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px', background: 'var(--bg-input)', padding: '16px', borderRadius: '16px' }}>
                <div>
                  <label className="label-neon">Nombre del Colaborador</label>
                  <input type="text" className="neon-input" placeholder="Ej: Lucas (Mostrador)" required value={nuevoUserNombre} onChange={e=>setNuevoUserNombre(e.target.value)} />
                </div>
                <div>
                  <label className="label-neon">Email de Acceso</label>
                  <input type="email" className="neon-input" placeholder="empleado@local.com" required value={nuevoUserEmail} onChange={e=>setNuevoUserEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label-neon">Contraseña (Mín. 6 caract.)</label>
                  <input type="text" className="neon-input" placeholder="Crear clave de ingreso" minLength={6} value={nuevoUserPassword} onChange={e=>setNuevoUserPassword(e.target.value)} />
                </div>
                <div>
                  <label className="label-neon">Rol y Permisos Asignados</label>
                  <select className="neon-select" value={nuevoUserRol} onChange={e=>setNuevoUserRol(e.target.value)}>
                    <option value="recepcion_ordenes">🔧 Ingreso y Gestión de Órdenes de Reparación</option>
                    <option value="vendedor_admin">💼 Vendedor y Admin (Ventas, Artículos, Precios y Finanzas)</option>
                    <option value="admin">👑 Administrador Total del Local</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" disabled={creandoEmpleado} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '13px' }}>
                    {creandoEmpleado ? 'Creando Cuenta...' : '➕ Crear Usuario y Asignar Rol'}
                  </button>
                </div>
              </form>

              <table className="neon-table">
                <thead><tr><th>Colaborador</th><th>Email de Usuario</th><th>Rol y Función</th><th>Acción</th></tr></thead>
                <tbody>
                  {misEmpleados.map(u => (
                    <tr key={u.id}>
                      <td><b>{u.nombre}</b></td>
                      <td>{u.email}</td>
                      <td>
                        <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)' }}>
                          {u.rol === 'recepcion_ordenes' || u.rol === 'tecnico' 
                            ? '🔧 Ingreso y Gestión de Órdenes' 
                            : u.rol === 'vendedor_admin' || u.rol === 'vendedor'
                              ? '💼 Ventas, Artículos, Precios y Finanzas'
                              : '👑 Administrador Total'}
                        </span>
                      </td>
                      <td><button onClick={()=>deleteDoc(doc(db, 'usuarios_roles', u.id))} className="neon-btn neon-btn-red">Quitar Acceso</button></td>
                    </tr>
                  ))}
                  {misEmpleados.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aún no has creado perfiles adicionales para tu local.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {!esSucursalExterna && (
              <form onSubmit={guardarConfiguracion} className="neon-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🎨 Apariencia Visual, Tipografía y Botones (Estilo iOS 26.1)</h3>
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

                <h3 className="glow-text-cyan" style={{ marginTop: '10px', marginBottom: 0 }}>⚙️ Parámetros de Precios de Lista, Descuentos y Recargos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div><label className="label-neon">Empresa Central</label><input type="text" className="neon-input" value={conf.empresaNombre} onChange={e=>setConf({...conf, empresaNombre: e.target.value})} /></div>
                  <div><label className="label-neon">Dirección</label><input type="text" className="neon-input" value={conf.direccion} onChange={e=>setConf({...conf, direccion: e.target.value})} /></div>
                  <div><label className="label-neon">WhatsApp</label><input type="text" className="neon-input" value={conf.whatsapp} onChange={e=>setConf({...conf, whatsapp: e.target.value})} /></div>
                  <div><label className="label-neon">Dólar Ref ($)</label><input type="number" className="neon-input" value={conf.cotizacionDolar} onChange={e=>setConf({...conf, cotizacionDolar: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Markup sobre Costo (% para Precio Lista)</label><input type="number" className="neon-input" value={conf.margenGanancia} onChange={e=>setConf({...conf, margenGanancia: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Descuento Efectivo sobre Lista (%)</label><input type="number" className="neon-input" value={conf.descuentoEfectivoPorcentaje} onChange={e=>setConf({...conf, descuentoEfectivoPorcentaje: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Recargo Tarjeta sobre Lista (%)</label><input type="number" className="neon-input" value={conf.recargoTarjetaPorcentaje} onChange={e=>setConf({...conf, recargoTarjetaPorcentaje: Number(e.target.value)})} /></div>
                  <div><label className="label-neon">Alias / CBU</label><input type="text" className="neon-input" value={conf.aliasTransferencia} onChange={e=>setConf({...conf, aliasTransferencia: e.target.value})} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label className="label-neon">Sectores de Laboratorio</label><input type="text" className="neon-input" value={conf.sectoresTaller} onChange={e=>setConf({...conf, sectoresTaller: e.target.value})} /></div>
                </div>
                <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ padding: '15px' }}>💾 Guardar Tema y Parámetros</button>
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