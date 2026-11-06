"""Validate host bind mounts before starting the local Airflow demonstration."""
import argparse
import json
from pathlib import Path
import subprocess


def overlaps(first, second):
    first, second = first.resolve(strict=True), second.resolve(strict=True)
    return (first == second or first in second.parents or second in first.parents
            or any(first.samefile(parent) for parent in (second, *second.parents))
            or any(second.samefile(parent) for parent in first.parents))


def validate_mounts(config):
    service = config['services']['airflow']
    mounts = {item['target']: Path(item['source']) for item in service.get('volumes', [])
              if item['type'] == 'bind'}
    targets = ('/opt/olius-history/private', '/opt/olius-history/backup', '/opt/olius-history/reports')
    paths = [mounts[target] for target in targets if target in mounts]
    for index, path in enumerate(paths):
        if not path.is_dir():
            raise ValueError('History directories must already exist')
        if any(overlaps(path, other) for other in paths[index + 1:]):
            raise ValueError('History, backup and report directories overlap on the host')
    protected = [Path(item['file']) for item in config.get('secrets', {}).values() if 'file' in item]
    protected += [source for target, source in mounts.items() if target not in targets]
    if any(overlaps(path, source) for path in paths for source in protected):
        raise ValueError('History outputs overlap staging, code or a secret on the host')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ('load', 'archive', 'cpf', 'extended'):
        parser.add_argument('--' + option, action='store_true')
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    command = ['docker', 'compose', '--env-file', str(directory / '.env'), '-f', str(directory / 'compose.yaml')]
    for option in ('load', 'archive', 'cpf', 'extended'):
        if getattr(args, option):
            command += ['-f', str(directory / ('compose.' + option + '.yaml'))]
    result = subprocess.run(command + ['config', '--format', 'json'], capture_output=True, text=True, check=False)
    if result.returncode:
        raise SystemExit('Compose configuration invalid; check local settings (secrets are not printed).')
    try:
        validate_mounts(json.loads(result.stdout))
    except (ValueError, OSError, KeyError):
        raise SystemExit('Unsafe or missing host directories; separate outputs, staging and secrets.') from None
    return subprocess.run(command + ['up', '-d', '--build'], check=False).returncode


if __name__ == '__main__':
    raise SystemExit(main())
