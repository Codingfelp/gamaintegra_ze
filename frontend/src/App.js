import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_MAP = {
  0: { label: 'Pendente', color: 'bg-yellow-500' },
  1: { label: 'Entregue', color: 'bg-green-600' },
  2: { label: 'Aceito', color: 'bg-blue-500' },
  3: { label: 'A Caminho', color: 'bg-orange-500' },
  4: { label: 'Cancelado', color: 'bg-red-500' },
  5: { label: 'Rejeitado', color: 'bg-gray-500' }
};

function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || { label: 'Desconhecido', color: 'bg-gray-400' };
  return (
    <span className={`px-2 py-1 rounded text-white text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

function ServiceIndicator({ name, status, message, onStart, onStop }) {
  const isOnline = status === 'online';
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        <div>
          <p className="font-medium text-gray-900 text-sm">{name}</p>
          <p className="text-xs text-gray-500">{message || (isOnline ? 'Online' : 'Offline')}</p>
        </div>
      </div>
      {(onStart || onStop) && (
        <div>
          {!isOnline && onStart && (
            <Button size="sm" variant="outline" onClick={onStart} className="text-xs h-7">
              Iniciar
            </Button>
          )}
          {isOnline && onStop && (
            <Button size="sm" variant="outline" onClick={onStop} className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50">
              Parar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pedidos, setPedidos] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendentes: 0, aceitos: 0, entregues: 0, acaminho: 0, cancelados: 0, faturamento: 0 });
  const [services, setServices] = useState({});
  const [logs, setLogs] = useState({ v1: [], v1_itens: [] });
  const [lojas, setLojas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [config, setConfig] = useState({});
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [pedidoDetails, setPedidoDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', senha: '' });
  
  // Estado para monitoramento em tempo real
  const [healthData, setHealthData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [sessionsData, setSessionsData] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [backupStatus, setBackupStatus] = useState(null);
  
  // Estados para expandir logs de cada processo
  const [showLogsAceite, setShowLogsAceite] = useState(false);
  const [showLogsCaptura, setShowLogsCaptura] = useState(false);
  const [showLogsStatus, setShowLogsStatus] = useState(false);
  const [showLogsSync, setShowLogsSync] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const statsRes = await fetch(`${API_URL}/api/pedidos/stats/summary`);
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);

      let url = `${API_URL}/api/pedidos?limit=100`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      const pedidosRes = await fetch(url);
      const pedidosData = await pedidosRes.json();
      if (pedidosData.success) setPedidos(pedidosData.data);

      const servicesRes = await fetch(`${API_URL}/api/services/status`);
      const servicesData = await servicesRes.json();
      if (servicesData.success) {
        // Mapear nomes da API para nomes do frontend
        const mappedServices = {
          mysql: servicesData.data.mysql,
          php: servicesData.data.php,
          node_integrador: servicesData.data['v1.js'],
          node_itens: servicesData.data['v1-itens.js'],
          sync: servicesData.data.sync
        };
        setServices(mappedServices);
      }

      // Logs separados - converter strings em arrays de objetos
      const logsRes = await fetch(`${API_URL}/api/services/logs`);
      const logsData = await logsRes.json();
      if (logsData.success && logsData.data) {
        // Função para converter string de log em array de objetos
        const parseLogString = (logStr) => {
          if (!logStr || typeof logStr !== 'string') return [];
          return logStr.split('\n')
            .filter(line => line.trim())
            .slice(-50) // Últimas 50 linhas
            .map((line, idx) => ({
              timestamp: new Date().toISOString(),
              message: line,
              type: line.toLowerCase().includes('error') || line.toLowerCase().includes('erro') ? 'error' : 'info'
            }));
        };
        
        const processedLogs = {
          v1: Array.isArray(logsData.data.v1) ? logsData.data.v1 : parseLogString(logsData.data.v1),
          v1_itens: Array.isArray(logsData.data['v1-itens']) ? logsData.data['v1-itens'] : parseLogString(logsData.data['v1-itens']),
          sync: Array.isArray(logsData.data.sync) ? logsData.data.sync : parseLogString(logsData.data.sync)
        };
        setLogs(processedLogs);
      }
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    }
  }, [statusFilter, searchTerm]);

  const fetchLojas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/lojas`);
      const data = await res.json();
      if (data.success) setLojas(data.data);
    } catch (err) {
      console.error('Erro ao buscar lojas:', err);
    }
  };

  const fetchProdutos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/produtos`);
      const data = await res.json();
      if (data.success) setProdutos(data.data);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      if (data.success) setConfig(data.data);
    } catch (err) {
      console.error('Erro ao buscar config:', err);
    }
  };

  const fetchPedidoDetails = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/pedidos/${id}`);
      const data = await res.json();
      if (data.success) {
        // Formatar para o layout esperado: { pedido: {...}, itens: [...] }
        const pedido = { ...data.data };
        const itens = pedido.itens || [];
        delete pedido.itens;
        setPedidoDetails({ pedido, itens });
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    }
  };

  const controlService = async (service, action) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/services/${service}/${action}`, { method: 'POST' });
      const data = await res.json();
      console.log('Controle serviço:', data);
      setTimeout(fetchData, 1500);
    } catch (err) {
      console.error('Erro ao controlar serviço:', err);
    }
    setLoading(false);
  };

  const criarLoja = async () => {
    try {
      const res = await fetch(`${API_URL}/api/lojas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaLoja)
      });
      const data = await res.json();
      if (data.success) {
        setNovaLoja({ nome: '', email: '', senha: '' });
        fetchLojas();
      }
    } catch (err) {
      console.error('Erro ao criar loja:', err);
    }
  };

  const deletarLoja = async (id) => {
    if (!window.confirm('Confirma exclusão?')) return;
    try {
      await fetch(`${API_URL}/api/lojas/${id}`, { method: 'DELETE' });
      fetchLojas();
    } catch (err) {
      console.error('Erro ao deletar loja:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'lojas') fetchLojas();
    if (activeTab === 'produtos') fetchProdutos();
    if (activeTab === 'config') fetchConfig();
    if (activeTab === 'monitor') fetchMonitorData();
  }, [activeTab]);

  // Funções de monitoramento
  const fetchMonitorData = async () => {
    try {
      // Health check detalhado
      const healthRes = await fetch(`${API_URL}/api/health/detailed`);
      const healthJson = await healthRes.json();
      setHealthData(healthJson);

      // Métricas em tempo real
      const metricsRes = await fetch(`${API_URL}/api/metrics/realtime`);
      const metricsJson = await metricsRes.json();
      setMetricsData(metricsJson);

      // Status das sessões
      const sessionsRes = await fetch(`${API_URL}/api/sessions/status`);
      const sessionsJson = await sessionsRes.json();
      setSessionsData(sessionsJson);

      // Logs de erro
      const errorsRes = await fetch(`${API_URL}/api/logs/errors?limit=20`);
      const errorsJson = await errorsRes.json();
      if (errorsJson.success) setErrorLogs(errorsJson.logs || []);
    } catch (err) {
      console.error('Erro ao buscar dados de monitoramento:', err);
    }
  };

  const createBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions/backup`, { method: 'POST' });
      const data = await res.json();
      setBackupStatus(data);
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (err) {
      console.error('Erro ao criar backup:', err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-900">Gamatauri Zé</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${services.mysql?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                MySQL
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${services.php?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                PHP
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${services.node_integrador?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                Integrador
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-gray-200 mb-6" data-testid="main-tabs">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="monitor" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-monitor">Monitor 24/7</TabsTrigger>
            <TabsTrigger value="pedidos" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="lojas" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-lojas">Lojas</TabsTrigger>
            <TabsTrigger value="produtos" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-produtos">Produtos</TabsTrigger>
            <TabsTrigger value="servicos" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-servicos">Serviços</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-logs">Logs</TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-gray-900" data-testid="tab-config">Config</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" data-testid="dashboard-content">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <Card className="bg-white border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                  <p className="text-xs text-yellow-700 mb-1">Pendentes</p>
                  <p className="text-2xl font-semibold text-yellow-700">{stats.pendentes}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-700 mb-1">Aceitos</p>
                  <p className="text-2xl font-semibold text-blue-700">{stats.aceitos}</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <p className="text-xs text-orange-700 mb-1">A Caminho</p>
                  <p className="text-2xl font-semibold text-orange-700">{stats.acaminho}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-xs text-green-700 mb-1">Entregues</p>
                  <p className="text-2xl font-semibold text-green-700">{stats.entregues}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                  <p className="text-xs text-red-700 mb-1">Cancelados</p>
                  <p className="text-2xl font-semibold text-red-700">{stats.cancelados}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-400 border-yellow-500">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-800 mb-1">Faturamento</p>
                  <p className="text-xl font-semibold text-gray-900">R$ {stats.faturamento?.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">Serviços</CardTitle>
                </CardHeader>
                <CardContent>
                  <ServiceIndicator name="MySQL/MariaDB" status={services.mysql?.status} message={services.mysql?.message} />
                  <ServiceIndicator name="PHP-FPM" status={services.php?.status} message={services.php?.message} />
                  <ServiceIndicator 
                    name="Integrador (v1.js)" 
                    status={services.node_integrador?.status} 
                    message={services.node_integrador?.pid ? `PID ${services.node_integrador.pid}` : ''} 
                    onStart={() => controlService('integrador', 'start')}
                    onStop={() => controlService('integrador', 'stop')}
                  />
                  <ServiceIndicator 
                    name="Itens (v1-itens.js)" 
                    status={services.node_itens?.status} 
                    message={services.node_itens?.pid ? `PID ${services.node_itens.pid}` : ''} 
                    onStart={() => controlService('itens', 'start')}
                    onStop={() => controlService('itens', 'stop')}
                  />
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">Últimos Pedidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pedidos.slice(0, 5).map((pedido) => (
                      <div key={pedido.delivery_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">#{pedido.delivery_code}</p>
                          <p className="text-xs text-gray-500">{pedido.delivery_name_cliente}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={pedido.delivery_status} />
                          <p className="text-xs text-gray-600 mt-1">R$ {parseFloat(pedido.delivery_total || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {pedidos.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monitor 24/7 */}
          <TabsContent value="monitor" data-testid="monitor-content">
            {/* Status Geral */}
            <div className="mb-6">
              <Card className={`border-2 ${healthData?.overall_status === 'healthy' ? 'border-green-500 bg-green-50' : healthData?.overall_status === 'degraded' ? 'border-yellow-500 bg-yellow-50' : 'border-red-500 bg-red-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${healthData?.overall_status === 'healthy' ? 'bg-green-500' : healthData?.overall_status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {healthData?.overall_status === 'healthy' ? '✅ Sistema Operacional' : 
                           healthData?.overall_status === 'degraded' ? '⚠️ Sistema com Alertas' : 
                           '❌ Sistema com Problemas'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Última verificação: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Button onClick={fetchMonitorData} variant="outline" size="sm">Atualizar</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alertas */}
            {healthData?.alerts?.length > 0 && (
              <Card className="bg-red-50 border-red-200 mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-red-700">⚠️ Alertas Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {healthData.alerts.map((alert, idx) => (
                      <div key={idx} className={`p-2 rounded ${alert.level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        <span className="font-medium">[{alert.component}]</span> {alert.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Processos de Integração */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Aceite Automático */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${services.node_integrador?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    🤖 Aceite Automático
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xs ${services.node_integrador?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {services.node_integrador?.status === 'online' ? 'Rodando' : 'Parado'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Aceita pedidos automaticamente
                  </p>
                  <div className="mt-2 space-y-2">
                    {services.node_integrador?.status !== 'online' ? (
                      <Button size="sm" variant="outline" className="text-xs h-6 w-full" onClick={() => controlService('integrador', 'start')}>
                        Iniciar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-6 w-full text-red-600 border-red-200" onClick={() => controlService('integrador', 'stop')}>
                        Parar
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs h-6 w-full text-gray-600" 
                      onClick={() => setShowLogsAceite(!showLogsAceite)}
                    >
                      {showLogsAceite ? '▼ Ocultar logs' : '▶ Mostrar logs'}
                    </Button>
                  </div>
                  {showLogsAceite && (
                    <ScrollArea className="h-32 bg-gray-900 rounded-lg p-2 mt-2">
                      <div className="space-y-1 font-mono text-[10px]">
                        {logs.v1?.slice(-15).map((log, idx) => (
                          <div key={idx} className={`py-0.5 ${log.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                            {log.message}
                          </div>
                        ))}
                        {(!logs.v1 || logs.v1.length === 0) && (
                          <p className="text-gray-500 text-center py-2">Sem logs</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Captura de Pedidos */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${services.node_itens?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    📦 Captura de Itens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xs ${services.node_itens?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {services.node_itens?.status === 'online' ? 'Rodando' : 'Parado'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Itens, endereço, CPF, tipo
                  </p>
                  <div className="mt-2 space-y-2">
                    {services.node_itens?.status !== 'online' ? (
                      <Button size="sm" variant="outline" className="text-xs h-6 w-full" onClick={() => controlService('itens', 'start')}>
                        Iniciar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-6 w-full text-red-600 border-red-200" onClick={() => controlService('itens', 'stop')}>
                        Parar
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs h-6 w-full text-gray-600" 
                      onClick={() => setShowLogsCaptura(!showLogsCaptura)}
                    >
                      {showLogsCaptura ? '▼ Ocultar logs' : '▶ Mostrar logs'}
                    </Button>
                  </div>
                  {showLogsCaptura && (
                    <ScrollArea className="h-32 bg-gray-900 rounded-lg p-2 mt-2">
                      <div className="space-y-1 font-mono text-[10px]">
                        {logs.v1_itens?.slice(-15).map((log, idx) => (
                          <div key={idx} className={`py-0.5 ${
                            log.message?.includes('❌') || log.type === 'error' ? 'text-red-300' : 
                            log.message?.includes('✅') ? 'text-green-300' : 'text-gray-300'
                          }`}>
                            {log.message}
                          </div>
                        ))}
                        {(!logs.v1_itens || logs.v1_itens.length === 0) && (
                          <p className="text-gray-500 text-center py-2">Sem logs</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Atualização de Status */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${services.node_integrador?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    🔄 Atualização de Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xs ${services.node_integrador?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                    {services.node_integrador?.status === 'online' ? 'Rodando' : 'Parado'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Aceito, A Caminho, Entregue
                  </p>
                  <div className="mt-2 space-y-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs h-6 w-full text-gray-600" 
                      onClick={() => setShowLogsStatus(!showLogsStatus)}
                    >
                      {showLogsStatus ? '▼ Ocultar logs' : '▶ Mostrar logs'}
                    </Button>
                  </div>
                  {showLogsStatus && (
                    <ScrollArea className="h-32 bg-gray-900 rounded-lg p-2 mt-2">
                      <div className="space-y-1 font-mono text-[10px]">
                        {logs.v1?.filter(l => l.message?.toLowerCase().includes('status') || l.message?.includes('Entregue') || l.message?.includes('Aceito') || l.message?.includes('Caminho')).slice(-15).map((log, idx) => (
                          <div key={idx} className={`py-0.5 ${log.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                            {log.message}
                          </div>
                        ))}
                        {(!logs.v1 || logs.v1.filter(l => l.message?.toLowerCase().includes('status')).length === 0) && (
                          <p className="text-gray-500 text-center py-2">Sem logs de status</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Sync Supabase */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${services.sync?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    ☁️ Sync Supabase
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xs ${services.sync?.status === 'online' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {services.sync?.status === 'online' ? 'Conectado' : 'Aguardando'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Sincroniza com Supabase
                  </p>
                  <div className="mt-2 space-y-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs h-6 w-full text-gray-600" 
                      onClick={() => setShowLogsSync(!showLogsSync)}
                    >
                      {showLogsSync ? '▼ Ocultar logs' : '▶ Mostrar logs'}
                    </Button>
                  </div>
                  {showLogsSync && (
                    <ScrollArea className="h-32 bg-gray-900 rounded-lg p-2 mt-2">
                      <div className="space-y-1 font-mono text-[10px]">
                        {logs.sync?.slice(-15).map((log, idx) => (
                          <div key={idx} className={`py-0.5 ${
                            log.message?.includes('error') || log.type === 'error' ? 'text-red-300' : 
                            log.message?.includes('success') ? 'text-green-300' : 'text-gray-300'
                          }`}>
                            {log.message}
                          </div>
                        ))}
                        {(!logs.sync || logs.sync.length === 0) && (
                          <p className="text-gray-500 text-center py-2">Sem logs</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Métricas e Componentes */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Métricas */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">📊 Métricas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pedidos (24h)</span>
                    <span className="font-semibold">{metricsData?.orders?.last_24h?.total_24h || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entregues (24h)</span>
                    <span className="font-semibold text-green-600">{metricsData?.orders?.last_24h?.entregues_24h || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Faturamento (24h)</span>
                    <span className="font-semibold text-yellow-600">R$ {(metricsData?.orders?.last_24h?.faturamento_24h || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Disco</span>
                      <span className={`font-semibold ${(healthData?.metrics?.disk_usage_percent || 0) > 80 ? 'text-red-600' : 'text-gray-900'}`}>
                        {healthData?.metrics?.disk_usage_percent || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Memória</span>
                      <span className={`font-semibold ${(healthData?.metrics?.memory_usage_percent || 0) > 80 ? 'text-red-600' : 'text-gray-900'}`}>
                        {healthData?.metrics?.memory_usage_percent || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">DB Latência</span>
                      <span className="font-semibold">{healthData?.metrics?.db_latency_ms || 0}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Componentes */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">🔧 Componentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {healthData?.components && Object.entries(healthData.components).map(([name, comp]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        comp.status === 'healthy' ? 'bg-green-100 text-green-700' : 
                        comp.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {comp.status === 'healthy' ? '✓' : comp.status === 'degraded' ? '!' : '✗'} {comp.status}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Sessões Zé */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">🔐 Sessões Zé Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  {sessionsData?.sessions?.map((session, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{session.profile}</p>
                        <p className="text-xs text-gray-500">
                          {session.age_hours !== null ? `${session.age_hours.toFixed(1)}h atrás` : 'N/A'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${session.cookies_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {session.cookies_valid ? 'Válida' : 'Expirada'}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t">
                    <Button onClick={createBackup} className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm" disabled={loading}>
                      {loading ? 'Criando...' : '💾 Criar Backup de Sessões'}
                    </Button>
                    {backupStatus && (
                      <p className={`text-xs mt-2 ${backupStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                        {backupStatus.success ? `✅ Backup criado: ${backupStatus.profiles_backed_up?.join(', ')}` : '❌ Erro ao criar backup'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Último Pedido */}
            {metricsData?.orders?.latest && (
              <Card className="bg-white border-gray-200 mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">📦 Último Pedido Capturado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{metricsData.orders.latest.delivery_name_cliente}</p>
                      <p className="text-sm text-gray-500">Código: {metricsData.orders.latest.delivery_code}</p>
                      <p className="text-xs text-gray-400">Tipo: {metricsData.orders.latest.delivery_tipo_pedido || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {metricsData.orders.latest.delivery_date_time ? new Date(metricsData.orders.latest.delivery_date_time).toLocaleString() : 'N/A'}
                      </p>
                      <p className="text-sm font-semibold text-yellow-600">
                        R$ {parseFloat(metricsData.orders.latest.delivery_total || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Logs de Erro */}
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">🚨 Últimos Erros</CardTitle>
              </CardHeader>
              <CardContent>
                {errorLogs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhum erro recente encontrado ✓</p>
                ) : (
                  <ScrollArea className="h-48">
                    <div className="space-y-1 font-mono text-xs">
                      {errorLogs.map((log, idx) => (
                        <div key={idx} className="py-1 px-2 rounded bg-red-50 text-red-800">
                          <span className="font-semibold">[{log.service}]</span> {log.message}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pedidos */}
          <TabsContent value="pedidos" data-testid="pedidos-content">
            <div className="flex flex-wrap gap-3 mb-4">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs bg-white border-gray-200"
                data-testid="search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
                data-testid="status-filter"
              >
                <option value="all">Todos</option>
                <option value="0">Pendentes</option>
                <option value="2">Aceitos</option>
                <option value="3">A Caminho</option>
                <option value="1">Entregues</option>
                <option value="4">Cancelados</option>
              </select>
              <Button onClick={fetchData} variant="outline" className="border-gray-200" data-testid="refresh-btn">
                Atualizar
              </Button>
            </div>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-0">
                <table className="w-full" data-testid="pedidos-table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left p-3 text-xs font-medium text-gray-600">Código</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-600">Cliente</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-600">Data</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-600">Status</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-600">Pagamento</th>
                      <th className="text-right p-3 text-xs font-medium text-gray-600">Total</th>
                      <th className="text-center p-3 text-xs font-medium text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((pedido) => (
                      <tr key={pedido.delivery_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium text-gray-900">#{pedido.delivery_code}</td>
                        <td className="p-3 text-sm text-gray-700">{pedido.delivery_name_cliente}</td>
                        <td className="p-3 text-sm text-gray-500">
                          {pedido.delivery_date_time ? new Date(pedido.delivery_date_time).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="p-3"><StatusBadge status={pedido.delivery_status} /></td>
                        <td className="p-3 text-sm text-gray-600">{pedido.delivery_forma_pagamento}</td>
                        <td className="p-3 text-right text-sm font-medium text-gray-900">
                          R$ {parseFloat(pedido.delivery_total || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-gray-200"
                                onClick={() => {
                                  setSelectedPedido(pedido);
                                  fetchPedidoDetails(pedido.delivery_id);
                                }}
                                data-testid={`view-pedido-${pedido.delivery_id}`}
                              >
                                Ver
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-gray-900 flex items-center gap-3">
                                  Pedido #{selectedPedido?.delivery_code}
                                  {pedidoDetails?.pedido && <StatusBadge status={pedidoDetails.pedido.delivery_status} />}
                                </DialogTitle>
                              </DialogHeader>
                              {pedidoDetails?.pedido && (
                                <div className="space-y-6">
                                  {/* Cliente */}
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-3">Dados do Cliente</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-gray-500">Nome</p>
                                        <p className="text-sm text-gray-900 font-medium">{pedidoDetails.pedido.delivery_name_cliente}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">CPF</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_cpf_cliente || '-'}</p>
                                      </div>
                                      {pedidoDetails.pedido.delivery_email_entregador && (
                                        <div className="col-span-2">
                                          <p className="text-xs text-gray-500">Email Entregador</p>
                                          <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_email_entregador}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Endereço */}
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-3">Endereço de Entrega</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                        <p className="text-xs text-gray-500">Endereço</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_endereco_rota}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">Complemento</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_endereco_complemento || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">Bairro</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_endereco_bairro}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">Cidade/UF</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_endereco_cidade_uf}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">CEP</p>
                                        <p className="text-sm text-gray-900">{pedidoDetails.pedido.delivery_endereco_cep}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Código Entrega e Observações */}
                                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-yellow-700">Código de Entrega</p>
                                        <p className="text-lg font-mono font-bold text-yellow-800">{pedidoDetails.pedido.delivery_codigo_entrega || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-yellow-700">Tipo</p>
                                        <p className="text-sm text-yellow-800">{pedidoDetails.pedido.delivery_tipo_pedido || 'delivery'}</p>
                                      </div>
                                      {pedidoDetails.pedido.delivery_obs && (
                                        <div className="col-span-2">
                                          <p className="text-xs text-yellow-700">Observações</p>
                                          <p className="text-sm text-yellow-900 font-medium">{pedidoDetails.pedido.delivery_obs}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Itens */}
                                  <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Itens do Pedido ({pedidoDetails.itens?.length || 0})</h4>
                                    <div className="space-y-2">
                                      {pedidoDetails.itens?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                                          <div className="flex items-center gap-3">
                                            {item.produto_link_imagem && (
                                              <img src={item.produto_link_imagem} alt="" className="w-10 h-10 rounded object-cover" />
                                            )}
                                            <div>
                                              <p className="text-sm text-gray-900 font-medium">{item.delivery_itens_descricao || item.produto_descricao}</p>
                                              <p className="text-xs text-gray-500">
                                                {item.delivery_itens_qtd}x R$ {parseFloat(item.delivery_itens_valor_unitario || 0).toFixed(2)}
                                              </p>
                                            </div>
                                          </div>
                                          <p className="text-sm font-semibold text-gray-900">R$ {parseFloat(item.delivery_itens_valor_total || 0).toFixed(2)}</p>
                                        </div>
                                      ))}
                                      {(!pedidoDetails.itens || pedidoDetails.itens.length === 0) && (
                                        <p className="text-sm text-gray-400 text-center py-4">Nenhum item</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Valores */}
                                  <div className="border-t border-gray-200 pt-4">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900">R$ {parseFloat(pedidoDetails.pedido.delivery_subtotal || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Frete</span>
                                        <span className="text-gray-900">R$ {parseFloat(pedidoDetails.pedido.delivery_frete || 0).toFixed(2)}</span>
                                      </div>
                                      {parseFloat(pedidoDetails.pedido.delivery_desconto || 0) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Desconto</span>
                                          <span className="text-green-600">- R$ {parseFloat(pedidoDetails.pedido.delivery_desconto || 0).toFixed(2)}</span>
                                        </div>
                                      )}
                                      {parseFloat(pedidoDetails.pedido.delivery_taxa_conveniencia || 0) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Taxa Conveniência</span>
                                          <span className="text-gray-900">R$ {parseFloat(pedidoDetails.pedido.delivery_taxa_conveniencia || 0).toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                                        <span className="text-gray-900">Total</span>
                                        <span className="text-gray-900">R$ {parseFloat(pedidoDetails.pedido.delivery_total || 0).toFixed(2)}</span>
                                      </div>
                                    </div>

                                    {/* Pagamento */}
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <p className="text-xs text-gray-500">Forma de Pagamento</p>
                                          <p className="text-sm font-medium text-gray-900">{pedidoDetails.pedido.delivery_forma_pagamento}</p>
                                        </div>
                                        {parseFloat(pedidoDetails.pedido.delivery_troco_para || 0) > 0 && (
                                          <div className="text-right">
                                            <p className="text-xs text-gray-500">Troco para</p>
                                            <p className="text-sm font-medium text-gray-900">R$ {parseFloat(pedidoDetails.pedido.delivery_troco_para || 0).toFixed(2)}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lojas */}
          <TabsContent value="lojas" data-testid="lojas-content">
            <Card className="bg-white border-gray-200 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">Nova Loja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Input placeholder="Nome" value={novaLoja.nome} onChange={(e) => setNovaLoja({ ...novaLoja, nome: e.target.value })} className="max-w-xs bg-white border-gray-200" data-testid="loja-nome" />
                  <Input placeholder="Email" value={novaLoja.email} onChange={(e) => setNovaLoja({ ...novaLoja, email: e.target.value })} className="max-w-xs bg-white border-gray-200" data-testid="loja-email" />
                  <Input type="password" placeholder="Senha" value={novaLoja.senha} onChange={(e) => setNovaLoja({ ...novaLoja, senha: e.target.value })} className="max-w-xs bg-white border-gray-200" data-testid="loja-senha" />
                  <Button onClick={criarLoja} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900" data-testid="criar-loja-btn">Criar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">Lojas Cadastradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lojas.map((loja) => (
                    <div key={loja.hub_delivery_id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{loja.hub_delivery_nome}</p>
                        <p className="text-xs text-gray-500">{loja.hub_delivery_email}</p>
                        <p className="text-xs text-gray-400 font-mono mt-1">{loja.hub_delivery_ide}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={loja.hub_delivery_status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {loja.hub_delivery_status ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-200" onClick={() => deletarLoja(loja.hub_delivery_id)} data-testid={`delete-loja-${loja.hub_delivery_id}`}>
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Produtos */}
          <TabsContent value="produtos" data-testid="produtos-content">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">Produtos ({produtos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {produtos.map((produto) => (
                    <div key={produto.produto_id} className="flex gap-3 p-3 border border-gray-100 rounded-lg">
                      {produto.produto_link_imagem && (
                        <img src={produto.produto_link_imagem} alt="" className="w-12 h-12 object-cover rounded" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{produto.produto_descricao}</p>
                        <p className="text-xs text-gray-500">Código: {produto.produto_codigo_ze || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Serviços */}
          <TabsContent value="servicos" data-testid="servicos-content">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ServiceIndicator name="MySQL/MariaDB" status={services.mysql?.status} message={services.mysql?.message} />
                  <ServiceIndicator name="PHP-FPM" status={services.php?.status} message={services.php?.message} />
                  <ServiceIndicator name="Integrador (v1.js)" status={services.node_integrador?.status} message={services.node_integrador?.pid ? `PID ${services.node_integrador.pid}` : ''} onStart={() => controlService('integrador', 'start')} onStop={() => controlService('integrador', 'stop')} />
                  <ServiceIndicator name="Itens (v1-itens.js)" status={services.node_itens?.status} message={services.node_itens?.pid ? `PID ${services.node_itens.pid}` : ''} onStart={() => controlService('itens', 'start')} onStop={() => controlService('itens', 'stop')} />
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium text-gray-900">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={() => controlService('integrador', 'restart')} className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900" disabled={loading} data-testid="restart-integrador-btn">
                    {loading ? 'Aguarde...' : 'Reiniciar Integrador'}
                  </Button>
                  <Button onClick={() => controlService('all', 'start')} variant="outline" className="w-full border-gray-200" disabled={loading} data-testid="start-all-btn">
                    {loading ? 'Aguarde...' : 'Iniciar Todos'}
                  </Button>
                  <Button onClick={() => controlService('all', 'stop')} variant="outline" className="w-full border-gray-200 text-red-600" disabled={loading} data-testid="stop-all-btn">
                    {loading ? 'Aguarde...' : 'Parar Todos'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs" data-testid="logs-content">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Logs v1.js */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-medium text-gray-900">Logs v1.js (Integrador)</CardTitle>
                  <Button onClick={fetchData} variant="outline" size="sm" className="border-gray-200 text-xs">Atualizar</Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 bg-gray-900 rounded-lg p-3" data-testid="logs-v1-scroll">
                    {(!logs.v1 || logs.v1.length === 0) ? (
                      <p className="text-sm text-gray-500 text-center py-8">Nenhum log. Inicie o integrador.</p>
                    ) : (
                      <div className="space-y-1 font-mono text-xs">
                        {logs.v1?.map((log, idx) => (
                          <div key={idx} className={`py-1 px-2 rounded ${log.type === 'error' ? 'bg-red-900/50 text-red-300' : 'text-green-300'}`}>
                            <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Logs v1-itens.js */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-medium text-gray-900">Logs v1-itens.js</CardTitle>
                  <Button onClick={fetchData} variant="outline" size="sm" className="border-gray-200 text-xs">Atualizar</Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 bg-gray-900 rounded-lg p-3" data-testid="logs-v1-itens-scroll">
                    {(!logs.v1_itens || logs.v1_itens.length === 0) ? (
                      <p className="text-sm text-gray-500 text-center py-8">Nenhum log. Inicie o serviço de itens.</p>
                    ) : (
                      <div className="space-y-1 font-mono text-xs">
                        {logs.v1_itens?.map((log, idx) => (
                          <div key={idx} className={`py-1 px-2 rounded ${log.type === 'error' ? 'bg-red-900/50 text-red-300' : 'text-green-300'}`}>
                            <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Config */}
          <TabsContent value="config" data-testid="config-content">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Login</label>
                    <Input value={config.login || ''} readOnly className="bg-gray-50 border-gray-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Token</label>
                    <Input value={config.token || ''} readOnly className="bg-gray-50 border-gray-200 font-mono text-sm" />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">URLs</p>
                  <div className="space-y-1 text-xs font-mono text-gray-600">
                    <p>Pedido: {config.url_pedido}</p>
                    <p>View: {config.url_view}</p>
                    <p>Duplo: {config.url_duplo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 mt-8 bg-white">
        <p className="text-center text-xs text-gray-400">Gamatauri Zé Integrador © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
