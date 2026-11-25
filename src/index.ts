import {
  ACTIONS,
  ActionError,
  ActionName,
  LIBRARY_PATH,
  LibraryItem,
  LibraryPage,
  ORIGIN,
  SignedUrlsResult,
  contentPath,
  encodeMultipart,
  findServerActions,
  formatOf,
  isDownloadable,
  libraryFields,
  pageScripts,
  parseActionResponse,
  signedFiles,
} from "./humble";
import { MessageType, UiMessageType } from "./shared";

export class NotLoggedInError extends Error {
  constructor() {
    super(
      "Not logged in to Humble Bundle. Click Login on the plugin's page in ReaderGata."
    );
    this.name = "NotLoggedInError";
  }
}

/**
 * A request to Humble as the reader. Only a login made through ReaderGata --
 * the extension's login window, or the app's in-app browser -- can carry the
 * session: Humble's sign-in moved to a separate service whose cookies a
 * reader can't usefully copy, and the api a pasted cookie was sent to is gone.
 */
export const humbleRequest = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  if (!(await application.isLoggedIn())) {
    throw new NotLoggedInError();
  }
  const response = await application.networkRequest(url, init);
  if (response.status === 401 || response.status === 403) {
    throw new NotLoggedInError();
  }
  return response;
};

// --- Server action ids --------------------------------------------------

const ACTION_IDS_KEY = "actionIds";

const cachedActionIds = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(ACTION_IDS_KEY) || "{}");
  } catch {
    return {};
  }
};

/**
 * Reads the ids out of the scripts a page loads. Each action is only in the
 * scripts of the page that uses it, so the page is named by the caller.
 */
const discoverActionIds = async (pagePath: string, wantedHere: ActionName) => {
  const html = await (await humbleRequest(`${ORIGIN}${pagePath}`)).text();
  const found: Record<string, string> = { ...cachedActionIds() };
  // From the end: the shared framework comes first and the page's own code
  // last, which is where its actions are.
  const scripts = pageScripts(html).reverse();
  // A handful at a time, stopping once everything wanted has turned up: a
  // page loads dozens of scripts, some of them half a megabyte.
  for (let i = 0; i < scripts.length; i += 6) {
    const batch = await Promise.all(
      scripts.slice(i, i + 6).map(async (url) => {
        try {
          return await (await application.networkRequest(url)).text();
        } catch {
          return "";
        }
      })
    );
    for (const script of batch) Object.assign(found, findServerActions(script));
    if (found[wantedHere]) break;
  }
  localStorage.setItem(ACTION_IDS_KEY, JSON.stringify(found));
  return found;
};

const BOUNDARY = "----readergata-humble";

/**
 * Calls a server action, finding its id first if it isn't known, and once
 * more if Humble has deployed since and the known id no longer answers.
 */
const callAction = async <T>(
  name: ActionName,
  path: string,
  body: { multipart: [string, string][] } | { json: unknown }
): Promise<T> => {
  const request = async (id: string) => {
    const headers: Record<string, string> = {
      "Next-Action": id,
      Accept: "text/x-component",
    };
    let payload: string;
    if ("multipart" in body) {
      headers["Content-Type"] = `multipart/form-data; boundary=${BOUNDARY}`;
      payload = encodeMultipart(body.multipart, BOUNDARY);
    } else {
      headers["Content-Type"] = "text/plain;charset=UTF-8";
      payload = JSON.stringify(body.json);
    }
    const response = await humbleRequest(`${ORIGIN}${path}`, {
      method: "POST",
      headers,
      body: payload,
    });
    return parseActionResponse<T>(await response.text());
  };

  const known = cachedActionIds()[name];
  if (known) {
    try {
      return await request(known);
    } catch (e) {
      if (e instanceof NotLoggedInError) throw e;
      // An unknown id answers with an html error page: look again.
    }
  }
  const id = (await discoverActionIds(path, name))[name];
  if (!id) {
    throw new Error(
      `Couldn't find Humble Bundle's ${name}; the site may have changed.`
    );
  }
  return await request(id);
};

// --- The library ----------------------------------------------------------

const PAGE_SIZE = 100;

/** Humble's codes for a missing session. */
const isAuthError = (code?: string) =>
  !!code && /auth|session|login/i.test(code);

export const getLibrary = async (): Promise<LibraryItem[]> => {
  const items: LibraryItem[] = [];
  for (let page = 1; ; page++) {
    const result = await callAction<LibraryPage>(ACTIONS.library, LIBRARY_PATH, {
      multipart: libraryFields(page, PAGE_SIZE),
    });
    if (!result.success) {
      if (isAuthError(result.error)) throw new NotLoggedInError();
      throw new ActionError(
        `Humble Bundle couldn't list the library (${result.error})`,
        result.error
      );
    }
    items.push(...result.results);
    const totalPages = result.pagination?.totalPages ?? 1;
    if (page >= totalPages || result.results.length === 0) break;
  }
  return items.filter(isDownloadable);
};

/** Fresh cdn urls for one item's files; they last a day. */
const signFiles = async (id: string) => {
  const result = await callAction<SignedUrlsResult>(
    ACTIONS.signedUrls,
    contentPath(id),
    { json: [[id]] }
  );
  if (!result.ok || !result.data) {
    if (isAuthError(result.code)) throw new NotLoggedInError();
    throw new ActionError(
      `Humble Bundle couldn't prepare the download (${result.code})`,
      result.code
    );
  }
  return signedFiles(result.data.signedUrls);
};

