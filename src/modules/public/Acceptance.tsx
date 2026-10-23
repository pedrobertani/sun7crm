import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useCrm } from '../../app/context';
import { LEGAL } from '../../domain/legal';
import { roleLabels } from '../../domain/config';
import { Button } from '../../components/ui/button';
import { PublicShell } from './PublicShell';
export function Acceptance() {
  const { data, session, acceptLegal, logout } = useCrm();
  const [terms, setTerms] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const navigate = useNavigate();
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const member = data.members.find((m) => m.id === session.memberId);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (terms && privacy) acceptLegal(terms, privacy);
  }
  return (
    <PublicShell title="Primeiro acesso · SUN7CRM">
      <main className="consent-page public-container">
        <section className="consent-card">
          <span className="consent-icon">
            <ShieldCheck size={28} />
          </span>
          <span className="home-eyebrow">PRIMEIRO ACESSO</span>
          <h1>
            Antes de explorar,
            <br />
            vamos alinhar o essencial.
          </h1>
          <p>
            Conheça as condições de uso e como os dados são tratados. Os documentos podem ser lidos
            sem prosseguir.
          </p>
          <div className="consent-person">
            <strong>
              {session.role === 'admin'
                ? 'Administrador da plataforma'
                : member?.name || 'Perfil de exemplo'}
            </strong>
            <span>
              {session.role === 'admin' ? 'SUN7CRM' : company.displayName || company.name} ·{' '}
              {roleLabels[session.role]}
            </span>
          </div>
          <div className="legal-draft">
            <strong>Simulação para validação</strong>
            <p>
              Os textos são preliminares. Este teste não celebra contrato, não gera cobrança e não
              autoriza o uso de dados reais.
            </p>
          </div>
          <form onSubmit={submit}>
            <label className="legal-check">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                required
              />
              <span>
                Li e aceito, nesta simulação, os{' '}
                <Link to="/termos" target="_blank" rel="noopener noreferrer">
                  Termos de Uso <span className="sr-only">(abre em nova aba)</span>
                </Link>
                .
              </span>
            </label>
            <label className="legal-check">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                required
              />
              <span>
                Declaro que li a{' '}
                <Link to="/privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade <span className="sr-only">(abre em nova aba)</span>
                </Link>{' '}
                e estou ciente das informações apresentadas.
              </span>
            </label>
            <p className="consent-version">
              {LEGAL.label}
              <br />
              Termos: {LEGAL.terms} · Privacidade: {LEGAL.privacy}
            </p>
            <Button disabled={!terms || !privacy}>
              Simular confirmação e continuar <ArrowRight size={17} />
            </Button>
          </form>
          <button
            className="consent-exit"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Sair sem confirmar
          </button>
          <small className="consent-footnote">
            Registro apenas neste navegador, por pessoa e empresa simuladas. Não equivale ao
            consentimento dos clientes ou a um comprovante de identidade.
          </small>
        </section>
      </main>
    </PublicShell>
  );
}
