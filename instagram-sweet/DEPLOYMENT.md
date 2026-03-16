# Guide de Déploiement — Instagram Bot Dashboard

Ce projet est composé de 3 services :
- **Python FastAPI** (`artifacts/instagram-bot-api/`) — le bot Instagram (port 8000)
- **Express Proxy** (`artifacts/api-server/`) — pont HTTP vers le bot (port 8080)
- **React Dashboard** (`artifacts/dashboard/`) — interface utilisateur (port 3000)

---

## 1. Déploiement sur Railway

Railway est la plateforme la plus simple pour ce projet (tout-en-un, PostgreSQL inclus).

### Étapes :

1. **Crée un compte** sur [railway.app](https://railway.app)

2. **Nouveau projet** → "Deploy from GitHub repo" → connecte ton dépôt

3. **Crée 3 services** (un par dossier) :
   - Service 1 : `artifacts/instagram-bot-api` (Python)
   - Service 2 : `artifacts/api-server` (Node.js)  
   - Service 3 : `artifacts/dashboard` (Node.js — build statique ou SSR)

4. **Base de données** : Add Plugin → PostgreSQL → copie `DATABASE_URL`

5. **Variables d'environnement** à configurer dans chaque service :

   **instagram-bot-api** :
   ```
   DATABASE_URL=postgresql://...
   BOT_PORT=8000
   ```

   **api-server** :
   ```
   BOT_API_URL=http://instagram-bot-api.railway.internal:8000
   PORT=8080
   ```

   **dashboard** :
   ```
   VITE_API_BASE_URL=/api
   ```

6. **Fichiers de config Railway** :

   `artifacts/instagram-bot-api/railway.json` :
   ```json
   {
     "build": { "builder": "nixpacks" },
     "deploy": { "startCommand": "python main.py" }
   }
   ```

   `artifacts/instagram-bot-api/Procfile` :
   ```
   web: python main.py
   ```

   `artifacts/instagram-bot-api/requirements.txt` doit exister (voir section Requirements)

---

## 2. Déploiement sur Render.com

Render offre un tier gratuit mais avec sleep après inactivité.

### Services à créer :

**Service 1 — Python API (Web Service)**
- Build Command : `pip install -r requirements.txt`
- Start Command : `python main.py`
- Dossier racine : `artifacts/instagram-bot-api`
- Variables : `DATABASE_URL`, `BOT_PORT=8000`

**Service 2 — Express Proxy (Web Service)**
- Build Command : `pnpm install && pnpm build`
- Start Command : `node dist/app.js`
- Dossier racine : `artifacts/api-server`
- Variables : `BOT_API_URL=https://ton-service-python.onrender.com`, `PORT=8080`

**Service 3 — Dashboard (Static Site)**
- Build Command : `pnpm install && pnpm build`
- Publish directory : `dist`
- Dossier racine : `artifacts/dashboard`

**Base de données** : Create → PostgreSQL → copie l'Internal URL

---

## 3. Déploiement sur un VPS (Ubuntu/Debian)

Idéal si tu veux un serveur **dans ta région** (important pour éviter le blocage Instagram).

```bash
# 1. Installe les dépendances système
sudo apt update && sudo apt install -y python3.11 python3-pip nodejs npm postgresql nginx

# 2. Clone le projet
git clone https://github.com/TON_REPO/instagram-bot.git
cd instagram-bot

# 3. Install Python deps
cd artifacts/instagram-bot-api
pip3 install -r requirements.txt

# 4. Install Node deps
cd ../../
npm install -g pnpm
pnpm install

# 5. Configure la DB
sudo -u postgres psql -c "CREATE DATABASE instagram_bot;"
sudo -u postgres psql -c "CREATE USER botuser WITH PASSWORD 'motdepasse';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE instagram_bot TO botuser;"

# 6. Variables d'environnement
export DATABASE_URL="postgresql://botuser:motdepasse@localhost/instagram_bot"
export BOT_PORT=8000

# 7. Lance les services avec PM2
npm install -g pm2

# Python API
pm2 start "python3 main.py" --name "instagram-bot-api" --cwd artifacts/instagram-bot-api

# Express proxy
pnpm --filter @workspace/api-server build
pm2 start "node dist/app.js" --name "api-server" --cwd artifacts/api-server

# Dashboard (build statique servi par nginx)
pnpm --filter @workspace/dashboard build

# 8. Configure Nginx
sudo nano /etc/nginx/sites-available/instagram-bot
```

Configuration Nginx :
```nginx
server {
    listen 80;
    server_name TON_DOMAINE.com;

    # Dashboard (frontend)
    location / {
        root /chemin/vers/artifacts/dashboard/dist;
        try_files $uri /index.html;
    }

    # Express proxy
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_http_version 1.1;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/instagram-bot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
pm2 save && pm2 startup
```

---

## 4. Variables d'Environnement Requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `BOT_PORT` | Port du bot Python | `8000` |
| `BOT_API_URL` | URL du bot Python (pour Express) | `http://localhost:8000` |

---

## 5. Requirements Python

Fichier `artifacts/instagram-bot-api/requirements.txt` :
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
instagrapi==2.1.3
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
pydantic==2.10.3
requests==2.32.3
python-multipart==0.0.18
```

---

## 6. Conseil pour le Blocage Instagram (Géolocalisation)

**Problème** : Si ton serveur est aux USA et ton compte Instagram est normalement utilisé depuis l'Afrique de l'Ouest, Instagram va bloquer la connexion comme suspecte.

**Solution recommandée** : Héberge sur un VPS **au Bénin, au Sénégal, ou en France** (pays géographiquement plus proches de ton compte).

Fournisseurs VPS en Afrique :
- **Afrihost** (Afrique du Sud) — [afrihost.com](https://afrihost.com)
- **HostAfrica** — [hostafrica.com](https://hostafrica.com)
- **AWS/Scaleway Europe** (Paris) — geographiquement acceptable

Ou configure un **proxy SOCKS5 résidentiel** dans la section Paramètres du dashboard.

---

## 7. Proxy SOCKS5 — Contournement du Blocage

Dans le dashboard → **Paramètres → Proxy de Connexion**, entre :
```
socks5://user:password@proxy-host:1080
```

Services gratuits/bon marché :
- **Webshare.io** — 10 proxies gratuits, serveurs multiples
- **Proxyscrape.com** — proxies rotatifs
- **SSH tunnel** vers un VPS dans ta région :
  ```bash
  ssh -D 1080 user@ton-vps-benin.com -N
  # puis configure proxy: socks5://localhost:1080
  ```

