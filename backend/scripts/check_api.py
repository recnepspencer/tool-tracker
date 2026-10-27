"""Local/CI release checks. Never applies migrations to the configured database."""

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
COMMANDS = [
    ["manage.py", "check", "--database", "default", "--fail-level", "WARNING"],
    ["manage.py", "makemigrations", "--check", "--dry-run"],
    ["manage.py", "migrate", "--check"],
    ["manage.py", "check_database_schema"],
    ["manage.py", "generate_platform_openapi", "--output", "contracts/openapi.json", "--check"],
    ["-m", "pytest", "-q", "--create-db", "--migrations"],
    ["-m", "ruff", "check", "."],
    ["-m", "ruff", "format", "--check", "."],
]


def main():
    for args in COMMANDS:
        print(f"Checking: {' '.join(args)}", flush=True)
        result = subprocess.run([sys.executable, *args], cwd=BACKEND, check=False)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
