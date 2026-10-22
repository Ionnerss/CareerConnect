// @vitest-environment jsdom

/**
 * Tests the homepage motion helpers: that content stays visible when the
 * visitor prefers reduced motion, that scroll reveals arm and fire, that the
 * scroll-linked text follows scroll position, and that in-page links scroll
 * and move focus without touching the router.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HomeAnchors, Reveal, ScrollTextReveal } from "./home-motion";

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function mockRect(element: Element, rect: { top: number; height: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top: rect.top,
    height: rect.height,
    bottom: rect.top + rect.height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: rect.top,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("renders its content visible by default", () => {
    mockReducedMotion(false);
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<Reveal>Hello</Reveal>);

    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("Hello").getAttribute("data-reveal")).toBe("idle");
  });

  it("never hides content when reduced motion is requested", () => {
    mockReducedMotion(true);
    const observe = vi.fn();
    class FakeObserver {
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    render(<Reveal>Calm</Reveal>);

    expect(screen.getByText("Calm").getAttribute("data-reveal")).toBe("idle");
    expect(observe).not.toHaveBeenCalled();
  });

  it("keeps content that is already on screen visible", () => {
    mockReducedMotion(false);
    const observe = vi.fn();
    class FakeObserver {
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 50,
      bottom: 150,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    render(<Reveal>Above the fold</Reveal>);

    expect(screen.getByText("Above the fold").getAttribute("data-reveal")).toBe(
      "visible",
    );
    expect(observe).not.toHaveBeenCalled();
  });

  it("arms below-the-fold content, then reveals it when it scrolls into view", () => {
    mockReducedMotion(false);
    let trigger: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(callback: IntersectionObserverCallback) {
        trigger = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 2400,
      height: 50,
      bottom: 2450,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 2400,
      toJSON: () => ({}),
    });

    render(<Reveal>Below the fold</Reveal>);
    const element = screen.getByText("Below the fold");

    expect(element.getAttribute("data-reveal")).toBe("armed");

    act(() => {
      trigger(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(element.getAttribute("data-reveal")).toBe("visible");
    expect(disconnect).toHaveBeenCalled();
  });

  it("passes the stagger delay to the stylesheet", () => {
    mockReducedMotion(true);

    render(<Reveal delay={240}>Later</Reveal>);

    expect(
      screen.getByText("Later").style.getPropertyValue("--reveal-delay"),
    ).toBe("240ms");
  });
});

describe("ScrollTextReveal", () => {
  const TEXT = "one two three four";

  it("shows plain, fully visible text when reduced motion is requested", () => {
    mockReducedMotion(true);

    const { container } = render(<ScrollTextReveal text={TEXT} />);
    const paragraph = container.querySelector("p");

    expect(paragraph?.textContent).toBe(TEXT);
    expect(paragraph?.getAttribute("data-reveal")).toBeNull();
  });

  it("keeps the sentence readable as normal text", () => {
    mockReducedMotion(false);

    const { container } = render(<ScrollTextReveal text={TEXT} />);

    expect(container.querySelector("p")?.textContent).toBe(TEXT);
  });

  it("reveals no words while the text is still below the viewport", () => {
    mockReducedMotion(false);
    const { container } = render(<ScrollTextReveal text={TEXT} />);
    const paragraph = container.querySelector("p") as HTMLElement;

    mockRect(paragraph, { top: 3000, height: 200 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(paragraph.getAttribute("data-reveal")).toBe("ready");
    expect(container.querySelectorAll("[data-on='true']").length).toBe(0);
  });

  it("reveals every word once the text has scrolled through", () => {
    mockReducedMotion(false);
    const { container } = render(<ScrollTextReveal text={TEXT} />);
    const paragraph = container.querySelector("p") as HTMLElement;

    mockRect(paragraph, { top: -400, height: 200 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelectorAll("[data-on='true']").length).toBe(4);
  });

  it("restores plain text and stops listening when unmounted", () => {
    mockReducedMotion(false);
    const remove = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(<ScrollTextReveal text={TEXT} />);
    const paragraph = container.querySelector("p") as HTMLElement;

    unmount();

    expect(paragraph.getAttribute("data-reveal")).toBeNull();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});

describe("HomeAnchors", () => {
  function setup(reduced: boolean) {
    mockReducedMotion(reduced);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <div data-home-root>
        <HomeAnchors />
        <a href="#target">Go</a>
        <a href="#missing">Nowhere</a>
        <a href="/auth/login">Log in</a>
        <section id="target" tabIndex={-1}>
          Target
        </section>
      </div>,
    );

    return scrollIntoView;
  }

  it("smooth-scrolls to the section and moves focus to it", () => {
    const scrollIntoView = setup(false);

    fireEvent.click(screen.getByText("Go"));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement?.id).toBe("target");
  });

  it("jumps instantly when reduced motion is requested", () => {
    const scrollIntoView = setup(true);

    fireEvent.click(screen.getByText("Go"));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("leaves other links and unknown targets alone", () => {
    const scrollIntoView = setup(false);

    const loginClick = fireEvent.click(screen.getByText("Log in"));
    const missingClick = fireEvent.click(screen.getByText("Nowhere"));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(loginClick).toBe(true);
    expect(missingClick).toBe(true);
  });

  it("ignores modified clicks so new-tab shortcuts keep working", () => {
    const scrollIntoView = setup(false);

    fireEvent.click(screen.getByText("Go"), { ctrlKey: true });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
