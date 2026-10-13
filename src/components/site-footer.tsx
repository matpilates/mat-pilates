import Image from "next/image";
import { footerNavigationItems, siteContact } from "@/lib/site-content";
import { VntSignature } from "./vnt-signature";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles["site-footer"]}>
      <a aria-label="MAT Pilates, inicio" className={styles["site-footer__brand"]} href="#inicio">
        <Image
          alt="MAT Pilates"
          fill
          sizes="173px"
          src="/brand/mat-wordmark-light-menu-desktop.svg"
        />
      </a>
      <nav aria-label="Enlaces del pie de página" className={styles["site-footer__nav"]}>
        <ul className={styles["site-footer__navigation"]}>
          {footerNavigationItems.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <a className={styles["site-footer__instagram"]} href={siteContact.instagram.url} rel="noreferrer" target="_blank">
        Instagram
      </a>
      <div className={styles["site-footer__legal"]}>
        <p className={styles["site-footer__location"]}>
          <a href={siteContact.location.mapsUrl} rel="noreferrer" target="_blank">
            {siteContact.location.label}
          </a>
        </p>
        <p className={styles["site-footer__copyright"]}>© 2026 MAT Pilates. Todos los derechos reservados.</p>
      </div>
      <div className={styles["site-footer__signature"]}>
        <VntSignature />
      </div>
    </footer>
  );
}
