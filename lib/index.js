const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const {post} = require("axios");

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

function tokenIntrospector(baseUrl, realm, clientId, clientSecret) {

  return async function introspectToken(req, res, next) {
    const introspectUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/token/introspect`;
    try {
      const body = new URLSearchParams({
        token: req.token,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const response = await post(introspectUrl, body, {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      });
      req.tokenInfo = response.data;
    } catch (err) {
      console.error('Introspection error', err.message);
      return res.status(500).json({error: 'Token introspection failed'});
    }

    if (!req.tokenInfo.active) {
      return res.status(401).json({error: 'Token is not active'});
    }

    next();
  }
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

module.exports = {tokenVerifier, tokenIntrospector};
