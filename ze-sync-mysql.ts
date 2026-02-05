import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ✅ MAPEAMENTO CORRIGIDO: Zé Delivery -> status interno
// 
// FLUXO COMPLETO:
// 0 = Pendente → pending (📥 NOVOS)
// 2 = Aceito → preparing (📦 EM SEPARAÇÃO)
// 3 = A Caminho → shipped (🚚 EM ROTA) - exceto retirada que fica em preparing
// 1 = Entregue:
//     - Se pagamento ONLINE (Online, Nubank, Crédito Online) → closed (❌ sai do Kanban)
//     - Se pagamento FÍSICO (Dinheiro, Cartão, Maquininha, PIX) → awaiting_closure (💰 AGUARDANDO ACERTO)
// 4/5 = Cancelado → cancelled
// 6 = Rejeitado → awaiting_closure (💰 AGUARDANDO ACERTO)
//
const mapZeStatusToDbStatus = (zeStatus: number | string | undefined | null, paymentMethod?: string, isPickup?: boolean): string => {
  let numStatus: number;
  
  if (typeof zeStatus === "number") {
    numStatus = zeStatus;
  } else if (typeof zeStatus === "string") {
    const parsed = parseInt(zeStatus, 10);
    if (!isNaN(parsed)) {
      numStatus = parsed;
    } else {
      const statusLower = zeStatus.toLowerCase().trim();
      if (statusLower === 'pendente' || statusLower === 'pending') numStatus = 0;
      else if (statusLower === 'aceito' || statusLower === 'accepted') numStatus = 2;
      else if (statusLower.includes('caminho') || statusLower === 'shipped' || statusLower === 'a caminho') numStatus = 3;
      else if (statusLower === 'entregue' || statusLower === 'delivered') numStatus = 1;
      else if (statusLower === 'cancelado' || statusLower === 'cancelled') numStatus = 4;
      else if (statusLower === 'rejeitado' || statusLower === 'rejected') numStatus = 6;
      else numStatus = 0;
    }
  } else {
    numStatus = 0;
  }
  
  // ✅ REGRA CORRIGIDA: Apenas "Online" literal é pagamento online
  // PIX na entrega, Dinheiro, Cartão, Maquininha = pagamento FÍSICO
  const paymentLower = (paymentMethod || '').toLowerCase().trim();
  const isOnlinePayment = 
    paymentLower.includes('online') ||           // "Online", "Pagamento Online", "Online Nubank"
    paymentLower.includes('online nubank') ||
    paymentLower.includes('online pix') ||       // Pix já pago via app
    paymentLower === 'nubank';                   // Nubank online
  
  // PIX na entrega NÃO é pagamento online - é físico (entregador recebe)
  // "Pix" sozinho = entregador recebe na entrega
  // "Online Pix" ou "Pix Online" = já pago via app
  
  switch (numStatus) {
    case 0: // Pendente → NOVOS
      return "pending";
    
    case 2: // Aceito → EM SEPARAÇÃO
      return "preparing";
    
    case 3: // A Caminho
      // ✅ Retirada NÃO vai para "Em Rota" - fica em preparing
      return isPickup ? "preparing" : "shipped";
    
    case 1: // Entregue
      // ✅ Se pagamento ONLINE → fecha direto (sai do Kanban)
      // ✅ Se pagamento FÍSICO → aguardando acerto (entregador precisa acertar)
      return isOnlinePayment ? "closed" : "awaiting_closure";
    
    case 4: // Cancelado
    case 5: // Cancelado (variante)
      // ✅ Cancelados com pagamento online vão para closed (já foi pago)
      // ✅ Cancelados com pagamento físico vão para awaiting_closure (precisa verificar)
      return isOnlinePayment ? "closed" : "awaiting_closure";
    
    case 6: // Rejeitado
      return "awaiting_closure";
    
    default:
      return "pending";
  }
};

// Mapear forma de pagamento
const mapPaymentMethod = (method: string | undefined): string => {
  if (!method) return 'online';
  const m = method.toLowerCase();
  if (m.includes('dinheiro')) return 'dinheiro';
  if (m.includes('cartão') || m.includes('cartao') || m.includes('crédito') || m.includes('débito')) return 'cartao';
  if (m.includes('pix')) return 'pix';
  return 'online';
};

