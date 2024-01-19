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

const getHumbleBundleOrder = async (
  gamekey: string
): Promise<Publication[]> => {
  const formats = ["pdf", "epub"];
  const bundleUrl = `https://www.humblebundle.com/api/v1/order/${gamekey}?ajax=true`;
  const orderResponse = (await application.isLoggedIn())
    ? await application.networkRequest(bundleUrl)
    : await fetch(getProxyUrl(bundleUrl));

  const orderJson: Order = await orderResponse.json();
  const filteredDownloads: Publication[] = orderJson.subproducts
    .filter((sp) => sp.downloads.some((d) => d.platform === "ebook"))
    .map(
      (sp): Publication => ({
        title: sp.human_name,
        images: [{ url: sp.icon }],
        sources: sp.downloads[0].download_struct
          .map(
            (d): PublicationSource => ({
              name: d.name,
              source: d.url.web,
              type:
                d.name.toLocaleLowerCase() === "pdf"
                  ? "application/pdf"
                  : "application/epub+zip",
            })
          )
          .filter((s) => formats.includes(s.name?.toLocaleLowerCase() || "")),
      })
    );
  return filteredDownloads;
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

application.onGetPublication = async (
  request: GetPublicationRequest
): Promise<GetPublicationResponse> => {
  const result = await application.networkRequest(request.source);
  const blob = await result.blob();
  const response: GetPublicationResponse = {
    source: await blobToString(blob),
    sourceType: "binary",
  };

  return response;
};

const changeTheme = (theme: Theme) => {
  localStorage.setItem("kb-color-mode", theme);
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
