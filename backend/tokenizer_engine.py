import tiktoken
from transformers import AutoTokenizer
import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"

print("Loading tokenizers into memory...")

tiktoken_cl100k = tiktoken.get_encoding("cl100k_base")
tiktoken_o200k = tiktoken.get_encoding("o200k_base")

llama_tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")

def get_tokens(text: str, tokenizer_type: str = "cl100k_base") -> list[int]:

    if tokenizer_type == "cl100k_base":
        return tiktoken_cl100k.encode(text)

    elif tokenizer_type == "o200k_base":
        return tiktoken_o200k.encode(text)

    elif tokenizer_type == "llama_sentencepiece":
        # HuggingFace returns a dictionary, we just want the integer IDs
        return llama_tokenizer.encode(text, add_special_tokens=False)

    else:
        return tiktoken_cl100k.encode(text)
def decode_tokens(token_ids: list[int], encoding_name: str = "cl100k_base") -> str:

    encoding = tiktoken.get_encoding(encoding_name)
    return encoding.decode(token_ids)