import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { PublicShell } from '../public/PublicShell';
import {
  legalReadiness,
  passwordValidation,
  type PublishedDocument,
  type RequiredDocument,
  type LegalAcceptance,
} from './flow';

type Gate =
  | { stage: 'loading' }
  | { stage: 'password'; email: string }
  | { stage: 'legal-unavailable'; email: string }
  | { stage: 'accept'; email: string; documents: PublishedDocument[] }
  | { stage: 'ready'; email: string }
  | { stage: 'error'; message: string };

const UNSAFE_DATA_MESSAGE = 'Não informe dados de clientes reais durante os testes desta etapa.';

export function RealAccess() {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [gate, setGate] = useState<Gate>({ stage: 'loading' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !auth.user || auth.user.is_anonymous) {
          navigate('/acessar', { replace: true });
          return;
        }
        const { data: firstAccess, error: firstAccessError } =
          await supabase.rpc('crm_first_access_status');
        if (firstAccessError) throw firstAccessError;
        if (!firstAccess || firstAccess.password_change_required !== false) {
          if (active) setGate({ stage: 'password', email: auth.user.email || '' });
          return;
        }

        const [req, docs, acceptance] = await Promise.all([
          supabase.from('crm_legal_requirements').select('kind,version'),
          supabase.from('crm_legal_documents').select('kind,version,body,content_sha256,published_at'),
          supabase.from('crm_legal_acceptances').select('kind,version').eq('user_id', auth.user.id),
        ]);
        if (req.error || docs.error || acceptance.error) {
          throw req.error || docs.error || acceptance.error || Error('Consulta indisponível');
        }
        const result = legalReadiness(
          (req.data || []) as RequiredDocument[],
          (docs.data || []) as PublishedDocument[],
          (acceptance.data || []) as LegalAcceptance[],
        );
        if (!active) return;
        if (!result.ready) setGate({ stage: 'legal-unavailable', email: auth.user.email || '' });
        else if (!result.accepted) {
          setGate({ stage: 'accept', email: auth.user.email || '', documents: result.documents });
        } else setGate({ stage: 'ready', email: auth.user.email || '' });
      } catch {
        if (active) setGate({
          stage: 'error',
          message: 'Não foi possível consultar a segurança da conta. Confira a configuração e tente novamente.',
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [navigate, refresh]);

  async function logout() {
    setBusy(true);
    try {
      await getSupabaseClient().auth.signOut();
      navigate('/acessar', { replace: true });
    } catch {
      setNotice('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = passwordValidation(newPassword, confirmPassword);
    if (validation) { setNotice(validation); return; }
    setBusy(true);
    setNotice('');
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.functions.invoke('crm-first-access', {
        body: { password: newPassword },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
      navigate('/acessar', { replace: true, state: {
        message: 'Senha pessoal cadastrada. Entre novamente com sua nova senha para continuar.',
      } });
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
      const { error } = await supabase.from('crm_legal_acceptances').insert(
        gate.documents.map((doc) => ({ kind: doc.kind, version: doc.version })),
      );
      if (error) throw error;
      setRefresh((value) => value + 1);
    } catch {
      setNotice('Não foi possível registrar a confirmação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell title="Minha conta · SUN7CRM">
      <main className="secure-access-page public-container">
        <section className="secure-access-card" aria-live="polite">
          <div className="secure-access-head"><ShieldCheck size={22} aria-hidden="true" />
            <span>ÁREA SEGURA · SUN7CRM</span></div>
          {gate.stage === 'loading' && <p>Verificando sua sessão e permissões...</p>}
          {gate.stage === 'error' && <>
            <h1>Não foi possível verificar sua conta</h1>
            <p>{gate.message}</p>
            <Button type="button" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</Button>
          </>}
          {gate.stage === 'password' && <>
            <h1>Defina sua senha pessoal</h1>
            <p>Primeiro acesso de <strong>{gate.email}</strong>. Antes de utilizar o CRM, substitua a senha temporária. O responsável que cadastrou sua conta não deverá conhecer a nova senha.</p>
            <form onSubmit={changePassword}>
              <label className="form-row">Nova senha
                <Input type="password" autoComplete="new-password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} required minLength={12}/>
              </label>
              <label className="form-row">Confirme a nova senha
                <Input type="password" autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12}/>
              </label>
              <p className="small-note">Mínimo de 12 caracteres e máximo de 72 bytes. Depois da troca, você entrará novamente com sua senha pessoal.</p>
              <Button type="submit" disabled={busy || !newPassword || !confirmPassword}>
                <LockKeyhole size={17} /> {busy ? 'Atualizando...' : 'Alterar senha e continuar'}
              </Button>
            </form>
          </>}
          {gate.stage === 'legal-unavailable' && <>
            <h1>Documentos em preparação</h1>
            <p>Sua senha pessoal já está configurada para <strong>{gate.email}</strong>.</p>
            <p>O acesso operacional está bloqueado até a publicação dos Termos e da Política de Privacidade definitivos. Os textos da demo não serão considerados aceites reais.</p>
            <p className="small-note">{UNSAFE_DATA_MESSAGE}</p>
            <Button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={busy}>Verificar novamente</Button>
          </>}
          {gate.stage === 'accept' && <>
            <h1>Confirmação individual</h1>
            <p>Leia os documentos vigentes de sua conta, <strong>{gate.email}</strong>. A confirmação ficará registrada individualmente no Supabase.</p>
            <form onSubmit={acceptDocuments}>
              {gate.documents.map((doc) => <section className="secure-document" key={doc.kind}>
                <h2>{doc.kind === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}</h2>
                <p className="small-note">Versão {doc.version}</p>
                <div className="secure-document-content" tabIndex={0}>{doc.body}</div>
              </section>)}
              <label className="secure-check"><input type="checkbox" checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)} /> Li e aceito os Termos de Uso apresentados.</label>
              <label className="secure-check"><input type="checkbox" checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)} /> Li e tomei ciência da Política de Privacidade apresentada.</label>
              <Button type="submit" disabled={!termsChecked || !privacyChecked || busy}>
                {busy ? 'Registrando...' : 'Confirmar e continuar'} <ArrowRight size={17}/>
              </Button>
            </form>
          </>}
          {gate.stage === 'ready' && <>
            <h1>Conta verificada</h1>
            <p>Sessão real de <strong>{gate.email}</strong>, senha pessoal configurada e versões vigentes dos documentos confirmadas.</p>
            <p>O painel operacional está em integração. Não utilizaremos a demo com dados locais como se fosse seu painel autenticado.</p>
            <p className="small-note">{UNSAFE_DATA_MESSAGE}</p>
          </>}
          {gate.stage !== 'loading' && <>
            {notice && <p role="alert" className="secure-access-error">{notice}</p>}
            <div className="secure-access-foot">
              <Button type="button" variant="outline" onClick={() => void logout()} disabled={busy}>Sair da conta</Button>
              <Link to="/demo">Abrir demonstração fictícia</Link>
            </div>
          </>}
        </section>
      </main>
    </PublicShell>
  );
}
