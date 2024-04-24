# WahGPT - WhatsApp Chatbot with GPT4 Api Integration

WahGPT is a WhatsApp chatbot built using the `Baileys` library, allowing users to interact with an intelligent chatbot powered by GPT (ChatGPT4). This README provides a comprehensive explanation of the code structure and functionality.

## Features

- **WhatsApp Integration:** Utilizes `Baileys` to connect to the WhatsApp Web platform, enabling the bot to send and receive messages.
- **GPT Integration:** Communicates with the ChatGPT API to generate responses based on user input.

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine.
- WhatsApp account and a phone with an active internet connection.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/well300/WahGPT.git
   ```

2. Navigate to the project directory:

   ```bash
   cd WahGPT
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run the application:

   ```bash
   npm start
   ```

5. Scan the QR code displayed with your WhatsApp Web to authenticate.

## Code Structure

### 1. Initialization

The script initializes the WhatsApp client and sets up event listeners for authentication, QR code display, and readiness.

### 2. API URL Configuration

Environment variables are used to configure the URLs for the ChatGPT and DALL·E APIs. This allows for easy modification without altering the code.

```javascript
const apiUrl = `${process.env.CHATGPT_API_URL}?text=${encodeURIComponent(text)}`;
```

### 3. Message Processing

The `message` event listener handles incoming messages. It checks for specific commands, interacts with APIs, and sends appropriate responses.

#### 3.1. ChatGPT Integration

The `getChatGPTResponse` function makes a request to the ChatGPT API and processes the response.

#### 3.2. DALL·E Integration

The `getDALLEImage` function generates images using the DALL·E API in response to the `/dalle` command.

### 4. Response Formatting

Responses are formatted with emojis based on certain conditions or keywords in the reply.

```javascript
// Add emojis based on conditions or keywords in the response
if (response.toLowerCase().includes("hello")) {
  emojiResponse += " 👋";
} else if (response.toLowerCase().includes("thank you")) {
  emojiResponse += " 🙏";
}
```

### 5. Error Handling

The script includes error handling to gracefully manage API errors and other exceptions.

## Usage

1. Send messages to the WhatsApp number associated with the bot.
2. Use the `/dalle` command to generate DALL·E images based on text input.
3. Experience intelligent responses generated by ChatGPT.

## Contributing

Feel free to contribute by submitting issues or pull requests. Your feedback and improvements are welcomed!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the authors of `whatsapp-web.js` for providing a powerful library for WhatsApp Web automation.
- Appreciation to OpenAI for ChatGPT and DALL·E APIs.
---

Happy Chatting with WahGPT! 🤖🚀
