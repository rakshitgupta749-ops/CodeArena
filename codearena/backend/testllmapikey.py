from groq import Groq

# Replace with your Groq API key
API_KEY = "-"
client = Groq(api_key=API_KEY)

try:
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": "Say hello and confirm the API is working."
            }
        ],
        temperature=0.2,
        max_tokens=50
    )

    print("✅ API Key Working!")
    print("\nModel Response:")
    print(response.choices[0].message.content)

except Exception as e:
    print("❌ API Error:")
    print(e)