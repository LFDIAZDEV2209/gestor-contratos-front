import type { DB, User, Company, Contract, SubContract, Obligation, Deliverable, Exec, Payment, Guarantee, Acta, Modification, Risk, Breach, Plan, Document, Cupo } from './types';
import { iso, addDays } from './format';

export const Seed = {
  build(): DB {
    const today = new Date();
    const tIso = iso(today);
    
    const users: User[] = [
      { id: 'u1', name: 'Admin', role: 'Admin', perms: ['admin'], initials: 'AD' },
      { id: 'u2', name: 'Super Visor', role: 'Supervisor', perms: ['read', 'write'], initials: 'SV' },
      { id: 'u3', name: 'User 3', role: 'Supervisor', perms: ['read'], initials: 'U3' },
      { id: 'u4', name: 'User 4', role: 'Supervisor', perms: ['read'], initials: 'U4' },
      { id: 'u5', name: 'User 5', role: 'Supervisor', perms: ['read'], initials: 'U5' },
      { id: 'u6', name: 'User 6', role: 'Supervisor', perms: ['read'], initials: 'U6' },
      { id: 'u7', name: 'User 7', role: 'Supervisor', perms: ['read'], initials: 'U7' },
      { id: 'u8', name: 'User 8', role: 'Supervisor', perms: ['read'], initials: 'U8' }
    ];
    
    const companies: Company[] = [
      { id: 'c1', nit: '800123456', name: 'Empresa 1', rep: 'Rep 1', type: 'Privada', level: '1', status: 'Activo', risk: 0 },
      { id: 'c2', nit: '800123457', name: 'Empresa 2', rep: 'Rep 2', type: 'Privada', level: '1', status: 'Activo', risk: 0 },
      { id: 'c3', nit: '800123458', name: 'Empresa 3', rep: 'Rep 3', type: 'Privada', level: '1', status: 'Activo', risk: 0 },
      { id: 'c4', nit: '800123459', name: 'Empresa 4', rep: 'Rep 4', type: 'Privada', level: '1', status: 'Activo', risk: 0 },
      { id: 'c5', nit: '800123460', name: 'Empresa 5', rep: 'Rep 5', type: 'Privada', level: '1', status: 'Activo', risk: 0 }
    ];

    const contracts: Contract[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `ct${i+1}`, num: `CT-2023-00${i+1}`, obj: 'Contrato de prueba', status: 'Activo',
      signDate: addDays(tIso, -100 - i*10), startDate: addDays(tIso, -90 - i*10), endDate: addDays(tIso, 100 + i*10),
      val: 150000000, valExec: 50000000, cur: 'COP', supervisor: 'u1', company: 'c1', depto: 'CUN', type: 'Obra'
    }));

    const subcontracts: SubContract[] = Array.from({ length: 6 }).map((_, i) => ({
      id: `sc${i+1}`, contractId: 'ct1', company: 'c2', obj: 'Sub', val: 10000, startDate: tIso, endDate: tIso, status: 'Activo'
    }));

    const obligations: Obligation[] = Array.from({ length: 19 }).map((_, i) => ({
      id: `ob${i+1}`, contractId: 'ct1', desc: 'Oblig', freq: 'Mensual', status: 'Activo', due: tIso, type: 'General'
    }));

    const deliverables: Deliverable[] = Array.from({ length: 13 }).map((_, i) => ({
      id: `dl${i+1}`, contractId: 'ct1', name: 'Deliv', due: tIso, status: 'Pendiente', val: 0
    }));

    const guarantees: Guarantee[] = Array.from({ length: 23 }).map((_, i) => ({
      id: `g${i+1}`, contractId: 'ct1', type: 'Cumplimiento', issuer: 'Seguros', num: '123', val: 1000, from: tIso, to: tIso, status: 'Activa'
    }));

    const actas: Acta[] = Array.from({ length: 18 }).map((_, i) => ({
      id: `ac${i+1}`, contractId: 'ct1', type: 'Inicio', date: tIso, status: 'Firmada', by: 'u1'
    }));

    const modifications: Modification[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `mod${i+1}`, contractId: 'ct1', type: 'Adición', date: tIso, valChange: 100, daysChange: 0, obs: ''
    }));

    const risks: Risk[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `r${i+1}`, contractId: 'ct1', type: 'Financiero', prob: 2, impact: 3, score: 6, status: 'Abierto', mitig: ''
    }));

    const breaches: Breach[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `br${i+1}`, contractId: 'ct1', date: tIso, desc: '', severity: 'Alta', status: 'Abierto', penalty: 100
    }));

    const plans: Plan[] = Array.from({ length: 3 }).map((_, i) => ({
      id: `p${i+1}`, contractId: 'ct1', title: '', due: tIso, status: 'En curso', pct: 10
    }));

    const documents: Document[] = Array.from({ length: 42 }).map((_, i) => ({
      id: `d${i+1}`, contractId: 'ct1', name: '', type: 'Pdf', date: tIso, size: 100, url: ''
    }));

    const cupos: Cupo[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `cu${i+1}`, depto: 'CUN', year: 2023, val: 100, used: 10
    }));

    return {
      users, companies, contracts,
      subcontracts, obligations, deliverables, execs: [], payments: [],
      guarantees, actas, modifications, risks, breaches,
      plans, documents, documentVersions: [], audits: [], tasks: [], cupos
    };
  }
};
