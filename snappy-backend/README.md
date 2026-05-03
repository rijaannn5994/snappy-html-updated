# Snappy Backend

Node.js + Express + Azure Cosmos DB NoSQL

---

## Setup (one time)

### 1. Install Node.js
Download from https://nodejs.org — install the **LTS** version.

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Fill in your Cosmos DB credentials
Open `.env` and replace the placeholder values:

```
COSMOS_ENDPOINT=https://YOUR_ACCOUNT.documents.azure.com:443/
COSMOS_KEY=YOUR_PRIMARY_KEY_HERE
COSMOS_DATABASE=snappydb
COSMOS_CONTAINER=posts
```

**Where to find these in Azure Portal:**
1. Go to portal.azure.com
2. Open your Cosmos DB account
3. Click **Keys** in the left sidebar
4. Copy **URI** → paste as `COSMOS_ENDPOINT`
5. Copy **PRIMARY KEY** → paste as `COSMOS_KEY`

The database and container will be **created automatically** if they don't exist.

---

## Running the backend

```
node index.js
```

Or with auto-restart on file changes:
```
npm run dev
```

You should see:
```
✅  Cosmos DB ready — database: "snappydb", container: "posts"
🚀  Snappy backend running at http://localhost:3000
```

---

## Using with the frontend

Make sure `config.js` in the frontend has:
```js
backendUrl: "http://localhost:3000"
```

Then open `index.html` in your browser (or serve it with Live Server in VS Code).

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /posts | All posts |
| GET | /posts/:id | Single post |
| POST | /posts | Create post |
| PUT | /posts/:id | Edit title/caption/privacy |
| DELETE | /posts/:id | Delete post permanently |
| POST | /posts/:id/like | Toggle like |
| POST | /posts/:id/comments | Add comment |
| DELETE | /posts/:id/comments/:cid | Delete comment |
