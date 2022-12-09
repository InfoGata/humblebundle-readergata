import { Box, CssBaseline, TextField, Button } from "@mui/material";
import { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App: FunctionComponent = () => {
  const [simpleAuth, setSimpleAuth] = useState("");

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
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
    </Box>
  );
};

export default App;
