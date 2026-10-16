from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from api.routes import router as api_router
from api.streams import router as streams_router

app = FastAPI(
    title="Protocol Analyzer API",
    description="Backend for Reverse Engineering Network Protocols Boilerplate",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем наши API-роуты
app.include_router(api_router, prefix="/api")
app.include_router(streams_router, prefix="/api")

# --- ИНТЕГРАЦИЯ ДЕСКТОПА ---
frontend_build_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

if os.path.exists(frontend_build_path):
    # МЫ УДАЛИЛИ app.mount("/assets"), так как у нас Single-File билд!
    
    # Все запросы, которые не API, отправляем на наш единственный index.html
    @app.get("/{catchall:path}")
    def serve_react_app(catchall: str):
        index_file = os.path.join(frontend_build_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend build not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)