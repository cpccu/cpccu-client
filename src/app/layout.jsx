import "@/app/globals.css";
import ProviderWrapper from "./redux/ProviderWrapper";

export const metadata = {
  metadataBase: new URL("https://www.cpccu.club"),
  title: "CPCCU Portal",
  description: "Competitive Programming Camp City University",
  icons: { icon: "/cpccu.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inria+Sans:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ProviderWrapper>{children}</ProviderWrapper>
      </body>
    </html>
  );
}
