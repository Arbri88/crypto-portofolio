/**
 * Crypto Portfolio Tracker
 * A secure and accessible cryptocurrency portfolio management application
 * 
 * @version 2.0.0
 * @author Arbri88
 */

'use strict';

// ================================
// Configuration
// ================================
const CONFIG = {
    API_BASE_URL: 'https://api.coingecko.com/api/v3',
    CURRENCY: 'usd',
    STORAGE_KEY: 'crypto_portfolio',
    DEBOUNCE_DELAY: 300,
    CACHE_DURATION: 60000, // 1 minute
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
};

// ================================
// Utility Functions
// ================================

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Sanitize string to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format currency value
 * @param {number} value - Value to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, currency = 'USD') {
    if (typeof value !== 'number' || isNaN(value)) {
        return '$0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format number with appropriate decimal places
 * @param {number} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
function formatNumber(value, decimals = 8) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0';
    }
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ================================
// Storage Manager
// ================================
const StorageManager = {
    /**
     * Get portfolio from localStorage
     * @returns {Array} Portfolio array
     */
    getPortfolio() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!data) return [];
            
            const parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) {
                console.warn('Invalid portfolio data, resetting...');
                return [];
            }
            
            return parsed;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    },

    /**
     * Save portfolio to localStorage
     * @param {Array} portfolio - Portfolio array to save
     * @returns {boolean} Success status
     */
    savePortfolio(portfolio) {
        try {
            if (!Array.isArray(portfolio)) {
                throw new Error('Portfolio must be an array');
            }
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(portfolio));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            
            if (error.name === 'QuotaExceededError') {
                UI.showError('Storage quota exceeded. Please remove some items.');
            }
            return false;
        }
    },

    /**
     * Add item to portfolio
     * @param {Object} item - Item to add
     * @returns {boolean} Success status
     */
    addItem(item) {
        const portfolio = this.getPortfolio();
        item.id = generateId();
        item.addedAt = new Date().toISOString();
        portfolio.push(item);
        return this.savePortfolio(portfolio);
    },

    /**
     * Remove item from portfolio
     * @param {string} id - Item ID to remove
     * @returns {boolean} Success status
     */
    removeItem(id) {
        const portfolio = this.getPortfolio();
        const filtered = portfolio.filter(item => item.id !== id);
        return this.savePortfolio(filtered);
    },

    /**
     * Update item in portfolio
     * @param {string} id - Item ID to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateItem(id, updates) {
        const portfolio = this.getPortfolio();
        const index = portfolio.findIndex(item => item.id === id);
        
        if (index === -1) return false;
        
        portfolio[index] = { ...portfolio[index], ...updates };
        return this.savePortfolio(portfolio);
    },

    /**
     * Clear all portfolio data
     * @returns {boolean} Success status
     */
    clearPortfolio() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }
};

// ================================
// API Manager
// ================================
const APIManager = {
    cache: new Map(),

    /**
     * Fetch with retry logic
     * @param {string} url - URL to fetch
     * @param {number} retries - Number of retries
     * @returns {Promise<Object>} Response data
     */
    async fetchWithRetry(url, retries = CONFIG.MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    if (response.status === 429) {
                        // Rate limited - wait and retry
                        await new Promise(resolve => 
                            setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1))
                        );
                        continue;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => 
                    setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1))
                );
            }
        }
    },

    /**
     * Get crypto prices from API
     * @param {Array<string>} ids - Array of crypto IDs
     * @returns {Promise<Object>} Price data
     */
    async getPrices(ids) {
        if (!ids || ids.length === 0) return {};

        const cacheKey = ids.sort().join(',');
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
            return cached.data;
        }

        const url = `${CONFIG.API_BASE_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=${CONFIG.CURRENCY}&include_24hr_change=true`;
        
        try {
            const data = await this.fetchWithRetry(url);
            
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error('Error fetching prices:', error);
            throw error;
        }
    },

    /**
     * Clear price cache
     */
    clearCache() {
        this.cache.clear();
    }
};

