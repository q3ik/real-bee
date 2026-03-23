# TODO - PWA App Icons
- Current images are just placeholders!
- The two "maskable" images are just direct copies of the regular of the same size.

This directory contains app icons for Progressive Web App installation.

## Required Icons (Standard)

All icons should be PNG format with transparency, optimized for web:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## Required Icons (Maskable - Android Adaptive)
Maskable icons have a safe zone (40% padding from edges) to ensure the icon works with Android's adaptive icon system:
- icon-maskable-192x192.png
- icon-maskable-512x512.png

## Design Guidelines
- **Safe Zone**: Keep critical elements within center 80% for standard icons
- **Maskable Safe Zone**: Keep critical elements within center 80% circle (40% padding)
- **Scalability**: Icon should be recognizable at 16x16px

## Validation

After adding icons, validate using:
- Chrome DevTools → Application → Manifest
- Lighthouse PWA audit
- Test on iOS Safari (Add to Home Screen)
- Test on Android Chrome (Install prompt)

## Resources

- [Maskable.app](https://maskable.app/) - Test maskable icons
- [Web App Manifest Icons](https://web.dev/add-manifest/#icons)
