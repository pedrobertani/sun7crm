import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { FormError } from '../../components/shared';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { ModalFooter } from '../../components/ui/modal-footer';
import {
  formatContactPhone,
  previewContacts,
  type ImportRow,
  type TransferContact,
} from '../../domain/contact-transfer';
import { prepareContactsDownload, readContactsExcel } from './excel';
import './transfer.css';
export function ContactTransfer({
  canImport,
  canExport = true,
  loadContacts,
  loadExisting,
  onImport,
  onImported,
  filtered,
  filteredLabel = 'Contatos filtrados',
  scopeLabel = 'da empresa',
  demo = false,
}: {
  canImport: boolean;
  canExport?: boolean;
  loadContacts: () => Promise<TransferContact[]>;
  loadExisting?: () => Promise<TransferContact[]>;
  onImport: (contacts: TransferContact[]) => Promise<number>;
  onImported?: () => void;
  filtered?: () => Promise<TransferContact[]>;
  filteredLabel?: string;
  scopeLabel?: string;
  demo?: boolean;
}) {
  const [mode, setMode] = useState<'import' | 'export' | null>(null);
  const previewPages = usePagination();
  const [rows, setRows] = useState<ImportRow[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null);
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download],
  );
  useEffect(() => {
    if (mode === null) setDownload(null);
  }, [mode]);
  const lock = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const valid = rows.filter((r) => r.status === 'valid');
  function open(next: 'import' | 'export') {
    setDownload(null);
    setRows([]);
    previewPages.setPage(0);
    setError('');
    setMessage('');
    setMode(next);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function choose(file: File) {
    previewPages.setPage(0);
    setRows([]);
    setMessage('');
    await run(async () => {
      const parsed = await readContactsExcel(file),
        existing = await (loadExisting || loadContacts)();
      setRows(previewContacts(parsed, existing));
    });
  }
  async function confirm() {
    await run(async () => {
      // Revalidate immediately before saving, including contacts created since preview.
      const checked = previewContacts(rows, await (loadExisting || loadContacts)());
      setRows(checked);
      const candidates = checked.filter((r) => r.status === 'valid');
      if (!candidates.length) throw Error('Não há novos contatos válidos para importar.');
      const count = await onImport(candidates.map(({ name, phone }) => ({ name, phone })));
      setRows([]);
      setMessage(
        `${count} contato(s) importado(s). ${candidates.length - count} duplicado(s) adicional(is) ignorado(s). Os contatos existentes foram preservados.`,
      );
      if (fileInput.current) fileInput.current.value = '';
      onImported?.();
    });
  }
  return (
    <>
      <div className="contact-transfer-actions">
        {canImport && (
          <Button variant="outline" onClick={() => open('import')}>
            Importar Excel
          </Button>
        )}
        <Button disabled={!canExport} variant="outline" onClick={() => open('export')}>
          Exportar Excel
        </Button>
      </div>
      <Modal
        open={mode !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setMode(null);
        }}
        title={mode === 'import' ? 'Importar contatos' : 'Exportar contatos'}
        description={
          demo
            ? 'Demonstração: use dados fictícios. Os contatos ficam somente neste navegador.'
            : 'Somente os contatos permitidos para o seu perfil na empresa selecionada.'
        }
      >
        {mode === 'import' ? (
          <>
            <p className="small-note contact-transfer-instructions">
              Arquivo .xlsx · colunas <strong>Nome</strong> e <strong>Contato</strong> · até 1.000 linhas e 2 MB.
            </p>
            <details className="contact-transfer-help">
              <summary>Formato e regras de importação</summary>
              <p className="small-note">
                Telefone opcional; quando informado, deve conter DDD (com ou sem máscara, +55 opcional).
                Contatos duplicados são ignorados, nunca substituídos. Sem telefone, a comparação é pelo nome.
              </p>
            </details>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setDownload(await prepareContactsDownload([], 'sun7crm-modelo-contatos.xlsx'));
                })
              }
            >
              Baixar modelo Excel
            </Button>
            <label className="form-row">
              Selecionar Excel
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void choose(file);
                }}
              />
            </label>
            {!!rows.length && (
              <>
                <p role="status">
                  <strong>{valid.length} válidos</strong> ·{' '}
                  {rows.filter((r) => r.status === 'duplicate').length} duplicados ·{' '}
                  {rows.filter((r) => r.status === 'invalid').length} com erro
                </p>
                <div className="table-wrap contact-transfer-preview">
                  <table>
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Nome</th>
                        <th>Contato</th>
                        <th>Validação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows(rows, previewPages.page, previewPages.size).map((r) => (
                        <tr key={r.line}>
                          <td>{r.line}</td>
                          <td>{r.name || 'Sem nome'}</td>
                          <td>{formatContactPhone(r.phone)}</td>
                          <td>{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={previewPages.page}
                  size={previewPages.size}
                  total={rows.length}
                  onChange={previewPages.setPage}
                  onSizeChange={previewPages.setSize}
                  label="linhas da importação"
                />
                <p className="small-note">
                  Apenas linhas válidas serão importadas; corrija as demais no arquivo.
                </p>
              </>
            )}
            <ModalFooter>
              <Button variant="outline" disabled={busy} onClick={() => setMode(null)}>
                Fechar
              </Button>
              <Button disabled={busy || !valid.length} onClick={() => void confirm()}>
                Importar {valid.length} contato(s) válido(s)
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <p>
              O arquivo terá as colunas Nome e Contato, com telefone formatado, e poderá ser
              importado novamente.
            </p>
            <div className="contact-transfer-actions">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const list = await loadContacts();
                    setDownload(await prepareContactsDownload(list));
                    setMessage(
                      `${list.length} contato(s) no arquivo. Clique em Baixar Excel para salvar.`,
                    );
                  })
                }
              >
                Todos os contatos {scopeLabel}
              </Button>
              {filtered && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const list = await filtered();
                      setDownload(
                        await prepareContactsDownload(list, 'sun7crm-contatos-filtrados.xlsx'),
                      );
                      setMessage(
                        `${list.length} contato(s) no arquivo. Clique em Baixar Excel para salvar.`,
                      );
                    })
                  }
                >
                  {filteredLabel}
                </Button>
              )}
            </div>
          </>
        )}
        {download && (
          <ModalFooter>
            <Button asChild>
              <a href={download.url} download={download.filename}>
                Baixar Excel
              </a>
            </Button>
          </ModalFooter>
        )}
        {busy && <p role="status">Processando Excel...</p>}
        {message && <p role="status">{message}</p>}
        <FormError message={error} />
      </Modal>
    </>
  );
}
