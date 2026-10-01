'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, AuthService } from '../../lib/store';
import { Icon } from '../../components/icons';
import type { User } from '../../lib/types';

// Imagen corporativa (Unsplash): arquitectura corporativa moderna para la identidad de Seven Save
const HERO_IMG =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1800&auto=format&fit=crop';

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (AuthService.isAuthed()) {
      router.replace('/dashboard');
      return;
    }
    Store.init();
    setUsers((Store.getDB()?.users || []).filter((u) => u.estado === 'Activo'));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: FieldErrors = {};
    const mail = email.trim().toLowerCase();
    if (!mail) errs.email = 'Ingresa tu correo corporativo.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) errs.email = 'Formato de correo no válido.';
    if (!password) errs.password = 'Ingresa tu contraseña.';
    else if (password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres.';
    setErrors(errs);
    setBanner(null);
    if (Object.keys(errs).length > 0) return;

    const user = users.find((u) => (u.email || '').toLowerCase() === mail);
    setBusy(true);
    // Simulación de autenticación (fase 0, sin backend): 650 ms con estado de carga real
    timerRef.current = window.setTimeout(() => {
      setBusy(false);
      if (!user) {
        setBanner(
          'No encontramos una cuenta con ese correo. Selecciona un usuario demo o intenta con otro correo.'
        );
        return;
      }
      AuthService.signIn(user.id, remember);
      router.replace('/dashboard');
    }, 650);
  };

  const useDemo = (u: User) => {
    setEmail(u.email || '');
    setPassword('demo1234');
    setErrors({});
    setBanner(null);
  };

  return (
    <div className="login">
      {/* Panel del formulario */}
      <main className="login-panel" aria-label="Inicio de sesión Seven Save">
        <div className="login-form-wrap">
          <div className="login-brand">
            <div className="login-mark" aria-hidden="true">7S</div>
            <div>
              <div className="login-wordmark">
                Seven <span>Save</span>
              </div>
              <div className="login-tag">Gestión integral de contratos</div>
            </div>
          </div>

          <h1 className="login-title">Bienvenido de nuevo</h1>
          <p className="login-sub">Ingresa con tu cuenta corporativa para continuar.</p>

          {banner && (
            <div className="login-banner" role="alert">
              <Icon name="circle-info" />
              <span>{banner}</span>
            </div>
          )}

          <form className="login-form" onSubmit={submit} noValidate>
            <div className={`field ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="login-email">Correo corporativo</label>
              <div className="login-input">
                <Icon name="user" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@empresa.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  autoFocus
                />
              </div>
              {errors.email && (
                <p className="login-err" id="login-email-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className={`field ${errors.password ? 'has-error' : ''}`}>
              <div className="login-label-row">
                <label htmlFor="login-pass">Contraseña</label>
                <button
                  type="button"
                  className="login-help-link"
                  onClick={() => setHelpOpen((v) => !v)}
                  aria-expanded={helpOpen}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="login-input">
                <Icon name="lock" />
                <input
                  id="login-pass"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-pass-error' : undefined}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPass}
                >
                  <Icon name="eye" />
                </button>
              </div>
              {errors.password && (
                <p className="login-err" id="login-pass-error" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            {helpOpen && (
              <div className="login-help-note" role="note">
                <Icon name="circle-info" />
                <span>
                  En esta demo la recuperación de contraseña no está conectada a un servidor. Usa un
                  usuario demo y cualquier contraseña de 6 o más caracteres.
                </span>
              </div>
            )}

            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Mantener la sesión abierta en este equipo</span>
            </label>

            <button type="submit" className="btn pri login-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Verificando credenciales…
                </>
              ) : (
                <>Iniciar sesión</>
              )}
            </button>
          </form>

          {users.length > 0 && (
            <section className="login-demo" aria-label="Usuarios de demostración">
              <div className="login-demo-h">
                <span>Acceso rápido (demo)</span>
                <span className="login-demo-note">Contraseña: cualquier texto de 6+ caracteres</span>
              </div>
              <div className="login-demo-chips">
                {users.slice(0, 6).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="login-chip"
                    onClick={() => useDemo(u)}
                    title={`Llenar formulario con ${u.nombre}`}
                  >
                    <span className="login-chip-ava" aria-hidden="true">
                      {(u.nombre || 'U')
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span className="login-chip-txt">
                      <span className="n">{u.nombre}</span>
                      <span className="r">{u.rol}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <footer className="login-foot">
            <span>Seven Save v2.0</span>
            <span aria-hidden="true">·</span>
            <span>FYA TECH SAS</span>
          </footer>
        </div>
      </main>

      {/* Panel visual con identidad Seven Save */}
      <aside className="login-media" aria-hidden="true">
        <div className="login-media-img" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="login-media-overlay" />
        <div className="login-media-content">
          <div className="login-media-head">
            <div className="login-mark sm">7S</div>
            <span className="login-media-badge">Suite contractual</span>
          </div>
          <div className="login-media-copy">
            <h2>
              Cada contrato, <b>bajo control</b>.
            </h2>
            <ul>
              <li>
                <Icon name="check-circle" /> Semáforo contractual y alertas tempranas en tiempo real
              </li>
              <li>
                <Icon name="check-circle" /> Expediente digital con trazabilidad y auditoría completa
              </li>
              <li>
                <Icon name="check-circle" /> Pólizas, cupos y garantías siempre vigentes
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
