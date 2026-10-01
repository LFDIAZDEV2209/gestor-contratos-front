'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, FormGrid, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

// Hover lift de filas (mismo patrón que ContratosView)
const HOVER_LIFT = {
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
    e.currentTarget.style.position = 'relative';
    e.currentTarget.style.zIndex = '2';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.zIndex = 'auto';
  }
};

export const ModificacionesView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  // Paginación real + guardia de hidratación + refresco tras mutaciones
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Adición',
    numero: '',
    fecha: todayIso(),
    justificacion: '',
    valorNuevo: 0,
    fechaNueva: '',
    nuevoTexto: '',
    soporte: ''
  });

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readAll = (kind: 'modifications' | 'contracts'): any[] => {
    try {
      return Store.all(kind) as any[];
    } catch {
      loadError = 'No fue posible leer el historial de modificaciones del almacenamiento local.';
      return [];
    }
  };

  const allModifications = (readAll('modifications') as Modification[]).slice().sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );
  const allContracts = (readAll('contracts') as Contract[]).filter((c) => !c.anulado);

  const totalMods = allModifications.length;
  const totalAdiciones = allModifications
    .filter((x) => x.tipo === 'Adición')
    .reduce((acc, curr) => acc + (Number(curr.valorNuevo) - Number(curr.valorAnterior || 0)), 0);
  const totalReducciones = allModifications
    .filter((x) => x.tipo === 'Reducción')
    .reduce((acc, curr) => acc + (Number(curr.valorAnterior || 0) - Number(curr.valorNuevo)), 0);
  const totalProrrogas = allModifications.filter((x) => x.tipo === 'Prórroga').length;

  const filtered = allModifications.filter((m) => {
    if (filterTipo && m.tipo !== filterTipo) return false;
    if (filterContract && m.contractId !== filterContract) return false;
    if (q) {
      const matchNum = m.numero.toLowerCase().includes(q.toLowerCase());
      const matchJust = m.justificacion.toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', m.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchNum && !matchJust && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterTipo || filterContract);

  const selectedContract = form.contractId ? Store.get('contracts', form.contractId) : null;
  const selectedMetrics = selectedContract ? M(selectedContract) : null;

  const handleCreate = () => {
    if (!AuthService.guard('editar')) return;
    if (!form.contractId) return notify('Seleccione un contrato');
    if (!form.numero.trim()) return notify('Ingrese el número de la modificación');
    if (!form.justificacion.trim()) return notify('Ingrese la justificación');

    const c = Store.get('contracts', form.contractId);
    if (!c) return;

    const before = JSON.parse(JSON.stringify(c));
    const m = M(c);

    const newMod: Modification = {
      id: uid('MD'),
      contractId: form.contractId,
      numero: form.numero.trim(),
      tipo: form.tipo,
      fecha: form.fecha,
      justificacion: form.justificacion.trim(),
      soporte: form.soporte || `${form.numero.trim()}.pdf`,
      valorAnterior: m.valorActual,
      fechaAnterior: c.fechaFin
    };

    const contractPatch: Partial<Contract> = {};

    if (form.tipo === 'Adición') {
      const added = Number(form.valorNuevo) - m.valorActual;
      contractPatch.adiciones = (Number(c.adiciones) || 0) + added;
      newMod.valorNuevo = Number(form.valorNuevo);
    } else if (form.tipo === 'Reducción') {
      const reduced = m.valorActual - Number(form.valorNuevo);
      contractPatch.reducciones = (Number(c.reducciones) || 0) + reduced;
      newMod.valorNuevo = Number(form.valorNuevo);
    } else if (form.tipo === 'Prórroga') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = form.fechaNueva;
      contractPatch.fechaFin = form.fechaNueva;
      if (c.estado === 'Terminado') contractPatch.estado = 'Activo';
    } else if (form.tipo === 'Suspensión') {
      contractPatch.estado = 'Suspendido';
    } else if (form.tipo === 'Reinicio') {
      contractPatch.estado = 'Activo';
      if (form.fechaNueva) {
        newMod.fechaAnterior = c.fechaFin;
        newMod.fechaNueva = form.fechaNueva;
        contractPatch.fechaFin = form.fechaNueva;
      }
    } else if (form.tipo === 'Cesión') {
      newMod.valorAnterior = 0;
      newMod.impacto = `Cesionario anterior: ${c.contratista}.`;
      contractPatch.contratista = form.nuevoTexto;
      newMod.nuevoTexto = form.nuevoTexto;
    } else if (form.tipo === 'Modificación de supervisor') {
      contractPatch.supervisor = form.nuevoTexto;
      newMod.nuevoTexto = form.nuevoTexto;
    } else if (form.tipo === 'Terminación anticipada') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = form.fechaNueva;
      contractPatch.fechaFin = form.fechaNueva;
      contractPatch.estado = 'Terminado';
    }

    Store.insert('modifications', newMod);
    if (Object.keys(contractPatch).length > 0) {
      Store.update('contracts', form.contractId, contractPatch);
      Audit.diff('Modificaciones', form.contractId, before, { ...c, ...contractPatch }, {
        adiciones: 'Adiciones',
        reducciones: 'Reducciones',
        fechaFin: 'Fecha de terminación',
        estado: 'Estado',
        contratista: 'Contratista',
        supervisor: 'Supervisor'
      });
    }

    const hasGuarantees = Store.byContract('guarantees', form.contractId).length > 0;
    if (['Adición', 'Prórroga', 'Reinicio'].includes(form.tipo) && hasGuarantees) {
      setWarningMsg(
        `Revisa las garantías del contrato ${c.numero}: la ${form.tipo.toLowerCase()} puede exigir ajustar valor o vigencia de las pólizas.`
      );
    }

    setShowModal(false);
    refresh();
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (m: any) => {
          const c = Store.get('contracts', m.contractId);
          return c ? c.numero : m.contractId;
        }
      },
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (m: any) => fdate(m.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      {
        l: 'Efecto en valor',
        k: 'val',
        r: (m: any) => (m.valorNuevo ? money(m.valorNuevo) : '—')
      },
      {
        l: 'Nueva Fecha',
        k: 'fechaNueva',
        r: (m: any) => (m.fechaNueva ? fdate(m.fechaNueva) : '—')
      }
    ];
    exportRows('Modificaciones Contractuales Globales', cols, filtered, format);
  };

  return (
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar las modificaciones.</b> {loadError}
          </div>
        </div>
      ) : (
        <>
      {/* Page Header (variante hero con gradiente de marca) */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r)',
                background: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--surface)',
                display: 'grid',
                placeItems: 'center',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}
            >
              <Icon name="code-compare" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Modificaciones contractuales
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    background: 'rgba(255, 255, 255, 0.18)',
                    color: 'var(--surface)'
                  }}
                >
                  {filtered.length} {filtered.length === 1 ? 'modificación' : 'modificaciones'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Historial de adiciones, prórrogas, suspensiones, reinicios y cesiones con efectos
                automáticos
              </p>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Nueva modificación
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards: Kpi v2 con icono y tono semántico */}
      <div className="kpis mb">
        <Kpi
          label="Total Modificaciones"
          value={totalMods}
          icon="code-compare"
          color="brand"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Total Adiciones"
          value={moneyM(totalAdiciones)}
          sub={money(totalAdiciones)}
          icon="plus"
          color={totalAdiciones > 0 ? 'ok' : 'na'}
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Total Reducciones"
          value={moneyM(totalReducciones)}
          sub={money(totalReducciones)}
          icon="scale-balanced"
          color={totalReducciones > 0 ? 'warn' : 'na'}
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Prórrogas Suscritas"
          value={totalProrrogas}
          icon="calendar-days"
          color="info"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {warningMsg && (
        <Surface
          className="panel mb p-3"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn)',
            color: 'var(--warn-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Icon name="triangle-exclamation" />
          <span>{warningMsg}</span>
          <Button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setWarningMsg(null)}>
            Entendido
          </Button>
        </Surface>
      )}

      {/* Table Panel */}
      <Surface className="panel">
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar modificaciones"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por justificación, número o contrato..."
            />
          </div>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterContract}
              aria-label="Filtrar por contrato"
              onChange={(e) => {
                setFilterContract(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los contratos —</option>
              {allContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterTipo}
              aria-label="Filtrar por tipo de modificación"
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los tipos —</option>
              <option value="Adición">Adición</option>
              <option value="Reducción">Reducción</option>
              <option value="Prórroga">Prórroga</option>
              <option value="Suspensión">Suspensión</option>
              <option value="Reinicio">Reinicio</option>
              <option value="Cesión">Cesión</option>
              <option value="Modificación de supervisor">Modificación de supervisor</option>
              <option value="Terminación anticipada">Terminación anticipada</option>
            </Select>
          </Field>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th className="nw">Número</th>
                <th>Tipo</th>
                <th className="nw">Fecha</th>
                <th>Justificación / Impacto</th>
                <th className="nw">Cambio de Valor</th>
                <th className="nw">Cambio de Plazo</th>
                <th>Nuevo Texto</th>
                <th className="nw">Soporte</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m, idx) => {
                const c = Store.get('contracts', m.contractId);
                const diffVal =
                  m.valorNuevo && m.valorAnterior
                    ? Number(m.valorNuevo) - Number(m.valorAnterior)
                    : null;
                const daysExt =
                  m.fechaNueva && m.fechaAnterior
                    ? diffDays(m.fechaAnterior, m.fechaNueva)
                    : null;

                return (
                  <tr
                    key={m.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'modificaciones')}
                          style={{ cursor: 'pointer' }}
                          title="Abrir expediente del contrato"
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      <b>{m.numero}</b>
                    </td>
                    <td>
                      <Badge
                        text={m.tipo}
                        color={
                          m.tipo === 'Adición'
                            ? 'ok'
                            : m.tipo === 'Reducción'
                            ? 'warn'
                            : m.tipo === 'Suspensión'
                            ? 'crit'
                            : m.tipo === 'Reinicio'
                            ? 'brand'
                            : 'default'
                        }
                      />
                    </td>
                    <td className="nw">{fdate(m.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '280px' }} title={m.justificacion}>
                      {m.justificacion}
                      {m.impacto && <div className="small muted">{m.impacto}</div>}
                    </td>
                    <td className="nw">
                      {m.valorNuevo ? (
                        <div>
                          <div>{money(m.valorNuevo)}</div>
                          {diffVal != null && (
                            <div
                              className="small"
                              style={{
                                color: diffVal > 0 ? 'var(--ok-text)' : 'var(--crit-text)',
                                fontWeight: 600
                              }}
                            >
                              {diffVal > 0 ? '+' : ''}
                              {money(diffVal)}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      {m.fechaNueva ? (
                        <div>
                          <div>{fdate(m.fechaNueva)}</div>
                          {daysExt != null && daysExt !== 0 && (
                            <div className="small muted">+{daysExt} días</div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="clip" style={{ maxWidth: '160px' }}>
                      {m.nuevoTexto || '—'}
                    </td>
                    <td className="nw">
                      {m.soporte ? (
                        <span className="link">
                          <Icon name="paperclip" /> {m.soporte}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nw">
                      {c && (
                        <Button
                          className="btn sm"
                          onClick={() => onSelectContract(c.id, 'modificaciones')}
                        >
                          Expediente
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No se encontraron modificaciones"
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda o el tipo/contrato filtrado para ver más resultados.'
                          : 'Cuando se registren adiciones, prórrogas u otrosíes aparecerán aquí.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button
                            className="btn sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              setQ('');
                              setFilterTipo('');
                              setFilterContract('');
                              setPage(1);
                            }}
                          >
                            <Icon name="trash" /> Restablecer filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={10}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> modificaciones
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <Button key={p} className={p === currentPage ? 'on' : ''} onClick={() => setPage(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Página siguiente"
                        >
                          &gt;
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal for New Modification */}
      {showModal && (
        <Modal
          title="Nueva modificación contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="save" /> Aplicar modificación
              </Button>
            </>
          }
        >
          <FormGrid className="grid g-2" style={{ gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Contrato</label>
              <Select
                className="inp"
                value={form.contractId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const c = Store.get('contracts', cid);
                  const m = c ? M(c) : null;
                  setForm({
                    ...form,
                    contractId: cid,
                    valorNuevo: m ? m.valorActual : 0,
                    fechaNueva: c?.fechaFin || todayIso()
                  });
                }}
              >
                <option value="">— Seleccione contrato —</option>
                {allContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.contratista} · {moneyM(M(c).valorActual)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="lbl required">Tipo de modificación</label>
              <Select
                className="inp"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="Adición">Adición (aumentar valor)</option>
                <option value="Reducción">Reducción (disminuir valor)</option>
                <option value="Prórroga">Prórroga (ampliar plazo)</option>
                <option value="Suspensión">Suspensión</option>
                <option value="Reinicio">Reinicio</option>
                <option value="Cesión">Cesión contractual</option>
                <option value="Modificación de supervisor">Modificación de supervisor</option>
                <option value="Terminación anticipada">Terminación anticipada</option>
              </Select>
            </div>

            <div>
              <label className="lbl required">Número / Referencia</label>
              <Input
                className="inp"
                value={form.numero}
                placeholder="Ej. MOD-01 u OTROSI-01"
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>

            <div>
              <label className="lbl required">Fecha</label>
              <Input
                type="date"
                className="inp"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>

            {(form.tipo === 'Adición' || form.tipo === 'Reducción') && (
              <>
                {/* Field explícito: FormGrid no recorre fragmentos y dejaría el label sin asociar */}
                <Field className="f">
                  <label className="lbl">Valor actual</label>
                  <Input
                    className="inp"
                    value={selectedMetrics ? money(selectedMetrics.valorActual) : '—'}
                    disabled
                    readOnly
                  />
                </Field>
                <Field className="f">
                  <label className="lbl required">Nuevo valor total resultante</label>
                  <Input
                    type="number"
                    className="inp"
                    value={form.valorNuevo}
                    onChange={(e) => setForm({ ...form, valorNuevo: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}

            {(form.tipo === 'Prórroga' || form.tipo === 'Reinicio' || form.tipo === 'Terminación anticipada') && (
              <>
                <Field className="f">
                  <label className="lbl">Fecha fin actual</label>
                  <Input
                    className="inp"
                    value={selectedContract?.fechaFin ? fdate(selectedContract.fechaFin) : '—'}
                    disabled
                    readOnly
                  />
                </Field>
                <Field className="f">
                  <label className="lbl required">Nueva fecha de terminación</label>
                  <Input
                    type="date"
                    className="inp"
                    value={form.fechaNueva}
                    onChange={(e) => setForm({ ...form, fechaNueva: e.target.value })}
                  />
                </Field>
              </>
            )}

            {form.tipo === 'Cesión' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl required">Nuevo contratista (Razón social y NIT)</label>
                <Input
                  className="inp"
                  value={form.nuevoTexto}
                  placeholder="Ej. NUEVA EMPRESA SAS - NIT 901.000.000-1"
                  onChange={(e) => setForm({ ...form, nuevoTexto: e.target.value })}
                />
              </div>
            )}

            {form.tipo === 'Modificación de supervisor' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl required">Nuevo supervisor</label>
                <Input
                  className="inp"
                  value={form.nuevoTexto}
                  placeholder="Nombre y cargo del nuevo supervisor"
                  onChange={(e) => setForm({ ...form, nuevoTexto: e.target.value })}
                />
              </div>
            )}

            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Justificación</label>
              <Textarea
                className="inp"
                rows={2}
                value={form.justificacion}
                placeholder="Motivo técnico o jurídico de la modificación..."
                onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Documento soporte (archivo)</label>
              <Input
                className="inp"
                value={form.soporte}
                placeholder="Nombre del archivo adjunto (ej. otrosi_01.pdf)"
                onChange={(e) => setForm({ ...form, soporte: e.target.value })}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
        </>
      )}
    </div>
  );
};
