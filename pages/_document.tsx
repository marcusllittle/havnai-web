import Document, { Html, Head, Main, NextScript } from "next/document";

class HavnAIDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>HavnAI Network — Stage 7 Alpha</title>
          <link rel="icon" type="image/png" href="/HavnAI-logo.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Exo+2:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body className="site-body">
          <div className="bg-aurora" />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default HavnAIDocument;
