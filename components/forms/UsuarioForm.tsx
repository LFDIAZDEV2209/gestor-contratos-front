"use client";

import { useState } from "react";
import Link from "next/link";
import { Input, Select } from "../ui/Controls";
import { notify } from "../ui/Feedback";
import { Button } from "../ui/button";
import { PageHeader, Surface, FormGrid, Field } from "../ui/Workspace";
import type { User } from "../../lib/types";
import { Store, AuthService, Audit } from "../../lib/store";
import { ROLES } from "../../lib/catalog";
import { Icon } from "../icons";

/**
 * Formulario de usuario en VISTA dedicada (creación y edición) — sin modal.
 * Réplica de la anatomía canónica de EmpresaForm: breadcrumb, título con
 * descripción, FormGrid, resumen de validación visible y footer con acciones.
 * Reglas del flujo original (fila 7 del mapa): nombre/email trim obligatorios,
 * guard ADMINISTRADOR al guardar, Store + Audit + Feedback al persistir.
 */
export const UsuarioForm = ({
  initial,
  onDone,
}: {
  initial?: Partial<User>;
  onDone: (savedId: string) => void;
}) => {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<User>>(
    () => initial ?? { rol: "CONSULTA", estado: "Activo" },
  );
  const [intentado, setIntentado] = useState(false);

  const set = (patch: Partial<User>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (mismas reglas de negocio del modal original)
  const nombre = (form.nombre || "").trim();
  const email = (form.email || "").trim();
  const errores: string[] = [];
  if (!nombre) errores.push("El nombre completo es obligatorio.");
  if (!email) errores.push("El correo electrónico es obligatorio.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errores.push("El correo electrónico no tiene un formato válido.");

  const guardar = () => {
    setIntentado(true);

    // Guard de permisos al guardar (el original solo validaba al abrir)
    const actual = AuthService.currentUser();
    if (!actual || actual.rol !== "ADMINISTRADOR") {
      notify("Solo el rol ADMINISTRADOR puede administrar usuarios.");
      return;
    }
    if (!AuthService.can(isEdit ? "editar" : "crear")) {
      notify(
        isEdit
          ? "Tu rol no permite editar usuarios."
          : "Tu rol no permite crear usuarios.",
      );
      return;
    }
    if (errores.length) {
      notify("Corrige los errores del formulario antes de guardar.");
      return;
    }

    const payload: Partial<User> = {
      ...form,
      nombre,
      email,
      rol: form.rol || "CONSULTA",
      estado: (form.estado as any) || "Activo",
    };

    if (isEdit) {
      Store.update("users", form.id as string, payload);
      Audit.log({
        modulo: "Configuración",
        accion: "Modificación",
        campo: `Usuario ${initial?.nombre || nombre}`,
        nuevo: `${nombre} (${payload.rol})`,
      });
      notify(`Usuario «${nombre}» actualizado.`);
      onDone(form.id as string);
      return;
    }

    // ID con el mismo formato del original ('U' + n) y búscula anti-colisión
    const users = Store.all("users");
    let n = users.length + 1;
    let id = "U" + n;
    while (users.some((u) => u.id === id)) {
      n += 1;
      id = "U" + n;
    }
    const created = { ...payload, id } as User;
    Store.insert("users", created);
    Audit.log({
      modulo: "Configuración",
      accion: "Creación",
      campo: "Usuario",
      nuevo: `${nombre} (${payload.rol})`,
    });
    notify(`Usuario «${nombre}» registrado exitosamente.`);
    onDone(created.id);
  };

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: "100%", marginBottom: 6 }}>
            <Link href="/configuracion">Configuración</Link>
            <span style={{ color: "var(--muted)" }}> / </span>
            <Link href="/configuracion?tab=usuarios">Usuarios</Link>
            <span style={{ color: "var(--muted)" }}> / </span>
            <span>{isEdit ? "Editar ficha" : "Nuevo usuario"}</span>
          </div>
          <h1
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: 0,
            }}
          >
            {isEdit ? "Editar Usuario" : "Nuevo Usuario"}
          </h1>
          <p style={{ margin: "4px 0 0" }}>
            {isEdit
              ? "Actualiza los datos y el rol del usuario; cada cambio queda en la auditoría del sistema."
              : "Registra un usuario del sistema y asígnale un rol con sus permisos de acceso."}
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">
        <FormGrid className="form-grid">
          <Field className="f span2">
            <label className="req">Nombre completo</label>
            <Input
              value={form.nombre || ""}
              onChange={(e) => set({ nombre: e.target.value })}
              placeholder="Nombre del usuario"
            />
          </Field>

          <Field className="f span2">
            <label className="req">Correo electrónico</label>
            <Input
              type="email"
              value={form.email || ""}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="usuario@empresa.co"
            />
          </Field>

          <Field className="f">
            <label>Rol del sistema</label>
            <Select
              value={form.rol || "CONSULTA"}
              onChange={(e) => set({ rol: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <span className="small muted">
              El rol define los permisos; el ADMINISTRADOR conserva todos.
            </span>
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select
              value={(form.estado as any) || "Activo"}
              onChange={(e) => set({ estado: e.target.value as any })}
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
            <span className="small muted">
              Un usuario inactivo no inicia sesión.
            </span>
          </Field>
        </FormGrid>
      </Surface>

      {intentado && errores.length > 0 && (
        <Surface
          className="panel mb"
          role="alert"
          style={{ borderColor: "var(--crit, #c0392b)" }}
        >
          <b>Atención: corrige antes de guardar</b>
          <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
            {errores.map((e) => (
              <li key={e} style={{ fontSize: 13 }}>
                {e}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <div className="form-foot">
        <Button className="btn ghost" onClick={() => window.history.back()}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> {isEdit ? "Guardar Cambios" : "Guardar Usuario"}
        </Button>
      </div>
    </>
  );
};
