FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8005

# Sử dụng wsgi.py làm entry point
CMD ["gunicorn", "--bind", "0.0.0.0:8005", "wsgi:application"]