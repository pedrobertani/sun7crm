import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
export function BrandSymbol({ className = '' }: { className?: string }) {
  return (
    <span className={'sun7-symbol ' + className} aria-hidden="true">
      <img src="/brand/sun7-symbol.jpg" alt="" width="1536" height="1536" />
    </span>
  );
}
export function Brand() {
  return (
    <Link to="/" className="public-brand" aria-label="SUN7CRM início">
      <BrandSymbol />
      <strong>
        SUN7<span>CRM</span>
      </strong>
    </Link>
  );
}
export function PublicShell({
  children,
  title = 'SUN7CRM · Cada conversa, um próximo passo',
}: {
  children: ReactNode;
  title?: string;
}) {
  const location = useLocation();
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = title;
    scrollArea.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [title, location.pathname]);
  return (
    <div className="public-site" ref={scrollArea}>
      <header className="public-header">
        <div className="public-container">
          <Brand />
          <nav aria-label="Menu do site">
            <Link to="/recursos">Funcionalidades</Link>
            <Link to="/contato">Contato</Link>
            <Link to="/privacidade" className="nav-privacy">
              Privacidade
            </Link>
          </nav>
          <Link to="/acessar" className="public-access">
            Acessar <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      {children}
      <footer className="public-footer">
        <div className="public-container">
          <div>
            <Brand />
            <p>Organização para cuidar de cada oportunidade.</p>
            <small>Prévia em desenvolvimento · use apenas dados fictícios.</small>
          </div>
          <nav aria-label="Informações institucionais">
            <Link to="/">Início</Link>
            <Link to="/recursos">Funcionalidades</Link>
            <Link to="/contato">Contato</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
            <Link to="/termos">Termos de Uso</Link>
          </nav>
        </div>
        <div className="public-container footer-bottom">
          <small>© 2026 SUN7CRM</small>
          <span>Uma rotina mais simples. Um atendimento mais próximo.</span>
        </div>
      </footer>
    </div>
  );
}
