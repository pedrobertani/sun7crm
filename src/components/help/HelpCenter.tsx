import { useMemo, useState } from 'react';
import { CircleHelp, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import { helpTopics, helpRoleLabel, type HelpAccess } from './topics';
import './help.css';

export function HelpCenter({ role, keys, scope, demo = false }: HelpAccess) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const topics = useMemo(
    () => helpTopics({ role, keys, scope, demo }),
    [role, keys, scope, demo],
  );
  const filtered = topics.filter((topic) =>
    [topic.title, topic.section, topic.intro, ...topic.steps]
      .join(' ').toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  const sections = [...new Set(filtered.map((topic) => topic.section))];

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="top-control-icon help-trigger"
        aria-label="Ajuda e informações do sistema"
        title="Ajuda e informações do sistema"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={20} aria-hidden="true" />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="wide"
        title="Ajuda e informações · SUN7CRM"
        description="Orientações conforme seu perfil e suas permissões de acesso."
      >
        <div className="help-center">
          <div className="help-center-intro">
            <strong>{helpRoleLabel(role)}</strong>
            <p className="small-note">
              Você está vendo somente os processos liberados para seu perfil.
              {demo ? ' Esta é uma demonstração com dados fictícios.' : ' A empresa define suas permissões.'}
            </p>
          </div>
          <label className="help-center-search">
            <span className="sr-only">Buscar na ajuda</span>
            <Search size={17} aria-hidden="true" />
            <Input
              type="search"
              value={search}
              placeholder="Buscar um processo ou funcionalidade"
              aria-label="Buscar na ajuda"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {sections.length ? sections.map((section) => (
            <section className="help-center-section" key={section} aria-label={section}>
              <h3>{section}</h3>
              <div className="help-center-items">
                {filtered.filter((topic) => topic.section === section).map((topic) => (
                  <details key={topic.id} className="help-center-topic">
                    <summary>{topic.title}</summary>
                    <div className="help-center-topic-body">
                      <p>{topic.intro}</p>
                      <ol>{topic.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                      {topic.route && (
                        <Link to={topic.route} onClick={() => setOpen(false)}>
                          Abrir {topic.title}
                        </Link>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )) : (
            <p role="status" className="small-note">Nenhum processo encontrado para essa busca.</p>
          )}
          <p className="small-note">
            A ajuda não modifica permissões. Para liberar um processo indisponível, fale com o gestor
            ou administrador responsável.
          </p>
        </div>
      </Modal>
    </>
  );
}
