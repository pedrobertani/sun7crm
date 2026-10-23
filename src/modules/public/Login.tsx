import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { BrandSymbol, PublicShell } from './PublicShell';

export function LoginPage() {
  return (
    <PublicShell title="Acessar · SUN7CRM">
      <main className="login-page public-container">
        <section className="login-intro">
          <BrandSymbol className="login-symbol" />
          <span className="home-eyebrow">SEU ESPAÇO NO SUN7CRM</span>
          <h1>
            Sua rotina.
            <br />
            Sua equipe.
            <br />
            <em>Seu próximo passo.</em>
          </h1>
          <p>Organize os atendimentos e acompanhe cada oportunidade com a sua equipe.</p>
          <div className="login-demo-invite">
            <span>Ainda está conhecendo o SUN7CRM?</span>
            <Link to="/demo" className="home-text-link">
              Explorar a demo <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <h2 id="login-title">Acesse sua conta</h2>
          <p>Use o e-mail e a senha fornecidos pelo responsável pelo seu acesso.</p>

          <div className="login-status" id="login-status" role="status">
            <div>
              <strong>Acesso em preparação</strong>
              <p>
                As contas ainda não estão liberadas. Enquanto isso,{' '}
                <Link to="/demo">explore a demo</Link>.
              </p>
            </div>
          </div>

          <form aria-label="Acessar sua conta" onSubmit={(event) => event.preventDefault()}>
            <fieldset disabled aria-describedby="login-status">
              <label className="form-row" htmlFor="login-email">
                E-mail
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seuemail@empresa.com"
                  required
                />
              </label>
              <label className="form-row" htmlFor="login-password">
                Senha
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  required
                />
              </label>
              <Button type="submit">
                Entrar <ArrowRight size={17} />
              </Button>
            </fieldset>
          </form>

          <p className="login-provisioning">
            O gestor recebe seu acesso do administrador da plataforma e cadastra os integrantes da
            equipe. A troca da própria senha ficará disponível nas configurações da conta.
          </p>
          <div className="access-legal-links">
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
