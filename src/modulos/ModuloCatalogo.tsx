// src/modulos/ModuloCatalogo.tsx
import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { aplicarRedondeo } from '../estilosTema';

interface PropsCatalogo {
  tenantId: string;
  nombreNegocioActivo: string;
  misProductos: any[];
  config: any;
  setEscaneandoPara: (val: 'formulario' | 'buscador' | null) => void;
}

export const ModuloCatalogo: React.FC<PropsCatalogo> = ({
  tenantId,
  nombreNegocioActivo,
  misProductos,
  config,
  setEscaneandoPara
}) => {
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [prodNom, setProdNom] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodCosto, setProdCosto] = useState('');
  const [prodPrecio, setProdPrecio] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodUbicacion, setProdUbicacion] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImg, setProdImg] = useState('');
  const [prodCodigoBarras, setProdCodigoBarras] = useState('');
  const [prodProveedor, setProdProveedor] = useState('');
  const [prodUrlOrigen, setProdUrlOrigen] = useState('');
  const [prodDestacado, setProdDestacado] = useState(false);
  const [esDeProveedor, setEsDeProveedor] = useState(false);

  const [urlExternaInput, setUrlExternaInput] = useState('');
  const [extrayendoUrl, setExtrayendoUrl] = useState(false);

  const [inflacionPorcentaje, setInflacionPorcentaje] = useState('10');
  const [inflacionCategoria, setInflacionCategoria] = useState('Todas');
  const [inflacionOrigen, setInflacionOrigen] = useState<'todos' | 'propios' | 'proveedores'>('todos');
  const [inflacionPrecioMin, setInflacionPrecioMin] = useState('');
  const [inflacionPrecioMax, setInflacionPrecioMax] = useState('');
  const [aplicandoInflacion, setAplicandoInflacion] = useState(false);

  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [filtroCategoriaInv, setFiltroCategoriaInv] = useState('Todas');
  const [filtroOrigenInv, setFiltroOrigenInv] = useState<'todos' | 'propios' | 'proveedores'>('todos');

  const categoriasUnicas = ['Todas', ...Array.from(new Set(misProductos.map(p => p.categoria || 'General')))];

  const extraerDatosDesdeUrl = async () => {
    if (!urlExternaInput) return alert('Pega una URL o término de búsqueda para traer los datos.');
    setExtrayendoUrl(true);
    try {
      setProdUrlOrigen(urlExternaInput);
      if (urlExternaInput.startsWith('http')) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlExternaInput)}`;
        const resp = await fetch(proxyUrl);
        const data = await resp.json();
        const html = data.contents || '';

        const docParser = new DOMParser().parseFromString(html, 'text/html');
        const ogTitle = docParser.querySelector('meta[property="og:title"]')?.getAttribute('content') || docParser.title || '';
        const ogDesc = docParser.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogImage = docParser.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        const metaPrice = docParser.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') || 
                          docParser.querySelector('meta[property="og:price:amount"]')?.getAttribute('content') || '';

        if (ogTitle) setProdNom(ogTitle.slice(0, 85));
        if (ogDesc) setProdDesc(ogDesc.slice(0, 160));
        if (ogImage) setProdImg(ogImage);
        if (metaPrice && !isNaN(Number(metaPrice))) {
          setProdCosto(metaPrice);
          const sugerido = aplicarRedondeo(Number(metaPrice) * (1 + Number(config.margenGanancia || 35) / 100), config.redondeoPrecios);
          setProdPrecio(sugerido.toString());
        }
        alert('✅ Datos extraídos de la URL. Verifica el Precio de Lista y presiona Publicar.');
      } else {
        const baseApi = config.urlsProveedoresVinculados || 'https://api.mercadolibre.com/sites/MLA/search?q=';
        const resp = await fetch(`${baseApi}${encodeURIComponent(urlExternaInput)}`);
        const json = await resp.json();
        const primerItem = json.results?.[0];
        if (primerItem) {
          setProdNom(primerItem.title || '');
          setProdCosto(primerItem.price?.toString() || '');
          setProdImg(primerItem.thumbnail?.replace('-I.jpg', '-O.jpg') || '');
          setProdUrlOrigen(primerItem.permalink || '');
          const sugerido = aplicarRedondeo(Number(primerItem.price || 0) * (1 + Number(config.margenGanancia || 35) / 100), config.redondeoPrecios);
          setProdPrecio(sugerido.toString());
          alert(`✅ Encontrado: "${primerItem.title}" ($${primerItem.price}).`);
        } else {
          alert('No se encontraron resultados automáticos. Puedes completar los campos manualmente.');
        }
      }
    } catch (e) {
      alert('Se vinculó el link de origen. Completa el nombre y precio para guardarlo.');
    } finally {
      setExtrayendoUrl(false);
    }
  };

  const ejecutarAjusteInflacion = async () => {
    const porc = Number(inflacionPorcentaje);
    if (isNaN(porc) || porc === 0) return alert('Ingresa un porcentaje válido (Ej: 15 para subir 15%, o -10 para bajar 10%).');

    const articulosAfectados = misProductos.filter(p => {
      if (inflacionCategoria !== 'Todas' && (p.categoria || 'General') !== inflacionCategoria) return false;
      if (inflacionOrigen === 'propios' && p.esDeProveedor) return false;
      if (inflacionOrigen === 'proveedores' && !p.esDeProveedor) return false;
      if (inflacionPrecioMin && Number(p.precio || 0) < Number(inflacionPrecioMin)) return false;
      if (inflacionPrecioMax && Number(p.precio || 0) > Number(inflacionPrecioMax)) return false;
      return true;
    });

    if (articulosAfectados.length === 0) return alert('Ningún artículo coincide con los filtros seleccionados.');
    if (!window.confirm(`📈 AJUSTE DE INFLACIÓN:\nSe actualizarán ${articulosAfectados.length} artículos aplicando un ${porc > 0 ? `+${porc}%` : `${porc}%`}.\n¿Confirmar actualización masiva?`)) return;

    setAplicandoInflacion(true);
    try {
      let batch = writeBatch(db);
      let cont = 0;
      const factor = 1 + (porc / 100);
      const hoyStr = new Date().toLocaleDateString();

      for (const prod of articulosAfectados) {
        const nuevoPrecioLista = aplicarRedondeo(Number(prod.precio || 0) * factor, config.redondeoPrecios);
        const nuevoCosto = prod.costoProveedor ? Math.round(Number(prod.costoProveedor) * factor) : 0;
        batch.update(doc(db, 'productos', prod.id), {
          precio: nuevoPrecioLista,
          costoProveedor: nuevoCosto,
          ultimaActualizacion: hoyStr
        });
        cont++;
        if (cont >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          cont = 0;
        }
      }
      if (cont > 0) await batch.commit();
      alert(`✅ ¡Ajuste por Inflación completado! Se actualizaron ${articulosAfectados.length} artículos.`);
    } catch (e: any) {
      alert('Error al aplicar ajuste: ' + e.message);
    } finally {
      setAplicandoInflacion(false);
    }
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataProducto = { 
      ownerId: tenantId,
      nombre: prodNom,
      categoria: prodCat,
      precio: Number(prodPrecio), 
      costoProveedor: Number(prodCosto) || 0,
      stock: Number(prodStock), 
      ubicacion: prodUbicacion,
      descripcion: prodDesc,
      imagenUrl: prodImg, 
      proveedor: prodProveedor,
      urlProveedor: prodUrlOrigen,
      esDeProveedor: esDeProveedor,
      ultimaActualizacion: new Date().toLocaleDateString(), 
      codigoBarras: prodCodigoBarras,
      destacado: prodDestacado 
    };
    if (idEditando) await updateDoc(doc(db, 'productos', idEditando), dataProducto);
    else await addDoc(collection(db, 'productos'), { ...dataProducto, ventas: 0, fecha: serverTimestamp() });
    limpiarFormulario();
  };

  const limpiarFormulario = () => {
    setIdEditando(null); setProdNom(''); setProdCat(''); setProdPrecio(''); setProdCosto('');
    setProdStock(''); setProdUbicacion(''); setProdDesc(''); setProdImg(''); setProdCodigoBarras('');
    setProdProveedor(''); setProdUrlOrigen(''); setProdDestacado(false); setEsDeProveedor(false);
  };

  const cargarParaEdicion = (p: any) => {
    setIdEditando(p.id); setProdNom(p.nombre); setProdCat(p.categoria || '');
    setProdPrecio(p.precio?.toString() || ''); setProdCosto(p.costoProveedor?.toString() || '');
    setProdStock(p.stock?.toString() || ''); setProdUbicacion(p.ubicacion || '');
    setProdDesc(p.descripcion || ''); setProdImg(p.imagenUrl || '');
    setProdCodigoBarras(p.codigoBarras || ''); setProdProveedor(p.proveedor || '');
    setProdUrlOrigen(p.urlProveedor || ''); setProdDestacado(Boolean(p.destacado));
    setEsDeProveedor(Boolean(p.esDeProveedor));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inventarioFiltrado = misProductos.filter(p => {
    if (filtroCategoriaInv !== 'Todas' && (p.categoria || 'General') !== filtroCategoriaInv) return false;
    if (filtroOrigenInv === 'propios' && p.esDeProveedor) return false;
    if (filtroOrigenInv === 'proveedores' && !p.esDeProveedor) return false;
    if (busquedaInventario) {
      const b = busquedaInventario.toLowerCase();
      return p.nombre.toLowerCase().includes(b) || (p.codigoBarras && p.codigoBarras.includes(b)) || (p.ubicacion && p.ubicacion.toLowerCase().includes(b));
    }
    return true;
  });

  const precioListaPreview = Number(prodPrecio) || 0;
  const precioEfectivoPreview = aplicarRedondeo(precioListaPreview * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
  const precioTarjetaPreview = aplicarRedondeo(precioListaPreview * (1 + Number(config.recargoTarjetaPorcentaje || 0) / 100), config.redondeoPrecios);

  return (
    <div>
      <form onSubmit={guardarProducto} className="neon-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="glow-text-cyan" style={{ margin: 0 }}>
            {idEditando ? '✏️ Editando Artículo' : `➕ Cargar Artículo en ${nombreNegocioActivo}`}
          </h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold', cursor: 'pointer', color: !esDeProveedor ? 'var(--neon-green)' : 'var(--text-muted)' }}>
              <input type="checkbox" checked={!esDeProveedor} onChange={e => setEsDeProveedor(!e.target.checked)} /> 🛍️ Artículo Mío (Visible en Tienda Oficial)
            </label>
            <label style={{ fontWeight: 'bold', cursor: 'pointer' }}>
              <input type="checkbox" checked={prodDestacado} onChange={e => setProdDestacado(e.target.checked)} /> ⭐ Destacar
            </label>
          </div>
        </div>

        <div style={{ background: 'var(--bg-input)', padding: '12px 15px', borderRadius: '14px', marginBottom: '14px', border: '1px dashed var(--neon-cyan)' }}>
          <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>
            🌐 Traer Artículo desde otra Página Web / URL Vinculada (Extrae título, descripción y precio):
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="neon-input" 
              placeholder="Pega aquí la URL del producto (https://...) o escribe el modelo para buscar..." 
              value={urlExternaInput} 
              onChange={e => setUrlExternaInput(e.target.value)} 
            />
            <button type="button" onClick={extraerDatosDesdeUrl} disabled={extrayendoUrl} className="neon-btn neon-btn-fillCyan" style={{ whiteSpace: 'nowrap' }}>
              {extrayendoUrl ? 'Extrayendo...' : '🔗 Traer de URL'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label className="label-neon">1. Costo Base ($)</label>
            <input type="number" className="neon-input" placeholder="Costo $" value={prodCosto} onChange={e => setProdCosto(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              type="button" 
              onClick={() => { 
                if (prodCosto) {
                  const calc = aplicarRedondeo(Number(prodCosto) * (1 + Number(config.margenGanancia) / 100), config.redondeoPrecios);
                  setProdPrecio(calc.toString()); 
                }
              }} 
              className="neon-btn neon-btn-green" 
              style={{ width: '100%', height: '45px' }}
            >
              ⚡ Calcular Lista (+{config.margenGanancia}%)
            </button>
          </div>
          <div>
            <label className="label-neon" style={{ color: 'var(--neon-cyan)' }}>2. PRECIO DE LISTA ($) *</label>
            <input type="number" className="neon-input" placeholder="Precio de Lista $" value={prodPrecio} onChange={e => setProdPrecio(e.target.value)} required style={{ fontWeight: 'bold' }} />
          </div>
          <div>
            <label className="label-neon">3. Stock Disponible *</label>
            <input type="number" className="neon-input" placeholder="Stock" value={prodStock} onChange={e => setProdStock(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: 'var(--bg-input)', padding: '10px 15px', borderRadius: '14px', marginBottom: '12px' }}>
          <div>
            <small style={{ color: 'var(--text-muted)' }}>💵 Efectivo (-{config.descuentoEfectivoPorcentaje}%): </small>
            <b className="glow-text-green">${precioEfectivoPreview.toLocaleString()}</b>
          </div>
          <div>
            <small style={{ color: 'var(--text-muted)' }}>📋 Lista Base: </small>
            <b className="glow-text-cyan">${precioListaPreview.toLocaleString()}</b>
          </div>
          <div>
            <small style={{ color: 'var(--text-muted)' }}>💳 Tarjeta (+{config.recargoTarjetaPorcentaje}%): </small>
            <b className="glow-text-pink">${precioTarjetaPreview.toLocaleString()}</b>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <input type="text" className="neon-input" placeholder="Nombre del Artículo *" value={prodNom} onChange={e => setProdNom(e.target.value)} required />
          <input type="text" className="neon-input" placeholder="Categoría (Ej: Cargadores) *" value={prodCat} onChange={e => setProdCat(e.target.value)} required />
          <input type="text" className="neon-input" placeholder="📍 Gaveta / Ubicación" value={prodUbicacion} onChange={e => setProdUbicacion(e.target.value)} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input type="text" className="neon-input" placeholder="Cód. Barras" value={prodCodigoBarras} onChange={e => setProdCodigoBarras(e.target.value)} />
            <button type="button" onClick={() => setEscaneandoPara('formulario')} className="neon-btn">📷</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <input type="text" className="neon-input" placeholder="Descripción para la tienda..." value={prodDesc} onChange={e => setProdDesc(e.target.value)} />
          <input type="text" className="neon-input" placeholder="URL Imagen (Opcional)" value={prodImg} onChange={e => setProdImg(e.target.value)} />
          <input type="text" className="neon-input" placeholder="URL Proveedor vinculada" value={prodUrlOrigen} onChange={e => setProdUrlOrigen(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" className="neon-btn neon-btn-fillCyan" style={{ flex: 1, padding: '13px' }}>
            {idEditando ? '💾 Guardar Cambios' : '➕ Publicar Artículo'}
          </button>
          {idEditando && (
            <button type="button" onClick={limpiarFormulario} className="neon-btn neon-btn-red">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* BLOQUE 2: HERRAMIENTA DE AJUSTE DE INFLACIÓN */}
      <div className="neon-card neon-card-yellow" style={{ marginBottom: '20px' }}>
        <h3 className="glow-text-yellow" style={{ marginTop: 0 }}>
          📈 Ajuste de Inflación (Por Categoría o Rango de Precios)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label className="label-neon">Ajuste Porcentual (%)</label>
            <input type="number" className="neon-input" value={inflacionPorcentaje} onChange={e => setInflacionPorcentaje(e.target.value)} placeholder="Ej: 15" />
          </div>
          <div>
            <label className="label-neon">Filtrar Categoría</label>
            <select className="neon-select" value={inflacionCategoria} onChange={e => setInflacionCategoria(e.target.value)}>
              {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label-neon">Origen de Artículos</label>
            <select className="neon-select" value={inflacionOrigen} onChange={e => setInflacionOrigen(e.target.value as any)}>
              <option value="todos">Todos (Míos y Proveedores)</option>
              <option value="propios">🛍️ Solo Artículos Míos</option>
              <option value="proveedores">🚚 Solo Listas Proveedores</option>
            </select>
          </div>
          <div>
            <label className="label-neon">Desde Precio ($)</label>
            <input type="number" className="neon-input" placeholder="Mínimo $" value={inflacionPrecioMin} onChange={e => setInflacionPrecioMin(e.target.value)} />
          </div>
          <div>
            <label className="label-neon">Hasta Precio ($)</label>
            <input type="number" className="neon-input" placeholder="Máximo $" value={inflacionPrecioMax} onChange={e => setInflacionPrecioMax(e.target.value)} />
          </div>
          <button type="button" onClick={ejecutarAjusteInflacion} disabled={aplicandoInflacion} className="neon-btn neon-btn-fillCyan" style={{ height: '46px' }}>
            {aplicandoInflacion ? 'Ajustando...' : `⚡ Aplicar ${Number(inflacionPorcentaje) >= 0 ? `+${inflacionPorcentaje}%` : `${inflacionPorcentaje}%`}`}
          </button>
        </div>
      </div>

      {/* BLOQUE 3: TABLA DE INVENTARIO */}
      <div className="neon-card" style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" className="neon-input" placeholder="🔍 Buscar por nombre, código o ubicación..." value={busquedaInventario} onChange={e => setBusquedaInventario(e.target.value)} style={{ flex: 1 }} />
        <select className="neon-select" value={filtroOrigenInv} onChange={e => setFiltroOrigenInv(e.target.value as any)} style={{ width: 'auto' }}>
          <option value="todos">Todos los Artículos ({misProductos.length})</option>
          <option value="propios">🛍️ Solo Artículos Míos (Tienda Oficial)</option>
          <option value="proveedores">🚚 Solo Catálogo Proveedores (Interno)</option>
        </select>
        <select className="neon-select" value={filtroCategoriaInv} onChange={e => setFiltroCategoriaInv(e.target.value)} style={{ width: 'auto' }}>
          {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="neon-card" style={{ overflowX: 'auto' }}>
        <table className="neon-table">
          <thead>
            <tr>
              <th>Visibilidad</th>
              <th>Ubicación</th>
              <th>Artículo / Categoría</th>
              <th>Costo</th>
              <th>Precio Lista</th>
              <th>Efectivo</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inventarioFiltrado.map(p => {
              const efvo = aplicarRedondeo((p.precio || 0) * (1 - Number(config.descuentoEfectivoPorcentaje || 0) / 100), config.redondeoPrecios);
              return (
                <tr key={p.id}>
                  <td>
                    <span className="neon-badge" style={{ background: p.esDeProveedor ? 'rgba(255,149,0,0.15)' : 'rgba(40,205,65,0.15)', color: p.esDeProveedor ? 'var(--neon-yellow)' : 'var(--neon-green)' }}>
                      {p.esDeProveedor ? '🚚 Proveedor' : '🛍️ Tienda Oficial'}
                    </span>
                  </td>
                  <td>
                    <span className="neon-badge" style={{ background: 'rgba(175,82,222,0.15)', color: 'var(--neon-purple)' }}>
                      📍 {p.ubicacion || 'S/U'}
                    </span>
                  </td>
                  <td>
                    <b>{p.nombre}</b><br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      {p.categoria}
                      {p.urlProveedor && (
                        <a href={p.urlProveedor} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)', marginLeft: '6px' }}>
                          🔗 Ver URL
                        </a>
                      )}
                    </small>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>${p.costoProveedor?.toLocaleString() || 0}</td>
                  <td className="glow-text-cyan" style={{ fontWeight: 'bold' }}>${p.precio?.toLocaleString()}</td>
                  <td className="glow-text-green" style={{ fontWeight: 'bold' }}>${efvo.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => updateDoc(doc(db, 'productos', p.id), { stock: Math.max(0, p.stock - 1) })} className="neon-btn neon-btn-red" style={{ padding: '3px 9px' }}>-</button>
                      <b>{p.stock}</b>
                      <button onClick={() => updateDoc(doc(db, 'productos', p.id), { stock: p.stock + 1 })} className="neon-btn neon-btn-green" style={{ padding: '3px 9px' }}>+</button>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => cargarParaEdicion(p)} className="neon-btn">✏️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};