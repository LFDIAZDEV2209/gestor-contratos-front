"use client";
import { AccessibleForm } from '../forms/AccessibleForm';
import { FormSection } from '../ui/FormSection';
import { fieldIcon } from '../forms/fieldIcon';
import { Input } from "../ui/Controls";
import { notify, confirmAction } from "../ui/Feedback";
import { Button } from "../ui/button";
import {
  PageHeader,
  Surface,
  TableViewport,
  DataTable,
  EmptyState,
} from "../ui/Workspace";
import { SectionHeader } from "../ui/SectionHeader";


import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store, AuthService, Audit } from "@/lib/store";
import {
  ROLES,
  PERMS,
  PERM_LABEL,
  defaultPerms,
  defaultCatalogs,
} from "@/lib/catalog";
import { initials } from "@/lib/format";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import type { User, Company } from "@/lib/types";

const CAT_LABEL: Record<string, string> = {
  tiposContrato: "Tipos de contrato",
  modalidades: "Modalidades",
  estados: "Estados de contrato",
  tiposGarantia: "Tipos de garantía",
  tiposActa: "Tipos de actas",
  tiposObligacion: "Tipos de obligaciones",
  categoriasRiesgo: "Categorías de riesgos",
  categoriasDoc: "Categorías documentales",
  docsRequeridos: "Documentos requeridos por contrato",
  areas: "Áreas responsables",
  aseguradoras: "Aseguradoras",
};

