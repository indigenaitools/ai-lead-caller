# AI Lead Caller - Lead Generation Platform

AI Lead Caller is a powerful platform that uses AI to generate and manage leads for cold calling campaigns. The application helps businesses streamline their lead generation process and improve conversion rates.

## Features

- **AI-Powered Lead Generation**: Automatically find potential leads based on your campaign criteria
- **Campaign Management**: Create, manage, and track multiple lead generation campaigns
- **Lead Management**: Organize leads by status and track interactions
- **Call Tracking**: Record call outcomes and notes for each lead
- **Analytics Dashboard**: Visualize campaign performance and lead conversion metrics
- **Subscription Management**: Flexible subscription plans for different business needs

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- Bull job queue with Redis
- Puppeteer for web scraping
- JWT authentication
- Stripe for payment processing

### Frontend
- React with React Router
- Tailwind CSS for styling
- Recharts for data visualization
- Axios for API requests
- React Hot Toast for notifications

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Redis
- Docker and Docker Compose (optional)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-lead-caller.git
   cd ai-lead-caller
   ```

2. Set up environment variables:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration.

3. Install dependencies:
   ```
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

4. Start the development servers:
   ```
   # Start backend server
   cd backend
   npm run dev

   # Start frontend server
   cd ../frontend
   npm start
   ```

### Using Docker

Alternatively, you can use Docker Compose to run the entire stack:

```
cd docker
docker-compose up -d
```

This will start the backend, frontend, MongoDB, and Redis services.

## API Endpoints

### Authentication
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login and get JWT token
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get a specific lead
- `POST /api/leads` - Create a new lead
- `PUT /api/leads/:id` - Update a lead
- `DELETE /api/leads/:id` - Delete a lead
- `POST /api/leads/:id/call` - Add call history to a lead

### Campaigns
- `GET /api/campaigns` - Get all campaigns
- `GET /api/campaigns/:id` - Get a specific campaign
- `POST /api/campaigns` - Create a new campaign
- `PUT /api/campaigns/:id` - Update a campaign
- `DELETE /api/campaigns/:id` - Delete a campaign
- `POST /api/campaigns/:id/start` - Start a campaign
- `POST /api/campaigns/:id/pause` - Pause a campaign
- `GET /api/campaigns/:id/analytics` - Get campaign analytics

### Payments
- `POST /api/payments/create-subscription` - Create a subscription
- `POST /api/payments/cancel-subscription` - Cancel a subscription
- `POST /api/payments/create-credit-checkout` - Create a checkout session for credits
- `GET /api/payments/subscription` - Get user's subscription details
- `POST /api/payments/webhook` - Handle Stripe webhook events

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Express.js](https://expressjs.com/)
- [React](https://reactjs.org/)
- [MongoDB](https://www.mongodb.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stripe](https://stripe.com/)
- [Bull](https://github.com/OptimalBits/bull)