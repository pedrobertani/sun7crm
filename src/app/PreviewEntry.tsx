import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut } from 'lucide-react';
import { useCrm } from './context';
import { Button } from '../components/ui/button';
export function PreviewEntry() {
  const { enterPreview } = useCrm();
  const navigate = useNavigate();
  return (
    <main className="preview-entry">
      <div className="preview-entry-card">
        <div className="logo">
          <span className="mark">7</span>
          <span className="brand">
            <strong>SUN7CRM</strong>
            <small>GESTÃO COMERCIAL</small>
          </span>
        </div>
        <div className="entry-status-icon">
          <LogOut size={25} />
        </div>
        <h1>Você saiu da prévia</h1>
        <p>Quando quiser continuar explorando, é só entrar novamente.</p>
        <Button
          onClick={() => {
            enterPreview();
            navigate('/', { replace: true });
          }}
        >
          Entrar na prévia
          <ArrowRight size={16} />
        </Button>
        <small>Ambiente de validação com dados fictícios e acesso simulado.</small>
      </div>
    </main>
  );
}
