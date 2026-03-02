const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

function verify(token, client) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        client.getSigningKey(header.kid, (err, key) => {
          if (err) {
            return callback(err);
          }
          callback(null, key.getPublicKey());
        });
      },
      {
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          return reject(err);
        }
        resolve(decoded);
      }
    );
  });
}

function tokenVerifier(jwksUri, scope) {
  const client = jwksClient({jwksUri, cache: true, rateLimit: true});

  return async function validateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({error: 'Missing Bearer token'});
    }

    try {
      const decoded = await verify(token, client);
      req.token = token;
      req.tokenInfo = {...decoded, active: true};

      if (scope && !decoded.scope.includes(scope)) {
        return res.status(403).json({error: `Token does not contain scope: ${scope}`});
      }

      next();
    } catch (err) {
      return res.status(401).json({error: `Invalid token: ${err.message}`});
    }
  }
}

module.exports = {tokenVerifier};
