/* ============================================================
   Quality Cockpit — LEONI · Service Worker
   Rôle : ouvrir l'application de façon fiable, même hors-ligne.
   - Met en cache la page (index.html) + les ressources CDN
     (Chart.js, SheetJS, SDK Firebase, polices Google).
   - Ne touche PAS aux connexions Firebase temps réel (auth + base).
   Déposer ce fichier À CÔTÉ de index.html (même dossier) sur GitHub Pages.
   ============================================================ */
const CACHE = 'qcockpit-v21';
const CDN = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.gstatic.com', 'fonts.googleapis.com'];

// Installation : on précharge la coquille de l'app
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html']).catch(() => {})));
});

// Activation : on nettoie les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

// Requêtes réseau
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  const sameOrigin = url.origin === self.location.origin;

  // 1) La PAGE (navigation / HTML) → réseau d'abord, cache si hors-ligne
  const wantsHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (wantsHTML && sameOrigin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 2) Ressources CDN (bibliothèques, SDK, polices) → cache + mise à jour en arrière-plan
  if (CDN.includes(url.host)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 3) Tout le reste (Firebase base temps réel, authentification, analytics…)
  //    → on NE touche à rien, requête réseau normale.
});
