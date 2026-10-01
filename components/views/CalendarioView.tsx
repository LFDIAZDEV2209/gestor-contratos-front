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

const EVT_CONFIG: Record<string, { label: string; color: string }> = {
  inicio: { label: 'Inicio de contrato', color: '#0B6E68' },
  fin: { label: 'Terminación', color: '#BE3A2E' },
  garantia: { label: 'Vencimiento de garantía', color: '#8C6BB1' },
  obligacion: { label: 'Obligación', color: '#D0691A' },
  entregable: { label: 'Entregable', color: '#2F6FA3' },
  pago: { label: 'Pago', color: '#1E8E4E' },
  acta: { label: 'Acta', color: '#6B7F86' },
  auditoria: { label: 'Auditoría', color: '#98A4A8' }
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

  // Compute all calendar events
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

  // Navigation handlers
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

  // Header Title
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

  // Month grid calculation
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startMonday = getMonday(firstDayOfMonth);
  const monthDays: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const cd = new Date(startMonday);
    cd.setDate(startMonday.getDate() + i);
    if (i >= 35 && cd.getMonth() !== currentDate.getMonth()) break;
    monthDays.push(cd);
  }

  // Week days calculation
  const weekStartDay = getMonday(currentDate);
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const cd = new Date(weekStartDay);
    cd.setDate(weekStartDay.getDate() + i);
    weekDays.push(cd);
  }

  const todayStr = todayIso();

  return (
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Calendario contractual</h1>
          <p>Inicios, terminaciones, garantías, obligaciones, entregables, pagos, actas y auditorías</p>
        </div>
        <div className="ph-actions">
          <div className="row-flex" style={{ gap: '4px' }}>
            <Button
              className={`btn sm ${mode === 'mes' ? 'pri' : 'ghost'}`}
              onClick={() => setMode('mes')}
            >
              Mes
            </Button>
            <Button
              className={`btn sm ${mode === 'semana' ? 'pri' : 'ghost'}`}
              onClick={() => setMode('semana')}
            >
              Semana
            </Button>
            <Button
              className={`btn sm ${mode === 'dia' ? 'pri' : 'ghost'}`}
              onClick={() => setMode('dia')}
            >
              Día
            </Button>
          </div>
        </div>
      </PageHeader>

      <Surface className="panel">
        {/* Calendar Toolbar */}
        <div className="panel-h" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="row-flex" style={{ gap: '6px' }}>
            <Button
              className="icon-btn"
              onClick={() => handleNav(-1)}
              aria-label="Anterior"
              title="Anterior"
            >
              <Icon name="chevron-left" />
            </Button>
            <Button className="btn sm" onClick={handleToday}>
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
            <h3 style={{ marginLeft: '10px' }}>{title}</h3>
          </div>

          {/* Interactive Legend */}
          <div className="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.keys(EVT_CONFIG).map((k) => {
              const cfg = EVT_CONFIG[k];
              const isOff = offTypes[k];
              return (
                <span
                  key={k}
                  onClick={() => toggleType(k)}
                  style={{
                    cursor: 'pointer',
                    opacity: isOff ? 0.35 : 1,
                    textDecoration: isOff ? 'line-through' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px'
                  }}
                  title={`Clic para ${isOff ? 'mostrar' : 'ocultar'} ${cfg.label}`}
                >
                  <span className="sem" style={{ background: cfg.color }}></span>
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* View Mode: Mes */}
        {mode === 'mes' && (
          <div className="cal">
            {DH.map((dName) => (
              <div key={dName} className="dh">
                {dName}
              </div>
            ))}
            {monthDays.map((d) => {
              const k = iso(d);
              const isOut = d.getMonth() !== currentDate.getMonth();
              const isToday = k === todayStr;
              const dayEvts: CalEvt[] = eventsByDay[k] || [];

              return (
                <div
                  key={k}
                  className={`d ${isOut ? 'out' : ''} ${isToday ? 'today' : ''}`}
                  style={{ minHeight: '90px' }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className="dn font-bold"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (dayEvts.length > 0) setSelectedDayEvents({ date: k, events: dayEvts });
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {dayEvts.length > 3 && (
                      <span
                        className="small link"
                        onClick={() => setSelectedDayEvents({ date: k, events: dayEvts })}
                        style={{ fontSize: '11px', cursor: 'pointer' }}
                      >
                        +{dayEvts.length - 3} más
                      </span>
                    )}
                  </div>

                  {dayEvts.slice(0, 3).map((e, idx) => {
                    const cfg = EVT_CONFIG[e.t] || { color: '#0B6E68' };
                    return (
                      <span
                        key={idx}
                        className="ev"
                        style={{ borderLeftColor: cfg.color, cursor: 'pointer' }}
                        onClick={() => onSelectContract(e.cid, e.tab)}
                        title={`${cfg.label} · ${e.txt}`}
                      >
                        {e.txt}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode: Semana */}
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
            {weekDays.map((d) => {
              const k = iso(d);
              const isToday = k === todayStr;
              const dayEvts: CalEvt[] = eventsByDay[k] || [];
              return (
                <div
                  key={k}
                  className={`d ${isToday ? 'today' : ''}`}
                  style={{ minHeight: '300px' }}
                >
                  <span className="dn font-bold mb-2 block">{d.getDate()}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dayEvts.map((e, idx) => {
                      const cfg = EVT_CONFIG[e.t] || { color: '#0B6E68' };
                      return (
                        <span
                          key={idx}
                          className="ev"
                          style={{ borderLeftColor: cfg.color, cursor: 'pointer' }}
                          onClick={() => onSelectContract(e.cid, e.tab)}
                          title={`${cfg.label} · ${e.txt}`}
                        >
                          {e.txt}
                        </span>
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

        {/* View Mode: Día */}
        {mode === 'dia' && (
          <div className="p-4">
            {(() => {
              const k = iso(currentDate);
              const dayEvts: CalEvt[] = eventsByDay[k] || [];
              return (
                <div>
                  <h4 style={{ marginBottom: '16px' }}>
                    Eventos del día ({dayEvts.length} programados)
                  </h4>
                  {dayEvts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {dayEvts.map((e, idx) => {
                        const cfg = EVT_CONFIG[e.t] || { label: e.t, color: '#0B6E68' };
                        const c = Store.get('contracts', e.cid);
                        return (
                          <div
                            key={idx}
                            className="todo"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelectContract(e.cid, e.tab)}
                          >
                            <span
                              className="sem"
                              style={{ background: cfg.color, marginTop: '2px' }}
                            ></span>
                            <div className="x">
                              <b>{cfg.label}</b> {c ? `· Contrato ${c.numero}` : ''}
                              <div className="small muted">{e.txt}</div>
                            </div>
                            <Button className="btn sm">Ver en {e.tab}</Button>
                          </div>
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

      {/* Selected Day Events Modal */}
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
              const cfg = EVT_CONFIG[e.t] || { label: e.t, color: '#0B6E68' };
              const c = Store.get('contracts', e.cid);
              return (
                <div
                  key={idx}
                  className="todo"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedDayEvents(null);
                    onSelectContract(e.cid, e.tab);
                  }}
                >
                  <span
                    className="sem"
                    style={{ background: cfg.color, marginTop: '2px' }}
                  ></span>
                  <div className="x">
                    <b>{cfg.label}</b> {c ? `· ${c.numero}` : ''}
                    <div className="small muted">{e.txt}</div>
                  </div>
                  <Icon name="chevron-right" />
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};
