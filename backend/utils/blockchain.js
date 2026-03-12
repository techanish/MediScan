// Utility to interact with the blockchain microservice
const axios = require('axios');

const BLOCKCHAIN_API = 'http://localhost:5001';

async function addBlock(data) {
  try {
    const res = await axios.post(`${BLOCKCHAIN_API}/add_block`, { data });
    return res.data;
  } catch (err) {
    throw err;
  }
}

async function getChain() {
  try {
    const res = await axios.get(`${BLOCKCHAIN_API}/chain`);
    return res.data;
  } catch (err) {
    throw err;
  }
}

module.exports = { addBlock, getChain };
