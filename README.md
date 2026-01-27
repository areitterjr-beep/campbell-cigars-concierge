# Campbell Cigars Concierge

An AI-powered cigar shop assistant for in-store use. Helps customers discover and learn about cigars through an intelligent chat interface, barcode scanning, and personalized recommendations.

## Features

### Customer-Facing Features

1. **AI Chat Assistant**
   - Expert knowledge about cigars, origins, flavors, and pairings
   - Personalized recommendations based on taste preferences
   - Helps beginners and connoisseurs alike
   - Explains cigar terminology in an approachable way

2. **Barcode/Image Scanner**
   - Scan cigar barcodes for instant information
   - Upload photos to identify cigars
   - Get detailed tasting notes and pairing suggestions
   - See body type, strength, and smoking time

3. **Discover Section**
   - Interactive preference quiz
   - Personalized cigar recommendations
   - Quick start guides for different experience levels
   - Flavor profile exploration

### Admin Features

1. **Inventory Management** (`/admin`)
   - View and edit all cigar inventory
   - Add new cigars to the database
   - Track stock levels with low-stock alerts
   - Quick inventory adjustment (+/-)
   - Search and filter products

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the cigar-shop directory:
   ```bash
   cd cigar-shop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your settings:
   ```bash
   # OpenAI API Key (optional - app works without it with fallback responses)
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Admin password for inventory management
   ADMIN_PASSWORD=your_secure_password
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Access Points

- **Customer Interface**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3000/admin`
  - Default password: `admin123` (change this in `.env.local`)

## Usage

### For Customers

1. **Ask the Expert**: Use the chat interface to ask any questions about cigars
   - "I'm new to cigars, where should I start?"
   - "What pairs well with bourbon?"
   - "I like smooth, creamy flavors - what do you recommend?"

2. **Scan a Cigar**: 
   - Use the camera to scan a barcode
   - Or upload a photo of a cigar band
   - Enter the barcode manually if needed

3. **Discover**: Take the preference quiz to get personalized recommendations

### For Shop Owners

1. Navigate to `/admin`
2. Enter the admin password
3. Features available:
   - View inventory overview and low-stock alerts
   - Adjust stock counts quickly with +/- buttons
   - Edit cigar details (name, description, price, etc.)
   - Add new cigars to the catalog
   - Delete discontinued items

## Cigar Database

The app comes preloaded with 12 popular cigars including:
- Arturo Fuente Hemingway Short Story
- Padron 1964 Anniversary Maduro
- Liga Privada No. 9
- Davidoff Grand Cru
- And more...

Each cigar includes:
- Detailed description
- Tasting notes
- Body and strength ratings
- Alcoholic and non-alcoholic pairings
- Price range and smoking time
- Best-for recommendations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: OpenAI GPT-4o-mini (optional)
- **Barcode Scanning**: html5-qrcode
- **Database**: JSON file (can be upgraded to a real database)

## Customization

### Adding More Cigars

Edit `src/data/cigars.json` to add your shop's inventory, or use the admin panel.

### Changing Colors

The app uses a warm, premium color palette defined in `tailwind.config.js`:
- `cigar-brown`: #4A3728
- `cigar-gold`: #C9A962
- `cigar-cream`: #F5F0E6
- `cigar-dark`: #2C1810
- `cigar-amber`: #B8860B

### AI Customization

The AI system prompt in `src/app/api/chat/route.ts` can be customized to:
- Add your shop's specific inventory
- Include your shop's personality/brand voice
- Add special promotions or recommendations

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

For cloud deployment, consider:
- **Vercel** (recommended for Next.js)
- **Railway**
- **AWS Amplify**

## License

MIT License - Feel free to customize for your cigar shop!
