import logger from "../utils/logger.js";

import CartApi from "../services/cartService.js";
const cart = new CartApi();

class AuthController {
    constructor() {}

    async getSignup(req, res) {
        try {
            res.render("pages/signup");
        } catch (error) {
            logger.warn(error);
        }
    }

    async getLogin(req, res) {
        try {
            res.render("pages/login");
        } catch (error) {
            logger.warn(error);
        }
    }

    async getFailSignup(req, res) {
        try {
            res.render("pages/failSignup");
        } catch (error) {
            logger.warn(error);
        }
    }
    async getFailLogin(req, res) {
        try {
            res.render("pages/failLogin");
        } catch (error) {
            logger.warn(error);
        }
    }
    async postLogout(req, res) {
        try {
            await cart.deleteByUserId(req.body.userId);
            let nameUser = req.user.userName;
            req.logout();
            res.render("pages/logout", { nameUser });
        } catch (error) {
            logger.warn(error);
        }
    }
}

export default AuthController;
