from app.db.session import create_db_and_tables, get_session
from sqlmodel import Session
import pytest

def test_create_db_and_tables():
    # This just calls metadata.create_all, which is safe to call multiple times in sqlite
    create_db_and_tables()

def test_get_session():
    # Test the generator
    gen = get_session()
    session = next(gen)
    assert isinstance(session, Session)
    # Don't forget to close or exhaust the generator to cover the finally block if there is one
    try:
        next(gen)
    except StopIteration:
        pass
