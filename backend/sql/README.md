# Database Setup (PostgreSQL)

1. Connect as postgres (Linux example):

```bash
sudo -u postgres psql
```

2. Create database and user:

```sql
CREATE DATABASE signature_app;
CREATE USER signature_user WITH PASSWORD 'yourpassword';
ALTER ROLE signature_user SET client_encoding TO 'utf8';
ALTER ROLE signature_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE signature_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE signature_app TO signature_user;
\q
```

3. Apply schema (from your shell):

```bash
psql -h localhost -U signature_user -d signature_app -f backend/sql/schema.sql
```

If prompted for a password, use the one configured above.