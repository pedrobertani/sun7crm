import { LEGAL } from '../../domain/legal';
import { Link, useSearchParams } from 'react-router-dom';
import { CRM_THEMES, resolveTheme, type CrmTheme } from '../../lib/themes';
import { Check, UserRound, Building2, Palette, Info } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Settings2, ShieldCheck, RotateCcw, Upload, FlaskConical } from 'lucide-react';
import { useCrm } from '../../app/context';
import { roleLabels } from '../../domain/config';
import { initials } from '../../lib/format';
import { Heading, Panel, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
export function Settings() {
  const { data, session, update, notice, reset, acceptance } = useCrm();
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const member = data.members.find((m) => m.id === session.memberId);
  const [password, setPassword] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(company.displayName || company.name);
  const [theme, setTheme] = useState<CrmTheme>(resolveTheme(company.theme, company.template).value);
  const manager = session.role === 'manager';
  const [params] = useSearchParams();
  const tabs = [
    { value: 'conta', label: 'Minha conta', icon: UserRound },
    ...(manager
      ? [
          { value: 'empresa', label: 'Empresa', icon: Building2 },
          { value: 'aparencia', label: 'Aparência', icon: Palette },
        ]
      : []),
    { value: 'privacidade', label: 'Privacidade', icon: ShieldCheck },
    { value: 'previa', label: 'Sobre a prévia', icon: Info },
  ];
  const active = tabs.some((tab) => tab.value === params.get('aba')) ? params.get('aba')! : 'conta';
  function saveCompany(e: FormEvent) {
    e.preventDefault();
    if (!manager) return;
    if (!name.trim()) {
      setError('Informe o nome da empresa.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        companies: d.companies.map((c) =>
          c.id === company.id ? { ...c, displayName: name.trim() } : c,
        ),
      }))
    ) {
      setError('');
      notice('Dados da empresa atualizados.');
    }
  }
  function saveAppearance(e: FormEvent) {
    e.preventDefault();
    if (!manager) return;
    if (
      update((d) => ({
        ...d,
        companies: d.companies.map((c) => (c.id === company.id ? { ...c, theme } : c)),
      }))
    ) {
      notice('Aparência atualizada para a empresa.');
    }
  }
  async function upload(file?: File) {
    if (!manager || !file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 500000) {
      setError('Selecione uma imagem PNG, JPG ou WebP de até 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (
        update((d) => ({
          ...d,
          companies: d.companies.map((c) =>
            c.id === company.id ? { ...c, logo: String(reader.result) } : c,
          ),
        }))
      )
        notice('Logo atualizada.');
    };
    reader.onerror = () => setError('Não foi possível ler a imagem.');
    reader.readAsDataURL(file);
  }
  return (
    <>
      <Heading
        eyebrow="PREFERÊNCIAS"
        title="Configurações"
        description="Sua conta, identidade da empresa e opções deste ambiente de validação."
      />
      <nav className="settings-tabs" aria-label="Seções das configurações">
        {tabs.map(({ value, label, icon: Icon }) => (
          <Link
            key={value}
            to={'/configuracoes?aba=' + value}
            aria-current={active === value ? 'page' : undefined}
            className={active === value ? 'active' : ''}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="settings-section">
        {active === 'conta' && (
          <Panel
            title="Minha conta"
            description="Informações do perfil em visualização."
            action={<ShieldCheck size={20} className="muted" />}
          >
            <div className="detail-person">
              <span className="avatar big">
                {initials(session.role === 'admin' ? 'Caio' : member?.name || 'Usuário')}
              </span>
              <div>
                <h3>{session.role === 'admin' ? 'Caio' : member?.name || 'Usuário da prévia'}</h3>
                <p>{roleLabels[session.role]}</p>
                <small className="muted">{member?.email || 'Administração da plataforma'}</small>
              </div>
            </div>
            <Button variant="outline" onClick={() => setPassword(true)}>
              Alterar minha senha
            </Button>
            <p className="small-note">
              {session.role === 'admin'
                ? 'A recuperação excepcional do administrador será definida antes da ativação real.'
                : session.role === 'manager'
                  ? 'Se perder sua senha, solicite a redefinição ao administrador da plataforma.'
                  : 'Se perder sua senha, solicite a redefinição ao gestor da sua equipe.'}
            </p>
          </Panel>
        )}
        {active === 'empresa' && manager && (
          <Panel
            title="Empresa"
            description="Personalize o nome e o logo que sua equipe vê na área de trabalho."
          >
            <form key={company.id} onSubmit={saveCompany}>
              <div className="brand-editor">
                <span className="brand-preview">
                  {company.logo ? (
                    <img src={company.logo} alt={'Logo ' + company.name} />
                  ) : (
                    initials(company.displayName || company.name)
                  )}
                </span>
                <div>
                  <label className="btn btn-outline upload-label">
                    <Upload size={15} />
                    Enviar logo
                    <Input
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void upload(e.target.files?.[0])}
                    />
                  </label>
                  <p className="small-note">PNG, JPG ou WebP · até 500 KB</p>
                </div>
                {company.logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        companies: d.companies.map((c) =>
                          c.id === company.id ? { ...c, logo: undefined } : c,
                        ),
                      }))
                    }
                  >
                    Remover
                  </Button>
                )}
              </div>
              <div className="form-grid">
                <label className="form-row">
                  Nome exibido no sistema
                  <Input
                    required
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </div>
              <FormError message={error} />
              <div className="form-actions">
                <Button>Salvar empresa</Button>
              </div>
            </form>
          </Panel>
        )}
        {active === 'aparencia' && manager && (
          <Panel
            title="Aparência"
            description="Personalize as cores da área de trabalho da sua equipe."
          >
            <form onSubmit={saveAppearance}>
              <fieldset className="theme-fieldset">
                <legend>Cores da empresa</legend>
                <p className="small-note">
                  Escolha uma paleta para os menus, botões e gráficos de toda a equipe.
                </p>
                <div
                  className="theme-grid"
                  role="radiogroup"
                  aria-label="Paleta de cores da empresa"
                >
                  {CRM_THEMES.map((t) => (
                    <label
                      key={t.value}
                      className={'theme-option ' + (theme === t.value ? 'selected' : '')}
                    >
                      <input
                        type="radio"
                        name="company-theme"
                        value={t.value}
                        checked={theme === t.value}
                        onChange={() => setTheme(t.value)}
                      />
                      <span className="theme-name">
                        {t.label}
                        {theme === t.value && <Check size={14} />}
                      </span>
                      <span className="theme-swatches">
                        {t.colors.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="small-note">A escolha será aplicada ao salvar a aparência.</p>
              </fieldset>
              <div className="form-actions">
                <Button>Salvar aparência</Button>
              </div>
            </form>
          </Panel>
        )}
        {active === 'privacidade' && (
          <Panel
            title="Privacidade e documentos"
            description="Consulte as condições de uso e as informações sobre tratamento de dados."
          >
            <div className="access-legal-links">
              <Link to="/termos" target="_blank" rel="noopener noreferrer">
                Termos de Uso
              </Link>
              <Link to="/privacidade" target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </Link>
            </div>
            <p className="small-note">
              Versão dos Termos: {LEGAL.terms}
              <br />
              Versão da Política: {LEGAL.privacy}
            </p>
            <p className="small-note">
              {acceptance
                ? 'Confirmação simulada registrada em ' +
                  new Date(acceptance.acceptedAt).toLocaleString('pt-BR') +
                  ', neste navegador.'
                : 'Nenhuma confirmação registrada para este perfil.'}
            </p>
            <div className="info-box">
              O registro desta demo é local. Os documentos ainda são preliminares e a aplicação não
              deve receber dados reais.
            </div>
          </Panel>
        )}
        {active === 'previa' && (
          <Panel
            title="Sobre a prévia"
            description="Uma base para validarmos juntos."
            action={<FlaskConical size={20} className="muted" />}
          >
            <div className="status-list">
              <div>
                <span className="status-dot" />
                <strong>Dados somente no navegador</strong>
              </div>
              <p>
                Os cadastros são fictícios. Não são sincronizados entre dispositivos e podem ser
                apagados ao limpar o navegador.
              </p>
              <div>
                <Settings2 size={15} />
                <strong>Perfis para demonstração</strong>
              </div>
              <p>
                Os seletores do topo trocam a empresa e a visão de usuário. Não representam login ou
                controle de segurança real.
              </p>
            </div>
            <Button variant="outline" onClick={() => setConfirm(true)}>
              <RotateCcw size={15} />
              Restaurar dados de exemplo
            </Button>
          </Panel>
        )}
      </div>
      <Modal
        open={password}
        onOpenChange={setPassword}
        title="Alterar minha senha"
        description="Opção prevista para a versão com autenticação."
      >
        <div className="info-box">
          Você poderá alterar sua senha nesta área, sem obrigação de trocar no primeiro acesso. A
          funcionalidade será ativada junto com a autenticação real. Não informe uma senha nesta
          prévia.
        </div>
        <Button variant="outline" onClick={() => setPassword(false)}>
          Entendi
        </Button>
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Restaurar dados fictícios?"
        description="Todos os cadastros e alterações locais desta prévia serão substituídos pelos exemplos iniciais."
      >
        <div className="form-actions">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              reset();
              setConfirm(false);
              setName('Clínica Aurora');
              setTheme('sun7');
            }}
          >
            Restaurar exemplos
          </Button>
        </div>
      </Modal>
    </>
  );
}
