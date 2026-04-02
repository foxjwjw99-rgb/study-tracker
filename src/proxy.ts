import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/study-log/:path*",
    "/practice/:path*",
    "/vocabulary/:path*",
    "/review/:path*",
    "/analytics/:path*",
    "/leaderboard/:path*",
    "/rewards/:path*",
    "/import/:path*",
    "/settings/:path*",
  ],
}
