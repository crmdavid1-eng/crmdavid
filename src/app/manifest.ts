import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM",
    short_name: "CRM",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0ec",
    theme_color: "#edf0ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
