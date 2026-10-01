// Motor de alertas con claves estables y gestión persistente según files/05 y prototipo HTML
import type { Alert, Contract } from './types';
import { Store, AuthService } from './store';
import { M, effOblig, effDeliv, cupoStats, activeContracts } from './metrics';
import { diffDays, todayIso, fdate, money, pct, nowStamp } from './format';
import { CLOSED_STATES, ALV } from './catalog';

export const Alerts = {
  compute(): Alert[] {
    const out: Alert[] = [];
    const db = Store.getDB();
    const S = db.settings || { alertDays: [30, 15, 10, 5, 3, 1], criticalDays: 5, budgetPct: 15 };

    function thr(d: number): number | null {
      if (d < 0) return null;
      const days = S.alertDays || [30, 15, 10, 5, 3, 1];
      for (let i = 0; i < days.length; i++) {
        if (d <= days[i]) return days[i];
      }
      return null;
    }

    function lvlFor(d: number): 'critica' | 'riesgo' | 'proxima' {
      return d <= S.criticalDays ? 'critica' : d <= 15 ? 'riesgo' : 'proxima';
    }

    function add(
      key: string,
      nivel: 'critica' | 'riesgo' | 'proxima' | 'info',
      tipo: string,
      c: Contract | null,
      descripcion: string,
      fecha: string,
      responsable: string,
      act: string
    ) {
      out.push({
        key,
        nivel,
        tipo,
        contractId: c ? c.id : null,
        numero: c ? (c.numero || c.num || '') : '',
        descripcion,
        fecha: fecha || todayIso(),
        responsable: responsable || (c ? c.responsable : 'Gestión contractual'),
        act,
        estado: 'Nueva'
      });
    }

    activeContracts().forEach((c) => {
      const m = M(c);
      if (m.activo && m.restantes != null && m.restantes >= 0) {
        const t = thr(m.restantes);
        if (t != null) {
          const l = lvlFor(m.restantes);
          const msg =
            m.restantes === 0
              ? 'El contrato vence hoy.'
              : `El contrato vence en ${m.restantes} ${m.restantes === 1 ? 'día' : 'días'} (umbral ${t} días).`;
          add(`venc|${c.id}|${t}`, l, 'Vencimiento de contrato', c, msg, c.fechaFin || '', c.responsable, `contrato:${c.id}`);
        }
      }

      if (m.estado === 'Vencido') {
        add(
          `vencido|${c.id}`,
          'critica',
          'Contrato vencido',
          c,
          `El plazo venció el ${fdate(c.fechaFin)} (${Math.abs(m.restantes || 0)} días) y no registra terminación ni prórroga.`,
          c.fechaFin || '',
          c.responsable,
          `contrato:${c.id}`
        );
      }

      if (CLOSED_STATES.indexOf(m.estado) < 0) {
        Store.byContract('guarantees', c.id).forEach((g) => {
          if (g.estado !== 'Aprobada') return;
          const d = diffDays(todayIso(), g.fechaVenc);
          if (d < 0) {
            add(
              `garv|${g.id}`,
              'critica',
              'Garantía vencida',
              c,
              `Póliza ${g.poliza} (${g.tipo}) venció el ${fdate(g.fechaVenc)}.`,
              g.fechaVenc,
              c.responsable,
              `contrato:${c.id}:garantias`
            );
          } else {
            const t2 = thr(d);
            if (t2 != null) {
              add(
                `gar|${g.id}|${t2}`,
                lvlFor(d),
                'Garantía próxima a vencer',
                c,
                `Póliza ${g.poliza} (${g.tipo}, ${g.aseguradora}) vence en ${d} ${d === 1 ? 'día.' : 'días.'}`,
                g.fechaVenc,
                c.responsable,
                `contrato:${c.id}:garantias`
              );
            }
          }
        });
      }

      Store.byContract('obligations', c.id).forEach((o) => {
        const e = effOblig(o);
        if (e === 'Vencida' || e === 'Incumplida') {
          add(
            `obl|${o.id}`,
            e === 'Incumplida' ? 'critica' : 'riesgo',
            'Obligación vencida',
            c,
            (e === 'Incumplida' ? 'Obligación incumplida: ' : `Obligación vencida el ${fdate(o.fechaLimite)}: `) + o.descripcion,
            o.fechaLimite,
            o.responsable,
            `contrato:${c.id}:obligaciones`
          );
        }
      });

      Store.byContract('deliverables', c.id).forEach((d) => {
        if (effDeliv(d) === 'Vencido') {
          add(
            `ent|${d.id}`,
            'riesgo',
            'Entregable vencido',
            c,
            `Entregable «${d.nombre}» programado para el ${fdate(d.fechaProg)} sin entrega.`,
            d.fechaProg,
            d.responsable || c.responsable,
            `contrato:${c.id}:entregables`
          );
        }
      });

      Store.byContract('payments', c.id).forEach((p) => {
        if (p.estado === 'Pendiente' || p.estado === 'En revisión') {
          add(
            `pag|${p.id}|${p.estado}`,
            'info',
            'Pago pendiente',
            c,
            `Pago ${p.numero} (${money(p.neto)}) en estado ${p.estado.toLowerCase()}.`,
            p.fecha,
            'Andrés Gómez',
            `contrato:${c.id}:pagos`
          );
        }
      });

      if (m.pctFin > 100) {
        add(
          `ejec|${c.id}`,
          'critica',
          'Ejecución superior al límite',
          c,
          `El valor ejecutado (${money(m.ejecutado)}) supera el valor actualizado (${money(m.valorActual)}).`,
          todayIso(),
          c.responsable,
          `contrato:${c.id}:ejecucion`
        );
      } else if (m.activo && m.pctSaldo < S.budgetPct) {
        add(
          `ppto|${c.id}`,
          'riesgo',
          'Presupuesto próximo a agotarse',
          c,
          `El contrato está próximo a agotar sus recursos: saldo de ${money(m.saldo)} (${pct(m.pctSaldo)}).`,
          todayIso(),
          c.responsable,
          `contrato:${c.id}:ejecucion`
        );
      }

      Store.byContract('breaches', c.id).forEach((b) => {
        if (b.estado !== 'Cerrado' && b.estado !== 'Subsanado') {
          add(
            `inc|${b.id}`,
            b.impacto === 'Alto' ? 'critica' : 'riesgo',
            'Incumplimiento abierto',
            c,
            `${b.tipo}: ${b.descripcion}`,
            b.fecha,
            b.responsable || c.responsable,
            `contrato:${c.id}:incumplimientos`
          );
        }
      });

      if (m.docsFaltantes.length && m.estado !== 'Borrador') {
        add(
          `doc|${c.id}|${m.docsFaltantes.join(',')}`,
          'info',
          'Documento faltante',
          c,
          `Faltan en el expediente: ${m.docsFaltantes.join(', ')}.`,
          todayIso(),
          c.responsable,
          `contrato:${c.id}:documentos`
        );
      }
    });

    Store.all('cupos').forEach((cp) => {
      if (cp.estado !== 'Vigente') return;
      const st = cupoStats(cp);
      const d = diffDays(todayIso(), cp.fechaVenc);
      const lab = 'Cupo ' + cp.numero;
      const n0 = out.length;

      if (st.pct > 100) {
        add(
          `cupox|${cp.id}`,
          'critica',
          'Cupo de póliza excedido',
          null,
          `${cp.aseguradora}: el cupo ${cp.numero} está utilizado al ${pct(st.pct)} (excede en ${money(-st.disponible)}).`,
          todayIso(),
          'Andrés Gómez',
          'view:aseguradoras'
        );
      } else if (st.pct >= 85) {
        add(
          `cupo85|${cp.id}`,
          'riesgo',
          'Cupo de póliza próximo a agotarse',
          null,
          `${cp.aseguradora}: el cupo ${cp.numero} está utilizado al ${pct(st.pct)}; disponible ${money(st.disponible)}.`,
          todayIso(),
          'Andrés Gómez',
          'view:aseguradoras'
        );
      }

      if (d < 0) {
        add(
          `cupov|${cp.id}`,
          'critica',
          'Cupo de póliza vencido',
          null,
          `El cupo ${cp.numero} de ${cp.aseguradora} venció el ${fdate(cp.fechaVenc)} y sigue marcado como vigente.`,
          cp.fechaVenc,
          'Andrés Gómez',
          'view:aseguradoras'
        );
      } else {
        const t3 = thr(d);
        if (t3 != null) {
          add(
            `cupod|${cp.id}|${t3}`,
            lvlFor(d),
            'Vigencia de cupo por vencer',
            null,
            `El cupo ${cp.numero} de ${cp.aseguradora} vence en ${d} días (${st.polizas.length} pólizas asociadas).`,
            cp.fechaVenc,
            'Andrés Gómez',
            'view:aseguradoras'
          );
        }
      }

      for (let i = n0; i < out.length; i++) {
        out[i].numero = lab;
      }
    });

    const alertState = db.alertState || {};
    out.forEach((a) => {
      const st = alertState[a.key] || {};
      a.estado = st.estado || 'Nueva';
      a.delegadoA = st.delegadoA || '';
      if (a.delegadoA) a.responsable = a.delegadoA;
      a.gestion = st;
    });

    out.sort((a, b) => {
      const oa = ALV[a.nivel]?.o || 0;
      const ob = ALV[b.nivel]?.o || 0;
      return ob - oa || (a.fecha < b.fecha ? 1 : -1);
    });

    return out;
  },

  list(): Alert[] {
    return Alerts.compute();
  },

  open(): Alert[] {
    return Alerts.compute().filter((a) => a.estado !== 'Resuelta');
  },

  setState(key: string, patch: { estado?: string; delegadoA?: string; nota?: string }) {
    const db = Store.getDB();
    if (!db.alertState) db.alertState = {};
    const s = db.alertState[key] || {};
    Object.assign(s, patch);
    s.fechaGestion = nowStamp();
    s.usuario = AuthService.currentUser().nombre;
    db.alertState[key] = s;
    Store.persist();
  }
};

export const NotificationService = {
  email(to: string, subject: string, body: string) {
    return Promise.resolve({ ok: true, canal: 'email', to, subject, body });
  },
  whatsapp(phone: string, text: string) {
    return Promise.resolve({ ok: true, canal: 'whatsapp', to: phone, text });
  },
  push(userId: string, payload: any) {
    return Promise.resolve({ ok: true, userId, payload });
  }
};
