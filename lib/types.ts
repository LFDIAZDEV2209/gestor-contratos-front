export type UID = string;
export type ISODate = string;

export interface User { id: UID; name: string; role: string; perms: string[]; initials: string; }
export interface Company { id: UID; nit: string; name: string; rep: string; type: string; level: string; status: string; risk: number; }
export interface Contract { id: UID; num: string; obj: string; status: string; signDate: ISODate; startDate: ISODate; endDate: ISODate; val: number; valExec: number; cur: string; supervisor: UID; company: UID; depto: string; type: string; }
export interface SubContract { id: UID; contractId: UID; company: UID; obj: string; val: number; startDate: ISODate; endDate: ISODate; status: string; }
export interface Obligation { id: UID; contractId: UID; desc: string; freq: string; status: string; due: ISODate; compDate?: ISODate; type: string; }
export interface Deliverable { id: UID; contractId: UID; obligId?: UID; name: string; due: ISODate; status: string; val: number; }
export interface Exec { id: UID; contractId: UID; date: ISODate; val: number; pct: number; obs: string; }
export interface Payment { id: UID; contractId: UID; date: ISODate; val: number; status: string; ref: string; }
export interface Guarantee { id: UID; contractId: UID; type: string; issuer: string; num: string; val: number; from: ISODate; to: ISODate; status: string; }
export interface Acta { id: UID; contractId: UID; type: string; date: ISODate; status: string; by: UID; }
export interface Modification { id: UID; contractId: UID; type: string; date: ISODate; valChange: number; daysChange: number; obs: string; }
export interface Risk { id: UID; contractId: UID; type: string; prob: number; impact: number; score: number; status: string; mitig: string; }
export interface Breach { id: UID; contractId: UID; date: ISODate; desc: string; severity: string; status: string; penalty: number; }
export interface Plan { id: UID; contractId: UID; title: string; due: ISODate; status: string; pct: number; }
export interface Document { id: UID; contractId: UID; name: string; type: string; date: ISODate; size: number; url: string; }
export interface DocumentVersion { id: UID; docId: UID; version: number; date: ISODate; by: UID; }
export interface AuditEntry { id: UID; date: ISODate; user: UID; action: string; entity: string; entityId: UID; details: string; }
export interface Task { id: UID; user: UID; title: string; due: ISODate; status: string; }
export interface Cupo { id: UID; depto: string; year: number; val: number; used: number; }
export interface DB {
  users: User[]; companies: Company[]; contracts: Contract[];
  subcontracts: SubContract[]; obligations: Obligation[]; deliverables: Deliverable[];
  execs: Exec[]; payments: Payment[]; guarantees: Guarantee[]; actas: Acta[];
  modifications: Modification[]; risks: Risk[]; breaches: Breach[]; plans: Plan[];
  documents: Document[]; documentVersions: DocumentVersion[]; audits: AuditEntry[];
  tasks: Task[]; cupos: Cupo[];
}
export interface Settings { theme: string; notify: boolean; }
export interface AlertState { id: UID; read: boolean; }
