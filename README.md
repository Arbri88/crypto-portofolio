# 💰 Crypto Portfolio Tracker

A secure, accessible, and responsive cryptocurrency portfolio management application.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 📊 Track multiple cryptocurrencies in your portfolio
- 💵 Real-time price updates from CoinGecko API
- 📈 Profit/Loss calculation with percentage changes
- 💾 Local storage persistence
- 🌙 Dark mode support (follows system preference)
- ♿ Fully accessible (WCAG 2.1 compliant)
- 📱 Responsive design for all devices
- 🔒 Secure with input sanitization and CSP headers

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js 16+ (optional, for development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arbri88/crypto-portofolio.git
   cd crypto-portofolio
   ```

2. Open `index.html` in your browser, or use a local server:
   ```bash
   npm install
   npm start
   ```
   Visit http://localhost:3000 in your browser.

## 📖 Usage

- **Add Cryptocurrency:** Select a cryptocurrency from the dropdown, enter the amount you own, and optionally enter your purchase price.
- **View Portfolio:** Your portfolio is displayed in a table with current prices, total values, and profit/loss calculations.
- **Refresh Prices:** Click the "Refresh Prices" button to fetch the latest prices from CoinGecko.
- **Remove Items:** Click the "Remove" button to delete a cryptocurrency from your portfolio.

## 🛠️ Technical Details

### Technologies Used

- HTML5 with semantic markup
- CSS3 with CSS Variables and Flexbox/Grid
- Vanilla JavaScript (ES6+)
- CoinGecko API for price data
- LocalStorage for data persistence

### Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Security Features

- Content Security Policy (CSP)
- Input sanitization to prevent XSS
- No external dependencies in production
- HTTPS-only API calls

## 📁 Project Structure

```
crypto-portofolio/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Styles with CSS variables
├── js/
│   └── script.js       # Application logic
├── .gitignore          # Git ignore rules
├── package.json        # Project metadata
└── README.md           # Documentation
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- CoinGecko for providing the free cryptocurrency API
- Icons from emoji set

## 📞 Contact

Arbri88 - @Arbri88

Project Link: https://github.com/Arbri88/crypto-portofolio
