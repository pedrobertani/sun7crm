import { describe, expect, it, vi } from 'vitest';
import { createQueryTask, createRefreshScheduler } from './query-refresh';

describe('Atualização compartilhada das consultas', () => {
  function fixture() {
    let now = 0;
    let active = true;
    let tick = () => {};
    let wake = () => {};
    const cancel = vi.fn();
    const unlisten = vi.fn();
    const listen = vi.fn((callback: () => void) => {
      wake = callback;
      return unlisten;
    });
    const repeat = vi.fn((callback: () => void) => {
      tick = callback;
      return cancel;
    });
    const scheduler = createRefreshScheduler({
      now: () => now,
      active: () => active,
      listen,
      repeat,
    });
    return {
      scheduler,
      cancel,
      unlisten,
      listen,
      repeat,
      advance: (ms: number) => {
        now += ms;
        tick();
      },
      setActive: (value: boolean) => {
        active = value;
      },
      wake: () => wake(),
    };
  }
  it('compartilha um timer e os listeners entre plano, integração e histórico', () => {
    const f = fixture();
    const refresh = vi.fn(async () => {});
    const stops = [1, 2, 3].map(() => f.scheduler.subscribe(refresh, 'company'));
    expect(f.listen).toHaveBeenCalledTimes(1);
    expect(f.repeat).toHaveBeenCalledTimes(1);
    f.advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    stops[0]();
    stops[1]();
    expect(f.cancel).not.toHaveBeenCalled();
    stops[2]();
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect(f.unlisten).toHaveBeenCalledTimes(1);
  });
  it('pausa sem visibilidade/rede e consulta ao voltar, sem tempestade de eventos de foco', () => {
    const f = fixture();
    const refresh = vi.fn(async () => {});
    f.scheduler.subscribe(refresh, 'company');
    f.setActive(false);
    f.advance(60_000);
    expect(refresh).not.toHaveBeenCalled();
    f.setActive(true);
    f.wake();
    f.wake();
    expect(refresh).toHaveBeenCalledTimes(1);
    f.advance(5000);
    f.wake();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('uma atualização manual recarrega o grupo certo e preserva o intervalo dos demais', async () => {
    const f = fixture();
    const first = vi.fn(async () => {}),
      second = vi.fn(async () => {});
    f.scheduler.subscribe(first, 'first', 5000, () => false);
    f.scheduler.subscribe(second, 'second');
    f.advance(5000);
    expect(first).not.toHaveBeenCalled();
    await f.scheduler.refresh('first');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
  it('deduplica uma consulta em andamento e permite a próxima após terminar', async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const value = vi.fn(),
      error = vi.fn();
    const task = createQueryTask(load, { value, error });
    const first = task.refresh(),
      second = task.refresh();
    expect(second).toBe(first);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    resolve('paid');
    await first;
    expect(value).toHaveBeenCalledWith('paid');
    const next = task.refresh();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    resolve('refunded');
    await next;
    expect(value).toHaveBeenLastCalledWith('refunded');
    expect(error).not.toHaveBeenCalled();
  });
  it('ignora respostas atrasadas após trocar empresa ou desmontar a tela', async () => {
    let resolve!: (value: string) => void;
    let signal!: AbortSignal;
    const value = vi.fn(),
      error = vi.fn();
    const task = createQueryTask(
      (input) => {
        signal = input;
        return new Promise<string>((done) => {
          resolve = done;
        });
      },
      { value, error },
    );
    const request = task.refresh();
    await Promise.resolve();
    task.dispose();
    expect(signal.aborted).toBe(true);
    resolve('old-company');
    await request;
    expect(value).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it('recupera de erro sem encerrar futuras atualizações', async () => {
    const load = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce('current');
    const value = vi.fn(),
      error = vi.fn();
    const task = createQueryTask(load, { value, error });
    await task.refresh();
    await task.refresh();
    expect(error).toHaveBeenCalledTimes(1);
    expect(value).toHaveBeenCalledWith('current');
  });
  it('aguarda o formulário fechar e agrupa eventos sem consultar outro contexto', () => {
    const f = fixture();
    let editing = true;
    const affected = vi.fn(async () => {}),
      other = vi.fn(async () => {});
    f.scheduler.subscribe(
      affected,
      'company:a',
      60_000,
      () => false,
      () => !editing,
    );
    f.scheduler.subscribe(
      other,
      'company:b',
      60_000,
      () => false,
      () => true,
    );
    for (let n = 0; n < 100; n++) f.scheduler.invalidate((group) => group === 'company:a');
    expect(affected).not.toHaveBeenCalled();
    editing = false;
    f.advance(1000);
    expect(affected).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    f.advance(120_000);
    expect(affected).toHaveBeenCalledTimes(1);
  });
  it('uma alteração recebida durante a consulta agenda só uma leitura final', async () => {
    let finish!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const value = vi.fn();
    const task = createQueryTask(load, { value, error: vi.fn() });
    const first = task.refresh();
    await Promise.resolve();
    for (let n = 0; n < 20; n++) void task.invalidate();
    expect(load).toHaveBeenCalledTimes(1);
    finish('anterior');
    await first;
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    const latest = task.refresh();
    finish('atualizado');
    await latest;
    expect(value).toHaveBeenLastCalledWith('atualizado');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
