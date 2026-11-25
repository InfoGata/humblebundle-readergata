# humblebundle-readergata

A [readergata](https://github.com/InfoGata/readergata) plugin for Humble Bundle.

[Installation Link](https://www.readergata.com/plugininstall?manifestUrl=https://cdn.jsdelivr.net/gh/InfoGata/humblebundle-readergata@latest/manifest.json)

In the Android and iOS apps, or in a browser with the
[InfoGata extension](https://github.com/InfoGata/infogata-extension)
installed, click **Login** on the plugin's page in ReaderGata and sign in to
Humble Bundle in the window it opens. In a browser the extension asks once to
allow your login on `auth.humblebundle.com` and `www.humblebundle.com`, and
once to make requests from a page on `www.humblebundle.com`.

Humble's library is a Next.js app with no public api. The plugin calls the
server actions the library page itself uses (`filterUserLibrary` and
`getSignedUrlsForEntitlements`), finding their ids in the site's scripts, since
they change with every deploy. Next.js refuses a server action whose `Origin`
isn't Humble's, which is why the extension makes those requests from a page on
the site (`pageContextRequests`); the apps' native requests send no `Origin`.
Pasting a cookie is no longer supported: the api it was sent to is gone.
