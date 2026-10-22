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
  const { data, session, update, notice, reset } = useCrm();
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const member = data.members.find((m) => m.id === session.memberId);
  const [password, setPassword] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(company.name);
  const [segment, setSegment] = useState(company.segment);
  const [template, setTemplate] = useState(company.template);
  const manager = session.role === 'manager';
  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da empresa.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        companies: d.companies.map((c) =>
          c.id === company.id ? { ...c, name: name.trim(), segment: segment.trim(), template } : c,
        ),
      }))
    ) {
      setError('');
      notice('Identidade atualizada.');
    }
  }
  async function upload(file?: File) {
    if (!file) return;
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
      <div className="settings-grid">
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
                ? 'Se perder sua senha, solicite a redefinição a Caio.'
                : 'Se perder sua senha, solicite a redefinição ao gestor da sua equipe.'}
          </p>
        </Panel>
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
      </div>
      {manager && (
        <Panel
          title="Identidade da empresa"
          description="Personalize a apresentação da sua área de trabalho."
        >
          <form key={company.id} onSubmit={save}>
            <div className="brand-editor">
              <span className="brand-preview">
                {company.logo ? (
                  <img src={company.logo} alt={'Logo ' + company.name} />
                ) : (
                  initials(company.name)
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
                Nome da empresa
                <Input
                  required
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="form-row">
                Segmento
                <Input
                  value={segment}
                  maxLength={100}
                  onChange={(e) => setSegment(e.target.value)}
                />
              </label>
              <label className="form-row">
                Template
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as typeof template)}
                >
                  <option value="aesthetic">Estética · verde</option>
                  <option value="generic">Genérico · azul</option>
                </select>
              </label>
            </div>
            <FormError message={error} />
            <div className="form-actions">
              <Button>Salvar identidade</Button>
            </div>
          </form>
        </Panel>
      )}
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
              setSegment('Estética e bem-estar');
              setTemplate('aesthetic');
            }}
          >
            Restaurar exemplos
          </Button>
        </div>
      </Modal>
    </>
  );
}
