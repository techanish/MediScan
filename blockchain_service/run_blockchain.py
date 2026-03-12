# This script starts the blockchain microservice
from blockchain_api import app

if __name__ == "__main__":
    app.run(port=5001, debug=True)