/**
 * What a source names. The signed url itself would expire, so a source names
 * the file instead, and is signed again whenever it's opened.
 */
interface SourceRef {
  id: string;
  downloadKey: string;
  file: string;
}

export const itemToPublication = (item: LibraryItem): Publication => ({
  title: item.title,
  apiId: item.id,
  // The bundle it arrived in is the only grouping Humble offers, and it is how
  // a reader remembers where a book came from.
  categories: item.subTitle
    ? [{ name: item.subTitle, scheme: "humblebundle:bundle" }]
    : undefined,
  originalUrl: `${ORIGIN}${contentPath(item.id)}`,
});

export const sourcesFromFiles = (
  id: string,
  files: { downloadKey: string; file: string }[]
): PublicationSource[] =>
  files.flatMap(({ downloadKey, file }) => {
    const format = formatOf(file);
    if (!format) return [];
    const ref: SourceRef = { id, downloadKey, file };
    return [
      {
        name: format.name,
        source: JSON.stringify(ref),
        type: format.type,
        // The reader already bought it.
        acquisitionType: "open-access" as const,
      },
    ];
  });

/** The library, kept briefly so opening a book doesn't list it all again. */
let libraryCache: { at: number; items: Promise<LibraryItem[]> } | undefined;
const LIBRARY_TTL_MS = 5 * 60_000;

const cachedLibrary = () => {
  if (!libraryCache || Date.now() - libraryCache.at > LIBRARY_TTL_MS) {
    const items = getLibrary();
    libraryCache = { at: Date.now(), items };
    items.catch(() => (libraryCache = undefined));
  }
  return libraryCache.items;
};

const getFeed = async (_request: GetFeedRequest): Promise<Feed> => {
  libraryCache = undefined;
  return {
    type: "publication",
    items: (await cachedLibrary()).map(itemToPublication),
  };
};

const OLD_LIBRARY_MESSAGE =
  "This book was saved from Humble Bundle's old library. Open it again from the library.";

/**
 * Assigned unconditionally, unlike `onGetFeed`, which only appears once the
 * reader is logged in. Withholding it would make ReaderGata believe the plugin
 * cannot describe a publication at all, and show a stale row rather than the
 * real reason it failed.
 */
application.onGetPublicationDetails = async (
  request: GetPublicationDetailsRequest
): Promise<Publication> => {
  // Books saved before Humble's move were `gamekey|machine_name`, which
  // nothing in the new library is keyed by.
  if (request.apiId.includes("|")) throw new Error(OLD_LIBRARY_MESSAGE);
  const [items, files] = await Promise.all([
    cachedLibrary(),
    signFiles(request.apiId),
  ]);
  const item = items.find((i) => i.id === request.apiId);
  if (!item) throw new Error(`No item ${request.apiId} in the library`);
  return {
    ...itemToPublication(item),
    sources: sourcesFromFiles(item.id, files),
  };
};

export const blobToString = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (res) => {
      resolve(res.target?.result as string);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(blob);
  });
};

export const parseSourceRef = (source: string): SourceRef => {
  try {
    const ref = JSON.parse(source) as Partial<SourceRef>;
    if (ref.id && ref.downloadKey && ref.file) return ref as SourceRef;
  } catch {
    // An old library's source was a bare url.
  }
  throw new Error(OLD_LIBRARY_MESSAGE);
};

application.onGetPublicationSource = async (
  request: GetPublicationSourceRequest
): Promise<GetPublicationSourceResponse> => {
  const ref = parseSourceRef(request.source);
  const signed = (await signFiles(ref.id)).find(
    (f) => f.downloadKey === ref.downloadKey && f.file === ref.file
  );
  if (!signed) throw new Error(`Humble Bundle no longer has ${ref.file}`);
  // A signed cdn url, so it needs no cookies.
  const result = await application.networkRequest(signed.url);
  if (!result.ok) {
    throw new Error(`Download failed: ${result.status} ${result.statusText}`);
  }
  return {
    source: await blobToString(await result.blob()),
    sourceType: "binary",
  };
};

// --- Wiring -------------------------------------------------------------

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

const getInfo = async () => {
  sendMessage({
    type: "info",
    loggedIn: await application.isLoggedIn(),
  });
};

/**
 * The library is only offered to a logged-in reader: without a login there is
 * nothing to list, and ReaderGata leaves a plugin with no `onGetFeed` out of
 * the library rather than showing an empty one.
 */
const updateFeed = async () => {
  libraryCache = undefined;
  application.onGetFeed = (await application.isLoggedIn())
    ? getFeed
    : undefined;
  // An open options page shows whether the reader is signed in.
  await getInfo();
};

application.onUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      await getInfo();
      break;
  }
};

const changeTheme = (theme: Theme) => {
  localStorage.setItem("vite-ui-theme", theme);
};
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

const init = async () => {
  // The cookie the old options page asked for; nothing reads it any more.
  localStorage.removeItem("simpleAuth");
  await updateFeed();
  changeTheme(await application.getTheme());
};

application.onPostLogin = updateFeed;
application.onPostLogout = updateFeed;
init();
