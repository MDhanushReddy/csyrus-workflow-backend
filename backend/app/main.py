from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.db import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Workflow Approval Management System",
    version="1.0.0",
    description="Manage workflow approvals, reviewers, and decisions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|0\.0\.0\.0):(5173|5174|5175|3000|3001|8000|8080)(/)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def read_root():
    return {"message": "Workflow Approval Management System API"}
