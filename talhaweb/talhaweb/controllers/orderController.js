const supabase = require('../config/supabase');
const crypto = require('crypto');
const { sendOrderConfirmationEmail } = require('../utils/sendEmail');
const xss = require('xss');

exports.createOrder = async (req, res, next) => {
  try {
    let {
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      items,
      paymentMethod,
      txnId,
      notes,
    } = req.body;

    customerName = xss(customerName?.trim());
    customerPhone = customerPhone?.trim().replace(/[-\s]/g, '');
    customerEmail = customerEmail?.trim().toLowerCase() || '';
    txnId = xss(txnId?.trim() || '');
    notes = xss(notes?.trim() || '');

    if (!customerName || !customerPhone || !shippingAddress || !items?.length || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Missing required order fields' });
    }
    if (!/^03[0-9]{9}$/.test(customerPhone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number. Use 03XXXXXXXXX format.' });
    }
    if (!['JazzCash', 'Easypaisa', 'Cash on Delivery'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.province) {
      return res.status(400).json({ success: false, message: 'Complete shipping address is required' });
    }

    // Validate items and calculate totals
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid item in order' });
      }

      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, stock, images, is_active')
        .eq('id', item.productId)
        .eq('is_active', true)
        .maybeSingle();

      if (prodErr) throw prodErr;
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found or no longer available' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} unit(s) of "${product.name}" available in stock`,
        });
      }

      // Decrement stock
      const { error: stockErr } = await supabase
        .from('products')
        .update({ stock: product.stock - quantity })
        .eq('id', product.id);
      if (stockErr) throw stockErr;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: (product.images && product.images[0]) || '',
        price: Number(product.price),
        quantity,
      });

      subtotal += Number(product.price) * quantity;
    }

    // Get delivery charge from settings
    const { data: settings } = await supabase.from('settings').select('delivery_charge').limit(1).maybeSingle();
    const deliveryCharge = settings?.delivery_charge ?? 250;
    const total = subtotal + Number(deliveryCharge);

    // Generate order number via RPC
    const { data: seq, error: seqErr } = await supabase.rpc('increment_counter', { counter_key: 'orderNumber' });
    if (seqErr) throw seqErr;
    const orderNumber = `OMN-${String(seq).padStart(6, '0')}`;

    // Generate upload token
    const uploadToken = crypto.randomBytes(24).toString('hex');

    // Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: req.user?._id || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        shipping_street: shippingAddress.street,
        shipping_city: shippingAddress.city,
        shipping_province: shippingAddress.province,
        subtotal,
        delivery_charge: deliveryCharge,
        total,
        payment_method: paymentMethod,
        txn_id: txnId,
        notes,
        upload_token: uploadToken,
      })
      .select('*')
      .single();

    if (orderErr) throw orderErr;

    // Insert order items
    const itemsToInsert = orderItems.map((item) => ({
      order_id: order.id,
      ...item,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    // Send email (fire and forget)
    if (customerEmail) {
      const emailPayload = {
        orderNumber,
        items: orderItems.map((i) => ({
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
        })),
        deliveryCharge: Number(deliveryCharge),
        total,
        paymentMethod,
        shippingAddress,
      };
      sendOrderConfirmationEmail(customerEmail, customerName, emailPayload).catch((err) =>
        console.error('Email send error:', err.message)
      );
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        _id: order.id,
        orderNumber: order.order_number,
        total: Number(order.total),
        deliveryCharge: Number(order.delivery_charge),
        paymentMethod: order.payment_method,
        orderStatus: order.order_status,
        createdAt: order.created_at,
        items: orderItems.map((i) => ({
          productName: i.product_name,
          productImage: i.product_image,
          price: i.price,
          quantity: i.quantity,
        })),
        shippingAddress,
      },
      uploadToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', req.user._id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (orders || []).map(mapOrder);
    res.json({ success: true, count: mapped.length, orders: mapped });
  } catch (error) {
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    let query = supabase
      .from('orders')
      .select('*, order_items(*), users!left(id, first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('order_status', status);
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    const { data: orders, error, count } = await query.range(from, to);
    if (error) throw error;

    const mapped = (orders || []).map((o) => {
      const m = mapOrder(o);
      if (o.users) {
        m.user = {
          _id: o.users.id,
          firstName: o.users.first_name,
          lastName: o.users.last_name,
          email: o.users.email,
        };
      }
      return m;
    });

    const total = count || 0;

    res.json({
      success: true,
      count: mapped.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      orders: mapped,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*), users!left(id, first_name, last_name, email)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role !== 'admin' && order.user_id !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const mapped = mapOrder(order);
    if (order.users) {
      mapped.user = {
        _id: order.users.id,
        firstName: order.users.first_name,
        lastName: order.users.last_name,
        email: order.users.email,
      };
    }

    res.json({ success: true, order: mapped });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({ order_status: orderStatus })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, message: `Order status updated to ${orderStatus}`, order: mapOrder(order) });
  } catch (error) {
    next(error);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Failed'];

    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, message: `Payment status updated to ${paymentStatus}`, order: mapOrder(order) });
  } catch (error) {
    next(error);
  }
};

// Helper: map Supabase order row to API response format
function mapOrder(o) {
  if (!o) return null;
  const items = (o.order_items || []).map((i) => ({
    product: i.product_id,
    productName: i.product_name,
    productImage: i.product_image,
    price: Number(i.price),
    quantity: i.quantity,
  }));

  return {
    _id: o.id,
    orderNumber: o.order_number,
    user: o.user_id,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerEmail: o.customer_email,
    shippingAddress: {
      street: o.shipping_street,
      city: o.shipping_city,
      province: o.shipping_province,
    },
    items,
    subtotal: Number(o.subtotal),
    deliveryCharge: Number(o.delivery_charge),
    total: Number(o.total),
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    screenshotUrl: o.screenshot_url,
    orderStatus: o.order_status,
    txnId: o.txn_id,
    notes: o.notes,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}