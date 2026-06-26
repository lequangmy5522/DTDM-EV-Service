FROM python:3.9-slim

ENV PYTHONUNBUFFERED=1
ENV APP_HOME=/app
ENV GUNICORN_ENV=true

WORKDIR $APP_HOME

RUN apt-get update

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8002

CMD ["gunicorn", "--bind", "0.0.0.0:8002", "app:create_app()", "--workers", "4"]