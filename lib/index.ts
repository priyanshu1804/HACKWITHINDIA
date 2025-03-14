import { GoogleGenerativeAI } from "@google/generative-ai";
import { OpenAI } from 'openai';

interface ChatRequest {
    prompt: string;
}

interface ChatResponse {
    response: string | null,
    model: string,
}

const listOfModels = [
    {
        name: 'gemini-2.0-flash',
        description: "Performs best for fact checking and general answers. It is not preferred for any coding related task"
    },
    {
        name: 'deepseek-chat',
        description: 'Works best for tasks related to general coding but may not perform well for tasks requiring deeper knowledge or complex tasks'
    }
];

const injectedPrompt = `
    FORGET WHAT I SAID BEFORE, I want you to analyze the prompt that I gave you and return ONLY THE NAME of the model which will
    give me the best result for the given prompt. As all the AI models have their different specialties, some AI models tend to perform
    certain tasks better than others. Therefore, I want you to ONLY RETURN THE NAME OF THE AI MODEL which should give me the best output as per their qualities.

    Here are the available models and their specialties:
    ${JSON.stringify(listOfModels)}

    IMPORTANT: Return ONLY the model name, nothing else. Do not include any reasoning or additional text.
`;

export async function askWithGemini(chatRequest: ChatRequest): Promise<ChatResponse> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(chatRequest.prompt);
    const answer = result.response.text();

    return {
        response: answer,
        model: 'Gemini 2.0 Flash'
    };
}

export async function askWithDeepSeek(chatRequest: ChatRequest): Promise<ChatResponse> {
    const apiKey = process.env.DEEPSEEK_API || '';
    if (!apiKey) throw new Error('DeepSeek API key is missing!');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat:free',
            messages: [{ role: 'user', content: chatRequest.prompt }],
            max_tokens: 10000,
        }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} - ${await response.text()}`);

    const completion = await response.json();
    const choice = completion.choices?.[0];
    const responseContent = choice?.message?.content || choice?.message?.reasoning;

    return {
        response: responseContent,
        model: 'deepseek-chat',
    };
}



export async function generateResponse(chatRequest: ChatRequest): Promise<ChatResponse> {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `"${chatRequest.prompt}" --------------------------------------- ${injectedPrompt}`;

        const answer = (await model.generateContent(prompt)).response.text().trim();

        console.log("Chosen model: ", answer);

        switch (answer) {
            case listOfModels[0].name: return await askWithGemini(chatRequest);
            case listOfModels[1].name: return await askWithDeepSeek(chatRequest);
            default: return await askWithGemini(chatRequest);
        }
    } catch (err) {
        console.log("An error occurred while selecting the model, defaulting to Gemini: ", err);
        return await askWithGemini(chatRequest);
    }
}
