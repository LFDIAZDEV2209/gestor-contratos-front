"use client";

import { useEffect, useState } from "react";
import { WorkspaceSkeleton } from '@/components/ui/Workspace';
import { useRouter } from "next/navigation";
import { AuthService } from "@/lib/store";
import { RouteState as EmptyState } from '@/components/expediente/forms/RouteState';
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { UsuarioForm } from "@/components/forms/UsuarioForm";

/** VISTA dedicada: creación de usuario (reemplaza al modal de ConfiguracionView). */
export default function Page() {
  const router = useRouter();
  const [permiso, setPermiso] = useState<boolean | null>(null);

  useEffect(() => {
    // can() es puro (guard() alerta como efecto y solo debe usarse en handlers)
    setPermiso(
      AuthService.currentUser()?.rol === "ADMINISTRADOR" &&
        AuthService.can("crear"),
    );
  }, []);

  if (permiso === null) return <WorkspaceSkeleton />;

  if (!permiso) {
    return (
      <div
        className="anim-fade-rise"
        style={{ padding: "40px 20px", textAlign: "center" }}
      >
        <EmptyState
          title="Acceso restringido"
          description="Tu rol no permite registrar usuarios en el sistema."
          action={
            <Button
              className="btn pri"
              onClick={() => router.push("/configuracion?tab=usuarios")}
              style={{ marginTop: 12 }}
            >
              <Icon name="chevron-left" /> Volver a Configuración
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-rise">
      <UsuarioForm onDone={() => router.push("/configuracion?tab=usuarios")} />
    </div>
  );
}
