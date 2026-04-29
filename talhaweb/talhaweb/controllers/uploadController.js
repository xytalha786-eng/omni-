const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const streamifier = require('streamifier');

const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `omni/${folder}`,
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

exports.uploadPaymentScreenshot = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { uploadToken } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (!uploadToken) {
      return res.status(400).json({ success: false, message: 'Upload token is required' });
    }

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('id, order_number, upload_token, screenshot_public_id')
      .eq('id', orderId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.upload_token !== uploadToken) {
      return res.status(403).json({ success: false, message: 'Invalid upload token' });
    }

    if (order.screenshot_public_id) {
      await cloudinary.uploader.destroy(order.screenshot_public_id).catch(() => {});
    }

    const result = await uploadToCloudinary(req.file.buffer, 'payment-screenshots', {
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });

    const { error: upErr } = await supabase
      .from('orders')
      .update({
        screenshot_url: result.secure_url,
        screenshot_public_id: result.public_id,
      })
      .eq('id', orderId);

    if (upErr) throw upErr;

    res.json({
      success: true,
      message: 'Payment screenshot uploaded successfully',
      screenshotUrl: result.secure_url,
      orderId: order.id,
      orderNumber: order.order_number,
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'products', {
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    next(error);
  }
};