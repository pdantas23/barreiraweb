const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const appJson = require("./app.json");

module.exports = appJson;
