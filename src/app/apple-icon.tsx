import { ImageResponse } from "next/og"

import { getAppIconDataUrl } from "./icon-image"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default async function AppleIcon() {
  const src = await getAppIconDataUrl()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#C13E43",
        }}
      >
        <img
          src={src}
          alt="學習追蹤器"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    ),
    size
  )
}
