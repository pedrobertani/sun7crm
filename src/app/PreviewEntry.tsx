import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCrm } from './context';
import { roleLabels } from '../domain/config';
import type { Role } from '../domain/types';
import { Button } from '../components/ui/button';
import { PublicShell, BrandSymbol } from '../modules/public/PublicShell';
export function PreviewEntry() {
  const { data, session, setSession, enterPreview } = useCrm();
  const navigate = useNavigate();
  function choose(role: Role, companyId = session.companyId) {
    const member = data.members.find(
      (m) => m.companyId === companyId && m.role === role && m.active,
    );
    setSession({ role, companyId, memberId: member?.id || '' });
  }
  return (
    <PublicShell title="Explorar a demo · SUN7CRM">
      <main className="access-page public-container">
        <div className="access-intro">
          <BrandSymbol className="access-symbol" />
          <span className="home-eyebrow">DEMONSTRAÇÃO DO SUN7CRM</span>
          <h1>Sua próxima boa conversa começa aqui.</h1>
          <p>Escolha uma empresa e um perfil de exemplo para explorar o CRM.</p>
          <div className="access-note">
            <p>
              Este acesso é simulado. Não informe senhas ou dados pessoais reais. A criação de
              contas será feita pelo administrador e pelos gestores na versão com autenticação.
            </p>
          </div>
          <Link className="home-text-link" to="/recursos">
            Conheça o que você pode explorar <ArrowRight size={16} />
          </Link>
        </div>
        <section className="access-card">
          <h2>Explorar a demo</h2>
          <p>Experimente a rotina da empresa e da equipe.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enterPreview();
              navigate('/painel');
            }}
          >
            <label className="form-row">
              Empresa de exemplo
              <select
                value={session.companyId}
                onChange={(e) => choose(session.role, e.target.value)}
              >
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName || c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Perfil de exemplo
              <select value={session.role} onChange={(e) => choose(e.target.value as Role)}>
                {Object.entries(roleLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Button>
              Continuar <ArrowRight size={17} />
            </Button>
          </form>
          <small>
            No primeiro acesso de cada perfil, você verá a confirmação simulada dos documentos.
          </small>
          <div className="access-legal-links">
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