// Pestañas del módulo con su icono de identificación (navegación interna).
const TABS = [
  { id: "alertas", label: "Parámetros de alertas", icon: "bell" },
  { id: "catalogos", label: "Catálogos", icon: "folder-tree" },
  { id: "usuarios", label: "Usuarios", icon: "user" },
  { id: "permisos", label: "Roles y permisos", icon: "lock" },
  { id: "empresas", label: "Empresas", icon: "building" },
  { id: "datos", label: "Datos y respaldo", icon: "file-export" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ConfiguracionViewProps {
  onNavigateToEmpresas?: () => void;
  onOpenCompany?: (companyId: string) => void;
  onNewUser?: () => void;
  onEditUser?: (userId: string) => void;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  onNavigateToEmpresas,
  onOpenCompany,
  onNewUser,
  onEditUser,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("alertas");
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  // La pestaña activa vive también en la URL: al volver desde las vistas de
  // usuario (/configuracion/usuarios/…) se restaura la pestaña de origen.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab as TabId);
  }, []);

  const cambiarTab = (id: TabId) => {
    setActiveTab(id);
    // replace evita llenar el historial con cada cambio de pestaña
    router.replace(`${window.location.pathname}?tab=${id}`, { scroll: false });
  };

  const isAdmin = AuthService.currentUser()?.rol === "ADMINISTRADOR";
  const db = Store.getDB();
  const S = db.settings || {
    alertDays: [30, 15, 10, 5, 3, 1],
    criticalDays: 5,
    budgetPct: 15,
    gapPct: 15,
    currentUser: "U1",
    catalogs: defaultCatalogs(),
    perms: defaultPerms(),
  };

  // Parámetros de alertas
  const [newAlertDay, setNewAlertDay] = useState("");
  const [paramsForm, setParamsForm] = useState({
    criticalDays: S.criticalDays || 5,
    budgetPct: S.budgetPct || 15,
    gapPct: S.gapPct || 15,
  });

  // Catálogos
  const [catInputs, setCatInputs] = useState<Record<string, string>>({});

  // Guard Helper
  const checkAdmin = () => {
    if (isAdmin) return true;
    notify("Solo el rol ADMINISTRADOR puede modificar la configuración.");
    return false;
  };

  // 1. Alert Days Handlers
  const addAlertDay = () => {
    if (!checkAdmin()) return;
    const val = parseInt(newAlertDay, 10);
    if (isNaN(val) || val <= 0 || val > 365) {
      notify("Ingresa un número de días válido entre 1 y 365.");
      return;
    }
    const cur = S.alertDays || [30, 15, 10, 5, 3, 1];
    if (cur.includes(val)) {
      notify("Ese umbral ya existe.");
      return;
    }
    const updated = [...cur, val].sort((a, b) => b - a);
    S.alertDays = updated;
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: "Días de alerta",
      anterior: cur.join("/"),
      nuevo: updated.join("/"),
    });
    Store.persist();
    setNewAlertDay("");
    refresh();
  };

  const deleteAlertDay = (d: number) => {
    if (!checkAdmin()) return;
    const cur = S.alertDays || [];
    const updated = cur.filter((x: number) => x !== d);
    S.alertDays = updated;
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: "Días de alerta",
      anterior: cur.join("/"),
      nuevo: updated.join("/"),
    });
    Store.persist();
    refresh();
  };

  const resetAlertDays = () => {
    if (!checkAdmin()) return;
    const def = [30, 15, 10, 5, 3, 1];
    S.alertDays = def;
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: "Días de alerta",
      nuevo: def.join("/"),
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
      modulo: "Configuración",
      accion: "Modificación",
      campo: "Parámetros de alerta y agotamiento",
      nuevo: `Crítica: ${S.criticalDays}d, Presupuesto: ${S.budgetPct}%, Brecha: ${S.gapPct}%`,
    });
    Store.persist();
    notify("Parámetros guardados correctamente.");
    refresh();
  };

  // 2. Catalogs Handlers
  const addCatItem = (catKey: string) => {
    if (!checkAdmin()) return;
    const val = (catInputs[catKey] || "").trim();
    if (!val) return;
    if (!S.catalogs) S.catalogs = defaultCatalogs();
    const list = S.catalogs[catKey] || [];
    if (list.includes(val)) {
      notify("Ese elemento ya existe en el catálogo.");
      return;
    }
    list.push(val);
    S.catalogs[catKey] = list;
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: `Catálogo ${CAT_LABEL[catKey] || catKey}`,
      nuevo: val,
    });
    Store.persist();
    setCatInputs({ ...catInputs, [catKey]: "" });
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
      modulo: "Configuración",
      accion: "Modificación",
      campo: `Catálogo ${CAT_LABEL[catKey] || catKey}`,
      anterior: removed,
      nuevo: "(eliminado)",
    });
    Store.persist();
    refresh();
  };

  // 3. Usuarios — la creación/edición se hace en VISTAS dedicadas
  // (/configuracion/usuarios/nuevo y /configuracion/usuarios/[userId]/editar)
  const toggleUserStatus = (u: User) => {
    if (!checkAdmin()) return;
    if (u.id === S.currentUser) {
      notify("No puedes inactivar el usuario con la sesión activa.");
      return;
    }
    const newEst = u.estado === "Activo" ? "Inactivo" : "Activo";
    Store.update("users", u.id, { estado: newEst });
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: `Estado de usuario ${u.nombre}`,
      anterior: u.estado,
      nuevo: newEst,
    });
    refresh();
  };

  // 4. Permisos Handlers
  const togglePermission = (role: string, perm: string) => {
    if (!checkAdmin()) return;
    if (role === "ADMINISTRADOR") return;
    if (!S.perms) S.perms = defaultPerms();
    if (!S.perms[role]) S.perms[role] = {};
    const curVal = Boolean(S.perms[role][perm]);
    S.perms[role][perm] = curVal ? 0 : 1;
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: `Permiso ${perm} para ${role}`,
      anterior: curVal ? "1" : "0",
      nuevo: curVal ? "0" : "1",
    });
    Store.persist();
    refresh();
    notify(`${curVal ? "Quitado" : "Concedido"} · ${perm} · ${role}`);
  };

  const resetPerms = () => {
    if (!checkAdmin()) return;
    S.perms = defaultPerms();
    Audit.log({
      modulo: "Configuración",
      accion: "Modificación",
      campo: "Permisos por rol",
      nuevo: "Restablecidos por defecto",
    });
    Store.persist();
    notify("Permisos restablecidos a los valores por defecto.");
    refresh();
  };

  // 6. Datos y respaldo Handlers
  const downloadBackup = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "gic_backup.json");
    dlAnchor.click();
  };

  const resetDemo = async () => {
    if (!checkAdmin()) return;
    const ok = await confirmAction(
      "¿Estás seguro de restablecer todos los datos a la demostración inicial? Se borrarán todos los cambios locales.",
    );
    if (!ok) return;
    Store.reset();
    notify("Datos demo restablecidos.");
    window.location.reload();
  };

  // Medición de almacenamiento
  let storageSizeKb = 0;
  try {
    storageSizeKb = Math.round(JSON.stringify(db).length / 1024);
  } catch {}

  const companies: Company[] = Store.all("companies");
  const users: User[] = Store.all("users");
  const catalogKeys = Object.keys(CAT_LABEL);

  return (
    <div className="view-content conf-view">
      {/* Banner de cabecera con gradiente de marca institucional */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r)",
                background: "rgba(255, 255, 255, 0.16)",
                color: "var(--surface)",
                display: "grid",
                placeItems: "center",
                backdropFilter: "blur(8px)",
                flexShrink: 0,
              }}
            >
              <Icon name="gear" size={24} />
            </span>
            <div>
              <h1
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: 0,
                }}
              >
                Configuración
                {!isAdmin && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "var(--r-pill)",
                      background: "rgba(255, 255, 255, 0.18)",
                      color: "var(--surface)",
                    }}
                  >
                    Solo lectura
                  </span>
                )}
              </h1>
              <p style={{ margin: "4px 0 0" }}>
                Parámetros del sistema, catálogos, usuarios, roles y permisos.
                {!isAdmin && " Se requiere rol ADMINISTRADOR para modificar."}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones reales del módulo alineadas a la derecha */}
        <div className="ph-actions">
          <Button
            className="btn"
            onClick={downloadBackup}
            title="Descarga toda la información en formato JSON"
          >
            <Icon name="download" /> Descargar respaldo
          </Button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <Surface className="panel">
        <h2 className="conf-sr">Parámetros y administración del sistema</h2>
        <div
          className="tabs"
          style={{ padding: "0 8px" }}
          role="tablist"
          aria-label="Secciones de configuración"
        >
          {TABS.map((t, i) => (
            <Button
              key={t.id}
              role="tab"
              id={`conf-tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls="conf-panel"
              tabIndex={activeTab === t.id ? 0 : -1}
              className={`tab ${activeTab === t.id ? "on" : ""}`}
              onClick={() => cambiarTab(t.id)}
              onKeyDown={(e) => {
                // Navegación con flechas entre pestañas (patrón WAI-ARIA).
                if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                  e.preventDefault();
                  const dir = e.key === "ArrowRight" ? 1 : -1;
                  const next = e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[TABS.length - 1] : TABS[(i + dir + TABS.length) % TABS.length];
                  cambiarTab(next.id);
                  document.getElementById(`conf-tab-${next.id}`)?.focus();
                }
              }}
            >
              <Icon name={t.icon} /> {t.label}
            </Button>
          ))}
        </div>

        <div
          className="panel-b anim-fade-rise"
          key={activeTab}
          role="tabpanel"
          id="conf-panel"
          aria-labelledby={`conf-tab-${activeTab}`}
        >
          {/* TAB 1: ALERTAS */}
          {activeTab === "alertas" && (
            <div className="grid g2">
              <div>
                <h4 aria-level={2} style={{ fontSize: "13px", marginBottom: 6 }}>
                  Días de alerta antes del vencimiento
                </h4>
                <p className="small muted" style={{ margin: "0 0 8px" }}>
                  Se generan alertas de contratos y garantías al cruzar cada
                  umbral. Por defecto: 30 / 15 / 10 / 5 / 3 / 1.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(S.alertDays || [])
                    .slice()
                    .sort((a: number, b: number) => b - a)
                    .map((d: number) => (
                      <span key={d} className="badge b-brand">
                        {d} días
                        {isAdmin && (
                          <Button
                            className="icon-btn"
                            onClick={() => deleteAlertDay(d)}
                            aria-label={`Quitar umbral de ${d} días`}
                            style={{ width: 18, height: 18, marginLeft: 2 }}
                          >
                            <Icon name="x" size={11} />
                          </Button>
                        )}
                      </span>
                    ))}
                </div>
                {isAdmin && (
                  <AccessibleForm errors={{}} attempted={false}><FormSection title="Días de anticipación" icon="clock" className="form-section-inline"><div className="row-flex" style={{ marginTop: 10, gap: 8 }}>
                    <Input icon={fieldIcon("newAlertDay", "Nuevos días de alerta", "number")}
                      type="number"
                      className="inp"
                      min={1}
                      max={365}
                      placeholder="Días"
                      aria-label="Nuevos días de alerta"
                      style={{ width: 100 }}
                      value={newAlertDay}
                      onChange={(e) => setNewAlertDay(e.target.value)}
                    />
                    <Button className="btn sm" onClick={addAlertDay}>
                      <Icon name="plus" /> Agregar umbral
                    </Button>
                    <Button className="btn sm ghost" onClick={resetAlertDays}>
                      Restablecer por defecto
                    </Button>
                  </div></FormSection></AccessibleForm>
                )}
              </div>

              <AccessibleForm errors={{}} attempted={false}><FormSection title="Umbrales de seguimiento" icon="gauge" className="form-section-inline" gridStyle={{ gap: 12 }}>
                <div>
                  <label className="form-label">Alerta crítica a (días)</label>
                  <Input icon={fieldIcon("criticalDays", "Alerta crítica a (días)", "number")}
                    type="number"
                    className="inp"
                    min={0}
                    max={365}
                    disabled={!isAdmin}
                    value={paramsForm.criticalDays}
                    onChange={(e) =>
                      setParamsForm({
                        ...paramsForm,
                        criticalDays: Number(e.target.value),
                      })
                    }
                  />
                  <span className="small muted">Por defecto 5 días</span>
                </div>
                <div>
                  <label className="form-label">
                    Presupuesto próximo a agotarse (% de saldo)
                  </label>
                  <Input icon={fieldIcon("budgetPct", "Presupuesto próximo a agotarse (% de saldo)", "number")}
                    type="number"
                    className="inp"
                    min={1}
                    max={100}
                    disabled={!isAdmin}
                    value={paramsForm.budgetPct}
                    onChange={(e) =>
                      setParamsForm({
                        ...paramsForm,
                        budgetPct: Number(e.target.value),
                      })
                    }
                  />
                  <span className="small muted">
                    Alerta cuando el saldo disponible es menor a este %
                  </span>
                </div>
                <div>
                  <label className="form-label">
                    Brecha máxima ejecución financiera vs. física (%)
                  </label>
                  <Input icon={fieldIcon("gapPct", "Brecha máxima ejecución financiera vs. física (%)", "number")}
                    type="number"
                    className="inp"
                    min={1}
                    max={100}
                    disabled={!isAdmin}
                    value={paramsForm.gapPct}
                    onChange={(e) =>
                      setParamsForm({
                        ...paramsForm,
                        gapPct: Number(e.target.value),
                      })
                    }
                  />
                  <span className="small muted">
                    Alerta cuando la diferencia supera este %
                  </span>
                </div>
                {isAdmin && (
                  <div style={{ marginTop: 8 }}>
                    <Button className="btn pri" onClick={saveParams}>
                      <Icon name="clipboard-check" /> Guardar parámetros
                    </Button>
                  </div>
                )}
              </FormSection></AccessibleForm>
            </div>
          )}

          {/* TAB 2: CATÁLOGOS */}
          {activeTab === "catalogos" && (
            <div className="grid g2">
              {catalogKeys.map((catKey) => {
                const list: string[] = (S.catalogs && S.catalogs[catKey]) || [];
                return (
                  <Surface key={catKey} className="panel">
                    <SectionHeader
                      as="h3"
                      icon="folder-tree"
                      title={CAT_LABEL[catKey] || catKey}
                      action={<span className="ws-section-meta">{list.length}</span>}
                    />
                    <div className="panel-b">
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {list.map((item, idx) => (
                          <span key={idx} className="badge b-brand">
                            {item}
                            {isAdmin && (
                              <Button
                                className="icon-btn"
                                onClick={() => deleteCatItem(catKey, idx)}
                                aria-label={`Quitar ${item} del catálogo ${CAT_LABEL[catKey] || catKey}`}
                                style={{ width: 18, height: 18, marginLeft: 2 }}
                              >
                                <Icon name="x" size={11} />
                              </Button>
                            )}
                          </span>
                        ))}
                        {list.length === 0 && (
                          <span className="small muted">
                            Catálogo vacío: agrega el primer valor.
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <AccessibleForm errors={{}} attempted={false}><FormSection title={`Nuevo valor de ${CAT_LABEL[catKey] || catKey}`} icon="layers" className="form-section-inline conf-add"><div className="row-flex" style={{ gap: 6 }}>
                          <Input icon={fieldIcon("catalogo", "Nuevo valor", "")}
                            className="inp"
                            placeholder="Nuevo valor"
                            aria-label={`Nuevo valor para ${CAT_LABEL[catKey] || catKey}`}
                            style={{ flex: 1 }}
                            value={catInputs[catKey] || ""}
                            onChange={(e) =>
                              setCatInputs({
                                ...catInputs,
                                [catKey]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCatItem(catKey);
                            }}
                          />
                          <Button
                            className="btn sm"
                            onClick={() => addCatItem(catKey)}
                          >
                            <Icon name="plus" /> Agregar
                          </Button>
                        </div></FormSection></AccessibleForm>
                      )}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}

          {/* TAB 3: USUARIOS */}
          {activeTab === "usuarios" && (
            <div>
              <div className="row-flex mb" style={{ alignItems: "center" }}>
                <span className="small muted">
                  <Icon name="info" /> Punto de conexión: autenticación (SSO /
                  Azure AD / Keycloak). Aquí se simula el login con el selector
                  de usuario del encabezado.
                </span>
                <span className="sp" style={{ flex: 1 }} />
                {isAdmin && (
                  <Button
                    className="btn pri sm"
                    onClick={() =>
                      onNewUser ? onNewUser() : notify("Acción no disponible.")
                    }
                  >
                    <Icon name="plus" /> Nuevo usuario
                  </Button>
                )}
              </div>

              {users.length === 0 ? (
                <EmptyState
                  title="Sin usuarios registrados"
                  description="Crea el primer usuario para asignar roles y permisos del sistema."
                  action={
                    isAdmin && onNewUser ? (
                      <Button className="btn pri sm" onClick={onNewUser}>
                        <Icon name="plus" /> Nuevo usuario
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <TableViewport className="tbl-wrap">
                  <DataTable className="tbl" aria-label="Gestión de usuarios del sistema">
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
                              <div
                                className="row-flex"
                                style={{ flexWrap: "nowrap", gap: 8 }}
                              >
                                <div
                                  className="avatar"
                                  style={{
                                    width: 26,
                                    height: 26,
                                    fontSize: 10.5,
                                    borderRadius: "50%",
                                    backgroundColor: "var(--brand-soft)",
                                    color: "var(--brand-2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                  }}
                                >
                                  {initials(u.nombre)}
                                </div>
                                <span className="strong">{u.nombre}</span>
                                {isCurrent && (
                                  <span
                                    className="badge b-brand"
                                    style={{ fontSize: "10px" }}
                                  >
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
                              <Badge
                                state={
                                  u.estado === "Activo" ? "Activo" : "Anulado"
                                }
                              />
                            </td>
                            {isAdmin && (
                              <td className="acts">
                                <Button
                                  className="icon-btn"
                                  title="Editar"
                                  aria-label={`Editar usuario ${u.nombre}`}
                                  onClick={() => onEditUser?.(u.id)}
                                >
                                  <Icon name="edit" />
                                </Button>
                                {!isCurrent && (
                                  <Button
                                    className="icon-btn"
                                    title={
                                      u.estado === "Activo"
                                        ? "Inactivar"
                                        : "Activar"
                                    }
                                    aria-label={`${u.estado === "Activo" ? "Inactivar" : "Activar"} a ${u.nombre}`}
                                    onClick={() => toggleUserStatus(u)}
                                  >
                                    <Icon
                                      name={
                                        u.estado === "Activo" ? "x" : "check"
                                      }
                                    />
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableViewport>
              )}
            </div>
          )}

          {/* TAB 4: ROLES Y PERMISOS */}
          {activeTab === "permisos" && (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>
                La eliminación se maneja como <b>anulación</b>: el registro se
                conserva, cambia de estado y queda en auditoría. El rol
                ADMINISTRADOR conserva todos los permisos. Cada columna habilita
                una capacidad del rol (Ver, Crear, Editar, Aprobar, Eliminar,
                Exportar o Auditar); los cambios se guardan al instante y quedan
                en la bitácora.
              </p>

              <TableViewport className="tbl-wrap">
                <DataTable className="tbl perm" aria-label="Matriz de permisos por rol">
                  <thead>
                    <tr>
                      <th>Rol</th>
                      {PERMS.map((p) => (
                        <th key={p} style={{ textAlign: "center" }}>
                          {PERM_LABEL[p]}
                        </th>
                      ))}
                      <th style={{ textAlign: "center" }}>Usuarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((r) => {
                      const userCount = users.filter((u) => u.rol === r).length;
                      const isAdmRow = r === "ADMINISTRADOR";
                      return (
                        <tr key={r}>
                          <td className="strong">{r}</td>
                          {PERMS.map((p) => {
                            const isChecked =
                              isAdmRow || Boolean(S.perms?.[r]?.[p]);
                            return (
                              <td key={p} style={{ textAlign: "center" }}>
                                <Input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isAdmRow || !isAdmin}
                                  onChange={() => togglePermission(r, p)}
                                  aria-label={`${PERM_LABEL[p]} para rol ${r}${isChecked ? " (activado)" : " (desactivado)"}`}
                                />
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center" }}>
                            <span
                              className="badge b-info"
                              title={`${userCount} usuario(s) con rol ${r}`}
                            >
                              {userCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableViewport>

              {isAdmin && (
                <div className="row-flex" style={{ marginTop: 12 }}>
                  <Button className="btn sm" onClick={resetPerms}>
                    Restablecer permisos por defecto
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EMPRESAS */}
          {activeTab === "empresas" && (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>
                Las empresas se administran en su módulo dedicado. Resumen de
                empresas registradas:
              </p>

              {companies.length === 0 ? (
                <EmptyState
                  title="Sin empresas registradas"
                  description="Las empresas contratantes aparecerán aquí cuando se registren en su módulo."
                  action={
                    onNavigateToEmpresas ? (
                      <Button
                        className="btn pri sm"
                        onClick={onNavigateToEmpresas}
                      >
                        <Icon name="building" /> Ir al módulo de empresas
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <TableViewport className="tbl-wrap">
                  <DataTable className="tbl" aria-label="Catálogo de tipos de empresa">
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
                            <Button
                              variant="link"
                              className="link"
                              style={{
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                boxShadow: "none",
                                whiteSpace: "normal",
                                textAlign: "left",
                              }}
                              onClick={() => onOpenCompany?.(c.id)}
                              aria-label={`Abrir expediente de ${c.razon || (c as any).name}`}
                            >
                              {c.razon || (c as any).name}
                            </Button>
                          </td>
                          <td>{c.nit}</td>
                          <td>
                            <Badge state={c.estado || "Activo"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </TableViewport>
              )}

              {onNavigateToEmpresas && (
                <div style={{ marginTop: 12 }}>
                  <Button className="btn pri sm" onClick={onNavigateToEmpresas}>
                    <Icon name="building" /> Ir al módulo de empresas
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DATOS Y RESPALDO */}
          {activeTab === "datos" && (
            <div className="grid g3">
              <Surface className="panel">
                <SectionHeader
                  as="h3"
                  icon="layers"
                  title="Almacenamiento local"
                />
                <div className="panel-b">
                  <p className="small muted">
                    Adaptador activo: <b>localStorage</b> · {storageSizeKb} KB ·
                    clave «gic_store_v2».
                    <br />
                    Para producción cambie el adaptador por API REST (API_BASE).
                  </p>
                </div>
              </Surface>

              <Surface className="panel">
                <SectionHeader
                  as="h3"
                  icon="download"
                  title="Respaldo JSON"
                />
                <div className="panel-b">
                  <p className="small muted">
                    Descarga toda la información (incluida la auditoría
                    inmutable) para respaldo o migración.
                  </p>
                  <Button className="btn sm" onClick={downloadBackup}>
                    <Icon name="download" /> Descargar respaldo
                  </Button>
                </div>
              </Surface>

              <Surface className="panel">
                <SectionHeader
                  as="h3"
                  icon="trash"
                  title="Restablecer datos de demostración"
                />
                <div className="panel-b">
                  <p className="small muted">
                    Borra los datos locales y recarga el seed inicial de
                    demostración (5 empresas, 10 contratos).
                  </p>
                  <Button
                    className="btn sm dan"
                    onClick={resetDemo}
                    disabled={!isAdmin}
                  >
                    <Icon name="upload" /> Restablecer demo
                  </Button>
                </div>
              </Surface>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
};