// ✅ Detectar tipo de pedido: Comum, Turbo, Retirada
// Prioriza delivery_tipo_pedido (valor exato do banco Zé) sobre delivery_type
const mapZeDeliveryType = (deliveryType: string | undefined | null): { deliveryTypeDb: string, isTurbo: boolean, isPickup: boolean } => {
  if (!deliveryType) return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
  
  const lower = deliveryType.toLowerCase().trim();
  
  // "Pedido de Retirada", "Pedido Retirada", "Retirada"
  if (lower.includes('retirada') || lower.includes('pickup') || lower === 'retirada') {
    console.log(`📦 Tipo detectado como RETIRADA: "${deliveryType}"`);
    return { deliveryTypeDb: 'pickup', isTurbo: false, isPickup: true };
  }
  
  // "Pedido Turbo"
  if (lower.includes('turbo')) {
    console.log(`📦 Tipo detectado como TURBO: "${deliveryType}"`);
    return { deliveryTypeDb: 'delivery', isTurbo: true, isPickup: false };
  }
  
  // "Pedido Comum" (padrão)
  console.log(`📦 Tipo detectado como COMUM: "${deliveryType}"`);
  return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
};

// ✅ Converter itens para o formato correto do Lovable
// Aceita múltiplos formatos de campo do VPS
const convertItems = (zeItems: any[], orderId: string): any[] => {
  if (!zeItems || !Array.isArray(zeItems)) {
    console.log(`⚠️ convertItems: array inválido para pedido ${orderId}`);
    return [];
  }
  
  if (zeItems.length === 0) {
    console.log(`⚠️ convertItems: array vazio para pedido ${orderId}`);
    return [];
  }
  
  console.log(`📦 convertItems: processando ${zeItems.length} itens para pedido ${orderId}`);
  
  return zeItems.map((item, idx) => {
    // Nome do produto - múltiplas fontes
    const itemName = item.nome || item.item_nome || item.name || item.product_name || item.productName || 'Produto';
    
    // Quantidade - pode vir como string ou número
    const quantity = parseInt(String(item.quantidade || item.item_quantidade || item.quantity || '1'), 10) || 1;
    
    // Preços - múltiplas fontes
    const unitPrice = parseFloat(String(item.preco_unitario || item.item_preco || item.unit_price || item.unitPrice || item.price || '0')) || 0;
    const totalPrice = parseFloat(String(item.preco_total || item.item_valor || item.total_price || item.totalPrice || String(quantity * unitPrice))) || 0;
    
    // Imagem
    const imageUrl = item.imagem || item.image_url || item.image || null;
    
    const converted = {
      id: `ze-item-${orderId}-${idx}`,
      productId: null,
      product_id: null,
      productName: itemName,            // ✅ Formato camelCase para UI
      product_name: itemName,           // ✅ Formato snake_case para compatibilidade
      original_name: itemName,
      nome: itemName,                   // ✅ Campo original Zé
      quantity: quantity,
      unitPrice: unitPrice,             // ✅ Número
      unit_price: unitPrice,
      totalPrice: totalPrice,           // ✅ Número
      total_price: totalPrice,
      notes: item.observacao || item.notes || null,
      image_url: imageUrl,
      zeCode: item.codigo_ze || item.zeCode || null,
    };
    
    console.log(`  -> Item ${idx}: "${itemName}" x${quantity} = R$${totalPrice.toFixed(2)}`);
    
    return converted;
  });
};

