import type { AppProps } from "next/app";
import "../style.css";

export default function HavnAIApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

