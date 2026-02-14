def greet_user(name: str) -> str:
    if not name or not name.strip():
        raise ValueError("Name cannot be empty")

    return f"Hello, {name.strip()}!"