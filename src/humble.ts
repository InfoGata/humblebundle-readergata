/**
 * Humble's library after its 2026 move to Next.js.
 *
 * The JSON api (`/api/v1/user/order`, `/api/v1/order/<gamekey>`) is gone. The
 * library page now gets its data from two Next.js server actions:
 *
 * - `filterUserLibrary`, a `useActionState` action posted to `/home/library`,
 *   which pages through every item the reader owns.
 * - `getSignedUrlsForEntitlements`, posted to an item's own page
 *   (`/home/library/content/<id>`; it answers `not_authenticated` anywhere
 *   else), which returns cdn urls for its files, signed for a day. It takes a
 *   few items at once but fails on the whole library.
 *
 * A server action is addressed by an id that changes with every deploy, so the
 * ids are read from the site's own scripts, where each sits beside the
 * action's name (`createServerReference("<id>", …, "<name>")`).
 */

export const ORIGIN = "https://www.humblebundle.com";
export const LIBRARY_PATH = "/home/library";
export const contentPath = (id: string) =>
  `${LIBRARY_PATH}/content/${encodeURIComponent(id)}`;

export const ACTIONS = {
  library: "filterUserLibrary",
  signedUrls: "getSignedUrlsForEntitlements",
} as const;
export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

/** What `filterUserLibrary` answers with. */
export interface LibraryPage {
  results: LibraryItem[];
  pagination?: { page: number; totalPages: number; totalDocs: number };
  success: boolean;
  error?: string;
}

export interface LibraryItem {
  /** The item's entitlement, which its page and signed urls are keyed by. */
  id: string;
  title: string;
  /** The bundle it came in. */
  subTitle?: string;
  type: string;
  deliveryMethods?: string[];
}

/** What `getSignedUrlsForEntitlements` answers with. */
export interface SignedUrlsResult {
  ok: boolean;
  code?: string;
  data?: {
    /** subproduct machine name → download key → relative file → url. */
    signedUrls: SignedUrls;
    expiresAt?: string;
  };
}

export class ActionError extends Error {
  constructor(
    message: string,
    /** Humble's own code, such as `not_authenticated`. */
    readonly code?: string
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/**
 * The value a server action returned, out of its React flight response.
 *
 * Row 0 says which row holds the result (`"a":"$@1"`); a row whose value
 * starts with `E` is the action throwing.
 */
export const parseActionResponse = <T>(text: string): T => {
  const rows = new Map<string, string>();
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) rows.set(line.slice(0, colon), line.slice(colon + 1));
  }
  const head = rows.get("0");
  if (!head) throw new ActionError("Not a server action response");
  let ref: unknown;
  try {
    ref = (JSON.parse(head) as { a?: unknown }).a;
  } catch {
    throw new ActionError("Not a server action response");
  }
  const id = typeof ref === "string" && ref.startsWith("$@") ? ref.slice(2) : "";
  const row = rows.get(id);
  if (row === undefined) throw new ActionError("Server action sent no result");
  if (row.startsWith("E")) throw new ActionError("Server action failed");
  return JSON.parse(row) as T;
};

/**
 * Every server action id in a script, by name. Read loosely, since only the
 * id and the name are needed and the minifier picks everything around them.
 */
export const findServerActions = (script: string): Record<string, string> => {
  const found: Record<string, string> = {};
  const pattern =
    /createServerReference\)?\(\s*"([0-9a-f]{40,})"[^"]*?"([A-Za-z_$][\w$]*)"\s*\)/g;
  // exec rather than matchAll, which the es2019 lib this builds with lacks.
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(script))) found[match[2]] = match[1];
  return found;
};

/** The same-origin script urls a page loads, in the order it lists them. */
export const pageScripts = (html: string): string[] => {
  const urls = new Set<string>();
  const pattern = /\/_next\/static\/chunks\/[\w.~-]+\.js/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) urls.add(`${ORIGIN}${match[0]}`);
  return [...urls];
};

/**
 * A multipart body as a string. Plugin requests are posted between frames and
 * through the extension, where a `FormData` can't go, and Next.js only reads a
 * `useActionState` action's arguments from multipart.
 */
export const encodeMultipart = (
  fields: [string, string][],
  boundary: string
): string =>
  fields
    .map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    )
    .join("") + `--${boundary}--\r\n`;

/**
 * The fields the library page posts for one page of results. The `_1_`
 * prefix and the trailing `0` are React's encoding of `action(prevState,
 * formData)`: argument 0 is the previous state, argument 1 the form, whose
 * fields are stored under its index.
 */
export const libraryFields = (
  page: number,
  limit: number
): [string, string][] => [
  ["_1_query", ""],
  ["_1_sort", "mostRecent"],
  ["_1_page", String(page)],
  ["_1_limit", String(limit)],
  ["_1_hideRevealed", "false"],
  ["_1_hideExpired", "false"],
  [
    "0",
    JSON.stringify([
      {
        results: [],
        pagination: { page: 1, totalPages: 1, totalDocs: 0 },
        success: true,
      },
      "$K1",
    ]),
  ],
];

/** Items with files to download, which is where books are. */
export const isDownloadable = (item: LibraryItem) =>
  item.type === "download_drm_free" ||
  !!item.deliveryMethods?.includes("download");

export interface SignedFile {
  /** Humble's key for this platform's set of files, such as `…_ebook`. */
  downloadKey: string;
  /** The file's path relative to Humble's cdn, stable across signings. */
  file: string;
  url: string;
}

export type SignedUrls = Record<
  string,
  Record<string, Record<string, string>>
>;

export const signedFiles = (signedUrls: SignedUrls): SignedFile[] =>
  Object.values(signedUrls).flatMap((byKey) =>
    Object.entries(byKey).flatMap(([downloadKey, files]) =>
      Object.entries(files).map(([file, url]) => ({ downloadKey, file, url }))
    )
  );

/** The formats ReaderGata opens, by extension. Torrents are left out. */
export const FORMATS: Record<string, { name: string; type: string }> = {
  epub: { name: "EPUB", type: "application/epub+zip" },
  pdf: { name: "PDF", type: "application/pdf" },
  mobi: { name: "MOBI", type: "application/x-mobipocket-ebook" },
  cbz: { name: "CBZ", type: "application/vnd.comicbook+zip" },
};

export const formatOf = (file: string) => {
  const match = /\.([a-z0-9]+)$/i.exec(file);
  return match ? FORMATS[match[1].toLowerCase()] : undefined;
};
