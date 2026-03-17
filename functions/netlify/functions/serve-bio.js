[build]
  functions = "netlify/functions"
  publish = "public"

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/u/*"
  [headers.values]
    Cache-Control = "public, max-age=3600"

[[redirects]]
  from = "/u/*"
  to = "/.netlify/functions/serve-bio"
  status = 200

[[redirects]]
  from = "/anfrage"
  to = "/anfrage/index.html"
  status = 200
