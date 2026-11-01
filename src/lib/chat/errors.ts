export type ChatErrorKind = 'quota' | 'upstream' | 'timeout' | 'data';

/** Failure carrying only a kind; the route maps it to a fixed client message. */
export class ChatError extends Error {
  kind: ChatErrorKind;

  constructor(kind: ChatErrorKind) {
    super(kind);
    this.name = 'ChatError';
    this.kind = kind;
  }
}
