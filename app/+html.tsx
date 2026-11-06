import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only root HTML wrapper (SSR). This file has no effect on native.
 * It locks the document so there's no horizontal scroll and no margin.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Disable body scroll reset so our RN ScrollViews handle scrolling */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Kill horizontal scroll and default margins at the document level.
const responsiveBackground = `
html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  background-color: #f5f7fa;
}
* {
  box-sizing: border-box;
}
`;
