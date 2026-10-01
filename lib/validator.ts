// Validador contractual y conciliación documental 1:1 con files/05 y prototipo HTML
import type { Contract, VIssue, Document } from './types';
import { Store } from './store';
import { M } from './metrics';
import { num, money, fdate, pct, diffDays, todayIso, sum } from './format';
import { CLOSED_STATES } from './catalog';

export const Validator = {
  /* Valida un borrador de formulario (datos crudos) — usado en vivo. */
  draft(d: any): VIssue[] {
    const out: VIssue[] = [];
    function add(sev: 'Alta' | 'Media' | 'Baja', campo: string, actual: string | number, esperado: string | number, msg: string, rec?: string) {
      out.push({ sev, campo, actual, esperado, msg, rec });
    }

    const valorBase = num(d.valorBase || d.val);
    const iva = num(d.iva);
    const otrosImp = num(d.otrosImp);
    const tot = valorBase + iva + otrosImp;
    const adiciones = num(d.adiciones);
    const reducciones = num(d.reducciones);

    const fechaFirma = d.fechaFirma || d.signDate;
    const fechaInicio = d.fechaInicio || d.startDate;
    const fechaFin = d.fechaFin || d.endDate;

    if (!d.numero && !d.num) {
      add('Alta', 'Número', 'Vacío', 'Obligatorio', 'Falta el número del contrato.', 'Ingrese el número único del contrato.');
    } else {
      const numero = (d.numero || d.num).trim();
      const dup = Store.all('contracts').find((c: any) => (c.numero === numero || c.num === numero) && c.id !== d.id);
      if (dup) {
        add('Alta', 'Número', numero, 'Único', `Ya existe un contrato registrado con el número «${numero}».`, 'Verifique el número o consulte el contrato existente.');
      }
    }

    if (!d.objeto && !d.obj) {
      add('Media', 'Objeto', 'Vacío', 'Obligatorio', 'Falta el objeto contractual.', 'Describa el objeto del contrato.');
    }

    if (fechaFirma && fechaInicio && fechaInicio < fechaFirma) {
      add(
        'Media',
        'Fecha de inicio',
        fdate(fechaInicio),
        '≥ ' + fdate(fechaFirma),
        '⚠️ Revisar fechas: la fecha de inicio es anterior a la fecha de firma.',
        'Verifique si existe acta de inicio anticipada debidamente justificada.'
      );
    }

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      add(
        'Alta',
        'Fecha de terminación',
        fdate(fechaFin),
        '≥ ' + fdate(fechaInicio),
        '⚠️ Revisar fechas: la fecha de terminación es anterior a la fecha de inicio.',
        'Corrija la fecha de terminación o de inicio.'
      );
    }

    const duracionDias = num(d.duracionDias);
    if (fechaInicio && fechaFin && duracionDias && Math.abs(duracionDias - (diffDays(fechaInicio, fechaFin) + 1)) > 1) {
      add(
        'Media',
        'Duración',
        duracionDias + ' días',
        (diffDays(fechaInicio, fechaFin) + 1) + ' días',
        '⚠️ Duración inconsistente con las fechas registradas.',
        'Ajuste el plazo pactado o la fecha de terminación.'
      );
    }

    if (reducciones > tot + adiciones && reducciones > 0) {
      add(
        'Alta',
        'Reducciones',
        money(reducciones),
        '≤ ' + money(tot + adiciones),
        '⚠️ Inconsistencia detectada: las reducciones superan el valor contractual.',
        'Revise el valor de las reducciones.'
      );
    }

    if (tot > 0 && valorBase > 0 && iva > valorBase * 0.19 + 1) {
      add(
        'Media',
        'IVA',
        money(iva),
        '≤ ' + money(valorBase * 0.19),
        '⚠️ El IVA supera el 19% del valor antes de impuestos.',
        'Verifique la base gravable.'
      );
    }

    const avanceFisico = num(d.avanceFisico);
    if (avanceFisico > 100) {
      add('Alta', 'Ejecución física', pct(avanceFisico), '≤ 100%', '⚠️ La ejecución física no puede superar el 100%.', 'Corrija el avance físico.');
    }

    return out;
  },

  /* Auditoría de consistencia de 13 áreas sobre un contrato guardado. */
  contract(c: Contract): { issues: VIssue[]; areas: Array<{ a: string; ok: boolean }> } {
    const m = M(c);
    const out: VIssue[] = [];
    const checks: Record<string, number> = {};

    function add(area: string, sev: 'Alta' | 'Media' | 'Baja', campo: string, actual: any, esperado: any, msg: string, rec?: string) {
      checks[area] = (checks[area] || 0) + 1;
      out.push({ area, sev, campo, actual, esperado, msg, rec: rec || msg });
    }

    const db = Store.getDB();
    const S = db.settings || { criticalDays: 5, gapPct: 20 };

    // 1. Fechas
    const fechaFirma = c.fechaFirma || c.signDate;
    const fechaInicio = c.fechaInicio || c.startDate;
    const fechaFin = c.fechaFin || c.endDate;

    if (!fechaFirma || !fechaInicio || !fechaFin) {
      add('Fechas', 'Alta', 'Fechas contractuales', 'Incompletas', 'Firma, inicio y terminación', 'Registre las tres fechas del contrato.');
    }
    if (fechaInicio && fechaFirma && fechaInicio < fechaFirma) {
      add('Fechas', 'Media', 'Fecha de inicio', fdate(fechaInicio), '≥ ' + fdate(fechaFirma), 'Justifique el inicio anterior a la firma o corrija la fecha.');
    }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      add('Fechas', 'Alta', 'Fecha de terminación', fdate(fechaFin), '≥ ' + fdate(fechaInicio), 'Corrija la fecha de terminación.');
    }
    if (m.estado === 'Vencido') {
      add('Fechas', 'Alta', 'Estado vs. plazo', 'Activo con plazo vencido', 'Terminado / prorrogado', 'Registre prórroga, terminación o acta de liquidación.');
    }

    // 2. Modificaciones
    const mods = Store.byContract('modifications', c.id);
    const pr = mods.filter((x) => x.tipo === 'Prórroga' && x.fechaNueva).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
    if (pr && pr.fechaNueva !== fechaFin) {
      add('Modificaciones', 'Media', 'Fecha de terminación vs. última prórroga', fdate(fechaFin), fdate(pr.fechaNueva), 'La fecha de terminación no coincide con la última prórroga registrada.');
    }
    mods.filter((x) => x.tipo === 'Suspensión').forEach((s) => {
      if (fechaInicio && fechaFin && (s.fecha < fechaInicio || s.fecha > fechaFin)) {
        add('Modificaciones', 'Media', 'Suspensión ' + s.numero, fdate(s.fecha), 'Entre ' + fdate(fechaInicio) + ' y ' + fdate(fechaFin), 'La suspensión está fuera del periodo de ejecución.');
      }
    });

    // 3. Valores
    const adSum = sum(mods.filter((x) => x.tipo === 'Adición'), (x) => (x.valorNuevo || 0) - (x.valorAnterior || 0));
    const cAdiciones = Number(c.adiciones || 0);
    const cReducciones = Number(c.reducciones || 0);
    if (Math.abs(adSum - cAdiciones) > 1) {
      add('Valores', 'Media', 'Adiciones', money(cAdiciones), money(adSum) + ' (según modificaciones)', 'Las adiciones del contrato no coinciden con las modificaciones registradas.');
    }
    if (m.pctFin > 100) {
      add('Valores', 'Alta', 'Valor ejecutado', money(m.ejecutado), '≤ ' + money(m.valorActual), 'El valor ejecutado supera el valor contractual actualizado. Formalice una adición o ajuste los registros.');
    }
    if (m.pagado > m.valorActual) {
      add('Pagos', 'Alta', 'Valor pagado', money(m.pagado), '≤ ' + money(m.valorActual), 'El valor pagado supera el valor contratado.');
    }
    if (cReducciones > m.valorInicial + cAdiciones) {
      add('Valores', 'Alta', 'Reducciones', money(cReducciones), '≤ ' + money(m.valorInicial + cAdiciones), 'Las reducciones superan el valor contractual.');
    }
    if (m.saldo < 0) {
      add('Valores', 'Alta', 'Saldo', money(m.saldo), '≥ $0', 'Saldo negativo: revise ejecución y adiciones.');
    }
    const mx = m.valorInicial * 0.5;
    if (cAdiciones > mx) {
      add('Valores', 'Media', 'Adiciones', money(cAdiciones), '≤ 50% del valor inicial', 'Las adiciones superan el 50% del valor inicial; verifique el límite interno o legal aplicable.');
    }

    // 4. Porcentajes
    if (m.pctFis > 100) {
      add('Porcentajes', 'Alta', 'Ejecución física', pct(m.pctFis), '≤ 100%', 'Corrija el avance físico.');
    }

    // 5. Ejecución
    if (Math.abs(m.pctFin - m.pctFis) > S.gapPct && m.activo) {
      add('Ejecución', 'Media', 'Ejecución financiera vs. física', pct(m.pctFin) + ' / ' + pct(m.pctFis), 'Diferencia ≤ ' + S.gapPct + '%', 'Revise si hay pagos anticipados o avance físico sin facturar.');
    }
    if (m.activo && m.pctTiempo > 90 && m.pctFis < 70) {
      add('Ejecución', 'Media', 'Avance vs. tiempo', pct(m.pctFis) + ' físico con ' + pct(m.pctTiempo) + ' del plazo', 'Avance acorde al tiempo', 'Evalúe prórroga o plan de choque.');
    }

    // 6. Garantías
    if (!m.garTotal && CLOSED_STATES.indexOf(m.estado) < 0) {
      add('Garantías', 'Alta', 'Garantías', 'Sin garantías', 'Al menos póliza de cumplimiento', 'Registre y apruebe las garantías exigidas.');
    }
    Store.byContract('guarantees', c.id).forEach((g) => {
      if (g.estado === 'Aprobada' && g.fechaVenc < todayIso() && CLOSED_STATES.indexOf(m.estado) < 0) {
        add('Garantías', 'Alta', 'Póliza ' + g.poliza, 'Venció ' + fdate(g.fechaVenc), 'Vigente', 'Solicite la renovación o ampliación de la póliza.');
      }
      if (g.tipo === 'Cumplimiento' && g.estado === 'Aprobada' && fechaFin && g.fechaVenc < fechaFin) {
        add('Garantías', 'Media', 'Vigencia póliza de cumplimiento', fdate(g.fechaVenc), '≥ ' + fdate(fechaFin), 'La póliza de cumplimiento no cubre todo el plazo del contrato.');
      }
      if (g.tipo === 'Cumplimiento' && g.estado === 'Aprobada' && g.porcentaje && g.valor < m.valorActual * g.porcentaje / 100 - 1) {
        add('Garantías', 'Media', 'Valor asegurado ' + g.poliza, money(g.valor), money(m.valorActual * g.porcentaje / 100), 'El valor asegurado no se ajustó a las adiciones del contrato.');
      }
    });

    // 7. Obligaciones
    if (m.oblVencidas) {
      add('Obligaciones', m.oblVencidas >= 3 ? 'Alta' : 'Media', 'Obligaciones vencidas', m.oblVencidas, '0', 'Gestione las obligaciones vencidas y registre evidencias.');
    }
    if (!m.oblTotal) {
      add('Obligaciones', 'Baja', 'Obligaciones', 'Sin registrar', 'Obligaciones del contrato', 'Registre las obligaciones pactadas para su seguimiento.');
    }

    // 8. Pagos
    Store.byContract('payments', c.id).forEach((p) => {
      const calcNeto = (+p.bruto || 0) + (+p.iva || 0) - (+p.retenciones || 0);
      if (Math.abs(calcNeto - (+p.neto || 0)) > 1) {
        add('Pagos', 'Media', 'Pago ' + p.numero, 'Neto ' + money(p.neto), money(calcNeto), 'Recalcule el valor neto.');
      }
      if (p.estado === 'Pagado' && !p.soporte) {
        add('Pagos', 'Baja', 'Soporte ' + p.numero, 'Sin soporte', 'Soporte adjunto', 'Adjunte el soporte del pago.');
      }
    });

    // 9. Documentos
    if (m.docsFaltantes.length) {
      add('Documentos', 'Media', 'Documentos requeridos', m.docsFaltantes.join(', ') + ' faltante(s)', 'Expediente completo', 'Cargue los documentos requeridos.');
    }

    // 10. Subcontratos
    const subs = Store.byContract('subcontracts', c.id);
    const sv = sum(subs, (s) => +s.valor || 0);
    if (sv > m.valorActual) {
      add('Subcontratos', 'Alta', 'Valor subcontratado', money(sv), '≤ ' + money(m.valorActual), 'Los subcontratos superan el valor del contrato principal.');
    }
    subs.forEach((s) => {
      if (fechaFin && s.fechaFin > fechaFin) {
        add('Subcontratos', 'Media', 'Subcontrato ' + s.numero, 'Termina ' + fdate(s.fechaFin), '≤ ' + fdate(fechaFin), 'El subcontrato excede el plazo del contrato principal.');
      }
    });

    // 11. Riesgos
    if (m.riesgosAltos) {
      add('Riesgos', 'Media', 'Riesgos altos abiertos', m.riesgosAltos, 'Con tratamiento en curso', 'Actualice el plan de mitigación.');
    }

    // 12. Incumplimientos
    if (m.incAbiertos) {
      add('Incumplimientos', 'Media', 'Incumplimientos abiertos', m.incAbiertos, '0', 'Haga seguimiento a los planes de acción.');
    }

    // 13. Liquidación
    if (
      (c.estado === 'Terminado' || c.estado === 'En liquidación') &&
      !Store.byContract('actas', c.id).some((a) => a.tipo === 'Acta de liquidación')
    ) {
      add('Liquidación', 'Media', 'Acta de liquidación', 'Pendiente', 'Acta suscrita', 'Adelante el proceso de liquidación.');
    }
    if (c.estado === 'Liquidado' && Math.abs(m.saldo) > 1 && m.saldo > 0) {
      add('Liquidación', 'Baja', 'Saldo por liberar', money(m.saldo), '$0 liberado', 'Libere el saldo presupuestal no ejecutado.');
    }

    const areas = [
      'Fechas',
      'Valores',
      'Porcentajes',
      'Garantías',
      'Obligaciones',
      'Pagos',
      'Documentos',
      'Ejecución',
      'Modificaciones',
      'Subcontratos',
      'Riesgos',
      'Incumplimientos',
      'Liquidación'
    ];
    const sevO: Record<string, number> = { Alta: 3, Media: 2, Baja: 1 };
    out.sort((a, b) => sevO[b.sev] - sevO[a.sev]);

    return {
      issues: out,
      areas: areas.map((a) => ({ a, ok: !checks[a] }))
    };
  },

  /* Conciliación: datos del sistema vs. datos del documento contractual cargado. */
  reconcile(c: Contract): { doc: Document; rows: Array<[string, string, string, boolean]>; diffs: number } | null {
    const m = M(c);
    const doc = Store.byContract('documents', c.id).find((d) => d.categoria === 'Contrato' && d.estado !== 'Anulado');
    if (!doc || !doc.extracted) return null;
    const x = doc.extracted;
    const gtxt = Store.byContract('guarantees', c.id)
      .map((g) => g.tipo)
      .join(', ');

    const rows: Array<[string, string, string, boolean]> = [
      ['Valor', money(x.valor), money(m.valorInicial), Math.abs(num(x.valor) - m.valorInicial) < 1],
      ['Fecha de inicio', fdate(x.fechaInicio), fdate(c.fechaInicio), x.fechaInicio === c.fechaInicio],
      ['Fecha de terminación', fdate(x.fechaFin), fdate(c.fechaFin), x.fechaFin === c.fechaFin],
      ['Plazo', x.plazo + ' días', m.duracion + ' días', +x.plazo! === m.duracion],
      ['Objeto', x.objeto || '', c.objeto || '', String(x.objeto || '').trim() === String(c.objeto || '').trim()],
      [
        'Contratista',
        x.contratista || '',
        c.contratista || '',
        String(x.contratista || '').trim().toLowerCase() === String(c.contratista || '').trim().toLowerCase()
      ],
      [
        'NIT',
        x.nit || '',
        c.nitContratista || '',
        String(x.nit || '').replace(/\D/g, '') === String(c.nitContratista || '').replace(/\D/g, '')
      ],
      ['Garantías', x.garantias || gtxt || '—', gtxt || '—', !x.garantias || x.garantias === gtxt]
    ];

    return {
      doc,
      rows,
      diffs: rows.filter((r) => !r[3]).length
    };
  }
};
