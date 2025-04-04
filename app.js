const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { connectionStateRecovery: {} });
const PORT = process.env.PORT || 8000;

const ai =  new GoogleGenerativeAI(process.env.GEMINI_API); 
const travelExpenses = [];
let onlineUsers = [];

app.use(express.json());
app.use(express.static(path.resolve('./public')));

async function getCurrencyConversion(amount, fromCurrency, toCurrency) {
    console.log(`getCurrencyConversion called with: amount=${amount}, fromCurrency=${fromCurrency}, toCurrency=${toCurrency}`);
    return `Feature not implemented: Cannot convert ${amount} ${fromCurrency} to ${toCurrency}.`;
}

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    onlineUsers.push(socket.id);
    io.emit('total-user', onlineUsers.length);
    console.log(`Total online users: ${onlineUsers.length}`);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        onlineUsers = onlineUsers.filter(id => id !== socket.id);
        io.emit('total-user', onlineUsers.length);
        console.log(`Total online users after disconnect: ${onlineUsers.length}`);
    });
});

app.get('/', (req, res) => {
    console.log('GET / request received');
    res.sendFile(path.resolve('./public/index.html'));
});

app.post('/askAI', async (req, res) => {
    console.log('POST /askAI request received with body:', req.body);
    if (!ai) {
        console.error('AI Service not configured.');
        return res.status(500).json({ error: "AI Service not configured." });
    }
    
    const { ques } = req.body;
    if (!ques) {
        console.error('No question provided in request.');
        return res.status(400).json({ error: "No question provided." });
    }
    
    travelExpenses.push({ role: "user", parts: [{ text: ques }] });
    console.log('Updated travelExpenses:', travelExpenses);

    const conversionMatch = ques.match(/convert (\d+(\.\d+)?) (\w+) to (\w+)/i);
    if (conversionMatch) {
        const [, amount, , fromCurrency, toCurrency] = conversionMatch;
        console.log(`Currency conversion detected: amount=${amount}, fromCurrency=${fromCurrency}, toCurrency=${toCurrency}`);
        const result = await getCurrencyConversion(parseFloat(amount), fromCurrency.toUpperCase(), toCurrency.toUpperCase());
        travelExpenses.push({ role: "model", parts: [{ text: result }] });
        console.log('Currency conversion result:', result);
        return res.json({ answer: result });
    }

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const context = travelExpenses.map(m => `- ${m.parts[0].text}`).join('\n') || 'No expenses logged yet.';
        console.log('Generated context for AI:', context);
        
        const instruction = `You are a travel expense assistant. Context: ${context}\nUser: "${ques}"`;
        console.log('Instruction sent to AI:', instruction);
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: instruction }] }],
            generationConfig: { temperature: 0.6 }
        });
        
        const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "Error processing request.";
        console.log('AI response:', responseText);
        travelExpenses.push({ role: "model", parts: [{ text: responseText }] });

        res.json({ answer: responseText });
    } catch (error) {
        console.error("Gemini API error:", error);
        res.status(500).json({ error: "AI processing error." });
    }
});

server.listen(PORT, () => console.log(`Server live on: http://localhost:${PORT}`));
