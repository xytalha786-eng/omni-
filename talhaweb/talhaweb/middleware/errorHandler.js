const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Supabase / PostgreSQL duplicate key error
  if (err.code === '23505') {
    const detail = err.details || err.message || '';
    const match = detail.match(/Key \((\w+)\)/);
    const field = match ? match[1] : 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    statusCode = 400;
  }

  // Supabase / PostgreSQL foreign key violation
  if (err.code === '23503') {
    message = 'Referenced resource not found';
    statusCode = 400;
  }

  // Supabase / PostgreSQL check constraint violation
  if (err.code === '23514') {
    message = 'Invalid value provided';
    statusCode = 400;
  }

  // Supabase not found (PGRST116)
  if (err.code === 'PGRST116') {
    message = 'Resource not found';
    statusCode = 404;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Your session has expired. Please log in again.';
    statusCode = 401;
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File too large. Maximum size is 5MB.';
    statusCode = 400;
  }

  console.error(`[${new Date().toISOString()}] ${statusCode} — ${message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
