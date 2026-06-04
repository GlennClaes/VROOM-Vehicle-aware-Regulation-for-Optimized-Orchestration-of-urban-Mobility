# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Utility code for working with XML files."""

import gzip
import xmltodict

def parse_xml_file(file_path):
    if not file_path:
        return None
    if file_path.endswith('.gz'):
        with gzip.open(file_path, 'rt', encoding='utf-8') as f:
            return xmltodict.parse(f.read(), attr_prefix='')
    else:
        with open(file_path, 'r', encoding='utf-8') as f:
            return xmltodict.parse(f.read(), attr_prefix='')


def get_only_key(d):
    """Access the only key in a dict.

    This is useful for SUMO XML files, where the outermost tag name is inconsistent.
    """
    assert d, 'Expected dict but got %s' % d
    assert len(d.keys()) == 1, 'Expected one key but got multiple %s' % d.keys()
    return d[list(d.keys())[0]]
