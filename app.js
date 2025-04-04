const express = require('express');
const app = express();

const path = require('path');

const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const ai = new GoogleGenerativeAI(process.env.gemini_api);


const server = http.createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});
const PORT = process.env.PORT || 8000;


app.use(express.json());
app.use(express.static(path.resolve('./public')));


let onlineUser = [];

io.on('connection', (socket) => {
    onlineUser.push(socket.id);
    io.emit('total-user', onlineUser.length);

    socket.on('user-message', (message) => {
     
        io.emit('backend-user-message', message, socket.id);
    });

    socket.on('disconnect', () => {
        onlineUser = onlineUser.filter(id => id !== socket.id);
        io.emit('total-user', onlineUser.length);
        console.log('disconnected');
    });
});


app.get('/', (req, res) => {
    res.sendFile('./public/index.html');
});


const chatHistory = []; 

app.post('/askAI', async (req, res) => {
    const { ques } = req.body;

   
    chatHistory.push({ role: "user", parts: [{ text: ques }] }); 

    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent({
            contents: chatHistory, 
            
        });

        
        const text = result.response.candidates[0].content.parts[0].text || "No response from AI";

       
        chatHistory.push({ role: "model", parts: [{ text }] });

       
        res.json({ answer: text });

    } catch (error) {
        console.error("gemini_api_error", error);
        res.status(500).json({ error: "AI processing error" });
    }
});


server.listen(PORT, () => {
    console.log('\nServer is live on: ' + PORT);
})