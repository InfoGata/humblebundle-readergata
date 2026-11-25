import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NotLoggedInError,
  humbleRequest,
  itemToPublication,
  parseSourceRef,
  sourcesFromFiles,
} from "../index";

const app = (globalThis as any).application;

describe("humbleRequest", () => {
  const url = "https://www.humblebundle.com/home/library";

  afterEach(() => {
    app.isLoggedIn.mockResolvedValue(false);
    app.networkRequest.mockReset();
  });

  it("goes through the app once logged in", async () => {
    app.isLoggedIn.mockResolvedValue(true);
    app.networkRequest.mockResolvedValue(new Response("ok"));
    const init = { method: "POST", body: "x" };
    await humbleRequest(url, init);
    expect(app.networkRequest).toHaveBeenCalledWith(url, init);
  });

  it("refuses without a login", async () => {
    await expect(humbleRequest(url)).rejects.toBeInstanceOf(NotLoggedInError);
    expect(app.networkRequest).not.toHaveBeenCalled();
  });

  it("reads a 401 as a lapsed login", async () => {
    app.isLoggedIn.mockResolvedValue(true);
    app.networkRequest.mockResolvedValue(new Response("", { status: 401 }));
    await expect(humbleRequest(url)).rejects.toBeInstanceOf(NotLoggedInError);
  });
});

describe("itemToPublication", () => {
  it("identifies the book by its entitlement and files it under its bundle", () => {
    expect(
      itemToPublication({
        id: "c7a5",
        title: "Building Micro-Frontends",
        subTitle: "Humble Tech Book Bundle",
        type: "download_drm_free",
      })
    ).toEqual({
      title: "Building Micro-Frontends",
      apiId: "c7a5",
      categories: [
        { name: "Humble Tech Book Bundle", scheme: "humblebundle:bundle" },
      ],
      originalUrl: "https://www.humblebundle.com/home/library/content/c7a5",
    });
  });
});

describe("sourcesFromFiles", () => {
  it("offers the readable formats, naming the file rather than its signed url", () => {
    const sources = sourcesFromFiles("c7a5", [
      { downloadKey: "b_ebook", file: "b.pdf" },
      { downloadKey: "b_ebook", file: "b.pdf.torrent" },
      { downloadKey: "b_ebook", file: "b.epub" },
    ]);
    expect(sources.map((s) => s.name)).toEqual(["PDF", "EPUB"]);
    expect(parseSourceRef(sources[1].source)).toEqual({
      id: "c7a5",
      downloadKey: "b_ebook",
      file: "b.epub",
    });
  });
});

describe("parseSourceRef", () => {
  it("explains a source saved from the old library", () => {
    expect(() =>
      parseSourceRef("https://dl.humble.com/book.epub?gamekey=x")
    ).toThrow(/old library/);
  });
});
