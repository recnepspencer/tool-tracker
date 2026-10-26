"""Create/drop only a named disposable browser database; never modify review data."""

import os
import re
import sys

import psycopg
from psycopg import sql


def main():
    action, name = sys.argv[1:]
    if action not in {"create", "drop"} or not re.fullmatch(
        r"nelson_browser_[0-9]+_[0-9a-f]{12}", name
    ):
        raise ValueError("Expected an owned browser database name and create/drop action.")
    with psycopg.connect(
        dbname="postgres",
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=os.getenv("POSTGRES_PORT", "55432"),
        autocommit=True,
    ) as connection:
        statement = "CREATE DATABASE {}" if action == "create" else "DROP DATABASE {} WITH (FORCE)"
        connection.execute(sql.SQL(statement).format(sql.Identifier(name)))


if __name__ == "__main__":
    main()
