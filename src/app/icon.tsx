import { ImageResponse } from "next/og"

import { getAppIconDataUrl } from "./icon-image"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default async function Icon() {
  const src = await getAppIconDataUrl()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#4B6B5E",
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
