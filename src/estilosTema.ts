// src/estilosTema.ts

export const CONFIG_DEFAULT = {
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
  
  export const CHECKLIST_ITEMS = [
    "Enciende", "Display OK", "Táctil OK", "Pin Carga OK", 
    "Batería OK", "Cámaras OK", "Audio / Mic", "WiFi / Señal", 
    "Bandeja SIM", "MicroSD", "Con Funda", "Mojado / Sulfato"
  ];
  
  export const aplicarRedondeo = (valor: number, multiploStr: string) => {
    const multiplo = Number(multiploStr) || 1;
    if (multiplo <= 1) return Math.round(valor);
    return Math.ceil(valor / multiplo) * multiplo;
  };
  
  export const getEstilosTema = (temaConfig: string, fontSizeBase: number = 17) => {
    const prefiereOscuroSO = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const temaEfectivo = temaConfig === 'sistema' ? (prefiereOscuroSO ? 'oscuro' : 'claro') : (temaConfig || 'claro');
  
    const paletas: Record<string, any> = {
      claro: {
        bgMain: '#f2f2f7',
        bgCard: 'rgba(255, 255, 255, 0.90)',
        bgInput: '#ffffff',
        bgSidebar: 'rgba(248, 249, 252, 0.95)',
        bgNav: 'rgba(255, 255, 255, 0.88)',
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
        bgCard: 'rgba(28, 28, 30, 0.90)',
        bgInput: '#2c2c2e',
        bgSidebar: 'rgba(18, 18, 20, 0.95)',
        bgNav: 'rgba(28, 28, 30, 0.88)',
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