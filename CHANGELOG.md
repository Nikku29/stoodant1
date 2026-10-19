# Changelog

## Unreleased (branch backend/firebase)
- Teachers ring: 11 real teacher profiles with photos (founder first), keeps turning every 2.5s and only holds briefly after a swipe or tap.
- Business number is now +91 83060 18141 (call and WhatsApp).
- Firebase backend: deny-by-default Firestore and Storage rules, `submitLead` and `onLeadCreated` functions in asia-south1.
- Demo form now sends real leads: parent's name, consent checkbox with a versioned notice, honeypot, retries.
- Static prerender for Firebase Hosting, a real 404 page, absolute canonical URL.
- CI: required checks, emulator tests, Playwright, Lighthouse, bundle budget, audits, preview channels, staged deploys.
- Parent progress (comparison row and section) hidden until logins exist.
