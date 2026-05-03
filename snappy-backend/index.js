/**
 * Snappy Backend — Node.js + Azure Cosmos DB NoSQL
 * ─────────────────────────────────────────────────
 * Endpoints:
 *   GET    /posts                        — list all posts
 *   GET    /posts/:id                    — get single post
 *   POST   /posts                        — create post
 *   PUT    /posts/:id                    — update post (edit title/caption/privacy)
 *   DELETE /posts/:id                    — delete post (also deletes from Cosmos)
 *   POST   /posts/:id/like               — toggle like
 *   POST   /posts/:id/comments           — add comment
 *   DELETE /posts/:id/comments/:cid      — delete comment
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 }  = require('uuid');

// ─── Validate env ─────────────────────────────────────────────────────────────
const { COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE, COSMOS_CONTAINER, PORT = 3000, CORS_ORIGIN = '*' } = process.env;

if (!COSMOS_ENDPOINT || COSMOS_ENDPOINT.includes('YOUR_ACCOUNT')) {
  console.error('\n❌  Missing Cosmos credentials.\n   Open .env and fill in COSMOS_ENDPOINT and COSMOS_KEY.\n   See README.md for where to find them in the Azure Portal.\n');
  process.exit(1);
}

// ─── Cosmos client ────────────────────────────────────────────────────────────
const client    = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database  = client.database(COSMOS_DATABASE);
const container = database.container(COSMOS_CONTAINER);

// Auto-create database + container if they don't exist yet
async function ensureCosmosResources() {
  try {
    await client.databases.createIfNotExists({ id: COSMOS_DATABASE });
    await database.containers.createIfNotExists({
      id: COSMOS_CONTAINER,
      partitionKey: { paths: ['/id'] },
    });
    console.log(`✅  Cosmos DB ready — database: "${COSMOS_DATABASE}", container: "${COSMOS_CONTAINER}"`);
  } catch (err) {
    console.error('❌  Could not connect to Cosmos DB:', err.message);
    console.error('    Check your COSMOS_ENDPOINT and COSMOS_KEY in .env');
    process.exit(1);
  }
}

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Disable caching for all API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ok(res, data)  { res.json({ success: true,  data }); }
function err(res, msg, status = 400) { res.status(status).json({ success: false, error: msg }); }

async function getPost(id) {
  try {
    const { resource } = await container.item(id, id).read();
    return resource || null;
  } catch {
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /posts — return all posts, newest first
app.get('/posts', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { resources } = await container.items
      .query('SELECT * FROM c ORDER BY c.createdAt DESC')
      .fetchAll();
    ok(res, resources);
  } catch (e) {
    err(res, 'Failed to fetch posts: ' + e.message, 500);
  }
});

// GET /posts/:id — single post
app.get('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);
  ok(res, post);
});

// POST /posts — create a new post
app.post('/posts', async (req, res) => {
  const { title, caption, privacy, fileUrl, fileType, fileName, author } = req.body;
  if (!title || !fileUrl || !author) return err(res, 'title, fileUrl, and author are required');

  const post = {
    id:        uuidv4(),
    title:     title.trim(),
    caption:   (caption || '').trim(),
    privacy:   privacy === 'public' ? 'public' : 'private',
    fileUrl,
    fileType:  fileType || 'image',
    fileName:  fileName || null,
    author,
    likes:     [],
    comments:  [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const { resource } = await container.items.create(post);
    ok(res, resource);
  } catch (e) {
    err(res, 'Failed to create post: ' + e.message, 500);
  }
});

// PUT /posts/:id — update title / caption / privacy
app.put('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);

  const { title, caption, privacy } = req.body;
  if (title !== undefined) post.title   = String(title).trim();
  if (caption !== undefined) post.caption = String(caption).trim();
  if (privacy !== undefined) post.privacy = privacy === 'public' ? 'public' : 'private';
  post.updatedAt = new Date().toISOString();

  try {
    const { resource } = await container.item(post.id, post.id).replace(post);
    ok(res, resource);
  } catch (e) {
    err(res, 'Failed to update post: ' + e.message, 500);
  }
});

// DELETE /posts/:id — permanently delete post from Cosmos
app.delete('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);

  try {
    await container.item(req.params.id, req.params.id).delete();
    ok(res, { id: req.params.id, deleted: true });
  } catch (e) {
    err(res, 'Failed to delete post: ' + e.message, 500);
  }
});

// POST /posts/:id/like — toggle like for a user
app.post('/posts/:id/like', async (req, res) => {
  const { username } = req.body;
  if (!username) return err(res, 'username is required');

  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);

  post.likes = post.likes || [];
  const idx = post.likes.indexOf(username);
  if (idx >= 0) {
    post.likes.splice(idx, 1);      // unlike
  } else {
    post.likes.push(username);      // like
  }
  post.updatedAt = new Date().toISOString();

  try {
    const { resource } = await container.item(post.id, post.id).replace(post);
    ok(res, resource);
  } catch (e) {
    err(res, 'Failed to update like: ' + e.message, 500);
  }
});

// POST /posts/:id/comments — add a comment
app.post('/posts/:id/comments', async (req, res) => {
  const { username, text } = req.body;
  if (!username || !text) return err(res, 'username and text are required');

  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);

  post.comments = post.comments || [];
  post.comments.push({
    id:        uuidv4(),
    author:    username,
    text:      String(text).trim(),
    timestamp: Date.now(),
  });
  post.updatedAt = new Date().toISOString();

  try {
    const { resource } = await container.item(post.id, post.id).replace(post);
    ok(res, resource);
  } catch (e) {
    err(res, 'Failed to add comment: ' + e.message, 500);
  }
});

// DELETE /posts/:id/comments/:cid — remove a comment
app.delete('/posts/:id/comments/:cid', async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return err(res, 'Post not found', 404);

  const before = (post.comments || []).length;
  post.comments = (post.comments || []).filter(c => c.id !== req.params.cid);

  if (post.comments.length === before) return err(res, 'Comment not found', 404);
  post.updatedAt = new Date().toISOString();

  try {
    const { resource } = await container.item(post.id, post.id).replace(post);
    ok(res, resource);
  } catch (e) {
    err(res, 'Failed to delete comment: ' + e.message, 500);
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Start ────────────────────────────────────────────────────────────────────
ensureCosmosResources().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});