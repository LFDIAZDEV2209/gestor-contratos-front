"use client";

import { useState } from "react";
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from "next/link";
import { Input, Select } from "../ui/Controls";
import { notify } from "../ui/Feedback";
import { Button } from "../ui/button";
import { PageHeader, Surface, Field } from "../ui/Workspace";
import { FormSection } from '../ui/FormSection';
import type { User } from "../../lib/types";
import { Store, AuthService, Audit } from "../../lib/store";
import { ROLES } from "../../lib/catalog";
import { Icon } from "../icons";

/**
 * Formulario de usuario en VISTA dedicada (creación y edición) — sin modal.
 * Réplica de la anatomía canónica de EmpresaForm: breadcrumb, título con
 * descripción, resumen de validación visible y footer con acciones.
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
  const cancelar = useFormCancel("/configuracion?tab=usuarios");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<User>>(
    () => initial ?? { rol: "CONSULTA", estado: "Activo" },
  );
  const [intentado, setIntentado] = useState(false);

  const set = (patch: Partial<User>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (mismas reglas de negocio del modal original)
  const nombre = (form.nombre || "").trim();
  const email = (form.email || "").trim();
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!nombre) addError("nombre", "El nombre completo es obligatorio.");
  if (!email) addError("email", "El correo electrónico es obligatorio.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    addError("email", "El correo electrónico no tiene un formato válido.");

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
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: "100%", marginBottom: 6 }}>
            <Link href="/configuracion">Configuración</Link>
            <span style={{ color: "var(--muted)" }}> / </span>
            <Link href="/configuracion?tab=usuarios">Usuarios</Link>
            <span style={{ color: "var(--muted)" }}> / </span>
            <span aria-current="page">{isEdit ? "Editar ficha" : "Nuevo usuario"}</span>
          </nav>
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
        <FormSection title={<>Perfil y acceso</>} icon="user" description={<>Identidad del usuario, rol y estado de acceso.</>} accent>
          <Field className="f span2">
            <label className="req">Nombre completo</label>
            <Input name="nombre"
              value={form.nombre || ""}
              onChange={(e) => set({ nombre: e.target.value })}
              placeholder="Nombre del usuario"
            />
          </Field>

          <Field className="f span2">
            <label className="req">Correo electrónico</label>
            <Input name="email"
              type="email"
              value={form.email || ""}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="usuario@empresa.co"
            />
          </Field>

          <Field className="f">
            <label>Rol del sistema</label>
            <Select name="rol"
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
            <Select name="estado"
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
        </FormSection>
      </Surface>

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> {isEdit ? "Guardar Cambios" : "Guardar Usuario"}
        </Button>
      </div>
    </AccessibleForm>
  );
};
