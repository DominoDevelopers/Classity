const { verify } = require('./util');
const User = require('../models/User').User;

/**
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @description middleware to check token and protect private routes
 */
const auth = async (req, res, next) => {
    try {
        verify(req);

        const user = await User.findById(req.user.id).select('_id');

        if (!user) {
            return res.status(401).json({ errors: [{ msg: 'Invalid token' }] });
        }

        next();
    } catch (err) {
        if (err.kind === 'NotAuthorized') {
            return res.status(401).json({ errors: [{ msg: err.message }] });
        }
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ errors: [{ msg: 'Invalid data' }] });
        }

        console.error(err.message);
        return res.status(500).json({ errors: [{ msg: 'Server Error' }] });
    }
};

module.exports = auth;
