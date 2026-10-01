// @ts-nocheck
// Datos de demostración 1:1 con el prototipo HTML y files/11
import type { DB } from './types';
import { defaultPerms, defaultCatalogs } from './catalog';
import { nowStamp, todayIso, addDays, diffDays, pad, monthLabel, sum, fdate } from './format';

const APP_VERSION = '2.0';

export const Seed = {
  build(): DB {
    const TODAY = new Date();
    const D = (n: number) => addDays(todayIso(), n);
    var db: any = { version: APP_VERSION, created: nowStamp(), alertState: {}, tasks: [], audit: [] };
    db.users = [
      { id: 'U1', nombre: 'Laura Méndez', email: 'lmendez@empresa.co', rol: 'ADMINISTRADOR', estado: 'Activo' },
      { id: 'U2', nombre: 'Juan Pérez', email: 'jperez@empresa.co', rol: 'CONTRATACIÓN', estado: 'Activo' },
      { id: 'U3', nombre: 'Carolina Ríos', email: 'crios@empresa.co', rol: 'JURÍDICA', estado: 'Activo' },
      { id: 'U4', nombre: 'Andrés Gómez', email: 'agomez@empresa.co', rol: 'FINANCIERA', estado: 'Activo' },
      { id: 'U5', nombre: 'Martha Salcedo', email: 'msalcedo@empresa.co', rol: 'SUPERVISOR', estado: 'Activo' },
      { id: 'U6', nombre: 'Ricardo Ortiz', email: 'rortiz@empresa.co', rol: 'INTERVENTOR', estado: 'Activo' },
      { id: 'U7', nombre: 'Diana Castro', email: 'dcastro@empresa.co', rol: 'AUDITOR', estado: 'Activo' },
      { id: 'U8', nombre: 'Pedro Llanos', email: 'pllanos@empresa.co', rol: 'CONSULTA', estado: 'Activo' }
    ];
    db.settings = { currentUser: 'U1', alertDays: [30, 15, 10, 5, 3, 1], criticalDays: 5, budgetPct: 15, gapPct: 20, perms: defaultPerms(), catalogs: defaultCatalogs() };
    db.companies = [
      { id: 'EMP-01', razon: 'Salud Integral del Caribe IPS S.A.S.', nit: '900.451.328-7', tipo: 'IPS', direccion: 'Cra. 54 # 72-80', ciudad: 'Barranquilla', depto: 'Atlántico', pais: 'Colombia', rep: 'Mónica Vargas Acuña', repDoc: 'CC 32.745.110', tel: '605 385 2210', email: 'contratacion@saludcaribe.co', respInterno: 'Martha Salcedo', estado: 'Activa', fechaCreacion: D(-900) },
      { id: 'EMP-02', razon: 'Grupo Andino de Infraestructura S.A.S.', nit: '901.203.884-1', tipo: 'Sociedad comercial', direccion: 'Calle 77B # 57-141 Of. 902', ciudad: 'Barranquilla', depto: 'Atlántico', pais: 'Colombia', rep: 'Hernán Castillo Rey', repDoc: 'CC 8.745.221', tel: '605 368 4400', email: 'juridica@grupoandino.co', respInterno: 'Juan Pérez', estado: 'Activa', fechaCreacion: D(-760) },
      { id: 'EMP-03', razon: 'Energía Costa Norte S.A. E.S.P.', nit: '800.332.109-4', tipo: 'Empresa de servicios públicos', direccion: 'Vía 40 # 85-310', ciudad: 'Barranquilla', depto: 'Atlántico', pais: 'Colombia', rep: 'Claudia Benavides', repDoc: 'CC 22.498.003', tel: '605 330 1200', email: 'compras@costanorte.com.co', respInterno: 'Ricardo Ortiz', estado: 'Activa', fechaCreacion: D(-1200) },
      { id: 'EMP-04', razon: 'Logística Portuaria del Atlántico S.A.S.', nit: '901.587.662-9', tipo: 'Sociedad comercial', direccion: 'Km 2 Vía al Mar, Zona Franca', ciudad: 'Barranquilla', depto: 'Atlántico', pais: 'Colombia', rep: 'Felipe Arrieta Díaz', repDoc: 'CC 72.301.558', tel: '605 344 7788', email: 'admin@logiportatl.co', respInterno: 'Andrés Gómez', estado: 'Activa', fechaCreacion: D(-640) },
      { id: 'EMP-05', razon: 'Alimentos del Litoral S.A.', nit: '890.104.775-2', tipo: 'Sociedad anónima', direccion: 'Calle 30 # 1-25', ciudad: 'Soledad', depto: 'Atlántico', pais: 'Colombia', rep: 'Rosa Elena Pertuz', repDoc: 'CC 36.512.908', tel: '605 375 9021', email: 'abastecimiento@alitoral.co', respInterno: 'Juan Pérez', estado: 'Activa', fechaCreacion: D(-1500) }
    ];
    function C(o){ o.iva = o.iva == null ? Math.round(o.valorBase * 0.19) : o.iva; o.otrosImp = o.otrosImp || 0; o.adiciones = o.adiciones || 0; o.reducciones = o.reducciones || 0; o.anulado = false; o.parentId = null; o.hastaAgotar = !!o.hastaAgotar; return o; }
    var t044 = 42186012028, b044 = Math.round(t044 / 1.19);
    db.contracts = [
      C({ id: 'CT-01', numero: '044-2026', tipo: 'Prestación de servicios de salud', modalidad: 'Contratación directa', companyId: 'EMP-01', contratista: 'Unión Temporal Red Salud Norte', nitContratista: '901.778.412-3', repContratista: 'Álvaro Guerrero Pinto', objeto: 'Prestación de servicios integrales de salud de mediana y alta complejidad para la población afiliada, bajo modalidad de evento y paquetes, en la red definida por el contratante.', descripcion: 'Plazo de 299 días calendario o hasta agotar recursos, lo que ocurra primero. Forma de pago mensual contra radicación de facturas y soportes de auditoría médica.', alcance: 'Consulta especializada, hospitalización, cirugía, UCI adulto, imágenes diagnósticas y laboratorio clínico en los municipios priorizados.', productos: 'Servicios de salud por evento; paquetes quirúrgicos; atención de urgencias.', indicadores: 'Oportunidad en consulta especializada ≤ 15 días; glosas ≤ 5%; satisfacción ≥ 90%.', area: 'Salud', responsable: 'Martha Salcedo', supervisor: 'Martha Salcedo', interventor: 'Ricardo Ortiz', fechaFirma: D(-298), fechaInicio: D(-293), fechaFin: D(5), valorBase: b044, iva: t044 - b044, estado: 'Activo', avanceFisico: 86, hastaAgotar: true }),
      C({ id: 'CT-02', numero: '051-2026', tipo: 'Obra civil', modalidad: 'Invitación privada', companyId: 'EMP-02', contratista: 'Constructora Barlovento S.A.S.', nitContratista: '900.887.341-5', repContratista: 'Gustavo Mercado', objeto: 'Adecuación y ampliación de la sede administrativa norte, incluyendo obras civiles, redes eléctricas e hidrosanitarias.', descripcion: 'Obra a precios unitarios fijos con anticipo del 20%.', alcance: 'Demolición, cimentación, estructura, mampostería, acabados y redes.', productos: 'Sede adecuada de 1.850 m².', indicadores: 'Avance físico mensual ≥ 12%; cero accidentes incapacitantes.', area: 'Operaciones', responsable: 'Juan Pérez', supervisor: 'Ricardo Ortiz', interventor: 'Interventorías del Norte S.A.S.', fechaFirma: D(-212), fechaInicio: D(-205), fechaFin: D(14), valorBase: 2850000000, adiciones: 420000000, estado: 'Activo', avanceFisico: 78 }),
      C({ id: 'CT-03', numero: '012-2026', tipo: 'Suministro', modalidad: 'Orden de compra', companyId: 'EMP-05', contratista: 'Distribuidora Agroindustrial del Caribe Ltda.', nitContratista: '800.215.667-0', repContratista: 'Beatriz Olivares', objeto: 'Suministro de materias primas (aceites vegetales y empaques) para la planta de producción.', descripcion: 'Entregas quincenales según programación.', alcance: 'Aceite crudo de palma, envases PET y cajas corrugadas.', productos: 'Materias primas certificadas.', indicadores: 'Entregas a tiempo ≥ 95%.', area: 'Compras', responsable: 'Juan Pérez', supervisor: 'Andrés Gómez', interventor: '', fechaFirma: D(-190), fechaInicio: D(-186), fechaFin: D(-6), valorBase: 980000000, estado: 'Activo', avanceFisico: 92 }),
      C({ id: 'CT-04', numero: '067-2026', tipo: 'Consultoría', modalidad: 'Contratación directa', companyId: 'EMP-03', contratista: 'Analítica Energética Consultores S.A.S.', nitContratista: '901.332.908-6', repContratista: 'Iván Palacio', objeto: 'Consultoría para el diagnóstico de pérdidas técnicas y no técnicas en circuitos de distribución.', descripcion: 'Suspendido por espera de información de medición del operador.', alcance: 'Levantamiento, modelación y plan de reducción de pérdidas.', productos: 'Informe diagnóstico; modelo de red; plan de acción.', indicadores: 'Entregables aprobados sin observaciones.', area: 'Operaciones', responsable: 'Ricardo Ortiz', supervisor: 'Ricardo Ortiz', interventor: '', fechaFirma: D(-120), fechaInicio: D(-115), fechaFin: D(95), valorBase: 610000000, estado: 'Suspendido', avanceFisico: 35 }),
      C({ id: 'CT-05', numero: '023-2026', tipo: 'Interventoría', modalidad: 'Invitación pública', companyId: 'EMP-04', contratista: 'Interventorías del Norte S.A.S.', nitContratista: '900.556.201-8', repContratista: 'Sandra Polo', objeto: 'Interventoría técnica, administrativa y financiera de la ampliación del patio de contenedores.', descripcion: 'Contrato terminado; en trámite de liquidación bilateral.', alcance: 'Control de obra, calidad, SST y pagos.', productos: 'Informes mensuales e informe final.', indicadores: 'Informes a tiempo 100%.', area: 'Operaciones', responsable: 'Andrés Gómez', supervisor: 'Andrés Gómez', interventor: '', fechaFirma: D(-400), fechaInicio: D(-395), fechaFin: D(-35), valorBase: 540000000, estado: 'En liquidación', avanceFisico: 100 }),
      C({ id: 'CT-06', numero: '078-2026', tipo: 'Mantenimiento', modalidad: 'Invitación privada', companyId: 'EMP-03', contratista: 'Mantenimientos Industriales Arauca S.A.S.', nitContratista: '900.219.450-2', repContratista: 'Omar Villa', objeto: 'Mantenimiento preventivo y correctivo de subestaciones y transformadores de potencia.', descripcion: 'Bolsa de horas y rutinas programadas.', alcance: '14 subestaciones; 38 transformadores.', productos: 'Rutinas ejecutadas y reportes técnicos.', indicadores: 'Disponibilidad ≥ 99,2%.', area: 'Operaciones', responsable: 'Ricardo Ortiz', supervisor: 'Martha Salcedo', interventor: '', fechaFirma: D(-160), fechaInicio: D(-152), fechaFin: D(28), valorBase: 1250000000, estado: 'Activo', avanceFisico: 70 }),
      C({ id: 'CT-07', numero: '089-2026', tipo: 'Tecnología y licenciamiento', modalidad: 'Contratación directa', companyId: 'EMP-01', contratista: 'Soluciones Digitales Kairos S.A.S.', nitContratista: '901.645.020-3', repContratista: 'Natalia Rojas', objeto: 'Licenciamiento, implementación y soporte de la plataforma de historia clínica electrónica.', descripcion: 'Pago por hitos de implementación y mensualidades de soporte.', alcance: 'Licencias, migración, capacitación y soporte 24/7.', productos: 'Plataforma en producción; 420 usuarios capacitados.', indicadores: 'Disponibilidad ≥ 99,5%; tickets críticos < 4 h.', area: 'Tecnología', responsable: 'Laura Méndez', supervisor: 'Laura Méndez', interventor: '', fechaFirma: D(-70), fechaInicio: D(-62), fechaFin: D(210), valorBase: 890000000, estado: 'Activo', avanceFisico: 24 }),
      C({ id: 'CT-08', numero: '031-2025', tipo: 'Arrendamiento', modalidad: 'Contratación directa', companyId: 'EMP-04', contratista: 'Inmobiliaria Puerta de Oro S.A.S.', nitContratista: '800.901.334-1', repContratista: 'Carlos Name', objeto: 'Arrendamiento de bodega de 2.400 m² para almacenamiento de carga seca.', descripcion: 'Canon mensual fijo; contrato liquidado.', alcance: 'Bodega 7, Parque Industrial Malambo.', productos: 'Uso de inmueble.', indicadores: 'N/A', area: 'Operaciones', responsable: 'Andrés Gómez', supervisor: 'Andrés Gómez', interventor: '', fechaFirma: D(-560), fechaInicio: D(-545), fechaFin: D(-180), valorBase: 480000000, iva: 91200000, estado: 'Liquidado', avanceFisico: 100 }),
      C({ id: 'CT-09', numero: '095-2026', tipo: 'Transporte', modalidad: 'Invitación privada', companyId: 'EMP-05', contratista: 'Transportes Magdalena Express S.A.S.', nitContratista: '900.412.776-4', repContratista: 'Jorge Ahumada', objeto: 'Transporte terrestre de producto terminado hacia centros de distribución regionales.', descripcion: 'Tarifa por viaje según ruta.', alcance: 'Rutas Costa, Santanderes y Antioquia.', productos: 'Viajes cumplidos con prueba de entrega.', indicadores: 'Cumplimiento de citas ≥ 96%.', area: 'Operaciones', responsable: 'Juan Pérez', supervisor: 'Andrés Gómez', interventor: '', fechaFirma: D(-110), fechaInicio: D(-104), fechaFin: D(60), valorBase: 420000000, estado: 'Activo', avanceFisico: 74 }),
      C({ id: 'CT-10', numero: '102-2026', tipo: 'Prestación de servicios', modalidad: 'Contratación directa', companyId: 'EMP-02', contratista: 'Asesorías Jurídicas Barros & Asociados', nitContratista: '901.118.903-7', repContratista: 'Elena Barros', objeto: 'Asesoría jurídica externa en contratación y defensa judicial.', descripcion: 'Honorarios mensuales fijos.', alcance: 'Conceptos, revisión de minutas y representación judicial.', productos: 'Conceptos e informes mensuales.', indicadores: 'Conceptos en ≤ 5 días hábiles.', area: 'Jurídica', responsable: 'Carolina Ríos', supervisor: 'Carolina Ríos', interventor: '', fechaFirma: D(-90), fechaInicio: D(-87), fechaFin: D(3), valorBase: 144000000, estado: 'Activo', avanceFisico: 80 })
    ];
    var S = function(o){ return o; };
    db.subcontracts = [
      S({ id: 'SC-01', contractId: 'CT-01', numero: '044-2026-S01', contratista: 'Clínica Especializada del Río S.A.S.', nit: '900.334.561-2', objeto: 'Hospitalización y UCI adulto en el municipio de Soledad.', valor: 9800000000, fechaInicio: D(-280), fechaFin: D(5), estado: 'Activo', ejecucion: 91, responsable: 'Martha Salcedo', documentos: 'Contrato, pólizas, habilitación REPS', riesgos: 'Ocupación UCI > 95%', obligaciones: 'Reporte diario de censo; auditoría concurrente' }),
      S({ id: 'SC-02', contractId: 'CT-01', numero: '044-2026-S02', contratista: 'Laboratorio Clínico Bioanálisis Ltda.', nit: '800.772.109-5', objeto: 'Laboratorio clínico de segundo nivel.', valor: 2150000000, fechaInicio: D(-280), fechaFin: D(5), estado: 'Activo', ejecucion: 84, responsable: 'Martha Salcedo', documentos: 'Contrato, pólizas', riesgos: 'Tiempos de respuesta', obligaciones: 'Resultados < 24 h' }),
      S({ id: 'SC-03', contractId: 'CT-01', numero: '044-2026-S03', contratista: 'Imágenes Diagnósticas del Norte S.A.S.', nit: '901.004.287-1', objeto: 'Imágenes diagnósticas (TAC, RM, ecografía).', valor: 3400000000, fechaInicio: D(-250), fechaFin: D(5), estado: 'Activo', ejecucion: 79, responsable: 'Ricardo Ortiz', documentos: 'Contrato', riesgos: 'Falla de equipos', obligaciones: 'Lectura en < 48 h' }),
      S({ id: 'SC-04', contractId: 'CT-02', numero: '051-2026-S01', contratista: 'Redes Eléctricas JR S.A.S.', nit: '900.665.112-8', objeto: 'Instalación de redes eléctricas y cableado estructurado.', valor: 460000000, fechaInicio: D(-150), fechaFin: D(10), estado: 'Activo', ejecucion: 72, responsable: 'Ricardo Ortiz', documentos: 'Contrato, RETIE', riesgos: 'Retraso en certificación RETIE', obligaciones: 'Certificación RETIE' }),
      S({ id: 'SC-05', contractId: 'CT-02', numero: '051-2026-S02', contratista: 'Hidrosanitarias Caribe S.A.S.', nit: '901.220.908-4', objeto: 'Redes hidrosanitarias y de protección contra incendios.', valor: 310000000, fechaInicio: D(-140), fechaFin: D(12), estado: 'Activo', ejecucion: 81, responsable: 'Juan Pérez', documentos: 'Contrato', riesgos: '', obligaciones: 'Pruebas hidrostáticas' }),
      S({ id: 'SC-06', contractId: 'CT-06', numero: '078-2026-S01', contratista: 'Termografía Industrial S.A.S.', nit: '900.990.451-6', objeto: 'Inspecciones termográficas de transformadores.', valor: 95000000, fechaInicio: D(-120), fechaFin: D(28), estado: 'Activo', ejecucion: 60, responsable: 'Ricardo Ortiz', documentos: 'Contrato', riesgos: '', obligaciones: 'Informe por inspección' })
    ];

    /* Ejecución mensual (registros de avance financiero/físico) */
    db.execs = [];
    function spread(cid, total, startOff, months, fis){
      for (var i = 0; i < months; i++){
        var d = new Date(TODAY.getFullYear(), TODAY.getMonth() - (months - 1 - i) + startOff, 1);
        var per = d.getFullYear() + '-' + pad(d.getMonth() + 1);
        var w = 0.7 + ((i * 37) % 10) / 16;
        db.execs.push({ id: 'EX-' + cid + '-' + i, contractId: cid, periodo: per, valor: 0, avanceFisico: 0, obs: 'Informe de ejecución ' + monthLabel(per), w: w });
      }
      var rows = db.execs.filter(function(e){ return e.contractId === cid; });
      var tw = sum(rows, function(r){ return r.w; }), acc = 0, accf = 0;
      rows.forEach(function(r, i){ r.valor = i === rows.length - 1 ? total - acc : Math.round(total * r.w / tw); acc += r.valor; accf = Math.round(fis * (i + 1) / rows.length); r.avanceFisico = accf; delete r.w; });
    }
    spread('CT-01', Math.round(t044 * 0.885), 0, 10, 86);
    spread('CT-02', 2480000000, 0, 7, 78);
    spread('CT-03', 1090000000, 0, 6, 92);
    spread('CT-04', 140000000, -1, 3, 35);
    spread('CT-05', 628000000, -1, 12, 100);
    spread('CT-06', 890000000, 0, 5, 70);
    spread('CT-07', 190000000, 0, 2, 24);
    spread('CT-08', 571200000, -6, 12, 100);
    spread('CT-09', 518000000, 0, 4, 74);
    spread('CT-10', 132000000, 0, 3, 80);

    /* Pagos */
    db.payments = [];
    var pn = 1;
    db.contracts.forEach(function(c){
      var ex = db.execs.filter(function(e){ return e.contractId === c.id; });
      ex.forEach(function(e, i){
        var bruto = Math.round(e.valor / 1.19), iva = e.valor - bruto;
        var last = i === ex.length - 1, prev = i === ex.length - 2;
        var st = (c.estado === 'Liquidado' || c.estado === 'En liquidación') ? 'Pagado' : last ? 'Pendiente' : prev ? 'En revisión' : 'Pagado';
        if (c.id === 'CT-09' && last) st = 'Aprobado';
        if (c.id === 'CT-03' && prev) st = 'Rechazado';
        var f = e.periodo + '-' + (c.id === 'CT-01' ? '05' : '10');
        f = parseD(f) > TODAY ? todayIso() : f;
        var ret = Math.round(bruto * 0.11);
        db.payments.push({ id: 'PG-' + (pn++), contractId: c.id, numero: c.numero + '-P' + pad(i + 1), fecha: f, factura: 'FE-' + (1000 + pn * 7), periodo: e.periodo, bruto: bruto, iva: iva, retenciones: ret, neto: bruto + iva - ret, estado: st, fechaAprob: st === 'Pagado' || st === 'Aprobado' ? f : '', fechaPago: st === 'Pagado' ? addDays(f, 12) > todayIso() ? todayIso() : addDays(f, 12) : '', soporte: st === 'Pendiente' ? '' : 'Factura_' + c.numero + '_' + (i + 1) + '.pdf' });
      });
    });

    /* Obligaciones */
    db.obligations = [];
    var ob = 1;
    function O(cid, d, tipo, resp, off, per, ev, est, cumpl){
      db.obligations.push({ id: 'OB-' + pad(ob++), contractId: cid, descripcion: d, tipo: tipo, responsable: resp, fechaLimite: D(off), periodicidad: per, evidencia: ev, estado: est, cumplimiento: cumpl, obs: '', checklist: [{ t: 'Recibir soporte', done: cumpl > 0 }, { t: 'Revisar contra requisito', done: cumpl >= 50 }, { t: 'Aprobar evidencia', done: cumpl === 100 }], evidencias: cumpl > 0 ? ['Soporte_' + ob + '.pdf'] : [], comentarios: [], fechaCumplimiento: cumpl === 100 ? D(off - 2) : '', verificadoPor: cumpl === 100 ? 'Martha Salcedo' : '', fechaVerificacion: cumpl === 100 ? D(off - 1) : '' });
    }
    O('CT-01', 'Radicar RIPS y facturación del periodo con soportes completos.', 'Reporte / informe', 'Unión Temporal Red Salud Norte', -12, 'Mensual', 'RIPS validados + facturas', 'Pendiente', 0);
    O('CT-01', 'Mantener habilitación vigente (REPS) de toda la red prestadora.', 'Legal', 'Unión Temporal Red Salud Norte', -8, 'Única', 'Certificados REPS', 'En proceso', 40);
    O('CT-01', 'Presentar informe de indicadores de oportunidad y calidad.', 'Reporte / informe', 'Unión Temporal Red Salud Norte', -3, 'Mensual', 'Informe firmado', 'En proceso', 60);
    O('CT-01', 'Acreditar pago de seguridad social del personal asistencial.', 'Seguridad social', 'Unión Temporal Red Salud Norte', -40, 'Mensual', 'Planillas PILA', 'Cumplida', 100);
    O('CT-01', 'Garantizar atención de urgencias 24/7 en la red definida.', 'Técnica', 'Unión Temporal Red Salud Norte', 5, 'Permanente', 'Reporte de disponibilidad', 'Cumplida parcialmente', 80);
    O('CT-02', 'Presentar programación de obra actualizada.', 'Técnica', 'Constructora Barlovento S.A.S.', -20, 'Mensual', 'Cronograma', 'Cumplida', 100);
    O('CT-02', 'Entregar certificación RETIE de instalaciones eléctricas.', 'Legal', 'Constructora Barlovento S.A.S.', 7, 'Única', 'Certificado RETIE', 'En proceso', 50);
    O('CT-02', 'Mantener plan SST y reportar accidentalidad.', 'Seguridad social', 'Constructora Barlovento S.A.S.', -5, 'Mensual', 'Informe SST', 'Cumplida', 100);
    O('CT-03', 'Entregar certificados de calidad por lote.', 'Calidad', 'Distribuidora Agroindustrial del Caribe Ltda.', -15, 'Por entrega', 'Certificados', 'Incumplida', 20);
    O('CT-03', 'Cumplir programación de entregas quincenales.', 'Específica', 'Distribuidora Agroindustrial del Caribe Ltda.', -7, 'Quincenal', 'Remisiones', 'Cumplida parcialmente', 70);
    O('CT-04', 'Entregar informe diagnóstico preliminar.', 'Reporte / informe', 'Analítica Energética Consultores S.A.S.', 30, 'Única', 'Informe', 'Pendiente', 0);
    O('CT-05', 'Entregar informe final de interventoría.', 'Reporte / informe', 'Interventorías del Norte S.A.S.', -30, 'Única', 'Informe final', 'Cumplida', 100);
    O('CT-06', 'Ejecutar rutinas preventivas trimestrales.', 'Técnica', 'Mantenimientos Industriales Arauca S.A.S.', -2, 'Trimestral', 'Órdenes de trabajo', 'En proceso', 65);
    O('CT-06', 'Mantener disponibilidad de cuadrilla de emergencia.', 'Específica', 'Mantenimientos Industriales Arauca S.A.S.', 28, 'Permanente', 'Turnos', 'Cumplida', 100);
    O('CT-07', 'Migrar historias clínicas del sistema anterior.', 'Técnica', 'Soluciones Digitales Kairos S.A.S.', 45, 'Única', 'Acta de migración', 'En proceso', 30);
    O('CT-07', 'Capacitar a 420 usuarios finales.', 'Específica', 'Soluciones Digitales Kairos S.A.S.', 90, 'Única', 'Listas de asistencia', 'Pendiente', 0);
    O('CT-09', 'Reportar pruebas de entrega por viaje.', 'Reporte / informe', 'Transportes Magdalena Express S.A.S.', -1, 'Semanal', 'POD digitales', 'Cumplida parcialmente', 75);
    O('CT-10', 'Presentar informe mensual de gestión jurídica.', 'Reporte / informe', 'Asesorías Jurídicas Barros & Asociados', -4, 'Mensual', 'Informe', 'Pendiente', 0);
    O('CT-10', 'Emitir conceptos en máximo 5 días hábiles.', 'Específica', 'Asesorías Jurídicas Barros & Asociados', 3, 'Permanente', 'Conceptos', 'Cumplida', 100);

    /* Entregables */
    db.deliverables = [];
    var dv = 1;
    function E(cid, n, d, ini, prog, real, resp, est, av){ db.deliverables.push({ id: 'EN-' + pad(dv++), contractId: cid, nombre: n, descripcion: d, fechaInicio: D(ini), fechaProg: D(prog), fechaReal: real == null ? '' : D(real), responsable: resp, estado: est, evidencia: real == null ? '' : 'Entregable_' + dv + '.pdf', avance: av, obs: '' }); }
    E('CT-01', 'Plan de atención y red habilitada', 'Documento de red y rutas de atención', -293, -270, -272, 'Álvaro Guerrero', 'Aprobado', 100);
    E('CT-01', 'Informe trimestral 1', 'Indicadores y glosas', -270, -180, -178, 'Álvaro Guerrero', 'Aprobado', 100);
    E('CT-01', 'Informe trimestral 2', 'Indicadores y glosas', -180, -90, -85, 'Álvaro Guerrero', 'Aprobado', 100);
    E('CT-01', 'Informe trimestral 3', 'Indicadores y glosas', -90, -2, null, 'Álvaro Guerrero', 'Vencido', 60);
    E('CT-01', 'Informe final y paz y salvo', 'Cierre de la ejecución', -10, 5, null, 'Álvaro Guerrero', 'En proceso', 20);
    E('CT-02', 'Cimentación y estructura', 'Hito 1', -205, -120, -118, 'Gustavo Mercado', 'Aprobado', 100);
    E('CT-02', 'Mampostería y redes', 'Hito 2', -120, -30, -22, 'Gustavo Mercado', 'Aprobado', 100);
    E('CT-02', 'Acabados y entrega', 'Hito 3', -30, 14, null, 'Gustavo Mercado', 'En proceso', 55);
    E('CT-04', 'Levantamiento de información', 'Fase 1', -115, -60, -58, 'Iván Palacio', 'Aprobado', 100);
    E('CT-04', 'Modelo de red', 'Fase 2', -60, 40, null, 'Iván Palacio', 'Suspendido', 20);
    E('CT-07', 'Instalación y configuración', 'Hito 1', -62, -20, -21, 'Natalia Rojas', 'Aprobado', 100);
    E('CT-07', 'Migración de datos', 'Hito 2', -20, 45, null, 'Natalia Rojas', 'En proceso', 30);
    E('CT-07', 'Salida en vivo', 'Hito 3', 45, 120, null, 'Natalia Rojas', 'Pendiente', 0);

    /* Garantías */
    db.guarantees = [];
    var gn = 1;
    function G(cid, tipo, aseg, porc, valor, iniOff, venOff, est, rel){ db.guarantees.push({ id: 'GR-' + pad(gn++), contractId: cid, tipo: tipo, aseguradora: aseg, poliza: 'PL-' + (430000 + gn * 1371), valor: valor, porcentaje: porc, fechaExp: D(iniOff - 3), fechaInicio: D(iniOff), fechaVenc: D(venOff), estado: est, documento: 'Poliza_' + gn + '.pdf', relacion: rel || '' }); }
    G('CT-01', 'Cumplimiento', 'Seguros del Estado S.A.', 10, Math.round(t044 * 0.10), -293, 125, 'Aprobada');
    G('CT-01', 'Calidad', 'Seguros del Estado S.A.', 10, Math.round(t044 * 0.10), -293, 125, 'Aprobada');
    G('CT-01', 'Responsabilidad civil', 'Seguros Generales Suramericana (SURA)', 5, Math.round(t044 * 0.05), -293, 4, 'Aprobada');
    G('CT-02', 'Cumplimiento', 'Mundial de Seguros S.A.', 20, 654000000, -205, 134, 'Aprobada', 'Adición 01 (' + D(-40) + ')');
    G('CT-02', 'Manejo de anticipo', 'Mundial de Seguros S.A.', 100, 570000000, -205, 14, 'Aprobada');
    G('CT-02', 'Estabilidad', 'Mundial de Seguros S.A.', 20, 654000000, 14, 1839, 'Pendiente');
    G('CT-03', 'Cumplimiento', 'Liberty Seguros S.A.', 10, 116620000, -186, -6, 'Aprobada');
    G('CT-04', 'Cumplimiento', 'Seguros Bolívar S.A.', 10, 72590000, -115, 215, 'Aprobada');
    G('CT-06', 'Cumplimiento', 'Seguros Bolívar S.A.', 10, 148750000, -152, 7, 'Aprobada');
    G('CT-06', 'Salarios y prestaciones', 'Seguros Bolívar S.A.', 5, 74375000, -152, 1123, 'Aprobada');
    G('CT-07', 'Cumplimiento', 'Seguros Generales Suramericana (SURA)', 10, 105910000, -62, 390, 'Aprobada');
    G('CT-09', 'Cumplimiento', 'Liberty Seguros S.A.', 10, 49980000, -104, 180, 'Aprobada');
    G('CT-10', 'Cumplimiento', 'Seguros del Estado S.A.', 10, 17136000, -87, 2, 'Aprobada');

    /* Actas */
    db.actas = [];
    var an = 1;
    function A(cid, tipo, off, desc, valor, est){ var c = db.contracts.filter(function(x){ return x.id === cid; })[0]; db.actas.push({ id: 'AC-' + pad(an++), contractId: cid, numero: 'ACT-' + c.numero + '-' + pad(an), tipo: tipo, fecha: D(off), descripcion: desc, valor: valor || 0, archivo: 'Acta_' + an + '.pdf', responsable: c.supervisor, estado: est || 'Firmada' }); }
    db.contracts.forEach(function(c){ A(c.id, 'Acta de inicio', diffDays(todayIso(), c.fechaInicio), 'Inicio de ejecución contractual.', 0); });
    A('CT-01', 'Acta parcial', -150, 'Corte parcial de ejecución No. 5.', 18500000000);
    A('CT-02', 'Acta de modificación', -40, 'Adición presupuestal No. 01.', 420000000);
    A('CT-02', 'Acta parcial', -60, 'Corte de obra No. 4.', 1450000000);
    A('CT-04', 'Acta de suspensión', -25, 'Suspensión por falta de información de medición.', 0);
    A('CT-05', 'Acta de terminación', -35, 'Terminación por vencimiento del plazo.', 0);
    A('CT-05', 'Acta de recibo', -33, 'Recibo a satisfacción de informes.', 0);
    A('CT-08', 'Acta de terminación', -180, 'Terminación del arrendamiento.', 0);
    A('CT-08', 'Acta de liquidación', -150, 'Liquidación bilateral sin saldos pendientes.', 571200000);

    /* Modificaciones */
    db.modifications = [
      { id: 'MD-01', contractId: 'CT-02', numero: 'MOD-051-01', tipo: 'Adición', fecha: D(-40), justificacion: 'Mayores cantidades de obra en redes hidrosanitarias.', valorAnterior: 3391500000, valorNuevo: 3811500000, fechaAnterior: '', fechaNueva: '', impacto: 'Incremento del 12,4% del valor. Requiere ampliación de garantía de cumplimiento.', soporte: 'Otrosi_01.pdf', usuario: 'Juan Pérez', registro: D(-40) + ' 10:14:22' },
      { id: 'MD-02', contractId: 'CT-02', numero: 'MOD-051-02', tipo: 'Prórroga', fecha: D(-15), justificacion: 'Lluvias atípicas afectaron el frente de obra exterior.', valorAnterior: 0, valorNuevo: 0, fechaAnterior: D(-1), fechaNueva: D(14), impacto: 'Amplía el plazo 15 días. Ajustar vigencia de pólizas.', soporte: 'Otrosi_02.pdf', usuario: 'Carolina Ríos', registro: D(-15) + ' 16:02:40' },
      { id: 'MD-03', contractId: 'CT-04', numero: 'MOD-067-01', tipo: 'Suspensión', fecha: D(-25), justificacion: 'El operador no ha entregado datos de medición AMI.', valorAnterior: 0, valorNuevo: 0, fechaAnterior: '', fechaNueva: '', impacto: 'Plazo suspendido; al reiniciar se debe correr la fecha de terminación.', soporte: 'Acta_suspension.pdf', usuario: 'Ricardo Ortiz', registro: D(-25) + ' 09:40:05' },
      { id: 'MD-04', contractId: 'CT-01', numero: 'MOD-044-01', tipo: 'Modificación de supervisor', fecha: D(-200), justificacion: 'Reasignación interna del área de salud.', valorAnterior: 0, valorNuevo: 0, fechaAnterior: '', fechaNueva: '', impacto: 'Sin impacto económico.', soporte: 'Designacion.pdf', usuario: 'Laura Méndez', registro: D(-200) + ' 11:22:10' }
    ];

    /* Riesgos */
    db.risks = [];
    var rn = 1;
    function R(cid, r, cat, p, i, resp, trat, mit, est){ db.risks.push({ id: 'RG-' + pad(rn++), contractId: cid, riesgo: r, categoria: cat, prob: p, impacto: i, responsable: resp, tratamiento: trat, mitigacion: mit, fecha: D(-60 + rn * 3), estado: est || 'Abierto', evidencia: '' }); }
    R('CT-01', 'Agotamiento de recursos antes del plazo', 'Financiero', 4, 5, 'Andrés Gómez', 'Mitigar', 'Seguimiento semanal de ejecución y proyección de agotamiento.');
    R('CT-01', 'Glosas superiores al 5%', 'Cumplimiento', 3, 3, 'Martha Salcedo', 'Mitigar', 'Auditoría concurrente y conciliación mensual.');
    R('CT-01', 'Pérdida de habilitación de un prestador', 'Legal / regulatorio', 2, 5, 'Carolina Ríos', 'Transferir', 'Verificación trimestral de REPS.');
    R('CT-02', 'Retraso por condiciones climáticas', 'Operativo', 4, 3, 'Ricardo Ortiz', 'Aceptar', 'Reprogramación de frentes interiores.');
    R('CT-02', 'Accidente laboral en altura', 'Operativo', 2, 4, 'Juan Pérez', 'Mitigar', 'Permisos de trabajo y línea de vida.');
    R('CT-03', 'Incumplimiento de calidad del proveedor', 'Proveedor', 4, 4, 'Juan Pérez', 'Mitigar', 'Muestreo por lote y proveedor alterno.');
    R('CT-04', 'Falta de información del operador', 'Técnico', 5, 3, 'Ricardo Ortiz', 'Mitigar', 'Escalar a gerencia técnica.');
    R('CT-07', 'Pérdida de datos en la migración', 'Seguridad de la información', 2, 5, 'Laura Méndez', 'Mitigar', 'Backups verificados y migración por fases.');
    R('CT-09', 'Ejecución por encima del valor contratado', 'Financiero', 5, 4, 'Andrés Gómez', 'Mitigar', 'Suspender órdenes de viaje hasta formalizar adición.');
    R('CT-06', 'Falla de transformador crítico', 'Técnico', 2, 4, 'Ricardo Ortiz', 'Mitigar', 'Termografía y repuestos en stock.', 'Controlado');

    /* Incumplimientos y planes de mejoramiento */
    db.breaches = [
      { id: 'IN-01', contractId: 'CT-03', obligationId: 'OB-09', tipo: 'Calidad', fecha: D(-14), descripcion: 'Lote 14 sin certificado de calidad; acidez fuera de especificación.', responsable: 'Juan Pérez', evidencia: 'Informe_laboratorio_L14.pdf', impacto: 'Alto', estado: 'En gestión', plan: 'Reposición del lote y certificación por tercero.', fechaLimite: D(4), medida: 'Requerimiento escrito y retención del pago', multa: 9800000 },
      { id: 'IN-02', contractId: 'CT-01', obligationId: 'OB-01', tipo: 'Entrega tardía de información', fecha: D(-10), descripcion: 'RIPS del periodo no radicados en la fecha pactada.', responsable: 'Martha Salcedo', evidencia: 'Oficio_requerimiento.pdf', impacto: 'Medio', estado: 'Abierto', plan: 'Radicación en 5 días hábiles.', fechaLimite: D(2), medida: 'Requerimiento', multa: 0 },
      { id: 'IN-03', contractId: 'CT-10', obligationId: 'OB-18', tipo: 'Informe no entregado', fecha: D(-3), descripcion: 'Informe mensual de gestión no presentado.', responsable: 'Carolina Ríos', evidencia: '', impacto: 'Bajo', estado: 'En análisis', plan: '', fechaLimite: D(3), medida: '', multa: 0 },
      { id: 'IN-04', contractId: 'CT-02', obligationId: '', tipo: 'Seguridad y salud en el trabajo', fecha: D(-70), descripcion: 'Trabajo en altura sin permiso diligenciado.', responsable: 'Ricardo Ortiz', evidencia: 'Registro_fotografico.pdf', impacto: 'Alto', estado: 'Cerrado', plan: 'Capacitación y auditoría diaria.', fechaLimite: D(-55), medida: 'Suspensión temporal del frente', multa: 0 }
    ];
    db.plans = [
      { id: 'PM-01', contractId: 'CT-03', hallazgo: 'Recepción de lotes sin certificado de calidad.', causa: 'No existía verificación documental previa al descargue.', accion: 'Implementar lista de chequeo de recepción obligatoria.', responsable: 'Juan Pérez', fecha: D(10), evidencia: '', estado: 'En ejecución', avance: 40 },
      { id: 'PM-02', contractId: 'CT-01', hallazgo: 'Radicación tardía de RIPS.', causa: 'Validador de RIPS con errores de estructura.', accion: 'Mesa técnica con el contratista y pre-validación semanal.', responsable: 'Martha Salcedo', fecha: D(15), evidencia: '', estado: 'Abierto', avance: 10 },
      { id: 'PM-03', contractId: 'CT-02', hallazgo: 'Incumplimiento de protocolo de alturas.', causa: 'Rotación de personal sin inducción.', accion: 'Inducción obligatoria y control de ingreso.', responsable: 'Ricardo Ortiz', fecha: D(-50), evidencia: 'Listas_induccion.pdf', estado: 'Cerrado', avance: 100 }
    ];

    /* Documentos con control de versiones */
    db.documents = [];
    var dn = 1;
    function Doc(cid, cat, nombre, versions, extracted){ db.documents.push({ id: 'DC-' + pad(dn++), contractId: cid, categoria: cat, nombre: nombre, estado: 'Vigente', obs: '', versions: versions, extracted: extracted || null }); }
    function V(n, off, u, f, motivo, cambios){ return { v: n, fecha: D(off) + ' 09:' + pad(10 + n) + ':00', usuario: u, archivo: f, motivo: motivo || 'Carga inicial', cambios: cambios || '' }; }
    db.contracts.forEach(function(c){
      var fs = diffDays(todayIso(), c.fechaFirma);
      var ex = { valor: c.valorBase + c.iva + c.otrosImp, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, objeto: c.objeto, contratista: c.contratista, nit: c.nitContratista, plazo: diffDays(c.fechaInicio, c.fechaFin) + 1, garantias: '' };
      if (c.id === 'CT-02'){ ex.fechaFin = D(-1); ex.plazo = diffDays(c.fechaInicio, ex.fechaFin) + 1; ex.valor = c.valorBase + c.iva; }
      if (c.id === 'CT-09'){ ex.valor = 499800000; }
      if (c.id === 'CT-06'){ ex.nit = '900.219.405-2'; }
      Doc(c.id, 'Contrato', 'Contrato ' + c.numero + '.pdf', c.id === 'CT-01' ? [V(1, fs, 'Juan Pérez', 'Contrato_044_borrador.pdf', 'Carga inicial'), V(2, fs + 1, 'Carolina Ríos', 'Contrato_044_firmado.pdf', 'Versión firmada', 'Firmas y sello de ambas partes')] : [V(1, fs, 'Juan Pérez', 'Contrato_' + c.numero + '.pdf')], ex);
      if (c.id !== 'CT-10') Doc(c.id, 'Propuesta', 'Propuesta económica.pdf', [V(1, fs - 10, 'Juan Pérez', 'Propuesta_' + c.numero + '.pdf')]);
      if (c.id !== 'CT-08' && c.id !== 'CT-05') Doc(c.id, 'Garantías', 'Pólizas aprobadas.pdf', [V(1, fs + 3, 'Carolina Ríos', 'Polizas_' + c.numero + '.pdf')]);
      Doc(c.id, 'Actas', 'Acta de inicio.pdf', [V(1, diffDays(todayIso(), c.fechaInicio), c.supervisor, 'Acta_inicio_' + c.numero + '.pdf')]);
    });
    Doc('CT-01', 'Estudios previos', 'Estudio de necesidad y mercado.pdf', [V(1, -310, 'Martha Salcedo', 'Estudio_previo_044.pdf')]);
    Doc('CT-01', 'Informes', 'Informe de supervisión trimestral.pdf', [V(1, -95, 'Martha Salcedo', 'Informe_T1.pdf'), V(2, -88, 'Martha Salcedo', 'Informe_T1_v2.pdf', 'Corrección de indicadores', 'Se ajustó el indicador de oportunidad'), V(3, -86, 'Diana Castro', 'Informe_T1_v3.pdf', 'Observaciones de auditoría', 'Se incorporan anexos de glosas')]);
    Doc('CT-02', 'Modificaciones', 'Otrosí 01 - Adición.pdf', [V(1, -40, 'Juan Pérez', 'Otrosi_01.pdf')]);
    Doc('CT-02', 'Prórrogas', 'Otrosí 02 - Prórroga.pdf', [V(1, -15, 'Carolina Ríos', 'Otrosi_02.pdf')]);
    Doc('CT-04', 'Suspensiones', 'Acta de suspensión.pdf', [V(1, -25, 'Ricardo Ortiz', 'Acta_suspension.pdf')]);

    /* Bitácora de auditoría inicial */
    function L(off, hora, u, rol, cid, mod, acc, campo, ant, nue, obs){ db.audit.push({ id: 'AUD-S' + db.audit.length, ts: D(off) + ' ' + hora + ':00', fecha: D(off), hora: hora, usuario: u, rol: rol, contractId: cid, modulo: mod, accion: acc, campo: campo, anterior: ant, nuevo: nue, ip: '10.20.14.' + (30 + db.audit.length), obs: obs || '' }); }
    db.contracts.forEach(function(c){ L(diffDays(todayIso(), c.fechaFirma) - 2, '08:30', 'Juan Pérez', 'CONTRATACIÓN', c.id, 'Contratos', 'Creación', 'Contrato', '', c.numero, 'Registro inicial del contrato'); });
    L(-200, '11:22', 'Laura Méndez', 'ADMINISTRADOR', 'CT-01', 'Modificaciones', 'Modificación', 'Supervisor', 'Carlos Ibáñez', 'Martha Salcedo', 'MOD-044-01');
    L(-40, '10:14', 'Juan Pérez', 'CONTRATACIÓN', 'CT-02', 'Modificaciones', 'Modificación', 'Adiciones', '0', '420000000', 'MOD-051-01');
    L(-15, '16:02', 'Carolina Ríos', 'JURÍDICA', 'CT-02', 'Modificaciones', 'Modificación', 'Fecha de terminación', fdate(D(-1)), fdate(D(14)), 'MOD-051-02');
    L(-25, '09:40', 'Ricardo Ortiz', 'INTERVENTOR', 'CT-04', 'Modificaciones', 'Modificación', 'Estado', 'Activo', 'Suspendido', 'MOD-067-01');
    L(-33, '15:10', 'Andrés Gómez', 'FINANCIERA', 'CT-05', 'Contratos', 'Modificación', 'Estado', 'Terminado', 'En liquidación');
    L(-12, '14:32', 'Andrés Gómez', 'FINANCIERA', 'CT-09', 'Pagos', 'Aprobación', 'Estado del pago', 'En revisión', 'Aprobado');
    L(-6, '10:05', 'Diana Castro', 'AUDITOR', 'CT-01', 'Documentos', 'Consulta', '', '', '', 'Revisión de expediente');
    L(-2, '17:45', 'Martha Salcedo', 'SUPERVISOR', 'CT-01', 'Obligaciones', 'Modificación', '% cumplimiento', '40', '60', 'OB-03');
    db.audit.sort(function(a, b){ return a.ts < b.ts ? -1 : 1; });

    /* Departamentos de ejecución (código DANE) — el primero es la sede principal */
    var DEPS = { 'CT-01': ['08', '13', '47', '20', '44', '70', '23'], 'CT-02': ['13'], 'CT-03': ['08', '13', '47', '20'], 'CT-04': ['08', '11'], 'CT-05': ['13', '08'], 'CT-06': ['81', '85', '54'], 'CT-07': ['08', '11', '05', '76'], 'CT-08': ['08'], 'CT-09': ['47', '08', '25', '68', '05', '50'], 'CT-10': ['08', '11'] };
    var MUN = { 'CT-01': 'Barranquilla', 'CT-02': 'Cartagena', 'CT-03': 'Soledad', 'CT-04': 'Barranquilla', 'CT-05': 'Cartagena', 'CT-06': 'Arauca', 'CT-07': 'Barranquilla', 'CT-08': 'Barranquilla', 'CT-09': 'Santa Marta', 'CT-10': 'Barranquilla' };
    db.contracts.forEach(function(c){ c.deptos = DEPS[c.id] || ['08']; c.municipio = MUN[c.id] || ''; });
    /* Cupos de pólizas por aseguradora */
    db.cupos = [
      { id: 'CP-01', aseguradora: 'Seguros del Estado S.A.', numero: 'CUPO-SE-2026-118', tomador: 'Unión Temporal Red Salud Norte', intermediario: 'Delima Marsh S.A.', valor: 11000000000, fechaInicio: D(-300), fechaVenc: D(65), estado: 'Vigente', observaciones: 'Cupo operativo para pólizas de cumplimiento y calidad.' },
      { id: 'CP-02', aseguradora: 'Mundial de Seguros S.A.', numero: 'CUPO-MS-0457', tomador: 'Constructora Barlovento S.A.S.', intermediario: 'Willis Towers Watson', valor: 2400000000, fechaInicio: D(-220), fechaVenc: D(145), estado: 'Vigente', observaciones: '' },
      { id: 'CP-03', aseguradora: 'Seguros Generales Suramericana (SURA)', numero: 'CUPO-SURA-77120', tomador: 'Grupo empresarial (cupo corporativo)', intermediario: 'AON Colombia', valor: 3500000000, fechaInicio: D(-180), fechaVenc: D(185), estado: 'Vigente', observaciones: 'Cupo corporativo para responsabilidad civil.' },
      { id: 'CP-04', aseguradora: 'Seguros Bolívar S.A.', numero: 'CUPO-SB-3391', tomador: 'Mantenimientos Industriales Arauca S.A.S.', intermediario: 'Correagro S.A.', valor: 250000000, fechaInicio: D(-160), fechaVenc: D(22), estado: 'Vigente', observaciones: 'Cupo casi agotado; solicitar ampliación.' },
      { id: 'CP-05', aseguradora: 'Liberty Seguros S.A.', numero: 'CUPO-LB-5520', tomador: 'Transportes Magdalena Express S.A.S.', intermediario: '', valor: 400000000, fechaInicio: D(-200), fechaVenc: D(160), estado: 'Vigente', observaciones: '' }
    ];
    /* Pólizas adicionales: un contrato puede tener dos o más aseguradoras */
    G('CT-01', 'Salarios y prestaciones', 'Seguros Bolívar S.A.', 5, Math.round(t044 * 0.05), -293, 1220, 'Aprobada');
    G('CT-02', 'Todo riesgo', 'Allianz Seguros S.A.', 100, 3270000000, -205, 140, 'Aprobada');
    G('CT-02', 'Responsabilidad civil', 'Seguros Generales Suramericana (SURA)', 5, 163500000, -205, 140, 'Aprobada');
    G('CT-03', 'Calidad', 'Mapfre Seguros Generales', 10, 116620000, -186, 175, 'Aprobada');
    G('CT-04', 'Responsabilidad civil profesional', 'AXA Colpatria Seguros', 10, 72590000, -115, 215, 'Aprobada');
    G('CT-05', 'Cumplimiento', 'La Previsora S.A.', 10, 98000000, -320, -35, 'Aprobada');
    G('CT-06', 'Responsabilidad civil', 'Chubb Seguros Colombia', 5, 74375000, -152, 200, 'Aprobada');
    G('CT-07', 'Calidad', 'Seguros del Estado S.A.', 10, 105910000, -62, 390, 'Aprobada');
    G('CT-09', 'Responsabilidad civil', 'Aseguradora Solidaria de Colombia', 5, 24990000, -104, 180, 'Aprobada');
    G('CT-10', 'Responsabilidad civil profesional', 'HDI Seguros', 10, 17136000, -87, 120, 'Aprobada');
    var CUPO_OF = { 'Seguros del Estado S.A.|CT-01': 'CP-01', 'Mundial de Seguros S.A.|CT-02': 'CP-02', 'Seguros Generales Suramericana (SURA)|CT-01': 'CP-03', 'Seguros Generales Suramericana (SURA)|CT-07': 'CP-03', 'Seguros Generales Suramericana (SURA)|CT-02': 'CP-03', 'Seguros Bolívar S.A.|CT-06': 'CP-04', 'Liberty Seguros S.A.|CT-09': 'CP-05' };
    var BROK = ['Delima Marsh S.A.', 'AON Colombia', 'Willis Towers Watson', 'Correagro S.A.', 'Directo'];
    db.guarantees.forEach(function(g, i){ var cp = CUPO_OF[g.aseguradora + '|' + g.contractId]; g.modalidadPoliza = cp ? 'Póliza por cupo' : 'Póliza individual'; g.cupoId = cp || ''; g.intermediario = cp ? (db.cupos.filter(function(x){ return x.id === cp; })[0].intermediario || 'Directo') : BROK[i % BROK.length]; g.prima = Math.round(g.valor * (0.004 + (i % 4) * 0.0015)); g.tomador = (db.contracts.filter(function(c){ return c.id === g.contractId; })[0] || {}).contratista || ''; });
    return db;
  }
};
