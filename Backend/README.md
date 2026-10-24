# NexusApp backend

The backend is a Django REST API. Django-managed data and application documents are
stored in MongoDB. Django connects through the official Django MongoDB Backend.

## Setup

1. Install and start MongoDB, or provide a MongoDB Atlas connection string.
2. Copy `.env.example` to `.env` in this directory and set `MONGODB_URI`,
   `MONGODB_DATABASE`, and a private `DJANGO_SECRET_KEY`. MongoDB must be configured
   as a replica set or sharded cluster for transaction support.
3. From this directory, apply database migrations with `python manage.py migrate`.
4. From the repository root, install dependencies with `npm run backend:install`.
5. Start the API with `npm run backend`.

MongoDB indexes are created on first database access. Users, bearer tokens, projects,
resource allocations, password-reset OTPs, and Django ORM records are stored in
MongoDB. Passwords and OTPs are stored as hashes; expiring token and OTP documents
use MongoDB TTL indexes.

Kanban Ready to start uploads are stored in MongoDB GridFS, with upload metadata and
HTTP/HTTPS links stored in the `board_assets` collection. Selected files are bundled
into a ZIP archive; each file may be up to 25 MB and the combined upload may be up to
100 MB. New task IDs use the `LUX` project key by default.

Team invitations are stored in MongoDB with hashed, single-use tokens that expire
after seven days. Configure `FRONTEND_URL`, `DEFAULT_FROM_EMAIL`, and SMTP settings
(`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and TLS/SSL)
in `Backend/.env` to deliver invitation and password-reset emails. SMTP is the
default email backend; set `EMAIL_BACKEND` to Django's console backend only for
development where delivery is intentionally disabled.

`Backend/.env` is not included in the repository; copy `.env.example` and replace
`your-account@gmail.com` with the Gmail account that will send mail. For Gmail,
enable 2-Step Verification and create a Google App Password; put that App Password
in `EMAIL_HOST_PASSWORD` (not the normal Google account password). Use
`smtp.gmail.com`, port 587, `EMAIL_USE_TLS=true`, and `EMAIL_USE_SSL=false`. Set
`DEFAULT_FROM_EMAIL` to the authenticated Gmail address or a sender alias verified
in that Gmail account. The example intentionally contains no App Password, so
`python manage.py check` warns until credentials and sender are configured.
For other providers, use their documented SMTP host and port; port 465 requires
`EMAIL_USE_TLS=false` and `EMAIL_USE_SSL=true`.
To test delivery after configuring credentials, run
`python manage.py shell -c "from django.core.mail import send_mail; print(send_mail('Nexus SMTP test', 'Email delivery is configured.', None, ['your-address@example.com']))"`.
A successful result is `1`; SMTP credentials and verified sender details must come
from your mail provider and must not be committed.

The existing `db.sqlite3` file is not deleted. To import the legacy Django user
records into MongoDB after applying migrations, run
`python manage.py migrate_sqlite_users`. The command preserves password hashes,
skips expired session data, refuses conflicting accounts or unmigrated group
assignments, and can be rerun safely. Use `--sqlite-path` if the old database is
elsewhere.

## Structure

- `config/`: Django settings and ASGI/WSGI entry points.
- `AppCore/`: API routes, serializers, MongoDB document types, and authentication.
- `manage.py`: Django management entry point.
