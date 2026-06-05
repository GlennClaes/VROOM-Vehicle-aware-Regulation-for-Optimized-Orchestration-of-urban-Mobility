# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Utility code for working with deltas between frames."""
import math


def round_vehicles(vehicles):
    """Round values for vehicles to reduce data size. Mutates vehicles."""
    _round = round
    _int = int
    for v in vehicles.values():
        v['x'] = _round(v['x'], 2)
        v['y'] = _round(v['y'], 2)
        v['speed'] = _int(_round(v['speed']))
        v['angle'] = _int(_round(v['angle']))


def diff(before, after):
    """Calculate a diff between two dicts, ignoring nan values.

    We assume that no keys are deleted.
    """
    d = {}
    _type = type
    _isnan = math.isnan
    _float = float
    for k, v in after.items():
        bv = before.get(k)
        if bv != v:
            if _type(v) is _float and _isnan(v):
                continue
            d[k] = v
    return d


def diff_dicts(before, after):
    """Calculate a diff between two dicts.

    Returns a dict with:
        creations: dict of objects that were added
        updates: dict of diffs for modified objects
        removals: list of deleted keys
    """
    before_keys = before.keys()
    after_keys = after.keys()
    
    deleted_keys = list(before_keys - after_keys)
    
    creations = {}
    update = {}
    
    for k, v in after.items():
        if k in before:
            before_val = before[k]
            # Fast-path: if the dictionaries are identical, skip calling diff
            if before_val != v:
                d = diff(before_val, v)
                if d:
                    update[k] = d
        else:
            creations[k] = v

    return {'creations': creations, 'updates': update, 'removals': deleted_keys}
