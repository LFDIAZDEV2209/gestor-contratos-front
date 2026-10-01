export type UID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISOMonth = string; // YYYY-MM
export type Perm = 'ver' | 'crear' | 'editar' | 'aprobar' | 'anular' | 'exportar' | 'auditar';

export interface User {
  id: UID;
  nombre: string;
  email: string;
  rol: 'ADMINISTRADOR' | 'CONTRATACIÓN' | 'JURÍDICA' | 'FINANCIERA' | 'SUPERVISOR' | 'INTERVENTOR' | 'AUDITOR' | 'CONSULTA' | string;
  estado: 'Activo' | 'Inactivo' | string;
  // Aliases para compatibilidad
  name?: string;
  role?: string;
  initials?: string;
  perms?: string[];
}

export interface Company {
  id: UID;
  razon: string;
  nit: string;
  tipo?: string;
  direccion?: string;
  ciudad?: string;
  depto?: string;
  pais?: string;
  rep?: string;
  repDoc?: string;
  tel?: string;
  email?: string;
  respInterno?: string;
  estado: 'Activa' | 'Inactiva' | string;
  fechaCreacion?: ISODate;
  // Aliases para compatibilidad
  name?: string;
  status?: string;
  risk?: number;
  level?: string;
  type?: string;
}

export interface Contract {
  id: UID;
  numero: string;
  tipo: string;
  modalidad?: string;
  companyId: UID;
  contratista: string;
  nitContratista: string;
  repContratista?: string;
  objeto: string;
  descripcion?: string;
  alcance?: string;
  productos?: string;
  indicadores?: string;
  area?: string;
  responsable: string;
  supervisor: string;
  interventor?: string;
  deptos?: string[];
  municipio?: string;
  fechaFirma?: ISODate;
  fechaInicio: ISODate;
  fechaFin: ISODate;
  valorBase: number;
  iva?: number;
  otrosImp?: number;
  adiciones?: number;
  reducciones?: number;
  estado: string; // Borrador | Activo | Suspendido | Terminado | En liquidación | Liquidado | Anulado
  avanceFisico?: number;
  hastaAgotar?: boolean;
  anulado?: boolean;
  parentId?: UID | null;
  // Aliases para compatibilidad
  num?: string;
  obj?: string;
  status?: string;
  signDate?: ISODate;
  startDate?: ISODate;
  endDate?: ISODate;
  val?: number;
  valExec?: number;
  cur?: string;
  company?: UID;
  depto?: string;
  departamento?: string;
  type?: string;
}

export type Subcontract = SubContract;

export interface SubContract {
  id: UID;
  contractId: UID;
  numero: string;
  contratista: string;
  nit: string;
  objeto: string;
  valor: number;
  fechaInicio: ISODate;
  fechaFin: ISODate;
  estado: string;
  ejecucion?: number;
  responsable?: string;
  documentos?: string;
  riesgos?: string;
  obligaciones?: string;
  // Aliases
  val?: number;
  startDate?: ISODate;
  endDate?: ISODate;
  status?: string;
}

export interface Obligation {
  id: UID;
  contractId: UID;
  tipo: string;
  descripcion: string;
  responsable: string;
  fechaLimite: ISODate;
  periodicidad?: string;
  evidencia?: string;
  estado: string; // Pendiente | En proceso | Cumplida | Cumplida parcialmente | Vencida | Incumplida
  cumplimiento?: number;
  obs?: string;
  verificadoPor?: string;
  verificadoFecha?: ISODate;
  checklist?: Array<{ id: string; texto: string; listo: boolean }>;
  comentarios?: Array<{ id: string; usuario: string; fecha: string; texto: string }>;
  evidencias?: Array<{ id: string; nombre: string; fecha: string; url?: string }>;
  // Aliases
  desc?: string;
  due?: ISODate;
  freq?: string;
  status?: string;
  compDate?: ISODate;
  type?: string;
}

export interface Deliverable {
  id: UID;
  contractId: UID;
  nombre: string;
  descripcion?: string;
  fechaInicio?: ISODate;
  fechaProg: ISODate;
  fechaReal?: ISODate | '';
  responsable?: string;
  estado: string; // Pendiente | En proceso | Entregado | Aprobado | Rechazado | Suspendido | Vencido
  avance?: number;
  evidencia?: string;
  obs?: string;
  // Aliases
  name?: string;
  due?: ISODate;
  val?: number;
  status?: string;
  obligId?: UID;
}

export interface Exec {
  id: UID;
  contractId: UID;
  periodo: ISOMonth; // YYYY-MM
  valor: number;
  avanceFisico: number;
  obs?: string;
  // Aliases
  date?: ISODate;
  val?: number;
  pct?: number;
}

