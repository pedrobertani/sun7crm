import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { uid } from '../../lib/format';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { PublicShell } from '../public/PublicShell';
import { passwordValidation } from './flow';
import { loadAccountAccess, type AccountAccess } from './access';
import { AdminWorkspace } from '../admin/AdminWorkspace';
const StaffWorkspace = lazy(() =>
  import('../workspace/StaffWorkspace').then((module) => ({ default: module.StaffWorkspace })),
);

type Gate =
  | Exclude<AccountAccess, { stage: 'signed-out' }>
  | { stage: 'loading' }
  | { stage: 'error'; message: string };

const UNSAFE_DATA_MESSAGE = 'Não informe dados de clientes reais durante os testes desta etapa.';

export function RealAccess({
  adminPage = false,
  staffPage = false,
}: {
  adminPage?: boolean;
  staffPage?: boolean;
}) {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [gate, setGate] = useState<Gate>({ stage: 'loading' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const recheck = useCallback(() => {
    setGate({ stage: 'loading' });
    setRefresh((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const access = await loadAccountAccess(getSupabaseClient());
        if (!active) return;
        if (access.stage === 'signed-out') {
          navigate('/acessar', { replace: true });
          return;
        }
        setGate(access);
      } catch {
        if (active)
          setGate({
            stage: 'error',
            message: 'Não foi possível verificar sua conta. Confira sua conexão e tente novamente.',
          });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [navigate, refresh]);

  useEffect(() => {
    const { data } = getSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setGate({ stage: 'loading' });
        navigate('/acessar', { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function logout() {
    setBusy(true);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      navigate('/acessar', { replace: true });
    } catch {
      setNotice('Não foi possível encerrar a sessão. Tente novamente.');
      throw Error('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = passwordValidation(newPassword, confirmPassword);
    if (validation) {
      setNotice(validation);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.functions.invoke('crm-first-access', {
        body: { password: newPassword },
        headers: { 'Idempotency-Key': uid() },
      });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
      navigate('/acessar', {
        replace: true,
        state: {
          message: 'Senha pessoal cadastrada. Entre novamente com sua nova senha para continuar.',
        },
      });
    } catch {
      setNotice(
        'A troca não pôde ser confirmada. Se sua senha foi alterada, encerre a sessão e entre novamente com ela.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function acceptDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (gate.stage !== 'accept' || !termsChecked || !privacyChecked) {
      setNotice('Confirme os Termos de Uso e a ciência da Política de Privacidade.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('crm_legal_acceptances')
        .insert(gate.pending.map((doc) => ({ kind: doc.kind, version: doc.version })));
      if (error) throw error;
      setTermsChecked(false);
      setPrivacyChecked(false);
      recheck();
    } catch {
      setNotice('Não foi possível registrar a confirmação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (gate.stage === 'ready' && gate.isAdmin) {
    if (!adminPage) return <Navigate to="/admin" replace />;
    return (
      <AdminWorkspace key={gate.user.id} user={gate.user} onLogout={logout} onRecheck={recheck} />
    );
  }
  if (gate.stage === 'ready' && !adminPage) {
    if (!staffPage) return <Navigate to="/app" replace />;
    return (
      <Suspense fallback={<p role="status">Carregando sua área de trabalho...</p>}>
        <StaffWorkspace key={gate.user.id} user={gate.user} onLogout={logout} onRecheck={recheck} />
      </Suspense>
    );
  }

  return (
    <PublicShell title="Minha conta · SUN7CRM">
      <main className="secure-access-page public-container">
        <section className="secure-access-card" aria-live="polite">
          <div className="secure-access-head">
            <ShieldCheck size={22} aria-hidden="true" />
            <span>ÁREA SEGURA · SUN7CRM</span>
          </div>
          {gate.stage === 'loading' && <p>Verificando sua sessão e permissões...</p>}
          {gate.stage === 'error' && (
            <>
              <h1>Não foi possível verificar sua conta</h1>
              <p>{gate.message}</p>
              <Button type="button" onClick={() => setRefresh((value) => value + 1)}>
                Tentar novamente
              </Button>
            </>
          )}
          {gate.stage === 'password' && (
            <>
              <h1>Defina sua senha pessoal</h1>
              <p>
                Primeiro acesso de <strong>{gate.email}</strong>. Antes de utilizar o CRM, substitua
                a senha temporária. O responsável que cadastrou sua conta não deverá conhecer a nova
                senha.
              </p>
              <form onSubmit={changePassword}>
                <label className="form-row">
                  Nova senha
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                </label>
                <label className="form-row">
                  Confirme a nova senha
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                </label>
                <p className="small-note">
                  Mínimo de 12 caracteres e máximo de 72 bytes. Depois da troca, você entrará
                  novamente com sua senha pessoal.
                </p>
                <Button type="submit" disabled={busy || !newPassword || !confirmPassword}>
                  <LockKeyhole size={17} /> {busy ? 'Atualizando...' : 'Alterar senha e continuar'}
                </Button>
              </form>
            </>
          )}
          {gate.stage === 'legal-unavailable' && (
            <>
              <h1>Documentos em preparação</h1>
              <p>
                Sua senha pessoal já está configurada para <strong>{gate.email}</strong>.
              </p>
              <p>
                O acesso operacional está bloqueado até a publicação dos Termos e da Política de
                Privacidade definitivos. Os documentos de homologação devem ser confirmados por
                você, individualmente, antes de utilizar o ambiente autenticado.
              </p>
              <p className="small-note">{UNSAFE_DATA_MESSAGE}</p>
              <Button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                disabled={busy}
              >
                Verificar novamente
              </Button>
            </>
          )}
          {gate.stage === 'accept' && (
            <>
              <h1>Confirmação individual</h1>
              <p>
                Leia os documentos de homologação vinculados à sua conta,{' '}
                <strong>{gate.email}</strong>. A confirmação ficará registrada individualmente no
                Supabase. Esta versão é para testes internos e uma nova confirmação será solicitada
                após aprovação dos documentos definitivos.
              </p>
              <form onSubmit={acceptDocuments}>
                {gate.documents.map((doc) => (
                  <section className="secure-document" key={doc.kind}>
                    <h2>{doc.kind === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}</h2>
                    <p className="small-note">Versão {doc.version}</p>
                    <div className="secure-document-content" tabIndex={0}>
                      {doc.body}
                    </div>
                  </section>
                ))}
                <label className="secure-check">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => setTermsChecked(e.target.checked)}
                  />{' '}
                  Li e aceito os Termos de Uso apresentados.
                </label>
                <label className="secure-check">
                  <input
                    type="checkbox"
                    checked={privacyChecked}
                    onChange={(e) => setPrivacyChecked(e.target.checked)}
                  />{' '}
                  Li e tomei ciência da Política de Privacidade apresentada.
                </label>
                <Button type="submit" disabled={!termsChecked || !privacyChecked || busy}>
                  {busy ? 'Registrando...' : 'Confirmar e continuar'} <ArrowRight size={17} />
                </Button>
              </form>
            </>
          )}
          {gate.stage === 'ready' && (
            <>
              <h1>{adminPage ? 'Acesso restrito à administração' : 'Conta verificada'}</h1>
              <p>
                Sessão real de <strong>{gate.email}</strong>, senha pessoal configurada e documentos
                de homologação confirmados para testes internos.
              </p>
              <p>
                {adminPage
                  ? 'Seu perfil não possui permissão de administrador da plataforma.'
                  : 'O painel de atendimento da empresa está em integração. Seus dados e seu acesso permanecem separados da demonstração.'}
              </p>
              <p className="small-note">{UNSAFE_DATA_MESSAGE}</p>
            </>
          )}
          {gate.stage !== 'loading' && (
            <>
              {notice && (
                <p role="alert" className="secure-access-error">
                  {notice}
                </p>
              )}
              <div className="secure-access-foot">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void logout().catch(() => {});
                  }}
                  disabled={busy}
                >
                  Sair da conta
                </Button>
                <Link to="/demo">Abrir demonstração fictícia</Link>
              </div>
            </>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
