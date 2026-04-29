const supabase = require('../config/supabase');

// @route  GET /api/settings
// @access Public
exports.getSettings = async (req, res, next) => {
  try {
    let { data: settings, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (error) throw error;

    if (!settings) {
      // Create default settings on first access
      const { data: created, error: createErr } = await supabase
        .from('settings')
        .insert({})
        .select('*')
        .single();
      if (createErr) throw createErr;
      settings = created;
    }

    res.json({
      success: true,
      settings: mapSettings(settings),
    });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/settings
// @access Admin
exports.updateSettings = async (req, res, next) => {
  try {
    const allowedMap = {
      storeName: 'store_name',
      storeEmail: 'store_email',
      whatsappNumber: 'whatsapp_number',
      jazzCashNumber: 'jazzcash_number',
      easypaisaNumber: 'easypaisa_number',
      deliveryCharge: 'delivery_charge',
      freeShippingAbove: 'free_shipping_above',
      deliveryDays: 'delivery_days',
      taxPercent: 'tax_percent',
      maintenanceMode: 'maintenance_mode',
    };

    const updates = {};
    Object.entries(allowedMap).forEach(([camel, snake]) => {
      if (req.body[camel] !== undefined) updates[snake] = req.body[camel];
    });

    let { data: settings, error } = await supabase.from('settings').select('id').limit(1).maybeSingle();
    if (error) throw error;

    if (!settings) {
      const { data: created, error: createErr } = await supabase
        .from('settings')
        .insert(updates)
        .select('*')
        .single();
      if (createErr) throw createErr;
      settings = created;
    } else {
      const { data: updated, error: upErr } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', settings.id)
        .select('*')
        .single();
      if (upErr) throw upErr;
      settings = updated;
    }

    res.json({ success: true, message: 'Settings updated successfully', settings: mapSettings(settings) });
  } catch (error) {
    next(error);
  }
};

function mapSettings(s) {
  if (!s) return null;
  return {
    _id: s.id,
    storeName: s.store_name,
    storeEmail: s.store_email,
    whatsappNumber: s.whatsapp_number,
    jazzCashNumber: s.jazzcash_number,
    easypaisaNumber: s.easypaisa_number,
    deliveryCharge: Number(s.delivery_charge),
    freeShippingAbove: Number(s.free_shipping_above),
    deliveryDays: s.delivery_days,
    taxPercent: Number(s.tax_percent),
    maintenanceMode: s.maintenance_mode,
  };
}
