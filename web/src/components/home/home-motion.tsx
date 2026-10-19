"use client";

import {
  Fragment,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./home-motion.module.css";
import { countRevealedWords, getScrollProgress } from "./scroll-progress";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Smooth-scrolls in-page links (#job-seekers, #how-it-works, ...) on the
 * homepage only. It deliberately does not touch the global `scroll-behavior`
 * of the page, so navigating to and from other routes is unaffected.
 */
export function HomeAnchors() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "[data-home-root] a[href^='#']",
      );
      const hash = link?.getAttribute("href");
      if (!link || !hash || hash.length < 2) return;

      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();

      const reduced = window.matchMedia(REDUCED_MOTION).matches;
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
      // Keep keyboard and screen-reader users in step with the scroll.
      target.focus({ preventScroll: true });
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

type RevealProps = {
  children: ReactNode;
  /** Extra delay in milliseconds, used to stagger siblings. */
  delay?: number;
  className?: string;
};

/**
 * Fades and lifts its children in once they scroll into view.
 *
 * The content is fully visible in the server-rendered HTML. Only after the
 * page has loaded (and only when the visitor has not asked for reduced
 * motion) is a below-the-fold block hidden and then revealed, so nothing
 * depends on JavaScript or on the animation succeeding.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (
      window.matchMedia(REDUCED_MOTION).matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    // Anything already on screen stays put instead of flashing.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) {
      element.dataset.reveal = "visible";
      return;
    }

    element.dataset.reveal = "armed";

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.dataset.reveal = "visible";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.dataset.reveal = "idle";
    };
  }, []);

  return (
    <div
      ref={ref}
      data-reveal="idle"
      className={`${styles.reveal}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

type ScrollTextRevealProps = {
  text: string;
  className?: string;
};

/**
 * A statement whose words darken one after another as it scrolls through the
 * viewport. Without JavaScript, or with reduced motion, the whole sentence
 * is simply shown in full contrast.
 */
export function ScrollTextReveal({ text, className }: ScrollTextRevealProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia(REDUCED_MOTION).matches) return;

    const wordElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-word]"),
    );
    root.dataset.reveal = "ready";

    let frame = 0;

    function update() {
      frame = 0;
      if (!root) return;
      const progress = getScrollProgress(
        root.getBoundingClientRect(),
        window.innerHeight,
      );
      const revealed = countRevealedWords(progress, wordElements.length);

      wordElements.forEach((element, index) => {
        const next = index < revealed ? "true" : "false";
        if (element.dataset.on !== next) element.dataset.on = next;
      });
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      delete root.dataset.reveal;
      wordElements.forEach((element) => delete element.dataset.on);
    };
  }, [text]);

  return (
    <p
      ref={ref}
      className={`${styles.scrollText}${className ? ` ${className}` : ""}`}
    >
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span data-word className={styles.word}>
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </p>
  );
}
