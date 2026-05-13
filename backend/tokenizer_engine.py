import tiktoken

def get_tokens(text: str, encoding_name: str = "cl100k_base") -> list[int]:

    try:
        # Get the specific Byte-Pair Encoding for the model
        encoding = tiktoken.get_encoding(encoding_name)
    except ValueError:
        encoding = tiktoken.get_encoding("cl100k_base")

    token_ids = encoding.encode(text)
    return token_ids

def decode_tokens(token_ids: list[int], encoding_name: str = "cl100k_base") -> str:

    encoding = tiktoken.get_encoding(encoding_name)
    return encoding.decode(token_ids)