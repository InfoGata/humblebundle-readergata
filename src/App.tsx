import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { MessageType, UiMessageType } from "./shared";
import { createEffect, createSignal } from "solid-js";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [extensionInstalled, setExtensionInstalled] = createSignal(true);
  const [simpleAuth, setSimpleAuth] = createSignal("");

  createEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setExtensionInstalled(event.data.extensionedInstalled);
          setSimpleAuth(event.data.simpleAuth);
          break;
        default:
          const _exhaustive: never = event.data.type;
          break;
      }
    };

    window.addEventListener("message", onMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onMessage);
  });

  const saveCookie = () => {
    sendUiMessage({ type: "save", simpleAuth: simpleAuth() });
  };

  return (
    <div class="flex flex-col gap-2">
      <h1>Instructions:</h1>
      <ol class="pl-8 list-decimal list-inside space-y-1 flex flex-col">
        <li>
          Browse to{" "}
          <a href="https://www.humblebundle.com/" target="_blank">
            https://www.humblebundle.com/
          </a>{" "}
          and login.
        </li>
        <li>
          Find the value of the cookie _simpleauth_sess.
          <div class="pl-8">
            <p>
              Firefox: Open the{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector"
                target="_blank"
              >
                Storage Inspector
              </a>
            </p>
            <p>
              Chrome: Open the{" "}
              <a
                href="https://developer.chrome.com/devtools/docs/resource-panel#cookies"
                target="_blank"
              >
                Resource Panel
              </a>
            </p>
            <p>
              Safari: Open the Storage Tab of the{" "}
              <a
                href="https://developer.apple.com/safari/tools/"
                target="_blank"
              >
                Web Inspector
              </a>{" "}
              (Context menu on the page, click Inspect page) click the Storage
              tab, select Cookies on the sidebar
            </p>
          </div>
        </li>
        <li>Paste into _simpleauth_sess Cookie text field and click Save</li>
        <li>
          Install the{" "}
          <a
            target="_blank"
            href="https://github.com/InfoGata/infogata-extension"
          >
            InfoGata Extension
          </a>
        </li>
        {extensionInstalled() && (
          <li>You should now be able to browse yours books in Library</li>
        )}
      </ol>
      <Input
        placeholder="_simpleauth_sess Cookie"
        value={simpleAuth()}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setSimpleAuth(value);
        }}
      />
      <Button onClick={saveCookie}>Save</Button>
    </div>
  );
};

export default App;
