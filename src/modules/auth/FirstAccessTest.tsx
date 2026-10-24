import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import legalDrafts from '../../content/legal-drafts.json';
import { passwordValidation } from './flow';
import { PublicShell } from '../public/PublicShell';

type Stage = 'intro' | 'password' | 'documents' | 'success';
export function canConfirmDraftTest(terms: boolean, privacy: boolean) {
  return terms && privacy;
}
const steps: Record<Stage, string> = {
  intro: 'Apresentação',
  password: 'Troca de senha',
  documents: 'Documentos',
  success: 'Resultado',
};

/**
 * Apenas simulação visual. Sem Supabase Auth, sem inserts e sem localStorage.
 * Não concede acesso, não registra aceite real e não altera a senha de ninguém.
 */
export function FirstAccessTest() {
  const [stage, setStage] = useState<Stage>('intro');
  const [secret, setSecret] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');

  function simulatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = passwordValidation(secret, confirm);
    if (invalid) { setError(invalid); return; }
    setSecret('');
    setConfirm('');
    setError('');
    setStage('documents');
  }

  function simulateAcceptance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfirmDraftTest(terms, privacy)) {
      setError('Marque os dois campos para simular a confirmação.');
      return;
    }
    setError('');
    setStage('success');
  }

  function resetTest() {
    setStage('intro');
    setSecret('');
    setConfirm('');
    setTerms(false);
    setPrivacy(false);
    setError('');
  }

  return (
    <PublicShell title="Teste do primeiro acesso · SUN7CRM">
      <main className="secure-access-page public-container">
        <section className="secure-access-card" aria-live="polite">
          <div className="secure-access-head">
            <ShieldCheck size={22} aria-hidden="true" />
            <span>SIMULAÇÃO DE PRIMEIRO ACESSO · SUN7CRM</span>
          </div>
          <div className="legal-test-warning" role="note">
            <strong>AMBIENTE DE TESTE — SEM VALIDADE DE ACEITE</strong>
            <p>Estas são minutas para validar a experiência. Não utilize dados ou senhas reais. Nada será enviado ao Supabase, e nenhuma permissão será liberada.</p>
          </div>
          <p className="small-note">Etapa: {steps[stage]}</p>

          {stage === 'intro' && (
            <>
              <h1>Primeiro acesso de demonstração</h1>
              <p>Você poderá experimentar a troca obrigatória da senha e a confirmação individual dos Termos e da Política, como na entrada de um funcionário.</p>
              <p>O login e os aceites reais permanecem protegidos. Esta simulação não cria contas nem altera documentos publicados.</p>
              <Button type="button" onClick={() => setStage('password')}>
                Começar simulação <ArrowRight size={17} />
              </Button>
            </>
          )}

          {stage === 'password' && (
            <>
              <h1>Defina sua senha pessoal</h1>
              <p>Exemplo da tela que aparece após receber uma senha temporária. Digite somente uma senha inventada para testar as validações.</p>
              <form onSubmit={simulatePassword}>
                <label className="form-row">Nova senha de teste
                  <Input type="password" autoComplete="off" minLength={12} required value={secret} onChange={(event) => setSecret(event.target.value)}/>
                </label>
                <label className="form-row">Confirmação da senha de teste
                  <Input type="password" autoComplete="off" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)}/>
                </label>
                <p className="small-note">Mínimo de 12 caracteres e máximo de 72 bytes. Nenhuma senha será gravada ou transmitida.</p>
                <Button type="submit" disabled={!secret || !confirm}>Simular troca e continuar</Button>
              </form>
            </>
          )}

          {stage === 'documents' && (
            <>
              <h1>Confirmação individual — teste</h1>
              <p>Visualize os textos preliminares e simule o aceite. Os documentos definitivos ainda precisam ser aprovados pela SUN7.</p>
              <form onSubmit={simulateAcceptance}>
                {([
                  { kind: 'terms', heading: 'Termos de Uso', items: legalDrafts.terms },
                  { kind: 'privacy', heading: 'Política de Privacidade', items: legalDrafts.privacy },
                ] as const).map((doc) => (
                  <section className="secure-document" key={doc.kind}>
                    <h2>{doc.heading}</h2>
                    <p className="small-note">Minuta {legalDrafts.version} — somente para testes</p>
                    <div className="secure-document-content legal-test-document" tabIndex={0} aria-label={doc.heading}>
                      {doc.items.map(({heading, paragraphs}, index) => (
                        <div key={heading} className="legal-test-section">
                          <strong>{index+1}. {heading}</strong>
                          {paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                <label className="secure-check">
                  <input type="checkbox" checked={terms} onChange={(event)=>setTerms(event.target.checked)} />
                  Simulo meu aceite dos Termos de Uso desta minuta.
                </label>
                <label className="secure-check">
                  <input type="checkbox" checked={privacy} onChange={(event)=>setPrivacy(event.target.checked)} />
                  Simulo minha ciência da Política de Privacidade desta minuta.
                </label>
                <Button type="submit" disabled={!canConfirmDraftTest(terms,privacy)}>
                  Confirmar simulação <ArrowRight size={17}/>
                </Button>
              </form>
            </>
          )}

          {stage === 'success' && (
            <>
              <CheckCircle2 size={36} color="#236d62" aria-hidden="true"/>
              <h1>Fluxo de teste concluído</h1>
              <p>Você validou visualmente o primeiro acesso e os dois campos de confirmação.</p>
              <p><strong>Não houve aceite jurídico, troca de senha real ou desbloqueio de conta.</strong> Quando as versões oficiais forem publicadas, cada usuário precisará confirmá-las individualmente.</p>
              <Button type="button" onClick={resetTest}><RotateCcw size={17}/> Repetir simulação</Button>
            </>
          )}
          {error && <p className="secure-access-error" role="alert">{error}</p>}
          {stage !== 'success' && stage !== 'intro' && (
            <Button type="button" variant="outline" onClick={resetTest}>Recomeçar teste</Button>
          )}
          <div className="secure-access-foot">
            <Link to="/acessar">Ir para login real</Link>
            <Link to="/demo">Abrir demo fictícia</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