export interface Payment {
  id: UID;
  contractId: UID;
  numero: string;
  fecha: ISODate;
  factura?: string;
  periodo?: ISOMonth;
  bruto: number;
  iva?: number;
  retenciones?: number;
  neto: number;
  estado: string; // Pendiente | En revisión | Aprobado | Pagado | Rechazado
  fechaAprob?: ISODate;
  fechaPago?: ISODate;
  soporte?: string;
  // Aliases
  date?: ISODate;
  val?: number;
  ref?: string;
  status?: string;
}

export interface Guarantee {
  id: UID;
  contractId: UID;
  tipo: string;
  aseguradora: string;
  poliza: string;
  modalidadPoliza?: 'Póliza individual' | 'Póliza por cupo' | string;
  cupoId?: UID | '';
  porcentaje?: number;
  tomador?: string;
  intermediario?: string;
  prima?: number;
  valor: number;
  fechaExp?: ISODate;
  fechaInicio: ISODate;
  fechaVenc: ISODate;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Anulada' | string;
  documento?: string;
  relacion?: string;
  // Aliases
  num?: string;
  issuer?: string;
  val?: number;
  from?: ISODate;
  to?: ISODate;
  status?: string;
  type?: string;
}

export interface Cupo {
  id: UID;
  aseguradora: string;
  numero: string;
  tomador?: string;
  intermediario?: string;
  valor: number;
  fechaInicio: ISODate;
  fechaVenc: ISODate;
  estado: 'Vigente' | 'Suspendido' | 'Vencido' | 'Anulado' | string;
  observaciones?: string;
  // Aliases
  depto?: string;
  year?: number;
  val?: number;
  used?: number;
}

export interface Acta {
  id: UID;
  contractId: UID;
  numero: string;
  tipo: string;
  fecha: ISODate;
  valor?: number;
  descripcion: string;
  firmantes?: string;
  archivo?: string;
  responsable?: string;
  estado: string;
  // Aliases
  date?: ISODate;
  by?: UID;
  status?: string;
}

export interface Modification {
  id: UID;
  contractId: UID;
  numero: string;
  tipo: string;
  fecha: ISODate;
  soporte?: string;
  justificacion: string;
  valorAnterior?: number;
  valorNuevo?: number;
  nuevoTexto?: string;
  fechaAnterior?: ISODate;
  fechaNueva?: ISODate;
  impacto?: string;
  anulada?: boolean;
  // Aliases
  date?: ISODate;
  valChange?: number;
  daysChange?: number;
  obs?: string;
}

export interface Risk {
  id: UID;
  contractId: UID;
  categoria?: string;
  riesgo?: string;
  descripcion?: string;
  prob?: number; // 1-5
  probabilidad?: number;
  impacto?: number; // 1-5
  responsable?: string;
  tratamiento?: string;
  fecha?: ISODate;
  estado: 'Abierto' | 'Controlado' | 'Cerrado' | 'Mitigado' | string;
  mitigacion?: string;
  evidencia?: string;
  nivel?: number;
  // Aliases
  type?: string;
  score?: number;
  status?: string;
  mitig?: string;
}

export interface Breach {
  id: UID;
  contractId: UID;
  fecha: ISODate;
  obligationId?: UID;
  tipo: string;
  descripcion: string;
  responsable?: string;
  impacto: 'Bajo' | 'Medio' | 'Alto' | string;
  estado: 'Abierto' | 'En análisis' | 'En gestión' | 'Subsanado' | 'Cerrado' | string;
  plan?: string;
  planAccion?: string;
  fechaLimite?: ISODate;
  medida?: string;
  multa?: number;
  evidencia?: string;
  // Aliases
  date?: ISODate;
  desc?: string;
  severity?: string;
  status?: string;
  penalty?: number;
}

export interface Plan {
  id: UID;
  contractId: UID;
  fecha?: ISODate;
  fechaInicio?: ISODate;
  fechaFin?: ISODate;
  fechaCompromiso?: ISODate;
  hallazgo?: string;
  causa?: string;
  accion: string;
  responsable?: string;
  estado: 'Abierto' | 'En ejecución' | 'En curso' | 'Cumplido' | 'Incumplido' | 'Cerrado' | string;
  avance: number;
  evidencia?: string;
  // Aliases
  title?: string;
  due?: ISODate;
  status?: string;
  pct?: number;
}

export interface DocumentVersion {
  v: number;
  fecha: ISODate;
  usuario: string;
  archivo: string;
  motivo?: string;
  cambios?: string;
  // Aliases
  id?: UID;
  docId?: UID;
  version?: number;
  date?: ISODate;
  by?: UID;
}

