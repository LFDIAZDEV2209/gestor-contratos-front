'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { PBar } from '../ui/PBar';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';
import { obligationPresentation } from '../ui/presentation';
import type { Obligation, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, diffDays, todayIso } from '../../lib/format';
import { contractHref } from '../app/routes';

/**
 * FICHA dedicada de obligación (consulta y seguimiento). Sustituye al modal de
 * detalle que vivía dentro de ObligacionesView y se sirve en la ruta ya
 * existente /obligaciones/[id]. Conserva íntegras las reglas del handler
 * original: verificación con permiso de aprobación, checklist que recalcula el
 * cumplimiento y bitácora de observaciones.
 */
export const ObligacionFicha = ({ id }: { id: string }) => {
  const router = useRouter();
  // Guardia de hidratación: el store vive en localStorage
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [newComment, setNewComment] = useState('');
  // Acciones que mutan el Store marcan el refresco de la ficha
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <WorkspaceSkeleton />;

  return (
    <ObligacionFichaContent
      id={id}
      tick={tick}
      refresh={refresh}
      newComment={newComment}
      setNewComment={setNewComment}
      onBack={() => router.push('/obligaciones')}
    />
  );
};

const ObligacionFichaContent = ({
  id,
  refresh,
  newComment,
  setNewComment,
  onBack
}: {
  id: string;
  tick: number;
  refresh: () => void;
  newComment: string;
  setNewComment: (v: string) => void;
  onBack: () => void;
}) => {
  const raw = Store.get('obligations', id) as Obligation | undefined;
  const ob = raw ? obligationPresentation(raw) : null;

  if (!ob) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Obligación no encontrada"
          description="El registro ya no existe o fue retirado del sistema."
          action={
            <Button className="btn pri" onClick={onBack} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Obligaciones
            </Button>
          }
        />
      </div>
    );
  }

  const c = Store.get('contracts', ob.contractId) as Contract | undefined;
  const eff = effOblig(ob);
  const cumplimiento = Number(ob.cumplimiento) || 0;
  const vencidaEff = eff === 'Vencida' || eff === 'Incumplida';
  // Días restantes (negativo si ya pasó la fecha límite)
  const diasRestantes = diffDays(todayIso(), ob.fechaLimite);

  const handleVerify = async () => {
    if (!AuthService.guard('aprobar')) return;
    // La verificación es una acción crítica: se confirma y advierte si el
    // checklist aún no respalda el 100 % (misma regla de confirmación del resto
    // de transiciones financieras).
    if (cumplimiento < 100) {
      const ok = await confirmAction(
        `La obligación registra ${pct(cumplimiento, 0)} de cumplimiento (checklist y evidencias). ¿Verificar igual y marcar «Cumplida» al 100 %? La acción quedará registrada en auditoría.`
      );
      if (!ok) return;
    }
    const u = AuthService.currentUser();
    Store.update('obligations', ob.id, {
      estado: 'Cumplida',
      cumplimiento: 100,
      verificadoPor: u.nombre,
      verificadoFecha: todayIso()
    });
    Audit.log({
      contractId: ob.contractId,
      modulo: 'Obligaciones',
      accion: 'Aprobación',
      campo: 'Verificación de obligación ' + ob.id,
      anterior: ob.estado,
      nuevo: 'Cumplida (100%)'
    });
    refresh();
    notify('Obligación verificada: cumplimiento al 100 %.');
  };

  // Crea de verdad el checklist estándar en el Store
  const handleCreateChecklist = () => {
    if (!AuthService.guard('editar')) return;
    const base = [
      { id: `${ob.id}-chk-1`, texto: 'Revisión y verificación técnica del entregable', listo: false },
      { id: `${ob.id}-chk-2`, texto: 'Aporte de soportes documentales y actas', listo: false },
      { id: `${ob.id}-chk-3`, texto: 'Visto bueno del supervisor técnico', listo: false }
    ];
    Store.update('obligations', ob.id, { checklist: base });
    Audit.log({
      contractId: ob.contractId,
      modulo: 'Obligaciones',
      accion: 'Edición',
      campo: 'Checklist de obligación ' + ob.id,
      nuevo: 'Checklist estándar creado (3 ítems)'
    });
    refresh();
    notify('Checklist estándar creado (3 ítems).');
  };

  const handleToggleChecklist = (checkId: string) => {
    const list = ob.checklist || [];
    const updated = list.map((item) => (item.id === checkId ? { ...item, listo: !item.listo } : item));
    const completedCount = updated.filter((i) => i.listo).length;
    const autoCumpl = updated.length
      ? Math.round((completedCount / updated.length) * 100)
      : cumplimiento;

    Store.update('obligations', ob.id, {
      checklist: updated,
      cumplimiento: autoCumpl,
      estado: autoCumpl === 100 ? 'Cumplida' : autoCumpl > 0 ? 'En proceso' : 'Pendiente'
    });
    refresh();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const u = AuthService.currentUser();
    const commentItem = {
      id: 'c_' + Date.now(),
      usuario: u.nombre,
      fecha: todayIso(),
      texto: newComment.trim()
    };
    const updated = [...(ob.comentarios || []), commentItem];
    Store.update('obligations', ob.id, { comentarios: updated });
    setNewComment('');
    refresh();
    notify('Observación registrada en la bitácora.');
  };

  return (
    <div className="anim-fade-rise" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/obligaciones">Obligaciones</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>{ob.id}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, flexWrap: 'wrap' }}>
            Ficha de obligación
            <Badge
              text={eff}
              color={eff === 'Cumplida' ? 'ok' : vencidaEff ? 'crit' : eff === 'En proceso' ? 'info' : 'warn'}
            />
          </h1>
          <p style={{ margin: '4px 0 0' }}>{ob.descripcion}</p>
        </div>
        <div className="ph-actions">
          {ob.estado !== 'Cumplida' && AuthService.can('aprobar') && (
            <Button className="btn sm pri" onClick={handleVerify}>
              <Icon name="check-circle" /> Aprobar cumplimiento
            </Button>
          )}
          <Button className="btn sm ghost" onClick={onBack}>
            Volver al listado
          </Button>
        </div>
      </PageHeader>

      {/* Contexto y seguimiento */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="list-check" /> Contexto de la obligación
            </h3>
            <span className="sub small muted">
              {c ? (
                <Link className="link" href={contractHref(c.id, 'obligaciones')} title="Abrir expediente del contrato">
                  {c.numero} · {c.contratista}
                </Link>
              ) : (
                'Sin contrato asociado'
              )}
            </span>
          </div>
        </div>

        <div className="g4 mb">
          <div>
            <span className="small muted">Tipo</span>
            <div><span className="badge b-info">{ob.tipo}</span></div>
          </div>
          <div>
            <span className="small muted">Periodicidad</span>
            <div style={{ fontWeight: 600 }}>{ob.periodicidad || '—'}</div>
          </div>
          <div>
            <span className="small muted">Responsable</span>
            <div style={{ fontWeight: 600 }}>{ob.responsable}</div>
          </div>
          <div>
            <span className="small muted">Fecha límite</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fdate(ob.fechaLimite)}</span>
              {vencidaEff ? (
                <span className="badge b-crit">
                  <Icon name="triangle-exclamation" size={11} /> Vencida
                </span>
              ) : ob.estado !== 'Cumplida' ? (
                <span className="badge b-warn">
                  {diasRestantes >= 0 ? `${diasRestantes} día${diasRestantes === 1 ? '' : 's'} restantes` : 'Fecha límite superada'}
                </span>
              ) : undefined}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <span className="small muted">Cumplimiento del compromiso</span>
          <PBar
            value={cumplimiento}
            color={cumplimiento >= 100 ? 'var(--ok)' : cumplimiento >= 50 ? 'var(--warn)' : vencidaEff ? 'var(--crit)' : 'var(--brand)'}
          />
        </div>

          {ob.verificadoPor && (
            <div style={{ marginTop: 10 }}>
              <span className="badge b-ok">
                <Icon name="check-circle" size={11} /> Verificada por {ob.verificadoPor} ({fdate(ob.verificadoFecha)})
              </span>
            </div>
          )}
      </Surface>

      {/* Checklist */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="clipboard-check" /> Checklist de actividades ({ob.checklist?.length || 0})
            </h3>
            <span className="sub small muted">Cada ítem marcado recalcula el cumplimiento de la obligación</span>
          </div>
        </div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(ob.checklist || []).map((chk) => (
            <label
              key={chk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <Input
                type="checkbox"
                checked={chk.listo}
                onChange={() => handleToggleChecklist(chk.id)}
              />
              <span style={{ textDecoration: chk.listo ? 'line-through' : 'none' }}>{chk.texto}</span>
            </label>
          ))}
          {(!ob.checklist || ob.checklist.length === 0) && (
            <EmptyState
              title="Sin checklist de verificación"
              description="Crea el checklist estándar (revisión técnica, soportes documentales y visto bueno del supervisor) para registrar el avance."
              action={
                AuthService.can('editar') ? (
                  <Button className="btn sm pri" style={{ marginTop: 8 }} onClick={handleCreateChecklist}>
                    <Icon name="list-check" /> Crear checklist base
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </Surface>

      {/* Bitácora */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="comment" /> Bitácora y comentarios ({ob.comentarios?.length || 0})
            </h3>
            <span className="sub small muted">Historial de gestiones y observaciones del equipo</span>
          </div>
        </div>
        <div className="panel-b">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {(ob.comentarios || []).map((com) => (
              <div
                key={com.id}
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-sub)',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <div className="flex justify-between text-muted-foreground mb-1">
                  <b>{com.usuario}</b>
                  <span>{fdate(com.fecha)}</span>
                </div>
                <div>{com.texto}</div>
              </div>
            ))}
            {(!ob.comentarios || ob.comentarios.length === 0) && (
              <div className="small muted" style={{ marginBottom: 8 }}>
                Sin observaciones adicionales registradas.
              </div>
            )}
          </div>

          <div className="row-flex" style={{ gap: '8px' }}>
            <Input
              className="inp sm"
              placeholder="Escribir comentario u observación..."
              aria-label="Nuevo comentario de la obligación"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddComment();
              }}
            />
            <Button className="btn sm pri" onClick={handleAddComment}>
              Agregar
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
};
