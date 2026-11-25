type UiCheckLogin = {
  type: "check-login";
};

export type UiMessageType = UiCheckLogin;

type InfoType = {
  type: "info";
  loggedIn: boolean;
};

export type MessageType = InfoType;
