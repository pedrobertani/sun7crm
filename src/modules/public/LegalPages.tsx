import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '../../domain/legal';
import legalDrafts from '../../content/legal-drafts.json';
import { PublicShell } from './PublicShell';
export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Política de Privacidade' : 'Termos de Uso';
  const items = isPrivacy ? legalDrafts.privacy : legalDrafts.terms;
  return (
    <PublicShell title={title + ' · SUN7CRM'}>
      <main className="legal-page public-container">
        <Link className="home-text-link" to="/acessar">
          <ArrowLeft size={16} /> Voltar ao acesso
        </Link>
        <div className="legal-heading">
          <span className="home-eyebrow">TRANSPARÊNCIA</span>
          <h1>{title}</h1>
          <p>
            {LEGAL.label} · versão {isPrivacy ? LEGAL.privacy : LEGAL.terms}
          </p>
        </div>
        <aside className="legal-draft">
          <strong>Documento preliminar para validação</strong>
          <p>{legalDrafts.notice}</p>
        </aside>
        <div className="legal-layout">
          <nav aria-label="Neste documento">
            {items.map(({ heading }, i) => (
              <a
                key={heading}
                href={'#secao-' + i}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('secao-' + i)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {i + 1}. {heading}
              </a>
            ))}
          </nav>
          <article>
            {items.map(({ heading, paragraphs }, i) => (
              <section id={'secao-' + i} key={heading}>
                <h2>
                  {i + 1}. {heading}
                </h2>
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </section>
            ))}
            <div className="legal-related">
              <Link to={isPrivacy ? '/termos' : '/privacidade'}>
                {isPrivacy ? 'Consultar Termos de Uso' : 'Consultar Política de Privacidade'}{' '}
                <ArrowRightIcon />
              </Link>
              <Link to="/demo">Voltar à demo</Link>
            </div>
          </article>
        </div>
      </main>
    </PublicShell>
  );
}
function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
