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
  const [excelCargando, setExcelCargando] = useState(false);
  const [excelHojas, setExcelHojas] = useState<string[]>([]);
  const [hojaActiva, setHojaActiva] = useState<string>('');
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [colNombre, setColNombre] = useState<number>(0);
  const [colCosto, setColCosto] = useState<number>(1);
  const [colMarca, setColMarca] = useState<number>(-1);
  const [nombreProveedorExcel, setNombreProveedorExcel] = useState('');
  const [monedaListaExcel, setMonedaListaExcel] = useState<'ARS' | 'USD'>('ARS');
  const [ocultarEnTiendaOficial, setOcultarEnTiendaOficial] = useState(true); // Por defecto NO mezcla con tus artículos propios

  // Importación masiva desde URL Externa vinculada
  const [urlCatalogoExterno, setUrlCatalogoExterno] = useState(config.urlsProveedoresVinculados || '');
  const [terminoBusquedaUrl, setTerminoBusquedaUrl] = useState('');
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
      str = str.replace(',', '.');
    }
    return parseFloat(str);
  };

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
          const precioConMargen = costoEnPesos + (costoEnPesos * (Number(config.margenGanancia) / 100));
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

  // --- BUSCAR Y VINCULAR LOTE DE ARTÍCULOS DESDE URL EXTERNA ---
  const consultarCatalogoPorUrl = async () => {
    const base = urlCatalogoExterno || config.urlsProveedoresVinculados;
    if (!base) return alert('Configura o ingresa una URL base para consultar.');
    setCargandoUrl(true);
    try {
      const endpoint = terminoBusquedaUrl ? `${base}${encodeURIComponent(terminoBusquedaUrl)}` : base;
      const resp = await fetch(endpoint);
      const data = await resp.json();
      const listaRaw = Array.isArray(data) ? data : (data.results || data.items || data.productos || []);
      const mapeados = listaRaw.slice(0, 20).map((it: any) => {
        const costoBase = Number(it.price || it.precio || it.costo || 0);
        const listaCalculada = aplicarRedondeo(costoBase * (1 + Number(config.margenGanancia || 35) / 100), config.redondeoPrecios);
        return {
          nombre: it.title || it.nombre || it.name || 'Artículo sin nombre',
          costo: costoBase,
          precioLista: listaCalculada,
          imagen: (it.thumbnail || it.imagenUrl || it.image || '').replace('-I.jpg', '-O.jpg'),
          url: it.permalink || it.url || endpoint,
          categoria: terminoBusquedaUrl || 'Importado Web'
        };
      });
      setItemsUrlPreview(mapeados);
      if (mapeados.length === 0) alert('La URL respondió pero no se encontraron artículos con formato estándar.');
    } catch (e) {
      alert('No se pudo leer el JSON directo de esa URL. Verifica que sea una API pública o usa el importador individual por URL en la pestaña Stock.');
    } finally {
      setCargandoUrl(false);
    }
  };

  const importarItemDeUrl = async (item: any, publicarEnTienda: boolean) => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'productos')), {
      ownerId: tenantId,
      nombre: item.nombre,
      categoria: item.categoria,
      costoProveedor: item.costo,
      precio: item.precioLista,
      stock: 1,
      descripcion: publicarEnTienda ? 'Artículo Oficial' : 'Catálogo Externo Vinculado',
      imagenUrl: item.imagen,
      urlProveedor: item.url,
      proveedor: 'Web Vinculada',
      esDeProveedor: !publicarEnTienda,
      ultimaActualizacion: new Date().toLocaleDateString(),
      ventas: 0,
      fecha: serverTimestamp()
    });
    await batch.commit();
    alert(`✅ "${item.nombre}" guardado en tu base de datos (${publicarEnTienda ? 'Visible en Tienda Oficial' : 'Solo consulta interna'}).`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* BLOQUE 1: IMPORTADOR EXCEL */}
      <div className="neon-card">
        <h3 className="glow-text-cyan" style={{ marginTop: 0 }}>🚚 1. Importar Lista Excel de Proveedores ({nombreNegocioActivo})</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px' }}>
          Por defecto, las listas de proveedores quedan marcadas como <b>Uso Interno</b> para que puedas consultarlas o usarlas en presupuestos sin que se mezclen con tus artículos propios en la Tienda Oficial.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontWeight: 'bold', cursor: 'pointer', color: ocultarEnTiendaOficial ? 'var(--neon-green)' : 'var(--neon-yellow)' }}>
            <input type="checkbox" checked={ocultarEnTiendaOficial} onChange={e => setOcultarEnTiendaOficial(e.target.checked)} /> 🛡️ Mantener separados de mi Tienda Oficial (Guardar solo como catálogo de proveedor)
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div><label className="label-neon">Nombre del Proveedor</label><input type="text" className="neon-input" value={nombreProveedorExcel} onChange={e => setNombreProveedorExcel(e.target.value)} placeholder="Ej: Borneo / Mayorista BA" /></div>
          <div><label className="label-neon">Moneda de la Lista</label><select className="neon-select" value={monedaListaExcel} onChange={e => setMonedaListaExcel(e.target.value as any)}><option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (Multiplica x ${config.cotizacionDolar})</option></select></div>
          <div><label className="label-neon">Archivo .xlsx / .xls</label><input type="file" id="fileExcel" accept=".xlsx, .xls" className="neon-input" onChange={procesarArchivoExcel} /></div>
        </div>

        {excelHojas.length > 0 && !excelCargando && (
          <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <div><label className="label-neon">Pestaña (Categoría)</label><select className="neon-select" value={hojaActiva} onChange={cambiarHojaDropdown}>{excelHojas.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="label-neon">Col. Nombre</label><select className="neon-select" value={colNombre} onChange={e => setColNombre(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
              <div><label className="label-neon">Col. Costo</label><select className="neon-select" value={colCosto} onChange={e => setColCosto(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
              <div><label className="label-neon">Col. Marca</label><select className="neon-select" value={colMarca} onChange={e => setColMarca(Number(e.target.value))}><option value={-1}>No Aplica</option>{[0, 1, 2, 3, 4].map(i => <option key={i} value={i}>Columna {String.fromCharCode(65 + i)}</option>)}</select></div>
            </div>
            <button onClick={importarDatosAlInventario} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px' }}>
              🚀 Sincronizar Precios de Lista con Mi Base de Datos
            </button>
          </div>
        )}
      </div>

      {/* BLOQUE 2: VINCULADOR DE CATÁLOGOS EXTERNOS POR URL */}
      <div className="neon-card neon-card-purple">
        <h3 className="glow-text-pink" style={{ marginTop: 0 }}>🌐 2. Traer Artículos y Precios desde Página Externa Vinculada por URL</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '-6px' }}>
          Busca repuestos o accesorios directamente sobre la URL externa configurada en tus parámetros, calcula automáticamente tu Precio de Lista (+{config.margenGanancia}%) y elije si quieres publicarlos en tu Tienda Oficial o guardarlos como referencia.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
          <input type="text" className="neon-input" value={urlCatalogoExterno} onChange={e => setUrlCatalogoExterno(e.target.value)} placeholder="URL Base de API / Catálogo..." style={{ flex: 1 }} />
          <input type="text" className="neon-input" value={terminoBusquedaUrl} onChange={e => setTerminoBusquedaUrl(e.target.value)} placeholder="Buscar modelo o repuesto (Ej: Modulo Moto G84)..." style={{ flex: 1 }} />
          <button onClick={consultarCatalogoPorUrl} disabled={cargandoUrl} className="neon-btn neon-btn-fillCyan">
            {cargandoUrl ? 'Buscando...' : '🔍 Traer Artículos de URL'}
          </button>
        </div>

        {itemsUrlPreview.length > 0 && (
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Descripción Extraída</th>
                  <th>Costo Origen</th>
                  <th>Tu Precio Lista (+{config.margenGanancia}%)</th>
                  <th>Importar a Mi Sistema</th>
                </tr>
              </thead>
              <tbody>
                {itemsUrlPreview.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.imagen ? <img src={it.imagen} alt="thumb" style={{ width: '45px', height: '45px', objectFit: 'contain', borderRadius: '8px' }} /> : '📦'}</td>
                    <td>
                      <b>{it.nombre}</b><br/>
                      <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--neon-cyan)' }}>🔗 Ver página original</a>
                    </td>
                    <td>${it.costo?.toLocaleString()}</td>
                    <td className="glow-text-green" style={{ fontWeight: 'bold' }}>${it.precioLista?.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => importarItemDeUrl(it, true)} className="neon-btn neon-btn-green" title="Sumar como Artículo Mío en Tienda Oficial">🛍️ A Mi Tienda</button>
                        <button onClick={() => importarItemDeUrl(it, false)} className="neon-btn" title="Guardar como lista de proveedor interna">🚚 Interno</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};