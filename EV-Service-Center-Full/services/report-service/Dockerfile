FROM python:3.9-slim

WORKDIR /app

RUN apt-get update

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

CMD ["gunicorn", "--bind", "0.0.0.0:8006", "app:create_app()"]
