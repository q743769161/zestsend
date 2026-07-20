export function getClientIP(req) {
  const cloudflareIP = req.headers?.["cf-connecting-ip"];
  if (cloudflareIP) {
    return cloudflareIP;
  }

  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "127.0.0.1";
}
