'use client';
import { Button } from '../ui/button';
import { PageHeader, Surface } from '../ui/Workspace';
import { useState } from 'react';
import type { Contract, Guarantee, Obligation, Deliverable, Payment, Acta, AuditEntry } from '../../lib/types';
import { Store } from '../../lib/store';
import { activeContracts } from '../../lib/metrics';
import { effOblig } from '../../lib/metrics';
import { fdate, todayIso, iso, addDays, moneyM, groupBy } from '../../lib/format';
import { Icon } from '../icons';
import { Modal } from '../ui/Modal';

interface CalEvt {
  d: string;
  t: string;
  txt: string;
  cid: string;
  tab: string;
}

const EVT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  inicio: { label: 'Inicio de contrato', color: 'var(--brand)', icon: 'play' },
  fin: { label: 'Terminación', color: 'var(--crit)', icon: 'clock' },
  garantia: { label: 'Vencimiento de garantía', color: 'var(--brand-3)', icon: 'shield' },
  obligacion: { label: 'Obligación', color: 'var(--risk)', icon: 'clipboard-check' },
  entregable: { label: 'Entregable', color: 'var(--info)', icon: 'file-text' },
  pago: { label: 'Pago', color: 'var(--ok)', icon: 'wallet' },
  acta: { label: 'Acta', color: 'var(--muted)', icon: 'file-signature' },
  auditoria: { label: 'Auditoría', color: 'var(--na)', icon: 'fingerprint' }
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DH = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getMonday(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dt.setDate(diff));
}

