"use client";
import { useRouter } from "next/navigation";
import { ConfiguracionView } from "@/components/views/ConfiguracionView";
import { companyHref } from "@/components/app/routes";
import { PermissionGate } from "@/components/app/PermissionGate";

export default function Page() {
  const router = useRouter();
  return (
    <PermissionGate roles={["ADMINISTRADOR"]}>
      <ConfiguracionView
        onNavigateToEmpresas={() => router.push("/empresas")}
        onOpenCompany={(id) => router.push(companyHref(id))}
        onNewUser={() => router.push("/configuracion/usuarios/nuevo")}
        onEditUser={(id) =>
          router.push(
            `/configuracion/usuarios/${encodeURIComponent(id)}/editar`,
          )
        }
      />
    </PermissionGate>
  );
}
