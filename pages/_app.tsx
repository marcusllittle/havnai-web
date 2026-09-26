import type { AppProps } from "next/app";
import Head from "next/head";
import React from "react";
import { Analytics } from "@vercel/analytics/next";
import { WalletProvider } from "../components/WalletProvider";
import { AccountProvider } from "../components/AccountProvider";
import { MusicPlayerProvider } from "../components/MusicPlayer";
import "../style.css";
import "../styles/music.css";
import "../styles/create.css";
import "../styles/collection.css";
import "../styles/discover.css";
import "../styles/navigation.css";
import "../styles/studios.css";
import "../styles/home.css";
import "../styles/astra.css";
import "../styles/marketplace.css";
import "../styles/music-shelf.css";
import "../styles/account.css";
import "../styles/network.css";
import "../styles/operators.css";
import "../styles/product.css";
import "../styles/guides.css";
import "../styles/templates.css";
import "../styles/results.css";
import "../styles/policies.css";

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("HavnAI uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#05080d",
            color: "#f3fbff",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9db3c4", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: "0.75rem 1.6rem",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg, #00eaff, #57d3ff)",
              color: "#02050a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HavnAIApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AccountProvider><WalletProvider>
        <MusicPlayerProvider>
          <Component {...pageProps} />
          <Analytics />
        </MusicPlayerProvider>
      </WalletProvider></AccountProvider>
    </ErrorBoundary>
  );
}
