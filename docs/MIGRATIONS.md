# Migrations and Maintenance Notes

## Remove legacy username unique index

Symptom:
- Registration fails with duplicate key error: `E11000 dup key: { username: null }`.
- Caused by a legacy unique index on `username` while the schema no longer includes `username`.

Fix (one-time):
- Drop the legacy index from the `users` collection.

Using Mongo shell or driver (adjust DB/collection names as needed):

```js
// In a Mongo shell or a migration script
use <your_database_name>;
db.users.dropIndex('username_1');
```

Alternative: programmatically in a Node script:

```js
const { MongoClient } = require('mongodb');
(async () => {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();
  const result = await db.collection('users').dropIndex('username_1');
  console.log('Dropped index:', result);
  await client.close();
})();
```

Verification:
- Ensure indexes on `users` include `email_1` (unique), `location_2dsphere`, and the text index; `username_1` should be gone.

## Email uniqueness and case-insensitive checks

- API normalizes emails to lowercase and performs case-insensitive lookups.
- If you prefer DB-level case-insensitive uniqueness, recreate the email index with a case-insensitive collation:

```js
// Drop existing email index
use <your_database_name>;
db.users.dropIndex('email_1');
// Create case-insensitive unique index
db.users.createIndex({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
```

Note: When using a collation on an index, queries must also specify the same collation to leverage it.
