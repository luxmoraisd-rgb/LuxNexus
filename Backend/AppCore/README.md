# Backend (layered Django structure)

## Structure

```text
Backend/
├── config/
│   ├── settings.py
│   └── urls.py
├── appcore/
│   ├── authentication.py
│   ├── db.py
│   ├── models/
│   ├── serializers/
│   ├── views/
│   ├── urls/
│   ├── migrations/
│   └── tests.py
├── manage.py
├── .env.example
└── requirements.txt
```

## Run locally (PowerShell)

1. Create and activate a virtual environment: `python -m venv .venv` then ` .\.venv\Scripts\Activate.ps1`.
2. Install dependencies: `python -m pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and set your environment values.
4. Ensure MongoDB is running and the URI/database name are correct.
5. Run `python manage.py check`, then `python manage.py migrate`, then `python manage.py runserver`.
6. Goals endpoint: `http://127.0.0.1:8000/api/goals/`. `/api/` itself has no root endpoint.

Goal creation accepts optional `start_date` and `end_date` values in `YYYY-MM-DD` format. When supplied, both dates are required and the end date must be on or after the start date.

Session History retains the five most recent sessions per user, including ended sessions. Creating a session beyond this limit revokes the oldest active session and removes the oldest history entry.

Login is temporarily blocked for five minutes after six failed attempts for the same email address or username within a 15-minute window.

The API uses MongoDB via PyMongo. The Django model and SQLite database are retained for compatibility with the original project, but the Goal API reads/writes MongoDB. Custom authentication is not enabled; `authentication.py` is a placeholder.
