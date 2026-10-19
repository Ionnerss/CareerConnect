"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import styles from "./home.module.css";

export default function HomeNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.preventDefault();
          closeMenu();
          menuButtonRef.current?.focus();
        }
      }}
    >
      <div className={styles.navigation}>
        <Link href="/" className={styles.brand} aria-label="CareerConnect home">
          CareerConnect<span aria-hidden="true">.</span>
        </Link>

        <nav className={styles.desktopLinks} aria-label="Main navigation">
          <a href="#job-seekers">For job seekers</a>
          <a href="#recruiters">For recruiters</a>
          <Link href="/auth/login" className={styles.login}>
            Log in
          </Link>
        </nav>

        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="home-mobile-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </button>

        <nav
          id="home-mobile-navigation"
          className={styles.mobileLinks}
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          <a href="#job-seekers" onClick={closeMenu}>
            For job seekers
          </a>
          <a href="#recruiters" onClick={closeMenu}>
            For recruiters
          </a>
          <Link href="/auth/login" onClick={closeMenu}>
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}