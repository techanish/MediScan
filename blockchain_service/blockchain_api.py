from flask import Flask, request, jsonify
import hashlib
import json
import time

app = Flask(__name__)

class Block:
    def __init__(self, index, timestamp, data, previous_hash):
        self.index = index
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.hash_block()

    def hash_block(self):
        block_string = json.dumps(self.__dict__, sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()

class Blockchain:
    def __init__(self):
        self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        return Block(0, time.time(), 'Genesis Block', '0')

    def add_block(self, data):
        last_block = self.chain[-1]
        new_block = Block(len(self.chain), time.time(), data, last_block.hash)
        self.chain.append(new_block)
        return new_block

    def to_dict(self):
        return [block.__dict__ for block in self.chain]

blockchain = Blockchain()

@app.route('/chain', methods=['GET'])
def get_chain():
    return jsonify(blockchain.to_dict())

@app.route('/add_block', methods=['POST'])
def add_block():
    data = request.json.get('data')
    if not data:
        return jsonify({'error': 'Missing data'}), 400
    block = blockchain.add_block(data)
    return jsonify(block.__dict__), 201

if __name__ == '__main__':
    app.run(port=5001, debug=True)
  