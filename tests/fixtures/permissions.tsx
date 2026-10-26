/** QA local sem autenticação, rede ou dados reais. Não incluído no build de produção. */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../src/styles.css';
import { Modal } from '../../src/components/ui/modal';
import { PermissionTree } from '../../src/modules/permissions/PermissionTree';
import { type EmployeePermissions } from '../../src/modules/permissions/model';
window.fetch = async () => {
  throw Error('QA local: rede desabilitada.');
};
function Fixture() {
  const [width, setWidth] = useState('390');
  const [value, setValue] = useState<EmployeePermissions>({ keys: [], scope: 'own', version: 0 });
  return location.search === '?inner' ? (
    <Modal
      open
      title="Permissões do funcionário"
      description="Prévia local com dados fictícios."
      onOpenChange={() => {}}
    >
      <PermissionTree value={value} onChange={setValue} />
    </Modal>
  ) : (
    <main style={{ padding: 16 }}>
      <label>
        Tamanho da tela
        <select
          aria-label="Tamanho da tela"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
        >
          {['320', '390', '780', '1280', '2560'].map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </label>
      <iframe
        title="Prévia de permissões"
        src="/tests/fixtures/permissions.html?inner"
        style={{
          display: 'block',
          width: Number(width),
          height: 900,
          border: '1px solid #ddd',
          marginTop: 16,
          maxWidth: 'none',
        }}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
