import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { BrandSymbol, PublicShell } from './PublicShell';
import { getSupabaseClient } from '../../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmation = (location.state as { message?: string } | null)?.message;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !data.user || !data.session || data.user.is_anonymous) {
        setError(
          authError?.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : authError &&
                ((authError.status && authError.status >= 500) ||
                  authError.name === 'AuthRetryableFetchError')
              ? 'O serviço de acesso está indisponível no momento. Tente novamente em instantes.'
              : 'Não foi possível entrar. Verifique o e-mail e a senha.',
        );
        return;
      }
      setPassword('');
      navigate('/conta', { replace: true, state: null });
    } catch {
      setError(
        'Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

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
          <p>
            Use seu e-mail e a senha inicial fornecida pelo responsável pelo cadastro. Na primeira
            entrada você definirá uma senha pessoal.
          </p>

          {confirmation && (
            <div className="login-status" role="status">
              <p>{confirmation}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="secure-access-error">
              {error}
            </p>
          )}

          <form aria-label="Acessar sua conta" onSubmit={(event) => void signIn(event)}>
            <fieldset disabled={loading}>
              <label className="form-row" htmlFor="login-email">
                E-mail
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seuemail@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <Button type="submit" disabled={!email.trim() || !password}>
                {loading ? 'Entrando...' : 'Entrar'} <ArrowRight size={17} />
              </Button>
            </fieldset>
          </form>

          <p className="login-provisioning">
            O cadastro é feito pelo responsável pelo seu acesso. Cada pessoa define sua senha e
            confirma os documentos individualmente.
          </p>
          <div className="access-legal-links">
            <Link to="/termos">Termos de Uso (prévia)</Link>
            <Link to="/privacidade">Política de Privacidade (prévia)</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
