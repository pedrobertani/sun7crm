import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCardBrick, type CardBrickController } from './card-brick';

describe('Carregamento do cartão', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('encerra o carregamento quando o SDK retorna null ou rejeita', async () => {
    for (const create of [
      async () => null,
      async () => {
        throw Error('unavailable');
      },
    ]) {
      const ready = vi.fn(),
        unavailable = vi.fn();
      const dispose = mountCardBrick(create, { ready, unavailable });
      await vi.advanceTimersByTimeAsync(0);
      expect(unavailable).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(unavailable).toHaveBeenCalledTimes(1);
      expect(ready).not.toHaveBeenCalled();
      dispose();
    }
  });
  it('interrompe o skeleton se os campos seguros nunca ficarem prontos', async () => {
    const unmount = vi.fn(async () => {}),
      unavailable = vi.fn();
    mountCardBrick(async () => ({ unmount }), { ready: vi.fn(), unavailable });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(unavailable).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
  });
  it('descarta um controlador que só chega após o timeout', async () => {
    let finish!: (value: CardBrickController) => void;
    const unmount = vi.fn(async () => {}),
      ready = vi.fn(),
      unavailable = vi.fn();
    const dispose = mountCardBrick(
      () =>
        new Promise((done) => {
          finish = done;
        }),
      { ready, unavailable },
    );
    await vi.advanceTimersByTimeAsync(20_000);
    finish({ unmount });
    await vi.advanceTimersByTimeAsync(0);
    dispose();
    expect(unavailable).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
  });
  it('ignora callbacks tardios depois de fechar o formulário', async () => {
    let callbacks!: { ready: () => void; error: () => void };
    const ready = vi.fn(),
      unavailable = vi.fn(),
      unmount = vi.fn(async () => {});
    const dispose = mountCardBrick(
      async (input) => {
        callbacks = input;
        return { unmount };
      },
      { ready, unavailable },
    );
    await vi.advanceTimersByTimeAsync(0);
    dispose();
    callbacks.ready();
    callbacks.error();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(ready).not.toHaveBeenCalled();
    expect(unavailable).not.toHaveBeenCalled();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
  it('preserva o formulário pronto diante de uma validação posterior do SDK', async () => {
    let callbacks!: { ready: () => void; error: () => void };
    const ready = vi.fn(),
      unavailable = vi.fn(),
      unmount = vi.fn(async () => {});
    const dispose = mountCardBrick(
      async (input) => {
        callbacks = input;
        input.ready();
        return { unmount };
      },
      { ready, unavailable },
    );
    await vi.advanceTimersByTimeAsync(0);
    callbacks.error();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(unavailable).not.toHaveBeenCalled();
    expect(unmount).not.toHaveBeenCalled();
    dispose();
  });
});
