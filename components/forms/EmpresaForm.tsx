'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm, createFieldValidation } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field } from '../ui/Workspace';
import { FormSection } from '../ui/FormSection';
import type { Company } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Icon } from '../icons';
import { uid } from '../../lib/format';

/**
 * Formulario de empresa en VISTA dedicada (creación y edición) — sin modal.
 * Anatomía de referencia para todas las páginas de creación de la plataforma:
 * breadcrumb, título con descripción, formulario en secciones con FormGrid,
 * resumen de validación en bloque y footer con acciones.
 */
export const EmpresaForm = ({
  initial,
  onDone,
}: {
  initial?: Partial<Company>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/empresas");
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Partial<Company>>(() => initial ?? { estado: 'Activa' });
  const [intentado, setIntentado] = useState(false);
  const empresas = Store.all('companies');
  const tipos = Array.from(
    new Set(empresas.map((c) => (c.tipo || c.type || '').trim()).filter(Boolean)),
  ).sort();

  const set = (patch: Partial<Company>) => setForm((f) => ({ ...f, ...patch }));

  // Validación en bloque (mismas reglas de negocio del flujo original)
  const razon = (form.razon || form.name || '').trim();
  const nit = (form.nit || '').trim();
  const email = (form.email || '').trim();
  const { errores, fieldErrors, addError } = createFieldValidation();
  if (!nit) addError("nit", 'El NIT / identificación tributaria es obligatorio.');
  if (!razon) addError("razon", 'La razón social es obligatoria.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    addError("email", 'El correo electrónico no tiene un formato válido.');
  const duplicado = nit
    ? empresas.find((c) => (c.nit || '').trim() === nit && c.id !== form.id)
    : undefined;
  if (duplicado) addError("nit", `El NIT ya está registrado por «${duplicado.razon || duplicado.name}».`);

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    const estado = form.estado || form.status || 'Activa';
    const payload: Partial<Company> = {
      ...form,
      razon,
      name: razon,
      tipo: form.tipo || form.type || 'Sociedad comercial',
      type: form.tipo || form.type || 'Sociedad comercial',
      estado,
      status: estado,
    };

    if (isEdit) {
      // Snapshot previo: Store.update muta en sitio y falsearía el diff
      const before = { ...Store.get('companies', form.id as string) };
      Store.update('companies', form.id as string, payload);
      Audit.diff('Empresas', '', before, payload, {
        nit: 'NIT de empresa',
        razon: 'Razón social de empresa',
        name: 'Razón social de empresa',
        rep: 'Representante legal de empresa',
        tipo: 'Naturaleza de empresa',
        type: 'Naturaleza de empresa',
        direccion: 'Dirección de empresa',
        tel: 'Teléfono de empresa',
        email: 'Correo de empresa',
        estado: 'Estado de empresa',
        status: 'Estado de empresa',
      });
      notify(`Empresa «${razon}» actualizada.`);
      onDone(payload.id as string);
      return;
    }

    const created = {
      ...payload,
      id: uid('EMP'),
      risk: 0,
      level: '1',
    } as Company;
    Store.insert('companies', created);
    Audit.log({
      modulo: 'Empresas',
      accion: 'Creación',
      campo: 'Empresa ' + razon,
      nuevo: 'Registro de nueva empresa',
    });
    notify(`Empresa «${razon}» registrada exitosamente.`);
    onDone(created.id);
  };

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado}>
      <PageHeader className="ph">
        <div>
          <nav aria-label="Ruta de navegación" className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/empresas">Empresas</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar ficha' : 'Nueva empresa'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            {isEdit ? 'Editar Empresa' : 'Nueva Empresa'}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Actualiza los datos maestros del contratista; cada cambio queda en la auditoría del sistema.'
              : 'Registra un contratista o contraparte contractual en el directorio institucional.'}
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">
        <FormSection title="Identificación legal" icon="building" description="Datos legales de la empresa y su representante." accent>
          <Field className="f">
            <label className="req">NIT / Identificación Tributaria</label>
            <Input name="nit"
              value={form.nit || ''}
              onChange={(e) => set({ nit: e.target.value })}
              placeholder="Ej. 900.876.543-1"
            />
          </Field>

          <Field className="f">
            <label>Estado de Actividad</label>
            <Select name="estado"
              value={form.estado || form.status || 'Activa'}
              onChange={(e) => set({ estado: e.target.value, status: e.target.value })}
            >
              <option value="Activa">Activa</option>
              <option value="Inactiva">Inactiva</option>
            </Select>
          </Field>

          <Field className="f span3">
            <label className="req">Razón Social o Nombre Legal</label>
            <Input name="razon"
              value={form.razon || form.name || ''}
              onChange={(e) => set({ razon: e.target.value, name: e.target.value })}
              placeholder="Nombre comercial o personería jurídica"
            />
          </Field>

          <Field className="f">
            <label>Representante Legal</label>
            <Input name="rep"
              value={form.rep || ''}
              onChange={(e) => set({ rep: e.target.value })}
              placeholder="Nombre del representante legal"
            />
          </Field>

          <Field className="f">
            <label>Naturaleza / Sector</label>
            <Select name="tipo"
              value={form.tipo || form.type || ''}
              onChange={(e) => set({ tipo: e.target.value, type: e.target.value })}
            >
              <option value="">Sin clasificar</option>
              {(tipos.length ? tipos : ['Sociedad comercial']).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

        </FormSection>
        <FormSection title="Canales de contacto" icon="user" description="Información para contactar a la empresa.">
          <Field className="f">
            <label>Teléfono de Contacto</label>
            <Input name="tel"
              value={form.tel || ''}
              onChange={(e) => set({ tel: e.target.value })}
              placeholder="Ej. 605 385 2210"
            />
          </Field>

          <Field className="f">
            <label>Correo Electrónico</label>
            <Input name="email"
              type="email"
              value={form.email || ''}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="contratacion@empresa.co"
            />
          </Field>

          <Field className="f span3">
            <label>Dirección y Ciudad</label>
            <Input name="direccion"
              value={form.direccion || ''}
              onChange={(e) => set({ direccion: e.target.value })}
              placeholder="Ej. Cra 54 # 72-80, Barranquilla"
            />
          </Field>
        </FormSection>
      </Surface>

      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Empresa'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
