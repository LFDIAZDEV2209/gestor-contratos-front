'use client';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';
import { useState } from 'react';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabModificaciones = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const modifications = (Store.byContract('modifications', cid) as Modification[]).sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );

  const [tipo, setTipo] = useState('Adición');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(todayIso());
  const [justificacion, setJustificacion] = useState('');
  const [valorNuevo, setValorNuevo] = useState(m.valorActual);
  const [fechaNueva, setFechaNueva] = useState(c.fechaFin || todayIso());
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [soporte, setSoporte] = useState('');

  const totalAdiciones = modifications
    .filter((x) => x.tipo === 'Adición')
    .reduce((acc, curr) => acc + (Number(curr.valorNuevo) - Number(curr.valorAnterior || 0)), 0);
  const totalReducciones = modifications
    .filter((x) => x.tipo === 'Reducción')
    .reduce((acc, curr) => acc + (Number(curr.valorAnterior || 0) - Number(curr.valorNuevo)), 0);
  const prorrogas = modifications.filter((x) => x.tipo === 'Prórroga');

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Valor nuevo', k: 'valorNuevo', r: (r: any) => (r.valorNuevo ? money(r.valorNuevo) : '—') },
      { l: 'Fecha nueva', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') },
      { l: 'Nuevo valor/texto', k: 'nuevoTexto' }
    ];
    exportRows('Modificaciones - ' + c.numero, cols, modifications, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('editar')) return;
    if (!numero.trim()) return notify('Ingrese el número o identificador de la modificación');
    if (!justificacion.trim()) return notify('Ingrese la justificación de la modificación');

    const before = JSON.parse(JSON.stringify(c));
    const newMod: Modification = {
      id: uid('MD'),
      contractId: cid,
      numero: numero.trim(),
      tipo,
      fecha,
      justificacion,
      soporte: soporte || `mod_${numero.trim()}.pdf`,
      valorAnterior: m.valorActual,
      fechaAnterior: c.fechaFin
    };

    const contractPatch: Partial<Contract> = {};

    if (tipo === 'Adición') {
      const added = Number(valorNuevo) - m.valorActual;
      contractPatch.adiciones = (Number(c.adiciones) || 0) + added;
      newMod.valorNuevo = Number(valorNuevo);
    } else if (tipo === 'Reducción') {
      const reduced = m.valorActual - Number(valorNuevo);
      contractPatch.reducciones = (Number(c.reducciones) || 0) + reduced;
      newMod.valorNuevo = Number(valorNuevo);
    } else if (tipo === 'Prórroga') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = fechaNueva;
      contractPatch.fechaFin = fechaNueva;
      if (c.estado === 'Terminado') contractPatch.estado = 'Activo';
    } else if (tipo === 'Suspensión') {
      contractPatch.estado = 'Suspendido';
    } else if (tipo === 'Reinicio') {
      contractPatch.estado = 'Activo';
      if (fechaNueva) {
        newMod.fechaAnterior = c.fechaFin;
        newMod.fechaNueva = fechaNueva;
        contractPatch.fechaFin = fechaNueva;
      }
    } else if (tipo === 'Cesión') {
      newMod.valorAnterior = 0;
      newMod.impacto = `Cesionario anterior: ${c.contratista}.`;
      contractPatch.contratista = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (tipo === 'Modificación de supervisor') {
      contractPatch.supervisor = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (tipo === 'Terminación anticipada') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = fechaNueva;
      contractPatch.fechaFin = fechaNueva;
      contractPatch.estado = 'Terminado';
    }

    Store.insert('modifications', newMod);
    if (Object.keys(contractPatch).length > 0) {
      Store.update('contracts', cid, contractPatch);
      Audit.diff('Modificaciones', cid, before, { ...c, ...contractPatch }, {
        adiciones: 'Adiciones',
        reducciones: 'Reducciones',
        fechaFin: 'Fecha de terminación',
        estado: 'Estado',
        contratista: 'Contratista',
        supervisor: 'Supervisor'
      });
    }

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (['Adición', 'Prórroga', 'Reinicio'].includes(tipo) && hasGuarantees) {
      setWarningMsg(
        `Revisa las garantías: la ${tipo.toLowerCase()} puede exigir ajustar valor o vigencia de las pólizas.`
      );
    } else {
      setWarningMsg(null);
    }

    setShowModal(false);
    setNumero('');
    setJustificacion('');
    setNuevoTexto('');
    setSoporte('');
  };

  return (
    <Surface className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Modificaciones contractuales</h3>
          <span className="sub">Cada modificación actualiza automáticamente el contrato</span>
        </div>
        <div className="row-flex">
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
      </div>

      <div className="p-4" style={{ paddingBottom: '0' }}>
        <div className="kpis mb">
          <Kpi title="Total modificaciones" value={modifications.length} />
          <Kpi
            title="Total adiciones"
            value={moneyM(totalAdiciones || Number(c.adiciones) || 0)}
            sub={money(totalAdiciones || Number(c.adiciones) || 0)}
            color={totalAdiciones > 0 ? 'ok' : undefined}
          />
          <Kpi
            title="Total reducciones"
            value={moneyM(totalReducciones || Number(c.reducciones) || 0)}
            sub={money(totalReducciones || Number(c.reducciones) || 0)}
            color={totalReducciones > 0 ? 'risk' : undefined}
          />
          <Kpi
            title="Prórrogas"
            value={prorrogas.length}
            sub={
              prorrogas.length > 0 && prorrogas[0].fechaAnterior
                ? `+${diffDays(prorrogas[0].fechaAnterior, c.fechaFin)} días`
                : 'Sin prórrogas'
            }
          />
        </div>
      </div>

      {warningMsg && (
        <div
          className="mx-4 mb-3 p-3"
          style={{
            background: 'var(--warn-s)',
            border: '1px solid var(--warn)',
            borderRadius: '6px',
            color: 'var(--text)',
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
        </div>
      )}

      <TableViewport className="tbl-wrap">
        <DataTable className="tbl">
          <thead>
            <tr>
              <th className="nw">Número</th>
              <th>Tipo</th>
              <th className="nw">Fecha</th>
              <th>Justificación / Impacto</th>
              <th className="nw">Cambio de valor</th>
              <th className="nw">Cambio de plazo</th>
              <th>Nuevo texto</th>
              <th className="nw">Soporte</th>
            </tr>
          </thead>
          <tbody>
            {modifications.map((mItem) => {
              const diffVal =
                mItem.valorNuevo && mItem.valorAnterior
                  ? Number(mItem.valorNuevo) - Number(mItem.valorAnterior)
                  : null;
              const daysExt =
                mItem.fechaNueva && mItem.fechaAnterior
                  ? diffDays(mItem.fechaAnterior, mItem.fechaNueva)
                  : null;
              return (
                <tr key={mItem.id}>
                  <td className="nw">
                    <b>{mItem.numero}</b>
                  </td>
                  <td>
                    <Badge
                      text={mItem.tipo}
                      color={
                        mItem.tipo === 'Adición'
                          ? 'ok'
                          : mItem.tipo === 'Reducción'
                          ? 'warn'
                          : mItem.tipo === 'Suspensión'
                          ? 'crit'
                          : mItem.tipo === 'Reinicio'
                          ? 'brand'
                          : 'default'
                      }
                    />
                  </td>
                  <td className="nw">{fdate(mItem.fecha)}</td>
                  <td className="clip" style={{ maxWidth: '300px' }} title={mItem.justificacion}>
                    {mItem.justificacion}
                    {mItem.impacto && <div className="small muted">{mItem.impacto}</div>}
                  </td>
                  <td className="nw">
                    {mItem.valorNuevo ? (
                      <div>
                        <div>{money(mItem.valorNuevo)}</div>
                        {diffVal != null && (
                          <div
                            className="small"
                            style={{ color: diffVal > 0 ? 'var(--ok)' : 'var(--crit)' }}
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
                    {mItem.fechaNueva ? (
                      <div>
                        <div>{fdate(mItem.fechaNueva)}</div>
                        {daysExt != null && daysExt !== 0 && (
                          <div className="small muted">+{daysExt} días</div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="clip" style={{ maxWidth: '180px' }}>
                    {mItem.nuevoTexto || '—'}
                  </td>
                  <td className="nw">
                    {mItem.soporte ? (
                      <span className="link" title="Ver documento soporte">
                        <Icon name="paperclip" /> {mItem.soporte}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {modifications.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  El contrato no registra modificaciones.
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableViewport>

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
            <div>
              <label className="lbl required">Tipo de modificación</label>
              <Select
                className="inp"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  if (e.target.value === 'Adición' || e.target.value === 'Reducción') {
                    setValorNuevo(m.valorActual);
                  }
                  if (e.target.value === 'Prórroga' || e.target.value === 'Reinicio') {
                    setFechaNueva(c.fechaFin || todayIso());
                  }
                }}
              >
                <option value="Adición">Adición (aumentar valor)</option>
                <option value="Reducción">Reducción (disminuir valor)</option>
                <option value="Prórroga">Prórroga (ampliar plazo)</option>
                <option value="Suspensión">Suspensión de ejecución</option>
                <option value="Reinicio">Reinicio de ejecución</option>
                <option value="Cesión">Cesión contractual (cambio de contratista)</option>
                <option value="Modificación de supervisor">Modificación de supervisor</option>
                <option value="Terminación anticipada">Terminación anticipada</option>
                <option value="Modificación de cláusula">Modificación de cláusula</option>
              </Select>
            </div>
            <div>
              <label className="lbl required">Número / Referencia</label>
              <Input
                className="inp"
                value={numero}
                placeholder="Ej. MOD-01 u OTROSI-01"
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div>
              <label className="lbl required">Fecha</label>
              <Input
                type="date"
                className="inp"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {(tipo === 'Adición' || tipo === 'Reducción') && (
              <>
                <div>
                  <label className="lbl">Valor actual del contrato</label>
                  <Input className="inp" value={money(m.valorActual)} disabled readOnly />
                </div>
                <div>
                  <label className="lbl required">
                    {tipo === 'Adición' ? 'Nuevo valor total (incluyendo adición)' : 'Nuevo valor total reducido'}
                  </label>
                  <Input
                    type="number"
                    className="inp"
                    value={valorNuevo}
                    onChange={(e) => setValorNuevo(Number(e.target.value))}
                  />
                  <div className="small muted mt-1">
                    Diferencia: {tipo === 'Adición' ? '+' : '-'}
                    {money(Math.abs(Number(valorNuevo) - m.valorActual))}
                  </div>
                </div>
              </>
            )}

            {(tipo === 'Prórroga' || tipo === 'Reinicio' || tipo === 'Terminación anticipada') && (
              <>
                <div>
                  <label className="lbl">Fecha de terminación actual</label>
                  <Input className="inp" value={fdate(c.fechaFin)} disabled readOnly />
                </div>
                <div>
                  <label className="lbl required">Nueva fecha de terminación</label>
                  <Input
                    type="date"
                    className="inp"
                    value={fechaNueva}
                    onChange={(e) => setFechaNueva(e.target.value)}
                  />
                  {tipo === 'Prórroga' && fechaNueva && (
                    <div className="small muted mt-1">
                      Días adicionales: +{diffDays(c.fechaFin, fechaNueva)} días
                    </div>
                  )}
                </div>
              </>
            )}

            {tipo === 'Cesión' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl required">Nuevo contratista (Razón social y NIT)</label>
                <Input
                  className="inp"
                  value={nuevoTexto}
                  placeholder="Ej. INGENIERÍA Y CONSTRUCCIONES SAS - NIT 900.123.456-7"
                  onChange={(e) => setNuevoTexto(e.target.value)}
                />
              </div>
            )}

            {tipo === 'Modificación de supervisor' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl required">Nuevo supervisor</label>
                <Input
                  className="inp"
                  value={nuevoTexto}
                  placeholder="Nombre y cargo del nuevo supervisor"
                  onChange={(e) => setNuevoTexto(e.target.value)}
                />
              </div>
            )}

            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl required">Justificación</label>
              <Textarea
                className="inp"
                rows={3}
                value={justificacion}
                placeholder="Motivo y sustento técnico, jurídico o financiero de la modificación..."
                onChange={(e) => setJustificacion(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="lbl">Documento soporte (archivo)</label>
              <Input
                className="inp"
                value={soporte}
                placeholder="Nombre del archivo adjunto (ej. otrosi_01_firmado.pdf)"
                onChange={(e) => setSoporte(e.target.value)}
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </Surface>
  );
};
