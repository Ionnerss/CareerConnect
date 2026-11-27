// @vitest-environment jsdom

import { StrictMode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackgroundRefreshControl from "./background-refresh-control";

const mockFetch = vi.fn();

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function preference(enabled: boolean) {
  return response({ success: true, enabled });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BackgroundRefreshControl", () => {
  it("loads the saved preference before showing the switch", async () => {
    let resolveResponse!: (
      value: ReturnType<typeof response>,
    ) => void;

    mockFetch.mockReturnValue(
      new Promise<ReturnType<typeof response>>((resolve) => {
        resolveResponse = resolve;
      }),
    );

    render(<BackgroundRefreshControl />);

    expect(screen.getByRole("status").textContent).toContain(
      "Loading your setting",
    );

    expect(screen.queryByRole("switch")).toBeNull();

    resolveResponse(preference(false));

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    expect(control.getAttribute("aria-checked")).toBe("false");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/recommendations/preferences",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("waits for confirmation before enabling and blocks duplicate saves", async () => {
    const user = userEvent.setup();

    let resolveSave!: (
      value: ReturnType<typeof response>,
    ) => void;

    mockFetch.mockResolvedValueOnce(preference(false));
    mockFetch.mockReturnValueOnce(
      new Promise<ReturnType<typeof response>>((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<BackgroundRefreshControl />);

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    await user.click(control);

    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(control.hasAttribute("disabled")).toBe(true);

    await user.click(control);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/recommendations/preferences",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ enabled: true }),
      }),
    );

    resolveSave(preference(true));

    await waitFor(() => {
      expect(control.getAttribute("aria-checked")).toBe("true");
      expect(control.hasAttribute("disabled")).toBe(false);
    });
  });

  it("disables an enabled preference", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce(preference(true));
    mockFetch.mockResolvedValueOnce(preference(false));

    render(<BackgroundRefreshControl />);

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    expect(control.getAttribute("aria-checked")).toBe("true");

    await user.click(control);

    await waitFor(() => {
      expect(control.getAttribute("aria-checked")).toBe("false");
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/recommendations/preferences",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ enabled: false }),
      }),
    );
  });

  it("preserves the previous setting when saving fails", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce(preference(true));
    mockFetch.mockResolvedValueOnce(
      response(
        {
          success: false,
          code: "BACKEND_ERROR",
          error: "Private backend details",
        },
        500,
      ),
    );

    render(<BackgroundRefreshControl />);

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    await user.click(control);

    const alert = await screen.findByRole("alert");

    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(alert.textContent).not.toContain(
      "Private backend details",
    );
  });

  it("can retry after the initial preference request fails", async () => {
    const user = userEvent.setup();

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    mockFetch.mockResolvedValueOnce(preference(false));

    render(<BackgroundRefreshControl />);

    await screen.findByRole("alert");

    await user.click(
      screen.getByRole("button", {
        name: "Retry loading setting",
      }),
    );

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("links to MFA verification when required", async () => {
    mockFetch.mockResolvedValue(
      response(
        {
          success: false,
          code: "MFA_REQUIRED",
        },
        403,
      ),
    );

    render(<BackgroundRefreshControl />);

    const link = await screen.findByRole("link", {
      name: "Verify your account",
    });

    expect(link.getAttribute("href")).toBe("/auth/mfa");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("rejects a malformed successful response", async () => {
    mockFetch.mockResolvedValue(
      response({ success: true, enabled: "true" }),
    );

    render(<BackgroundRefreshControl />);

    await screen.findByRole("alert");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("aborts outstanding requests when unmounted", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { unmount } = render(<BackgroundRefreshControl />);

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const signal = init.signal as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("links to sign-in for an expired session", async () => {
    mockFetch.mockResolvedValue(
      response(
        {
          success: false,
          code: "UNAUTHENTICATED",
        },
        401,
      ),
    );

    render(<BackgroundRefreshControl />);

    const link = await screen.findByRole("link", {
      name: "Sign in",
    });

    expect(link.getAttribute("href")).toBe("/auth/login");
  });

  it("loads successfully during Strict Mode effect replay", async () => {
    mockFetch.mockResolvedValue(preference(false));

    render(
      <StrictMode>
        <BackgroundRefreshControl />
      </StrictMode>,
    );

    const control = await screen.findByRole("switch", {
      name: "Background refresh",
    });

    expect(control.getAttribute("aria-checked")).toBe("false");

    const firstInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(true);
  });
});