function tokenVerifier() {
  return function validateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({error: 'Missing Bearer token'});
    }

    next();
  }
}

module.exports = {tokenVerifier};
