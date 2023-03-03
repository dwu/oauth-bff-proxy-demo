const axios = require('axios');

const express = require("express");
const app = express();
const port = 3001;

app.get("/", (req, res) => {
    console.log(`Got request with authorization=${req.get("Authorization")}`);
    if (typeof req.get("Authorization") === "undefined") {
        res.status(401).end();
    } else {
        axios.post("http://localhost:8080/realms/demo/protocol/openid-connect/token/introspect", {
            client_id: "backend",
            client_secret: "AgYpZcCq493juCmONNDbdy9v10PaX3vv",
            token: req.get("Authorization").replace(/^Bearer /, "")
        }, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }).then(function (axiosRes) {
            if (axiosRes.status == 200 && axiosRes.data.active == true) {
                res.send({
                    message: "Hello, I'm the backend!",
                    date: Date.now()
                });
            }
        });
    }
});

app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
});
