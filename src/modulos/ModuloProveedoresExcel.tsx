// src/modulos/ModuloProveedoresExcel.tsx
import React, { useState } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { aplicarRedondeo } from '../estilosTema';

interface PropsProveedores {
  tenantId: string;
  nombreNegocioActivo: string;
  misProductos: any[];
  config: any;
}

export const ModuloProveedoresExcel: React.FC<PropsProveedores> = ({
  tenantId,
  nombreNegocioActivo,
  misProductos,
  config
}) => {
  // --- ESTADOS IMPORTADOR EXCEL ---
  const [excelCargando, setExcelCargando] = useState(false);
  const [excelHojas, setExcelHojas] = useState<string[]>([]);
  const [hojaActiva, setHojaActiva] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [colNombre, setColNombre] = useState<number>(0);
  const [colCosto, setColCosto] = useState<number>(1);
  const [colMarca, setColMarca] = useState<number>(-1);
  const [nombreProveedorExcel, setNombreProveedorExcel] = useState('');
  const [monedaListaExcel, setMonedaListaExcel] = useState<'ARS' | 'USD'>('ARS');
  const [ocultarEnTiendaOficial, setOcultarEnTiendaOficial] = useState(true);

  // --- ESTADOS CONECTOR WEB CON LOGIN / SESIÓN / EXTRACTOR ---
  const [modoCapturaWeb, setModoCapturaWeb] = useState<'extractor_logueado' | 'url_con_credenciales'>('extractor_logueado');
  const [urlCatalogoExterno, setUrlCatalogoExterno] = useState(config.urlsProveedoresVinculados || '');
  const [terminoBusquedaUrl, setTerminoBusquedaUrl] = useState('');
  const [monedaWebOrigen, setMonedaWebOrigen] = useState<'ARS' | 'USD'>('ARS');
  const [margenPersonalizadoWeb, setMargenPersonalizadoWeb] = useState<string>(String(config.margenGanancia || 100));
  const [categoriaDestinoWeb, setCategoriaDestinoWeb] = useState('Repuestos Importados');
  const [nombreProveedorWeb, setNombreProveedorWeb] = useState('Proveedor Web');

  // Credenciales para sitios con API / Basic Auth / Cookie de sesión
  const [loginUsuarioWeb, setLoginUsuarioWeb] = useState('');
  const [loginPasswordWeb, setLoginPasswordWeb] = useState('');
  const [cookieOTokenSesion, setCookieOTokenSesion] = useState('');

  // Contenido pegado desde página con sesión iniciada (Texto o HTML)
  const [contenidoPegadoWeb, setContenidoPegadoWeb] = useState('');
  const [itemsUrlPreview, setItemsUrlPreview] = useState<any[]>([]);
  const [cargandoUrl, setCargandoUrl] = useState(false);

  const parsePrecio = (valor: any) => {
    if (valor === undefined || valor === null || valor === '') return NaN;
    if (typeof valor === 'number') return valor;
    let str = valor.toString().replace(/[^0-9.,-]/g, '');
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
      else str = str.replace(/,/g, '');
    } else if (str.includes(',')) {
      const partes = str.split(',');
      if (partes[partes.length - 1].length === 3) str = str.replace(/,/g, '');
      else str = str.replace(',', '.');
    } else if (str.includes('.')) {
      const partes = str.split('.');
      if (partes[partes.length - 1].length === 3 && partes.length > 1) str = str.replace(/\./g, '');
    }
    return parseFloat(str);
  };

  // --- FUNCIONES EXCEL ---
  const seleccionarHojaExcel = (wb: any, sheetName: string) => {
    setHojaActiva(sheetName);
    const ws = wb.Sheets[sheetName];
    const data = (window as any).XLSX.utils.sheet_to_json(ws, { header: 1 });
    setExcelData(data);
  };

  const procesarArchivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(window as any).XLSX) return alert('Librería Excel cargando, intenta en 2 segundos...');
    setExcelCargando(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        setExcelHojas(wb.SheetNames);
        if (wb.SheetNames.length > 0) seleccionarHojaExcel(wb, wb.SheetNames[0]);
        (window as any).__currentWorkbook = wb;
      } catch (error) {
        alert('Error leyendo el archivo Excel');
      } finally {
        setExcelCargando(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const cambiarHojaDropdown = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    if ((window as any).__currentWorkbook) seleccionarHojaExcel((window as any).__currentWorkbook, sheetName);
  };

  const importarDatosAlInventario = async () => {
    if (excelData.length === 0) return alert('No hay datos cargados.');
    if (!nombreProveedorExcel) return alert('Ingresa el nombre del proveedor para identificar la lista.');
    if (!window.confirm(`¿Importar desde "${hojaActiva}" al catálogo de ${nombreNegocioActivo}?`)) return;

    let agregados = 0;
    let actualizados = 0;
    let omitidos = 0;
    let marcaActual = 'General';
    const fechaActualizacion = new Date().toLocaleDateString();
    const factorMoneda = monedaListaExcel === 'USD' ? Number(config.cotizacionDolar || 1) : 1;

    setExcelCargando(true);
    try {
      let batch = writeBatch(db);
      let operacionActual = 0;
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        if (!row || row.length === 0) continue;
        const nombreObtenido = row[colNombre]?.toString().trim();
        const costoBruto = parsePrecio(row[colCosto]);
        const marcaDetectada = colMarca >= 0 ? row[colMarca]?.toString().trim() : null;

        if (marcaDetectada && isNaN(costoBruto)) {
          marcaActual = marcaDetectada;
          continue;
        }
        if (nombreObtenido && !isNaN(costoBruto) && costoBruto > 0) {
          const costoEnPesos = Math.round(costoBruto * factorMoneda);
          const precioConMargen = costoEnPesos * (1 + (Number(config.margenGanancia) / 100));
          const precioFinalRedondeado = aplicarRedondeo(precioConMargen, config.redondeoPrecios);
          const nombreFinal = colMarca === -1 ? nombreObtenido : `${marcaActual} - ${nombreObtenido}`;

          const productoExistente = misProductos.find(p => p.nombre.toLowerCase() === nombreFinal.toLowerCase());
          if (productoExistente) {
            batch.update(doc(db, 'productos', productoExistente.id), {
              costoProveedor: costoEnPesos,
              precio: precioFinalRedondeado,
              proveedor: nombreProveedorExcel,
              esDeProveedor: ocultarEnTiendaOficial,
              ultimaActualizacion: fechaActualizacion
            });
            actualizados++;
          } else {
            batch.set(doc(collection(db, 'productos')), {
              ownerId: tenantId,
              nombre: nombreFinal,
              categoria: hojaActiva,
              costoProveedor: costoEnPesos,
              precio: precioFinalRedondeado,
              stock: 0,
              descripcion: ocultarEnTiendaOficial ? 'Importado de lista' : 'Disponible en tienda',
              esDeProveedor: ocultarEnTiendaOficial,
              fecha: serverTimestamp(),
              ventas: 0,
              proveedor: nombreProveedorExcel,
              ultimaActualizacion: fechaActualizacion
            });
            agregados++;
          }
          operacionActual++;
          if (operacionActual >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            operacionActual = 0;
          }
        } else {
          omitidos++;
        }
      }
      if (operacionActual > 0) await batch.commit();
      alert(`⚡ IMPORTACIÓN EXITOSA!\nAgregados: ${agregados} | Actualizados: ${actualizados} | Omitidos: ${omitidos}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setExcelCargando(false);
      setExcelData([]);
    }
  };

  // --- FUNCIÓN 1: PROCESAR HTML O TEXTO COPIADO DESDE UNA PÁGINA YA LOGUEADA ---
  const analizarContenidoLogueado = () => {
    if (!contenidoPegadoWeb.trim()) {
      return alert('Primero abre la página de tu proveedor (iniciando sesión), selecciona los artículos o el código fuente, cópialos y pégalos en el recuadro.');
    }

    const factorDolar = monedaWebOrigen === 'USD' ? Number(config.cotizacionDolar || 1200) : 1;
    const margenAplicar = Number(margenPersonalizadoWeb || config.margenGanancia || 100);
    const detectados: any[] = [];

    // Caso A: El usuario pegó código HTML de la página logueada
    if (contenidoPegadoWeb.includes('<div') || contenidoPegadoWeb.includes('<tr') || contenidoPegadoWeb.includes('<li')) {
      const docHtml = new DOMParser().parseFromString(contenidoPegadoWeb, 'text/html');
      const nodosProductos = docHtml.querySelectorAll('tr, .product, .item, .card, .product-item, li');

      nodosProductos.forEach((nodo) => {
        const textoNodo = (nodo.textContent || '').replace(/\s+/g, ' ').trim();
        const matchPrecio = textoNodo.match(/(?:US\$|USD|\$)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+)/i);
        if (matchPrecio) {
          const valorBruto = parsePrecio(matchPrecio[1]);
          const tituloLimpiado = textoNodo
            .replace(matchPrecio[0], '')
            .replace(/agregar al carrito|comprar|stock|disponible|ver más|añadir/gi, '')
            .trim()
            .slice(0, 95);

          const imgEl = nodo.querySelector('img');
          const linkEl = nodo.querySelector('a');

          if (tituloLimpiado.length >= 4 && !isNaN(valorBruto) && valorBruto > 0) {
            const costoArs = Math.round(valorBruto * factorDolar);
            const precioLista = aplicarRedondeo(costoArs * (1 + margenAplicar / 100), config.redondeoPrecios);
            detectados.push({
              nombre: tituloLimpiado,
              costoOrigen: valorBruto,
              monedaOrigen: monedaWebOrigen,
              costo: costoArs,
              precioLista: precioLista,
              imagen: imgEl?.getAttribute('src') || '',
              url: linkEl?.getAttribute('href') || urlCatalogoExterno || '',
              categoria: categoriaDestinoWeb || 'General'
            });
          }
        }
      });
    }

    // Caso B: El usuario copió y pegó el texto directo desde la pantalla del navegador (Ctrl+A / Ctrl+C)
    if (detectados.length === 0) {
      const lineas = contenidoPegadoWeb.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];
        // Busca precio en la misma línea o en la línea inmediatamente siguiente
        const regexPrecio = /(?:US\$|U\$S|USD|\$)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/i;
        const matchMismaLinea = linea.match(regexPrecio);

        if (matchMismaLinea) {
          const costoNum = parsePrecio(matchMismaLinea[1]);
          let nombreArt = linea.replace(matchMismaLinea[0], '').replace(/[-|•\t]+/g, ' ').trim();
          // Si la línea solo tenía el precio, tomamos la línea anterior como nombre del producto
          if (nombreArt.length < 4 && i > 0) {
            nombreArt = lineas[i - 1].trim();
          }
          if (nombreArt.length >= 4 && !isNaN(costoNum) && costoNum > 0) {
            const costoArs = Math.round(costoNum * factorDolar);
            const precioLista = aplicarRedondeo(costoArs * (1 + margenAplicar / 100), config.redondeoPrecios);
            detectados.push({
              nombre: nombreArt.slice(0, 95),
              costoOrigen: costoNum,
              monedaOrigen: monedaWebOrigen,
              costo: costoArs,
              precioLista: precioLista,
              imagen: '',
              url: urlCatalogoExterno || '',
              categoria: categoriaDestinoWeb || 'General'
            });
          }
        }
      }
    }

    // Eliminar duplicados por nombre
    const unicos = Array.from(new Map(detectados.map(item => [item.nombre.toLowerCase(), item])).values());
    setItemsUrlPreview(unicos);

    if (unicos.length === 0) {
      alert('No se detectaron precios con el símbolo "$" o "USD". Asegúrate de que el texto copiado incluya el nombre del artículo y su precio (Ej: Modulo Moto G84 $25000 o USD 22).');
    }
  };

  // --- FUNCIÓN 2: CONSULTAR URL CON CREDENCIALES / TOKEN / PROXY ---
  const consultarCatalogoPorUrlAutenticada = async () => {
    const base = urlCatalogoExterno || config.urlsProveedoresVinculados;
    if (!base) return alert('Ingresa la URL de la página o API del proveedor.');
    setCargandoUrl(true);

    const factorDolar = monedaWebOrigen === 'USD' ? Number(config.cotizacionDolar || 1200) : 1;
    const margenAplicar = Number(margenPersonalizadoWeb || config.margenGanancia || 100);

    try {
      const endpoint = terminoBusquedaUrl ? `${base}${encodeURIComponent(terminoBusquedaUrl)}` : base;
      const headers: Record<string, string> = {};

      if (loginUsuarioWeb && loginPasswordWeb) {
        headers['Authorization'] = 'Basic ' + btoa(`${loginUsuarioWeb}:${loginPasswordWeb}`);
      } else if (cookieOTokenSesion) {
        headers['Authorization'] = cookieOTokenSesion.startsWith('Bearer ') ? cookieOTokenSesion : `Bearer ${cookieOTokenSesion}`;
      }

      let textoRespuesta = '';
      try {
        const respDirecta = await fetch(endpoint, { headers });
        textoRespuesta = await respDirecta.text();
      } catch {
        // Fallback por Proxy CORS si el servidor bloquea peticiones desde el navegador
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(endpoint)}`;
        const respProxy = await fetch(proxyUrl);
        const jsonProxy = await respProxy.json();
        textoRespuesta = jsonProxy.contents || '';
      }

      // Intentar primero como JSON (APIs / WooCommerce / MercadoLibre / TiendaNube)
      try {
        const data = JSON.parse(textoRespuesta);
        const listaRaw = Array.isArray(data) ? data : (data.results || data.items || data.productos || data.products || []);
        if (listaRaw.length > 0) {
          const mapeados = listaRaw.slice(0, 40).map((it: any) => {
            const costoBruto = Number(it.price || it.precio || it.costo || it.regular_price || 0);
            const costoEnPesos = Math.round(costoBruto * factorDolar);
            const listaCalculada = aplicarRedondeo(costoEnPesos * (1 + margenAplicar / 100), config.redondeoPrecios);
            return {
              nombre: it.title || it.nombre || it.name || 'Artículo sin nombre',
              costoOrigen: costoBruto,
              monedaOrigen: monedaWebOrigen,
              costo: costoEnPesos,
              precioLista: listaCalculada,
              imagen: (it.thumbnail || it.imagenUrl || it.image || it.images?.[0]?.src || '').replace('-I.jpg', '-O.jpg'),
              url: it.permalink || it.url || endpoint,
              categoria: categoriaDestinoWeb || terminoBusquedaUrl || 'Importado Web'
            };
          });
          setItemsUrlPreview(mapeados);
          return;
        }
      } catch {
        // Si no es JSON, es una página HTML: la pasamos al analizador HTML
        setContenidoPegadoWeb(textoRespuesta);
        setTimeout(() => analizarContenidoLogueado(), 100);
      }
    } catch (e) {
      alert('La página requiere sesión interactiva en tu navegador. Usa la pestaña "1. Capturar desde Página con Login Abierta" copiando y pegando los artículos.');
    } finally {
      setCargandoUrl(false);
    }
  };

  // --- GUARDAR INDIVIDUALMENTE O EN LOTE ---
  const importarItemDeUrl = async (item: any, publicarEnTiendaOficial: boolean) => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'productos')), {
      ownerId: tenantId,
      nombre: item.nombre,
      categoria: item.categoria || categoriaDestinoWeb || 'General',
      costoProveedor: item.costo,
      precio: item.precioLista,
      stock: publicarEnTiendaOficial ? 1 : 0,
      descripcion: publicarEnTiendaOficial ? 'Artículo Oficial' : 'Importado de lista',
      imagenUrl: item.imagen || '',
      urlProveedor: item.url || urlCatalogoExterno || '',
      proveedor: nombreProveedorWeb || 'Web Vinculada',
      esDeProveedor: !publicarEnTiendaOficial,
      ultimaActualizacion: new Date().toLocaleDateString(),
      ventas: 0,
      fecha: serverTimestamp()
    });
    await batch.commit();
    alert(`✅ "${item.nombre}" guardado en ${publicarEnTiendaOficial ? '🛍️ Stock del Local (Tienda Oficial)' : '🔧 Stock de Proveedores (Taller)'}.`);
  };

  const importarTodosLosExtraidos = async (publicarEnTiendaOficial: boolean) => {
    if (itemsUrlPreview.length === 0) return;
    const destinoTexto = publicarEnTiendaOficial ? 'Stock del Local (Tienda Oficial)' : 'Catálogo Interno de Proveedores (Taller)';
    if (!window.confirm(`¿Importar los ${itemsUrlPreview.length} artículos extraídos directamente a ${destinoTexto}?`)) return;

    setCargandoUrl(true);
    try {
      let batch = writeBatch(db);
      let cont = 0;
      const hoy = new Date().toLocaleDateString();

      for (const item of itemsUrlPreview) {
        const existente = misProductos.find(p => p.nombre.toLowerCase() === item.nombre.toLowerCase());
        if (existente) {
          batch.update(doc(db, 'productos', existente.id), {
            costoProveedor: item.costo,
            precio: item.precioLista,
            proveedor: nombreProveedorWeb || 'Web Vinculada',
            esDeProveedor: !publicarEnTiendaOficial,
            ultimaActualizacion: hoy
          });
        } else {
          batch.set(doc(collection(db, 'productos')), {
            ownerId: tenantId,
            nombre: item.nombre,
            categoria: item.categoria || categoriaDestinoWeb || 'General',
            costoProveedor: item.costo,
            precio: item.precioLista,
            stock: publicarEnTiendaOficial ? 1 : 0,
            descripcion: publicarEnTiendaOficial ? 'Artículo Oficial' : 'Importado de lista',
            imagenUrl: item.imagen || '',
            urlProveedor: item.url || urlCatalogoExterno || '',
            proveedor: nombreProveedorWeb || 'Web Vinculada',
            esDeProveedor: !publicarEnTiendaOficial,
            ultimaActualizacion: hoy,
            ventas: 0,
            fecha: serverTimestamp()
          });
        }
        cont++;
        if (cont >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          cont = 0;
        }
      }
      if (cont > 0) await batch.commit();
      alert(`🚀 ¡${itemsUrlPreview.length} artículos sincronizados con éxito en ${destinoTexto}!`);
      setItemsUrlPreview([]);
      setContenidoPegadoWeb('');
    } catch (e: any) {
      alert('Error al guardar lote: ' + e.message);
    } finally {
      setCargandoUrl(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* BLOQUE 1: IMPORTADOR EXCEL */}
      <div className="neon-card">
        <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>
          🚚 1. Importar Lista Excel de Proveedores ({nombreNegocioActivo})
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px' }}>
          Por defecto, las listas de proveedores quedan marcadas como <b>Stock de Proveedores (Taller)</b> para que no se mezclen con la venta de accesorios de tu local.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontWeight: 'bold', cursor: 'pointer', color: ocultarEnTiendaOficial ? 'var(--neon-green)' : 'var(--neon-yellow)' }}>
            <input type="checkbox" checked={ocultarEnTiendaOficial} onChange={e => setOcultarEnTiendaOficial(e.target.checked)} /> 🛡️ Mantener separados del Stock del Local (Guardar solo en Catálogo de Proveedores de Taller)
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label className="label-neon">Nombre del Proveedor</label>
            <input type="text" className="neon-input" value={nombreProveedorExcel} onChange={e => setNombreProveedorExcel(e.target.value)} placeholder="Ej: Mayorista Repuestos" />
          </div>
          <div>
            <label className="label-neon">Moneda de la Lista</label>
            <select className="neon-select" value={monedaListaExcel} onChange={e => setMonedaListaExcel(e.target.value as any)}>
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (Multiplica x ${config.cotizacionDolar})</option>
            </select>
          </div>
          <div>
            <label className="label-neon">Archivo .xlsx / .xls</label>
            <input type="file" id="fileExcel" accept=".xlsx, .xls" className="neon-input" onChange={procesarArchivoExcel} />
          </div>
        </div>

        {excelHojas.length > 0 && !excelCargando && (
          <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div>
                <label className="label-neon">Pestaña (Categoría)</label>
                <select className="neon-select" value={hojaActiva} onChange={cambiarHojaDropdown}>
                  {excelHojas.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="label-neon">Col. Nombre</label>
                <select className="neon-select" value={colNombre} onChange={e => setColNombre(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}
                </select>
              </div>
              <div>
                <label className="label-neon">Col. Costo</label>
                <select className="neon-select" value={colCosto} onChange={e => setColCosto(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}
                </select>
              </div>
              <div>
                <label className="label-neon">Col. Marca</label>
                <select className="neon-select" value={colMarca} onChange={e => setColMarca(Number(e.target.value))}>
                  <option value={-1}>No Aplica</option>
                  {[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}
                </select>
              </div>
            </div>
            <button onClick={importarDatosAlInventario} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
              🚀 Sincronizar Precios de Lista con Mi Base de Datos
            </button>
          </div>
        )}
      </div>

      {/* BLOQUE 2: TRAER ARTÍCULOS Y PRECIOS DESDE PÁGINA EXTERNA CON LOGIN */}
      <div className="neon-card neon-card-purple">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div>
            <h3 className="glow-text-pink" style={{ margin: 0 }}>
              🌐 2. Traer Artículos y Precios desde Página Externa Vinculada (Soporta Sitios con Login)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>
              Extrae repuestos o accesorios de páginas mayoristas que requieren iniciar sesión, calcula automáticamente tu Precio de Lista (+{margenPersonalizadoWeb}%) y elige si publicarlos en tu Tienda Oficial o guardarlos en Stock de Proveedores.
            </p>
          </div>
        </div>

        {/* PARÁMETROS DE CÁLCULO (MARGEN +100% / MONEDA ARS o USD / PROVEEDOR) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', marginBottom: '15px' }}>
          <div>
            <label className="label-neon" style={{ color: 'var(--neon-green)' }}>Margen a Sumar (%)</label>
            <input 
              type="number" 
              className="neon-input" 
              value={margenPersonalizadoWeb} 
              onChange={e => setMargenPersonalizadoWeb(e.target.value)} 
              placeholder="Ej: 100"
              style={{ fontWeight: 'bold' }}
            />
          </div>
          <div>
            <label className="label-neon">Moneda de la Página Web</label>
            <select className="neon-select" value={monedaWebOrigen} onChange={e => setMonedaWebOrigen(e.target.value as any)}>
              <option value="ARS">Pesos Argentinos ($ ARS)</option>
              <option value="USD">Dólares (USD x ${config.cotizacionDolar})</option>
            </select>
          </div>
          <div>
            <label className="label-neon">Categoría Destino</label>
            <input 
              type="text" 
              className="neon-input" 
              value={categoriaDestinoWeb} 
              onChange={e => setCategoriaDestinoWeb(e.target.value)} 
              placeholder="Ej: Módulos / Cargadores" 
            />
          </div>
          <div>
            <label className="label-neon">Nombre del Proveedor Web</label>
            <input 
              type="text" 
              className="neon-input" 
              value={nombreProveedorWeb} 
              onChange={e => setNombreProveedorWeb(e.target.value)} 
              placeholder="Ej: Proveedor Mayorista" 
            />
          </div>
        </div>

        {/* SELECTOR DE MÉTODO PARA PÁGINAS CON LOGIN */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setModoCapturaWeb('extractor_logueado')} 
            className={`neon-btn ${modoCapturaWeb === 'extractor_logueado' ? 'neon-btn-fillCyan' : ''}`}
            style={{ flex: 1 }}
          >
            🔐 Opción A: Capturar desde Página con Login Abierta (100% Compatible)
          </button>
          <button 
            type="button" 
            onClick={() => setModoCapturaWeb('url_con_credenciales')} 
            className={`neon-btn ${modoCapturaWeb === 'url_con_credenciales' ? 'neon-btn-fillCyan' : ''}`}
            style={{ flex: 1 }}
          >
            🔗 Opción B: Conexión por URL Directa / Token de Sesión
          </button>
        </div>

        {modoCapturaWeb === 'extractor_logueado' ? (
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '14px', marginBottom: '15px', border: '1px dashed var(--neon-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '13.5px' }}>
                <b>¿Cómo traer los precios si la página pide Login?</b><br />
                1. Hacé clic en <b>"Abrir Página del Proveedor"</b> e iniciá sesión normalmente con tu usuario y clave.<br />
                2. Cuando estés viendo la lista de repuestos con sus precios, presioná <b>Ctrl + A</b> (seleccionar todo) y <b>Ctrl + C</b> (copiar), o copiá el bloque de productos.<br />
                3. Pegalo acá abajo (<b>Ctrl + V</b>) y tocá <b>"🔍 Extraer Artículos y Calcular +{margenPersonalizadoWeb}%"</b>.
              </div>
              {urlCatalogoExterno && (
                <a 
                  href={urlCatalogoExterno} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="neon-btn neon-btn-green" 
                  style={{ textDecoration: 'none' }}
                >
                  🌐 1. Abrir Página del Proveedor ↗
                </a>
              )}
            </div>

            <input 
              type="text" 
              className="neon-input" 
              value={urlCatalogoExterno} 
              onChange={e => setUrlCatalogoExterno(e.target.value)} 
              placeholder="URL de la página de tu proveedor (Ej: https://mayorista.com/catalogo)" 
              style={{ marginBottom: '10px' }} 
            />

            <textarea 
              className="neon-textarea" 
              rows={5} 
              value={contenidoPegadoWeb} 
              onChange={e => setContenidoPegadoWeb(e.target.value)} 
              placeholder="Pega aquí (Ctrl+V) el texto o código HTML copiado de la página del proveedor ya logueada..."
              style={{ marginBottom: '10px' }}
            />

            <button 
              type="button" 
              onClick={analizarContenidoLogueado} 
              className="neon-btn neon-btn-fillCyan" 
              style={{ width: '100%', padding: '13px' }}
            >
              🔍 2. Extraer Artículos y Calcular Precio de Lista (+{margenPersonalizadoWeb}%)
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '14px', marginBottom: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <input 
                type="text" 
                className="neon-input" 
                value={ loginUsuarioWeb } 
                onChange={e => setLoginUsuarioWeb(e.target.value)} 
                placeholder="Usuario / Email del sitio (Opcional)" 
              />
              <input 
                type="password" 
                className="neon-input" 
                value={ loginPasswordWeb } 
                onChange={e => setLoginPasswordWeb(e.target.value)} 
                placeholder="Contraseña del sitio (Opcional)" 
              />
              <input 
                type="text" 
                className="neon-input" 
                value={ cookieOTokenSesion } 
                onChange={e => setCookieOTokenSesion(e.target.value)} 
                placeholder="Token API / Key (Si aplica)" 
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="neon-input" 
                value={urlCatalogoExterno} 
                onChange={e => setUrlCatalogoExterno(e.target.value)} 
                placeholder="URL Base de API / Catálogo..." 
                style={{ flex: 1 }} 
              />
              <input 
                type="text" 
                className="neon-input" 
                value={terminoBusquedaUrl} 
                onChange={e => setTerminoBusquedaUrl(e.target.value)} 
                placeholder="Buscar modelo o repuesto (Ej: Modulo Moto G84)..." 
                style={{ flex: 1 }} 
              />
              <button onClick={consultarCatalogoPorUrlAutenticada} disabled={cargandoUrl} className="neon-btn neon-btn-fillCyan">
                {cargandoUrl ? 'Conectando...' : `🔍 Traer Artículos (+${margenPersonalizadoWeb}%)`}
              </button>
            </div>
          </div>
        )}

        {/* TABLA DE PREVISUALIZACIÓN DE ARTÍCULOS EXTRAÍDOS */}
        {itemsUrlPreview.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <b className="glow-text-cyan">
                ✅ {itemsUrlPreview.length} Artículos detectados (Con +{margenPersonalizadoWeb}% aplicado)
              </b>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  onClick={() => importarTodosLosExtraidos(false)} 
                  className="neon-btn neon-btn-purple"
                >
                  🔧 Guardar TODOS en Stock Proveedores Taller ({itemsUrlPreview.length})
                </button>
                <button 
                  type="button" 
                  onClick={() => importarTodosLosExtraidos(true)} 
                  className="neon-btn neon-btn-green"
                >
                  🛍️ Publicar TODOS en Tienda Oficial ({itemsUrlPreview.length})
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Descripción Extraída</th>
                    <th>Costo Proveedor</th>
                    <th>Tu Precio Lista (+{margenPersonalizadoWeb}%)</th>
                    <th>Elegir Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsUrlPreview.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <b>{it.nombre}</b><br />
                        <small style={{ color: 'var(--text-muted)' }}>Categoría: {it.categoria}</small>
                      </td>
                      <td>
                        {it.monedaOrigen === 'USD' ? `USD ${it.costoOrigen} ($${it.costo?.toLocaleString()})` : `$${it.costo?.toLocaleString()}`}
                      </td>
                      <td className="glow-text-green" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        ${it.precioLista?.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => importarItemDeUrl(it, true)} 
                            className="neon-btn neon-btn-green" 
                            title="Publicar como Artículo Mío en Tienda Oficial"
                          >
                            🛍️ A Mi Tienda
                          </button>
                          <button 
                            onClick={() => importarItemDeUrl(it, false)} 
                            className="neon-btn" 
                            title="Guardar solo como referencia en Stock de Proveedores de Taller"
                          >
                            🔧 A Proveedores
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
// --- FIN DEL ARCHIVO MODULOPROVEEDORESEXCEL.TSX ---