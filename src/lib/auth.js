import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const getJwtOptions = () => ({
  algorithms: ['HS256'],
  issuer: process.env.JWT_ISSUER || undefined,
  audience: process.env.JWT_AUDIENCE || undefined,
});

export const signToken = (userId) => {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: '7d',
    ...getJwtOptions(),
    subject: String(userId),
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret(), getJwtOptions());
  } catch (error) {
    return null;
  }
};

export const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};