# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Utility code for working with XML files — optimized with pickle caching."""

import gzip
import hashlib
import os
import pickle
import time
import xmltodict

# Cache directory for pre-parsed XML files
_CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '.xml_cache')


def _ensure_cache_dir():
    """Create cache directory if it doesn't exist."""
    os.makedirs(_CACHE_DIR, exist_ok=True)


def _cache_key(file_path):
    """Generate a cache key from file path and modification time."""
    stat = os.stat(file_path)
    key_str = f"{file_path}:{stat.st_size}:{stat.st_mtime_ns}"
    return hashlib.md5(key_str.encode()).hexdigest()


def _load_from_cache(file_path):
    """Try to load parsed XML from pickle cache."""
    try:
        _ensure_cache_dir()
        key = _cache_key(file_path)
        cache_file = os.path.join(_CACHE_DIR, f"{key}.pkl")
        if os.path.exists(cache_file):
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
    except Exception:
        pass
    return None


def _save_to_cache(file_path, data):
    """Save parsed XML to pickle cache."""
    try:
        _ensure_cache_dir()
        key = _cache_key(file_path)
        cache_file = os.path.join(_CACHE_DIR, f"{key}.pkl")
        with open(cache_file, 'wb') as f:
            pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    except Exception as e:
        print(f"[xml_utils] Cache write failed for {file_path}: {e}")


def parse_xml_file(file_path):
    """Parse an XML file with pickle caching for fast subsequent loads."""
    if not file_path:
        return None

    # Check cache first
    cached = _load_from_cache(file_path)
    if cached is not None:
        print(f"[xml_utils] Cache HIT: {os.path.basename(file_path)}")
        return cached

    start = time.time()

    if file_path.endswith('.gz'):
        with gzip.open(file_path, 'rt', encoding='utf-8') as f:
            result = xmltodict.parse(f.read(), attr_prefix='')
    else:
        with open(file_path, 'r', encoding='utf-8') as f:
            result = xmltodict.parse(f.read(), attr_prefix='')

    elapsed = time.time() - start
    print(f"[xml_utils] Parsed {os.path.basename(file_path)} in {elapsed:.2f}s")

    # Cache the result for next time
    _save_to_cache(file_path, result)
    return result


def get_only_key(d):
    """Access the only key in a dict.

    This is useful for SUMO XML files, where the outermost tag name is inconsistent.
    """
    assert d, 'Expected dict but got %s' % d
    assert len(d.keys()) == 1, 'Expected one key but got multiple %s' % d.keys()
    return d[list(d.keys())[0]]
