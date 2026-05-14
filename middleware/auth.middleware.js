const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      name: decoded.name
    };

    next();
  } catch (err) {
    return res.status(403).json({
      message: 'Invalid token'
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied for role: ${req.user.role}`
      });
    }

    next();
  };
};

// CRM Hierarchy Permission Helper
const roleHierarchy = {
  owner: 5,
  sales_head: 4,
  manager: 3,
  inside_sales: 2,
  employee: 1
};

const hasHigherAccess = (currentRole, targetRole) => {
  return roleHierarchy[currentRole] > roleHierarchy[targetRole];
};

module.exports = {
  verifyToken,
  authorizeRoles,
  hasHigherAccess,
  roleHierarchy
};