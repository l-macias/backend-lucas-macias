//Imports
import express from "express";
import cluster from "cluster";
import { cpus } from "os";
const numCPUs = cpus().length;
import "dotenv/config";
import config from "./src/configs/config.js";
import cors from "cors";
import parseArg from "minimist";
import logger from "./src/utils/logger.js";
import session from "express-session";
import _yargs from "yargs";
import { hideBin } from "yargs/helpers";
const advancedOptions = { useNewUrlParser: true, useUnifiedTopology: true };
import passport from "passport";
import MongoStore from "connect-mongo";
import authorize from "./src/utils/authorize.js";

import ChatApi from "./src/services/chatService.js";
const chat = new ChatApi();

//Rutas
import sessionRoutes from "./src/routes/auth.routes.js";
import homeRoutes from "./src/routes/home.routes.js";
import productsRoutes from "./src/routes/product.routes.js";
import cartRoutes from "./src/routes/cart.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import orderRoutes from "./src/routes/order.routes.js";

//Configuración del servidor y parseo de argumentos
const yargs = _yargs(hideBin(process.argv));
const argv = await yargs
    .default({ PORT: parseInt(process.argv[2]) || 8080 }, { SERVER: "FORK" })
    .alias({
        p: "PORT",
        s: "SERVER",
    }).argv;
const PORT = argv.PORT || process.env.PORT || process.argv[2] || 8080;
const SERVER = argv.SERVER || process.argv[3];

//Socket.io
import http from "http";
import { Server } from "socket.io";

if (cluster.isPrimary && SERVER === "CLUSTER") {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on("exit", (worker, code, signal) =>
        logger.info(`Worker ${worker.process.pid} ha caído.`)
    );
} else {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    //Motor de vistas
    app.set("views", process.cwd() + "/views");
    app.set("view engine", "ejs");

    //Middlewares
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    app.use(express.static(process.cwd() + "/public"));
    app.use(
        session({
            secret: config.mongoDB.secret,
            store: MongoStore.create({
                mongoUrl: config.mongoDB.cnx,
                mongoOptions: advancedOptions,
            }),
            resave: true,
            saveUninitialized: true,
            rolling: true,
            cookie: { maxAge: 600000 },
        })
    );
    app.use(passport.initialize());
    app.use(passport.session());
    app.use("/", sessionRoutes);
    app.use("/home", authorize, homeRoutes);
    app.use("/api/products", authorize, productsRoutes);
    app.use("/api/cart", authorize, cartRoutes);
    app.use("/api/user", authorize, userRoutes);
    app.use("/api/order", authorize, orderRoutes);

    app.use(function (req, res, next) {
        res.redirect("/");
    });

    io.on("connection", async (socket) => {
        try {
            logger.info("Cliente conectado");
            let data = await chat.getAll();
            if (data.length > 0) return io.sockets.emit("chat", data);
        } catch (error) {
            logger.error(error);
        }

        socket.on("msn", async (msn) => {
            try {
                await chat.addChat(msn);
                io.sockets.emit("email", msn.email);
                let data = await chat.getAll();
                if (data.length > 0) return io.sockets.emit("chat", data);
            } catch (error) {
                logger.error(error);
            }
        });

        socket.on("disconnect", () => {
            try {
                chat.deleteAll();
                logger.info("Usuario desconectado");
            } catch (error) {
                logger.error(error);
            }
        });
    });

    server.listen(PORT, async () => {
        logger.info(
            `Servidor HTTP escuchando en el puerto: ${
                server.address().port
            }, en modo ${SERVER} y en Entorno **${
                process.env.NODE_ENV
            }**, PROCESS ARGV: ${process.argv.slice(2)}`
        );
    });

    server.on("error", (error) => logger.error(`Error en servidor: ${error}`));
}
