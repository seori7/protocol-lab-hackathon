import threading
import uvicorn
import time
import sys
import os

# --- ВЗЛОМ СИСТЕМНЫХ ПУТЕЙ PYTHON ---
# Получаем абсолютные пути к корню проекта и к папке backend
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

# Вставляем их на 1-е место в "мозг" Питона, чтобы он искал файлы именно там
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, ROOT_DIR)

# Теперь импорты сработают 100%
from backend.main import app

def start_server():
    # Запускаем приложение напрямую
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

if __name__ == '__main__':
    # 1. Запускаем сервер
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    # Даем серверу 1.5 секунды на гарантированный старт
    time.sleep(1.5)

    print("Сервер запущен. Открываем десктопное окно...")
    
    import webview
    # 2. Открываем окно
    window = webview.create_window(
        'Protocol Lab - Desktop Edition', 
        'http://127.0.0.1:8000', 
        width=1280, 
        height=800,
        background_color='#0e0f11'
    )
    webview.start()