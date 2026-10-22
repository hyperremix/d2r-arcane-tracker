import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { IpcValidationError } from '../../ipc/validation';
import { createServiceLogger } from '../../utils/serviceLogger';

const log = createServiceLogger('D2RLoaderBridgeServer');

/** Largest request body accepted, in bytes. */
export const MAX_BODY_BYTES = 64 * 1024;

/** The server only listens on the loopback interface; the plugin runs on the same machine. */
const LOOPBACK_HOST = '127.0.0.1';

/** The method of each route. */
const ROUTES: ReadonlyMap<string, 'GET' | 'POST'> = new Map([
  ['/v1/hello', 'POST'],
  ['/v1/events', 'POST'],
  ['/v1/state', 'GET'],
]);

/** Answer of a route: a status code and an optional JSON or text body. */
export interface BridgeResponse {
  status: number;
  json?: unknown;
  text?: string;
}

/** What the server does with each authenticated request. */
export interface BridgeRequestHandler {
  /** `POST /v1/hello` with the parsed JSON body. */
  hello(body: unknown): BridgeResponse;
  /** `POST /v1/events` with the parsed JSON body. */
  events(body: unknown): BridgeResponse;
  /** `GET /v1/state` with the `revision` query parameter. */
  state(revision: string | undefined): BridgeResponse;
}

/** Thrown by {@link BridgeServer.start} when another program uses the port. */
export class PortInUseError extends Error {
  constructor(port: number) {
    super(`Port ${port} is already in use`);
    this.name = 'PortInUseError';
  }
}

/** Compares two secrets in constant time, so the comparison doesn't reveal the token. */
function secretsEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function send(response: ServerResponse, { status, json, text }: BridgeResponse): void {
  // The rest of an oversized body is never read, so its connection can't be reused
  const connection: Record<string, string> = status === 413 ? { Connection: 'close' } : {};
  if (json !== undefined) {
    response.writeHead(status, { ...connection, 'Content-Type': 'application/json' });
    response.end(JSON.stringify(json));
  } else if (text !== undefined) {
    response.writeHead(status, { ...connection, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(text);
  } else {
    response.writeHead(status, connection);
    response.end();
  }
}

/**
 * Refuses requests a browser sends (they always carry an `Origin` header), requests for another
 * host name (DNS rebinding) and requests without the token.
 * @returns The response refusing the request, or undefined when it may proceed
 */
function checkAccess(
  request: IncomingMessage,
  port: number,
  token: string,
): BridgeResponse | undefined {
  const allowedHosts = [`${LOOPBACK_HOST}:${port}`, `localhost:${port}`];
  if (request.headers.origin !== undefined || !allowedHosts.includes(request.headers.host ?? '')) {
    return { status: 403 };
  }
  const authorization = request.headers.authorization ?? '';
  if (!authorization.startsWith('Bearer ') || !secretsEqual(authorization.slice(7), token)) {
    return { status: 401 };
  }
  return undefined;
}

/**
 * Reads a request body of at most {@link MAX_BODY_BYTES} and parses it as JSON. A body that grows
 * past the limit is answered at once and the rest of it isn't read.
 * @returns The parsed body, or a response to send instead (too large, not JSON)
 */
function readJsonBody(request: IncomingMessage): Promise<{ body: unknown } | BridgeResponse> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.pause();
        resolve({ status: 413 });
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve({ body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        resolve({ status: 400, json: { error: 'Invalid JSON' } });
      }
    });
    request.on('error', () => resolve({ status: 400 }));
  });
}

/**
 * The loopback HTTP server the D2RLoader plugin talks to (see `plugin/PROTOCOL.md`). It answers
 * only requests that carry the token and come from a client that isn't a browser: requests with an
 * `Origin` header, or for another host name (DNS rebinding), are refused before the token is checked.
 */
export class BridgeServer {
  private server: Server | undefined;

  constructor(private readonly handler: BridgeRequestHandler) {}

  /**
   * Starts listening on the loopback interface. A running server is stopped first.
   * @param port - The port to listen on; 0 picks a free one (see {@link getPort})
   * @param token - The secret every request must carry
   * @throws PortInUseError when another program uses the port; other errors as thrown by Node
   */
  async start(port: number, token: string): Promise<void> {
    await this.stop();
    const server = createServer((request, response) => {
      // The Host header names the port the server actually listens on
      const listeningPort = (server.address() as AddressInfo).port;
      this.handle(request, response, listeningPort, token).catch((error: unknown) => {
        log.error('handle', error);
        if (!response.headersSent) {
          send(response, { status: 500 });
        }
      });
    });
    // A plugin that stops mid-request must not keep a connection open forever
    server.requestTimeout = 10_000;

    await new Promise<void>((resolve, reject) => {
      server.once('error', (error: NodeJS.ErrnoException) => {
        reject(error.code === 'EADDRINUSE' ? new PortInUseError(port) : error);
      });
      server.listen(port, LOOPBACK_HOST, () => resolve());
    });
    server.on('error', (error) => log.error('server', error));
    this.server = server;
  }

  /** Stops listening and closes open connections. */
  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  /** The port the server listens on, or undefined when it doesn't listen. */
  getPort(): number | undefined {
    return (this.server?.address() as AddressInfo | null)?.port;
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
    port: number,
    token: string,
  ): Promise<void> {
    const refusal = checkAccess(request, port, token);
    if (refusal) {
      send(response, refusal);
      return;
    }

    const url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`);
    const route = ROUTES.get(url.pathname);
    if (!route || request.method !== route) {
      send(response, { status: route ? 405 : 404 });
      return;
    }
    send(
      response,
      route === 'GET'
        ? this.handler.state(url.searchParams.get('revision') ?? undefined)
        : await this.handlePost(request, url.pathname),
    );
  }

  /** Reads the JSON body of a POST route and passes it to the handler; invalid bodies get a 400. */
  private async handlePost(request: IncomingMessage, pathname: string): Promise<BridgeResponse> {
    const read = await readJsonBody(request);
    if (!('body' in read)) {
      return read;
    }
    try {
      return pathname === '/v1/hello'
        ? this.handler.hello(read.body)
        : this.handler.events(read.body);
    } catch (error) {
      if (error instanceof IpcValidationError) {
        return { status: 400, json: { error: error.message } };
      }
      throw error;
    }
  }
}
