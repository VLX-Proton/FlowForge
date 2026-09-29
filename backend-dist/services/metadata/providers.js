const axiosLib = require('axios');
async function callGemini(prompt, base64, mimeType, apiKey, model) {
    const payload = {
        contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                ]
            }],
        generationConfig: { temperature: 0.4 }
    };
    const geminiModel = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    const response = await axiosLib.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}
async function callOpenRouter(prompt, base64, mimeType, apiKey, model) {
    const payload = {
        model: model || 'google/gemma-4-31b-it:free',
        messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                ]
            }]
    };
    const response = await axiosLib.post('https://openrouter.ai/api/v1/chat/completions', payload, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:4000',
            'X-Title': 'FlowForge Local',
            'Content-Type': 'application/json'
        }
    });
    return response.data?.choices?.[0]?.message?.content || '{}';
}
async function callMistral(prompt, base64, mimeType, apiKey, model) {
    const mistralModel = model || 'pixtral-12b-2409';
    const payload = {
        model: mistralModel,
        messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: `data:${mimeType};base64,${base64}` }
                ]
            }]
    };
    const response = await axiosLib.post('https://api.mistral.ai/v1/chat/completions', payload, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data?.choices?.[0]?.message?.content || '{}';
}
module.exports = { callGemini, callOpenRouter, callMistral };
