"""Sealed transport for the exact PBKDF2 format accepted by the Core."""
import base64
import json
import re

from cryptography.fernet import Fernet, InvalidToken

FORMAT = re.compile(r'pbkdf2\$120000\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)')


def valid_legacy(value):
    if not isinstance(value, str):
        return False
    match = FORMAT.fullmatch(value)
    if not match:
        return False
    for part, length in zip(match.groups(), (16, 32)):
        decoded = base64.b64decode(part, validate=True)
        if len(decoded) != length or base64.b64encode(decoded).decode() != part:
            return False
    return True


def seal(key, run_id, user_id, value):
    if not valid_legacy(value):
        return None
    payload = json.dumps([run_id, str(user_id), value]).encode()
    return Fernet(key).encrypt(payload)


def unseal(key, run_id, user_id, ciphertext):
    try:
        value = json.loads(Fernet(key).decrypt(ciphertext))
        if (not isinstance(value, list) or len(value) != 3
                or value[:2] != [run_id, str(user_id)] or not valid_legacy(value[2])):
            raise ValueError('Credential binding invalid')
        return value[2]
    except (InvalidToken, ValueError, TypeError) as exc:
        raise ValueError('Protected credential unavailable') from None


def store_credentials(stage, cursor, run_id, key):
    """Separate query: raw rows never contain secrets; only linked B2C hashes move."""
    cursor.execute('''SELECT u."ID_usuario",u.senha FROM public."USUARIO" u
        WHERE u.tipo_usuario::text='B2C' AND EXISTS(
            SELECT 1 FROM public."B2C" b WHERE b."ID_usuario"=u."ID_usuario")''')
    while True:
        rows = cursor.fetchmany(500)
        if not rows:
            break
        for user_id, value in rows:
            ciphertext = seal(key, run_id, user_id, value)
            if ciphertext is not None:
                stage.execute('INSERT INTO sealed_credentials VALUES (?,?,?)',
                              (run_id, str(user_id), ciphertext))
