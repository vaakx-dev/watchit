import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function json(res: ServerResponse, value: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

export async function read_body(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > limit) throw new HttpError(413, 'Request body is too large.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export async function read_json(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await read_body(req, 8192);
  let value: unknown;
  try { value = JSON.parse(body.toString('utf8')); }
  catch { throw new HttpError(400, 'Request body must be JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be an object.');
  return value as Record<string, unknown>;
}
