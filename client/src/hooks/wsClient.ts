import type { ClientMessage } from '../types/cluster';

type Sender = (msg: ClientMessage) => void;
let _send: Sender = () => {};

/** Called by useWebSocket once the connection is established. */
export function registerSender(fn: Sender): void {
  _send = fn;
}

/** Send a message over the active WebSocket connection from any module. */
export function sendWsMessage(msg: ClientMessage): void {
  _send(msg);
}
