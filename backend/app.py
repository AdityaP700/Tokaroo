from fastapi import FastAPI

app = FastAPI(title="Tokaroo API")

@app.get("/")
def read_root():
    return {"status": "Tokaroo Backend is live 🦘"}