require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cherry Financing pre-approval proxy
app.post('/api/cherry-preapproval', async (req, res) => {
  const { firstName, lastName, phone, address } = req.body;
  const cleanPhone = phone.replace(/\D/g, '');

  const payload = {
    patient: {
      firstName,
      lastName,
      phone: cleanPhone,
      ssn: null,
      address: {
        streetAddress: address.streetAddress,
        city: address.city,
        state: address.state,
        zip: address.zip,
      },
    },
  };

  const cherryHeaders = {
    'Content-Type': 'application/json',
    'x-access-key': process.env.CHERRY_ACCESS_KEY,
    'x-api-key': process.env.CHERRY_API_KEY,
  };

  try {
    console.log('Cherry request:', JSON.stringify(payload, null, 2));

    // First call — may return PENDING for new patients
    let response = await fetch(process.env.CHERRY_API_URL, {
      method: 'POST',
      headers: cherryHeaders,
      body: JSON.stringify(payload),
    });

    let data = await response.json();
    console.log('Cherry response (1st):', response.status, JSON.stringify(data, null, 2));

    // If PENDING, retry after 2 seconds — Cherry may resolve on second call
    if (data.status === 'PENDING') {
      console.log('Got PENDING, retrying in 2s...');
      await new Promise(r => setTimeout(r, 2000));

      response = await fetch(process.env.CHERRY_API_URL, {
        method: 'POST',
        headers: cherryHeaders,
        body: JSON.stringify(payload),
      });

      data = await response.json();
      console.log('Cherry response (2nd):', response.status, JSON.stringify(data, null, 2));
    }

    if (!response.ok && response.status !== 202) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('Cherry API error:', err.message);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cherry Aesthetics Booking running on http://localhost:${PORT}`);
});
