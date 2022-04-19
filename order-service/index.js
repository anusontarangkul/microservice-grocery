const express = require('express')
const app = express()
const PORT = process.env.PORT_ONE || 7072;
const mongoose = require('mongoose')
const amqp = require('amqplib')
const jwt = require('jsonwebtoken')
const Order = require("./Order")
const isAuthenticated = require('../isAuthenticated')

app.use(express.json())

let channel, connection

mongoose.connect('mongodb://localhost/order-service', {}, () => {
    console.log('Order-service DB connected')
})

async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer)
    channel = await connection.createChannel()
    await channel.assertQueue("ORDER")
}

function createOrder(products, userEmail) {
    let total = 0;
    for (let t = 0; t < products.length; t++) {
        total += products[t].price
    }
    const newOrder = new Order({
        products,
        user: userEmail,
        total_price: total
    })
    newOrder.save()
    return newOrder
}

connect().then(() => {
    channel.consume("ORDER", data => {
        const { products, userEmail } = JSON.parse(data.content)
        console.log('Consuming ORDER queue')
        const newOrder = createOrder(products, userEmail)
        channel.ack(data)
        channel.sendToQueue(
            "PRODUCT",
            Buffer.from(JSON.stringify({ newOrder }))
        )
    })
})

// docker run -p 5672:5672 rabbitmq




app.listen(PORT, () => {
    console.log(`Order-service at ${PORT}`)
})