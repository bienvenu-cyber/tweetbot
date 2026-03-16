# Sweet Instagram Bot 🤖

Bot Instagram automatisé avec dashboard React pour gérer les DMs, commentaires et posts.

## 🚀 Architecture

- **Frontend** : React 19 + Vite + TailwindCSS (Vercel)
- **Backend** : Python FastAPI + Express Proxy (Render)
- **Database** : PostgreSQL (Vercel Postgres ou Render)

## 📦 Structure du projet

```
├── artifacts/
│   ├── instagram-bot-api/    # Bot Python FastAPI
│   ├── api-server/            # Express Proxy
│   └── dashboard/             # Dashboard React
├── lib/
│   ├── api-spec/              # OpenAPI spec
│   ├── api-zod/               # Schémas Zod
│   ├── api-client-react/      # Client React
│   └── db/                    # Drizzle ORM
└── scripts/                   # Scripts utilitaires
```

## ✨ Fonctionnalités

- ✅ Login Instagram (username/password ou cookies)
- ✅ Envoi de DM (simple + bulk avec rate limiting)
- ✅ Commentaires automatiques
- ✅ Publication de posts
- ✅ Queue système pour actions différées
- ✅ Logs d'activité
- ✅ Configuration proxy SOCKS5 (anti géo-blocage)
- ✅ Dashboard moderne avec stats en temps réel

## 🛠️ Installation locale

```bash
# Installer les dépendances
pnpm install

# Configurer la base de données
export DATABASE_URL="postgresql://user:pass@localhost:5432/instagram_bot"

# Lancer le bot Python
cd artifacts/instagram-bot-api
pip install -r requirements.txt
python main.py

# Lancer le proxy Express (nouveau terminal)
cd artifacts/api-server
pnpm dev

# Lancer le dashboard (nouveau terminal)
cd artifacts/dashboard
pnpm dev
```

## 🚀 Déploiement

Voir [DEPLOYMENT_VERCEL_RENDER.md](./DEPLOYMENT_VERCEL_RENDER.md) pour le guide complet.

### Déploiement rapide sur Render + Vercel

1. **Render** : Connecte ce repo et utilise `render.yaml` (déploiement auto)
2. **Vercel** : Importe le projet, configure `VITE_API_BASE_URL`

## ⚠️ Important

- Configure un proxy SOCKS5 pour éviter le géo-blocage Instagram
- Respecte les limites de rate (50 DM/jour, 30 comments/jour)
- Utilise le login par cookies si tu as des problèmes de géo-blocage

## 📝 Variables d'environnement

### Python Bot API
```
DATABASE_URL=postgresql://...
BOT_PORT=8000
```

### Express Proxy
```
PORT=8080
BOT_API_URL=https://instagram-bot-api.onrender.com
```

### Dashboard React
```
VITE_API_BASE_URL=https://instagram-bot-proxy.onrender.com/api
```

## 🔒 Sécurité

- Ne commit jamais tes credentials Instagram
- Utilise des variables d'environnement pour les secrets
- Configure un proxy pour masquer l'IP du serveur

## 📄 Licence

MIT

## 🤝 Contribution

Les contributions sont les bienvenues ! Ouvre une issue ou une PR.

---

Développé avec ❤️ pour automatiser Instagram
