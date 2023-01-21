type UiCheckLogin = {
  type: "check-login";
};

type UiSave = {
  type: "save";
  simpleAuth: string;
};

export type UiMessageType = UiCheckLogin | UiSave;

type InfoType = {
  type: "info";
  simpleAuth: string;
  extensionedInstalled: boolean;
};

export type MessageType = InfoType;
