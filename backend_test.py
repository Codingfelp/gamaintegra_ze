#!/usr/bin/env python3
"""
Teste completo das APIs do Zé Delivery Integrador
"""
import requests
import sys
import json
from datetime import datetime

class ZeDeliveryAPITester:
    def __init__(self, base_url="https://delivery-data-bug.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Executa um teste de API"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testando {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passou - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'success' in response_data:
                        print(f"   Success: {response_data['success']}")
                        if 'data' in response_data and isinstance(response_data['data'], (list, dict)):
                            if isinstance(response_data['data'], list):
                                print(f"   Dados: {len(response_data['data'])} itens")
                            else:
                                print(f"   Dados: {list(response_data['data'].keys())}")
                except:
                    print(f"   Resposta: {response.text[:100]}...")
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                print(f"❌ Falhou - Esperado {expected_status}, recebido {response.status_code}")
                print(f"   Resposta: {response.text[:200]}")

            return success, response

        except requests.exceptions.Timeout:
            self.failed_tests.append({
                'name': name,
                'error': 'Timeout - API não respondeu em 10s'
            })
            print(f"❌ Falhou - Timeout (10s)")
            return False, None
        except requests.exceptions.ConnectionError:
            self.failed_tests.append({
                'name': name,
                'error': 'Erro de conexão - Servidor não acessível'
            })
            print(f"❌ Falhou - Erro de conexão")
            return False, None
        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            print(f"❌ Falhou - Erro: {str(e)}")
            return False, None

    def test_health_check(self):
        """Testa endpoint de saúde"""
        return self.run_test("Health Check", "GET", "api/health")

    def test_pedidos_stats(self):
        """Testa estatísticas de pedidos"""
        return self.run_test("Estatísticas de Pedidos", "GET", "api/pedidos/stats/summary")

    def test_pedidos_list(self):
        """Testa listagem de pedidos"""
        success, response = self.run_test("Listagem de Pedidos", "GET", "api/pedidos?limit=10")
        return success, response

    def test_pedidos_filters(self):
        """Testa filtros de pedidos"""
        # Teste com filtro de status
        self.run_test("Pedidos - Filtro Status", "GET", "api/pedidos?status=0&limit=5")
        
        # Teste com busca
        self.run_test("Pedidos - Busca", "GET", "api/pedidos?search=test&limit=5")
        
        # Teste com status 'all'
        self.run_test("Pedidos - Todos Status", "GET", "api/pedidos?status=all&limit=5")

    def test_lojas_crud(self):
        """Testa CRUD de lojas"""
        # Listar lojas
        success, response = self.run_test("Listar Lojas", "GET", "api/lojas")
        
        # Criar nova loja
        nova_loja = {
            "nome": f"Loja Teste {datetime.now().strftime('%H%M%S')}",
            "email": f"teste{datetime.now().strftime('%H%M%S')}@teste.com",
            "senha": "senha123",
            "id_company": 1
        }
        success_create, response_create = self.run_test(
            "Criar Loja", "POST", "api/lojas", 200, nova_loja
        )
        
        # Se criou com sucesso, tentar deletar
        if success_create and response_create:
            try:
                # Buscar a loja criada para pegar o ID
                success_list, response_list = self.run_test("Listar Lojas Após Criação", "GET", "api/lojas")
                if success_list and response_list:
                    lojas_data = response_list.json()
                    if lojas_data.get('success') and lojas_data.get('data'):
                        # Pegar a primeira loja (mais recente)
                        loja_id = lojas_data['data'][0]['hub_delivery_id']
                        self.run_test(f"Deletar Loja {loja_id}", "DELETE", f"api/lojas/{loja_id}")
            except Exception as e:
                print(f"   Aviso: Não foi possível deletar loja de teste: {e}")

    def test_produtos(self):
        """Testa listagem de produtos"""
        return self.run_test("Listar Produtos", "GET", "api/produtos")

    def test_services_status(self):
        """Testa status dos serviços"""
        return self.run_test("Status dos Serviços", "GET", "api/services/status")

    def test_services_logs(self):
        """Testa logs dos serviços"""
        return self.run_test("Logs dos Serviços", "GET", "api/services/logs?limit=10")

    def test_config(self):
        """Testa configuração"""
        return self.run_test("Obter Configuração", "GET", "api/config")

    def test_duplo(self):
        """Testa sistema de dupla autenticação"""
        # Obter código duplo
        self.run_test("Obter Código Duplo", "GET", "api/duplo")
        
        # Criar código duplo
        codigo_teste = f"TEST{datetime.now().strftime('%H%M%S')}"
        self.run_test("Criar Código Duplo", "POST", "api/duplo", 200, {"codigo": codigo_teste})

    def test_pedido_details(self):
        """Testa detalhes de pedido específico"""
        # Primeiro buscar um pedido existente
        success, response = self.test_pedidos_list()
        if success and response:
            try:
                data = response.json()
                if data.get('success') and data.get('data') and len(data['data']) > 0:
                    pedido_id = data['data'][0]['delivery_id']
                    self.run_test(f"Detalhes do Pedido {pedido_id}", "GET", f"api/pedidos/{pedido_id}")
                    
                    # Testar atualização de status
                    self.run_test(
                        f"Atualizar Status Pedido {pedido_id}", 
                        "PATCH", 
                        f"api/pedidos/{pedido_id}/status",
                        200,
                        {"status": 2}
                    )
                else:
                    print("   ⚠️  Nenhum pedido encontrado para testar detalhes")
            except Exception as e:
                print(f"   ⚠️  Erro ao processar pedidos para teste de detalhes: {e}")

    def run_all_tests(self):
        """Executa todos os testes"""
        print("🚀 Iniciando testes das APIs do Zé Delivery Integrador")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Testes básicos
        self.test_health_check()
        
        # Testes de pedidos
        self.test_pedidos_stats()
        self.test_pedidos_list()
        self.test_pedidos_filters()
        self.test_pedido_details()
        
        # Testes de lojas
        self.test_lojas_crud()
        
        # Testes de produtos
        self.test_produtos()
        
        # Testes de serviços
        self.test_services_status()
        self.test_services_logs()
        
        # Testes de configuração
        self.test_config()
        
        # Testes de dupla autenticação
        self.test_duplo()

        # Relatório final
        print("\n" + "=" * 60)
        print("📊 RELATÓRIO FINAL DOS TESTES")
        print("=" * 60)
        print(f"✅ Testes executados: {self.tests_run}")
        print(f"✅ Testes aprovados: {self.tests_passed}")
        print(f"❌ Testes falharam: {len(self.failed_tests)}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Taxa de sucesso: {success_rate:.1f}%")
        
        if self.failed_tests:
            print("\n❌ TESTES QUE FALHARAM:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['name']}")
                if 'expected' in test:
                    print(f"   Esperado: {test['expected']}, Recebido: {test['actual']}")
                if 'error' in test:
                    print(f"   Erro: {test['error']}")
                if 'response' in test:
                    print(f"   Resposta: {test['response']}")
        
        return success_rate >= 80  # Considera sucesso se 80% ou mais dos testes passaram

def main():
    tester = ZeDeliveryAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())