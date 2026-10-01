export interface VIssue { sev: string; msg: string; }

export const Validator = {
  draft(form: any): VIssue[] {
    const issues: VIssue[] = [];
    if (!form.num) issues.push({ sev: 'Alta', msg: 'Falta el número del contrato' });
    if (!form.obj) issues.push({ sev: 'Media', msg: 'Falta el objeto' });
    return issues;
  },
  contract() { return []; },
  reconcile() { return []; }
};
