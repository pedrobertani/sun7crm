import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCrm } from './context';
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
          <p>Escolha uma empresa de exemplo e explore todas as funcionalidades do CRM.</p>
          <div className="access-note">
            <p>
              A demonstração usa dados fictícios para apresentar o produto. Não informe senhas ou
              dados pessoais reais. Para usar sua conta, selecione Acessar.
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
              choose('manager');
              enterPreview();
              navigate('/demo/painel');
            }}
          >
            <label className="form-row">
              Empresa de exemplo
              <select value={session.companyId} onChange={(e) => choose('manager', e.target.value)}>
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName || c.name}
                  </option>
                ))}
              </select>
            </label>

            <Button>
              Continuar <ArrowRight size={17} />
            </Button>
          </form>
        </section>
      </main>
    </PublicShell>
  );
}
