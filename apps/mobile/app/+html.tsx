import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Raw CSS so the page background matches the dark app and never flashes white. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <title>xTanBot — your AI assistant who picks up the phone</title>
        {/* xTan's face on an amber disc (assets/images → public/) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#09090b" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// App is dark-only: paint the page behind it the same color so overscroll/bounce
// and the mobile toolbar resize never reveal a white strip.
const responsiveBackground = `
html, body {
  background-color: #09090b;
  overscroll-behavior: none;
}`;
