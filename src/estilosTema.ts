// src/estilosTema.ts

// src/estilosTema.ts (Reemplazar el bloque CONFIG_DEFAULT al inicio del archivo)

export const CONFIG_DEFAULT = {
  temaVisual: "claro",
  tamanoFuenteBase: 17,
  empresaNombre: "WALABBA TECNO",
  eslogan: "Laboratorio Central de Microelectrónica & Hub B2B",
  
  // --- DATOS FISCALES ARCA (EX AFIP) ---
  razonSocial: "JOSE LUIS SENA",
  cuit: "20-24555666-3",
  condicionIva: "Responsable Monotributo",
  puntoVentaArca: "00001",
  ingresosBrutos: "20-24555666-3",
  inicioActividades: "01/03/2020",
  modoArca: "homologacion",
  arcaCertCrt: "",
  arcaPrivateKey: "",
  arcaAliasWsfe: "walabba_wsfe",

  // --- ESCALAS DE GANANCIA EN USD (CENTRAL VS GREMIO) ---
  escala1MaxUsd: 30,
  escala1MargenPublico: 80,
  escala1MargenGremio: 45,
  escala2MaxUsd: 80,
  escala2MargenPublico: 55,
  escala2MargenGremio: 30,
  escala3MargenPublico: 35,
  escala3MargenGremio: 20,
  topeUsdSinSenaGremio: 70, // Si el repuesto supera USD 70, pide 50% de seña también al Gremio

  // --- LOGÍSTICA DE COMISIONISTAS Y REPARTIDOR LOCAL ---
  comisionistasLista: "Comisionista Mar del Plata (Lun/Mié/Vie):4500, Comisionista CABA / BsAs (Mar/Jue):7500, Encomienda Micro / Correo:6500, Stock en Pañol Local (Sin Flete):0",
  repartidorLocalCosto: 2000,

  // --- MODALIDADES DE PAGO Y CUOTAS ---
  descuentoEfectivoPorcentaje: 10,
  recargoTarjeta1Pago: 15,
  recargoTarjeta3Cuotas: 28,
  recargoTarjeta6Cuotas: 45,

  // --- VINCULACIÓN DE CATÁLOGOS EXTERNOS POR URL ---
  urlsProveedoresVinculados: "https://api.mercadolibre.com/sites/MLA/search?q=",
  mostrarArticulosProveedorEnTienda: false,

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
  redondeoPrecios: "100",
  stockCriticoAlerta: 3,
  compraMinima: 0,
  envioLocalCosto: 1500,
  envioGratisDesde: 50000,
  aliasTransferencia: "walabba.tecno.mp",
  bancoTitular: "Jose Luis Sena - Mercado Pago",
  linkMercadoPago: "",
  catalogoPublicoPrecios: true,
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

export const PERMISOS_DEFAULT_POR_ROL: Record<string, string[]> = {
  recepcion_ordenes: ['presupuestos', 'taller', 'rma'],
  vendedor_admin: ['pos', 'presupuestos', 'catalogo', 'pedidos', 'clientes', 'proveedores', 'finanzas'],
  admin: ['dashboard', 'pos', 'presupuestos', 'taller', 'talleres_b2b', 'catalogo', 'rma', 'pedidos', 'clientes', 'proveedores', 'finanzas', 'configuracion']
};

export const LISTA_MODULOS_PERMISOS = [
  { id: 'dashboard', label: '📊 Resumen & Tienda' },
  { id: 'pos', label: '🛒 Caja POS & ARCA' },
  { id: 'presupuestos', label: '📄 Presupuestos' },
  { id: 'taller', label: '🛠️ Órdenes de Taller' },
  { id: 'catalogo', label: '📦 Stock, Inflación y URL' },
  { id: 'rma', label: '🔄 Garantías & RMA' },
  { id: 'pedidos', label: '🌐 Pedidos Web' },
  { id: 'clientes', label: '👥 Clientes CRM' },
  { id: 'proveedores', label: '🚚 Importar Excel' },
  { id: 'finanzas', label: '💰 Caja y Finanzas' },
  { id: 'configuracion', label: '🛡️ Usuarios y Config' }
];

export const aplicarRedondeo = (valor: number, multiploStr: string) => {
  const multiplo = Number(multiploStr) || 1;
  if (multiplo <= 1) return Math.round(valor);
  return Math.ceil(valor / multiplo) * multiplo;
};

export const imprimirFacturaARCA = (movimiento: any, datosFiscalesEmisor: any) => {
  const fac = movimiento.factura;
  if (!fac) return alert("Este movimiento aún no tiene una factura ARCA emitida.");

  const cuitEmisorLimpio = Number((datosFiscalesEmisor.cuit || "20000000000").replace(/\D/g, "")) || 20000000000;
  const ptoVtaNum = Number(fac.puntoVenta || datosFiscalesEmisor.puntoVentaArca || 1);
  const codTipoCmp = fac.tipo === "A" ? 1 : fac.tipo === "B" ? 6 : 11;
  const nroCmpNum = Number((fac.numero || "1").split("-").pop()) || 1;
  const docReceptorNum = Number((fac.cuit || "0").replace(/\D/g, "")) || 0;

  const jsonArcaQr = {
    ver: 1,
    fecha: new Date().toISOString().slice(0, 10),
    cuit: cuitEmisorLimpio,
    ptoVta: ptoVtaNum,
    tipoCmp: codTipoCmp,
    nroCmp: nroCmpNum,
    importe: Number(movimiento.monto || 0),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: docReceptorNum > 99999999 ? 80 : docReceptorNum > 0 ? 96 : 99,
    nroDocRec: docReceptorNum,
    tipoCodAut: "E",
    codAut: Number(fac.cae || "74000000000000")
  };

  const base64Arca = btoa(JSON.stringify(jsonArcaQr));
  const urlOficialArca = `https://www.arca.gob.ar/fe/qr/?p=${base64Arca}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(urlOficialArca)}`;

  const netoGravado = fac.tipo === "A" ? (Number(movimiento.monto) / 1.21).toFixed(2) : Number(movimiento.monto).toFixed(2);
  const ivaMonto = fac.tipo === "A" ? (Number(movimiento.monto) - Number(netoGravado)).toFixed(2) : "0.00";

  const v = window.open("", "_blank");
  if (!v) return;
  v.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Factura ${fac.tipo} ${fac.numero} - ARCA</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 20px; background: #f2f2f7; }
          .hoja-fiscal { background: #fff; max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 25px; }
          .cabecera-fiscal { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .letra-caja { border: 2px solid #000; width: 65px; height: 65px; text-align: center; background: #fff; margin: 0 15px; }
          .letra-caja h1 { margin: 2px 0 0 0; font-size: 36px; }
          .letra-caja small { font-size: 9px; font-weight: bold; display: block; }
          .bloque-receptor { border-bottom: 2px solid #000; padding: 12px 0; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          table { width: 100%; border-collapse: collapse; margin: 18px 0; min-height: 160px; }
          th { background: #eee; border: 1px solid #000; padding: 8px; font-size: 12px; text-align: left; }
          td { border-bottom: 1px solid #ddd; padding: 8px; font-size: 13px; }
          .pie-arca { border-top: 2px solid #000; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
          @media print { body { background: #fff; padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="max-width:800px; margin:0 auto 12px auto; text-align:right;">
          <button onclick="window.print()" style="background:#007aff; color:#fff; border:none; padding:10px 22px; border-radius:999px; font-weight:bold; cursor:pointer;">🖨️ Imprimir Comprobante Oficial ARCA</button>
        </div>
        <div class="hoja-fiscal">
          <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:6px; margin-bottom:12px; font-weight:bold; font-size:13px;">ORIGINAL</div>
          <div class="cabecera-fiscal">
            <div style="flex:1;">
              <h2 style="margin:0 0 6px 0; font-size:20px;">${datosFiscalesEmisor.empresaNombre || "WALABBA TECNO"}</h2>
              <div style="font-size:12px; line-height:1.5;">
                <b>Razón Social:</b> ${datosFiscalesEmisor.razonSocial || datosFiscalesEmisor.empresaNombre}<br/>
                <b>Domicilio:</b> ${datosFiscalesEmisor.direccion || "-"}<br/>
                <b>Condición IVA:</b> ${datosFiscalesEmisor.condicionIva || "Responsable Monotributo"}
              </div>
            </div>
            <div class="letra-caja"><h1>${fac.tipo}</h1><small>COD. 0${codTipoCmp}</small></div>
            <div style="flex:1; text-align:right; font-size:12px; line-height:1.5;">
              <h2 style="margin:0 0 6px 0; font-size:20px;">FACTURA</h2>
              <b>Pto. Venta: ${String(ptoVtaNum).padStart(5, "0")} — Comp. Nro: ${String(nroCmpNum).padStart(8, "0")}</b><br/>
              <b>Fecha:</b> ${fac.fechaEmision || new Date().toLocaleDateString()}<br/>
              <b>CUIT:</b> ${datosFiscalesEmisor.cuit || "-"}<br/>
              <b>IIBB:</b> ${datosFiscalesEmisor.ingresosBrutos || datosFiscalesEmisor.cuit || "-"}
            </div>
          </div>
          <div class="bloque-receptor">
            <div><b>CUIT / DNI Receptor:</b> ${fac.cuit || "00-00000000-0"}</div>
            <div><b>Razón Social:</b> ${fac.razonSocialReceptor || "Consumidor Final"}</div>
            <div><b>Condición IVA:</b> ${fac.condicionIvaReceptor || "Consumidor Final"}</div>
            <div><b>Condición Venta:</b> ${movimiento.metodoPago?.toUpperCase() || "CONTADO"}</div>
          </div>
          <table>
            <thead><tr><th>Cant.</th><th>Descripción</th><th style="text-align:right;">Unitario</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>
              ${movimiento.items && movimiento.items.length > 0 
                ? movimiento.items.map((it: any) => `<tr><td>${it.cantidad || 1}</td><td>${it.nombre}</td><td style="text-align:right;">$${Number(it.precio || 0).toLocaleString()}</td><td style="text-align:right; font-weight:bold;">$${(Number(it.precio || 0) * Number(it.cantidad || 1)).toLocaleString()}</td></tr>`).join('')
                : `<tr><td>1</td><td>${movimiento.concepto}</td><td style="text-align:right;">$${Number(movimiento.monto || 0).toLocaleString()}</td><td style="text-align:right; font-weight:bold;">$${Number(movimiento.monto || 0).toLocaleString()}</td></tr>`
              }
            </tbody>
          </table>
          <div style="text-align:right; background:#f8f9fa; padding:12px; border:1px solid #000; font-size:14px;">
            ${fac.tipo === "A" ? `<div>Neto: $${Number(netoGravado).toLocaleString()} | IVA 21%: $${Number(ivaMonto).toLocaleString()}</div>` : ""}
            <div style="font-size:19px; font-weight:900; margin-top:4px;">TOTAL: $${Number(movimiento.monto || 0).toLocaleString()}</div>
          </div>
          <div class="pie-arca">
            <div style="display:flex; align-items:center; gap:15px;">
              <img src="${qrImgUrl}" alt="QR ARCA" style="width:105px; height:105px; border:1px solid #ccc;" />
              <div>
                <div style="font-weight:900; font-size:18px;">ARCA</div>
                <div style="font-size:10px; font-weight:bold;">COMPROBANTE AUTORIZADO</div>
              </div>
            </div>
            <div style="text-align:right; font-size:13px;">
              <b>CAE N°:</b> ${fac.cae}<br/>
              <b>Vto. CAE:</b> ${fac.vtoCae || "-"}
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
  v.document.close();
};

export const getEstilosTema = (temaConfig: string, fontSizeBase: number = 17) => {
  const prefiereOscuroSO = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const temaEfectivo = temaConfig === 'sistema' ? (prefiereOscuroSO ? 'oscuro' : 'claro') : (temaConfig || 'claro');

  const paletas: Record<string, any> = {
    claro: {
      bgMain: '#f2f2f7', bgCard: 'rgba(255, 255, 255, 0.90)', bgInput: '#ffffff', bgSidebar: 'rgba(248, 249, 252, 0.95)', bgNav: 'rgba(255, 255, 255, 0.88)',
      textMain: '#1c1c1e', textMuted: '#636366', primary: '#007aff', success: '#28cd41', accentPink: '#5856d6', accentPurple: '#af52de', warning: '#ff9500', danger: '#ff3b30',
      borderCard: 'rgba(0, 0, 0, 0.08)', borderInput: '#d1d1d6', shadowCard: '0 8px 24px rgba(0, 0, 0, 0.05)',
      fontHeading: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif", fontBody: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif", esNeon: false
    },
    oscuro: {
      bgMain: '#000000', bgCard: 'rgba(28, 28, 30, 0.90)', bgInput: '#2c2c2e', bgSidebar: 'rgba(18, 18, 20, 0.95)', bgNav: 'rgba(28, 28, 30, 0.88)',
      textMain: '#f2f2f7', textMuted: '#98989d', primary: '#0a84ff', success: '#30d158', accentPink: '#5e5ce6', accentPurple: '#bf5af2', warning: '#ff9f0a', danger: '#ff453a',
      borderCard: 'rgba(255, 255, 255, 0.12)', borderInput: '#3a3a3c', shadowCard: '0 8px 28px rgba(0, 0, 0, 0.4)',
      fontHeading: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif", fontBody: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif", esNeon: false
    },
    neon: {
      bgMain: '#060911', bgCard: 'rgba(13, 19, 34, 0.92)', bgInput: '#080c16', bgSidebar: 'rgba(8, 12, 22, 0.98)', bgNav: 'rgba(6, 9, 17, 0.95)',
      textMain: '#e2e8f0', textMuted: '#8b9bb4', primary: '#00f3ff', success: '#00ff9d', accentPink: '#ff00ff', accentPurple: '#b537f2', warning: '#ffee00', danger: '#ff0055',
      borderCard: 'rgba(0, 243, 255, 0.25)', borderInput: 'rgba(0, 243, 255, 0.3)', shadowCard: '0 8px 28px rgba(0, 0, 0, 0.6)',
      fontHeading: "'Orbitron', sans-serif", fontBody: "'Rajdhani', sans-serif", esNeon: true
    }
  };

  const p = paletas[temaEfectivo] || paletas.claro;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap');
    :root { --bg-dark: ${p.bgMain}; --bg-card: ${p.bgCard}; --bg-input: ${p.bgInput}; --neon-cyan: ${p.primary}; --neon-pink: ${p.accentPink}; --neon-green: ${p.success}; --neon-purple: ${p.accentPurple}; --neon-yellow: ${p.warning}; --neon-red: ${p.danger}; --text-main: ${p.textMain}; --text-muted: ${p.textMuted}; }
    body { background-color: var(--bg-dark); color: var(--text-main); font-family: ${p.fontBody}; font-size: ${fontSizeBase}px; line-height: 1.5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, h4 { font-family: ${p.fontHeading}; font-weight: 700; color: var(--text-main); }
    .neon-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid ${p.borderCard}; border-radius: 20px; box-shadow: ${p.shadowCard}; padding: 22px; }
    .neon-card-pink { border-color: ${p.esNeon ? 'rgba(255,0,255,0.35)' : 'rgba(88,86,214,0.3)'}; }
    .neon-card-green { border-color: ${p.esNeon ? 'rgba(0,255,157,0.35)' : 'rgba(40,205,65,0.3)'}; }
    .neon-card-purple { border-color: ${p.esNeon ? 'rgba(181,55,242,0.35)' : 'rgba(175,82,222,0.3)'}; }
    .neon-card-yellow { border-color: ${p.esNeon ? 'rgba(255,238,0,0.35)' : 'rgba(255,149,0,0.3)'}; }
    .neon-input, .neon-select, .neon-textarea { background: var(--bg-input); border: 1px solid ${p.borderInput}; color: var(--text-main); padding: 11px 14px; border-radius: 14px; font-family: ${p.fontBody}; font-size: ${fontSizeBase - 1}px; width: 100%; box-sizing: border-box; }
    .neon-btn { background: ${p.esNeon ? 'rgba(0,243,255,0.08)' : (temaEfectivo === 'claro' ? 'rgba(0,122,255,0.1)' : 'rgba(10,132,255,0.18)')}; backdrop-filter: blur(20px); border: 1px solid ${p.esNeon ? 'var(--neon-cyan)' : 'rgba(0,122,255,0.22)'}; color: var(--neon-cyan); padding: 10px 18px; border-radius: 9999px; font-family: ${p.fontHeading}; font-size: ${fontSizeBase - 2}px; font-weight: 600; cursor: pointer; transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
    .neon-btn:hover:not(:disabled) { background: var(--neon-cyan); color: ${p.esNeon ? '#000' : '#fff'}; transform: scale(1.02); }
    .neon-btn:active:not(:disabled) { transform: scale(0.96); }
    .neon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .neon-btn-fillCyan { background: linear-gradient(180deg, ${p.esNeon ? '#00c6ff' : '#2e90ff'} 0%, var(--neon-cyan) 100%); color: #fff; border: none; }
    .neon-btn-green { border-color: var(--neon-green); color: ${temaEfectivo === 'claro' ? '#198754' : 'var(--neon-green)'}; }
    .neon-btn-pink { border-color: var(--neon-pink); color: var(--neon-pink); }
    .neon-btn-purple { border-color: var(--neon-purple); color: var(--neon-purple); }
    .neon-btn-red { border-color: var(--neon-red); color: var(--neon-red); }
    .neon-table { width: 100%; border-collapse: collapse; font-size: ${fontSizeBase - 1}px; }
    .neon-table th { background: ${temaEfectivo === 'claro' ? '#f2f2f7' : 'rgba(255,255,255,0.06)'}; color: var(--text-muted); font-weight: 700; font-size: ${fontSizeBase - 3}px; padding: 12px; text-align: left; border-bottom: 1px solid ${p.borderInput}; text-transform: uppercase; }
    .neon-table td { padding: 12px; border-bottom: 1px solid ${p.borderCard}; }
    .neon-badge { padding: 4px 11px; border-radius: 9999px; font-size: ${fontSizeBase - 4}px; font-weight: 700; display: inline-block; }
    .glow-text-cyan { color: var(--neon-cyan); }
    .glow-text-green { color: ${temaEfectivo === 'claro' ? '#198754' : 'var(--neon-green)'}; }
    .glow-text-pink { color: var(--neon-pink); }
    .glow-text-red { color: var(--neon-red); }
    .glow-text-yellow { color: ${temaEfectivo === 'claro' ? '#d97706' : 'var(--neon-yellow)'}; }
    .label-neon { display: block; font-size: ${fontSizeBase - 3}px; font-weight: 600; color: var(--text-muted); margin-bottom: 5px; }
    .erp-layout { display: flex; min-height: calc(100vh - 65px); }
    .erp-sidebar { width: 260px; background: ${p.bgSidebar}; border-right: 1px solid ${p.borderCard}; padding: 16px 12px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .erp-main { flex: 1; padding: 22px; overflow-x: hidden; }
    .side-btn { width: 100%; justify-content: flex-start; padding: 11px 15px; border-color: transparent; color: var(--text-muted); background: transparent; border-radius: 14px; }
    .side-btn.active { background: var(--neon-cyan); color: ${p.esNeon ? '#000' : '#fff'}; font-weight: 700; }
    .top-nav-bar { padding: 12px 25px; background: ${p.bgNav}; border-bottom: 1px solid ${p.borderCard}; display: flex; gap: 20px; align-items: center; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); }
    @media (max-width: 900px) { .erp-layout { flex-direction: column; } .erp-sidebar { width: 100%; flex-direction: row; overflow-x: auto; } .side-btn { width: auto; white-space: nowrap; } }
  `;
};