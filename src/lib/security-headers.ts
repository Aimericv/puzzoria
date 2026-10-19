// Next extracts the script nonce from the forwarded CSP header during dynamic rendering.
export function contentSecurityPolicy(nonce: string, development: boolean, publicHttps: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Existing game components use React style attributes for grids, bars and animations.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:", "font-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "frame-src 'none'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    ...(publicHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
export const securityHeaders = [
  {key:"X-Frame-Options",value:"DENY"},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
];