// ✅ Construir endereço completo
const buildFullAddress = (pedido: any): string | null => {
  // Se é retirada, não tem endereço
  const deliveryType = pedido.delivery_type || pedido.delivery_tipo_pedido || '';
  if (deliveryType.toLowerCase().includes('retirada')) {
    return null;
  }
  
  // Se já tem endereço completo
  if (pedido.address && pedido.address !== '0') {
    return pedido.address;
  }
  
  // Construir de campos separados
  const parts = [
    pedido.delivery_endereco_rota !== '0' ? pedido.delivery_endereco_rota : null,
    pedido.address_complement && pedido.address_complement !== '0' ? pedido.address_complement :
      pedido.delivery_endereco_complemento && pedido.delivery_endereco_complemento !== '0' ? pedido.delivery_endereco_complemento : null,
    pedido.address_neighborhood && pedido.address_neighborhood !== '0' ? pedido.address_neighborhood : pedido.delivery_endereco_bairro,
    pedido.address_city && pedido.address_city !== '0' ? pedido.address_city : pedido.delivery_endereco_cidade_uf,
    pedido.address_zip && pedido.address_zip !== '0' ? `CEP: ${pedido.address_zip}` : 
      pedido.delivery_endereco_cep && pedido.delivery_endereco_cep !== '0' ? `CEP: ${pedido.delivery_endereco_cep}` : null,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(', ') : null;
};

// ✅ Função de segurança: mascarar CPF nos logs
const maskCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return 'N/A';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 4) return '***';
  return `***${clean.slice(-4)}`;
};

// ✅ Limitar tamanho de textos para segurança
const sanitizeText = (text: string | null | undefined, maxLength: number = 500): string | null => {
  if (!text || text === '0' || text === 'N/A') return null;
  return String(text).substring(0, maxLength).trim() || null;
};

// ✅ Validar valores numéricos (não negativos)
const sanitizeNumber = (value: any, defaultVal: number = 0): number => {
  const num = parseFloat(String(value || defaultVal));
  return isNaN(num) || num < 0 ? defaultVal : num;
};