// ================================
// UI Manager
// ================================
const UI = {
    elements: {},

    /**
     * Initialize UI elements
     */
    init() {
        this.elements = {
            form: document.getElementById('crypto-form'),
            cryptoSelect: document.getElementById('crypto-select'),
            amountInput: document.getElementById('amount'),
            purchasePriceInput: document.getElementById('purchase-price'),
            addBtn: document.getElementById('add-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            portfolioBody: document.getElementById('portfolio-body'),
            emptyState: document.getElementById('empty-state'),
            totalValue: document.getElementById('total-value'),
            totalProfit: document.getElementById('total-profit'),
            totalAssets: document.getElementById('total-assets'),
            lastUpdated: document.getElementById('last-updated'),
            loading: document.getElementById('loading'),
            errorContainer: document.getElementById('error-container'),
            errorMessage: document.getElementById('error-message'),
            errorClose: document.querySelector('.error-close'),
            modal: document.getElementById('confirm-modal'),
            modalCancel: document.getElementById('modal-cancel'),
            modalConfirm: document.getElementById('modal-confirm'),
            modalMessage: document.getElementById('modal-message'),
        };
    },

    /**
     * Show loading indicator
     */
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.hidden = false;
        }
    },

    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.hidden = true;
        }
    },

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (this.elements.errorContainer && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = sanitizeString(message);
            this.elements.errorContainer.hidden = false;
            
            // Auto-hide after 5 seconds
            setTimeout(() => this.hideError(), 5000);
        }
    },

    /**
     * Hide error message
     */
    hideError() {
        if (this.elements.errorContainer) {
            this.elements.errorContainer.hidden = true;
        }
    },

    /**
     * Show confirmation modal
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} User's choice
     */
    showConfirmModal(message) {
        return new Promise((resolve) => {
            if (!this.elements.modal) {
                resolve(confirm(message));
                return;
            }

            this.elements.modalMessage.textContent = message;
            this.elements.modal.hidden = false;

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') handleCancel();
            };

            const cleanup = () => {
                this.elements.modal.hidden = true;
                this.elements.modalConfirm.removeEventListener('click', handleConfirm);
                this.elements.modalCancel.removeEventListener('click', handleCancel);
                document.removeEventListener('keydown', handleKeydown);
            };

            this.elements.modalConfirm.addEventListener('click', handleConfirm);
            this.elements.modalCancel.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleKeydown);
        });
    },

    /**
     * Validate form inputs
     * @returns {Object|null} Validated data or null if invalid
     */
    validateForm() {
        const crypto = this.elements.cryptoSelect.value.trim();
        const amountStr = this.elements.amountInput.value.trim();
        const purchasePriceStr = this.elements.purchasePriceInput.value.trim();

        let isValid = true;

        // Reset errors
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

        // Validate crypto selection
        if (!crypto) {
            document.getElementById('crypto-select-error').textContent = 'Please select a cryptocurrency';
            this.elements.cryptoSelect.classList.add('error');
            isValid = false;
        }

        // Validate amount
        const amount = parseFloat(amountStr);
        if (!amountStr || isNaN(amount) || amount <= 0) {
            document.getElementById('amount-error').textContent = 'Please enter a valid positive amount';
            this.elements.amountInput.classList.add('error');
            isValid = false;
        }

        // Validate purchase price (optional)
        let purchasePrice = null;
        if (purchasePriceStr) {
            purchasePrice = parseFloat(purchasePriceStr);
            if (isNaN(purchasePrice) || purchasePrice < 0) {
                purchasePrice = null;
            }
        }

        if (!isValid) return null;

        return {
            cryptoId: crypto,
            cryptoName: this.elements.cryptoSelect.options[this.elements.cryptoSelect.selectedIndex].text,
            amount,
            purchasePrice,
        };
    },

    /**
     * Reset form
     */
    resetForm() {
        if (this.elements.form) {
            this.elements.form.reset();
        }
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    },

    /**
     * Render portfolio table
     * @param {Array} portfolio - Portfolio data
     * @param {Object} prices - Current prices
     */
    renderPortfolio(portfolio, prices) {
        if (!this.elements.portfolioBody) return;

        // Clear existing rows
        this.elements.portfolioBody.innerHTML = '';

        if (portfolio.length === 0) {
            this.elements.emptyState.hidden = false;
            this.elements.portfolioBody.closest('table').hidden = true;
            return;
        }

        this.elements.emptyState.hidden = true;
        this.elements.portfolioBody.closest('table').hidden = false;

        let totalValue = 0;
        let totalCost = 0;

        portfolio.forEach(item => {
            const priceData = prices[item.cryptoId];
            const currentPrice = priceData?.[CONFIG.CURRENCY] || 0;
            const itemValue = item.amount * currentPrice;
            const itemCost = item.purchasePrice ? item.amount * item.purchasePrice : null;
            const profitLoss = itemCost !== null ? itemValue - itemCost : null;
            const profitLossPercent = itemCost && itemCost > 0 
                ? ((itemValue - itemCost) / itemCost) * 100 
                : null;

            totalValue += itemValue;
            if (itemCost !== null) totalCost += itemCost;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="crypto-name">
                        ${sanitizeString(item.cryptoName)}
                    </span>
                </td>
                <td>${formatNumber(item.amount)}</td>
                <td>${formatCurrency(currentPrice)}</td>
                <td>${formatCurrency(itemValue)}</td>
                <td class="${profitLoss !== null ? (profitLoss >= 0 ? 'profit' : 'loss') : ''}">
                    ${profitLoss !== null 
                        ? `${profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)} (${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%)`
                        : 'N/A'
                    }
                </td>
                <td>
                    <button 
                        type="button" 
                        class="btn btn-danger btn-sm delete-btn" 
                        data-id="${item.id}"
                        aria-label="Remove ${sanitizeString(item.cryptoName)} from portfolio"
                    >
                        Remove
                    </button>
                </td>
            `;

            this.elements.portfolioBody.appendChild(row);
        });

        // Update summary
        const totalProfit = totalCost > 0 ? totalValue - totalCost : 0;
        
        this.elements.totalValue.textContent = formatCurrency(totalValue);
        this.elements.totalProfit.textContent = `${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}`;
        this.elements.totalProfit.className = `summary-value ${totalProfit >= 0 ? 'profit' : 'loss'}`;
        this.elements.totalAssets.textContent = portfolio.length;

        // Update last updated time
        this.elements.lastUpdated.textContent = new Date().toLocaleString();
        this.elements.lastUpdated.setAttribute('datetime', new Date().toISOString());
    },

    /**
     * Set button loading state
     * @param {HTMLElement} button - Button element
     * @param {boolean} isLoading - Loading state
     */
    setButtonLoading(button, isLoading) {
        if (!button) return;
        
        const textSpan = button.querySelector('.btn-text');
        const loadingSpan = button.querySelector('.btn-loading');
        
        if (textSpan && loadingSpan) {
            textSpan.hidden = isLoading;
            loadingSpan.hidden = !isLoading;
        }
        
        button.disabled = isLoading;
    }
};

// ================================
// Portfolio Controller
// ================================
const PortfolioController = {
    /**
     * Initialize the application
     */
    async init() {
        UI.init();
        this.bindEvents();
        await this.refreshPortfolio();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Form submission
        UI.elements.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddCrypto();
        });

        // Refresh button
        UI.elements.refreshBtn?.addEventListener('click', 
            debounce(() => this.refreshPortfolio(), CONFIG.DEBOUNCE_DELAY)
        );

        // Delete buttons (event delegation)
        UI.elements.portfolioBody?.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const id = e.target.dataset.id;
                await this.handleRemoveCrypto(id);
            }
        });

        // Error close button
        UI.elements.errorClose?.addEventListener('click', () => {
            UI.hideError();
        });

        // Keyboard navigation for modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !UI.elements.modal?.hidden) {
                UI.elements.modal.hidden = true;
            }
        });
    },

    /**
     * Handle adding new crypto
     */
    async handleAddCrypto() {
        const formData = UI.validateForm();
        if (!formData) return;

        UI.setButtonLoading(UI.elements.addBtn, true);

        try {
            const success = StorageManager.addItem(formData);
            
            if (success) {
                UI.resetForm();
                await this.refreshPortfolio();
            } else {
                UI.showError('Failed to add cryptocurrency. Please try again.');
            }
        } catch (error) {
            console.error('Error adding crypto:', error);
            UI.showError('An error occurred. Please try again.');
        } finally {
            UI.setButtonLoading(UI.elements.addBtn, false);
        }
    },

    /**
     * Handle removing crypto
     * @param {string} id - Item ID to remove
     */
    async handleRemoveCrypto(id) {
        const confirmed = await UI.showConfirmModal(
            'Are you sure you want to remove this cryptocurrency from your portfolio?'
        );

        if (!confirmed) return;

        try {
            const success = StorageManager.removeItem(id);
            
            if (success) {
                await this.refreshPortfolio();
            } else {
                UI.showError('Failed to remove cryptocurrency. Please try again.');
            }
        } catch (error) {
            console.error('Error removing crypto:', error);
            UI.showError('An error occurred. Please try again.');
        }
    },

    /**
     * Refresh portfolio with latest prices
     */
    async refreshPortfolio() {
        UI.showLoading();

        try {
            const portfolio = StorageManager.getPortfolio();
            
            if (portfolio.length === 0) {
                UI.renderPortfolio([], {});
                return;
            }

            const cryptoIds = [...new Set(portfolio.map(item => item.cryptoId))];
            const prices = await APIManager.getPrices(cryptoIds);
            
            UI.renderPortfolio(portfolio, prices);
        } catch (error) {
            console.error('Error refreshing portfolio:', error);
            UI.showError('Failed to fetch current prices. Please try again later.');
            
            // Still render portfolio with cached/zero prices
            const portfolio = StorageManager.getPortfolio();
            UI.renderPortfolio(portfolio, {});
        } finally {
            UI.hideLoading();
        }
    }
};

// ================================
// Initialize Application
// ================================
document.addEventListener('DOMContentLoaded', () => {
    PortfolioController.init().catch(error => {
        console.error('Failed to initialize application:', error);
        UI.showError('Failed to initialize application. Please refresh the page.');
    });
});

// Service Worker Registration (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}
