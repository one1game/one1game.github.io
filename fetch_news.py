import requests
import json

# Пример API Hugging Face для генерации текстов
API_URL = "https://api-inference.huggingface.co/models/gpt2"
headers = {"Authorization": f"Bearer hf_NmyDFEgHPPnBeijTrqlplZWjPFQLqfkMyLRY"}

def generate_news():
    payload = {
        "inputs": "Generate 3 hot gaming news in short format."
    }

    response = requests.post(API_URL, headers=headers, json=payload)
    if response.status_code == 200:
        news = response.json()
        # Берем только текстовые новости
        generated_text = news[0]['generated_text']
        news_items = generated_text.split("\n")[:3]  # Разделим по строкам и выберем первые 3
        return [{'text': item} for item in news_items]
    else:
        print(f"Error: {response.status_code}")
        return []

# Генерация новостей
news = generate_news()

# Сохранение новостей в json
with open('news.json', 'w', encoding='utf-8') as f:
    json.dump(news, f, ensure_ascii=False, indent=4)
