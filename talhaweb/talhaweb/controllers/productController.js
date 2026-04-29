const supabase = require('../config/supabase');
const cloudinary = require('../config/cloudinary');
const xss = require('xss');

exports.getProducts = async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, rating, sort, page = 1, limit = 12, all } = req.query;

    let query = supabase
      .from('products')
      .select('*, categories!inner(id, name, icon, slug)', { count: 'exact' })
      .eq('is_active', true);

    if (category && category !== 'all') {
      query = query.eq('categories.slug', category);
    }

    if (minPrice) query = query.gte('price', Number(minPrice));
    if (maxPrice) query = query.lte('price', Number(maxPrice));
    if (rating) query = query.gte('rating', Number(rating));

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sorting
    if (sort === 'price-low') query = query.order('price', { ascending: true });
    else if (sort === 'price-high') query = query.order('price', { ascending: false });
    else if (sort === 'rating') query = query.order('rating', { ascending: false });
    else if (sort === 'discount') query = query.order('original_price', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    if (all === 'true') {
      const { data: products, error } = await query;
      if (error) throw error;

      const mapped = (products || []).map(mapProduct);
      return res.json({ success: true, count: mapped.length, products: mapped });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    const { data: products, error, count } = await query.range(from, to);
    if (error) throw error;

    const mapped = (products || []).map(mapProduct);
    const total = count || 0;

    res.json({
      success: true,
      count: mapped.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products: mapped,
    });
  } catch (error) {
    next(error);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, categories(id, name, icon, slug)')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    let { name, description, categoryId, price, originalPrice, stock, badge } = req.body;

    name = xss(name?.trim());
    description = xss((description || '').toString().trim());
    badge = xss((badge || '').toString().trim());

    if (!name || !categoryId || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, and price are required' });
    }

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Invalid price' });
    }

    const parsedOriginalPrice = originalPrice !== undefined ? Number(originalPrice) : parsedPrice;
    if (Number.isNaN(parsedOriginalPrice) || parsedOriginalPrice < 0) {
      return res.status(400).json({ success: false, message: 'Invalid original price' });
    }

    const parsedStock = stock !== undefined ? Number(stock) : 0;
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ success: false, message: 'Invalid stock value' });
    }

    // Verify category exists
    const { data: cat, error: catErr } = await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle();
    if (catErr) throw catErr;
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name,
        description,
        category_id: categoryId,
        price: parsedPrice,
        original_price: parsedOriginalPrice,
        stock: parsedStock,
        badge: badge || null,
        created_by: req.user._id,
      })
      .select('*, categories(id, name, icon, slug)')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Product created successfully', product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const { name, description, categoryId, price, originalPrice, stock, badge, isActive } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Invalid product name' });
      }
      updates.name = xss(name.trim());
    }

    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid description' });
      }
      updates.description = xss(description.trim());
    }

    if (badge !== undefined) {
      if (typeof badge !== 'string' && badge !== null) {
        return res.status(400).json({ success: false, message: 'Invalid badge value' });
      }
      updates.badge = badge ? xss(badge.trim()) : null;
    }

    if (price !== undefined) {
      const parsed = Number(price);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, message: 'Invalid price' });
      }
      updates.price = parsed;
    }

    if (originalPrice !== undefined) {
      const parsed = Number(originalPrice);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, message: 'Invalid original price' });
      }
      updates.original_price = parsed;
    }

    if (stock !== undefined) {
      const parsed = Number(stock);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, message: 'Invalid stock' });
      }
      updates.stock = parsed;
    }

    if (isActive !== undefined) {
      if (![true, false, 'true', 'false'].includes(isActive)) {
        return res.status(400).json({ success: false, message: 'Invalid isActive value' });
      }
      updates.is_active = isActive === true || isActive === 'true';
    }

    if (categoryId) {
      const { data: cat } = await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle();
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
      updates.category_id = categoryId;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, categories(id, name, icon, slug)')
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'Product updated successfully', product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product removed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.uploadProductImage = async (req, res, next) => {
  try {
    const { data: product, error: findErr } = await supabase
      .from('products')
      .select('id, images')
      .eq('id', req.params.id)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const streamifier = require('streamifier');
    const uploadFromBuffer = (buffer) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'omni/products',
            transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });

    const result = await uploadFromBuffer(req.file.buffer);

    const currentImages = product.images || [];
    currentImages.push(result.secure_url);

    const { data: updated, error } = await supabase
      .from('products')
      .update({ images: currentImages })
      .eq('id', req.params.id)
      .select('*, categories(id, name, icon, slug)')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url,
      product: mapProduct(updated),
    });
  } catch (error) {
    next(error);
  }
};

// Helper: map Supabase product row to API response format
function mapProduct(p) {
  if (!p) return null;
  const cat = p.categories || null;
  const discountPercent = p.original_price && p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100)
    : 0;

  return {
    _id: p.id,
    name: p.name,
    description: p.description,
    category: cat ? { _id: cat.id, name: cat.name, icon: cat.icon, slug: cat.slug } : null,
    price: Number(p.price),
    originalPrice: Number(p.original_price),
    stock: p.stock,
    images: p.images || [],
    badge: p.badge,
    rating: Number(p.rating),
    reviewCount: p.review_count,
    isActive: p.is_active,
    createdBy: p.created_by,
    discountPercent,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}