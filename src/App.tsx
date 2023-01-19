import { Box, CssBaseline, Typography, Stack } from "@mui/material";
import { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App: FunctionComponent = () => {
  const [extensionInstalled, setExtensionInstalled] = useState(true);

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setExtensionInstalled(event.data.extensionedInstalled);
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
      </Stack>
    </Box>
  );
};

export default App;
