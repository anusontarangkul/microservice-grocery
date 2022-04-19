const express = require('express')
const app = express()
const PORT = process.env.PORT_ONE || 7071;
const mongoose = require('mongoose')
const amqp = require('amqplib')
const jwt = require('jsonwebtoken')
const Product = require("./Product")
const isAuthenticated = require('../isAuthenticated')

app.use(express.json())

let channel, connection
let order

mongoose.connect('mongodb://localhost/product-service', {}, () => {
    console.log('Product-service DB connected')
})

async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer)
    channel = await connection.createChannel()
    await channel.assertQueue("PRODUCT")
}

connect()

// docker run -p 5672:5672 rabbitmq

// Create a new product.
app.post('/product/create', isAuthenticated, async (req, res) => {
    // req.user.email 

    const { name, description, price } = req.body
    const newProduct = new Product({
        name,
        description,
        price
    })
    console.log('newProduct', newProduct)
    newProduct.save()
    return res.json(newProduct)
})

// user sends a list of product's IDs to buy
// Creating an order with those products and a total value of sum of product's prices

app.post('/product/buy', isAuthenticated, async (req, res) => {
    const { ids } = req.body
    console.log('ids', ids)
    const products = await Product.find({ _id: { $in: ids } })
    console.log('products', products)
    channel.sendToQueue('ORDER', Buffer.from(JSON.stringify({
        products,
        userEmail: req.user.email
    })))
    channel.consume("PRODUCT", data => {
        console.log('consuming PRODUCT queue')
        order = JSON.parse(data.content)
        channel.ack(data)
    })
    return res.json(order)
})


app.listen(PORT, () => {
    console.log(`Product-service at ${PORT}`)
})