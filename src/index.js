const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  // Fork workers.
  for (let i = 0; i < numCPUs; i+=1) {
    cluster.fork();
  }
  cluster.on("exit", function (worker, code, signal) {
    console.log("worker " + worker.process.pid + "died");
    process.exit(1);
  });
} else {
  const express = require("express"),
    app = express(),
    device = require("express-device"),
    fs = require("fs"),
    compression = require("compression"),
    bodyParser = require("body-parser"),
    helmet = require("helmet"),
    os = require("os"),
    routes = require('../routes/index');
    morgan = require("morgan"),
    moment = require("moment"),
    httpStatus = require('../helpers/http_status.js'),
    winston = require("winston"),
    addRequestId = require("express-request-id")();
  (global.envConfig = require("../secrets/envConfig")),
    (global.validator = require("sanitation")),
  global.config = require("../helpers/apiConfig");
  try {
    const httpProtocol = global.envConfig[global.envConfig.environmentName]
      .appSSL.enabled
      ? require("https")
      : require("http");

    let logFolder = `logs/${os.hostname()}`;

    if (!fs.existsSync(logFolder)) {
      try {
        fs.mkdirSync(logFolder, { recursive: true });
      } catch (e) {
        throw new Error(
          `Error creating log folder ${logFolder} - ${JSON.stringify(e)}`
        );
      }
    }

    /**
     * Specify a single subnet(part of url) for trusted proxy.
     **/
    app.set("trust proxy", "loopback");

    /**
     * Protects the application from some well known web vulnerabilities by setting HTTP headers appropriately.
     **/
    app.use(helmet());

    /**
     * Decrease the size of the response body to increase the speed of a web application.
     **/
    app.use(compression());

    /**
     * Capture the device information of the user.
     **/
    app.use(device.capture({ parseUserAgent: true }));

    /**
     * Allow headers for cross domain.
     **/
    app.use((req, res, next) => {
      const allowOrigin = req.headers.origin || "*";
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Access-Control-Allow-Credentials", true);
      res.setHeader(
        "Access-Control-Allow-Headers",
        "X-Requested-With, Content-Type, X-Mail-Id"
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      next();
    });

    const accessLogStream = fs.createWriteStream(`${logFolder}/access.log`, {
      flags: "a",
    });

    global.logger = new winston.Logger({
      transports: [
        new winston.transports.File({
          timestamp: () => {
            return moment(new Date()).utc().format("YYYY-MM-DDTHH:mm:ss");
          },
          formatter: (options) => {
            return (
              options.timestamp() +
              " " +
              options.level.toUpperCase() +
              " " +
              (undefined !== options.message ? options.message : "") +
              (options.meta && Object.keys(options.meta).length
                ? "\n\t" + JSON.stringify(options.meta)
                : "")
            );
          },
          colorize: true,
          name: "access-file",
          stream: accessLogStream,
          handleExceptions: true,
          humanReadableUnhandledException: true,
          json: false,
        }),
      ],
      exitOnError: false,
    });

    /**
     * Create server log stream.
     **/
    const serverLogStream = fs.createWriteStream(`${logFolder}/server.log`, {
      flags: "a",
    });

    /**
     * Define server log date format.
     **/
    morgan.token("date", (req, res) => {
      return moment(new Date()).utc().format("YYYY-MM-DDTHH:mm:ss");
    });

    /**
     * Define server log request headers to be written.
     **/
    morgan.token("type", (req, res) => {
      return JSON.stringify(req.headers);
    });

    /**
     * Define server log user device information to be written.
     **/
    morgan.token("device", (req, res) => {
      return `DEVICE=${JSON.stringify(req.device)}`;
    });

    /**
     * Define server log UUID to be written.
     **/
    morgan.token("uuid", (req, res) => {
      return `UUID=${res._headers["x-request-id"]}`;
    });

    /**
     * Initialize response UUID.
     **/
    app.use(addRequestId);

    /**
     * API Routes
     **/
    app.use('/', routes);

    /**
     * Initialize server log writer.
     **/
    app.use(
      morgan(
        ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :type :device :uuid - :response-time ms',
        { stream: serverLogStream }
      )
    );

    /**
     * Initialize post data parsing.
     **/
    app.use(bodyParser.json());

    /**
     * Default handler for invalid API endpoint.
     **/
    app.all("*", (req, res) => {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        responseCode: global.config.default_error_code,
        responseDesc: global.config.default_error_message,
      });
    });

    /**
     * Default handler for uncaught exception error.
     **/
    app.use((err, req, res, next) => {
      global.logger.error(
        "UUID=" + res._headers["x-request-id"],
        "UncaughtException is encountered",
        "Error=" + err,
        "Stacktrace=" + err.stack
      );
      let response = {
        responseCode: httpStatus.INTERNAL_SERVER_ERROR,
        responseDesc: global.config.service_down_message,
      };
      if (res.headersSent) {
        clearInterval(req.timer);
        response = JSON.stringify(response);
        response = response.replace(/^({)/, "");
        return res.end('",' + response);
      }
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json(response);
    });

    /**
     * To start express server with secure connection.
     **/
    let httpServer = null;
    if (global.envConfig[global.envConfig.environmentName].appSSL.enabled) {
      let credentials = null;
      try {
        const certificate = fs.readFileSync(
          global.envConfig[global.envConfig.environmentName].appSSL.cert,
          "utf8"
        );
        const privateKey = fs.readFileSync(
          global.envConfig[global.envConfig.environmentName].appSSL.key,
          "utf8"
        );
        credentials = { cert: certificate, key: privateKey };
      } catch (e) {
        throw new Error(`Error reading the ssl files ${JSON.stringify(e)}`);
      }
      httpServer = httpProtocol.createServer(credentials, app);
    } else {
      httpServer = httpProtocol.createServer(app);
    }

    /**
     * Server start port.
     **/
    httpServer.listen(global.config.app_port, () => {
      global.logger.info(
        `${
          global.envConfig.environmentName.charAt(0).toUpperCase() +
          global.envConfig.environmentName.slice(1)
        } server started at port ${global.config.app_port}`
      );
    });
  } catch (e) {
    console.log(e);
    global.logger.error(`Error occured at ${__dirname} - ${e}`);
  }

  module.exports = app;
}
