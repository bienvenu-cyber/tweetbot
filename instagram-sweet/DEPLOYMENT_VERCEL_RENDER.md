# Guide de Déploiement — Vercel + Render

## Architecture

- **Vercel** : Dashboard React + PostgreSQL (Vercel Postgres)
- **Render** : Python Bot API + Express Proxy

---

## Étape 1 : Déployer sur Render (Backend)

### Option A : Déploiement automatique avec render.yaml

1. **Connecte ton repo GitHub à Render**
   - Va sur [render.com](https://render.com)
   - New → Blueprint
   - Connecte ton dépôt GitHub
   - Render détectera automatiquement `render.yaml`

2. **Les services seront créés automatiquement** :
   - PostgreSQL : `instagram-bot-db`
   - Python API : `instagram-bot-api` (port 8000)
   - Express Proxy : `instagram-bot-proxy` (port 8080)

3. **Note les URLs générées** :
   - Python API : `https://instagram-bot-api.onrender.com`
   - Express Proxy : `https://instagram-bot-proxy.onrender.com`

### Option B : Déploiement manuel

#### 1. Créer la base de données PostgreSQL

- Dashboard Render → New → PostgreSQL
- Name : `instagram-bot-db`
- Plan : Free
- Copie l'**Internal Database URL** (commence par `postgresql://`)

#### 2. Déployer Python Bot API

- New → Web Service
- Connect ton repo GitHub
- **Configuration** :
  - Name : `instagram-bot-api`
  - Region : Oregon (ou proche de toi)
  - Root Directory : `artifacts/instagram-bot-api`
  - Runtime : Python 3
  - Build Command : `pip install -r requirements.txt`
  - Start Command : `python main.py`
  
- **Environment Variables** :
  ```
  DATABASE_URL = [colle l'Internal Database URL]
  BOT_PORT = 8000
  ```

- Deploy → Attends que ça build
- Note l'URL : `https://instagram-bot-api.onrender.com`

#### 3. Déployer Express Proxy

- New → Web Service
- Connect ton repo GitHub
- **Configuration** :
  - Name : `instagram-bot-proxy`
  - Region : Oregon
  - Root Directory : `artifacts/api-server`
  - Runtime : Node
  - Build Command : `corepack enable && pnpm install && pnpm build`
  - Start Command : `node dist/index.js`
  
- **Environment Variables** :
  ```
  PORT = 8080
  BOT_API_URL = https://instagram-bot-api.onrender.com
  ```

- Deploy
- Note l'URL : `https://instagram-bot-proxy.onrender.com`

---

## Étape 2 : Déployer sur Vercel (Frontend)

### Option A : Avec Vercel Postgres (Recommandé)

1. **Crée une base de données Vercel Postgres**
   - Dashboard Vercel → Storage → Create Database
   - Postgres → Continue
   - Name : `instagram-bot-db`
   - Region : Proche de ton Render region
   - Create

2. **Copie les variables d'environnement Postgres**
   - Vercel te donne automatiquement :
     - `POSTGRES_URL`
     - `POSTGRES_PRISMA_URL`
     - `POSTGRES_URL_NON_POOLING`

3. **Ajoute ces variables à tes services Render**
   - Va sur Render → `instagram-bot-api` → Environment
   - Remplace `DATABASE_URL` par la valeur de `POSTGRES_URL` de Vercel

4. **Déploie le Dashboard sur Vercel**
   - Dashboard Vercel → New Project
   - Import ton repo GitHub
   - **Framework Preset** : Vite
   - **Root Directory** : `artifacts/dashboard`
   - **Build Command** : `pnpm install && pnpm build`
   - **Output Directory** : `dist`
   
5. **Configure les variables d'environnement Vercel** :
   ```
   VITE_API_BASE_URL = https://instagram-bot-proxy.onrender.com/api
   ```

6. **Modifie vercel.json** :
   - Ouvre `vercel.json` à la racine
   - Remplace `YOUR_EXPRESS_PROXY.onrender.com` par ton URL réelle
   - Commit et push

### Option B : Avec Render Postgres uniquement

1. **Déploie le Dashboard sur Vercel**
   - Dashboard Vercel → New Project
   - Import ton repo GitHub
   - **Framework Preset** : Vite
   - **Root Directory** : `artifacts/dashboard`
   - **Build Command** : `pnpm install && pnpm build`
   - **Output Directory** : `dist`

2. **Configure les variables d'environnement** :
   ```
   VITE_API_BASE_URL = https://instagram-bot-proxy.onrender.com/api
   ```

3. **Deploy**

---

## Étape 3 : Vérification

1. **Teste l'API Python** :
   ```bash
   curl https://instagram-bot-api.onrender.com/bot-api/health
   ```
   Devrait retourner : `{"status": "ok", "db": "connected", ...}`

2. **Teste le Proxy Express** :
   ```bash
   curl https://instagram-bot-proxy.onrender.com/api/healthz
   ```

3. **Ouvre le Dashboard** :
   - Va sur ton URL Vercel : `https://ton-projet.vercel.app`
   - Tu devrais voir la page de login

---

## Configuration finale

### Dans le Dashboard (Settings)

1. **Configure le proxy SOCKS5** (important pour éviter géo-blocage) :
   - Va dans Settings → Proxy de Connexion
   - Entre : `socks5://user:pass@proxy-host:1080`
   - Ou laisse vide si ton serveur Render est proche de ta région

2. **Ajuste les limites** :
   - DM daily limit : 50
   - Délais entre DM : 30-120 secondes
   - Comment daily limit : 30

---

## Problèmes courants

### ❌ "Service unavailable" sur Render (gratuit)
- Les services gratuits dorment après 15 min d'inactivité
- Première requête prend 30-60 secondes pour réveiller
- Solution : Upgrade vers plan payant ($7/mois) ou utilise un cron pour ping toutes les 10 min

### ❌ "Challenge required" au login Instagram
- Instagram bloque car serveur = USA, compte = Afrique
- Solutions :
  1. Configure un proxy SOCKS5 dans Settings
  2. Utilise "Login par cookies" au lieu de username/password
  3. Déploie sur un VPS en Afrique/France

### ❌ CORS errors
- Vérifie que `VITE_API_BASE_URL` pointe vers le bon proxy
- Vérifie que `vercel.json` a la bonne URL de rewrite

### ❌ Database connection failed
- Vérifie que `DATABASE_URL` est bien configuré sur les 2 services Render
- Format : `postgresql://user:password@host:5432/database`

---

## URLs finales

- **Dashboard** : `https://ton-projet.vercel.app`
- **API Proxy** : `https://instagram-bot-proxy.onrender.com`
- **Bot API** : `https://instagram-bot-api.onrender.com`
- **Database** : Vercel Postgres ou Render Postgres

---

## Coûts

- **Vercel** : Gratuit (Hobby plan)
- **Vercel Postgres** : Gratuit jusqu'à 256 MB
- **Render** : Gratuit (avec sleep) ou $7/mois par service (sans sleep)

**Total gratuit** : $0/mois (avec sleep après 15 min)
**Total sans sleep** : $14/mois (2 services Render × $7)

---

## Prochaines étapes

1. Configure un proxy SOCKS5 pour éviter le géo-blocage
2. Teste le login Instagram
3. Envoie ton premier DM automatique
4. Configure les limites pour éviter les bans

Bon déploiement ! 🚀
