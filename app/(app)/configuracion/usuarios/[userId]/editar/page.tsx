"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Store, AuthService } from "@/lib/store";
import { EmptyState } from "@/components/ui/Workspace";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { UsuarioForm } from "@/components/forms/UsuarioForm";
import type { User } from "@/lib/types";

/** VISTA dedicada: edición de la ficha de usuario (reemplaza al modal de ConfiguracionView). */
export default function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const user = Store.get("users", userId) as User | undefined;
  // can() es puro: sin efectos en render (guard() alerta y se reserva a handlers)
  const permitido =
    AuthService.currentUser()?.rol === "ADMINISTRADOR" &&
    AuthService.can("editar");

  if (!user || !permitido) {
    return (
      <div
        className="anim-fade-rise"
        style={{ padding: "40px 20px", textAlign: "center" }}
      >
        <EmptyState
          title={user ? "Acceso restringido" : "Usuario no encontrado"}
          description={
            user
              ? "Tu rol no permite editar usuarios del sistema."
              : "El identificador del usuario no existe o fue eliminado."
          }
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
      <UsuarioForm
        initial={{ ...user }}
        onDone={() => router.push("/configuracion?tab=usuarios")}
      />
    </div>
  );
}
