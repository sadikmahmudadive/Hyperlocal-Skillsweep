import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const optionalString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getJwtClaimsOptions = () => {
  const issuer = optionalString(process.env.JWT_ISSUER);
  const audience = optionalString(process.env.JWT_AUDIENCE);
  const claims = {};
  if (issuer) claims.issuer = issuer;
  if (audience) claims.audience = audience;
  return claims;
};

const getJwtSignOptions = () => ({
  algorithm: 'HS256',
  ...getJwtClaimsOptions(),
});

const getJwtVerifyOptions = () => ({
  algorithms: ['HS256'],
  ...getJwtClaimsOptions(),
});

export const signToken = (userId) => {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: '7d',
    ...getJwtSignOptions(),
    subject: String(userId),
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret(), getJwtVerifyOptions());
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