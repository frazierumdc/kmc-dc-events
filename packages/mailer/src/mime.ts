// Builds the RFC 2822 message Gmail sends: UTF-8, plain text with an optional HTML version.

export interface Message {
  /** `Display Name <address>` or a bare address. */
  from: string;
  to: string[];
  /** Hidden recipients: Gmail delivers to them and drops the header. */
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface MimeOptions {
  /** Injected for tests; random otherwise. */
  boundary?: string;
  date?: Date;
}

/** The message as RFC 2822 text with CRLF line endings. */
export function buildMime(message: Message, options: MimeOptions = {}): string {
  const { from, to, subject, text, html } = message;
  const bcc = message.bcc ?? [];
  if (to.length === 0) throw new Error("A message needs at least one recipient");
  for (const value of [from, subject, ...to, ...bcc]) {
    if (/[\r\n]/.test(value)) throw new Error("Header values can't contain line breaks");
  }

  const headers = [
    `From: ${encodeDisplayName(from)}`,
    `To: ${to.join(", ")}`,
    ...(bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${(options.date ?? new Date()).toUTCString()}`,
    "MIME-Version: 1.0",
  ];
  if (html === undefined) {
    return [...headers, ...part("text/plain", text), ""].join("\r\n");
  }
  const boundary = options.boundary ?? `kmcdc-${crypto.randomUUID()}`;
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...part("text/plain", text),
    `--${boundary}`,
    ...part("text/html", html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function part(type: string, body: string): string[] {
  return [
    `Content-Type: ${type}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "",
    ...wrap(Buffer.from(body, "utf8").toString("base64")),
  ];
}

function wrap(base64: string): string[] {
  return base64.match(/.{1,76}/g) ?? [""];
}

/** An RFC 2047 encoded word when the value isn't plain ASCII. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Encodes the display name of `Name <address>`, leaving the address as it is. */
function encodeDisplayName(value: string): string {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(value);
  if (!match?.[1]) return value;
  return `${encodeHeader(match[1])} <${match[2] ?? ""}>`;
}
