const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to summarize a webpage using external API
app.post('/api/summarize', async (req, res) => {
  const { url, style = 'normal' } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const styleMap = {
    easy: 'in simple, easy-to-understand English',
    normal: 'in clear and concise English',
    technical: 'using technical and domain-specific language'
  };
  const styleInstruction = styleMap[style] || styleMap['normal'];
  try {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const text = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 100) {
      return res.status(400).json({ error: 'Could not extract enough text from the webpage.' });
    }
    // Use OpenAI API for summarization
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not set.' });
    const prompt = `Summarize the following webpage content as bullet points, ${styleInstruction}, and write at least 100 words.\n\n${text.slice(0, 4000)}`;
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 600
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const summaryText = openaiRes.data.choices[0].message.content.trim();
    res.json({
      status: 'success',
      url,
      style,
      summary: summaryText,
      summary_tokens: summaryText.split(/\s+/).length,
      generated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Summarization error:', e);
    let errorMsg = 'Failed to fetch or summarize the webpage.';
    if (e.response && e.response.data) {
      errorMsg += ' ' + JSON.stringify(e.response.data);
    } else if (e.message) {
      errorMsg += ' ' + e.message;
    }
    res.status(500).json({
      status: 'error',
      url: req.body.url || null,
      error: errorMsg,
      generated_at: new Date().toISOString()
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port);
console.log(`Server running on port ${port}`);
