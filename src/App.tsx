import {
  Box,
  CssBaseline,
  Typography,
  Stack,
  Button,
  TextField,
} from "@mui/material";
import { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App: FunctionComponent = () => {
  const [extensionInstalled, setExtensionInstalled] = useState(true);
  const [simpleAuth, setSimpleAuth] = useState("");

  useEffect(() => {
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
  }, []);

  const saveCookie = () => {
    sendUiMessage({ type: "save", simpleAuth });
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <Stack spacing={2}>
        <Typography>Instructions:</Typography>
        <ol>
          <li>
            Browse to{" "}
            <a href="https://www.humblebundle.com/" target="_blank">
              https://www.humblebundle.com/
            </a>{" "}
            and login.
          </li>
          <li>
            <p>Find the value of the cookie _simpleauth_sess.</p>
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
          {extensionInstalled && (
            <li>You should now be able to browse yours books in Library</li>
          )}
        </ol>
        <TextField
          label="_simpleauth_sess Cookie"
          value={simpleAuth}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setSimpleAuth(value);
          }}
        />
        <Button variant="contained" onClick={saveCookie}>
          Save
        </Button>
      </Stack>
    </Box>
  );
};

export default App;