// ✅ Gerar hash para detectar itens duplicados
const hashItem = (item: any): string => {
  const name = (item.nome || item.item_nome || item.name || '').toLowerCase().trim();
  const qty = item.quantidade || item.item_quantidade || item.quantity || 1;
  const price = item.preco_unitario || item.item_preco || item.unit_price || 0;
  return `${name}|${qty}|${price}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('🍺 ze-sync-mysql: Recebendo webhook do VPS (sync rápido)...');

    // Validar chave de API
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '') || 
                   req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('ZE_SYNC_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ Chave de API inválida');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { pedidos } = body;
    
    // ✅ Limitar pedidos por request (máx 500)
    const MAX_PEDIDOS = 500;
    
    if (!pedidos || !Array.isArray(pedidos)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: expected { pedidos: [...] }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Validar limite de pedidos
    if (pedidos.length > MAX_PEDIDOS) {
      console.warn(`⚠️ Recebidos ${pedidos.length} pedidos, limitando a ${MAX_PEDIDOS}`);
    }
    const pedidosToProcess = pedidos.slice(0, MAX_PEDIDOS);

    console.log(`📦 Processando ${pedidosToProcess.length} pedidos (recebidos: ${pedidos.length})`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ Employee ID via ENV ou fallback
    const DEFAULT_EMPLOYEE_ID = Deno.env.get('ZE_DELIVERY_EMPLOYEE_ID') || '86c5eacd-3ff5-41b8-bdbf-54ef003527e5';

    // ✅ Carregar todos os entregadores com email_ze para vinculação automática
    const { data: allDeliverers } = await supabase
      .from('deliverers')
      .select('id, name, email_ze')
      .eq('active', true);
    
    // Criar mapa de email -> deliverer para busca rápida
    const emailToDelivererMap = new Map<string, { id: string, name: string }>();
    if (allDeliverers) {
      for (const deliverer of allDeliverers) {
        if (deliverer.email_ze) {
          // email_ze pode conter múltiplos emails separados por vírgula
          const emails = deliverer.email_ze.split(',').map((e: string) => e.trim().toLowerCase());
          for (const email of emails) {
            if (email) {
              emailToDelivererMap.set(email, { id: deliverer.id, name: deliverer.name });
            }
          }
        }
      }
    }
    console.log(`📧 Mapa de entregadores carregado: ${emailToDelivererMap.size} emails cadastrados`);

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Log detalhado do primeiro pedido para debug (com CPF mascarado)
    if (pedidosToProcess.length > 0) {
      const sample = pedidosToProcess[0];
      console.log('📋 Campos do primeiro pedido:', JSON.stringify(Object.keys(sample)));
      console.log('📋 delivery_type:', sample.delivery_type);
      console.log('📋 delivery_tipo_pedido:', sample.delivery_tipo_pedido);
      console.log('📋 items count:', (sample.items || sample.itens || []).length);
      console.log('📋 CPF (masked):', maskCpf(sample.customer_cpf || sample.delivery_cpf_cliente));
    }

    for (const pedido of pedidosToProcess) {
      // Aceitar múltiplos formatos de ID
      const rawId = pedido.id_local || pedido.external_id || pedido.ide || pedido.delivery_id;
      
      if (!rawId) {
        console.warn('⚠️ Pedido sem ID válido, pulando');
        errors.push('Pedido sem ID válido');
        continue;
      }
      
      const externalOrderId = `ze-${rawId}`;
      
      try {
        // ✅ Mapear tipo de pedido PRIMEIRO (afeta o status)
        const deliveryTypeRaw = pedido.delivery_tipo_pedido || pedido.delivery_type || '';
        const { deliveryTypeDb, isTurbo, isPickup } = mapZeDeliveryType(deliveryTypeRaw);
        
        console.log(`📦 Pedido ${rawId}: tipo="${deliveryTypeRaw}" -> db="${deliveryTypeDb}" isPickup=${isPickup}`);
        
        // ✅ Buscar pedido existente COM items para comparar
        const { data: existing, error: checkError } = await supabase
          .from('orders')
          .select('id, status, delivery_type, items, customer_name, customer_phone, customer_document, delivery_address, pickup_code, deliverer_id, deliverer_name')
          .eq('external_order_id', externalOrderId)
          .maybeSingle();

        // ✅ Verificar se há courier_email para vincular entregador automaticamente
        // REGRA: Ignorar emails que contenham "thales.ferraz" (exceção solicitada)
        const courierEmail = (pedido.courier_email || pedido.delivery_entregador_email || '').toLowerCase().trim();
        const deliveryEntregador = (pedido.delivery_entregador || pedido.deliverer_name || '').toLowerCase().trim();
        
        // Se delivery_entregador parece ser um email, tentar buscar por ele também
        const possibleEmails = [courierEmail, deliveryEntregador].filter(e => e && e.includes('@'));
        
        let matchedDeliverer: { id: string, name: string } | null = null;
        
        for (const email of possibleEmails) {
          // ✅ EXCEÇÃO: Ignorar emails que contenham "thales.ferraz"
          if (email.includes('thales.ferraz')) {
            console.log(`📧 Pedido ${rawId}: ignorando email "${email}" (exceção thales.ferraz)`);
            continue;
          }
          
          if (emailToDelivererMap.has(email)) {
            matchedDeliverer = emailToDelivererMap.get(email)!;
            console.log(`📧 Pedido ${rawId}: email "${email}" -> Entregador "${matchedDeliverer.name}"`);
            break;
          }
        }

        if (checkError) {
          console.error(`❌ Erro ao verificar pedido ${externalOrderId}:`, checkError);
          errors.push(`${externalOrderId}: ${checkError.message}`);
          continue;
        }

        // Mapear status e payment
        const rawStatus = pedido.status ?? pedido.delivery_status ?? pedido.status_text ?? 0;
        const rawPaymentMethod = pedido.payment_method || pedido.delivery_forma_pagamento || '';
        const newDbStatus = mapZeStatusToDbStatus(rawStatus, rawPaymentMethod, isPickup);
        
        console.log(`📦 Pedido ${rawId}: status_ze=${rawStatus} -> status_db="${newDbStatus}"`);

        // ✅ Preparar itens do pedido ANTES (para usar em UPDATE ou INSERT)
        let rawItems = pedido.items || pedido.itens || [];
        let items = convertItems(rawItems, String(rawId));
        
        // FALLBACK: se items está vazio mas items_json existe, tentar parsear
        if (items.length === 0 && pedido.items_json) {
          console.log(`🔄 Pedido ${rawId}: items vazio, tentando items_json...`);
          try {
            const parsed = typeof pedido.items_json === 'string' 
              ? JSON.parse(pedido.items_json) 
              : pedido.items_json;
            if (Array.isArray(parsed) && parsed.length > 0) {
              items = convertItems(parsed, String(rawId));
              console.log(`✅ Pedido ${rawId}: recuperados ${items.length} itens do items_json`);
            }
          } catch (e) {
            console.warn(`⚠️ Pedido ${rawId}: falha ao parsear items_json:`, e);
          }
        }
        
        // ✅ Remover itens duplicados baseado em hash
        const seenHashes = new Set<string>();
        const uniqueItems = items.filter(item => {
          const hash = hashItem(item);
          if (seenHashes.has(hash)) return false;
          seenHashes.add(hash);
          return true;
        });
        items = uniqueItems;

        // ✅ Se já existe, fazer UPDATE inteligente
        if (existing) {
          const existingItemsEmpty = !existing.items || !Array.isArray(existing.items) || existing.items.length === 0;
          const newItemsAvailable = items.length > 0;
          const shouldUpdateItems = existingItemsEmpty && newItemsAvailable;
          
          // ✅ Verificar se outros campos críticos estão vazios
          const existingMissingData = 
            !existing.customer_name || existing.customer_name === 'Cliente Zé' ||
            !existing.customer_phone ||
            !existing.delivery_address ||
            !existing.pickup_code;
          
          // ✅ Verificar se entregador precisa ser atualizado via courier_email
          const needsDelivererUpdate = matchedDeliverer && !existing.deliverer_id;
          
          const needsUpdate = 
            existing.status !== newDbStatus || 
            existing.delivery_type !== deliveryTypeDb ||
            shouldUpdateItems ||
            existingMissingData ||
            needsDelivererUpdate;
          
          if (needsUpdate) {
            // ✅ CORREÇÃO: Só usar deliverer_name se NÃO for um email
            // Se delivery_entregador contiver @ é email, não usar como nome
            const rawDelivererName = (pedido.delivery_entregador || pedido.deliverer_name || '').trim();
            const isDelivererNameAnEmail = rawDelivererName.includes('@');
            const delivererNameToUse = isDelivererNameAnEmail ? null : sanitizeText(rawDelivererName);
            
            const customerName = sanitizeText(pedido.customer_name || pedido.delivery_name_cliente);
            const customerPhone = sanitizeText(pedido.customer_phone || pedido.delivery_telefone);
            const customerCpf = (pedido.customer_cpf || pedido.delivery_cpf_cliente || '').replace(/\D/g, '') || null;
            const deliveryAddress = buildFullAddress(pedido);
            const pickupCode = pedido.pickup_code || pedido.delivery_codigo_entrega;
            const validPickupCode = pickupCode && pickupCode !== '0' && pickupCode !== 'N/A' ? pickupCode : null;
            
            // Construir objeto de update
            const updateData: Record<string, any> = {
              status: newDbStatus,
              delivery_type: deliveryTypeDb,
              updated_at: new Date().toISOString()
            };
            
            // ✅ Adicionar itens se estavam vazios
            if (shouldUpdateItems) {
              updateData.items = items;
              console.log(`📦 Pedido ${rawId}: atualizando ${items.length} itens`);
            }
            
            // ✅ Só atualizar deliverer_name se não for email e não tiver entregador já vinculado
            if (delivererNameToUse && !existing.deliverer_name) updateData.deliverer_name = delivererNameToUse;
            if (customerName && (!existing.customer_name || existing.customer_name === 'Cliente Zé')) {
              updateData.customer_name = customerName;
            }
            if (customerPhone && !existing.customer_phone) {
              updateData.customer_phone = customerPhone;
            }
            if (customerCpf && !existing.customer_document) {
              updateData.customer_document = customerCpf;
            }
            if (deliveryAddress && !existing.delivery_address) {
              updateData.delivery_address = deliveryAddress;
            }
            if (validPickupCode && !existing.pickup_code) {
              updateData.pickup_code = validPickupCode;
            }
            
            // ✅ Vincular entregador automaticamente via courier_email
            if (matchedDeliverer && !existing.deliverer_id) {
              updateData.deliverer_id = matchedDeliverer.id;
              updateData.deliverer_name = matchedDeliverer.name;
              console.log(`📧 Pedido ${rawId}: vinculando entregador "${matchedDeliverer.name}" via email`);
            }
            
            // Notes
            let notes = sanitizeText(pedido.notes || pedido.delivery_obs);
            if (isTurbo) notes = `TURBO - ${notes || ''}`.trim();
            if (notes) updateData.notes = notes;
            
            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Erro ao atualizar ${externalOrderId}:`, updateError);
              errors.push(`${externalOrderId}: ${updateError.message}`);
            } else {
              const changedFields = Object.keys(updateData).filter(k => k !== 'updated_at').join(', ');
              console.log(`🔄 ${externalOrderId}: atualizado [${changedFields}]`);
              updated++;
            }
          } else {
            skipped++;
          }
          continue;
        }

        // ✅ NOVO PEDIDO
        
        // Cliente (usar sanitizeText para segurança)
        const newCustomerName = sanitizeText(pedido.customer_name || pedido.delivery_name_cliente, 200) || "Cliente Zé";
        const newCustomerPhone = sanitizeText(pedido.customer_phone || pedido.delivery_telefone, 20);
        const newCustomerCpf = (pedido.customer_cpf || pedido.delivery_cpf_cliente || '').replace(/\D/g, '') || null;
        
        // Endereço
        const newDeliveryAddress = buildFullAddress(pedido);

        // Valores financeiros (usar sanitizeNumber para segurança)
        const subtotal = sanitizeNumber(pedido.subtotal ?? pedido.delivery_subtotal ?? pedido.total);
        const deliveryFee = sanitizeNumber(pedido.delivery_fee ?? pedido.delivery_frete);
        const discount = sanitizeNumber(pedido.discount ?? pedido.delivery_desconto);
        const total = sanitizeNumber(pedido.total ?? pedido.delivery_total ?? subtotal);
        const changeFor = sanitizeNumber(pedido.change_for ?? pedido.delivery_troco_para);
        // ✅ CORREÇÃO: Taxa de conveniência
        const convenienceFee = sanitizeNumber(pedido.convenience_fee ?? pedido.delivery_taxa_conveniencia);
        
        // ✅ CORREÇÃO: Número do pedido vs Código de entrega
        // order_number = número do pedido (ex: "228147196") - vem de external_id ou order_number
        // pickup_code = código de entrega (ex: "CRK 7WZ 1DJ W") - vem de delivery_code ou delivery_codigo_entrega
        const orderNumber = sanitizeText(pedido.order_number || pedido.external_id || pedido.delivery_code, 50) || String(rawId);
        const newPickupCode = pedido.pickup_code || pedido.delivery_codigo_entrega;
        const newValidPickupCode = newPickupCode && newPickupCode !== '0' && newPickupCode !== 'N/A' ? sanitizeText(newPickupCode, 10) : null;
        
        // Notas (usar sanitizeText)
        let newNotes = sanitizeText(pedido.notes || pedido.delivery_obs, 1000);
        if (isTurbo) newNotes = `TURBO - ${newNotes || ''}`.trim();
        
        // Data de criação (normalizar para ISO com timezone BRT)
        // ✅ CORREÇÃO FINAL: Integrador envia horário LOCAL (BRT) sem sufixo de timezone
        // Adicionar "-03:00" (BRT) para que PostgreSQL interprete corretamente
        let createdAt = pedido.created_at || pedido.captured_at || pedido.delivery_date_time || null;
        try {
          if (createdAt) {
            const createdAtStr = String(createdAt).trim();
            // Se já contém timezone (+00, Z, -03, etc), usar direto
            const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(createdAtStr);
            if (!hasTimezone) {
              // ✅ CORREÇÃO: Integrador envia horário local BRT (ex: "2026-02-02 17:10:21")
              // Adicionar timezone BRT (-03:00) para PostgreSQL interpretar corretamente
              // Formato: "2026-02-01 21:33:50" -> "2026-02-01T21:33:50-03:00"
              createdAt = createdAtStr.replace(' ', 'T') + '-03:00';
              console.log(`📅 Pedido ${rawId}: data BRT "${createdAtStr}" -> "${createdAt}"`);
            } else {
              // Já tem timezone - usar como está
              createdAt = createdAtStr;
            }
          } else {
            // Fallback: hora atual
            createdAt = new Date().toISOString();
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao parsear data "${createdAt}": ${e}`);
          createdAt = new Date().toISOString();
        }

        // ✅ Items já foram processados acima (variável 'items')
        // Log de alerta se vazio
        if (items.length === 0) {
          console.warn(`⚠️ Pedido ${rawId}: SEM ITENS! has_items=${pedido.has_items} items_count=${pedido.items_count}`);
        } else {
          console.log(`📦 Pedido ${rawId}: ${items.length} itens para inserir`);
        }

        // Verificar/criar cliente automaticamente
        const normalizedPhone = (newCustomerPhone || '').replace(/\D/g, '');
        let customerId: string | null = null;

        if (normalizedPhone.length >= 10) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                name: newCustomerName,
                phone: normalizedPhone,
                cpf: newCustomerCpf,
                address: newDeliveryAddress,
                neighborhood: pedido.address_neighborhood || pedido.delivery_endereco_bairro || null,
                city: (pedido.address_city || pedido.delivery_endereco_cidade_uf || '').split(' - ')[0] || null,
                state: (pedido.address_city || pedido.delivery_endereco_cidade_uf || '').split(' - ')[1] || null,
                zip_code: (pedido.address_zip || pedido.delivery_endereco_cep || '').replace(/\D/g, '') || null,
                active: true,
                total_spent: 0,
              })
              .select('id')
              .single();

            if (newCustomer) {
              customerId = newCustomer.id;
            }
          }
        }

        // Payment
        const paymentMethod = mapPaymentMethod(rawPaymentMethod);
        const paymentText = rawPaymentMethod.toLowerCase();
        const isOnlinePayment = paymentText.includes('online') || 
                                paymentText.includes('nubank') || 
                                paymentText.includes('pix');

        // ✅ Inserir novo pedido - COM employee_id padrão (necessário para triggers)
        // ✅ Vincular entregador automaticamente via courier_email se disponível
        const orderData = {
          order_number: orderNumber,
          customer_name: newCustomerName,
          customer_phone: newCustomerPhone,
          customer_document: newCustomerCpf,
          customer_id: customerId,
          delivery_address: newDeliveryAddress,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total: total,
          discount: discount,
          source: "ze-delivery",
          external_order_id: externalOrderId,
          status: newDbStatus,
          items: items,
          payment_method: paymentMethod,
          payment_breakdown: isOnlinePayment ? { online: total } : null,
          delivery_type: deliveryTypeDb,
          notes: newNotes,
          deliverer_id: matchedDeliverer ? matchedDeliverer.id : null,
          // ✅ CORREÇÃO: Só usar deliverer_name se não for email e não for exceção thales.ferraz
          deliverer_name: (() => {
            if (matchedDeliverer) return matchedDeliverer.name;
            const rawName = (pedido.delivery_entregador || pedido.deliverer_name || '').trim();
            // Se for email ou contiver thales.ferraz, deixar null
            if (rawName.includes('@') || rawName.toLowerCase().includes('thales.ferraz')) return null;
            return sanitizeText(rawName, 100);
          })(),
          pickup_code: newValidPickupCode,
          change_for: changeFor,
          created_at: createdAt,
          payment_status: "pending",
          employee_name: "Zé Delivery",
          employee_id: DEFAULT_EMPLOYEE_ID,
        };
        
        if (matchedDeliverer) {
          console.log(`📧 Novo pedido ${rawId}: vinculando entregador "${matchedDeliverer.name}" via email`);
        }

        const { error: insertError } = await supabase
          .from('orders')
          .insert(orderData);
        
        if (insertError) {
          console.error(`❌ Erro ao inserir ${externalOrderId}:`, insertError);
          errors.push(`${externalOrderId}: ${insertError.message}`);
        } else {
          console.log(`✅ Novo pedido ${externalOrderId} inserido (${newCustomerName}, R$${total}, tipo: ${deliveryTypeDb})`);
          synced++;
        }

      } catch (err: any) {
        console.error(`❌ Erro ao processar pedido:`, err);
        errors.push(`${externalOrderId}: ${err.message}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`📊 Resultado: ${synced} novos, ${updated} atualizados, ${skipped} sem alteração (${elapsed}ms)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced, 
        updated,
        skipped,
        total: pedidos.length,
        elapsed_ms: elapsed,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`💥 Erro geral (${elapsed}ms):`, error);
    return new Response(
      JSON.stringify({ error: error.message, elapsed_ms: elapsed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
