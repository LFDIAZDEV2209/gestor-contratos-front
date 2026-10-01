import type { DB, User, Company, Contract, SubContract, Obligation, Deliverable, Exec, Payment, Guarantee, Acta, Modification, Risk, Breach, Plan, Document, Cupo } from './types';
import { iso, addDays } from './format';

export const Seed = {
  build(): DB {
    const today = new Date();
    const tIso = iso(today);
    
    const users: User[] = [{ id: 'u1', name: 'Admin', role: 'Admin', perms: ['admin'], initials: 'AD' }];
    
    const companies: Company[] = [
      { id: 'c1', nit: '800123456', name: 'Empresa 1', rep: 'Rep 1', type: 'Privada', level: '1', status: 'Activo', risk: 0 }
    ];

    const contracts: Contract[] = Array.from({ length: 10 }).map((_, i) => {
      let status = 'Activo';
      let endD = addDays(tIso, 100 + i*10);
      let valE = 50000000;
      
      // H3 Verification rules:
      if (i === 0) endD = addDays(tIso, 5); // CT-01 Crítico
      if (i === 2) endD = addDays(tIso, -10); // CT-03 Vencido
      if (i === 7) status = 'Liquidado'; // CT-08 Normal
      if (i === 8) valE = 200000000; // CT-09 ejecución > 100%

      return {
        id: `CT-0${i+1}`, num: `CT-0${i+1}`, obj: 'Contrato de prueba ' + (i+1), status,
        signDate: addDays(tIso, -100 - i*10), startDate: addDays(tIso, -90 - i*10), endDate: endD,
        val: 150000000, valExec: valE, cur: 'COP', supervisor: 'u1', company: 'c1', depto: 'CUN', type: 'Obra'
      };
    });

    const subcontracts: SubContract[] = [];
    const obligations: Obligation[] = [{ id: 'ob1', contractId: 'CT-01', desc: 'Obligación 1', freq: 'Mensual', status: 'Activo', due: tIso, type: 'General' }];
    const deliverables: Deliverable[] = [{ id: 'dl1', contractId: 'CT-01', name: 'Entregable 1', due: addDays(tIso, 10), status: 'Pendiente', val: 1000 }];
    const guarantees: Guarantee[] = [{ id: 'g1', contractId: 'CT-01', type: 'Cumplimiento', issuer: 'Seguros', num: '123', val: 1000, from: tIso, to: addDays(tIso, 100), status: 'Activa' }];
    const actas: Acta[] = [{ id: 'ac1', contractId: 'CT-01', type: 'Inicio', date: tIso, status: 'Firmada', by: 'u1' }];
    const modifications: Modification[] = [{ id: 'mod1', contractId: 'CT-01', type: 'Adición', date: tIso, valChange: 100, daysChange: 0, obs: '' }];
    const risks: Risk[] = [{ id: 'r1', contractId: 'CT-01', type: 'Financiero', prob: 4, impact: 4, score: 16, status: 'Abierto', mitig: '' }];
    const breaches: Breach[] = [{ id: 'br1', contractId: 'CT-01', date: tIso, desc: 'Fallo', severity: 'Alta', status: 'Abierto', penalty: 100 }];
    const plans: Plan[] = [];
    const documents: Document[] = [{ id: 'd1', contractId: 'CT-01', name: 'Contrato.pdf', type: 'Pdf', date: tIso, size: 100, url: '' }];
    const cupos: Cupo[] = [];

    return {
      users, companies, contracts,
      subcontracts, obligations, deliverables, execs: [], payments: [],
      guarantees, actas, modifications, risks, breaches,
      plans, documents, documentVersions: [], audits: [], tasks: [], cupos
    };
  }
};
