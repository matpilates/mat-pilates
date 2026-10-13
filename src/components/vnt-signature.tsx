import Image from "next/image";
import localFont from "next/font/local";
import styles from "./vnt-signature.module.css";

const hostGrotesk = localFont({
  src: "../../public/brand/vnt/HostGrotesk-VariableFont_wght.ttf",
  weight: "300 800",
  style: "normal",
  display: "swap",
  preload: false,
});

export function VntSignature() {
  return (
    <a
      aria-label="Sitio web de VNT Agencia (abre en una nueva pestaña)"
      className={`${hostGrotesk.className} ${styles["site-vnt-signature"]}`}
      data-vnt-signature="mat-pilates"
      href="https://vntagencia.com/r/mat-pilates"
      rel="noopener noreferrer"
      target="_blank"
    >
      <span lang="en">created by</span>
      <Image
        alt=""
        className={styles["site-vnt-signature__logo"]}
        height={589}
        src="/brand/vnt/logo-signature-white.svg"
        width={2150}
      />
    </a>
  );
}
