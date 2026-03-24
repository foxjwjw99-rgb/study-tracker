import { ImageResponse } from "next/og"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #6D54E8 0%, #4CC6B7 100%)",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -8,
        }}
      >
        讀
      </div>
    ),
    size
  )
}
