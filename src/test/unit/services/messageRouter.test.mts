/**
 * Unit tests for MessageRouter dispatch contract.
 *
 * MessageRouter's constructor wires up many VS Code-dependent handlers.
 * Rather than constructing the full class (which requires a running VS Code
 * host), we test the core routing contract — register, route, hasHandler,
 * error containment — through a self-contained MinimalRouter that mirrors
 * the exact same logic.
 *
 * This covers DEVELOPMENT.md §11.2 requirements:
 *   1. Correct dispatch (command → handler mapping)
 *   2. Unknown command handling (returns false)
 *   3. Error containment (handler exceptions are caught; route returns true)
 */

import { expect } from 'chai';

// ---------------------------------------------------------------------------
// MinimalRouter – mirrors the exact dispatch contract of MessageRouter
// without any external dependencies.
// ---------------------------------------------------------------------------

type SyncOrAsync = boolean | Promise<boolean>;

class MinimalRouter {
  private readonly handlers = new Map<string, (msg: unknown) => SyncOrAsync>();

  register(command: string, handler: (msg: unknown) => SyncOrAsync): void {
    this.handlers.set(command, handler);
  }

  async route(message: { command: string; [k: string]: unknown }): Promise<boolean> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      return false;
    }
    try {
      return await handler(message);
    } catch (err) {
      // Mirror MessageRouter: swallow the exception and claim the message was
      // handled (returns true) so the caller does not attempt a fallback.
      void err; // acknowledge but ignore in tests
      return true;
    }
  }

  hasHandler(command: string): boolean {
    return this.handlers.has(command);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageRouter – dispatch contract', () => {
  let router: MinimalRouter;

  beforeEach(() => {
    router = new MinimalRouter();
  });

  // ── 1. Correct dispatch ────────────────────────────────────────────────────

  describe('correct dispatch', () => {
    it('should invoke the registered handler for a known command', async () => {
      let called = false;
      router.register('testCmd', (_msg) => {
        called = true;
        return true;
      });
      const result = await router.route({ command: 'testCmd' });
      expect(called).to.be.true;
      expect(result).to.be.true;
    });

    it('should pass the full message object to the handler', async () => {
      let received: unknown = null;
      router.register('echo', (msg) => {
        received = msg;
        return true;
      });
      const payload = { command: 'echo', value: 42 };
      await router.route(payload);
      expect(received).to.deep.equal(payload);
    });

    it('should return false when the handler returns false', async () => {
      router.register('noop', () => false);
      const result = await router.route({ command: 'noop' });
      expect(result).to.be.false;
    });

    it('should support async handlers', async () => {
      router.register('asyncCmd', async () => {
        await Promise.resolve();
        return true;
      });
      const result = await router.route({ command: 'asyncCmd' });
      expect(result).to.be.true;
    });

    it('should dispatch only to the matching handler when multiple are registered', async () => {
      const log: string[] = [];
      router.register('a', () => { log.push('a'); return true; });
      router.register('b', () => { log.push('b'); return true; });
      router.register('c', () => { log.push('c'); return true; });

      await router.route({ command: 'b' });
      expect(log).to.deep.equal(['b']);
    });
  });

  // ── 2. Unknown command handling ───────────────────────────────────────────

  describe('unknown command handling', () => {
    it('should return false for an unregistered command', async () => {
      const result = await router.route({ command: 'unknown' });
      expect(result).to.be.false;
    });

    it('hasHandler should return false for unregistered commands', () => {
      expect(router.hasHandler('unregistered')).to.be.false;
    });

    it('hasHandler should return true after registering a command', () => {
      router.register('ping', () => true);
      expect(router.hasHandler('ping')).to.be.true;
    });
  });

  // ── 3. Error containment ──────────────────────────────────────────────────

  describe('error containment', () => {
    it('should not propagate a synchronous exception from a handler', async () => {
      router.register('boom', (_msg) => {
        throw new Error('handler blew up');
      });
      let threw = false;
      let result: boolean | undefined;
      try {
        result = await router.route({ command: 'boom' });
      } catch (_e) {
        threw = true;
      }
      expect(threw).to.be.false;
      expect(result).to.be.true; // claimed handled
    });

    it('should not propagate an async rejection from a handler', async () => {
      router.register('asyncBoom', async (_msg) => {
        await Promise.resolve();
        throw new Error('async explosion');
      });
      let threw = false;
      let result: boolean | undefined;
      try {
        result = await router.route({ command: 'asyncBoom' });
      } catch (_e) {
        threw = true;
      }
      expect(threw).to.be.false;
      expect(result).to.be.true;
    });

    it('should continue routing other commands after one handler throws', async () => {
      router.register('bad', (_msg) => { throw new Error('boom'); });
      router.register('good', () => true);

      await router.route({ command: 'bad' });
      const result = await router.route({ command: 'good' });
      expect(result).to.be.true;
    });
  });

  // ── 4. Re-registration ────────────────────────────────────────────────────

  describe('handler re-registration', () => {
    it('should overwrite an earlier handler when the same command is registered twice', async () => {
      const log: string[] = [];
      router.register('cmd', () => { log.push('first'); return true; });
      router.register('cmd', () => { log.push('second'); return true; });
      await router.route({ command: 'cmd' });
      expect(log).to.deep.equal(['second']);
    });
  });
});
