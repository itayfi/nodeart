export function safeFilename(name: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "nodeart"
  )
}
