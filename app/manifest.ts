import type { MetadataRoute } from "next";

// Installable-app manifest. start_url is the mobile shell: launching from the
// home screen lands on /m, and middleware sends signed-out users to /login —
// so an installed app opens on exactly one of those two screens.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paperboy OS",
    short_name: "Paperboy",
    description: "The Paperboy operating system — the pipeline, the network, and the morning paper.",
    id: "/m",
    start_url: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eceae0",
    theme_color: "#f7f5f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
