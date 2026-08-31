# استخدام نسخة بايثون مستقرة
FROM python:3.11-slim

# تثبيت الأدوات الأساسية وإضافة مستودع جوجل كروم بالطريقة الحديثة
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    && mkdir -p /etc/apt/keyrings \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y \
    google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# ضبط مجلد العمل
WORKDIR /app

# نسخ المكتبات وتثبيتها
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ ملفات المشروع
COPY . .

# أمر التشغيل الأساسي
CMD ["python", "hunter.py"]