"use client"

import Link, { type LinkProps } from "next/link"
import { useRouter } from "next/navigation"
import { type AnchorHTMLAttributes, forwardRef, type MouseEvent, type ReactNode } from "react"

type ViewTransitionLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  LinkProps & {
    children?: ReactNode
  }

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

function hasViewTransition(): boolean {
  return typeof document !== "undefined" && typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function"
}

export const VTLink = forwardRef<HTMLAnchorElement, ViewTransitionLinkProps>(function VTLink(
  { href, onClick, children, ...rest },
  ref,
) {
  const router = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    if (!hasViewTransition() || prefersReducedMotion()) return

    const target = typeof href === "string" ? href : href.pathname ?? ""
    if (!target || target.startsWith("http")) return

    event.preventDefault()
    const start = (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition
    start(() => {
      router.push(target)
    })
  }

  return (
    <Link ref={ref} href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
})
