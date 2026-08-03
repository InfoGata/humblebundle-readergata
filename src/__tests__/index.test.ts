import { describe, expect, it } from "vitest";
import {
  buildApiId,
  parseApiId,
  parseHumanSize,
  subproductToPublication,
} from "../index";

const download = (name: string, url: string, humanSize?: string) => ({
  name,
  human_size: humanSize as string,
  url: { web: url, bittorrent: `${url}.torrent` },
});

const order = (overrides: Record<string, unknown> = {}) =>
  ({
    gamekey: "abc123",
    product: { human_name: "Humble Book Bundle: Python" },
    subproducts: [],
    ...overrides,
  }) as any;

const subproduct = (overrides: Record<string, unknown> = {}) =>
  ({
    human_name: "Automate the Boring Stuff",
    machine_name: "automate_boring_stuff",
    icon: "https://example.com/icon.png",
    url: "https://www.humblebundle.com/downloads?key=abc123",
    downloads: [
      {
        platform: "ebook",
        download_struct: [
          download("PDF", "https://example.com/book.pdf", "8.4 MB"),
          download("EPUB", "https://example.com/book.epub", "5.2 MB"),
          download("MOBI", "https://example.com/book.mobi", "6 MB"),
        ],
      },
    ],
    ...overrides,
  }) as any;

describe("apiId", () => {
  it("round trips a gamekey and machine name", () => {
    expect(parseApiId(buildApiId("abc123", "automate_boring_stuff"))).toEqual({
      gamekey: "abc123",
      machineName: "automate_boring_stuff",
    });
  });

  it("splits on the first separator, so a machine name may contain one", () => {
    expect(parseApiId("abc123|weird|name")).toEqual({
      gamekey: "abc123",
      machineName: "weird|name",
    });
  });

  it("throws on an apiId that names no book", () => {
    expect(() => parseApiId("abc123")).toThrow(/Unrecognized apiId/);
  });
});

describe("parseHumanSize", () => {
  it("reads the decimal units Humble displays", () => {
    expect(parseHumanSize("5.2 MB")).toBe(5_200_000);
    expect(parseHumanSize("1 GB")).toBe(1_000_000_000);
    expect(parseHumanSize("512 kb")).toBe(512_000);
    expect(parseHumanSize("900 B")).toBe(900);
  });

  it("tolerates missing whitespace and odd casing", () => {
    expect(parseHumanSize("5.2mb")).toBe(5_200_000);
  });

  it("is undefined when there is no size to read", () => {
    expect(parseHumanSize(undefined)).toBeUndefined();
    expect(parseHumanSize("")).toBeUndefined();
    expect(parseHumanSize("quite big")).toBeUndefined();
  });
});

describe("subproductToPublication", () => {
  it("identifies the book by its order and slug", () => {
    const publication = subproductToPublication(order(), subproduct());
    expect(publication.apiId).toBe("abc123|automate_boring_stuff");
    expect(publication.title).toBe("Automate the Boring Stuff");
    expect(publication.originalUrl).toBe(
      "https://www.humblebundle.com/downloads?key=abc123"
    );
  });

  it("files the book under the bundle it came in", () => {
    expect(subproductToPublication(order(), subproduct()).categories).toEqual([
      {
        name: "Humble Book Bundle: Python",
        scheme: "humblebundle:bundle",
      },
    ]);
  });

  it("keeps only the formats ReaderGata can open, with their sizes", () => {
    const publication = subproductToPublication(order(), subproduct());
    expect(publication.sources).toEqual([
      {
        name: "PDF",
        source: "https://example.com/book.pdf",
        type: "application/pdf",
        size: 8_400_000,
        acquisitionType: "open-access",
      },
      {
        name: "EPUB",
        source: "https://example.com/book.epub",
        type: "application/epub+zip",
        size: 5_200_000,
        acquisitionType: "open-access",
      },
    ]);
  });

  it("leaves out the bundle name when the order has no product", () => {
    const publication = subproductToPublication(
      order({ product: undefined }),
      subproduct()
    );
    expect(publication.categories).toBeUndefined();
  });

  it("leaves out a size Humble did not report", () => {
    const publication = subproductToPublication(
      order(),
      subproduct({
        downloads: [
          {
            platform: "ebook",
            download_struct: [
              download("EPUB", "https://example.com/book.epub"),
            ],
          },
        ],
      })
    );
    expect(publication.sources?.[0].size).toBeUndefined();
  });
});
