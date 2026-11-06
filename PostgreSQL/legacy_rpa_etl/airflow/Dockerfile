FROM apache/airflow:3.3.2-python3.11@sha256:a6685a7a708ed6fa910c2c05458d7f2b0db9cca5c3bf58a72ded389767ad3e65 AS runtime
USER airflow
COPY requirements.lock /tmp/olius-requirements.lock
# Dependencies are inherited from the digest-pinned base; never resolve unpinned transitives.
RUN pip install --no-cache-dir --only-binary=:all: --no-deps --require-hashes -r /tmp/olius-requirements.lock

FROM runtime AS validation
USER airflow
COPY airflow/coverage.lock /tmp/olius-coverage.lock
RUN pip install --no-cache-dir --only-binary=:all: --no-deps --require-hashes -r /tmp/olius-coverage.lock
