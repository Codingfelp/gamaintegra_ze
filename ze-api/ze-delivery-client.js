/**
 * Cliente da API Oficial do Zé Delivery para Parceiros
 * Documentação: https://seller-public-api.ze.delivery/docs
 * 
 * Este módulo substitui o scraping por chamadas diretas à API oficial
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuração
const CONFIG_FILE = path.join(__dirname, 'ze-api-config.json');
const TOKEN_FILE = path.join(__dirname, 'ze-api-token.json');

// URLs base
const API_BASE_URL = 'https://seller-public-api.ze.delivery';
const AUTH_URL = 'https://auth.ze.delivery'; // OAuth2

class ZeDeliveryAPI {
    constructor() {
        this.config = this.loadConfig();
        this.token = this.loadToken();
        this.axiosInstance = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        // Interceptor para adicionar token automaticamente
        this.axiosInstance.interceptors.request.use((config) => {
            if (this.token?.access_token) {
                config.headers.Authorization = `Bearer ${this.token.access_token}`;
            }
            return config;
        });
        
        // Interceptor para renovar token se expirado
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401 && this.config.client_id) {
                    console.log('🔄 Token expirado, renovando...');
                    await this.authenticate();
                    error.config.headers.Authorization = `Bearer ${this.token.access_token}`;
                    return this.axiosInstance.request(error.config);
                }
                throw error;
            }
        );
    }
    
    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            }
        } catch (e) {
            console.error('Erro ao carregar config:', e.message);
        }
        return {
            client_id: process.env.ZE_CLIENT_ID || '',
            client_secret: process.env.ZE_CLIENT_SECRET || '',
            merchant_id: process.env.ZE_MERCHANT_ID || '',
            auto_accept: true,
            auto_accept_delay: 5, // segundos
            polling_interval: 10 // segundos
        };
    }
    
    saveConfig(config) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        this.config = config;
    }
    
    loadToken() {
        try {
            if (fs.existsSync(TOKEN_FILE)) {
                const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
                // Verificar se não expirou
                if (data.expires_at && new Date(data.expires_at) > new Date()) {
                    return data;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar token:', e.message);
        }
        return null;
    }
    
    saveToken(tokenData) {
        // Calcular expiração
        const expiresIn = tokenData.expires_in || 3600;
        tokenData.expires_at = new Date(Date.now() + expiresIn * 1000).toISOString();
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
        this.token = tokenData;
    }
    
    /**
     * Autenticação OAuth2
     */
    async authenticate() {
        if (!this.config.client_id || !this.config.client_secret) {
            throw new Error('Credenciais não configuradas. Configure client_id e client_secret.');
        }
        
        try {
            console.log('🔐 Autenticando na API do Zé Delivery...');
            
            const response = await axios.post(`${AUTH_URL}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: this.config.client_id,
                client_secret: this.config.client_secret
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            this.saveToken(response.data);
            console.log('✅ Autenticação bem sucedida!');
            return response.data;
        } catch (error) {
            console.error('❌ Erro na autenticação:', error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Buscar pedidos pendentes/novos
     * GET /orders
     */
    async getOrders(status = 'CREATED', limit = 50) {
        try {
            const response = await this.axiosInstance.get('/orders', {
                params: {
                    merchantId: this.config.merchant_id,
                    status: status,
                    limit: limit
                }
            });
            
            console.log(`📦 ${response.data?.orders?.length || 0} pedido(s) encontrado(s) com status ${status}`);
            return response.data?.orders || [];
        } catch (error) {
            console.error('❌ Erro ao buscar pedidos:', error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Buscar detalhes de um pedido específico
     * GET /orders/{orderNumber}
     */
    async getOrderDetails(orderNumber) {
        try {
            const response = await this.axiosInstance.get(`/orders/${orderNumber}`);
            console.log(`📋 Detalhes do pedido #${orderNumber} obtidos`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao buscar pedido #${orderNumber}:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Aceitar um pedido
     * POST /orders/{orderNumber}/accept
     */
    async acceptOrder(orderNumber, preparationTime = 30, reason = 'AUTO_ACCEPT') {
        try {
            console.log(`🤖 Aceitando pedido #${orderNumber}...`);
            
            const response = await this.axiosInstance.post(`/orders/${orderNumber}/accept`, {
                orderNumber: orderNumber,
                reason: reason,
                preparationTime: preparationTime, // minutos
                createdAt: new Date().toISOString()
            });
            
            console.log(`✅ Pedido #${orderNumber} aceito com sucesso!`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao aceitar pedido #${orderNumber}:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Rejeitar um pedido
     * POST /orders/{orderNumber}/reject
     */
    async rejectOrder(orderNumber, reason = 'OUT_OF_STOCK') {
        try {
            console.log(`❌ Rejeitando pedido #${orderNumber}...`);
            
            const response = await this.axiosInstance.post(`/orders/${orderNumber}/reject`, {
                orderNumber: orderNumber,
                reason: reason,
                createdAt: new Date().toISOString()
            });
            
            console.log(`✅ Pedido #${orderNumber} rejeitado`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao rejeitar pedido #${orderNumber}:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Confirmar despacho do pedido (pronto para entrega)
     * POST /orders/{orderNumber}/dispatch
     */
    async dispatchOrder(orderNumber) {
        try {
            console.log(`🚴 Despachando pedido #${orderNumber}...`);
            
            const response = await this.axiosInstance.post(`/orders/${orderNumber}/dispatch`, {
                orderNumber: orderNumber,
                createdAt: new Date().toISOString()
            });
            
            console.log(`✅ Pedido #${orderNumber} despachado`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao despachar pedido #${orderNumber}:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Atualizar informações do entregador
     * POST /orders/{orderNumber}/courier
     */
    async updateCourier(orderNumber, courierEmail, latitude = null, longitude = null) {
        try {
            const data = {
                orderNumber: orderNumber,
                email: courierEmail
            };
            
            if (latitude && longitude) {
                data.lat = latitude;
                data.lng = longitude;
            }
            
            const response = await this.axiosInstance.post(`/orders/${orderNumber}/courier`, data);
            console.log(`✅ Entregador do pedido #${orderNumber} atualizado: ${courierEmail}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao atualizar entregador:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Buscar catálogo de produtos
     * GET /products
     */
    async getProducts() {
        try {
            const response = await this.axiosInstance.get('/products', {
                params: { merchantId: this.config.merchant_id }
            });
            console.log(`📦 ${response.data?.products?.length || 0} produto(s) encontrado(s)`);
            return response.data?.products || [];
        } catch (error) {
            console.error('❌ Erro ao buscar produtos:', error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Atualizar disponibilidade de produto
     * POST /products/{productId}/availability
     */
    async updateProductAvailability(productId, available = true) {
        try {
            const response = await this.axiosInstance.post(`/products/${productId}/availability`, {
                merchantId: this.config.merchant_id,
                productId: productId,
                available: available
            });
            console.log(`✅ Produto ${productId} - Disponível: ${available}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erro ao atualizar produto:`, error.response?.data || error.message);
            throw error;
        }
    }
}

// Exportar instância única
module.exports = new ZeDeliveryAPI();
module.exports.ZeDeliveryAPI = ZeDeliveryAPI;
