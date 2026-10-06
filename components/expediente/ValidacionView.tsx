'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';
import { Store, Audit, AuthService } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { exportRows } from '../../lib/export';
import { nowStamp, fdate } from '../../lib/format';
import { contractHref } from '../app/routes';
import type { Contract, VIssue } from '../../lib/types';

/* Mapa severidad -> (clase de badge, clase de carril semántico de fila). */
const sevTone: Record<string, { badge: 'crit' | 'warn' | 'info'; rail: string }> = {
  Alta: { badge: 'crit', rail: 'rail-c-crit' },
  Media: { badge: 'warn', rail: 'rail-c-warn' },
  Baja: { badge: 'info', rail: 'rail-c-info' }
};

/**
 * VISTA dedicada del Validador contractual (fila 16 del mapa): antes un modal de
 * gran tamaño en ExpedienteView. Convierte el listado de inconsistencias en tabla
 * navegable y mantiene la exportación XLSX/PDF y el registro de auditoría.
 */
export const ValidacionView = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  const [exportado, setExportado] = useState<'xlsx' | 'pdf' | null>(null);
  const logeado = useRef(false);

  const canView = AuthService.can('ver');
  const res = useMemo(() => (c && canView ? Validator.contract(c) : null), [c, canView]);

  // El modal original auditaba al abrirse; aquí se audita una sola vez por visita.
  useEffect(() => {
    if (!c || !res || !canView || logeado.current) return;
    logeado.current = true;
    Audit.log({
      contractId: c.id,
      modulo: 'Validador',
      accion: 'Validación',
      campo: 'Resultado',
      nuevo: res.issues.length ? `${res.issues.length} inconsistencias` : 'Validado correctamente'
    });
  }, [c, res, canView]);

  if (!canView) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no tiene permiso para consultar el validador contractual."
          action={
            <Link className="btn pri" href="/contratos" style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Contratos
            </Link>
          }
        />
      </div>
    );
  }

  if (!c || !res) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Contrato no encontrado"
          description="El identificador del contrato no existe o el registro fue anulado."
          action={
            <Link className="btn pri" href="/contratos" style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Contratos
            </Link>
          }
        />
      </div>
    );
  }

  const hayIssues = res.issues.length > 0;

  const exportar = (format: 'xlsx' | 'pdf') => {
    const cols = [
      { l: 'Severidad', k: 'sev' },
      { l: 'Área', k: 'area' },
      { l: 'Campo', k: 'campo' },
      { l: 'Valor actual', k: 'actual' },
      { l: 'Valor esperado', k: 'esperado' },
      { l: 'Recomendación', k: 'rec' }
    ];
    exportRows('Validación contrato ' + c.numero, cols, res.issues, format);
    Audit.log({
      contractId: c.id,
      modulo: 'Validador',
      accion: 'Exportación',
      campo: format.toUpperCase(),
      nuevo: `${res.issues.length} hallazgos`
    });
    setExportado(format);
  };

  const alta = res.issues.filter((i) => i.sev === 'Alta').length;
  const media = res.issues.filter((i) => i.sev === 'Media').length;
  const baja = res.issues.length - alta - media;

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/contratos">Contratos</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <Link href={contractHref(cid)}>Contrato {c.numero}</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>Validación</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Validador contractual
            <Badge text={hayIssues ? 'Con hallazgos' : 'Sin hallazgos'} color={hayIssues ? 'crit' : 'ok'} />
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Revisión automática de coherencia del expediente {c.numero}: fechas, valores,
            porcentajes, garantías, obligaciones, pagos, documentos, ejecución, modificaciones,
            subcontratos, riesgos, incumplimientos y liquidación.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb val-score" role="status">
        {/* Veredicto: título, resumen por severidad y sello de ejecución */}
        <div className="val-verdict">
          <span className={`val-verdict-ic ${hayIssues ? 'bad' : 'ok'}`} aria-hidden="true">
            <Icon name={hayIssues ? 'triangle-exclamation' : 'circle-check'} size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 className="val-verdict-t">
              {hayIssues
                ? `Se encontraron ${res.issues.length} inconsistencia${res.issues.length === 1 ? '' : 's'}`
                : 'Contrato validado correctamente'}
            </h2>
            {hayIssues ? (
              <div className="val-sev" role="list" aria-label="Hallazgos por severidad">
                {[
                  { n: alta, l: 'Alta', c: 'crit' },
                  { n: media, l: 'Media', c: 'warn' },
                  { n: baja, l: 'Baja', c: 'info' }
                ]
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <Badge key={s.l} text={`${s.n} de severidad ${s.l}`} color={s.c} />
                  ))}
              </div>
            ) : (
              <p className="val-verdict-d">
                Las 13 áreas del expediente se revisaron en esta pasada. No se detectaron
                inconsistencias de fechas, valores, porcentajes, garantías, obligaciones, pagos,
                documentos, ejecución, modificaciones, subcontratos, riesgos, incumplimientos ni
                liquidación.
              </p>
            )}
            <span className="val-stamp">
              <Icon name="clock" /> Ejecutado el {fdate(nowStamp())}
            </span>
          </div>
        </div>

        {/* Checklist de las 13 áreas verificadas, compacta y escaneable */}
        <div className="val-checks" role="list" aria-label="Áreas verificadas">
          {res.areas.map((a) => (
            <span key={a.a} className={`val-check ${a.ok ? '' : 'bad'}`} role="listitem" title={a.ok ? 'Área coherente' : 'Área con hallazgos'}>
              <span className="val-dot" aria-hidden="true">
                <Icon name={a.ok ? 'check' : 'close'} size={11} />
              </span>
              {a.a}
            </span>
          ))}
        </div>
      </Surface>

      {hayIssues ? (
        <Surface className="panel mb">
          <div className="panel-h">
            <div>
              <h2 style={{ fontSize: '15px', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="list" size={15} /> Inconsistencias detectadas
                <span className="badge b-crit">{res.issues.length}</span>
              </h2>
              <span className="sub">Ordenadas por severidad; exporta el detalle para el archivo del expediente</span>
            </div>
            <div className="row-flex">
              <Button className="btn sm" onClick={() => exportar('xlsx')} title="Exportar hallazgos a Excel">
                <Icon name="file-excel" /> Excel
              </Button>
              <Button className="btn sm" onClick={() => exportar('pdf')} title="Exportar hallazgos a PDF">
                <Icon name="file-pdf" /> PDF
              </Button>
            </div>
          </div>

          <TableViewport className="tbl-wrap" aria-label="Listado de inconsistencias contractuales">
            <DataTable className="tbl" aria-label="Listado de inconsistencias contractuales">
              <thead>
                <tr>
                  <th className="nw">Severidad</th>
                  <th>Área</th>
                  <th>Campo</th>
                  <th>Valor actual</th>
                  <th>Valor esperado</th>
                  <th>Recomendación</th>
                </tr>
              </thead>
              <tbody>
                {res.issues.map((i: VIssue, idx: number) => {
                  const tone = sevTone[i.sev] || sevTone.Baja;
                  return (
                    <tr key={idx} className={`rail ${tone.rail}`}>
                      <td className="nw">
                        <Badge text={i.sev} color={tone.badge} />
                      </td>
                      <td className="small muted">{i.area}</td>
                      <td className="strong" style={{ minWidth: 160 }}>{i.campo}</td>
                      <td style={{ color: 'var(--crit-text)', minWidth: 130 }} title={String(i.actual)}>
                        {i.actual}
                      </td>
                      <td style={{ color: 'var(--ok-text)', minWidth: 130 }} title={String(i.esperado)}>
                        {i.esperado}
                      </td>
                      <td className="small" style={{ minWidth: 180 }}>{i.rec}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableViewport>
        </Surface>
      ) : (
        <Surface className="panel mb">
          <EmptyState
            title="Sin inconsistencias"
            description="Fechas, valores, porcentajes, garantías, obligaciones, pagos, documentos, ejecución, modificaciones, subcontratos, riesgos, incumplimientos y liquidación son completamente coherentes."
            action={
              <Link className="btn" href={contractHref(cid, 'resumen')} style={{ marginTop: 12 }}>
                <Icon name="chevron-left" /> Volver al expediente
              </Link>
            }
          />
        </Surface>
      )}

      {exportado && (
        <p className="small muted" role="status" style={{ margin: '0 0 12px' }}>
          <Icon name="circle-info" /> Archivo {exportado.toUpperCase()} generado con {res.issues.length} hallazgos.
        </p>
      )}

      <div className="form-foot">
        <Link className="btn ghost" href={contractHref(cid)}>
          <Icon name="chevron-left" /> Volver al expediente
        </Link>
        <Button className="btn pri" onClick={() => exportar(hayIssues ? 'xlsx' : 'pdf')}>
          <Icon name="file-export" /> Exportar reporte
        </Button>
      </div>
    </div>
  );
};
