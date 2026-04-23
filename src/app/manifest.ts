import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "學習追蹤器",
    short_name: "學習追蹤器",
    description: "追蹤你的學習時間、學習成果與複習任務。",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F3EA",
    theme_color: "#4B6B5E",
    orientation: "portrait",
    lang: "zh-Hant",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  }
}