export interface Document {
  id: UID;
  contractId: UID;
  nombre: string;
  categoria: string;
  estado: string;
  obs?: string;
  versions: DocumentVersion[];
  extracted?: {
    valor?: number;
    plazo?: number;
    fechaInicio?: ISODate;
    fechaFin?: ISODate;
    contratista?: string;
    nit?: string;
    objeto?: string;
    garantias?: string;
  };
  // Aliases
  name?: string;
  type?: string;
  date?: ISODate;
  size?: number;
  url?: string;
}

export interface AuditEntry {
  id: UID;
  ts: string;
  fecha: ISODate;
  hora: string;
  usuario: string;
  rol: string;
  contractId?: UID;
  modulo: string;
  accion: string;
  campo?: string;
  anterior?: any;
  nuevo?: any;
  ip?: string;
  obs?: string;
  // Aliases
  user?: UID;
  module?: string;
  action?: string;
  field?: string;
  entity?: string;
  entityId?: UID;
  details?: string;
  date?: ISODate;
}

export interface Task {
  id: UID;
  titulo: string;
  asignado: string;
  vence: ISODate;
  contractId?: UID;
  alertKey?: string;
  estado: 'Pendiente' | 'En progreso' | 'Completada' | string;
  creada?: string;
  creadaPor?: string;
  // Aliases
  user?: UID;
  title?: string;
  due?: ISODate;
  status?: string;
}

export interface AlertStateItem {
  estado?: 'Nueva' | 'Leída' | 'Delegada' | 'Resuelta' | string;
  delegadoA?: string;
  nota?: string;
  usuario?: string;
  fechaGestion?: string;
  id?: UID;
  read?: boolean;
}

export type AlertState = Record<string, AlertStateItem>;

export interface Settings {
  currentUser: UID;
  alertDays: number[];
  criticalDays: number;
  budgetPct: number;
  gapPct: number;
  perms: Record<string, Record<string, boolean | number>>;
  catalogs: Record<string, string[]>;
  theme?: string;
  notify?: boolean;
}

export interface DB {
  version: string;
  created: string;
  alertState: AlertState;
  tasks: Task[];
  audit: AuditEntry[];
  users: User[];
  settings: Settings;
  companies: Company[];
  contracts: Contract[];
  subcontracts: SubContract[];
  execs: Exec[];
  payments: Payment[];
  obligations: Obligation[];
  deliverables: Deliverable[];
  guarantees: Guarantee[];
  actas: Acta[];
  modifications: Modification[];
  risks: Risk[];
  breaches: Breach[];
  plans: Plan[];
  documents: Document[];
  cupos: Cupo[];
  // Aliases
  documentVersions?: DocumentVersion[];
  audits?: AuditEntry[];
}

export interface CMetrics {
  valorInicial: number;
  valorActual: number;
  ejecutado: number;
  pagado: number;
  pendientePago: number;
  saldo: number;
  pctFin: number;
  pctFis: number;
  duracion: number;
  meses: number;
  transcurridos: number;
  restantes: number | null;
  pctTiempo: number;
  estado: string;
  activo: boolean;
  estadoTemporal: string;
  oblTotal: number;
  oblCumplidas: number;
  oblVencidas: number;
  pctCumpl: number;
  entVencidos: number;
  incAbiertos: number;
  garTotal: number;
  garVencidas: number;
  garMinDias: number | null;
  riesgosAltos: number;
  riesgosTotal: number;
  docsFaltantes: string[];
  docs: number;
  subs: number;
  promMensual: number;
  mesesAgotar: number | null;
  fechaAgotar: string | null;
  agotaAntes: boolean;
  pctSaldo: number;
  nivel: 'ok' | 'warn' | 'risk' | 'crit' | 'na';
  razones: Array<{ l: string; t: string }>;
  score: { total: number; comps: Record<string, number> };
  // Aliases para compatibilidad
  sem: string;
  level: number;
  valAct: number;
  valBase: number;
  saldoRest?: number;
  pExecFin: number;
  pExecFis: number;
  daysLeft: number;
}

export interface VIssue {
  area?: string;
  sev: 'Alta' | 'Media' | 'Baja' | string;
  campo?: string;
  actual?: string | number;
  esperado?: string | number;
  msg: string;
  rec?: string;
}

export interface Alert {
  key: string;
  nivel: 'critica' | 'riesgo' | 'proxima' | 'info';
  tipo: string;
  contractId: string | null;
  numero: string;
  descripcion: string;
  fecha: string;
  responsable: string;
  act: string;
  estado: string;
  delegadoA?: string;
  gestion?: AlertStateItem;
}
