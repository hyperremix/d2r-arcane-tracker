import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensure } from '../../ipc/validation';
import {
  type BridgeRequestHandler,
  BridgeServer,
  MAX_BODY_BYTES,
  PortInUseError,
} from './bridgeServer';

const TOKEN = 'secret-token';

interface TestResponse {
  status: number;
  contentType?: string;
  body: string;
}

/** Sends a request to the loopback server; headers default to a valid plugin request. */
function send(
  port: number,
  {
    method = 'GET',
    path = '/v1/state',
    headers = {},
    body,
  }: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            contentType: response.headers['content-type'],
            body: text,
          }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

describe('When the bridge server receives requests', () => {
  let handler: { [K in keyof BridgeRequestHandler]: ReturnType<typeof vi.fn> };
  let server: BridgeServer;
  let port: number;

  beforeEach(async () => {
    handler = {
      hello: vi.fn(() => ({ status: 200, json: { protocol: 1 } })),
      events: vi.fn(() => ({ status: 204 })),
      state: vi.fn(() => ({ status: 200, text: 'revision\tabc\n' })),
    };
    server = new BridgeServer(handler as unknown as BridgeRequestHandler);
    await server.start(0, TOKEN);
    port = server.getPort() ?? 0;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('Then GET /v1/state answers with the handler text and the requested revision', async () => {
    // Act
    const response = await send(port, { path: '/v1/state?revision=abc' });

    // Assert
    expect(response).toEqual({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: 'revision\tabc\n',
    });
    expect(handler.state).toHaveBeenCalledWith('abc');
  });

  it('Then POST /v1/hello and /v1/events pass the parsed JSON body to the handler', async () => {
    // Act
    const hello = await send(port, {
      method: 'POST',
      path: '/v1/hello',
      body: JSON.stringify({ protocol: 1, pluginVersion: '1.0.0' }),
    });
    const events = await send(port, {
      method: 'POST',
      path: '/v1/events',
      body: JSON.stringify({ events: [] }),
    });

    // Assert
    expect(hello).toMatchObject({ status: 200, body: '{"protocol":1}' });
    expect(handler.hello).toHaveBeenCalledWith({ protocol: 1, pluginVersion: '1.0.0' });
    expect(events.status).toBe(204);
    expect(handler.events).toHaveBeenCalledWith({ events: [] });
  });

  it.each([
    ['a wrong token', { Authorization: 'Bearer wrong' }, 401],
    ['no token', { Authorization: '' }, 401],
    ['an Origin header (a browser)', { Origin: 'https://example.com' }, 403],
    ['another host name (DNS rebinding)', { Host: 'attacker.example:41733' }, 403],
  ])('If a request has %s, then it is refused without reaching the handler', async (_, headers, status) => {
    // Act
    const response = await send(port, { headers });

    // Assert
    expect(response.status).toBe(status);
    expect(handler.state).not.toHaveBeenCalled();
  });

  it('If a request is for localhost on the right port, then it is accepted', async () => {
    // Act
    const response = await send(port, { headers: { Host: `localhost:${port}` } });

    // Assert
    expect(response.status).toBe(200);
  });

  it('If the path is unknown or the method wrong, then it answers 404 or 405', async () => {
    // Act
    const unknown = await send(port, { path: '/v1/other' });
    const wrongMethod = await send(port, { method: 'POST', path: '/v1/state', body: '{}' });

    // Assert
    expect(unknown.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
  });

  it('If a body is no JSON or too large, then it answers 400 or 413', async () => {
    // Act
    const invalid = await send(port, { method: 'POST', path: '/v1/events', body: '{' });
    const tooLarge = await send(port, {
      method: 'POST',
      path: '/v1/events',
      body: JSON.stringify({ padding: 'x'.repeat(MAX_BODY_BYTES) }),
    });

    // Assert
    expect(invalid.status).toBe(400);
    expect(tooLarge.status).toBe(413);
    expect(handler.events).not.toHaveBeenCalled();
  });

  it('If the handler rejects the body, then it answers 400 with the reason', async () => {
    // Arrange
    handler.events.mockImplementation(() => {
      ensure(false, 'Invalid events');
    });

    // Act
    const response = await send(port, { method: 'POST', path: '/v1/events', body: '{}' });

    // Assert
    expect(response).toMatchObject({ status: 400, body: '{"error":"Invalid events"}' });
  });
});

describe('When the bridge server starts on a port another program uses', () => {
  it('Then it throws PortInUseError', async () => {
    // Arrange
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const { port } = blocker.address() as AddressInfo;
    const server = new BridgeServer({} as BridgeRequestHandler);

    try {
      // Act
      const start = server.start(port, TOKEN);

      // Assert
      await expect(start).rejects.toBeInstanceOf(PortInUseError);
      expect(server.getPort()).toBeUndefined();
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
});