export const CalendarioView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [mode, setMode] = useState<'mes' | 'semana' | 'dia'>(()=>typeof window !== 'undefined' && window.matchMedia('(max-width:620px)').matches ? 'dia' : 'mes');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [offTypes, setOffTypes] = useState<Record<string, boolean>>({});
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: CalEvt[] } | null>(null);

  // Calcular los eventos sin alterar sus reglas de negocio
  const computeEvents = (): CalEvt[] => {
    const E: CalEvt[] = [];
    const add = (d: string | undefined, t: string, txt: string, cid: string, tab: string) => {
      if (d && !offTypes[t]) {
        E.push({
          d: String(d).slice(0, 10),
          t,
          txt,
          cid,
          tab
        });
      }
    };

    activeContracts().forEach((c) => {
      add(c.fechaInicio, 'inicio', `Inicio ${c.numero}`, c.id, 'resumen');
      add(c.fechaFin, 'fin', `Termina ${c.numero}`, c.id, 'resumen');
    });

    const isValidContract = (cid?: string) => {
      if (!cid) return false;
      const c = Store.get('contracts', cid);
      return c && !c.anulado;
    };

    (Store.all('guarantees') as Guarantee[])
      .filter((g) => isValidContract(g.contractId) && g.estado === 'Aprobada')
      .forEach((g) => {
        add(g.fechaVenc, 'garantia', `Vence póliza ${g.poliza} (${g.tipo})`, g.contractId, 'garantias');
      });

    (Store.all('obligations') as Obligation[])
      .filter((o) => isValidContract(o.contractId) && effOblig(o) !== 'Cumplida')
      .forEach((o) => {
        add(o.fechaLimite, 'obligacion', o.descripcion, o.contractId, 'obligaciones');
      });

    (Store.all('deliverables') as Deliverable[])
      .filter((d) => isValidContract(d.contractId))
      .forEach((d) => {
        add(d.fechaProg, 'entregable', d.nombre, d.contractId, 'entregables');
      });

    (Store.all('payments') as Payment[])
      .filter((p) => isValidContract(p.contractId))
      .forEach((p) => {
        add(
          p.estado === 'Pagado' ? p.fechaPago || p.fecha : p.fecha,
          'pago',
          `${p.numero} · ${moneyM(p.neto)} · ${p.estado}`,
          p.contractId,
          'pagos'
        );
      });

    (Store.all('actas') as Acta[])
      .filter((a) => isValidContract(a.contractId))
      .forEach((a) => {
        add(a.fecha, 'acta', `${a.tipo} ${a.numero}`, a.contractId, 'actas');
      });

    if (!offTypes['auditoria']) {
      const auditByDateAndCid = groupBy(
        (Store.all('audit') as AuditEntry[]).filter((a) => a.contractId),
        (a) => `${a.fecha}|${a.contractId}`
      );
      Object.keys(auditByDateAndCid).forEach((k) => {
        const [fecha, cid] = k.split('|');
        const c = Store.get('contracts', cid);
        if (c) {
          add(
            fecha,
            'auditoria',
            `${auditByDateAndCid[k].length} registro(s) de auditoría · ${c.numero}`,
            cid,
            'auditoria'
          );
        }
      });
    }

    return E;
  };

  const events = computeEvents();
  const eventsByDay = groupBy(events, (e) => e.d);

  // Navegación entre fechas
  const handleNav = (delta: number) => {
    const d = new Date(currentDate);
    if (mode === 'mes') {
      d.setMonth(d.getMonth() + delta);
    } else if (mode === 'semana') {
      d.setDate(d.getDate() + delta * 7);
    } else {
      d.setDate(d.getDate() + delta);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleType = (t: string) => {
    setOffTypes((prev) => ({ ...prev, [t]: !prev[t] }));
  };

  // Título del período visible
  let title = '';
  if (mode === 'mes') {
    title = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  } else if (mode === 'semana') {
    const monday = getMonday(currentDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    title = `Semana del ${fdate(iso(monday))} al ${fdate(iso(sunday))}`;
  } else {
    title = `${DAY_NAMES[currentDate.getDay()]}, ${currentDate.getDate()} de ${
      MONTH_NAMES[currentDate.getMonth()]
    } de ${currentDate.getFullYear()}`;
  }

  // Cuadrícula mensual
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startMonday = getMonday(firstDayOfMonth);
  const monthDays: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const cd = new Date(startMonday);
    cd.setDate(startMonday.getDate() + i);
    if (i >= 35 && cd.getMonth() !== currentDate.getMonth()) break;
    monthDays.push(cd);
  }

  // Días de la semana
  const weekStartDay = getMonday(currentDate);
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const cd = new Date(weekStartDay);
    cd.setDate(weekStartDay.getDate() + i);
    weekDays.push(cd);
  }

  const todayStr = todayIso();

  return (
    <div className="motion-safe:[&_.btn]:hover:-translate-y-0.5 [&_.btn]:hover:shadow-[var(--shadow-2)]! [&_.btn]:focus-visible:shadow-[var(--shadow-2)]! motion-safe:[&_.btn]:[transition:translate_var(--t-fast)_var(--ease),box-shadow_var(--t-fast)_var(--ease),background-color_var(--t-fast)_var(--ease)]! motion-safe:[&_a]:hover:-translate-y-0.5 [&_a]:hover:shadow-[var(--shadow-1)]">
      {/* Cabecera y controles de vista */}
      <PageHeader variant="hero" className="page-h anim-fade-rise">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: 'inline-grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.16)',
                backdropFilter: 'blur(6px)',
                flexShrink: 0
              }}
            >
              <Icon name="calendar" size={22} style={{ color: 'var(--color-primary-foreground, white)' }} />
            </span>
            <div>
              <h1 style={{ margin: 0 }}>Calendario contractual</h1>
              <p style={{ margin: '4px 0 0' }}>
                Inicios, terminaciones, garantías, obligaciones, entregables, pagos, actas y auditorías
              </p>
            </div>
          </div>
        </div>

        <div className="ph-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Button
            className={`btn sm ${mode === 'mes' ? 'pri' : ''}`}
            aria-pressed={mode === 'mes'}
            onClick={() => setMode('mes')}
            title="Vista mensual"
          >
            <Icon name="calendar" /> Mes
          </Button>
          <Button
            className={`btn sm ${mode === 'semana' ? 'pri' : ''}`}
            aria-pressed={mode === 'semana'}
            onClick={() => setMode('semana')}
            title="Vista semanal"
          >
            <Icon name="calendar-days" /> Semana
          </Button>
          <Button
            className={`btn sm ${mode === 'dia' ? 'pri' : ''}`}
            aria-pressed={mode === 'dia'}
            onClick={() => setMode('dia')}
            title="Vista diaria"
          >
            <Icon name="clock" /> Día
          </Button>
        </div>

        {/* Leyenda interactiva de tipos de evento dentro del hero banner */}
        <div
          className="legend"
          style={{ width: '100%', marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '12px' }}
        >
          {Object.keys(EVT_CONFIG).map((k) => {
            const cfg = EVT_CONFIG[k];
            const isOff = offTypes[k];
            return (
              <button
                type="button"
                key={k}
                aria-pressed={!isOff}
                className="inline-flex items-center gap-1.5 border border-current text-xs hover:shadow-[var(--shadow-2)]! focus-visible:outline-[var(--side-ink-hi)] motion-safe:hover:-translate-y-0.5"
                onClick={() => toggleType(k)}
                style={{
                  cursor: 'pointer',
                  opacity: isOff ? 0.7 : 1,
                  textDecoration: isOff ? 'line-through' : 'none',
                  padding: '3px 9px',
                  borderRadius: 'var(--r-pill)',
                  background: isOff ? 'transparent' : 'var(--side-ink-hi)',
                  color: isOff ? 'var(--side-ink-hi)' : 'var(--brand-2)',
                  boxShadow: isOff ? 'none' : 'var(--shadow-1)',
                  backdropFilter: 'blur(4px)',
                  transition: 'translate var(--t-fast) var(--ease), scale var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease)'
                }}
                title={`Clic para ${isOff ? 'mostrar' : 'ocultar'} ${cfg.label}`}
              >
                <span className="sem" style={{ background: cfg.color }} />
                <span>{cfg.label}</span>
                {!isOff && <Icon name="check" size={12} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <Surface className="panel anim-fade-rise stagger-2">
        {/* Navegación del calendario */}
        <div className="panel-h" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="row-flex" style={{ gap: 8, alignItems: 'center' }}>
            <Button
              className="icon-btn"
              onClick={() => handleNav(-1)}
              aria-label="Anterior"
              title="Anterior"
            >
              <Icon name="chevron-left" />
            </Button>
            <Button className="btn sm aria-pressed:border-[var(--brand)]! aria-pressed:bg-[var(--brand-soft)]! aria-pressed:text-[var(--brand-2)]!" onClick={handleToday} aria-pressed={iso(currentDate) === todayStr} title="Ir a la fecha actual">
              Hoy
            </Button>
            <Button
              className="icon-btn"
              onClick={() => handleNav(1)}
              aria-label="Siguiente"
              title="Siguiente"
            >
              <Icon name="chevron-right" />
            </Button>
            <h3 style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar-days" />
              <span>{title}</span>
            </h3>
          </div>

          <span className="sub">
            {events.length} evento{events.length === 1 ? '' : 's'} activo{events.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Vista mensual */}
        {mode === 'mes' && (
          <div className="cal">
            {DH.map((dName) => (
              <div key={dName} className="dh">
                {dName}
              </div>
            ))}
            {monthDays.map((d, dayIndex) => {
              const k = iso(d);
              const isOut = d.getMonth() !== currentDate.getMonth();
              const isToday = k === todayStr;
              const dayEvts: CalEvt[] = eventsByDay[k] || [];

              return (
                <div
                  key={k}
                  className={`d anim-fade-rise data-[selected=true]:ring-2 data-[selected=true]:ring-inset data-[selected=true]:ring-[var(--brand)] ${isOut ? 'out' : ''} ${isToday ? 'today' : ''}`}
                  data-selected={k === (selectedDayEvents?.date ?? iso(currentDate))}
                  style={{ minHeight: '90px', animationDelay: `${Math.floor(dayIndex / 7) * 40}ms` }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <button
                      type="button"
                      aria-label={`Ver eventos del ${fdate(k)}`}
                      aria-haspopup="dialog"
                      aria-current={isToday ? 'date' : undefined}
                      disabled={dayEvts.length === 0}
                      className="dn font-bold hover:shadow-[var(--shadow-2)] disabled:cursor-default!"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (dayEvts.length > 0) setSelectedDayEvents({ date: k, events: dayEvts });
                      }}
                    >
                      {d.getDate()}
                    </button>
                    {dayEvts.length > 3 && (
                      <button
                        type="button"
                        aria-label={`Ver los ${dayEvts.length} eventos del ${fdate(k)}`}
                        aria-haspopup="dialog"
                        className="small link rounded hover:shadow-[var(--shadow-1)] motion-safe:hover:-translate-y-0.5"
                        onClick={() => setSelectedDayEvents({ date: k, events: dayEvts })}
                        style={{ fontSize: '11px', cursor: 'pointer' }}
                      >
                        +{dayEvts.length - 3} más
                      </button>
                    )}
                  </div>

                  {dayEvts.slice(0, 3).map((e, idx) => {
                    const cfg = EVT_CONFIG[e.t] || { label: e.t, color: 'var(--brand)' };
                    return (
                      <button
                        type="button"
                        key={idx}
                        className="ev anim-fade-rise w-full text-left hover:shadow-[var(--shadow-2)] hover:bg-[var(--surface)]! focus-visible:shadow-[var(--shadow-2)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.02]"
                        style={{ borderLeftColor: cfg.color, animationDelay: `${Math.min(idx, 6) * 30}ms`, cursor: 'pointer', transition: 'translate var(--t-fast) var(--ease), scale var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease)' }}
                        onClick={() => onSelectContract(e.cid, e.tab)}
                        title={`${cfg.label} · ${e.txt}`}
                      >
                        {e.txt}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Vista semanal */}
        {mode === 'semana' && (
          <div className="cal" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DH.map((dName, idx) => {
              const d = weekDays[idx];
              return (
                <div key={dName} className="dh">
                  {dName} {d ? d.getDate() : ''}
                </div>
              );
            })}
            {weekDays.map((d, dayIndex) => {
              const k = iso(d);
              const isToday = k === todayStr;
              const dayEvts: CalEvt[] = eventsByDay[k] || [];
              return (
                <div
                  key={k}
                  className={`d anim-fade-rise data-[selected=true]:ring-2 data-[selected=true]:ring-inset data-[selected=true]:ring-[var(--brand)] ${isToday ? 'today' : ''}`}
                  data-selected={k === iso(currentDate)}
                  style={{ minHeight: '300px', animationDelay: `${dayIndex * 40}ms` }}
                >
                  <span className="dn font-bold mb-2 block">{d.getDate()}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dayEvts.map((e, idx) => {
                      const cfg = EVT_CONFIG[e.t] || { label: e.t, color: 'var(--brand)' };
                      return (
                        <button
                          type="button"
                          key={idx}
                          className="ev anim-fade-rise w-full text-left hover:shadow-[var(--shadow-2)] hover:bg-[var(--surface)]! focus-visible:shadow-[var(--shadow-2)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.02]"
                          style={{ borderLeftColor: cfg.color, animationDelay: `${Math.min(idx, 6) * 30}ms`, cursor: 'pointer', transition: 'translate var(--t-fast) var(--ease), scale var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease)' }}
                          onClick={() => onSelectContract(e.cid, e.tab)}
                          title={`${cfg.label} · ${e.txt}`}
                        >
                          {e.txt}
                        </button>
                      );
                    })}
                    {dayEvts.length === 0 && (
                      <div className="small muted" style={{ textAlign: 'center', marginTop: '30px' }}>
                        Sin eventos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista diaria */}
        {mode === 'dia' && (
          <div className="p-4">
            {(() => {
              const k = iso(currentDate);
              const dayEvts: CalEvt[] = eventsByDay[k] || [];
              return (
                <div>
                  <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="clock" />
                    <span>Eventos del día ({dayEvts.length} programados)</span>
                  </h4>
                  {dayEvts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {dayEvts.map((e, idx) => {
                        const cfg = EVT_CONFIG[e.t] || { label: e.t, color: 'var(--brand)' };
                        const c = Store.get('contracts', e.cid);
                        return (
                          <button
                            type="button"
                            key={idx}
                            className="todo anim-fade-rise w-full text-left hover:shadow-[var(--shadow-2)] focus-visible:shadow-[var(--shadow-2)] motion-safe:hover:-translate-y-0.5"
                            style={{
                              cursor: 'pointer',
                              animationDelay: `${idx * 40}ms`,
                              transition: 'translate var(--t-fast) var(--ease), scale var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease)',
                              border: '1px solid var(--line)',
                              borderRadius: 'var(--r)'
                            }}
                            onClick={() => onSelectContract(e.cid, e.tab)}
                          >
                            <span
                              className="sem"
                              style={{ background: cfg.color, marginTop: '2px' }}
                            ></span>
                            <span className="x">
                              <b>{cfg.label}</b> {c ? `· Contrato ${c.numero}` : ''}
                              <span className="small muted block">{e.txt}</span>
                            </span>
                            <span className="btn sm shrink-0">
                              <Icon name="eye" /> Ver en {e.tab}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty p-4">No hay eventos registrados para este día.</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Surface>

      {/* Eventos del día seleccionado */}
      {selectedDayEvents && (
        <Modal
          title={`Eventos del ${fdate(selectedDayEvents.date)}`}
          onClose={() => setSelectedDayEvents(null)}
          size="md"
          footer={
            <Button className="btn pri" onClick={() => setSelectedDayEvents(null)}>
              Cerrar
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedDayEvents.events.map((e, idx) => {
              const cfg = EVT_CONFIG[e.t] || { label: e.t, color: 'var(--brand)' };
              const c = Store.get('contracts', e.cid);
              return (
                <button
                  type="button"
                  key={idx}
                  className="todo anim-fade-rise w-full text-left hover:shadow-[var(--shadow-2)] focus-visible:shadow-[var(--shadow-2)] motion-safe:hover:-translate-y-0.5"
                  style={{
                    cursor: 'pointer',
                    animationDelay: `${idx * 40}ms`,
                    transition: 'translate var(--t-fast) var(--ease), scale var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease)'
                  }}
                  onClick={() => {
                    setSelectedDayEvents(null);
                    onSelectContract(e.cid, e.tab);
                  }}
                >
                  <span
                    className="sem"
                    style={{ background: cfg.color, marginTop: '2px' }}
                  ></span>
                  <span className="x">
                    <b>{cfg.label}</b> {c ? `· ${c.numero}` : ''}
                    <span className="small muted block">{e.txt}</span>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};
