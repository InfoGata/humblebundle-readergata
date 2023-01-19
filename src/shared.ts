type UiCheckLogin = {
  type: "check-login";
};

export type UiMessageType = UiCheckLogin;

type InfoType = {
  type: "info";
  extensionedInstalled: boolean;
};

export type MessageType = InfoType;
