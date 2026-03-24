import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background: "linear-gradient(160deg, #6D54E8 0%, #4CC6B7 100%)",
          color: "white",
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        讀
      </div>
    ),
    size
  )
}
