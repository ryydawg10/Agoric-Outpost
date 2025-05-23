# Agoric-Outpost
Block explorer for agoric 

Agoric Outpost is a full-stack web application that provides macroeconomic insights into the Agoric blockchain. It tracks key transaction metrics, aggregates them over time intervals, and visualizes them alongside live consensus module parameters.

Features:
-Real-Time & Historical Blockchain Data
-Retrieves and processes block data from a public Agoric RPC node
-Separately queries historical and real-time blocks
-Aggregates data into 10-minute chunks

Charts Dashboard (network-stats.html)
Graphs for:
-Sends
-Delegations
-Rewards
-Transaction Success/Fail

Supports timeframes:
-4 hours
-1 day
-4 days
-8 days
-15 days
-1 month

Supports refresh intervals: 5 min, 15 min, 30 min

Module Parameter Page (consensus-parameters.html)
Live fetches and displays:
-Minting parameters
-Governance parameters
-Staking
-Slashing
-Distribution
-Cosmos SDK version info

Backend API (api_server.js)
-Serves preprocessed data via /api/... routes
-Combines recent live data with stored Redis historical records
-Formats timestamps into human-readable intervals

Redis-Backed Data Buffer
-Uses Redis as a lightweight time-series buffer
-Keeps up to 4030 entries (approx. 1 month of 10-min chunks)
Data keys:
-sends_data
-delegation_data
-success/fail_data
-rewards_data
-param_data

Setup Instructions:
1. Clone the Repository
git clone <your-repo-url>
cd agoric-outpost
2. Install Dependencies
npm install

3. Set Up .env
Create a .env file:
ex:
PORT=8080
REDIS_URL=redis://localhost:6379

5. Start Redis on same port an .env file
redis-server

6. Start the Server
node api_server.js

6.visit: http://localhost:8080

Project Structure:
Backend/
  |- api_server.js          # Express server
  |- backend_query.js       # Real-time & historical blockchain data handling
  |- redis.js               # Redis client setup
  |- .env                   # Environment variables
Frontend/
  |- network-stats.html     # Main dashboard
  |- network-stats-script.js
  |- network-stats-styles.css
  |- consensus-parameters.html     # Parameters page
  |- consensus-parameters-script.js
  |- consensus-parameters-styles.css
  |- icons/...

API Endpoints Summary
Timeframe Data:
GET /api/4hr/fullLoad
GET /api/1day/fullLoad
GET /api/4day/fullLoad
GET /api/8day/fullLoad
GET /api/15day/fullLoad
GET /api/1month/fullLoad
Module Parameters:
GET /api/params

Credits

Developed by Ryan Abacherli
as part of an internship project with Kysen Pool

Design and deployment support provided by the Kysen Pool team.
All rights to open-source this project were granted by Kysen Pool.
Kysenpool.io

