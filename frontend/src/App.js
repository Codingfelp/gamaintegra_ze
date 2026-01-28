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

// Status labels e cores
const STATUS_MAP = {
  0: { label: 'Pendente', color: 'bg-yellow-500' },
  1: { label: 'Entregue', color: 'bg-green-500' },
  2: { label: 'Aceito', color: 'bg-blue-500' },
  3: { label: 'A Caminho', color: 'bg-purple-500' },
  4: { label: 'Cancelado', color: 'bg-red-500' },
  5: { label: 'Rejeitado', color: 'bg-red-700' }
};

// Componente de Status Badge
function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || { label: 'Desconhecido', color: 'bg-gray-500' };
  return (
    <span className={`px-2 py-1 rounded text-white text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

// Componente de Service Status
function ServiceStatus({ name, status, message, onStart, onStop }) {
  const isOnline = status === 'online';
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-xs text-slate-400">{message || (isOnline ? 'Rodando' : 'Parado')}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {!isOnline && onStart && (
          <Button size="sm" variant="outline" onClick={onStart} className="text-green-400 border-green-400">
            Iniciar
          </Button>
        )}
        {isOnline && onStop && (
          <Button size="sm" variant="outline" onClick={onStop} className="text-red-400 border-red-400">
            Parar
          </Button>
        )}
      </div>
    </div>
  );
}

// Componente de Log Entry
function LogEntry({ log }) {
  const isError = log.type === 'error';
  return (
    <div className={`p-2 rounded text-sm font-mono ${isError ? 'bg-red-900/30 text-red-300' : 'bg-slate-800 text-slate-300'}`}>
      <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
      <span className="ml-2">{log.message}</span>
    </div>
  );
}

// Componente Principal
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pedidos, setPedidos] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendentes: 0, aceitos: 0, entregues: 0, acaminho: 0, cancelados: 0, faturamento: 0 });
  const [services, setServices] = useState({});
  const [logs, setLogs] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [config, setConfig] = useState({});
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [pedidoDetails, setPedidoDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', senha: '' });

  // Buscar dados
  const fetchData = useCallback(async () => {
    try {
      // Stats
      const statsRes = await fetch(`${API_URL}/api/pedidos/stats/summary`);
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);

      // Pedidos
      let url = `${API_URL}/api/pedidos?limit=100`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      const pedidosRes = await fetch(url);
      const pedidosData = await pedidosRes.json();
      if (pedidosData.success) setPedidos(pedidosData.data);

      // Services
      const servicesRes = await fetch(`${API_URL}/api/services/status`);
      const servicesData = await servicesRes.json();
      if (servicesData.success) setServices(servicesData.data);

      // Logs
      const logsRes = await fetch(`${API_URL}/api/services/logs?limit=50`);
      const logsData = await logsRes.json();
      if (logsData.success) setLogs(logsData.data);
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
      if (data.success) setPedidoDetails(data.data);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    }
  };

  // Controlar serviços
  const controlService = async (service, action) => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/services/${service}/${action}`, { method: 'POST' });
      setTimeout(fetchData, 1000);
    } catch (err) {
      console.error('Erro ao controlar serviço:', err);
    }
    setLoading(false);
  };

  // Criar loja
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

  // Deletar loja
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
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold">Z</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Zé Delivery Integrador</h1>
                <p className="text-xs text-slate-400">Painel de Controle</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${services.mysql?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-slate-400">MySQL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${services.php?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-slate-400">PHP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${services.node_integrador?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-slate-400">Integrador</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700" data-testid="main-tabs">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="pedidos" data-testid="tab-pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="lojas" data-testid="tab-lojas">Lojas</TabsTrigger>
            <TabsTrigger value="produtos" data-testid="tab-produtos">Produtos</TabsTrigger>
            <TabsTrigger value="servicos" data-testid="tab-servicos">Serviços</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">Configuração</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6" data-testid="dashboard-content">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card className="bg-slate-800/50 border-slate-700" data-testid="stat-total">
                <CardContent className="p-4">
                  <p className="text-slate-400 text-sm">Total</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-900/30 border-yellow-700" data-testid="stat-pendentes">
                <CardContent className="p-4">
                  <p className="text-yellow-400 text-sm">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-300">{stats.pendentes}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-900/30 border-blue-700" data-testid="stat-aceitos">
                <CardContent className="p-4">
                  <p className="text-blue-400 text-sm">Aceitos</p>
                  <p className="text-2xl font-bold text-blue-300">{stats.aceitos}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-900/30 border-purple-700" data-testid="stat-acaminho">
                <CardContent className="p-4">
                  <p className="text-purple-400 text-sm">A Caminho</p>
                  <p className="text-2xl font-bold text-purple-300">{stats.acaminho}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-900/30 border-green-700" data-testid="stat-entregues">
                <CardContent className="p-4">
                  <p className="text-green-400 text-sm">Entregues</p>
                  <p className="text-2xl font-bold text-green-300">{stats.entregues}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-900/30 border-red-700" data-testid="stat-cancelados">
                <CardContent className="p-4">
                  <p className="text-red-400 text-sm">Cancelados</p>
                  <p className="text-2xl font-bold text-red-300">{stats.cancelados}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-900/30 border-amber-700" data-testid="stat-faturamento">
                <CardContent className="p-4">
                  <p className="text-amber-400 text-sm">Faturamento</p>
                  <p className="text-xl font-bold text-amber-300">R$ {stats.faturamento?.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Services */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Status dos Serviços</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ServiceStatus
                    name="MySQL/MariaDB"
                    status={services.mysql?.status}
                    message={services.mysql?.message}
                  />
                  <ServiceStatus
                    name="PHP-FPM"
                    status={services.php?.status}
                    message={services.php?.message}
                  />
                  <ServiceStatus
                    name="Node Integrador (v1.js)"
                    status={services.node_integrador?.status}
                    message={services.node_integrador?.pid ? `PID: ${services.node_integrador.pid}` : ''}
                    onStart={() => controlService('integrador', 'start')}
                    onStop={() => controlService('integrador', 'stop')}
                  />
                  <ServiceStatus
                    name="Node Itens (v1-itens.js)"
                    status={services.node_itens?.status}
                    message={services.node_itens?.pid ? `PID: ${services.node_itens.pid}` : ''}
                    onStart={() => controlService('itens', 'start')}
                    onStop={() => controlService('itens', 'stop')}
                  />
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Últimos Pedidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {pedidos.slice(0, 5).map((pedido) => (
                        <div key={pedido.delivery_id} className="flex items-center justify-between p-2 bg-slate-900 rounded">
                          <div>
                            <p className="font-medium text-white">#{pedido.delivery_code}</p>
                            <p className="text-xs text-slate-400">{pedido.delivery_name_cliente}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={pedido.delivery_status} />
                            <p className="text-xs text-slate-400 mt-1">R$ {parseFloat(pedido.delivery_total || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pedidos Tab */}
          <TabsContent value="pedidos" className="space-y-4" data-testid="pedidos-content">
            <div className="flex flex-wrap gap-4 items-center">
              <Input
                placeholder="Buscar por código ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs bg-slate-800 border-slate-700 text-white"
                data-testid="search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                data-testid="status-filter"
              >
                <option value="all">Todos os status</option>
                <option value="0">Pendentes</option>
                <option value="2">Aceitos</option>
                <option value="3">A Caminho</option>
                <option value="1">Entregues</option>
                <option value="4">Cancelados</option>
              </select>
              <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300" data-testid="refresh-btn">
                Atualizar
              </Button>
            </div>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="pedidos-table">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="text-left p-3 text-slate-400">Código</th>
                        <th className="text-left p-3 text-slate-400">Cliente</th>
                        <th className="text-left p-3 text-slate-400">Data</th>
                        <th className="text-left p-3 text-slate-400">Status</th>
                        <th className="text-left p-3 text-slate-400">Pagamento</th>
                        <th className="text-right p-3 text-slate-400">Total</th>
                        <th className="text-center p-3 text-slate-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr key={pedido.delivery_id} className="border-t border-slate-700 hover:bg-slate-800/50">
                          <td className="p-3 text-white font-medium">#{pedido.delivery_code}</td>
                          <td className="p-3 text-slate-300">{pedido.delivery_name_cliente}</td>
                          <td className="p-3 text-slate-400 text-sm">
                            {pedido.delivery_date_time ? new Date(pedido.delivery_date_time).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="p-3"><StatusBadge status={pedido.delivery_status} /></td>
                          <td className="p-3 text-slate-400">{pedido.delivery_forma_pagamento}</td>
                          <td className="p-3 text-right text-amber-400 font-medium">
                            R$ {parseFloat(pedido.delivery_total || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-600 text-slate-300"
                                  onClick={() => {
                                    setSelectedPedido(pedido);
                                    fetchPedidoDetails(pedido.delivery_id);
                                  }}
                                  data-testid={`view-pedido-${pedido.delivery_id}`}
                                >
                                  Ver
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="text-white">Pedido #{selectedPedido?.delivery_code}</DialogTitle>
                                </DialogHeader>
                                {pedidoDetails && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-slate-400 text-sm">Cliente</p>
                                        <p className="text-white">{pedidoDetails.pedido?.delivery_name_cliente}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-400 text-sm">CPF</p>
                                        <p className="text-white">{pedidoDetails.pedido?.delivery_cpf_cliente || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-400 text-sm">Endereço</p>
                                        <p className="text-white">{pedidoDetails.pedido?.delivery_endereco_rota}</p>
                                        <p className="text-slate-400 text-xs">{pedidoDetails.pedido?.delivery_endereco_bairro} - {pedidoDetails.pedido?.delivery_endereco_cidade_uf}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-400 text-sm">Código Entrega</p>
                                        <p className="text-amber-400 font-mono">{pedidoDetails.pedido?.delivery_codigo_entrega || '-'}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-slate-400 text-sm mb-2">Itens</p>
                                      <div className="space-y-2">
                                        {pedidoDetails.itens?.map((item, idx) => (
                                          <div key={idx} className="flex justify-between p-2 bg-slate-800 rounded">
                                            <div>
                                              <p className="text-white">{item.delivery_itens_descricao || item.produto_descricao}</p>
                                              <p className="text-slate-400 text-xs">Qtd: {item.delivery_itens_qtd}</p>
                                            </div>
                                            <p className="text-amber-400">R$ {parseFloat(item.delivery_itens_valor_total || 0).toFixed(2)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex justify-between pt-4 border-t border-slate-700">
                                      <div>
                                        <p className="text-slate-400 text-sm">Subtotal: R$ {parseFloat(pedidoDetails.pedido?.delivery_subtotal || 0).toFixed(2)}</p>
                                        <p className="text-slate-400 text-sm">Frete: R$ {parseFloat(pedidoDetails.pedido?.delivery_frete || 0).toFixed(2)}</p>
                                        <p className="text-slate-400 text-sm">Desconto: R$ {parseFloat(pedidoDetails.pedido?.delivery_desconto || 0).toFixed(2)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-amber-400">
                                          Total: R$ {parseFloat(pedidoDetails.pedido?.delivery_total || 0).toFixed(2)}
                                        </p>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lojas Tab */}
          <TabsContent value="lojas" className="space-y-4" data-testid="lojas-content">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Nova Loja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Input
                    placeholder="Nome da loja"
                    value={novaLoja.nome}
                    onChange={(e) => setNovaLoja({ ...novaLoja, nome: e.target.value })}
                    className="max-w-xs bg-slate-900 border-slate-700 text-white"
                    data-testid="loja-nome"
                  />
                  <Input
                    placeholder="Email Zé Delivery"
                    value={novaLoja.email}
                    onChange={(e) => setNovaLoja({ ...novaLoja, email: e.target.value })}
                    className="max-w-xs bg-slate-900 border-slate-700 text-white"
                    data-testid="loja-email"
                  />
                  <Input
                    type="password"
                    placeholder="Senha"
                    value={novaLoja.senha}
                    onChange={(e) => setNovaLoja({ ...novaLoja, senha: e.target.value })}
                    className="max-w-xs bg-slate-900 border-slate-700 text-white"
                    data-testid="loja-senha"
                  />
                  <Button onClick={criarLoja} className="bg-amber-600 hover:bg-amber-700" data-testid="criar-loja-btn">
                    Criar Loja
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Lojas Cadastradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lojas.map((loja) => (
                    <div key={loja.hub_delivery_id} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{loja.hub_delivery_nome}</p>
                        <p className="text-sm text-slate-400">{loja.hub_delivery_email}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">Token: {loja.hub_delivery_ide}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={loja.hub_delivery_status ? 'bg-green-600' : 'bg-red-600'}>
                          {loja.hub_delivery_status ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400"
                          onClick={() => deletarLoja(loja.hub_delivery_id)}
                          data-testid={`delete-loja-${loja.hub_delivery_id}`}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Produtos Tab */}
          <TabsContent value="produtos" className="space-y-4" data-testid="produtos-content">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Catálogo de Produtos ({produtos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produtos.map((produto) => (
                    <div key={produto.produto_id} className="flex gap-3 p-3 bg-slate-900 rounded-lg">
                      {produto.produto_link_imagem && (
                        <img
                          src={produto.produto_link_imagem}
                          alt={produto.produto_descricao}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium text-white text-sm">{produto.produto_descricao}</p>
                        <p className="text-xs text-slate-500">Código Zé: {produto.produto_codigo_ze || '-'}</p>
                        <Badge className="mt-1 bg-amber-600 text-xs">{produto.produto_tipo}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Serviços Tab */}
          <TabsContent value="servicos" className="space-y-4" data-testid="servicos-content">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Controle de Serviços</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ServiceStatus
                    name="MySQL/MariaDB"
                    status={services.mysql?.status}
                    message={services.mysql?.message}
                  />
                  <ServiceStatus
                    name="PHP-FPM"
                    status={services.php?.status}
                    message={services.php?.message}
                  />
                  <ServiceStatus
                    name="Node Integrador (v1.js)"
                    status={services.node_integrador?.status}
                    message={services.node_integrador?.pid ? `PID: ${services.node_integrador.pid}` : ''}
                    onStart={() => controlService('integrador', 'start')}
                    onStop={() => controlService('integrador', 'stop')}
                  />
                  <ServiceStatus
                    name="Node Itens (v1-itens.js)"
                    status={services.node_itens?.status}
                    message={services.node_itens?.pid ? `PID: ${services.node_itens.pid}` : ''}
                    onStart={() => controlService('itens', 'start')}
                    onStop={() => controlService('itens', 'stop')}
                  />
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => controlService('integrador', 'restart')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                    data-testid="restart-integrador-btn"
                  >
                    Reiniciar Integrador
                  </Button>
                  <Button
                    onClick={() => {
                      controlService('integrador', 'start');
                      controlService('itens', 'start');
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={loading}
                    data-testid="start-all-btn"
                  >
                    Iniciar Todos
                  </Button>
                  <Button
                    onClick={() => {
                      controlService('integrador', 'stop');
                      controlService('itens', 'stop');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700"
                    disabled={loading}
                    data-testid="stop-all-btn"
                  >
                    Parar Todos
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4" data-testid="logs-content">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Logs do Integrador</CardTitle>
                <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300" size="sm">
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] bg-slate-950 rounded-lg p-4" data-testid="logs-scroll">
                  <div className="space-y-1">
                    {logs.length === 0 ? (
                      <p className="text-slate-500 text-center py-10">Nenhum log disponível. Inicie o integrador para ver os logs.</p>
                    ) : (
                      logs.map((log, idx) => <LogEntry key={idx} log={log} />)
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4" data-testid="config-content">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Configuração do Integrador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-sm">Login (Email Zé Delivery)</label>
                    <Input
                      value={config.login || ''}
                      readOnly
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm">Token</label>
                    <Input
                      value={config.token || ''}
                      readOnly
                      className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-sm mb-2">URLs Configuradas:</p>
                  <div className="space-y-1 font-mono text-xs">
                    <p className="text-slate-300">Pedido: {config.url_pedido}</p>
                    <p className="text-slate-300">View: {config.url_view}</p>
                    <p className="text-slate-300">Duplo: {config.url_duplo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-10">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          Zé Delivery Integrador &copy; {new Date().getFullYear()} - Painel de Controle 24/7
        </div>
      </footer>
    </div>
  );
}

export default App;
