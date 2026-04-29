const supabase = require('../config/supabase');
const xss = require('xss');

exports.getStats = async (req, res, next) => {
  try {
    // Get total orders
    const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });

    // Get total verified users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('is_verified', true);

    // Get total active products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total revenue from confirmed orders
    const { data: revenueRows } = await supabase
      .from('orders')
      .select('total')
      .eq('payment_status', 'Confirmed');
    const totalRevenue = (revenueRows || []).reduce((sum, r) => sum + Number(r.total), 0);

    // Get pending orders count
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('order_status', ['Pending', 'Processing']);

    // Get recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*, users!left(id, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(5);

    const mappedRecent = (recentOrders || []).map((o) => ({
      _id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      total: Number(o.total),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      orderStatus: o.order_status,
      screenshotUrl: o.screenshot_url,
      createdAt: o.created_at,
      user: o.users ? { firstName: o.users.first_name, lastName: o.users.last_name } : null,
    }));

    res.json({
      success: true,
      stats: {
        totalOrders: totalOrders || 0,
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        totalRevenue,
        pendingOrders: pendingOrders || 0,
      },
      recentOrders: mappedRecent,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    let query = supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, role, is_verified, created_at', { count: 'exact' })
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    const { data: users, error, count } = await query.range(from, to);
    if (error) throw error;

    // Get order counts for each user
    const userIds = (users || []).map((u) => u.id);
    let orderMap = {};

    if (userIds.length) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('user_id, total')
        .in('user_id', userIds);

      (orderData || []).forEach((o) => {
        if (!orderMap[o.user_id]) orderMap[o.user_id] = { count: 0, spent: 0 };
        orderMap[o.user_id].count++;
        orderMap[o.user_id].spent += Number(o.total);
      });
    }

    const enrichedUsers = (users || []).map((u) => ({
      _id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isVerified: u.is_verified,
      createdAt: u.created_at,
      orderCount: orderMap[u.id]?.count || 0,
      totalSpent: orderMap[u.id]?.spent || 0,
    }));

    res.json({ success: true, count: enrichedUsers.length, total: count || 0, users: enrichedUsers });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    if (req.params.id === req.user._id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, first_name, last_name, email, phone, role')
      .single();

    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    // Get product counts per category
    const catIds = (categories || []).map((c) => c.id);
    let countMap = {};

    if (catIds.length) {
      const { data: prodCounts } = await supabase
        .from('products')
        .select('category_id')
        .eq('is_active', true)
        .in('category_id', catIds);

      (prodCounts || []).forEach((p) => {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });
    }

    const enriched = (categories || []).map((c) => ({
      _id: c.id,
      name: c.name,
      icon: c.icon,
      slug: c.slug,
      isActive: c.is_active,
      productCount: countMap[c.id] || 0,
      createdAt: c.created_at,
    }));

    res.json({ success: true, categories: enriched });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const cleanName = xss(name.trim());
    const slug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: cleanName,
        icon: typeof icon === 'string' && icon.trim() ? icon.trim() : '📦',
        slug,
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Category created',
      category: { _id: category.id, name: category.name, icon: category.icon, slug: category.slug },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const updates = {};
    const { name, icon } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Category name must be a non-empty string' });
      }
      updates.name = xss(name.trim());
      updates.slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    if (icon !== undefined) {
      if (typeof icon !== 'string') {
        return res.status(400).json({ success: false, message: 'Category icon must be a string' });
      }
      updates.icon = icon.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
    }

    const { data: category, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    res.json({
      success: true,
      message: 'Category updated',
      category: { _id: category.id, name: category.name, icon: category.icon, slug: category.slug },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    // Check for active products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', req.params.id)
      .eq('is_active', true);

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} active product(s). Move or delete products first.`,
      });
    }

    const { data: category, error } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error) throw error;
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};