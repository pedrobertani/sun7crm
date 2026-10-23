import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { PublicShell } from './PublicShell';
function BoardIllustration() {
  return (
    <div className="home-product" aria-label="Exemplo ilustrativo de um quadro de atendimento">
      <div className="product-bar">
        <div className="product-avatar">A</div>
        <strong>Clínica Aurora</strong>
        <span>Exemplo ilustrativo</span>
      </div>
      <div className="product-title">
        <span>COMERCIAL</span>
        <h2>Boas conversas viram oportunidades.</h2>
        <div>
          <span className="product-pill">Novos contatos</span>
          <span className="product-muted">Clientes</span>
        </div>
      </div>
      <div className="product-board">
        {[
          {
            name: 'Novo contato',
            color: 'blue',
            cards: [
              {
                name: 'Mariana Costa',
                interest: 'Limpeza de pele',
                temp: 'Morno',
                value: 'R$ 280,00',
              },
              {
                name: 'Amanda Rocha',
                interest: 'Tratamento corporal',
                temp: 'Frio',
                value: 'R$ 650,00',
              },
            ],
          },
          {
            name: 'Em conversa',
            color: 'gold',
            cards: [
              {
                name: 'Juliana Martins',
                interest: 'Harmonização facial',
                temp: 'Quente',
                value: 'R$ 890,00',
              },
            ],
          },
          {
            name: 'Agendado',
            color: 'green',
            cards: [
              {
                name: 'Bruna Pereira',
                interest: 'Avaliação estética',
                temp: 'Quente',
                value: 'R$ 450,00',
              },
            ],
          },
        ].map((col) => (
          <div className={'product-column ' + col.color} key={col.name}>
            <h3>
              <i />
              {col.name}
              <span>{col.cards.length}</span>
            </h3>
            {col.cards.map((c) => (
              <div className="product-card" key={c.name}>
                <span className={'product-temp ' + c.temp.toLowerCase()}>{c.temp}</span>
                <strong>{c.name}</strong>
                <p>{c.interest}</p>
                <b>{c.value}</b>
                <div>
                  <small>Próxima ação definida</small>
                  <Check size={13} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="product-bottom">
        <span>
          <Check size={14} /> Tudo tem um próximo passo.
        </span>
        <span>3 etapas ilustradas</span>
      </div>
    </div>
  );
}
export function Home() {
  return (
    <PublicShell>
      <main className="home-compact">
        <section className="home-hero public-container">
          <div className="hero-copy">
            <span className="home-eyebrow">
              <i /> SEU RELACIONAMENTO, EM MOVIMENTO
            </span>
            <h1>
              Cada conversa.
              <br />
              Uma oportunidade.
              <br />
              <em>Um próximo passo.</em>
            </h1>
            <p>
              Organize seus contatos, acompanhe cada atendimento e saiba qual é o próximo passo com
              seus clientes.
            </p>
            <div className="hero-actions">
              <Link className="home-primary" to="/demo">
                Explorar a demo <ArrowRight size={18} />
              </Link>
              <Link className="home-text-link" to="/recursos">
                Conhecer as funcionalidades <ArrowUpRight size={17} />
              </Link>
            </div>
            <small className="hero-note">
              Prévia interativa com dados fictícios. Sem cadastro ou senha.
            </small>
          </div>
          <div className="hero-product">
            <BoardIllustration />
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
