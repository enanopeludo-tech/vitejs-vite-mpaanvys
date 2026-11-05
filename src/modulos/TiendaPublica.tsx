// src/modulos/TiendaPublica.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, query, onSnapshot, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CONFIG_DEFAULT, aplicarRedondeo } from '../estilosTema';

interface PropsTiendaPublica {
  user: any;
}

export const TiendaPublica: React.FC<PropsTiendaPublica> = ({ user }) => {
  const [config, setConfig] = useState<any>(CONFIG_DEFAULT);
  const [productos, setProductos] = useState<any[]>([]);
  const [talleresGremio, setTalleresGremio] = useState<any[]>([]);
  const [clientesCrm, setClientesCrm] = useState<any[]>([]);

  // Filtros de vitrina
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [soloDestacados, setSoloDestacados] = useState(false);

  // Carrito y Modal de Checkout
  const [carrito, setCarrito] = useState<any[]>([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [cliNombre, setCliNombre] = useState('');
  const [cliTelefono, setCliTelefono] = useState('');
  const [cliDni, setCliDni] = useState('');
  const [cliDireccion, setCliDireccion] = useState('');
  const [modalidadEntregaWeb, setModalidadEntregaWeb] = useState<'retiro_local' | 'envio_domicilio'>('retiro_local');
  const [metodoPagoWeb, setMetodoPagoWeb] = useState<'efectivo' | 'transferencia' | 'mercadopago' | 'tarjeta_1' | 'tarjeta_3' | 'tarjeta_6'>('mercadopago');
  const [notasPedido, setNotasPedido] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  const paramsUrl = new URLSearchParams(window.location.search);
  const tiendaParamId = paramsUrl.get('tienda') || 'MASTER';

  useEffect(() => {
    const unsubConf = onSnapshot(doc(db, 'configuracion', 'general'), (snap) => {
      if (snap.exists()) {
        setConfig({ ...CONFIG_DEFAULT, ...snap.data() });
      }
    });
    const unsubProd = onSnapshot(query(collection(db, 'productos')), (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTalleres = onSnapshot(query(collection(db, 'talleres_gremio')), (snap) => {
      setTalleresGremio(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCli = onSnapshot(query(collection(db, 'clientes_crm')), (snap) => {
      setClientesCrm(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubConf();
      unsubProd();
      unsubTalleres();
      unsubCli();
    };
  }, []);

  const sucursalVitrina = tiendaParamId !== 'MASTER' 
    ? talleresGremio.find(t => t.id === tiendaParamId) 
    : null;

  const nombreTiendaMostrar = sucursalVitrina ? sucursalVitrina.nombre : config.empresaNombre;
  const esloganTiendaMostrar = sucursalVitrina 
    ? 'Sucursal Oficial & Servicio Técnico (' + (sucursalVitrina.ciudad || 'Local') + ')' 
    : config.eslogan;
  const direccionTiendaMostrar = sucursalVitrina 
    ? (sucursalVitrina.direccion || '') + ' (' + (sucursalVitrina.ciudad || '') + ')' 
    : config.direccion;
  const whatsappTiendaMostrar = sucursalVitrina 
    ? (sucursalVitrina.telefono || config.whatsapp) 
    : config.whatsapp;

  const tallerLogueadoB2B = user?.email 
    ? talleresGremio.find(t => t.email?.toLowerCase() === user.email.toLowerCase() && t.activo !== false) 
    : null;

  const porcentajeDescuentoGremio = tallerLogueadoB2B
    ? (tallerLogueadoB2B.nivel === 'Oro' ? Number(config.descuentoGremioOro || 18) : Number(config.descuentoGremioBronce || 10))
    : 0;

  const productosVitrina = productos.filter(p => {
    const ownerProd = p.ownerId || 'MASTER';
    if (ownerProd !== tiendaParamId) return false;

    const esDeProv = Boolean(p.esDeProveedor || p.descripcion === 'Importado de lista');
    if (esDeProv && !config.mostrarArticulosProveedorEnTienda) return false;

    if (Number(p.stock || 0) <= 0 && !esDeProv) return false;
    return true;
  });

  const categoriasDisponibles = [
    'Todas',
    ...Array.from(new Set(productosVitrina.map(p => p.categoria || 'General')))
  ];

  const productosFiltrados = productosVitrina.filter(p => {
    if (categoriaActiva !== 'Todas' && (p.categoria || 'General') !== categoriaActiva) return false;
    if (soloDestacados && !p.destacado) return false;
    if (busqueda) {
      const b = busqueda.toLowerCase();
      const coincide = p.nombre?.toLowerCase().includes(b) ||
                       p.categoria?.toLowerCase().includes(b) ||
                       p.descripcion?.toLowerCase().includes(b) ||
                       (p.codigoBarras && p.codigoBarras.includes(b));
      if (!coincide) return false;
    }
    return true;
  });

  const obtenerPrecioBaseProducto = (prod: any) => {
    const base = Number(prod.precio || 0);
    if (porcentajeDescuentoGremio > 0) {
      return aplicarRedondeo(base * (1 - porcentajeDescuentoGremio / 100), config.redondeoPrecios);
    }
    return base;
  };

  const agregarAlCarrito = (prod: any) => {
    const precioUnitario = obtenerPrecioBaseProducto(prod);
    const existente = carrito.find(i => i.id === prod.id);
    if (existente) {
      if (prod.stock > 0 && existente.cantidad + 1 > prod.stock) {
        return alert('Solo quedan ' + prod.stock + ' unidades disponibles en stock.');
      }
      setCarrito(carrito.map(i => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1, precio: precioUnitario } : i));
    } else {
      setCarrito([...carrito, { id: prod.id, nombre: prod.nombre, precio: precioUnitario, cantidad: 1, stockMax: prod.stock || 99, imagenUrl: prod.imagenUrl || '' }]);
    }
  };

  const cambiarCantidadCarrito = (idProd: string, delta: number) => {
    setCarrito(prev =>
      prev
        .map(item => {
          if (item.id !== idProd) return item;
          const nuevaCant = item.cantidad + delta;
          if (nuevaCant > item.stockMax) {
            alert('Stock máximo disponible: ' + item.stockMax + ' unidades.');
            return item;
          }
          return { ...item, cantidad: nuevaCant };
        })
        .filter(item => item.cantidad > 0)
    );
  };

  const subtotalListaCarrito = carrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  
  const montoEnvioGratis = Number(config.envioGratisDesde || 50000);
  const costoEnvioBase = Number(config.envioLocalCosto || config.repartidorLocalCosto || 1500);
  const costoEnvioAplicado = modalidadEntregaWeb === 'retiro_local' 
    ? 0 
    : (subtotalListaCarrito >= montoEnvioGratis && montoEnvioGratis > 0 ? 0 : costoEnvioBase);

  let factorMedioPago = 1;
  if (metodoPagoWeb === 'efectivo') {
    factorMedioPago = 1 - (Number(config.descuentoEfectivoPorcentaje || 10) / 100);
  } else if (metodoPagoWeb === 'mercadopago') {
    factorMedioPago = 1 + (Number(config.mpRecargoPorcentaje || 0) / 100);
  } else if (metodoPagoWeb === 'tarjeta_1') {
    factorMedioPago = 1 + (Number(config.recargoTarjeta1Pago || config.recargoTarjetaPorcentaje || 15) / 100);
  } else if (metodoPagoWeb === 'tarjeta_3') {
    factorMedioPago = 1 + (Number(config.recargoTarjeta3Cuotas || 28) / 100);
  } else if (metodoPagoWeb === 'tarjeta_6') {
    factorMedioPago = 1 + (Number(config.recargoTarjeta6Cuotas || 45) / 100);
  }

  const totalProductosAjustado = aplicarRedondeo(subtotalListaCarrito * factorMedioPago, config.redondeoPrecios);
  const totalFinalCheckout = totalProductosAjustado + costoEnvioAplicado;

  const linkMpActivo = config.linkMercadoPago || 'https://link.mercadopago.com.ar/walabbatecno';
  const qrMpUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(linkMpActivo);

  const confirmarPedidoEcommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carrito.length === 0) return alert('Tu carrito está vacío.');
    if (Number(config.compraMinima || 0) > 0 && subtotalListaCarrito < Number(config.compraMinima)) {
      return alert('La compra mínima es de $' + Number(config.compraMinima).toLocaleString() + '.');
    }
    if (modalidadEntregaWeb === 'envio_domicilio' && !cliDireccion.trim()) {
      return alert('Por favor ingresa tu dirección para el envío con repartidor.');
    }

    setEnviandoPedido(true);
    try {
      const direccionEntregaTexto = modalidadEntregaWeb === 'retiro_local' 
        ? 'Retira por el Local (' + direccionTiendaMostrar + ')' 
        : 'Envío a Domicilio: ' + cliDireccion;

      const docPedido = await addDoc(collection(db, 'pedidos_ecommerce'), {
        ownerId: tiendaParamId,
        nombreTienda: nombreTiendaMostrar,
        cliente: {
          nombre: cliNombre,
          telefono: cliTelefono,
          dni: cliDni,
          direccion: direccionEntregaTexto,
          esGremio: Boolean(tallerLogueadoB2B),
          nivelGremio: tallerLogueadoB2B?.nivel || null
        },
        items: carrito.map(i => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
        subtotalLista: subtotalListaCarrito,
        costoEnvio: costoEnvioAplicado,
        modalidadEntrega: modalidadEntregaWeb,
        metodoPago: metodoPagoWeb,
        total: totalFinalCheckout,
        notas: notasPedido,
        estado: 'pendiente',
        cobradoEnCaja: false,
        fecha: serverTimestamp()
      });

      const telLimpio = cliTelefono.replace(/\D/g, '');
      const yaExisteEnCrm = clientesCrm.some(c => (c.telefono || '').replace(/\D/g, '') === telLimpio && (c.ownerId || 'MASTER') === tiendaParamId);
      if (!yaExisteEnCrm && telLimpio.length >= 6) {
        await addDoc(collection(db, 'clientes_crm'), {
          ownerId: tiendaParamId,
          nombre: cliNombre,
          telefono: cliTelefono,
          dni: cliDni,
          direccion: cliDireccion || 'Local',
          origen: 'Tienda Web',
          fechaAlta: new Date().toLocaleDateString(),
          fechaTimestamp: serverTimestamp()
        });
      }

      const codPedido = docPedido.id.slice(-6).toUpperCase();
      const detalleWhatsApp = carrito.map(i => '▪️ ' + i.cantidad + 'x ' + i.nombre + ' ($' + (i.precio * i.cantidad).toLocaleString() + ')').join('\n');

      let msg = '🛍️ *NUEVO PEDIDO WEB #' + codPedido + '* — *' + nombreTiendaMostrar + '*\n\n';
      msg += '👤 *Cliente:* ' + cliNombre + (tallerLogueadoB2B ? ' (🏢 Gremio ' + tallerLogueadoB2B.nivel + ')' : '') + '\n';
      msg += '📱 *WhatsApp:* ' + cliTelefono + '\n';
      msg += '📍 *Entrega:* ' + direccionEntregaTexto + '\n';
      msg += '💳 *Modalidad de Pago:* ' + metodoPagoWeb.toUpperCase() + '\n\n';
      msg += '📦 *PRODUCTOS:*\n' + detalleWhatsApp + '\n';
      if (costoEnvioAplicado > 0) msg += '🛵 *Envío Repartidor:* $' + costoEnvioAplicado.toLocaleString() + '\n';
      msg += '\n💰 *TOTAL FINAL A ABONAR: $' + totalFinalCheckout.toLocaleString() + '*\n';
      if (metodoPagoWeb === 'mercadopago') {
        msg += '💠 *Link de Pago Mercado Pago:* ' + linkMpActivo + '\n';
      }
      if ((metodoPagoWeb === 'transferencia' || metodoPagoWeb === 'mercadopago') && config.aliasTransferencia) {
        msg += '🏦 *Alias Oficial:* ' + config.aliasTransferencia + ' (' + config.bancoTitular + ')\n';
      }
      if (notasPedido) msg += '📝 *Notas:* ' + notasPedido;

      setCarrito([]);
      setMostrarCarrito(false);
      alert('🎉 ¡Pedido #' + codPedido + ' registrado con éxito! Ahora se abrirá WhatsApp para coordinar el pago y la entrega.');
      window.open('https://wa.me/' + whatsappTiendaMostrar.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), '_blank');
    } catch (err: any) {
      alert('Error al procesar el pedido: ' + err.message);
    } finally {
      setEnviandoPedido(false);
    }
  };

  const cantidadTotalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px' }}>
      <div className="neon-card" style={{ marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {config.logoUrl && (
            <img src={config.logoUrl} alt="Logo" style={{ width: '68px', height: '68px', objectFit: 'contain', borderRadius: '14px' }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="glow-text-cyan" style={{ margin: 0, fontSize: '26px' }}>
                {nombreTiendaMostrar}
              </h1>
              {tallerLogueadoB2B && (
                <span className="neon-badge" style={{ background: 'rgba(175,82,222,0.18)', color: 'var(--neon-purple)' }}>
                  🏢 Tarifa Gremio {tallerLogueadoB2B.nivel} Activa (-{porcentajeDescuentoGremio}%)
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
              {esloganTiendaMostrar}
            </div>
            <div style={{ fontSize: '13px', marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <span>📍 {direccionTiendaMostrar}</span>
              <span>🕒 {config.horariosAtencion}</span>
              {config.instagram && <span>📸 {config.instagram}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/seguimiento" className="neon-btn" style={{ textDecoration: 'none' }}>
            🔍 Rastrear mi Reparación
          </Link>
          <button 
            onClick={() => setMostrarCarrito(true)} 
            className="neon-btn neon-btn-fillCyan" 
            style={{ padding: '12px 20px', fontSize: '15px' }}
          >
            🛒 Carrito ({cantidadTotalItems}) — ${subtotalListaCarrito.toLocaleString()}
          </button>
        </div>
      </div>

      <div className="neon-card" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <input 
            type="text" 
            className="neon-input" 
            placeholder="🔍 Buscar cargadores, auriculares, hidrogel, cables, fundas..." 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            style={{ flex: '1 1 280px' }} 
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            <input type="checkbox" checked={soloDestacados} onChange={e => setSoloDestacados(e.target.checked)} />
            ⭐ Solo Ofertas Destacadas
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categoriasDisponibles.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={'neon-btn ' + (categoriaActiva === cat ? 'neon-btn-fillCyan' : '')}
              style={{ padding: '7px 15px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: '18px' }}>
        {productosFiltrados.map(p => {
          const precioBase = obtenerPrecioBaseProducto(p);
          const precioEfectivo = aplicarRedondeo(
            precioBase * (1 - Number(config.descuentoEfectivoPorcentaje || 10) / 100),
            config.redondeoPrecios
          );
          const precio3Cuotas = aplicarRedondeo(
            precioBase * (1 + Number(config.recargoTarjeta3Cuotas || 28) / 100),
            config.redondeoPrecios
          );

          return (
            <div key={p.id} className="neon-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="neon-badge" style={{ background: 'rgba(0,122,255,0.12)', color: 'var(--neon-cyan)' }}>
                    {p.categoria || 'Accesorio'}
                  </span>
                  {p.destacado && (
                    <span className="neon-badge" style={{ background: 'rgba(255,149,0,0.18)', color: 'var(--neon-yellow)' }}>
                      ⭐ Destacado
                    </span>
                  )}
                </div>

                {p.imagenUrl ? (
                  <div style={{ width: '100%', height: '175px', background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
                    <img src={p.imagenUrl} alt={p.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '130px', background: 'var(--bg-input)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', fontSize: '36px' }}>
                    🛍️
                  </div>
                )}

                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px' }}>{p.nombre}</h3>
                {p.descripcion && p.descripcion !== 'Accesorio Oficial' && p.descripcion !== 'Importado de lista' && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 10px 0' }}>
                    {p.descripcion}
                  </p>
                )}
              </div>

              <div>
                {config.catalogoPublicoPrecios !== false ? (
                  <div style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        💵 EFECTIVO (-{config.descuentoEfectivoPorcentaje}%):
                      </span>
                      <span className="glow-text-green" style={{ fontSize: '21px', fontWeight: 900 }}>
                        ${precioEfectivo.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '4px', color: 'var(--text-muted)' }}>
                      <span>💠 MP / Lista: <b>${precioBase.toLocaleString()}</b></span>
                      <span>💳 3x <b>${Math.round(precio3Cuotas / 3).toLocaleString()}</b></span>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '10px', color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
                    Consultar Precio por WhatsApp
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Stock: <b>{p.stock > 0 ? p.stock + ' disp.' : 'A pedido'}</b>
                  </small>
                  <button 
                    onClick={() => agregarAlCarrito(p)} 
                    className="neon-btn neon-btn-fillCyan" 
                    style={{ flex: 1 }}
                  >
                    + Agregar al Carrito
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {productosFiltrados.length === 0 && (
          <div className="neon-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '45px 20px' }}>
            <h3 className="glow-text-cyan">No encontramos productos con ese filtro</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Prueba con otra palabra clave o escríbenos por WhatsApp al {whatsappTiendaMostrar} para cotizar tu accesorio o repuesto.
            </p>
          </div>
        )}
      </div>

      {/* MODAL DE CARRITO Y CHECKOUT CON MERCADO PAGO */}
      {mostrarCarrito && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <div className="neon-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px', marginBottom: '14px' }}>
              <h3 className="glow-text-cyan" style={{ margin: 0 }}>
                🛒 Finalizar Pedido — {nombreTiendaMostrar}
              </h3>
              <button onClick={() => setMostrarCarrito(false)} className="neon-btn neon-btn-red" style={{ padding: '5px 12px' }}>
                ✕ Cerrar
              </button>
            </div>

            {carrito.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                Aún no agregaste productos a tu carrito.
              </p>
            ) : (
              <form onSubmit={confirmarPedidoEcommerce}>
                <div style={{ maxHeight: '190px', overflowY: 'auto', marginBottom: '14px' }}>
                  {carrito.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                      <div style={{ flex: 1 }}>
                        <b>{item.nombre}</b>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Unitario Lista: ${item.precio.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => cambiarCantidadCarrito(item.id, -1)} className="neon-btn neon-btn-red" style={{ padding: '3px 9px' }}>-</button>
                        <b>{item.cantidad}</b>
                        <button type="button" onClick={() => cambiarCantidadCarrito(item.id, 1)} className="neon-btn neon-btn-green" style={{ padding: '3px 9px' }}>+</button>
                        <b className="glow-text-cyan" style={{ minWidth: '80px', textAlign: 'right' }}>
                          ${(item.precio * item.cantidad).toLocaleString()}
                        </b>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label className="label-neon">Tu Nombre y Apellido *</label>
                    <input type="text" className="neon-input" required value={cliNombre} onChange={e => setCliNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
                  </div>
                  <div>
                    <label className="label-neon">Tu WhatsApp *</label>
                    <input type="text" className="neon-input" required value={cliTelefono} onChange={e => setCliTelefono(e.target.value)} placeholder="Ej: 2262..." />
                  </div>
                  <div>
                    <label className="label-neon">Modalidad de Entrega</label>
                    <select className="neon-select" value={modalidadEntregaWeb} onChange={e => setModalidadEntregaWeb(e.target.value as any)}>
                      <option value="retiro_local">📍 Retiro por el Local ($0)</option>
                      <option value="envio_domicilio">
                        🛵 Envío con Repartidor ({subtotalListaCarrito >= montoEnvioGratis && montoEnvioGratis > 0 ? '¡GRATIS!' : '+$' + costoEnvioBase})
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="label-neon">Modalidad de Pago</label>
                    <select className="neon-select" value={metodoPagoWeb} onChange={e => setMetodoPagoWeb(e.target.value as any)}>
                      <option value="mercadopago">💠 Mercado Pago (QR / Link Oficial)</option>
                      <option value="efectivo">💵 Efectivo (-{config.descuentoEfectivoPorcentaje}%)</option>
                      <option value="transferencia">🏦 Transferencia Bancaria (Lista)</option>
                      <option value="tarjeta_1">💳 Tarjeta 1 Pago (+{config.recargoTarjeta1Pago || 15}%)</option>
                      <option value="tarjeta_3">💳 Tarjeta 3 Cuotas (+{config.recargoTarjeta3Cuotas || 28}%)</option>
                      <option value="tarjeta_6">💳 Tarjeta 6 Cuotas (+{config.recargoTarjeta6Cuotas || 45}%)</option>
                    </select>
                  </div>
                </div>

                {modalidadEntregaWeb === 'envio_domicilio' && (
                  <div style={{ marginBottom: '10px' }}>
                    <label className="label-neon">Dirección Exacta de Entrega en {sucursalVitrina?.ciudad || 'la Ciudad'} *</label>
                    <input type="text" className="neon-input" required value={cliDireccion} onChange={e => setCliDireccion(e.target.value)} placeholder="Calle, Número, Entre calles o Depto..." />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '12px' }}>
                  <input type="text" className="neon-input" value={cliDni} onChange={e => setCliDni(e.target.value)} placeholder="DNI / CUIT (Para Factura)" />
                  <input type="text" className="neon-input" value={notasPedido} onChange={e => setNotasPedido(e.target.value)} placeholder="Nota opcional (Ej: Horario para recibir)" />
                </div>

                {/* BLOQUE DE MERCADO PAGO INTEGRADO EN EL CHECKOUT */}
                {metodoPagoWeb === 'mercadopago' && (
                  <div style={{ background: 'rgba(0,158,227,0.1)', border: '1.5px solid #009ee3', borderRadius: '14px', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <b style={{ color: '#009ee3', fontSize: '15px' }}>💠 Pago Oficial con Mercado Pago</b>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Escaneá el QR desde tu celular o abrí el Checkout Oficial para abonar <b>${totalFinalCheckout.toLocaleString()}</b>.
                      </div>
                      {config.aliasTransferencia && (
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          🏦 Alias Directo MP: <b>{config.aliasTransferencia}</b> ({config.bancoTitular})
                        </div>
                      )}
                      <a 
                        href={linkMpActivo} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="neon-btn" 
                        style={{ marginTop: '8px', borderColor: '#009ee3', color: '#009ee3', textDecoration: 'none', padding: '6px 14px', fontSize: '12px' }}
                      >
                        🔗 Abrir Link de Pago Mercado Pago ↗
                      </a>
                    </div>
                    <div style={{ background: '#fff', padding: '8px', borderRadius: '10px', border: '1px solid #009ee3' }}>
                      <img src={qrMpUrl} alt="QR MP" style={{ width: '95px', height: '95px', display: 'block' }} />
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '4px' }}>
                    <span>Subtotal Productos ({metodoPagoWeb.toUpperCase()}):</span>
                    <b>${totalProductosAjustado.toLocaleString()}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '6px' }}>
                    <span>Costo de Envío / Repartidor:</span>
                    <b>{costoEnvioAplicado === 0 ? 'SIN CARGO ($0)' : '$' + costoEnvioAplicado.toLocaleString()}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900, borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: '8px' }}>
                    <span>TOTAL FINAL:</span>
                    <span className="glow-text-green">${totalFinalCheckout.toLocaleString()}</span>
                  </div>
                  {metodoPagoWeb === 'transferencia' && config.aliasTransferencia && (
                    <div style={{ fontSize: '12px', color: 'var(--neon-cyan)', marginTop: '6px' }}>
                      🏦 Alias Oficial para Transferir: <b>{config.aliasTransferencia}</b> ({config.bancoTitular})
                    </div>
                  )}
                </div>

                <button type="submit" disabled={enviandoPedido} className="neon-btn neon-btn-fillCyan" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                  {enviandoPedido ? 'Procesando Pedido...' : '✅ Confirmar Pedido y Enviar Comprobante por WhatsApp'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
// --- FIN DEL ARCHIVO TIENDAPUBLICA.TSX ---