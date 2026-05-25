#!/bin/bash
# CEREBRAL Deployment Script
# Supports: Cloudflare Pages, Netlify, or static file hosting

set -e

echo "🧠 CEREBRAL Deployment"
echo "======================"

# Build the app
echo "📦 Building Expo Web..."
npx expo export --platform web --clear

# Check for available deployment targets
if command -v wrangler &> /dev/null && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "☁️  Deploying to Cloudflare Pages..."
    wrangler pages deploy dist --project-name=cerebral
    echo "✅ Deployed to Cloudflare Pages"
elif command -v netlify &> /dev/null && [ -n "$NETLIFY_AUTH_TOKEN" ]; then
    echo "🔷 Deploying to Netlify..."
    netlify deploy --prod --dir=dist
    echo "✅ Deployed to Netlify"
else
    echo ""
    echo "📁 Build complete! Static files are in ./dist/"
    echo ""
    echo "To deploy, choose one of:"
    echo ""
    echo "  Cloudflare Pages:"
    echo "    export CLOUDFLARE_API_TOKEN=your_token"
    echo "    wrangler pages deploy dist --project-name=cerebral"
    echo ""
    echo "  Netlify:"
    echo "    export NETLIFY_AUTH_TOKEN=your_token"
    echo "    netlify deploy --prod --dir=dist"
    echo ""
    echo "  Manual: Upload ./dist/ contents to any static hosting"
    echo ""
fi
