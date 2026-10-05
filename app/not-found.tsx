import Link from 'next/link';
import { BrandLogo } from '../components/app/BrandLogo';

export default function NotFound() {
  return (
    <main className="route-standalone">
      <section className="panel route-state" aria-labelledby="not-found-title">
        <div className="ph">
          <div className="row-flex">
            <BrandLogo />
          </div>
          <span className="badge b-na">Error 404</span>
        </div>
        <h1 id="not-found-title">No encontramos esta página</h1>
        <p>El enlace no existe o ya no está disponible. Vuelve al panel de Seven Safe para continuar.</p>
        <div className="ph-actions">
          <Link className="btn pri" href="/dashboard">Volver al panel</Link>
          <Link className="btn" href="/login">Iniciar sesión</Link>
        </div>
      </section>
    </main>
  );
}
