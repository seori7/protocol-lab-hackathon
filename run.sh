#!/bin/bash
set -e # Остановить выполнение при любой ошибке

echo "====================================================="
echo " Запуск Protocol Lab (Desktop Edition) для Linux"
echo "====================================================="

echo "[1/3] Установка системных зависимостей (требуется sudo)..."
sudo apt-get update
sudo apt-get install -y python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.0 tshark nodejs npm python3-venv

echo "[2/3] Сборка интерфейса..."
cd frontend
npm install
npm run build
cd ..

echo "[3/3] Настройка Python и запуск приложения..."
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
pip install pywebview

echo "Открываем нативное окно..."
python3 start_app.py