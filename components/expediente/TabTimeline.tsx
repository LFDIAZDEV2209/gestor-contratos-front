'use client';
import { Surface, EmptyState } from '../ui/Workspace';
import { SectionHeader } from '../ui/SectionHeader';
import type { Contract, Acta, Guarantee, Payment, Modification, Breach } from '../../lib/types';
import { Store } from '../../lib/store';
import { M } from '../../lib/metrics';
import { CLOSED_STATES } from '../../lib/catalog';
import { money, fdate, todayIso, addDays, monthLabel } from '../../lib/format';
import { Icon } from '../icons';

export const TabTimeline = ({
  cid,
  onTabChange
}: {
  cid: string;
  onTabChange?: (tab: string) => void;
}) => {
  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const now = todayIso();

  interface TLEvent {
    f: string;
    t: string;
    x: string;
    tab: string;
    color: string;
    future?: boolean;
  }

  const events: TLEvent[] = [];

  const add = (f: string | undefined, t: string, x: string, tab: string, color: string, future?: boolean) => {
    if (f) {
      events.push({
        f,
        t,
        x,
        tab,
        color,
        future: future || f > now
      });
    }
  };

  // Creación
  const audits = (Store.all('audit') as any[]).filter(
    (a) => a.contractId === c.id && a.accion === 'Creación' && (a.modulo === 'Contratos' || a.module === 'Contratos')
  );
  const cre = audits[0];
  add(
    cre ? cre.fecha : c.fechaFirma,
    'Contrato creado',
    `Registro inicial en el sistema${cre ? ' por ' + (cre.usuario || cre.user) : ''}.`,
    'Auditoría',
    'var(--na)'
  );

  // Firma
  add(c.fechaFirma, 'Contrato firmado', `${c.contratista} · ${money(m.valorInicial)}`, 'Información', 'var(--brand)');

  // Inicio
  if (c.fechaInicio && c.fechaInicio !== c.fechaFirma) {
    add(c.fechaInicio, 'Inicio de ejecución', `Inicio formal del plazo contractual`, 'Información', 'var(--brand)');
  }

  // Actas
  (Store.byContract('actas', c.id) as Acta[]).forEach((a) => {
    const isSusp = /suspens/i.test(a.tipo);
    const isLiq = /liquid|termin/i.test(a.tipo);
    add(
      a.fecha,
      a.tipo,
      `${a.numero} · ${a.descripcion}`,
      'Actas',
      isSusp ? 'var(--warn)' : isLiq ? 'var(--info)' : 'var(--brand)'
    );
  });

  // Garantías aprobadas
  (Store.byContract('guarantees', c.id) as Guarantee[]).forEach((g) => {
    if (g.estado === 'Aprobada') {
      add(
        g.fechaExp || g.fechaInicio,
        'Garantía aprobada',
        `${g.tipo} · ${g.aseguradora} · póliza ${g.poliza}`,
        'Garantías',
        'var(--ok)'
      );
    }
  });

  // Ejecución
  const execs = Store.byContract('execs', c.id) as any[];
  if (execs.length) {
    execs.sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
    const firstPeriod = execs[0].periodo;
    add(
      firstPeriod + '-28',
      'Ejecución periódica',
      `Primer periodo registrado (${monthLabel(firstPeriod)}). ${execs.length} periodo(s) a la fecha.`,
      'Ejecución',
      'var(--brand-3)'
    );
  }

  // Pagos realizados
  (Store.byContract('payments', c.id) as Payment[])
    .filter((p) => p.estado === 'Pagado')
    .forEach((p) => {
      add(
        p.fechaPago || p.fecha,
        `Pago ${p.numero}`,
        `Factura ${p.factura} · neto ${money(p.neto)}`,
        'Pagos',
        'var(--ok)'
      );
    });

  // Modificaciones
  (Store.byContract('modifications', c.id) as Modification[]).forEach((md) => {
    let tabTarget = 'Modificaciones';
    if (md.tipo === 'Prórroga') tabTarget = 'Prórrogas';
    if (md.tipo === 'Suspensión' || md.tipo === 'Reinicio') tabTarget = 'Suspensiones';

    const desc = `${md.fechaNueva ? 'Nueva fecha ' + fdate(md.fechaNueva) + '. ' : ''}${
      md.valorNuevo ? 'Nuevo valor ' + money(md.valorNuevo) + '. ' : ''
    }${md.justificacion || ''}`;

    add(md.fecha, `${md.tipo} ${md.numero}`, desc, tabTarget, md.tipo === 'Suspensión' ? 'var(--warn)' : 'var(--info)');
  });

  // Incumplimientos
  (Store.byContract('breaches', c.id) as Breach[]).forEach((b) => {
    add(b.fecha, 'Incumplimiento', `${b.tipo} · ${b.estado}`, 'Incumplimientos', 'var(--crit)');
  });

  // Terminación
  const hasLiquidacion = (Store.byContract('actas', c.id) as Acta[]).some(
    (a) => a.tipo === 'Acta de liquidación'
  );
  add(
    c.fechaFin,
    'Terminación',
    `${c.fechaFin && c.fechaFin > now ? 'Terminación prevista' : 'Fecha de terminación'} del plazo contractual.`,
    'Información',
    'var(--crit)'
  );

  // Plazo límite de liquidación (120 días posteriores)
  if (!hasLiquidacion && !CLOSED_STATES.includes(c.estado || '')) {
    add(
      addDays(c.fechaFin || now, 120),
      'Plazo límite de liquidación',
      'Fecha máxima para suscribir acta de liquidación bilateral (120 días posteriores a la terminación).',
      'Actas',
      'var(--warn)',
      true
    );
  }

  // Ordenar cronológicamente
  events.sort((a, b) => (a.f < b.f ? -1 : 1));

  // Agrupación por mes para escanear el historial con facilidad
  const grupos: Array<{ mes: string; items: TLEvent[] }> = [];
  for (const ev of events) {
    const mes = ev.f.slice(0, 7);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.items.push(ev);
    else grupos.push({ mes, items: [ev] });
  }

  return (
    <div className="ws-tab-pane">
      <SectionHeader as="h3"
        icon="clock"
        title="Historial y línea de tiempo"
        description={`${events.length} hitos y eventos registrados. Haz clic en cualquiera para abrir su pestaña de detalle.`}
      />

      <Surface className="panel">
        <div className="panel-b">
          <div className="tl" aria-label="Eventos del contrato en orden cronológico">
            {grupos.map((g) => (
              <div key={g.mes}>
                <div
                  className="small mono"
                  style={{ color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em', margin: '14px 0 6px' }}
                >
                  {monthLabel(g.mes)}
                </div>
                {g.items.map((ev, idx) => (
                  <div
                    key={idx}
                    className={`tl-i ${ev.future ? 'future' : ''}`}
                    style={{ '--tlc': ev.color, cursor: onTabChange ? 'pointer' : 'default' } as any}
                    onClick={() => onTabChange && onTabChange(ev.tab)}
                    role={onTabChange ? 'button' : undefined}
                    tabIndex={onTabChange ? 0 : undefined}
                    onKeyDown={event => {
                      if (onTabChange && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        onTabChange(ev.tab);
                      }
                    }}
                    title={onTabChange ? `Ver en pestaña ${ev.tab}` : undefined}
                  >
                    <div className="tl-d">
                      <time dateTime={ev.f}>{fdate(ev.f)}</time> {ev.future ? '· programado' : ''}
                    </div>
                    <div className="tl-t">
                      {ev.t} <span className="small muted">({ev.tab})</span>
                    </div>
                    <div className="tl-x">{ev.x}</div>
                  </div>
                ))}
              </div>
            ))}
            {events.length === 0 && (
              <EmptyState title="Sin eventos en la línea de tiempo" description="Los eventos contractuales (actas, pagos, modificaciones y garantías) aparecerán aquí." />
            )}
          </div>
        </div>
      </Surface>
    </div>
  );
};
