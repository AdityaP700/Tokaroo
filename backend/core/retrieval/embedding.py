from functools import lru_cache

_EMBEDDING_MODEL = None


@lru_cache(maxsize=1)
def _load_default_sentence_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def set_sentence_embedding_model(model) -> None:
    global _EMBEDDING_MODEL
    _EMBEDDING_MODEL = model


def get_sentence_embedding_model():
    if _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL

    return _load_default_sentence_embedding_model()


def _encode_texts(texts: list[str]):
    model = get_sentence_embedding_model()
    if model is None:
        return None

    try:
        return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return None
