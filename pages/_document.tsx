import Document, { Html, Head, Main, NextScript } from "next/document";

class HavnAIDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="description" content="HavnAI — decentralized AI image and video generation powered by a GPU grid. Create, share, and trade AI art." />

          {/* Open Graph */}
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="HavnAI Network" />
          <meta property="og:title" content="HavnAI — Decentralized AI Generation" />
          <meta property="og:description" content="Create AI images and videos on a decentralized GPU grid. Earn rewards, trade creations, and join the network." />
          <meta property="og:image" content="https://joinhavn.io/HavnAI-logo.png" />
          <meta property="og:url" content="https://joinhavn.io" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="HavnAI — Decentralized AI Generation" />
          <meta name="twitter:description" content="Create AI images and videos on a decentralized GPU grid." />
          <meta name="twitter:image" content="https://joinhavn.io/HavnAI-logo.png" />

          <title>HavnAI Network</title>
          <link rel="icon" type="image/png" href="/HavnAI-logo.png" />
          <link rel="apple-touch-icon" href="/HavnAI-logo.png" />
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
