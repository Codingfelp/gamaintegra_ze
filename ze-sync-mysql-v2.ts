import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ✅ MAPEAMENTO CORRIGIDO: Zé Delivery -> status interno
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
  
  const paymentLower = (paymentMethod || '').toLowerCase().trim();
  const isOnlinePayment = 
    paymentLower.includes('online') ||
    paymentLower.includes('online nubank') ||
    paymentLower.includes('online pix') ||
    paymentLower === 'nubank';
  
  switch (numStatus) {
    case 0: return "pending";
    case 2: return "preparing";
    case 3: return isPickup ? "preparing" : "shipped";
    case 1: return isOnlinePayment ? "closed" : "awaiting_closure";
    case 4:
    case 5: return isOnlinePayment ? "closed" : "awaiting_closure";
    case 6: return "awaiting_closure";
    default: return "pending";
  }
};

const mapPaymentMethod = (method: string | undefined): string => {
  if (!method) return 'online';
  const m = method.toLowerCase();
  if (m.includes('dinheiro')) return 'dinheiro';
  if (m.includes('cartão') || m.includes('cartao') || m.includes('crédito') || m.includes('débito')) return 'cartao';
  if (m.includes('pix')) return 'pix';
  return 'online';
};

const mapZeDeliveryType = (deliveryType: string | undefined | null): { deliveryTypeDb: string, isTurbo: boolean, isPickup: boolean } => {
  if (!deliveryType) return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
  
  const lower = deliveryType.toLowerCase().trim();
  
  if (lower.includes('retirada') || lower.includes('pickup') || lower === 'retirada') {
    return { deliveryTypeDb: 'pickup', isTurbo: false, isPickup: true };
  }
  
  if (lower.includes('turbo')) {
    return { deliveryTypeDb: 'delivery', isTurbo: true, isPickup: false };
  }
  
  return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
};

const convertItems = (zeItems: any[], orderId: string): any[] => {
  if (!zeItems || !Array.isArray(zeItems) || zeItems.length === 0) {
    return [];
  }
  
  return zeItems.map((item, idx) => {
    const itemName = item.nome || item.item_nome || item.name || item.product_name || item.productName || 'Produto';
    const quantity = parseInt(String(item.quantidade || item.item_quantidade || item.quantity || '1'), 10) || 1;
    const unitPrice = parseFloat(String(item.preco_unitario || item.item_preco || item.unit_price || item.unitPrice || item.price || '0')) || 0;
    const totalPrice = parseFloat(String(item.preco_total || item.item_valor || item.total_price || item.totalPrice || String(quantity * unitPrice))) || 0;
    const imageUrl = item.imagem || item.image_url || item.image || null;
    
    return {
      id: `ze-item-${orderId}-${idx}`,
      productId: null,
      product_id: null,
      productName: itemName,
      product_name: itemName,
      original_name: itemName,
      nome: itemName,
      quantity: quantity,
      unitPrice: unitPrice,
      unit_price: unitPrice,
      totalPrice: totalPrice,
      total_price: totalPrice,
      notes: item.observacao || item.notes || null,
      image_url: imageUrl,
      zeCode: item.codigo_ze || item.zeCode || null,
    };
  });
};

