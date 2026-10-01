'use client';
import { Store } from '../../lib/store';
import { M } from '../../lib/metrics';
import { deptoNames } from '../../lib/geo';
import { money, fdate, pct } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';

export const TabInformacion = ({ cid, onEdit }: { cid: string; onEdit?: () => void }) => {
  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const company = Store.get('companies', c.companyId);

  return (
    <div className="tab-info-container">
      <div className="panel mb">
        <div className="panel-h">
          <h3>Información General y Contratante</h3>
          {onEdit && (
            <button className="btn sm ghost" onClick={onEdit}>
              <Icon name="edit" /> Editar Contrato
            </button>
          )}
        </div>
        <div className="panel-b np">
          <div className="dl">
            <div>
              <span>Número de contrato</span>
              <b>{c.numero || c.num}</b>
            </div>
            <div>
              <span>Estado</span>
              <b>
                <Badge text={c.estado || c.status} />
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
              <b>{company?.razon || company?.name || '—'}</b>
            </div>
            <div>
              <span>NIT Contratante</span>
              <b>{company?.nit || '—'}</b>
            </div>
            <div>
              <span>Contratista</span>
              <b>{c.contratista || '—'}</b>
            </div>
            <div>
              <span>NIT Contratista</span>
              <b>{c.nitContratista || '—'}</b>
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
      </div>

      <div className="grid g2 mb">
        <div className="panel">
          <div className="panel-h">
            <h3>Condiciones Económicas</h3>
          </div>
          <div className="panel-b np">
            <div className="dl">
              <div>
                <span>Valor antes de impuestos</span>
                <b>{money(c.valorBase || c.val)}</b>
              </div>
              <div>
                <span>IVA (19%)</span>
                <b>{money(c.iva)}</b>
              </div>
              <div>
                <span>Otros impuestos</span>
                <b>{money(c.otrosImp)}</b>
              </div>
              <div>
                <span>Valor inicial</span>
                <b>{money(m.valorInicial)}</b>
              </div>
              <div>
                <span>Adiciones presupuestales</span>
                <b>{money(c.adiciones)}</b>
              </div>
              <div>
                <span>Reducciones</span>
                <b>{money(c.reducciones)}</b>
              </div>
              <div>
                <span>Valor contractual actualizado</span>
                <b>{money(m.valorActual)}</b>
              </div>
              <div>
                <span>Saldo disponible</span>
                <b style={{ color: m.saldo < 0 ? 'var(--crit)' : 'var(--brand)' }}>
                  {money(m.saldo)} ({pct(m.pctSaldo)})
                </b>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
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
        </div>
      </div>

      <div className="panel mb">
        <div className="panel-h">
          <h3>Objeto y Alcance Contractual</h3>
        </div>
        <div className="panel-b">
          <div className="mb-4">
            <h5 className="text-xs uppercase text-muted mb-1 font-semibold">Objeto Contractual</h5>
            <p className="text-sm bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
              {c.objeto || c.obj || '—'}
            </p>
          </div>

          {c.descripcion && (
            <div className="mb-4">
              <h5 className="text-xs uppercase text-muted mb-1 font-semibold">Descripción y Forma de Pago</h5>
              <p className="text-sm bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                {c.descripcion}
              </p>
            </div>
          )}

          {c.alcance && (
            <div className="mb-4">
              <h5 className="text-xs uppercase text-muted mb-1 font-semibold">Alcance de los Servicios</h5>
              <p className="text-sm bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                {c.alcance}
              </p>
            </div>
          )}

          {c.productos && (
            <div className="mb-4">
              <h5 className="text-xs uppercase text-muted mb-1 font-semibold">Productos y Entregables Esperados</h5>
              <p className="text-sm bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                {c.productos}
              </p>
            </div>
          )}

          {c.indicadores && (
            <div>
              <h5 className="text-xs uppercase text-muted mb-1 font-semibold">Indicadores y Acuerdos de Nivel de Servicio</h5>
              <p className="text-sm bg-neutral-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                {c.indicadores}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
