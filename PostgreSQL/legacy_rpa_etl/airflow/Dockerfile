FROM apache/airflow:3.3.2-python3.11 AS runtime
COPY requirements.txt /tmp/olius-requirements.txt
RUN pip install --no-cache-dir "apache-airflow==3.3.2" -r /tmp/olius-requirements.txt

FROM runtime AS validation
RUN pip install --no-cache-dir "apache-airflow==3.3.2" coverage==7.10.7