const buildFullAddress = (pedido: any): string | null => {
  const deliveryType = pedido.delivery_type || pedido.delivery_tipo_pedido || '';
  if (deliveryType.toLowerCase().includes('retirada')) {
    return null;
  }
  
  if (pedido.address && pedido.address !== '0') {
    return pedido.address;
  }
  
  const isValid = (val: any) => val && val !== '0' && val !== 'N/A';
  
  const parts = [
    isValid(pedido.delivery_endereco_rota) ? pedido.delivery_endereco_rota : null,
    isValid(pedido.address_complement) ? pedido.address_complement : 
      isValid(pedido.delivery_endereco_complemento) ? pedido.delivery_endereco_complemento : null,
    isValid(pedido.address_neighborhood) ? pedido.address_neighborhood : pedido.delivery_endereco_bairro,
    isValid(pedido.address_city) ? pedido.address_city : pedido.delivery_endereco_cidade_uf,
    isValid(pedido.address_zip) ? `CEP: ${pedido.address_zip}` : 
      isValid(pedido.delivery_endereco_cep) ? `CEP: ${pedido.delivery_endereco_cep}` : null,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(', ') : null;
};

const sanitizeText = (text: string | null | undefined, maxLength: number = 500): string | null => {
  if (!text || text === '0' || text === 'N/A') return null;
  return String(text).substring(0, maxLength).trim() || null;
};

const sanitizeNumber = (value: any, defaultVal: number = 0): number => {
  const num = parseFloat(String(value || defaultVal));
  return isNaN(num) || num < 0 ? defaultVal : num;
};

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
    console.log('🍺 ze-sync-mysql: Recebendo webhook...');

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
    
    if (!pedidos || !Array.isArray(pedidos)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: expected { pedidos: [...] }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pedidosToProcess = pedidos.slice(0, 500);
    console.log(`📦 Processando ${pedidosToProcess.length} pedidos`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const DEFAULT_EMPLOYEE_ID = Deno.env.get('ZE_DELIVERY_EMPLOYEE_ID')!;
    
    if (!DEFAULT_EMPLOYEE_ID) {
      console.error('❌ ZE_DELIVERY_EMPLOYEE_ID não configurado!');
      return new Response(
        JSON.stringify({ error: 'ZE_DELIVERY_EMPLOYEE_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: allDeliverers } = await supabase
      .from('deliverers')
      .select('id, name, email_ze')
      .eq('active', true);
    
    const emailToDelivererMap = new Map<string, { id: string, name: string }>();
    if (allDeliverers) {
      for (const deliverer of allDeliverers) {
        if (deliverer.email_ze) {
          const emails = deliverer.email_ze.split(',').map((e: string) => e.trim().toLowerCase());
          for (const email of emails) {
            if (email) {
              emailToDelivererMap.set(email, { id: deliverer.id, name: deliverer.name });
            }
          }
        }
      }
    }

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const pedido of pedidosToProcess) {
      const rawId = pedido.id_local || pedido.external_id || pedido.ide || pedido.delivery_id;
      
      if (!rawId) {
        errors.push('Pedido sem ID válido');
        continue;
      }
      
      const externalOrderId = `ze-${rawId}`;
      
      try {
        const deliveryTypeRaw = pedido.delivery_tipo_pedido || pedido.delivery_type || '';
        const { deliveryTypeDb, isTurbo, isPickup } = mapZeDeliveryType(deliveryTypeRaw);
        
        const { data: existing, error: checkError } = await supabase
          .from('orders')
          .select('id, status, delivery_type, items, customer_name, customer_phone, customer_document, delivery_address, pickup_code, deliverer_id, deliverer_name')
          .eq('external_order_id', externalOrderId)
          .maybeSingle();

        const courierEmail = (pedido.courier_email || pedido.delivery_entregador_email || '').toLowerCase().trim();
        const deliveryEntregador = (pedido.delivery_entregador || pedido.deliverer_name || '').toLowerCase().trim();
        const possibleEmails = [courierEmail, deliveryEntregador].filter(e => e && e.includes('@'));
        
        let matchedDeliverer: { id: string, name: string } | null = null;
        
        for (const email of possibleEmails) {
          if (email.includes('thales.ferraz')) continue;
          if (emailToDelivererMap.has(email)) {
            matchedDeliverer = emailToDelivererMap.get(email)!;
            break;
          }
        }

        if (checkError) {
          errors.push(`${externalOrderId}: ${checkError.message}`);
          continue;
        }

        const rawStatus = pedido.status ?? pedido.delivery_status ?? pedido.status_text ?? 0;
        const rawPaymentMethod = pedido.payment_method || pedido.delivery_forma_pagamento || '';
        const newDbStatus = mapZeStatusToDbStatus(rawStatus, rawPaymentMethod, isPickup);

        let rawItems = pedido.items || pedido.itens || [];
        let items = convertItems(rawItems, String(rawId));
        
        if (items.length === 0 && pedido.items_json) {
          try {
            const parsed = typeof pedido.items_json === 'string' 
              ? JSON.parse(pedido.items_json) 
              : pedido.items_json;
            if (Array.isArray(parsed) && parsed.length > 0) {
              items = convertItems(parsed, String(rawId));
            }
          } catch (e) {}
        }
        
        const seenHashes = new Set<string>();
        items = items.filter(item => {
          const hash = hashItem(item);
          if (seenHashes.has(hash)) return false;
          seenHashes.add(hash);
          return true;
        });

        // ✅ Se já existe, fazer UPDATE
        if (existing) {
          const existingItemsEmpty = !existing.items || !Array.isArray(existing.items) || existing.items.length === 0;
          const shouldUpdateItems = existingItemsEmpty && items.length > 0;
          
          const existingMissingData = 
            !existing.customer_name || existing.customer_name === 'Cliente Zé' ||
            !existing.customer_phone ||
            !existing.delivery_address ||
            !existing.pickup_code;
          
          const needsDelivererUpdate = matchedDeliverer && !existing.deliverer_id;
          
          const incomingDeliveryFee = sanitizeNumber(pedido.delivery_fee ?? pedido.delivery_frete);
          const incomingDiscount = sanitizeNumber(pedido.discount ?? pedido.delivery_desconto);
          const incomingConvenienceFee = sanitizeNumber(pedido.convenience_fee ?? pedido.delivery_taxa_conveniencia);
          
          const needsUpdate = 
            existing.status !== newDbStatus || 
            existing.delivery_type !== deliveryTypeDb ||
            shouldUpdateItems ||
            existingMissingData ||
            needsDelivererUpdate ||
            incomingDeliveryFee > 0 ||
            incomingDiscount > 0 ||
            incomingConvenienceFee > 0;
          
          if (needsUpdate) {
            const rawDelivererName = (pedido.delivery_entregador || pedido.deliverer_name || '').trim();
            const delivererNameToUse = rawDelivererName.includes('@') ? null : sanitizeText(rawDelivererName);
            
            const customerName = sanitizeText(pedido.customer_name || pedido.delivery_name_cliente);
            const customerPhone = sanitizeText(pedido.customer_phone || pedido.delivery_telefone);
            const customerCpf = (pedido.customer_cpf || pedido.delivery_cpf_cliente || '').replace(/\D/g, '') || null;
            const deliveryAddress = buildFullAddress(pedido);
            const pickupCode = pedido.pickup_code || pedido.delivery_codigo_entrega;
            const validPickupCode = pickupCode && pickupCode !== '0' && pickupCode !== 'N/A' ? pickupCode : null;
            
            const updateData: Record<string, any> = {
              status: newDbStatus,
              delivery_type: deliveryTypeDb,
              updated_at: new Date().toISOString()
            };
            
            if (incomingDeliveryFee > 0) updateData.delivery_fee = incomingDeliveryFee;
            if (incomingDiscount > 0) updateData.discount = incomingDiscount;
            if (incomingConvenienceFee > 0) updateData.convenience_fee = incomingConvenienceFee;
            if (shouldUpdateItems) updateData.items = items;
            if (delivererNameToUse && !existing.deliverer_name) updateData.deliverer_name = delivererNameToUse;
            if (customerName && (!existing.customer_name || existing.customer_name === 'Cliente Zé')) updateData.customer_name = customerName;
            if (customerPhone && !existing.customer_phone) updateData.customer_phone = customerPhone;
            if (customerCpf && !existing.customer_document) updateData.customer_document = customerCpf;
            if (deliveryAddress && !existing.delivery_address) updateData.delivery_address = deliveryAddress;
            if (validPickupCode && !existing.pickup_code) updateData.pickup_code = validPickupCode;
            
            if (matchedDeliverer && !existing.deliverer_id) {
              updateData.deliverer_id = matchedDeliverer.id;
              updateData.deliverer_name = matchedDeliverer.name;
            }
            
            let notes = sanitizeText(pedido.notes || pedido.delivery_obs);
            if (isTurbo) notes = `TURBO - ${notes || ''}`.trim();
            if (notes) updateData.notes = notes;
            
            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', existing.id);
            
            if (updateError) {
              errors.push(`${externalOrderId}: ${updateError.message}`);
            } else {
              updated++;
            }
          } else {
            skipped++;
          }
          continue;
        }

        // ✅ NOVO PEDIDO
        const newCustomerName = sanitizeText(pedido.customer_name || pedido.delivery_name_cliente, 200) || "Cliente Zé";
        const newCustomerPhone = sanitizeText(pedido.customer_phone || pedido.delivery_telefone, 20);
        const newCustomerCpf = (pedido.customer_cpf || pedido.delivery_cpf_cliente || '').replace(/\D/g, '') || null;
        const newDeliveryAddress = buildFullAddress(pedido);

        const subtotal = sanitizeNumber(pedido.subtotal ?? pedido.delivery_subtotal ?? pedido.total);
        const deliveryFee = sanitizeNumber(pedido.delivery_fee ?? pedido.delivery_frete);
        const discount = sanitizeNumber(pedido.discount ?? pedido.delivery_desconto);
        const convenienceFee = sanitizeNumber(pedido.convenience_fee ?? pedido.delivery_taxa_conveniencia);
        const total = sanitizeNumber(pedido.total ?? pedido.delivery_total ?? subtotal);
        const changeFor = sanitizeNumber(pedido.change_for ?? pedido.delivery_troco_para);
        
        // ✅ CORREÇÃO: order_number usa order_number ou external_id, NÃO delivery_code
        // order_number = número do pedido (ex: "160428", "228147196")
        // pickup_code = código de entrega (ex: "YAA NAG INK A", "CRK 7WZ 1DJ W")
        const orderNumber = sanitizeText(pedido.order_number || pedido.external_id, 50) || String(rawId);
        const newPickupCode = pedido.pickup_code || pedido.delivery_codigo_entrega || pedido.delivery_code;
        const newValidPickupCode = newPickupCode && newPickupCode !== '0' && newPickupCode !== 'N/A' ? sanitizeText(newPickupCode, 20) : null;
        
        let newNotes = sanitizeText(pedido.notes || pedido.delivery_obs, 1000);
        if (isTurbo) newNotes = `TURBO - ${newNotes || ''}`.trim();
        
        let createdAt = pedido.created_at || pedido.captured_at || pedido.delivery_date_time || null;
        try {
          if (createdAt) {
            const createdAtStr = String(createdAt).trim();
            const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(createdAtStr);
            if (!hasTimezone) {
              createdAt = createdAtStr.replace(' ', 'T') + '-03:00';
            }
          } else {
            createdAt = new Date().toISOString();
          }
        } catch (e) {
          createdAt = new Date().toISOString();
        }

        // Buscar/criar cliente
        const normalizedPhone = (newCustomerPhone || '').replace(/\D/g, '');
        let customerId: string | null = null;
        let existingCustomer = null;
        
        if (normalizedPhone.length >= 10) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', normalizedPhone)
            .maybeSingle();
          existingCustomer = data;
        }
        
        if (!existingCustomer && newCustomerCpf && newCustomerCpf.length >= 11) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('cpf', newCustomerCpf)
            .maybeSingle();
          existingCustomer = data;
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }

        const paymentMethod = mapPaymentMethod(rawPaymentMethod);
        const paymentText = rawPaymentMethod.toLowerCase();
        const isOnlinePayment = paymentText.includes('online') || 
                                paymentText.includes('nubank') || 
                                paymentText.includes('pix');

        const orderData = {
          order_number: orderNumber,
          customer_name: newCustomerName,
          customer_phone: newCustomerPhone,
          customer_document: newCustomerCpf,
          customer_id: customerId,
          delivery_address: newDeliveryAddress,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          convenience_fee: convenienceFee,
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
          deliverer_name: (() => {
            if (matchedDeliverer) return matchedDeliverer.name;
            const rawName = (pedido.delivery_entregador || pedido.deliverer_name || '').trim();
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

        const { error: insertError } = await supabase
          .from('orders')
          .insert(orderData);
        
        if (insertError) {
          console.error(`❌ Erro ao inserir ${externalOrderId}:`, insertError);
          errors.push(`${externalOrderId}: ${insertError.message}`);
        } else {
          console.log(`✅ Novo pedido ${externalOrderId} inserido`);
          synced++;
        }

      } catch (err: any) {
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
