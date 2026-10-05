'use client';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Surface } from '../ui/Workspace';
import { Store } from '../../lib/store';
import { M } from '../../lib/metrics';
import { deptoNames } from '../../lib/geo';
import { money, fdate, pct } from '../../lib/format';
import { companyHref } from '../app/routes';
import { expHref } from './routes';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';

export const TabInformacion = ({ cid }: { cid: string }) => {
  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const company = Store.get('companies', c.companyId);

  return (
    <div className="tab-info-container">
      <Surface className="panel mb">
        <div className="panel-h">
          <h3>Información General y Contratante</h3>
          {!c.anulado && (
            <Link className="btn sm ghost" href={expHref(cid, 'editar')}>
              <Icon name="edit" /> Editar Contrato
            </Link>
          )}
        </div>
        <div className="panel-b np">
          <div className="dl">
            <div>
              <span>Número de contrato</span>
              <b className="mono">{c.numero || c.num}</b>
            </div>
            <div>
              <span>Estado</span>
              <b>
                <Badge text={c.estado || c.status} color={c.estado === 'Anulado' ? 'na' : undefined} />
              </b>
            </div>
            <div>
              <span>Tipo de contrato</span>
              <b>{c.tipo || c.type || '—'}</b>
            </div>
            <div>
              <span>Modalidad</span>
              <b>{c.modalidad || 'Contratación directa'}</b>
            </div>
            <div>
              <span>Empresa contratante</span>
              <b>
                {company ? (
                  <Link className="link" href={companyHref(company.id)}>
                    {company.razon || company.name}
                  </Link>
                ) : (
                  '—'
                )}
              </b>
            </div>
            <div>
              <span>NIT Contratante</span>
              <b className="mono">{company?.nit || '—'}</b>
            </div>
            <div>
              <span>Contratista</span>
              <b>{c.contratista || '—'}</b>
            </div>
            <div>
              <span>NIT Contratista</span>
              <b className="mono">{c.nitContratista || '—'}</b>
            </div>
            <div>
              <span>Representante Contratista</span>
              <b>{c.repContratista || '—'}</b>
            </div>
            <div>
              <span>Área responsable</span>
              <b>{c.area || '—'}</b>
            </div>
            <div>
              <span>Supervisor</span>
              <b>{c.supervisor || '—'}</b>
            </div>
            <div>
              <span>Interventor</span>
              <b>{c.interventor || 'Sin interventoría externa'}</b>
            </div>
            <div>
              <span>Municipio principal</span>
              <b>{c.municipio || '—'}</b>
            </div>
            <div>
              <span>Departamentos de cobertura</span>
              <b>{deptoNames(c.deptos).join(', ') || '—'}</b>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid g2 mb">
        <Surface className="panel">
          <div className="panel-h">
            <h3>Condiciones Económicas</h3>
          </div>
          <div className="panel-b np">
            <div className="dl">
              <div>
                <span>Valor antes de impuestos</span>
                <b className="mono">{money(c.valorBase || c.val)}</b>
              </div>
              <div>
                <span>IVA (19%)</span>
                <b className="mono">{money(c.iva)}</b>
              </div>
              <div>
                <span>Otros impuestos</span>
                <b className="mono">{money(c.otrosImp)}</b>
              </div>
              <div>
                <span>Valor inicial</span>
                <b className="mono">{money(m.valorInicial)}</b>
              </div>
              <div>
                <span>Adiciones presupuestales</span>
                <b className="mono">{money(c.adiciones)}</b>
              </div>
              <div>
                <span>Reducciones</span>
                <b className="mono">{money(c.reducciones)}</b>
              </div>
              <div>
                <span>Valor contractual actualizado</span>
                <b className="mono">{money(m.valorActual)}</b>
              </div>
              <div>
                <span>Saldo disponible</span>
                <b className="mono" style={{ color: m.saldo < 0 ? 'var(--crit)' : 'var(--ok-text)' }}>
                  {money(m.saldo)} ({pct(m.pctSaldo)})
                </b>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="panel">
          <div className="panel-h">
            <h3>Plazos y Vigencias</h3>
          </div>
          <div className="panel-b np">
            <div className="dl">
              <div>
                <span>Fecha de firma</span>
                <b>{fdate(c.fechaFirma || c.signDate)}</b>
              </div>
              <div>
                <span>Fecha de inicio</span>
                <b>{fdate(c.fechaInicio || c.startDate)}</b>
              </div>
              <div>
                <span>Fecha de terminación</span>
                <b>{fdate(c.fechaFin || c.endDate)}</b>
              </div>
              <div>
                <span>Duración pactada</span>
                <b>{m.duracion} días ({m.meses} meses)</b>
              </div>
              <div>
                <span>Días transcurridos</span>
                <b>{m.transcurridos} días ({pct(m.pctTiempo)})</b>
              </div>
              <div>
                <span>Días restantes</span>
                <b style={{ color: m.restantes != null && m.restantes <= 5 ? 'var(--crit)' : 'inherit' }}>
                  {m.restantes == null ? '—' : m.restantes < 0 ? 'Plazo vencido' : `${m.restantes} días`}
                </b>
              </div>
              <div>
                <span>Condición de plazo</span>
                <b>{c.hastaAgotar ? 'O hasta agotar recursos' : 'Plazo fijo'}</b>
              </div>
              <div>
                <span>Estado temporal</span>
                <b>{m.estadoTemporal}</b>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      <Surface className="panel mb">
        <div className="panel-h">
          <h3>Objeto y Alcance Contractual</h3>
        </div>
        <div className="panel-b">
          {[
            { t: 'Objeto Contractual', v: c.objeto || c.obj },
            { t: 'Descripción y Forma de Pago', v: c.descripcion },
            { t: 'Alcance de los Servicios', v: c.alcance },
            { t: 'Productos y Entregables Esperados', v: c.productos },
            { t: 'Indicadores y Acuerdos de Nivel de Servicio', v: c.indicadores }
          ]
            .filter((b) => !!b.v)
            .map((b) => (
              <div className="mb-4" key={b.t}>
                <h5 className="text-xs uppercase text-muted-foreground mb-1 font-semibold">{b.t}</h5>
                <p
                  className="text-sm p-3 rounded"
                  style={{ background: 'var(--bg-sub)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                >
                  {b.v}
                </p>
              </div>
            ))}
        </div>
      </Surface>
    </div>
  );
};
