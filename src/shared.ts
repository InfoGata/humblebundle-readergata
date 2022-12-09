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
};

export type MessageType = InfoType;
