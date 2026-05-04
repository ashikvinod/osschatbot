import json
import os
import uuid
from typing import Optional
from fastapi import FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from dotenv import load_dotenv
import ollama

load_dotenv()

API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key")


def verify_key(key: str = Security(api_key_header)):
    if not API_KEY or key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store: session_id -> list of messages
sessions: dict[str, list[dict]] = {}

MODEL = "gemma3:1b"


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class NewSessionResponse(BaseModel):
    session_id: str


@app.post("/api/session")
def create_session(key: str = Security(verify_key)) -> NewSessionResponse:
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    return NewSessionResponse(session_id=session_id)


@app.post("/api/chat")
def chat(req: ChatRequest, key: str = Security(verify_key)):
    if not req.session_id or req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    history = sessions[req.session_id]
    history.append({"role": "user", "content": req.message})

    def stream():
        full_response = ""
        try:
            for chunk in ollama.chat(model=MODEL, messages=history, stream=True):
                token = chunk["message"]["content"]
                full_response += token
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        history.append({"role": "assistant", "content": full_response})
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.delete("/api/session/{session_id}")
def clear_session(session_id: str):
    if session_id in sessions:
        sessions[session_id] = []
    return {"cleared": True}
