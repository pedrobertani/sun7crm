import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserRound, Settings, CreditCard, LogOut } from 'lucide-react';
import { Modal } from './ui/modal';

export function AccountMenu({
  name,
  email,
  role,
  settings,
  plan,
  busy,
  onLogout,
}: {
  name: string;
  email?: string;
  role: string;
  settings?: string;
  plan?: string;
  busy?: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <>
      <div
        className="account-menu"
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          className="icon-button account-trigger"
          aria-label="Menu do usuário"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <UserRound size={21} />
        </button>
        {
          <div className="account-popover" hidden={!open}>
            <div className="account-identity">
              <strong>{name}</strong>
              <small>{role}</small>
            </div>
            <nav aria-label="Opções da conta">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setAccount(true);
                }}
              >
                <UserRound size={17} />
                Minha conta
              </button>
              {settings && (
                <Link to={settings}>
                  <Settings size={17} />
                  Configurações
                </Link>
              )}
              {plan && (
                <Link to={plan}>
                  <CreditCard size={17} />
                  Plano
                </Link>
              )}
              <button type="button" disabled={busy} onClick={onLogout}>
                <LogOut size={17} />
                Sair da conta
              </button>
            </nav>
          </div>
        }
      </div>
      <Modal
        open={account}
        onOpenChange={setAccount}
        title="Minha conta"
        description="Informações da sua conta de acesso."
      >
        <dl className="account-details">
          <dt>Nome</dt>
          <dd>{name}</dd>
          <dt>E-mail</dt>
          <dd>{email || 'Não informado'}</dd>
          <dt>Perfil</dt>
          <dd>{role}</dd>
        </dl>
      </Modal>
    </>
  );
}
