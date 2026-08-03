import { MessageType, UiMessageType } from "./shared";

const orderUrl = "https://www.humblebundle.com/api/v1/user/order?ajax=true";

interface Bundle {
  gamekey: string;
}

interface Order {
  gamekey: string;
  product: Product;
  subproducts: SubProduct[];
}

interface Product {
  human_name: string;
}

interface SubProduct {
  human_name: string;
  /** Humble's own stable slug for the book, unique within an order. */
  machine_name: string;
  icon: string;
  url: string;
  downloads: Download[];
}

interface Download {
  platform: string;
  download_struct: DownloadStruct[];
}

interface DownloadStruct {
  name: string;
  human_size: string;
  url: DownloadUrl;
}

interface DownloadUrl {
  web: string;
  bittorrent: string;
}

const getProxyUrl = (url: string) => {
  const simpleAuth = localStorage.getItem("simpleAuth");
  const requestHeaders = {
    Cookie: `_simpleauth_sess=${simpleAuth};`,
  };
  const proxiedUrl = `https://cloudcors.audio-pwa.workers.dev?setRequestHeaders=${JSON.stringify(
    requestHeaders
  )}&url=${url}`;
  return proxiedUrl;
};

const formats = ["pdf", "epub"];

const API_ID_SEPARATOR = "|";

/**
 * A book is only identified by which order it came in and which subproduct it
 * is, so `apiId` has to carry both.
 */
export const buildApiId = (gamekey: string, machineName: string): string =>
  `${gamekey}${API_ID_SEPARATOR}${machineName}`;

export const parseApiId = (
  apiId: string
): { gamekey: string; machineName: string } => {
  // Split on the first separator: gamekeys never contain one, machine names
  // conceivably could.
  const index = apiId.indexOf(API_ID_SEPARATOR);
  if (index === -1) {
    throw new Error(`Unrecognized apiId: ${apiId}`);
  }
  return {
    gamekey: apiId.slice(0, index),
    machineName: apiId.slice(index + API_ID_SEPARATOR.length),
  };
};

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
};

/** Humble reports sizes as "5.2 MB", in decimal units. ReaderGata wants bytes. */
export const parseHumanSize = (value: string | undefined) => {
  if (!value) return undefined;
  const match = /^\s*([\d.]+)\s*([kmg]?b)\s*$/i.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * SIZE_UNITS[match[2].toLowerCase()]);
};

export const subproductToPublication = (
  order: Order,
  subproduct: SubProduct
): Publication => ({
  title: subproduct.human_name,
  apiId: buildApiId(order.gamekey, subproduct.machine_name),
  images: [{ url: subproduct.icon }],
  // The bundle it arrived in is the only grouping Humble offers, and it is how
  // a reader remembers where a book came from.
  categories: order.product?.human_name
    ? [{ name: order.product.human_name, scheme: "humblebundle:bundle" }]
    : undefined,
  originalUrl: subproduct.url || undefined,
  sources: subproduct.downloads[0].download_struct
    .map(
      (d): PublicationSource => ({
        name: d.name,
        source: d.url.web,
        type:
          d.name.toLocaleLowerCase() === "pdf"
            ? "application/pdf"
            : "application/epub+zip",
        size: parseHumanSize(d.human_size),
        // The reader already bought it.
        acquisitionType: "open-access",
      })
    )
    .filter((s) => formats.includes(s.name?.toLocaleLowerCase() || "")),
});

const fetchOrder = async (gamekey: string): Promise<Order> => {
  const bundleUrl = `https://www.humblebundle.com/api/v1/order/${gamekey}?ajax=true`;
  const orderResponse = (await application.isLoggedIn())
    ? await application.networkRequest(bundleUrl)
    : await fetch(getProxyUrl(bundleUrl));
  return await orderResponse.json();
};

const getHumbleBundleOrder = async (
  gamekey: string
): Promise<Publication[]> => {
  const order = await fetchOrder(gamekey);
  return order.subproducts
    .filter((sp) => sp.downloads.some((d) => d.platform === "ebook"))
    .map((sp) => subproductToPublication(order, sp));
};

const getOrders = async () => {
  const bundleResponse = (await application.isLoggedIn())
    ? await application.networkRequest(orderUrl)
    : await fetch(getProxyUrl(orderUrl));
  if (bundleResponse.status !== 200) {
    return [];
  }

  const bundles: Bundle[] = await bundleResponse.json();

  let promises: Promise<Publication[]>[] = [];
  for (const bundle of bundles) {
    promises.push(getHumbleBundleOrder(bundle.gamekey));
  }
  const filteredBooks = await Promise.all(promises);
  return filteredBooks.flat();
};

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

const getInfo = async () => {
  const simpleAuth = localStorage.getItem("simpleAuth") || "";
  sendMessage({
    type: "info",
    extensionedInstalled: await application.isNetworkRequestCorsDisabled(),
    simpleAuth,
  });
};

const getFeed = async (_request: GetFeedRequest): Promise<Feed> => {
  const publications = await getOrders();
  return {
    type: "publication",
    items: publications,
  };
};

application.onUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      getInfo();
      break;
    case "save":
      if (message.simpleAuth) {
        application.onGetFeed = getFeed;
      }
      localStorage.setItem("simpleAuth", message.simpleAuth);
      application.createNotification({ message: "Save successful" });
      break;
    default:
      const _exhaustive: never = message;
      break;
  }
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

application.onGetPublicationSource = async (
  request: GetPublicationSourceRequest
): Promise<GetPublicationSourceResponse> => {
  const result = await application.networkRequest(request.source);
  const blob = await result.blob();
  const response: GetPublicationSourceResponse = {
    source: await blobToString(blob),
    sourceType: "binary",
  };

  return response;
};

/**
 * Assigned unconditionally, unlike `onGetFeed`, which only appears once the
 * reader is logged in. Withholding it would make ReaderGata believe the plugin
 * cannot describe a publication at all, and show a stale row rather than the
 * real reason it failed.
 */
application.onGetPublicationDetails = async (
  request: GetPublicationDetailsRequest
): Promise<Publication> => {
  const { gamekey, machineName } = parseApiId(request.apiId);
  const order = await fetchOrder(gamekey);
  const subproduct = order.subproducts?.find(
    (sp) => sp.machine_name === machineName
  );
  if (!subproduct) {
    throw new Error(`No book ${machineName} in order ${gamekey}`);
  }
  return subproductToPublication(order, subproduct);
};

const changeTheme = (theme: Theme) => {
  localStorage.setItem("vite-ui-theme", theme);
};
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

const init = async () => {
  const simpleAuth = localStorage.getItem("simpleAuth");
  const loggedIn = await application.isLoggedIn();
  console.log("logged In:", loggedIn);
  if (simpleAuth || loggedIn) {
    application.onGetFeed = getFeed;
  }
  const theme = await application.getTheme();
  changeTheme(theme);
};

application.onPostLogin = init;
init();
