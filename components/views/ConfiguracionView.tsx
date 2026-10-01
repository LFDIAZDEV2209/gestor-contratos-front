'use client';

import React, { useState } from 'react';
import { Store, AuthService, Audit } from '@/lib/store';
import { ROLES, PERMS, PERM_LABEL, defaultPerms, defaultCatalogs } from '@/lib/catalog';
import { initials } from '@/lib/format';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import type { User, Company } from '@/lib/types';

const CAT_LABEL: Record<string, string> = {
  tiposContrato: 'Tipos de contrato',
  modalidades: 'Modalidades',
  estados: 'Estados de contrato',
  tiposGarantia: 'Tipos de garantía',
  tiposActa: 'Tipos de actas',
  tiposObligacion: 'Tipos de obligaciones',
  categoriasRiesgo: 'Categorías de riesgos',
  categoriasDoc: 'Categorías documentales',
  docsRequeridos: 'Documentos requeridos por contrato',
  areas: 'Áreas responsables',
  aseguradoras: 'Aseguradoras'
};

interface ConfiguracionViewProps {
  onNavigateToEmpresas?: () => void;
  onOpenCompany?: (companyId: string) => void;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  onNavigateToEmpresas,
  onOpenCompany
}) => {
  const [activeTab, setActiveTab] = useState<'alertas' | 'catalogos' | 'usuarios' | 'permisos' | 'empresas' | 'datos'>('alertas');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  const isAdmin = AuthService.currentUser()?.rol === 'ADMINISTRADOR';
  const db = Store.getDB();
  const S = db.settings || {
    alertDays: [30, 15, 10, 5, 3, 1],
    criticalDays: 5,
    budgetPct: 15,
    gapPct: 15,
    currentUser: 'U1',
    catalogs: defaultCatalogs(),
    perms: defaultPerms()
  };

  // Parámetros de alertas
  const [newAlertDay, setNewAlertDay] = useState('');
  const [paramsForm, setParamsForm] = useState({
    criticalDays: S.criticalDays || 5,
    budgetPct: S.budgetPct || 15,
    gapPct: S.gapPct || 15
  });

  // Catálogos
  const [catInputs, setCatInputs] = useState<Record<string, string>>({});

  // Usuarios Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    nombre: '',
    email: '',
    rol: 'CONSULTA',
    estado: 'Activo' as 'Activo' | 'Inactivo'
  });

  // Guard Helper
  const checkAdmin = () => {
    if (isAdmin) return true;
    alert('Solo el rol ADMINISTRADOR puede modificar la configuración.');
    return false;
  };

  // 1. Alert Days Handlers
  const addAlertDay = () => {
    if (!checkAdmin()) return;
    const val = parseInt(newAlertDay, 10);
    if (isNaN(val) || val <= 0 || val > 365) {
      alert('Ingresa un número de días válido entre 1 y 365.');
      return;
    }
    const cur = S.alertDays || [30, 15, 10, 5, 3, 1];
    if (cur.includes(val)) {
      alert('Ese umbral ya existe.');
      return;
    }
    const updated = [...cur, val].sort((a, b) => b - a);
    S.alertDays = updated;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: 'Días de alerta',
      anterior: cur.join('/'),
      nuevo: updated.join('/')
    });
    Store.persist();
    setNewAlertDay('');
    refresh();
  };

  const deleteAlertDay = (d: number) => {
    if (!checkAdmin()) return;
    const cur = S.alertDays || [];
    const updated = cur.filter((x: number) => x !== d);
    S.alertDays = updated;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: 'Días de alerta',
      anterior: cur.join('/'),
      nuevo: updated.join('/')
    });
    Store.persist();
    refresh();
  };

  const resetAlertDays = () => {
    if (!checkAdmin()) return;
    const def = [30, 15, 10, 5, 3, 1];
    S.alertDays = def;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: 'Días de alerta',
      nuevo: def.join('/')
    });
    Store.persist();
    refresh();
  };

  const saveParams = () => {
    if (!checkAdmin()) return;
    S.criticalDays = Number(paramsForm.criticalDays) || 5;
    S.budgetPct = Number(paramsForm.budgetPct) || 15;
    S.gapPct = Number(paramsForm.gapPct) || 15;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: 'Parámetros de alerta y agotamiento',
      nuevo: `Crítica: ${S.criticalDays}d, Presupuesto: ${S.budgetPct}%, Brecha: ${S.gapPct}%`
    });
    Store.persist();
    alert('Parámetros guardados correctamente.');
    refresh();
  };

  // 2. Catalogs Handlers
  const addCatItem = (catKey: string) => {
    if (!checkAdmin()) return;
    const val = (catInputs[catKey] || '').trim();
    if (!val) return;
    if (!S.catalogs) S.catalogs = defaultCatalogs();
    const list = S.catalogs[catKey] || [];
    if (list.includes(val)) {
      alert('Ese elemento ya existe en el catálogo.');
      return;
    }
    list.push(val);
    S.catalogs[catKey] = list;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: `Catálogo ${CAT_LABEL[catKey] || catKey}`,
      nuevo: val
    });
    Store.persist();
    setCatInputs({ ...catInputs, [catKey]: '' });
    refresh();
  };

  const deleteCatItem = (catKey: string, index: number) => {
    if (!checkAdmin()) return;
    if (!S.catalogs) return;
    const list = S.catalogs[catKey] || [];
    const removed = list[index];
    list.splice(index, 1);
    S.catalogs[catKey] = list;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: `Catálogo ${CAT_LABEL[catKey] || catKey}`,
      anterior: removed,
      nuevo: '(eliminado)'
    });
    Store.persist();
    refresh();
  };

  // 3. Usuarios Handlers
  const openNewUserModal = () => {
    if (!checkAdmin()) return;
    setEditingUser(null);
    setUserForm({
      nombre: '',
      email: '',
      rol: 'CONSULTA',
      estado: 'Activo'
    });
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    if (!checkAdmin()) return;
    setEditingUser(u);
    setUserForm({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      estado: (u.estado as any) || 'Activo'
    });
    setUserModalOpen(true);
  };

  const toggleUserStatus = (u: User) => {
    if (!checkAdmin()) return;
    if (u.id === S.currentUser) {
      alert('No puedes inactivar el usuario con la sesión activa.');
      return;
    }
    const newEst = u.estado === 'Activo' ? 'Inactivo' : 'Activo';
    Store.update('users', u.id, { estado: newEst });
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: `Estado de usuario ${u.nombre}`,
      anterior: u.estado,
      nuevo: newEst
    });
    refresh();
  };

  const saveUser = () => {
    if (!userForm.nombre.trim() || !userForm.email.trim()) {
      alert('Por favor ingresa nombre y correo del usuario.');
      return;
    }
    if (editingUser) {
      Store.update('users', editingUser.id, userForm);
      Audit.log({
        modulo: 'Configuración',
        accion: 'Modificación',
        campo: `Usuario ${editingUser.nombre}`,
        nuevo: `${userForm.nombre} (${userForm.rol})`
      });
    } else {
      Store.insert('users', {
        ...userForm,
        id: 'U' + (Store.all('users').length + 1)
      });
      Audit.log({
        modulo: 'Configuración',
        accion: 'Creación',
        campo: 'Usuario',
        nuevo: `${userForm.nombre} (${userForm.rol})`
      });
    }
    setUserModalOpen(false);
    refresh();
  };

  // 4. Permisos Handlers
  const togglePermission = (role: string, perm: string) => {
    if (!checkAdmin()) return;
    if (role === 'ADMINISTRADOR') return;
    if (!S.perms) S.perms = defaultPerms();
    if (!S.perms[role]) S.perms[role] = {};
    const curVal = Boolean(S.perms[role][perm]);
    S.perms[role][perm] = curVal ? 0 : 1;
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: `Permiso ${perm} para ${role}`,
      anterior: curVal ? '1' : '0',
      nuevo: curVal ? '0' : '1'
    });
    Store.persist();
    refresh();
  };

  const resetPerms = () => {
    if (!checkAdmin()) return;
    S.perms = defaultPerms();
    Audit.log({
      modulo: 'Configuración',
      accion: 'Modificación',
      campo: 'Permisos por rol',
      nuevo: 'Restablecidos por defecto'
    });
    Store.persist();
    alert('Permisos restablecidos a los valores por defecto.');
    refresh();
  };

  // 6. Datos y respaldo Handlers
  const downloadBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'gic_backup.json');
    dlAnchor.click();
  };

  const resetDemo = () => {
    if (!checkAdmin()) return;
    const ok = window.confirm(
      '¿Estás seguro de restablecer todos los datos a la demostración inicial? Se borrarán todos los cambios locales.'
    );
    if (!ok) return;
    Store.reset();
    alert('Datos demo restablecidos.');
    window.location.reload();
  };

  // Medición de almacenamiento
  let storageSizeKb = 0;
  try {
    storageSizeKb = Math.round(JSON.stringify(db).length / 1024);
  } catch {}

  const companies: Company[] = Store.all('companies');
  const users: User[] = Store.all('users');
  const catalogKeys = Object.keys(CAT_LABEL);

  return (
    <div className="view-content">
      {/* Header */}
      <div className="page-h">
        <div>
          <h2>Configuración</h2>
          <p className="sub">
            Parámetros del sistema, catálogos, usuarios, roles y permisos.{' '}
            {!isAdmin && (
              <b style={{ color: 'var(--crit)' }}>
                Solo lectura: se requiere rol ADMINISTRADOR para modificar.
              </b>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel">
        <div className="tabs" style={{ padding: '0 8px' }}>
          {[
            { id: 'alertas', label: 'Parámetros de alertas' },
            { id: 'catalogos', label: 'Catálogos' },
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'permisos', label: 'Roles y permisos' },
            { id: 'empresas', label: 'Empresas' },
            { id: 'datos', label: 'Datos y respaldo' }
          ].map((t) => (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id ? 'on' : ''}`}
              onClick={() => setActiveTab(t.id as any)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel-b">
          {/* TAB 1: ALERTAS */}
          {activeTab === 'alertas' && (
            <div className="grid g2">
              <div>
                <h4 style={{ fontSize: '13px', marginBottom: 6 }}>
                  Días de alerta antes del vencimiento
                </h4>
                <p className="small muted" style={{ margin: '0 0 8px' }}>
                  Se generan alertas de contratos y garantías al cruzar cada umbral. Por defecto: 30 /
                  15 / 10 / 5 / 3 / 1.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(S.alertDays || [])
                    .slice()
                    .sort((a: number, b: number) => b - a)
                    .map((d: number) => (
                      <span key={d} className="chip">
                        {d} días
                        {isAdmin && (
                          <button
                            onClick={() => deleteAlertDay(d)}
                            aria-label={`Quitar ${d} días`}
                            style={{
                              marginLeft: 4,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                </div>
                {isAdmin && (
                  <div className="row-flex" style={{ marginTop: 10, gap: 8 }}>
                    <input
                      type="number"
                      className="inp"
                      min={1}
                      max={365}
                      placeholder="Días"
                      style={{ width: 100 }}
                      value={newAlertDay}
                      onChange={(e) => setNewAlertDay(e.target.value)}
                    />
                    <button className="btn sm" onClick={addAlertDay}>
                      <Icon name="plus" /> Agregar umbral
                    </button>
                    <button className="btn sm ghost" onClick={resetAlertDays}>
                      Restablecer por defecto
                    </button>
                  </div>
                )}
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Alerta crítica a (días)</label>
                  <input
                    type="number"
                    className="inp"
                    disabled={!isAdmin}
                    value={paramsForm.criticalDays}
                    onChange={(e) => setParamsForm({ ...paramsForm, criticalDays: Number(e.target.value) })}
                  />
                  <span className="small muted">Por defecto 5 días</span>
                </div>
                <div>
                  <label className="form-label">Presupuesto próximo a agotarse (% de saldo)</label>
                  <input
                    type="number"
                    className="inp"
                    disabled={!isAdmin}
                    value={paramsForm.budgetPct}
                    onChange={(e) => setParamsForm({ ...paramsForm, budgetPct: Number(e.target.value) })}
                  />
                  <span className="small muted">Alerta cuando el saldo disponible es menor a este %</span>
                </div>
                <div>
                  <label className="form-label">Brecha máxima ejecución financiera vs. física (%)</label>
                  <input
                    type="number"
                    className="inp"
                    disabled={!isAdmin}
                    value={paramsForm.gapPct}
                    onChange={(e) => setParamsForm({ ...paramsForm, gapPct: Number(e.target.value) })}
                  />
                  <span className="small muted">Alerta cuando la diferencia supera este %</span>
                </div>
                {isAdmin && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn pri" onClick={saveParams}>
                      <Icon name="save" /> Guardar parámetros
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CATÁLOGOS */}
          {activeTab === 'catalogos' && (
            <div className="grid g2">
              {catalogKeys.map((catKey) => {
                const list: string[] = (S.catalogs && S.catalogs[catKey]) || [];
                return (
                  <div key={catKey} className="panel">
                    <div className="panel-h">
                      <h3>{CAT_LABEL[catKey] || catKey}</h3>
                      <span className="sub">{list.length}</span>
                    </div>
                    <div className="panel-b">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {list.map((item, idx) => (
                          <span key={idx} className="chip">
                            {item}
                            {isAdmin && (
                              <button
                                onClick={() => deleteCatItem(catKey, idx)}
                                aria-label={`Quitar ${item}`}
                                style={{
                                  marginLeft: 4,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {isAdmin && (
                        <div className="row-flex" style={{ gap: 6 }}>
                          <input
                            className="inp"
                            placeholder="Nuevo valor"
                            style={{ flex: 1 }}
                            value={catInputs[catKey] || ''}
                            onChange={(e) =>
                              setCatInputs({ ...catInputs, [catKey]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addCatItem(catKey);
                            }}
                          />
                          <button className="btn sm" onClick={() => addCatItem(catKey)}>
                            <Icon name="plus" /> Agregar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: USUARIOS */}
          {activeTab === 'usuarios' && (
            <div>
              <div className="row-flex mb" style={{ alignItems: 'center' }}>
                <span className="small muted">
                  <Icon name="info" /> Punto de conexión: autenticación (SSO / Azure AD / Keycloak).
                  Aquí se simula el login con el selector de usuario del encabezado.
                </span>
                <span className="sp" style={{ flex: 1 }} />
                {isAdmin && (
                  <button className="btn pri sm" onClick={openNewUserModal}>
                    <Icon name="plus" /> Nuevo usuario
                  </button>
                )}
              </div>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      {isAdmin && <th className="acts">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isCurrent = u.id === S.currentUser;
                      return (
                        <tr key={u.id}>
                          <td className="strong">{u.id}</td>
                          <td>
                            <div className="row-flex" style={{ flexWrap: 'nowrap', gap: 8 }}>
                              <div
                                className="avatar"
                                style={{
                                  width: 26,
                                  height: 26,
                                  fontSize: 10.5,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--brand-soft)',
                                  color: 'var(--brand-2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700
                                }}
                              >
                                {initials(u.nombre)}
                              </div>
                              <span className="strong">{u.nombre}</span>
                              {isCurrent && (
                                <span className="badge b-brand" style={{ fontSize: '10px' }}>
                                  sesión actual
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge b-info">{u.rol}</span>
                          </td>
                          <td>
                            <Badge state={u.estado === 'Activo' ? 'Activo' : 'Anulado'} />
                          </td>
                          {isAdmin && (
                            <td className="acts">
                              <button
                                className="icon-btn"
                                title="Editar"
                                onClick={() => openEditUserModal(u)}
                              >
                                <Icon name="edit" />
                              </button>
                              {!isCurrent && (
                                <button
                                  className="icon-btn"
                                  title={u.estado === 'Activo' ? 'Inactivar' : 'Activar'}
                                  onClick={() => toggleUserStatus(u)}
                                >
                                  <Icon name={u.estado === 'Activo' ? 'x' : 'check'} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ROLES Y PERMISOS */}
          {activeTab === 'permisos' && (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>
                La eliminación se maneja como <b>anulación</b>: el registro se conserva, cambia de estado
                y queda en auditoría. El rol ADMINISTRADOR conserva todos los permisos.
              </p>

              <div className="tbl-wrap">
                <table className="tbl perm">
                  <thead>
                    <tr>
                      <th>Rol</th>
                      {PERMS.map((p) => (
                        <th key={p} style={{ textAlign: 'center' }}>
                          {PERM_LABEL[p]}
                        </th>
                      ))}
                      <th style={{ textAlign: 'center' }}>Usuarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((r) => {
                      const userCount = users.filter((u) => u.rol === r).length;
                      const isAdmRow = r === 'ADMINISTRADOR';
                      return (
                        <tr key={r}>
                          <td className="strong">{r}</td>
                          {PERMS.map((p) => {
                            const isChecked = isAdmRow || Boolean(S.perms?.[r]?.[p]);
                            return (
                              <td key={p} style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isAdmRow || !isAdmin}
                                  onChange={() => togglePermission(r, p)}
                                  aria-label={`${r} ${p}`}
                                />
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge">{userCount}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {isAdmin && (
                <div className="row-flex" style={{ marginTop: 12 }}>
                  <button className="btn sm" onClick={resetPerms}>
                    Restablecer permisos por defecto
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EMPRESAS */}
          {activeTab === 'empresas' && (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>
                Las empresas se administran en su módulo dedicado. Resumen de empresas registradas:
              </p>

              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Razón social</th>
                      <th>NIT</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span
                            className="link"
                            style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                            onClick={() => onOpenCompany?.(c.id)}
                          >
                            {c.razon || (c as any).name}
                          </span>
                        </td>
                        <td>{c.nit}</td>
                        <td>
                          <Badge state={c.estado || 'Activo'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {onNavigateToEmpresas && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn pri sm" onClick={onNavigateToEmpresas}>
                    <Icon name="building" /> Ir al módulo de empresas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DATOS Y RESPALDO */}
          {activeTab === 'datos' && (
            <div className="grid g3">
              <div className="panel">
                <div className="panel-b">
                  <div className="strong" style={{ fontSize: '13.5px', marginBottom: 4 }}>
                    Almacenamiento local
                  </div>
                  <p className="small muted">
                    Adaptador activo: <b>localStorage</b> · {storageSizeKb} KB · clave «gic_store_v2».
                    <br />
                    Para producción cambie el adaptador por API REST (API_BASE).
                  </p>
                </div>
              </div>

              <div className="panel">
                <div className="panel-b">
                  <div className="strong" style={{ fontSize: '13.5px', marginBottom: 4 }}>
                    Respaldo JSON
                  </div>
                  <p className="small muted">
                    Descarga toda la información (incluida la auditoría inmutable) para respaldo o migración.
                  </p>
                  <button className="btn sm" onClick={downloadBackup}>
                    <Icon name="download" /> Descargar respaldo
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-b">
                  <div className="strong" style={{ fontSize: '13.5px', marginBottom: 4, color: 'var(--crit)' }}>
                    Restablecer datos de demostración
                  </div>
                  <p className="small muted">
                    Borra los datos locales y recarga el seed inicial de demostración (5 empresas, 10 contratos).
                  </p>
                  <button className="btn sm dan" onClick={resetDemo} disabled={!isAdmin}>
                    <Icon name="rotate-ccw" /> Restablecer demo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Usuario */}
      {userModalOpen && (
        <Modal
          title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
          onClose={() => setUserModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setUserModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={saveUser}>
                Guardar usuario
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <label className="form-label">Nombre completo *</label>
              <input
                className="inp"
                value={userForm.nombre}
                onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })}
                placeholder="Nombre del usuario"
              />
            </div>

            <div>
              <label className="form-label">Correo electrónico *</label>
              <input
                type="email"
                className="inp"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="usuario@empresa.co"
              />
            </div>

            <div>
              <label className="form-label">Rol del sistema *</label>
              <select
                className="inp"
                value={userForm.rol}
                onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Estado</label>
              <select
                className="inp"
                value={userForm.estado}
                onChange={(e) => setUserForm({ ...userForm, estado: e.target.value as any })}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
