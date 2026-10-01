'use client';
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './button';
import { Field } from './Workspace';
type Request = { message: string; reason: boolean; initial: string; resolve: (value: string | boolean | null) => void };
export function notify(message: unknown) { window.dispatchEvent(new CustomEvent('nexo:notice', { detail: String(message) })); }
function ask(message: string, reason: boolean, initial = '') { return new Promise<string | boolean | null>(resolve => window.dispatchEvent(new CustomEvent('nexo:confirm', { detail: { message, reason, initial, resolve } }))); }
export async function confirmAction(message: string) { return await ask(message, false) === true; }
export async function requestReason(message: string, initial = '') { const answer = await ask(message, true, initial); return typeof answer === 'string' ? answer : null; }
export function FeedbackHost() {
  const [notices, setNotices] = useState<{id:number; text:string}[]>([]);
  const [request, setRequest] = useState<Request | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    let sequence = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const notice = (event: Event) => { const id = ++sequence; setNotices(items => [...items.slice(-3), {id, text:(event as CustomEvent<string>).detail}]); const timer=setTimeout(()=>{setNotices(items=>items.filter(item=>item.id!==id));timers.delete(timer);},8000);timers.add(timer); };
    const confirmation = (event: Event) => { const next = (event as CustomEvent<Request>).detail; setReason(next.initial);setRequest(next); };
    window.addEventListener('nexo:notice', notice); window.addEventListener('nexo:confirm', confirmation);
    return () => { timers.forEach(clearTimeout);window.removeEventListener('nexo:notice', notice);window.removeEventListener('nexo:confirm', confirmation); };
  }, []);
  const finish = (value: string | boolean | null) => { request?.resolve(value);setRequest(null); };
  return <><div className="feedback-stack" role="status" aria-live="polite" aria-atomic="false">{notices.map(item=><div className="feedback-notice" key={item.id}><span>{item.text}</span><Button className="icon-btn" aria-label="Cerrar aviso" onClick={()=>setNotices(items=>items.filter(n=>n.id!==item.id))}>×</Button></div>)}</div>{request && <Modal title={request.reason?'Registrar motivo':'Confirmar acción'} onClose={()=>finish(null)} footer={<><Button onClick={()=>finish(null)}>Cancelar</Button><Button variant="destructive" disabled={request.reason && !reason.trim()} onClick={()=>finish(request.reason?reason.trim():true)}>Confirmar</Button></>}><p className="mb">{request.message}</p>{request.reason && <Field><label>Motivo obligatorio</label><textarea value={reason} onChange={event=>setReason(event.target.value)} rows={4} required /></Field>}</Modal>}</>;
}
