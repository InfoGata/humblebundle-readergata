import { describe, expect, it } from "vitest";
import {
  ActionError,
  contentPath,
  encodeMultipart,
  findServerActions,
  formatOf,
  isDownloadable,
  libraryFields,
  pageScripts,
  parseActionResponse,
  signedFiles,
} from "../humble";

describe("parseActionResponse", () => {
  it("follows row 0 to the row holding the result", () => {
    const text =
      '0:{"a":"$@1","q":"","i":false,"b":"build"}\n1:{"ok":true,"data":{"x":1}}\n';
    expect(parseActionResponse(text)).toEqual({ ok: true, data: { x: 1 } });
  });

  it("reads a result in a row other than 1", () => {
    expect(
      parseActionResponse('0:{"a":"$@3"}\n3:{"success":true}')
    ).toEqual({ success: true });
  });

  it("throws on an action that errored", () => {
    expect(() =>
      parseActionResponse('0:{"a":"$@1"}\n1:E{"digest":"3276237310"}')
    ).toThrow(ActionError);
  });

  it("throws on an html page, which is what an unknown action id gets", () => {
    expect(() =>
      parseActionResponse("<!DOCTYPE html><html>…</html>")
    ).toThrow(ActionError);
  });
});

describe("findServerActions", () => {
  it("pairs each id with the action's name", () => {
    const script =
      'let rl=(0,a0.createServerReference)("607286a6c5956a391ffaab6aaf6d0d1e526e8034dd",a0.callServer,void 0,a0.findSourceMapURL,"filterUserLibrary");' +
      'V=(0,r.createServerReference)("7052d4608cc472c977871479689346802b3c34ba51",r.callServer,void 0,r.findSourceMapURL,"getSignedUrlsForEntitlements")';
    expect(findServerActions(script)).toEqual({
      filterUserLibrary: "607286a6c5956a391ffaab6aaf6d0d1e526e8034dd",
      getSignedUrlsForEntitlements: "7052d4608cc472c977871479689346802b3c34ba51",
    });
  });

  it("finds nothing in a script without actions", () => {
    expect(findServerActions("console.log('hi')")).toEqual({});
  });
});

describe("pageScripts", () => {
  it("lists each same-origin chunk once, absolute", () => {
    const html =
      '<script src="/_next/static/chunks/2b9pn0lcwrs__.js" async></script>' +
      '<link rel="preload" href="/_next/static/chunks/0hu5mghjss8yg.js"/>' +
      '<script src="/_next/static/chunks/2b9pn0lcwrs__.js"></script>' +
      '<script src="https://cdn.static.zdbb.net/x.js"></script>';
    expect(pageScripts(html)).toEqual([
      "https://www.humblebundle.com/_next/static/chunks/2b9pn0lcwrs__.js",
      "https://www.humblebundle.com/_next/static/chunks/0hu5mghjss8yg.js",
    ]);
  });
});

describe("encodeMultipart", () => {
  it("writes each field and the closing boundary", () => {
    expect(encodeMultipart([["a", "1"], ["b", ""]], "B")).toBe(
      '--B\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n' +
        '--B\r\nContent-Disposition: form-data; name="b"\r\n\r\n\r\n' +
        "--B--\r\n"
    );
  });
});

describe("libraryFields", () => {
  it("encodes the form as argument 1 after the previous state", () => {
    const fields = Object.fromEntries(libraryFields(2, 100));
    expect(fields._1_page).toBe("2");
    expect(fields._1_limit).toBe("100");
    expect(JSON.parse(fields["0"])[1]).toBe("$K1");
  });
});

describe("signedFiles", () => {
  it("flattens subproduct → download key → file", () => {
    expect(
      signedFiles({
        book: {
          book_ebook: {
            "book.epub": "https://cdn.humble.com/book.epub?t=1",
            "book.epub.torrent": "https://cdn.humble.com/t?t=1",
          },
        },
      })
    ).toEqual([
      {
        downloadKey: "book_ebook",
        file: "book.epub",
        url: "https://cdn.humble.com/book.epub?t=1",
      },
      {
        downloadKey: "book_ebook",
        file: "book.epub.torrent",
        url: "https://cdn.humble.com/t?t=1",
      },
    ]);
  });
});

describe("formatOf", () => {
  it("knows the formats ReaderGata opens, whatever the case", () => {
    expect(formatOf("a.epub")?.name).toBe("EPUB");
    expect(formatOf("a.PDF")?.type).toBe("application/pdf");
    expect(formatOf("a.mobi")?.name).toBe("MOBI");
  });

  it("leaves out torrents and anything else", () => {
    expect(formatOf("a.epub.torrent")).toBeUndefined();
    expect(formatOf("setup.exe")).toBeUndefined();
  });
});

describe("isDownloadable", () => {
  it("keeps drm-free downloads and drops bundles and keys", () => {
    expect(
      isDownloadable({ id: "1", title: "t", type: "download_drm_free" })
    ).toBe(true);
    expect(isDownloadable({ id: "1", title: "t", type: "bundle" })).toBe(false);
  });
});

describe("contentPath", () => {
  it("escapes the id", () => {
    expect(contentPath("a/b")).toBe("/home/library/content/a%2Fb");
  });
});
