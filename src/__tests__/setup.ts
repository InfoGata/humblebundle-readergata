import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock the `application` global used by the plugin runtime
(globalThis as any).application = {
  onUiMessage: null,
  onGetFeed: null,
  onGetPublicationSource: null,
  onGetPublicationDetails: null,
  onPostLogin: null,
  onChangeTheme: null,
  postUiMessage: vi.fn(),
  createNotification: vi.fn(),
  networkRequest: vi.fn(),
  isLoggedIn: vi.fn().mockResolvedValue(false),
  isNetworkRequestCorsDisabled: vi.fn().mockResolvedValue(false),
  onPostLogout: null,
  getTheme: vi.fn().mockResolvedValue("light"),
};
