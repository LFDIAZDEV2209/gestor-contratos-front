'use client';
import { Modal, type ModalProps } from './Modal';
import { PageHeader, Surface } from './Workspace';
export function DetailFrame({ inline = false, ...props }: ModalProps & { inline?: boolean }) {
  if (!inline) return <Modal {...props} />;
  return <Surface><div className="panel-b"><PageHeader><div><h1>{props.title}</h1>{props.subtitle && <p>{props.subtitle}</p>}</div></PageHeader>{props.children}</div>{props.footer && <div className="modal-f">{props.footer}</div>}</Surface>;
}
