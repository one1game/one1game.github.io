import requests
import os
import json

# Получаем ключ из переменной окружения
API_TOKEN = os.environ.get("HF_TOKEN")
API_URL = "https://api-inference.huggingface.co/models/gpt2"
headers = {"Authorization": f"Bearer {API_TOKEN}"}

# Генерируем новости
payload = {
    "inputs": "🔥 Напиши короткую новость из мира видеоигр:",
    "parameters": {"max_length": 100, "temperature": 0.8, "num_return_sequences": 3}
}

response = requests.post(API_URL, headers=headers, json=payload)
data = response.json()

# Обрабатываем и сохраняем
news = [{"text": item['generated_text']} for item in data]
with open('news.json', 'w', encoding='utf-8') as f:
    json.dump(news, f, ensure_ascii=False, indent=2)

