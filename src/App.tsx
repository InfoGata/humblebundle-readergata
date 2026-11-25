import { useState, useEffect } from "preact/hooks";
// options.tsx hands App to ThemeProvider, which is typed against React, and
// App's elements only pass for React's while preact/compat's types are loaded
// here. The shadcn components used to load them. It's in the bundle anyway:
// @preact/preset-vite aliases react to it for ThemeProvider.
import "preact/compat";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setLoggedIn(event.data.loggedIn);
          break;
      }
    };

    window.addEventListener("message", onMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {loggedIn ? (
        <p>
          You are logged in to Humble Bundle. Your books are in the Library.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p>
            Click <strong>Login</strong> on this plugin's page and sign in to
            Humble Bundle in the window that opens. Your books then appear in
            the Library.
          </p>
          <p>
            Logging in needs the Android or iOS app, or a browser with the{" "}
            <a
              href="https://github.com/InfoGata/infogata-extension"
              target="_blank"
            >
              InfoGata extension
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
